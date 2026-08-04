/**
 * rings.ts — Router dedicado ao sistema profissional de anilhas
 *
 * Endpoints:
 *   batches.list          — lista todos os lotes
 *   batches.create        — cria lote e gera anilhas individuais
 *   batches.update        — atualiza metadados do lote
 *   batches.delete        — remove lote (só se não houver anilhas em uso)
 *   batches.getById       — detalhe de um lote
 *   rings.listByBatch     — lista anilhas de um lote
 *   rings.getNext         — próxima anilha disponível (sugestão)
 *   rings.assign          — aloca anilha para pássaro (transacional)
 *   rings.release         — libera anilha de um pássaro
 *   rings.createManual    — cria anilha manual (sem lote automático)
 *   gaugeRules.list       — lista regras de bitola
 *   gaugeRules.suggest    — sugere bitola para espécie/raça
 *   stats                 — estatísticas gerais de anilhas
 */

import { z } from "zod";
import { protectedProcedure, platformAdminProcedure, router, requireTenantAccess } from "../_core/trpc";
import { getDb, getPool } from "../db";
import {
  ring_batches,
  rings,
  ring_gauge_rules,
  birds,
} from "../../drizzle/schema";
import { and, eq, desc, asc, isNull, or, ilike, sql } from "drizzle-orm";
import {
  getNextAvailableRing,
  assignRingToBird,
  createManualRing,
} from "../_core/ringAllocator";
import { parseRingCode } from "../_core/ringParser";
import { TRPCError } from "@trpc/server";
import { getCurrentTenantId, requireTenantId } from "../_core/tenant";
import { createRingBatchesAtomic, deleteUnusedRingBatchAtomic } from "../_core/ringBatchService";
import { resolveOfficialRingGuide } from "@shared/ringGuide";

// ─── Schema Zod para criação de lote ────────────────────────────────────────
const createBatchSchema = z.object({
  batch_number:    z.string().min(1).max(50),
  year:            z.number().int().min(2000).max(2100),
  color:           z.string().min(1).max(50),
  startNumber:     z.number().int().min(1).default(1),
  endNumber:       z.number().int().min(1).max(10000).default(200),
  breederCode:     z.string().max(50).optional(),
  associationName: z.string().max(100).optional(),
  speciesName:     z.string().max(50).optional(),
  breedName:       z.string().max(100).optional(),
  modality:        z.enum(["COR", "PORTE", "CANTO", "OUTRA"]).optional(),
  ringGaugeMm:     z.number().min(1).max(10).optional(),
  month:           z.number().int().min(1).max(12).optional(),
  prefix:          z.string().max(20).optional(),
  suffix:          z.string().max(20).optional(),
  formatPattern:   z.string().max(100).default("{breederCode}-{year}-{seq}"),
  notes:           z.string().max(500).optional(),
});

