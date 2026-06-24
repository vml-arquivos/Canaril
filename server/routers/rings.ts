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
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getPool } from "../db";
import {
  ring_batches,
  rings,
  ring_gauge_rules,
} from "../../drizzle/schema";
import { and, eq, desc, asc, isNull, or, ilike, sql } from "drizzle-orm";
import { getQueryTenantId, assertSameTenant } from "../_core/tenant";
import {
  getNextAvailableRing,
  assignRingToBird,
  releaseRingFromBird,
  generateRingsForBatch,
  createManualRing,
} from "../_core/ringAllocator";
import { generateRingCode, parseRingCode } from "../_core/ringParser";
import { TRPCError } from "@trpc/server";

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
        const tenantId = getQueryTenantId(ctx);
        let q = db.select().from(ring_batches).orderBy(desc(ring_batches.year), desc(ring_batches.createdAt));
        if (tenantId !== null) q = q.where(eq(ring_batches.tenantId, tenantId)) as any;
        return q;
      } catch (e) {
        console.error("[rings.batches.list]", e);
        return [];
      }
    }),

    getById: protectedProcedure
      .input(z.number().int().positive())
      .query(async ({ input: id }) => {
        const db = await getDb();
        if (!db) return null;
        const rows = await db
          .select()
          .from(ring_batches)
          .where(eq(ring_batches.id, id))
          .limit(1);
        return rows[0] ?? null;
      }),

    create: protectedProcedure
      .input(createBatchSchema)
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
        const tenantId = getQueryTenantId(ctx);

        const quantity_total = input.endNumber - input.startNumber + 1;
        if (quantity_total <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "endNumber deve ser maior que startNumber." });
        }

        const [batch] = await db
          .insert(ring_batches)
          .values({
            batch_number:    input.batch_number,
            year:            input.year,
            color:           input.color,
            quantity_total,
            quantity_used:   0,
            status:          "available",
            breederCode:     input.breederCode,
            associationName: input.associationName,
            speciesName:     input.speciesName,
            breedName:       input.breedName,
            modality:        input.modality,
            ringGaugeMm:     input.ringGaugeMm,
            month:           input.month,
            prefix:          input.prefix,
            suffix:          input.suffix,
            startNumber:     input.startNumber,
            endNumber:       input.endNumber,
            currentNumber:   input.startNumber,
            formatPattern:   input.formatPattern,
            notes:           input.notes,
            tenantId:        tenantId ?? null,
          })
          .returning();

        // Gera anilhas individuais
        const generated = await generateRingsForBatch(db, batch.id, {
          year:          batch.year,
          month:         batch.month,
          breederCode:   batch.breederCode,
          prefix:        batch.prefix,
          suffix:        batch.suffix,
          formatPattern: batch.formatPattern,
          startNumber:   batch.startNumber,
          endNumber:     batch.endNumber,
          tenantId:      tenantId ?? null,
        });

        return { success: true, batch, generated };
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
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

        const { id, ...fields } = input;
        const filtered = Object.fromEntries(
          Object.entries(fields).filter(([, v]) => v !== undefined)
        );

        await db
          .update(ring_batches)
          .set({ ...filtered, updatedAt: new Date() })
          .where(eq(ring_batches.id, id));

        return { success: true };
      }),

    // ── Prévia antes de excluir — mostra o que está bloqueando ──────────────
    previewDelete: protectedProcedure
      .input(z.number().int().positive())
      .query(async ({ input: id }) => {
        const db = await getDb();
        const pool = getPool();
        if (!db || !pool) return null;

        const batchRings = await db.select().from(rings).where(eq(rings.batchId, id));
        const total = batchRings.length;
        const inUseRows = batchRings.filter((r) => r.status === "in_use");

        // For each in_use ring, check if the bird still exists
        const orphanRings: typeof batchRings = [];
        const activeRings: typeof batchRings = [];

        for (const ring of inUseRows) {
          if (!ring.birdId) {
            orphanRings.push(ring);
            continue;
          }
          const { rows } = await pool.query<{ id: number }>(
            `SELECT id FROM birds WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
            [ring.birdId]
          );
          if (rows.length === 0) orphanRings.push(ring);
          else activeRings.push(ring);
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
          canSafeDelete: activeRings.length === 0,
          canReconcileAndDelete: orphanRings.length > 0 && activeRings.length === 0,
          message: activeRings.length > 0
            ? `${activeRings.length} anilha(s) vinculada(s) a pássaro(s) ativo(s): ${activeRings.map((r) => r.number).join(", ")}`
            : orphanRings.length > 0
              ? `${orphanRings.length} anilha(s) marcada(s) como em uso sem pássaro ativo (órfãs). Podem ser corrigidas automaticamente.`
              : "Lote pode ser excluído com segurança.",
        };
      }),

    delete: protectedProcedure
      .input(z.number().int().positive())
      .mutation(async ({ input: id }) => {
        const db = await getDb();
        const pool = getPool();
        if (!db || !pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

        // Check for rings in_use that have an ACTIVE bird (not deleted)
        const { rows: activeRows } = await pool.query<{ id: number; number: string }>(
          `SELECT r.id, r."number"
           FROM rings r
           JOIN birds b ON b.id = r."birdId"
           WHERE r."batchId" = $1
             AND r.status = 'in_use'
             AND r."birdId" IS NOT NULL
             AND b."deletedAt" IS NULL
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

        // Safe to delete — any remaining "in_use" are orphans (bird deleted)
        await db.delete(rings).where(eq(rings.batchId, id));
        await db.delete(ring_batches).where(eq(ring_batches.id, id));

        return { success: true, message: "Lote excluído com sucesso." };
      }),

    // ── Reconciliar anilhas órfãs de um lote ──────────────────────────────
    reconcileOrphans: protectedProcedure
      .input(z.number().int().positive())
      .mutation(async ({ input: batchId, ctx }) => {
        const db = await getDb();
        const pool = getPool();
        if (!db || !pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

        // Find in_use rings whose bird is deleted or doesn't exist
        const { rowCount } = await pool.query(
          `UPDATE rings
           SET status = 'available', "birdId" = NULL, "chickId" = NULL, "usedAt" = NULL, "updatedAt" = NOW()
           WHERE "batchId" = $1
             AND status = 'in_use'
             AND (
               "birdId" IS NULL
               OR NOT EXISTS (
                 SELECT 1 FROM birds b WHERE b.id = rings."birdId" AND b."deletedAt" IS NULL
               )
             )`,
          [batchId]
        );

        // Recalculate quantity_used on the batch
        await pool.query(
          `UPDATE ring_batches
           SET quantity_used = (
             SELECT COUNT(*) FROM rings WHERE "batchId" = $1 AND status = 'in_use'
           )
           WHERE id = $1`,
          [batchId]
        );

        const fixed = rowCount ?? 0;

        // Audit
        await pool.query(
          `INSERT INTO audit_logs ("userId","action","entityType","entityId","reason")
           VALUES ($1, 'reconcile_rings', 'ring_batch', $2, $3)`,
          [(ctx as any)?.userId ?? null, batchId, `Fixed ${fixed} orphan ring(s)`]
        ).catch(() => {});

        return { fixed, message: fixed > 0 ? `${fixed} anilha(s) órfã(s) corrigida(s). Lote pode ser excluído agora.` : "Nenhuma anilha órfã encontrada." };
      }),

    // ── Exclusão forçada (admin) ───────────────────────────────────────────
    forceDelete: protectedProcedure
      .input(z.object({
        batchId: z.number().int().positive(),
        mode: z.enum(["RECONCILE_AND_DELETE", "DELETE_AVAILABLE_ONLY", "FORCE_DELETE_ALL"]),
        confirmationText: z.literal("EXCLUIR LOTE"),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const pool = getPool();
        if (!db || !pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

        const client = await pool.connect();
        let deleted = 0;

        try {
          await client.query("BEGIN");

          if (input.mode === "RECONCILE_AND_DELETE") {
            // Fix orphans first, then delete all
            await client.query(
              `UPDATE rings
               SET status='available',"birdId"=NULL,"chickId"=NULL,"usedAt"=NULL
               WHERE "batchId"=$1 AND status='in_use'
               AND ("birdId" IS NULL OR NOT EXISTS(SELECT 1 FROM birds b WHERE b.id=rings."birdId" AND b."deletedAt" IS NULL))`,
              [input.batchId]
            );
            const { rowCount: rc } = await client.query(`DELETE FROM rings WHERE "batchId"=$1`, [input.batchId]);
            const { rowCount: rb } = await client.query(`DELETE FROM ring_batches WHERE id=$1`, [input.batchId]);
            deleted = (rc ?? 0) + (rb ?? 0);

          } else if (input.mode === "DELETE_AVAILABLE_ONLY") {
            const { rowCount: rc } = await client.query(
              `DELETE FROM rings WHERE "batchId"=$1 AND status='available'`,
              [input.batchId]
            );
            deleted = rc ?? 0;
            // Recalculate batch totals
            await client.query(
              `UPDATE ring_batches SET quantity_total=(SELECT COUNT(*) FROM rings WHERE "batchId"=$1) WHERE id=$1`,
              [input.batchId]
            );

          } else {
            // FORCE_DELETE_ALL — remove linked birds' ring references first
            await client.query(
              `UPDATE birds SET ring=ring WHERE id IN (SELECT "birdId" FROM rings WHERE "batchId"=$1 AND "birdId" IS NOT NULL)`,
              [input.batchId]
            );
            const { rowCount: rc } = await client.query(`DELETE FROM rings WHERE "batchId"=$1`, [input.batchId]);
            const { rowCount: rb } = await client.query(`DELETE FROM ring_batches WHERE id=$1`, [input.batchId]);
            deleted = (rc ?? 0) + (rb ?? 0);
          }

          await client.query(
            `INSERT INTO audit_logs ("userId","action","entityType","entityId","reason")
             VALUES ($1,'force_delete_ring_batch','ring_batch',$2,$3)`,
            [(ctx as any)?.userId ?? null, input.batchId, `mode=${input.mode}, deleted=${deleted}`]
          );

          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }

        return { success: true, deleted, mode: input.mode };
      }),

    // ── Reconciliar TODAS as anilhas órfãs (global) ───────────────────────
    reconcileAllOrphans: protectedProcedure
      .mutation(async ({ ctx }) => {
        const pool = getPool();
        if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Pool indisponível." });

        const { rowCount: fixed } = await pool.query(
          `UPDATE rings
           SET status='available',"birdId"=NULL,"chickId"=NULL,"usedAt"=NULL,"updatedAt"=NOW()
           WHERE status='in_use'
           AND ("birdId" IS NULL OR NOT EXISTS(
             SELECT 1 FROM birds b WHERE b.id=rings."birdId" AND b."deletedAt" IS NULL
           ))`
        );

        // Recalculate all batches' quantity_used
        await pool.query(
          `UPDATE ring_batches rb
           SET quantity_used=(SELECT COUNT(*) FROM rings WHERE "batchId"=rb.id AND status='in_use')`
        );

        await pool.query(
          `INSERT INTO audit_logs ("userId","action","entityType","reason")
           VALUES ($1,'reconcile_rings','rings','Global orphan reconciliation')`,
          [(ctx as any)?.userId ?? null]
        ).catch(() => {});

        return { fixed: fixed ?? 0, message: `${fixed ?? 0} anilha(s) órfã(s) corrigida(s) em todos os lotes.` };
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
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { items: [], total: 0 };

        const conditions = [eq(rings.batchId, input.batchId)];
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
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        return getNextAvailableRing(db, input ?? {});
      }),

    assign: protectedProcedure
      .input(z.object({
        ringId: z.number().int().positive(),
        birdId: z.number().int().positive(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        const pool = getPool();
        if (!db || !pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

        const fullCode = await assignRingToBird(db, pool, input.ringId, input.birdId);
        return { success: true, fullCode };
      }),

    release: protectedProcedure
      .input(z.number().int().positive())
      .mutation(async ({ input: birdId }) => {
        const db = await getDb();
        const pool = getPool();
        if (!db || !pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

        await releaseRingFromBird(db, pool, birdId);
        return { success: true };
      }),

    createManual: protectedProcedure
      .input(z.object({
        fullCode: z.string().min(1).max(100),
        batchId:  z.number().int().positive(),
        notes:    z.string().max(500).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

        const ring = await createManualRing(db, input);
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
  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { total: 0, available: 0, inUse: 0, batches: 0, exhaustedBatches: 0 };

    try {
      const tenantId = getQueryTenantId(ctx);
      const tenantFilter = tenantId !== null ? eq(rings.tenantId, tenantId) : undefined;
      const batchTenantFilter = tenantId !== null ? eq(ring_batches.tenantId, tenantId) : undefined;

      const [totalRows, availableRows, inUseRows, batchRows, exhaustedRows] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(rings).where(tenantFilter),
        db.select({ count: sql<number>`count(*)::int` }).from(rings).where(tenantFilter ? and(tenantFilter, eq(rings.status, "available")) : eq(rings.status, "available")),
        db.select({ count: sql<number>`count(*)::int` }).from(rings).where(tenantFilter ? and(tenantFilter, eq(rings.status, "in_use")) : eq(rings.status, "in_use")),
        db.select({ count: sql<number>`count(*)::int` }).from(ring_batches).where(batchTenantFilter),
        db.select({ count: sql<number>`count(*)::int` }).from(ring_batches).where(batchTenantFilter ? and(batchTenantFilter, eq(ring_batches.status, "exhausted")) : eq(ring_batches.status, "exhausted")),
      ]);

      return {
        total:            totalRows[0]?.count ?? 0,
        available:        availableRows[0]?.count ?? 0,
        inUse:            inUseRows[0]?.count ?? 0,
        batches:          batchRows[0]?.count ?? 0,
        exhaustedBatches: exhaustedRows[0]?.count ?? 0,
      };
    } catch (e) {
      console.error("[rings.stats]", e);
      return { total: 0, available: 0, inUse: 0, batches: 0, exhaustedBatches: 0 };
    }
  }),
});
