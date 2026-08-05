import { z } from "zod";
import { protectedProcedure, router, requireTenantAccess } from "../_core/trpc";
import { getDb, getPool } from "../db";
import { birds, ring_batches, rings, couples, clutches, chicks, breeding_reminders, breeding_species_rules, cages } from "../../drizzle/schema";
import { and, eq, desc, sql, isNull, gte, lte } from "drizzle-orm";
import { generateBreedingReminders } from "../_core/breeding";
import { ringAndPromoteChick } from "../_core/ringPromotion";
import { getCurrentTenantId, requireTenantId } from "../_core/tenant";
import { createRingBatchesAtomic, deleteUnusedRingBatchAtomic } from "../_core/ringBatchService";

async function createChickAtomic(params: {
  tenantId: number;
  clutchId: number;
  ring?: string;
  sex?: string;
  colorCode?: string;
  birthDate: Date;
  ringDate?: Date;
  weanDate?: Date;
}) {
  const pool = getPool();
  if (!pool) throw new Error("Banco de dados não disponível.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const clutch = await client.query(
      `SELECT id FROM clutches WHERE id=$1 AND "tenantId"=$2 AND "deletedAt" IS NULL FOR UPDATE`,
      [params.clutchId, params.tenantId],
    );
    if (clutch.rows.length !== 1) throw new Error("Postura não encontrada neste criadouro.");

    let ringRow: { id: number; batchId: number; code: string } | null = null;
    if (params.ring?.trim()) {
      const lockedRing = await client.query<{ id: number; batchId: number; code: string }>(
        `SELECT id, "batchId" AS "batchId", COALESCE("fullCode", number) AS code
           FROM rings
          WHERE "tenantId"=$1
            AND (number=$2 OR "fullCode"=$2)
            AND status='available'
            AND "birdId" IS NULL AND "chickId" IS NULL
          ORDER BY id FOR UPDATE`,
        [params.tenantId, params.ring.trim()],
      );
      if (lockedRing.rows.length > 1) {
        throw new Error("A anilha está duplicada no inventário legado. Corrija a duplicidade antes de utilizá-la.");
      }
      ringRow = lockedRing.rows[0] ?? null;
      if (!ringRow) throw new Error("Anilha não encontrada ou já utilizada neste criadouro.");
    }

    const created = await client.query<Record<string, unknown>>(
      `INSERT INTO chicks
        ("clutchId", ring, sex, color_code, "birthDate", "hatchDateTime", "birthDateSource", "ringDate", "weanDate", status, "tenantId")
       VALUES ($1,$2,$3,$4,$5,$5,'recorded',$6,$7,'active',$8) RETURNING *`,
      [
        params.clutchId,
        ringRow?.code ?? null,
        params.sex ?? null,
        params.colorCode ?? null,
        params.birthDate,
        ringRow ? (params.ringDate ?? new Date()) : null,
        params.weanDate ?? null,
        params.tenantId,
      ],
    );
    const chick = created.rows[0];
    if (!chick || typeof chick.id !== "number") throw new Error("Falha ao criar filhote.");

    if (ringRow) {
      await client.query(
        `UPDATE rings SET status='in_use', "chickId"=$1, "usedAt"=NOW(), "updatedAt"=NOW() WHERE id=$2`,
        [chick.id, ringRow.id],
      );
      await client.query(
        `UPDATE ring_batches rb SET
           quantity_used=(SELECT COUNT(*)::integer FROM rings r WHERE r."batchId"=rb.id AND r.status IN ('in_use','used')),
           status=CASE WHEN EXISTS(SELECT 1 FROM rings r WHERE r."batchId"=rb.id AND r.status='available') THEN 'available' ELSE 'exhausted' END,
           "updatedAt"=NOW()
         WHERE rb.id=$1`,
        [ringRow.batchId],
      );
    }

    await client.query("COMMIT");
    return chick;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function createCoupleWithReminders(params: {
  tenantId: number;
  maleId: number;
  femaleId: number;
  cageId: number;
  pairingMethod: "monogamy" | "bigamy";
  maleReuseConfirmed: boolean;
  formationDate: Date;
}) {
  const pool = getPool();
  if (!pool) throw new Error("Banco de dados não disponível.");
  if (params.maleId === params.femaleId) throw new Error("Macho e fêmea devem ser pássaros diferentes.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const birdsResult = await client.query<{ id: number; sex: string; status: string }>(
      `SELECT id, sex, status FROM birds
        WHERE id = ANY($1::integer[])
          AND "tenantId" = $2
          AND "deletedAt" IS NULL
        FOR UPDATE`,
      [[params.maleId, params.femaleId], params.tenantId],
    );
    const male = birdsResult.rows.find((bird) => bird.id === params.maleId);
    const female = birdsResult.rows.find((bird) => bird.id === params.femaleId);
    if (!male || !female) throw new Error("Macho ou fêmea não pertence a este criadouro.");
    if (male.status !== "active" || female.status !== "active") throw new Error("Somente pássaros ativos podem formar um casal.");
    if (!new Set(["macho", "M"]).has(male.sex)) throw new Error("O pássaro selecionado como macho possui sexo incompatível.");
    if (!new Set(["fêmea", "F"]).has(female.sex)) throw new Error("O pássaro selecionado como fêmea possui sexo incompatível.");

    const cageResult = await client.query<{ id: number; code: string; status: string }>(
      `SELECT id, code, status FROM cages
        WHERE id=$1 AND "tenantId"=$2 AND "deletedAt" IS NULL
        FOR UPDATE`,
      [params.cageId, params.tenantId],
    );
    const cage = cageResult.rows[0];
    if (!cage) throw new Error("Selecione uma gaiola cadastrada neste criadouro.");
    if (cage.status === "maintenance") throw new Error("A gaiola selecionada está em manutenção.");

    const duplicate = await client.query<{ id: number }>(
      `SELECT id FROM couples
        WHERE "tenantId"=$1 AND status='active' AND "deletedAt" IS NULL
          AND "femaleId"=$2
        FOR UPDATE`,
      [params.tenantId, params.femaleId],
    );
    if (duplicate.rows.length > 0) throw new Error("A fêmea já está em um casal ativo.");

    const cageOccupied = await client.query<{ id: number }>(
      `SELECT id FROM couples
        WHERE "tenantId"=$1 AND status='active' AND "deletedAt" IS NULL AND "cageId"=$2
        FOR UPDATE`,
      [params.tenantId, params.cageId],
    );
    if (cageOccupied.rows.length > 0) throw new Error("A gaiola selecionada já possui um casal ativo.");

    const activeMaleUsage = await client.query<{ id: number }>(
      `SELECT id FROM couples
        WHERE "tenantId"=$1 AND status='active' AND "deletedAt" IS NULL AND "maleId"=$2
        FOR UPDATE`,
      [params.tenantId, params.maleId],
    );
    if (activeMaleUsage.rows.length > 0 && (params.pairingMethod !== "bigamy" || !params.maleReuseConfirmed)) {
      throw new Error("Este macho já está em outro casal ativo. Marque o método de bigamia e confirme o reaproveitamento do macho.");
    }

    if (activeMaleUsage.rows.length > 0) {
      await client.query(
        `UPDATE couples SET "pairingMethod"='bigamy', "maleReuseConfirmed"=TRUE, "updatedAt"=NOW()
          WHERE "tenantId"=$1 AND "maleId"=$2 AND status='active' AND "deletedAt" IS NULL`,
        [params.tenantId, params.maleId],
      );
    }

    const created = await client.query<Record<string, unknown>>(
      `INSERT INTO couples ("maleId","femaleId","cageNumber","cageId","pairingMethod","maleReuseConfirmed","formationDate",status,"tenantId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8) RETURNING *`,
      [params.maleId, params.femaleId, cage.code, params.cageId, params.pairingMethod, params.maleReuseConfirmed, params.formationDate, params.tenantId],
    );

    await client.query(`UPDATE cages SET status='occupied', "updatedAt"=NOW() WHERE id=$1 AND "tenantId"=$2`, [params.cageId, params.tenantId]);
    const couple = created.rows[0];
    if (!couple || typeof couple.id !== "number") throw new Error("Falha ao criar casal.");

    const reminders = generateBreedingReminders(params.formationDate);
    for (const reminder of reminders) {
      await client.query(
        `INSERT INTO breeding_reminders ("coupleId","eventType","expectedDate",notes) VALUES ($1,$2,$3,$4)`,
        [couple.id, reminder.eventType, reminder.expectedDate, reminder.notes ?? null],
      );
    }
    await client.query("COMMIT");
    return couple;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export const managementRouter = router({
  // ===== ANILHAS =====
  rings: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
        let query: any = db.select().from(ring_batches);
        if (tenantId !== null && tenantId !== undefined) {
          query = query.where(eq(ring_batches.tenantId, tenantId));
        }
        return await query.orderBy(desc(ring_batches.createdAt));
      } catch (error) {
        console.error("Error listing rings:", error);
        return [];
      }
    }),

    create: protectedProcedure
      .input(z.object({
        batch_number: z.string().trim().min(1).max(50),
        year: z.number().int().min(2000).max(2100),
        color: z.string().trim().max(50).optional(),
        startNumber: z.number().int().positive(),
        endNumber: z.number().int().positive().max(10000),
      }))
      .mutation(async ({ ctx, input }) => {
        await getDb();
        const pool = getPool();
        if (!pool) throw new Error("Banco de dados não disponível.");
        const tenantId = requireTenantId(ctx);
        const [created] = await createRingBatchesAtomic(pool, tenantId, [{
          batch_number: input.batch_number,
          year: input.year,
          color: input.color || "Padrão",
          startNumber: input.startNumber,
          endNumber: input.endNumber,
          formatPattern: "{year}-{seq}",
        }]);
        return { success: true, batch: created.batch, generated: created.generated };
      }),

    // Anilhas individuais disponíveis (para selects de cadastro de pássaro/filhote)
    listAvailable: protectedProcedure
      .input(z.object({ batchId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        try {
          const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
          const conditions: any[] = [eq(rings.status, "available")];
          if (tenantId !== null) conditions.push(eq(rings.tenantId, tenantId));
          if (input?.batchId) conditions.push(eq(rings.batchId, input.batchId));
          return await db.select().from(rings).where(and(...conditions)).orderBy(rings.sequence);
        } catch (error) {
          console.error("Error listing available rings:", error);
          return [];
        }
      }),

    // Todas as anilhas individuais de um lote (visão detalhada)
    listByBatch: protectedProcedure
      .input(z.number())
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        try {
          const tenantId = getCurrentTenantId(ctx);
          if (tenantId === null) return [];
          const [batch] = await db.select({ id: ring_batches.id }).from(ring_batches).where(and(eq(ring_batches.id, input), eq(ring_batches.tenantId, tenantId))).limit(1);
          if (!batch) throw new Error("Lote não encontrado neste criadouro.");
          return await db.select().from(rings).where(and(eq(rings.batchId, input), eq(rings.tenantId, tenantId))).orderBy(rings.sequence);
        } catch (error) {
          console.error("Error listing rings by batch:", error);
          return [];
        }
      }),

    // Edita cor/observações do lote. A faixa de numeração (início/fim) não
    // muda depois de gerada, pois isso já criou anilhas individuais reais.
    update: protectedProcedure
      .input(z.object({ id: z.number(), color: z.string().trim().optional(), status: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const tenantId = getCurrentTenantId(ctx);
        if (tenantId === null) throw new Error("Selecione um criadouro.");
        const { id, ...fields } = input;
        const updated = await db.update(ring_batches).set({ ...fields, updatedAt: new Date() }).where(and(eq(ring_batches.id, id), eq(ring_batches.tenantId, tenantId))).returning({ id: ring_batches.id });
        if (updated.length !== 1) throw new Error("Lote não encontrado neste criadouro.");
        return { success: true };
      }),

    // Remove o lote e as anilhas individuais ainda disponíveis dele. Anilhas
    // já em uso vinculadas a pássaros ATIVOS bloqueiam a remoção. Órfãs são ignoradas.
    delete: protectedProcedure
      .input(z.number())
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const pool = getPool();
        if (!db || !pool) throw new Error("Database not available");
        const tenantId = getCurrentTenantId(ctx);
        if (tenantId === null) throw new Error("Selecione um criadouro.");
        const [ownedBatch] = await db.select({ id: ring_batches.id }).from(ring_batches).where(and(eq(ring_batches.id, input), eq(ring_batches.tenantId, tenantId))).limit(1);
        if (!ownedBatch) throw new Error("Lote não encontrado neste criadouro.");

        const deleted = await deleteUnusedRingBatchAtomic(pool, tenantId, input);
        return { success: true, deleted };
      }),
  }),

  // ===== CRUZAMENTOS/CASAIS =====
  couples: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
        let query: any = db.select().from(couples);
        if (tenantId !== null && tenantId !== undefined) {
          query = query.where(eq(couples.tenantId, tenantId));
        }
        return await query.orderBy(desc(couples.createdAt));
      } catch (error) {
        console.error("Error listing couples:", error);
        return [];
      }
    }),

    getById: protectedProcedure
      .input(z.number())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return null;
        try {
          const result = await db.select().from(couples).where(eq(couples.id, input)).limit(1);
          const couple = result.length > 0 ? result[0] : null;
          if (!couple) return null;
          const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
          if (tenantId !== null && tenantId !== undefined) {
            requireTenantAccess(ctx, couple.tenantId);
          }
          return couple;
        } catch (error) {
          console.error("Error getting couple:", error);
          return null;
        }
      }),

    maleUsage: protectedProcedure
      .input(z.object({ maleId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const pool = getPool();
        if (!pool) return { active: [], history: [] };
        const tenantId = requireTenantId(ctx);
        const { rows } = await pool.query(
          `SELECT cp.id, cp.status, cp."deletedAt", cp."pairingMethod", cp."formationDate", cp."cageNumber", cp."cageId",
                  f.id AS "femaleId", f.ring AS "femaleRing", f."displayTitle" AS "femaleTitle",
                  COUNT(cl.id)::integer AS "clutchCount", MAX(cl."clutchDate") AS "lastClutchDate"
             FROM couples cp
             JOIN birds f ON f.id=cp."femaleId" AND f."tenantId"=$2
        LEFT JOIN clutches cl ON cl."coupleId"=cp.id AND cl."deletedAt" IS NULL AND cl."tenantId"=$2
            WHERE cp."maleId"=$1 AND cp."tenantId"=$2
         GROUP BY cp.id, f.id, f.ring, f."displayTitle"
         ORDER BY CASE WHEN cp.status='active' THEN 0 ELSE 1 END, cp."formationDate" DESC`,
          [input.maleId, tenantId],
        );
        return { active: rows.filter((r: any) => r.status === "active" && !r.deletedAt), history: rows };
      }),

    create: protectedProcedure
      .input(z.object({
        maleId: z.number().int().positive(),
        femaleId: z.number().int().positive(),
        cageId: z.number().int().positive(),
        pairingMethod: z.enum(["monogamy", "bigamy"]).default("monogamy"),
        maleReuseConfirmed: z.boolean().default(false),
        formationDate: z.date(),
      }))
      .mutation(async ({ ctx, input }) => {
        await getDb();
        const tenantId = requireTenantId(ctx);
        const couple = await createCoupleWithReminders({ tenantId, ...input });
        return { success: true, couple };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        maleId: z.number().optional(),
        femaleId: z.number().optional(),
        cageId: z.number().int().positive().optional(),
        pairingMethod: z.enum(["monogamy", "bigamy"]).optional(),
        maleReuseConfirmed: z.boolean().optional(),
        formationDate: z.date().optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { id, ...fields } = input;
        try {
          const [existing] = await db.select().from(couples).where(eq(couples.id, id));
          if (!existing) {
            throw new Error("Casal não encontrado.");
          }
          const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
          if (tenantId !== null && tenantId !== undefined) {
            requireTenantAccess(ctx, existing.tenantId);
          }
          // Mesma validação do create, mas ignorando o próprio casal sendo
          if (input.maleId !== undefined || input.femaleId !== undefined) {
            const checkMaleId = input.maleId ?? existing?.maleId;
            const checkFemaleId = input.femaleId ?? existing?.femaleId;
            const activeCouples = await db.select().from(couples).where(and(eq(couples.status, "active"), tenantId !== null && tenantId !== undefined ? eq(couples.tenantId, tenantId) : sql`1=1`));
            const duplicatePair = activeCouples.find((c) => c.id !== id && c.maleId === checkMaleId && c.femaleId === checkFemaleId);
            const femaleTaken = activeCouples.find((c) => c.id !== id && c.femaleId === checkFemaleId);
            if (duplicatePair) throw new Error("Este mesmo casal já está ativo.");
            if (femaleTaken) throw new Error("Este pássaro (fêmea) já está em outro casal ativo.");
          }
          const updateFields: Record<string, unknown> = { ...fields, updatedAt: new Date() };
          if (input.cageId !== undefined) {
            const [selectedCage] = await db.select().from(cages).where(and(
              eq(cages.id, input.cageId),
              eq(cages.tenantId, requireTenantId(ctx)),
              isNull(cages.deletedAt),
            )).limit(1);
            if (!selectedCage) throw new Error("Selecione uma gaiola cadastrada neste criadouro.");
            if (selectedCage.status === "maintenance") throw new Error("A gaiola selecionada está em manutenção.");
            const occupied = await db.select({ id: couples.id }).from(couples).where(and(
              eq(couples.cageId, input.cageId),
              eq(couples.tenantId, requireTenantId(ctx)),
              eq(couples.status, "active"),
              isNull(couples.deletedAt),
            ));
            if (occupied.some((row) => row.id !== id)) throw new Error("A gaiola selecionada já possui outro casal ativo.");
            updateFields.cageNumber = selectedCage.code;
          }

          const checkMaleId = input.maleId ?? existing.maleId;
          const otherMaleUsage = await db.select({ id: couples.id }).from(couples).where(and(
            eq(couples.maleId, checkMaleId),
            eq(couples.tenantId, requireTenantId(ctx)),
            eq(couples.status, "active"),
            isNull(couples.deletedAt),
          ));
          const hasOtherActiveMaleCouple = otherMaleUsage.some((row) => row.id !== id);
          const method = input.pairingMethod ?? existing.pairingMethod;
          const confirmed = input.maleReuseConfirmed ?? existing.maleReuseConfirmed;
          if (hasOtherActiveMaleCouple && (method !== "bigamy" || !confirmed)) {
            throw new Error("Este macho já está em outro casal ativo. Confirme o método de bigamia.");
          }

          await db.update(couples).set(updateFields).where(eq(couples.id, id));
          if (input.cageId !== undefined && input.cageId !== existing.cageId) {
            if (existing.cageId) {
              const stillUsed = await db.select({ id: couples.id }).from(couples).where(and(
                eq(couples.cageId, existing.cageId), eq(couples.status, "active"), isNull(couples.deletedAt),
              )).limit(1);
              if (stillUsed.length === 0) await db.update(cages).set({ status: "free", updatedAt: new Date() }).where(eq(cages.id, existing.cageId));
            }
            await db.update(cages).set({ status: "occupied", updatedAt: new Date() }).where(eq(cages.id, input.cageId));
          }
          if (input.status && input.status !== "active" && existing.cageId) {
            await db.update(cages).set({ status: "free", updatedAt: new Date() }).where(eq(cages.id, existing.cageId));
          }
          return { success: true };
        } catch (error) {
          console.error("Error updating couple:", error);
          throw error;
        }
      }),

    delete: protectedProcedure
      .input(z.number())
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        try {
          const [existing] = await db.select().from(couples).where(eq(couples.id, input));
          if (!existing) {
            throw new Error("Casal não encontrado.");
          }
          const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
          if (tenantId !== null && tenantId !== undefined) {
            requireTenantAccess(ctx, existing.tenantId);
          }
          await db.update(couples).set({
            status: "inactive",
            deletedAt: new Date(),
            deletedBy: ctx.user.id,
            updatedAt: new Date(),
          }).where(and(eq(couples.id, input), eq(couples.tenantId, requireTenantId(ctx))));
          if (existing.cageId) {
            await db.update(cages).set({ status: "free", updatedAt: new Date() }).where(and(
              eq(cages.id, existing.cageId), eq(cages.tenantId, requireTenantId(ctx)),
            ));
          }
          return { success: true };
        } catch (error) {
          console.error("Error deleting couple:", error);
          throw error;
        }
      }),
  }),

  // ===== POSTURAS =====
  clutches: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
        let query: any = db.select().from(clutches).where(isNull(clutches.deletedAt)).orderBy(desc(clutches.createdAt));
        if (tenantId !== null) query = db.select().from(clutches).where(and(isNull(clutches.deletedAt), eq(clutches.tenantId, tenantId))).orderBy(desc(clutches.createdAt));
        return query;
      } catch (error) {
        console.error("Error listing clutches:", error);
        return [];
      }
    }),

    getByCoupleId: protectedProcedure
      .input(z.number().int().positive())
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        const tenantId = requireTenantId(ctx);
        const [ownedCouple] = await db.select({ id: couples.id }).from(couples).where(and(
          eq(couples.id, input),
          eq(couples.tenantId, tenantId),
          isNull(couples.deletedAt),
        )).limit(1);
        if (!ownedCouple) throw new Error("Casal não encontrado neste criadouro.");
        return db.select().from(clutches).where(and(
          eq(clutches.coupleId, input),
          eq(clutches.tenantId, tenantId),
          isNull(clutches.deletedAt),
        )).orderBy(desc(clutches.clutchDate));
      }),

    create: protectedProcedure
      .input(z.object({
        coupleId: z.number(),
        clutchDate: z.date(),
        totalEggs: z.number(),
        fertilizedEggs: z.number(),
        infertileEggs: z.number().optional(),
        lostEggs: z.number().optional(),
        hatchedChicks: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const tenantId = requireTenantId(ctx);
        const [ownedCouple] = await db.select({ id: couples.id }).from(couples).where(and(
          eq(couples.id, input.coupleId),
          eq(couples.tenantId, tenantId),
          eq(couples.status, "active"),
          isNull(couples.deletedAt),
        )).limit(1);
        if (!ownedCouple) throw new Error("Casal ativo não encontrado neste criadouro.");
        try {
          // Aviso (não bloqueio) se o casal já passou do limite de posturas
          // no mesmo ano-calendário — usa a regra configurável
          // breeding_species_rules.maxClutchesPerSeason (padrão 3, já
          // existia no schema) em vez de um número fixo no código. Não
          // bloqueia o cadastro pra não impedir correção de dados históricos.
          const [rule] = await db.select().from(breeding_species_rules).limit(1);
          const maxPerYear = rule?.maxClutchesPerSeason ?? 3;

          const year = input.clutchDate.getFullYear();
          const yearStart = new Date(year, 0, 1);
          const yearEnd = new Date(year, 11, 31, 23, 59, 59);
          const sameYearClutches = await db.select().from(clutches).where(
            and(eq(clutches.coupleId, input.coupleId), gte(clutches.clutchDate, yearStart), lte(clutches.clutchDate, yearEnd), isNull(clutches.deletedAt))
          );
          const warning = sameYearClutches.length >= maxPerYear
            ? `Atenção: este casal já tem ${sameYearClutches.length} postura(s) registrada(s) em ${year}. O recomendado é no máximo ${maxPerYear} por ano, pra não desgastar o casal.`
            : null;

          await db.insert(clutches).values({
            coupleId: input.coupleId,
            clutchDate: input.clutchDate,
            totalEggs: input.totalEggs,
            fertilizedEggs: input.fertilizedEggs,
            infertileEggs: input.infertileEggs || 0,
            lostEggs: input.lostEggs || 0,
            hatchedChicks: input.hatchedChicks || 0,
            tenantId,
          });
          return { success: true, warning };
        } catch (error) {
          console.error("Error creating clutch:", error);
          throw error;
        }
      }),

    /**
     * Corrige/atualiza uma postura já registrada. Faltava completamente —
     * sem isso, nenhum erro de digitação (ovos, galados, ECLOSÕES) podia
     * ser corrigido depois, e o número de eclosões nunca podia ser
     * preenchido depois que os ovos realmente eclodiam.
     */
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        clutchDate: z.date().optional(),
        totalEggs: z.number().optional(),
        fertilizedEggs: z.number().optional(),
        infertileEggs: z.number().optional(),
        lostEggs: z.number().optional(),
        hatchedChicks: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const tenantId = requireTenantId(ctx);
        const { id, ...fields } = input;

        const [existing] = await db.select({ id: clutches.id, tenantId: clutches.tenantId }).from(clutches).where(eq(clutches.id, id)).limit(1);
        if (!existing) throw new Error("Postura não encontrada.");
        if (existing.tenantId !== tenantId) throw new Error("Esta postura não pertence ao seu criadouro.");

        await db.update(clutches).set({ ...fields, updatedAt: new Date() }).where(and(eq(clutches.id, id), eq(clutches.tenantId, tenantId)));
        return { success: true };
      }),

    /** Remove (soft delete) uma postura registrada por engano. */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const tenantId = requireTenantId(ctx);
        const uid = ctx.user.id;

        const [existing] = await db.select({ id: clutches.id, tenantId: clutches.tenantId }).from(clutches).where(eq(clutches.id, input.id)).limit(1);
        if (!existing) throw new Error("Postura não encontrada.");
        if (existing.tenantId !== tenantId) throw new Error("Esta postura não pertence ao seu criadouro.");

        await db.update(clutches).set({ deletedAt: new Date(), deletedBy: uid }).where(and(eq(clutches.id, input.id), eq(clutches.tenantId, tenantId)));
        return { success: true };
      }),
  }),

  // ===== FILHOTES =====
  chicks: router({
    /**
     * Anilha um filhote automaticamente e já cria o cadastro dele em
     * "Pássaros" — puxando anilha (próxima disponível no lote), pai, mãe
     * e gaiola do próprio casal. Cor e especialidade vêm de um valor
     * inicial (herdado do pai) só pra não deixar campo obrigatório vazio;
     * o criador completa o resto direto na ficha do pássaro recém-criado
     * (é exatamente o "preencher os dados restantes" pedido).
     *
     * O campo `birdId` em `chicks` já existia no schema, comentado como
     * "quando o filhote é promovido ao plantel" — mas nenhum endpoint
     * fazia isso de fato até agora.
     */
    ringAndPromote: protectedProcedure
      .input(z.object({
        clutchId: z.number().int().positive(),
        sex: z.enum(["macho", "fêmea", "indefinido"]).default("indefinido"),
        hatchDate: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Esta operação é deliberadamente atômica. Não usar inserts Drizzle
        // independentes aqui: uma falha nunca pode deixar ave, filhote ou
        // anilha em estados diferentes.
        await getDb(); // inicializa pool e garante migrations
        const pool = getPool();
        if (!pool) throw new Error("Banco de dados não disponível.");
        const tenantId = getCurrentTenantId(ctx);
        if (tenantId === null) {
          throw new Error("Selecione um criadouro antes de anilhar um filhote.");
        }
        return ringAndPromoteChick(pool, {
          tenantId,
          clutchId: input.clutchId,
          sex: input.sex,
          hatchDate: input.hatchDate,
        });
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
        let query: any = db.select().from(chicks).orderBy(desc(chicks.createdAt));
        if (tenantId !== null) query = query.where(eq(chicks.tenantId, tenantId));
        return query;
      } catch (error) {
        console.error("Error listing chicks:", error);
        return [];
      }
    }),

    getByClutchId: protectedProcedure
      .input(z.number())
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        const tenantId = getCurrentTenantId(ctx);
        if (tenantId === null) return [];
        return db.select().from(chicks).where(and(
          eq(chicks.clutchId, input),
          eq(chicks.tenantId, tenantId),
          isNull(chicks.deletedAt),
        )).orderBy(desc(chicks.birthDate));
      }),

    create: protectedProcedure
      .input(z.object({
        clutchId: z.number().int().positive(),
        ring: z.string().trim().min(1).max(100).optional(),
        sex: z.string().trim().max(20).optional(),
        color_code: z.string().trim().max(50).optional(),
        birthDate: z.date(),
        ringDate: z.date().optional(),
        weanDate: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await getDb();
        const tenantId = requireTenantId(ctx);
        const chick = await createChickAtomic({
          tenantId,
          clutchId: input.clutchId,
          ring: input.ring,
          sex: input.sex,
          colorCode: input.color_code,
          birthDate: input.birthDate,
          ringDate: input.ringDate,
          weanDate: input.weanDate,
        });
        return { success: true, chick };
      }),

    /**
     * Atualiza o status de um filhote já cadastrado (vivo → desmamado /
     * morto / vendido / transferido). Faltava completamente antes — só
     * dava pra CRIAR um filhote, nunca registrar uma perda ou um desmame
     * bem-sucedido depois. Sem isso, nenhum relatório de "quantos
     * vingaram" tinha como ser preciso, porque o dado nunca era capturado.
     */
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["active", "weaned", "died", "sold", "transferred"]).optional(),
        weanDate: z.date().optional().nullable(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant

        const { id, ...fields } = input;
        const [existing] = await db.select({ id: chicks.id, tenantId: chicks.tenantId }).from(chicks).where(eq(chicks.id, id)).limit(1);
        if (!existing) throw new Error("Filhote não encontrado.");
        if (tenantId !== null && existing.tenantId !== tenantId) {
          throw new Error("Este filhote não pertence ao seu criadouro.");
        }

        await db.update(chicks).set({ ...fields, updatedAt: new Date() }).where(eq(chicks.id, id));
        return { success: true };
      }),
  }),

  // ===== ESTATÍSTICAS =====
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { birds: 0, couples: 0, chicks: 0, rings: 0 };

      try {
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
        // Helpers de filtro
        const birdFilter   = tenantId ? eq(birds.tenantId, tenantId)         : undefined;
        const coupleFilter = tenantId ? eq(couples.tenantId, tenantId)        : undefined;
        const chickFilter  = tenantId ? eq(chicks.tenantId, tenantId)         : undefined;
        const ringFilter   = tenantId ? eq(rings.tenantId, tenantId)          : undefined;
        const batchFilter  = tenantId ? eq(ring_batches.tenantId, tenantId)   : undefined;

        const [birdsList, couplesList, chicksList, individualRings, ringBatches] = await Promise.all([
          birdFilter
            ? db.select().from(birds).where(birdFilter)
            : db.select().from(birds),
          coupleFilter
            ? db.select().from(couples).where(coupleFilter)
            : db.select().from(couples),
          chickFilter
            ? db.select().from(chicks).where(chickFilter)
            : db.select().from(chicks),
          ringFilter
            ? db.select().from(rings).where(ringFilter)
            : db.select().from(rings),
          batchFilter
            ? db.select().from(ring_batches).where(batchFilter)
            : db.select().from(ring_batches),
        ]);

        const availableIndividualRings = individualRings.filter((r) => r.status === "available").length;
        const legacyAvailableRings     = ringBatches.reduce(
          (sum, r) => sum + Math.max(0, r.quantity_total - r.quantity_used), 0
        );

        return {
          birds:   birdsList.length,
          couples: couplesList.filter((c) => c.status === "active").length,
          chicks:  chicksList.length,
          rings:   availableIndividualRings || legacyAvailableRings,
        };
      } catch (error) {
        console.error("Error getting dashboard stats:", error);
        return { birds: 0, couples: 0, chicks: 0, rings: 0 };
      }
    }),
  }),
});