// ─── Router ─────────────────────────────────────────────────────────────────
export const ringsRouter = router({

  // ── Lotes ─────────────────────────────────────────────────────────────────
  batches: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
        let query: any = db.select().from(ring_batches);
        if (tenantId !== null && tenantId !== undefined) {
          query = query.where(eq(ring_batches.tenantId, tenantId));
        }
        return await query.orderBy(desc(ring_batches.year), desc(ring_batches.createdAt));
      } catch (e) {
        console.error("[rings.batches.list]", e);
        return [];
      }
    }),

    getById: protectedProcedure
      .input(z.number().int().positive())
      .query(async ({ ctx, input: id }) => {
        const db = await getDb();
        if (!db) return null;
        const rows = await db
          .select()
          .from(ring_batches)
          .where(eq(ring_batches.id, id))
          .limit(1);
        const batch = rows[0] ?? null;
        if (!batch) return null;
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
        if (tenantId !== null && tenantId !== undefined) {
          requireTenantAccess(ctx, batch.tenantId);
        }
        return batch;
      }),

    create: protectedProcedure
      .input(createBatchSchema)
      .mutation(async ({ ctx, input }) => {
        await getDb();
        const pool = getPool();
        if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

        const tenantId = requireTenantId(ctx);
        const [created] = await createRingBatchesAtomic(pool, tenantId, [{
          batch_number: input.batch_number,
          year: input.year,
          color: input.color,
          startNumber: input.startNumber,
          endNumber: input.endNumber,
          breederCode: input.breederCode,
          associationName: input.associationName,
          speciesName: input.speciesName,
          breedName: input.breedName,
          modality: input.modality,
          ringGaugeMm: input.ringGaugeMm,
          month: input.month,
          prefix: input.prefix,
          suffix: input.suffix,
          formatPattern: input.formatPattern,
          notes: input.notes,
        }]);

        return { success: true, batch: created.batch, generated: created.generated };
      }),

    /**
     * Cria um "pedido anual" já dividido por raça/bitola de uma vez — em
     * vez de o criador ter que criar cada lote manualmente e calcular a
     * faixa de numeração de cada um na mão. Ex.: pedir 200 anilhas no ano,
     * sendo 50 pra Roller (bitola menor) e 150 pra Gloster (bitola maior):
     * gera 2 lotes automaticamente, com faixas de numeração sequenciais
     * SEM sobreposição (1–50 pro primeiro, 51–200 pro segundo), cada um já
     * com a raça e a bitola certas — é isso que faz a seleção automática
     * de anilha (getNextAvailableRing) escolher a bitola certa pra cada
     * pássaro sozinha, sem o criador escolher manualmente.
     */
    createSplitOrder: protectedProcedure
      .input(z.object({
        year:            z.number().int().min(2000).max(2100),
        startNumber:     z.number().int().min(1).default(1),
        breederCode:     z.string().max(50).optional(),
        associationName: z.string().max(100).optional(),
        speciesName:     z.string().max(50).optional(),
        month:           z.number().int().min(1).max(12).optional(),
        prefix:          z.string().max(20).optional(),
        suffix:          z.string().max(20).optional(),
        formatPattern:   z.string().max(100).default("{breederCode}-{year}-{seq}"),
        splits: z.array(z.object({
          color:       z.string().min(1).max(50),
          breedName:   z.string().max(100),
          modality:    z.enum(["COR", "PORTE", "CANTO", "OUTRA"]).optional(),
          ringGaugeMm: z.number().min(1).max(10),
          quantity:    z.number().int().min(1).max(5000),
          notes:       z.string().max(500).optional(),
        })).min(1).max(20),
      }))
      .mutation(async ({ ctx, input }) => {
        await getDb();
        const pool = getPool();
        if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
        const tenantId = requireTenantId(ctx);

        let cursor = input.startNumber;
        const specs = input.splits.map((split, index) => {
          const startNumber = cursor;
          const endNumber = cursor + split.quantity - 1;
          cursor = endNumber + 1;
          return {
            batch_number: `${input.year}-${index + 1}`,
            year: input.year,
            color: split.color,
            startNumber,
            endNumber,
            breederCode: input.breederCode,
            associationName: input.associationName,
            speciesName: input.speciesName,
            breedName: split.breedName,
            modality: split.modality,
            ringGaugeMm: split.ringGaugeMm,
            month: input.month,
            prefix: input.prefix,
            suffix: input.suffix,
            formatPattern: input.formatPattern,
            notes: split.notes,
          };
        });

        const created = await createRingBatchesAtomic(pool, tenantId, specs);
        return {
          success: true,
          batches: created,
          totalGenerated: created.reduce((sum, item) => sum + item.generated, 0),
        };
      }),

    update: protectedProcedure
      .input(z.object({
        id:              z.number().int().positive(),
        color:           z.string().max(50).optional(),
        status:          z.string().max(20).optional(),
        associationName: z.string().max(100).optional(),
        notes:           z.string().max(500).optional(),
        ringGaugeMm:     z.number().min(1).max(10).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
        const tenantId = getCurrentTenantId(ctx);
        if (tenantId === null) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um criadouro." });

        const { id, ...fields } = input;
        const filtered = Object.fromEntries(
          Object.entries(fields).filter(([, v]) => v !== undefined)
        );

        const updated = await db
          .update(ring_batches)
          .set({ ...filtered, updatedAt: new Date() })
          .where(and(eq(ring_batches.id, id), eq(ring_batches.tenantId, tenantId)))
          .returning({ id: ring_batches.id });

        if (updated.length !== 1) throw new TRPCError({ code: "NOT_FOUND", message: "Lote não encontrado neste criadouro." });
        return { success: true };
      }),

    // ── Prévia antes de excluir — mostra o que está bloqueando ──────────────
    previewDelete: protectedProcedure
      .input(z.number().int().positive())
      .query(async ({ input: id, ctx }) => {
        const db = await getDb();
        const pool = getPool();
        if (!db || !pool) return null;
        const tenantId = getCurrentTenantId(ctx);
        if (tenantId === null) return null;
        const [ownedBatch] = await db.select({ id: ring_batches.id }).from(ring_batches).where(and(eq(ring_batches.id, id), eq(ring_batches.tenantId, tenantId))).limit(1);
        if (!ownedBatch) throw new TRPCError({ code: "NOT_FOUND", message: "Lote não encontrado neste criadouro." });

        const batchRings = await db.select().from(rings).where(and(eq(rings.batchId, id), eq(rings.tenantId, tenantId)));
        const total = batchRings.length;
        const inUseRows = batchRings.filter((r) => r.status === "in_use");

        // For each in_use ring, check if the bird still exists
        const orphanRings: typeof batchRings = [];
        const activeRings: typeof batchRings = [];

        for (const ring of inUseRows) {
          const { rows } = await pool.query<{ active: boolean }>(
            `SELECT (
               ($1::integer IS NOT NULL AND EXISTS (
                 SELECT 1 FROM birds WHERE id=$1 AND "tenantId"=$3 AND "deletedAt" IS NULL
               )) OR
               ($2::integer IS NOT NULL AND EXISTS (
                 SELECT 1 FROM chicks WHERE id=$2 AND "tenantId"=$3 AND "deletedAt" IS NULL
               ))
             ) AS active`,
            [ring.birdId, ring.chickId, tenantId],
          );
          if (rows[0]?.active) activeRings.push(ring);
          else orphanRings.push(ring);
        }

        const available = batchRings.filter((r) => r.status === "available").length;

        return {
          batchId: id,
          total,
          available,
          inUse: inUseRows.length,
          orphans: orphanRings.length,
          orphanNumbers: orphanRings.map((r) => r.number),
          activelyUsed: activeRings.length,
          activeNumbers: activeRings.map((r) => r.number),
          canSafeDelete: inUseRows.length === 0,
          canReconcileAndDelete: false,
          message: activeRings.length > 0
            ? `${activeRings.length} anilha(s) vinculada(s) a pássaro(s) ativo(s): ${activeRings.map((r) => r.number).join(", ")}`
            : orphanRings.length > 0
              ? `${orphanRings.length} anilha(s) possuem histórico de uso sem vínculo ativo. Serão preservadas como usadas; o lote deve ser arquivado.`
              : "Lote nunca utilizado e apto à exclusão segura.",
        };
      }),

    delete: protectedProcedure
      .input(z.number().int().positive())
      .mutation(async ({ input: id, ctx }) => {
        const db = await getDb();
        const pool = getPool();
        if (!db || !pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
        const tenantId = getCurrentTenantId(ctx);
        if (tenantId === null) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um criadouro." });
        const [ownedBatch] = await db.select({ id: ring_batches.id }).from(ring_batches).where(and(eq(ring_batches.id, id), eq(ring_batches.tenantId, tenantId))).limit(1);
        if (!ownedBatch) throw new TRPCError({ code: "NOT_FOUND", message: "Lote não encontrado neste criadouro." });

        // Check for rings in_use that have an ACTIVE bird (not deleted)
        const { rows: activeRows } = await pool.query<{ id: number; number: string }>(
          `SELECT r.id, r."number"
             FROM rings r
            WHERE r."batchId" = $1
              AND (
                r."usedAt" IS NOT NULL OR r.status IN ('in_use','used','reserved') OR
                EXISTS (SELECT 1 FROM birds b WHERE b.id=r."birdId" AND b."deletedAt" IS NULL) OR
                EXISTS (SELECT 1 FROM chicks c WHERE c.id=r."chickId" AND c."deletedAt" IS NULL)
              )
            LIMIT 5`,
          [id]
        );

        if (activeRows.length > 0) {
          const nums = activeRows.map((r) => r.number).join(", ");
          throw new TRPCError({
            code: "CONFLICT",
            message: `Não é possível excluir: ${activeRows.length} anilha(s) vinculada(s) a pássaro(s) ativo(s) [${nums}]. Remova os pássaros primeiro ou use "Exclusão forçada".`,
          });
        }

        const deleted = await deleteUnusedRingBatchAtomic(pool, tenantId, id);
        return { success: true, deleted, message: "Lote não utilizado excluído com sucesso." };
      }),

    // ── Reconciliar anilhas órfãs de um lote ──────────────────────────────
    reconcileOrphans: protectedProcedure
      .input(z.number().int().positive())
      .mutation(async ({ input: batchId, ctx }) => {
        const db = await getDb();
        const pool = getPool();
        if (!db || !pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
        const tenantId = getCurrentTenantId(ctx);
        if (tenantId === null) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um criadouro." });
        const [ownedBatch] = await db.select({ id: ring_batches.id }).from(ring_batches).where(and(eq(ring_batches.id, batchId), eq(ring_batches.tenantId, tenantId))).limit(1);
        if (!ownedBatch) throw new TRPCError({ code: "NOT_FOUND", message: "Lote não encontrado neste criadouro." });

        // Corrige estado órfão sem devolver uma identidade já aplicada ao
        // estoque. A referência e a data de uso são preservadas para auditoria.
        const { rowCount } = await pool.query(
          `UPDATE rings
           SET status = 'used', "usedAt" = COALESCE("usedAt", NOW()), "updatedAt" = NOW()
           WHERE "batchId" = $1 AND "tenantId"=$2
             AND status = 'in_use'
             AND ("birdId" IS NULL OR NOT EXISTS (
               SELECT 1 FROM birds b WHERE b.id = rings."birdId" AND b."tenantId"=$2 AND b."deletedAt" IS NULL
             ))
             AND ("chickId" IS NULL OR NOT EXISTS (
               SELECT 1 FROM chicks c WHERE c.id = rings."chickId" AND c."tenantId"=$2 AND c."deletedAt" IS NULL
             ))`,
          [batchId, tenantId]
        );

        await pool.query(
          `UPDATE ring_batches
           SET quantity_used = (
             SELECT COUNT(*) FROM rings WHERE "batchId" = $1 AND status IN ('in_use','used')
           ), "updatedAt"=NOW()
           WHERE id = $1 AND "tenantId"=$2`,
          [batchId, tenantId]
        );

        const fixed = rowCount ?? 0;

        // Audit
        await pool.query(
          `INSERT INTO audit_logs ("userId","action","entityType","entityId","reason")
           VALUES ($1, 'reconcile_rings', 'ring_batch', $2, $3)`,
          [ctx.user.id ?? null, batchId, `Fixed ${fixed} orphan ring(s)`]
        ).catch(() => {});

        return { fixed, message: fixed > 0 ? `${fixed} anilha(s) órfã(s) preservada(s) como usadas. Arquive o lote para manter a rastreabilidade.` : "Nenhuma anilha órfã encontrada." };
      }),

    // ── Exclusão forçada (admin) ───────────────────────────────────────────
    forceDelete: platformAdminProcedure
      .input(z.object({
        batchId: z.number().int().positive(),
        mode: z.enum(["RECONCILE_AND_DELETE", "DELETE_AVAILABLE_ONLY", "FORCE_DELETE_ALL"]),
        confirmationText: z.literal("EXCLUIR LOTE"),
      }))
      .mutation(async ({ input, ctx }) => {
        const pool = getPool();
        if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
        if (input.mode === "FORCE_DELETE_ALL") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Exclusão destrutiva de anilhas aplicadas foi desativada para preservar a rastreabilidade. Arquive o lote.",
          });
        }

        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const batch = await client.query(`SELECT id FROM ring_batches WHERE id=$1 FOR UPDATE`, [input.batchId]);
          if (batch.rows.length !== 1) throw new TRPCError({ code: "NOT_FOUND", message: "Lote não encontrado." });

          if (input.mode === "RECONCILE_AND_DELETE") {
            await client.query(
              `UPDATE rings SET status='used',"usedAt"=COALESCE("usedAt",NOW()),"updatedAt"=NOW()
                WHERE "batchId"=$1 AND status='in_use'
                  AND ("birdId" IS NULL OR NOT EXISTS (SELECT 1 FROM birds b WHERE b.id=rings."birdId" AND b."deletedAt" IS NULL))
                  AND ("chickId" IS NULL OR NOT EXISTS (SELECT 1 FROM chicks c WHERE c.id=rings."chickId" AND c."deletedAt" IS NULL))`,
              [input.batchId],
            );
          }

          const applied = await client.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM rings
              WHERE "batchId"=$1 AND (
                "usedAt" IS NOT NULL OR "birdId" IS NOT NULL OR "chickId" IS NOT NULL OR
                status IN ('in_use','used','reserved')
              )`,
            [input.batchId],
          );
          if (Number(applied.rows[0]?.count ?? 0) > 0) {
            throw new TRPCError({ code: "CONFLICT", message: "O lote possui histórico de uso. Arquive-o; não é permitido apagar rastreabilidade." });
          }

          let deleted = 0;
          if (input.mode === "DELETE_AVAILABLE_ONLY") {
            const result = await client.query(`DELETE FROM rings WHERE "batchId"=$1 AND status='available'`, [input.batchId]);
            deleted = result.rowCount ?? 0;
            await client.query(
              `UPDATE ring_batches SET quantity_total=(SELECT COUNT(*) FROM rings WHERE "batchId"=$1), "updatedAt"=NOW() WHERE id=$1`,
              [input.batchId],
            );
          } else {
            const ringResult = await client.query(`DELETE FROM rings WHERE "batchId"=$1`, [input.batchId]);
            const batchResult = await client.query(`DELETE FROM ring_batches WHERE id=$1`, [input.batchId]);
            deleted = (ringResult.rowCount ?? 0) + (batchResult.rowCount ?? 0);
          }

          await client.query(
            `INSERT INTO audit_logs ("userId","action","entityType","entityId","reason") VALUES ($1,'force_delete_ring_batch','ring_batch',$2,$3)`,
            [ctx.user.id, input.batchId, `safe_mode=${input.mode}, deleted=${deleted}`],
          );
          await client.query("COMMIT");
          return { success: true, deleted, mode: input.mode };
        } catch (error) {
          await client.query("ROLLBACK").catch(() => undefined);
          throw error;
        } finally {
          client.release();
        }
      }),

    // ── Reconciliar TODAS as anilhas órfãs (global) ───────────────────────
    reconcileAllOrphans: platformAdminProcedure
      .mutation(async ({ ctx }) => {
        const pool = getPool();
        if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Pool indisponível." });

        const { rowCount: fixed } = await pool.query(
          `UPDATE rings
           SET status='used',"usedAt"=COALESCE("usedAt",NOW()),"updatedAt"=NOW()
           WHERE status='in_use'
           AND ("birdId" IS NULL OR NOT EXISTS(
             SELECT 1 FROM birds b WHERE b.id=rings."birdId" AND b."deletedAt" IS NULL
           ))
           AND ("chickId" IS NULL OR NOT EXISTS(
             SELECT 1 FROM chicks c WHERE c.id=rings."chickId" AND c."deletedAt" IS NULL
           ))`
        );

        // Recalculate all batches' quantity_used
        await pool.query(
          `UPDATE ring_batches rb
           SET quantity_used=(SELECT COUNT(*) FROM rings WHERE "batchId"=rb.id AND status IN ('in_use','used')),
               "updatedAt"=NOW()`
        );

        await pool.query(
          `INSERT INTO audit_logs ("userId","action","entityType","reason")
           VALUES ($1,'reconcile_rings','rings','Global orphan preservation')`,
          [ctx.user.id ?? null]
        ).catch(() => {});

        return { fixed: fixed ?? 0, message: `${fixed ?? 0} anilha(s) órfã(s) preservada(s) como usadas em todos os lotes.` };
      }),
  }), // end batches router

  // ── Anilhas individuais ────────────────────────────────────────────────────
  rings: router({
    listByBatch: protectedProcedure
      .input(z.object({
        batchId:  z.number().int().positive(),
        status:   z.string().optional(),
        page:     z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(500).default(50),
      }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { items: [], total: 0 };
        const tenantId = getCurrentTenantId(ctx);
        if (tenantId === null) return { items: [], total: 0 };
        const [batch] = await db.select({ id: ring_batches.id }).from(ring_batches).where(and(eq(ring_batches.id, input.batchId), eq(ring_batches.tenantId, tenantId))).limit(1);
        if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Lote não encontrado neste criadouro." });

        const conditions = [eq(rings.batchId, input.batchId), eq(rings.tenantId, tenantId)];
        if (input.status) conditions.push(eq(rings.status, input.status));

        const offset = (input.page - 1) * input.pageSize;

        const [items, countResult] = await Promise.all([
          db.select()
            .from(rings)
            .where(and(...conditions))
            .orderBy(asc(rings.sequence))
            .limit(input.pageSize)
            .offset(offset),
          db.select({ count: sql<number>`count(*)::int` })
            .from(rings)
            .where(and(...conditions)),
        ]);

        return { items, total: countResult[0]?.count ?? 0 };
      }),

    getNext: protectedProcedure
      .input(z.object({
        speciesName: z.string().optional(),
        breedName:   z.string().optional(),
        modality:    z.enum(["COR", "PORTE", "CANTO", "OUTRA"]).optional(),
        ringGaugeMm: z.number().optional(),
        year:        z.number().int().optional(),
        batchId:     z.number().int().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return null;
        // Para usuários operacionais, inclui tenantId nos critérios para filtrar lotes
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
        return getNextAvailableRing(db, { ...(input ?? {}), tenantId });
      }),

    assign: protectedProcedure
      .input(z.object({
        ringId: z.number().int().positive(),
        birdId: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        const pool = getPool();
        if (!db || !pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

        // Carrega anilha e pássaro para validar tenant antes de alocar
        const [ringRow] = await db.select().from(rings).where(eq(rings.id, input.ringId)).limit(1);
        if (!ringRow) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Anilha não encontrada." });
        }
        const [birdRow] = await db.select().from(birds).where(eq(birds.id, input.birdId)).limit(1);
        if (!birdRow) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Pássaro não encontrado." });
        }
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
        if (tenantId !== null && tenantId !== undefined) {
          requireTenantAccess(ctx, ringRow.tenantId);
          requireTenantAccess(ctx, birdRow.tenantId);
        }

        if (tenantId === null) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um criadouro." });
        const fullCode = await assignRingToBird(db, pool, input.ringId, input.birdId, tenantId);
        return { success: true, fullCode };
      }),

    release: protectedProcedure
      .input(z.number().int().positive())
      .mutation(async ({ ctx, input: birdId }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
        const tenantId = requireTenantId(ctx);
        const [birdRow] = await db.select({ id: birds.id }).from(birds).where(and(
          eq(birds.id, birdId),
          eq(birds.tenantId, tenantId),
        )).limit(1);
        if (!birdRow) throw new TRPCError({ code: "NOT_FOUND", message: "Pássaro não encontrado neste criadouro." });
        throw new TRPCError({
          code: "CONFLICT",
          message: "Uma anilha aplicada é identidade permanente e não pode voltar ao estoque. Corrija o cadastro do pássaro sem reutilizar a anilha.",
        });
      }),

    createManual: protectedProcedure
      .input(z.object({
        fullCode: z.string().min(1).max(100),
        batchId:  z.number().int().positive(),
        notes:    z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

        const tenantId = getCurrentTenantId(ctx);
        if (tenantId === null) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um criadouro." });
        const [batch] = await db.select({ id: ring_batches.id }).from(ring_batches).where(and(eq(ring_batches.id, input.batchId), eq(ring_batches.tenantId, tenantId))).limit(1);
        if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Lote não encontrado neste criadouro." });
        const ring = await createManualRing(db, { ...input, tenantId });
        return { success: true, ring };
      }),

    parse: protectedProcedure
      .input(z.object({
        fullCode:      z.string(),
        formatPattern: z.string(),
      }))
      .query(async ({ input }) => {
        return parseRingCode(input.fullCode, input.formatPattern);
      }),
  }),

  // ── Regras de bitola ───────────────────────────────────────────────────────
  gaugeRules: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(ring_gauge_rules)
        .where(eq(ring_gauge_rules.active, true))
        .orderBy(asc(ring_gauge_rules.speciesName), asc(ring_gauge_rules.breedName));
    }),

    suggest: protectedProcedure
      .input(z.object({
        speciesName: z.string(),
        breedName:   z.string().optional(),
        modality:    z.string().optional(),
      }))
      .query(async ({ input }) => {
        const official = resolveOfficialRingGuide(input);
        if (official) {
          return {
            id: 0,
            speciesName: input.speciesName,
            breedName: input.breedName ?? null,
            modality: input.modality ?? null,
            recommendedGaugeMm: official.recommendedGaugeMm,
            minGaugeMm: official.minGaugeMm,
            maxGaugeMm: official.maxGaugeMm,
            notes: official.notes ?? official.title,
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }

        const db = await getDb();
        if (!db) return null;

        // Tenta match exato espécie+raça primeiro, depois só espécie
        const conditions = [
          eq(ring_gauge_rules.active, true),
          eq(ring_gauge_rules.speciesName, input.speciesName),
        ];

        if (input.breedName) {
          conditions.push(eq(ring_gauge_rules.breedName, input.breedName));
        }
        if (input.modality) {
          conditions.push(eq(ring_gauge_rules.modality, input.modality));
        }

        const exact = await db
          .select()
          .from(ring_gauge_rules)
          .where(and(...conditions))
          .limit(1);

        if (exact.length > 0) return exact[0];

        // Fallback: só espécie
        const fallback = await db
          .select()
          .from(ring_gauge_rules)
          .where(and(
            eq(ring_gauge_rules.active, true),
            eq(ring_gauge_rules.speciesName, input.speciesName),
            isNull(ring_gauge_rules.breedName),
          ))
          .limit(1);

        return fallback[0] ?? null;
      }),
  }),

  // ── Estatísticas ───────────────────────────────────────────────────────────
  /**
   * Retorna contagens de anilhas e lotes por status.
   * Para usuários com tenantId (CANARIL_MANAGER, CANARIL_MEMBER, VIEWER),
   * as contagens são filtradas pelo tenantId da sessão. Plataforma Admin
   * (tenantId null) vê contagens globais.
   */
  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      return { total: 0, available: 0, inUse: 0, batches: 0, exhaustedBatches: 0 };
    }

    const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
    try {
      // Constrói filtros por tenantId se necessário
      const ringFilter = tenantId !== null && tenantId !== undefined ? eq(rings.tenantId, tenantId) : undefined;
      const batchFilter = tenantId !== null && tenantId !== undefined ? eq(ring_batches.tenantId, tenantId) : undefined;

      const [totalRows, availableRows, inUseRows, batchRows, exhaustedRows] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(rings)
          .where((ringFilter as any) ?? sql`true`),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(rings)
          .where(
            (ringFilter as any) !== undefined
              ? and(ringFilter as any, eq(rings.status, "available"))
              : eq(rings.status, "available")
          ),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(rings)
          .where(
            (ringFilter as any) !== undefined
              ? and(ringFilter as any, eq(rings.status, "in_use"))
              : eq(rings.status, "in_use")
          ),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(ring_batches)
          .where((batchFilter as any) ?? sql`true`),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(ring_batches)
          .where(
            (batchFilter as any) !== undefined
              ? and(batchFilter as any, eq(ring_batches.status, "exhausted"))
              : eq(ring_batches.status, "exhausted")
          ),
      ]);

      return {
        total: totalRows[0]?.count ?? 0,
        available: availableRows[0]?.count ?? 0,
        inUse: inUseRows[0]?.count ?? 0,
        batches: batchRows[0]?.count ?? 0,
        exhaustedBatches: exhaustedRows[0]?.count ?? 0,
      };
    } catch (e) {
      console.error("[rings.stats]", e);
      return { total: 0, available: 0, inUse: 0, batches: 0, exhaustedBatches: 0 };
    }
  }),
});
