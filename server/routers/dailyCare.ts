/**
 * dailyCare.ts — Rotina Diária (Missão 3.1)
 *
 * Endpoints:
 *   listActiveCouples   — cards dos casais ativos com resumo do dia
 *   logEvent            — registrar evento (+ criação automática de postura)
 *   getCoupleLogs       — histórico de logs de um casal
 *   getClutchTimeline   — linha do tempo de uma postura
 *   recalculateClutch   — recalcular totais
 *   getDailySummary     — casais sem registro hoje
 *   getSpeciesRules     — regras de incubação/anilhamento
 */
import { z } from "zod";
import type { PoolClient } from "pg";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getPool } from "../db";
import {
  couples, birds, cages, clutches, breeding_daily_logs,
  breeding_species_rules, breeding_reminders, chicks,
} from "../../drizzle/schema";
import { eq, and, desc, gte, lte, isNull, sql, inArray } from "drizzle-orm";
import { EVENT_TYPES, computeTotalsFromLogs, recalculateClutchFromLogs, generateBreedingAlerts } from "../_core/breedingDailyAggregator";
import { getCurrentTenantId } from "../_core/tenant";
import { localDateString, dateAtLocalNoon, addLocalDays } from "../_core/localDate";

const TODAY = () => localDateString();

type LockedDailyLog = {
  id: number;
  coupleId: number;
  clutchId: number | null;
  date: string;
  eventType: string;
  quantity: number;
  tenantId: number | null;
};

async function recalculateClutchInTransaction(
  client: PoolClient,
  clutchId: number,
  tenantId: number | null,
): Promise<void> {
  await client.query(
    `UPDATE clutches SET
       "totalEggs" = GREATEST(0, COALESCE((SELECT SUM(CASE WHEN "eventType"='EGG_ADDED' THEN quantity WHEN "eventType"='EGG_REMOVED' THEN -quantity ELSE 0 END) FROM breeding_daily_logs WHERE "clutchId"=$1),0)),
       "fertilizedEggs" = GREATEST(0, COALESCE((SELECT SUM(quantity) FROM breeding_daily_logs WHERE "clutchId"=$1 AND "eventType"='EGG_FERTILE'),0)),
       "infertileEggs" = GREATEST(0, COALESCE((SELECT SUM(quantity) FROM breeding_daily_logs WHERE "clutchId"=$1 AND "eventType" IN ('EGG_INFERTILE','EGG_CLEAR')),0)),
       "lostEggs" = GREATEST(0, COALESCE((SELECT SUM(quantity) FROM breeding_daily_logs WHERE "clutchId"=$1 AND "eventType" IN ('EGG_LOST','EGG_BROKEN','EGG_ABANDONED')),0)),
       "hatchedChicks" = GREATEST(0, COALESCE((SELECT SUM(quantity) FROM breeding_daily_logs WHERE "clutchId"=$1 AND "eventType"='CHICK_HATCHED'),0)),
       "updatedAt" = NOW()
     WHERE id=$1 AND "tenantId" IS NOT DISTINCT FROM $2`,
    [clutchId, tenantId],
  );
}

async function syncRingingReminderForHatchDate(
  client: PoolClient,
  coupleId: number,
  hatchDate: string,
): Promise<void> {
  const totalResult = await client.query<{ total: number }>(
    `SELECT COALESCE(SUM(quantity), 0)::integer AS total
       FROM breeding_daily_logs
      WHERE "coupleId"=$1 AND date=$2 AND "eventType"='CHICK_HATCHED'`,
    [coupleId, hatchDate],
  );
  const total = Math.max(0, totalResult.rows[0]?.total ?? 0);
  const expectedDate = addLocalDays(hatchDate, 6);

  if (total === 0) {
    await client.query(
      `DELETE FROM breeding_reminders
        WHERE "coupleId"=$1 AND "eventType"='ringing'
          AND "expectedDate"=$2 AND completed=false`,
      [coupleId, expectedDate],
    );
    return;
  }

  const note = `Anilhar ${total} filhote(s) — janela calculada a partir da eclosão registrada.`;
  const updated = await client.query(
    `UPDATE breeding_reminders
        SET notes=$3
      WHERE "coupleId"=$1 AND "eventType"='ringing'
        AND "expectedDate"=$2 AND completed=false`,
    [coupleId, expectedDate, note],
  );
  if ((updated.rowCount ?? 0) === 0) {
    await client.query(
      `INSERT INTO breeding_reminders ("coupleId", "eventType", "expectedDate", completed, notes)
       VALUES ($1, 'ringing', $2, false, $3)`,
      [coupleId, expectedDate, note],
    );
  }
}

export const dailyCareRouter = router({

  // ─── Listar casais ativos com resumo do dia ─────────────────────────────
  listActiveCouples: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const tenantId = getCurrentTenantId(ctx);
    const coupleFilter = tenantId === null
      ? and(eq(couples.status, "active"), isNull(couples.deletedAt))
      : and(eq(couples.status, "active"), isNull(couples.deletedAt), eq(couples.tenantId, tenantId));

    const activeCouples = await db.select().from(couples).where(coupleFilter);
    if (activeCouples.length === 0) return [];

    const coupleIds = activeCouples.map((couple) => couple.id);
    const birdIds = [...new Set(activeCouples.flatMap((couple) => [couple.maleId, couple.femaleId]))];
    const cageIds = [...new Set(activeCouples.map((couple) => couple.cageId).filter((id): id is number => Number.isInteger(id)))];

    const birdFilter = tenantId === null
      ? inArray(birds.id, birdIds)
      : and(inArray(birds.id, birdIds), eq(birds.tenantId, tenantId));
    const clutchFilter = tenantId === null
      ? and(inArray(clutches.coupleId, coupleIds), isNull(clutches.deletedAt))
      : and(inArray(clutches.coupleId, coupleIds), eq(clutches.tenantId, tenantId), isNull(clutches.deletedAt));

    const [allBirds, allCages, allClutches, allLogs, speciesRules] = await Promise.all([
      db.select().from(birds).where(birdFilter),
      cageIds.length === 0
        ? Promise.resolve([])
        : db.select().from(cages).where(tenantId === null
            ? and(inArray(cages.id, cageIds), isNull(cages.deletedAt))
            : and(inArray(cages.id, cageIds), eq(cages.tenantId, tenantId), isNull(cages.deletedAt))),
      db.select().from(clutches).where(clutchFilter),
      db.select().from(breeding_daily_logs).where(inArray(breeding_daily_logs.coupleId, coupleIds)),
      db.select().from(breeding_species_rules).limit(1),
    ]);

    const clutchIds = allClutches.map((clutch) => clutch.id);
    const allChicks = clutchIds.length === 0
      ? []
      : await db.select().from(chicks).where(tenantId === null
          ? and(inArray(chicks.clutchId, clutchIds), isNull(chicks.deletedAt))
          : and(inArray(chicks.clutchId, clutchIds), eq(chicks.tenantId, tenantId), isNull(chicks.deletedAt)));

    const birdMap = new Map(allBirds.map((b) => [b.id, b]));
    const cageMap = new Map(allCages.map((c) => [c.id, c]));
    const clutchesByCouple = new Map<number, typeof allClutches>();
    for (const cl of allClutches) {
      const list = clutchesByCouple.get(cl.coupleId) ?? [];
      list.push(cl);
      clutchesByCouple.set(cl.coupleId, list);
    }
    const logsByCouple = new Map<number, typeof allLogs>();
    for (const log of allLogs) {
      const list = logsByCouple.get(log.coupleId) ?? [];
      list.push(log);
      logsByCouple.set(log.coupleId, list);
    }
    const chicksByClutch = new Map<number, typeof allChicks>();
    for (const c of allChicks) {
      const list = chicksByClutch.get(c.clutchId) ?? [];
      list.push(c);
      chicksByClutch.set(c.clutchId, list);
    }

    const rules = speciesRules[0] ?? { candlingDay: 7, incubationDaysMin: 13, incubationDaysMax: 14, ringingDayMin: 7, ringingDayMax: 9 };
    const today = new Date();
    const todayStr = TODAY();

    return activeCouples.map((couple) => {
      const male = birdMap.get(couple.maleId);
      const female = birdMap.get(couple.femaleId);
      const cage = cageMap.get(couple.cageId ?? 0);

      const coupleClutches = clutchesByCouple.get(couple.id) ?? [];
      const activeClutch = coupleClutches.sort((a, b) =>
        new Date(b.clutchDate).getTime() - new Date(a.clutchDate).getTime()
      )[0] ?? null;

      const coupleLogs = logsByCouple.get(couple.id) ?? [];
      const todayLogs = coupleLogs.filter((l) => l.date === todayStr);
      const lastLog = coupleLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      // Compute current egg state from all logs for active clutch
      const clutchLogs = activeClutch ? coupleLogs.filter((l) => l.clutchId === activeClutch.id) : [];
      const computedTotals = clutchLogs.length > 0 ? computeTotalsFromLogs(clutchLogs) : null;
      const totals = computedTotals ?? (activeClutch ? {
        totalEggs: activeClutch.totalEggs,
        fertilizedEggs: activeClutch.fertilizedEggs,
        infertileEggs: activeClutch.infertileEggs,
        lostEggs: activeClutch.lostEggs,
        hatchedChicks: activeClutch.hatchedChicks,
      } : null);

      // Status label
      let status = "ativo";
      if (totals && totals.hatchedChicks > 0) status = "com filhotes";
      else if (totals && totals.totalEggs > 0 && totals.fertilizedEggs > 0) status = "chocando";
      else if (totals && totals.totalEggs > 0) status = "em postura";

      // Alerts
      const alerts = activeClutch ? generateBreedingAlerts(activeClutch, today, rules) : [];

      // Days incubating
      const daysIncubating = activeClutch
        ? Math.floor((today.getTime() - new Date(activeClutch.clutchDate).getTime()) / 86400000)
        : null;

      // Predicted hatch window
      const predictedHatchMin = activeClutch
        ? new Date(new Date(activeClutch.clutchDate).getTime() + rules.incubationDaysMin * 86400000)
        : null;
      const predictedHatchMax = activeClutch
        ? new Date(new Date(activeClutch.clutchDate).getTime() + rules.incubationDaysMax * 86400000)
        : null;

      // Postura finalizada: já eclodiram filhotes E todos já foram
      // anilhados (chicks.birdId preenchido, via management.chicks.ringAndPromote).
      // Enquanto finalizada, a Rotina não deixa mais registrar nada nesta
      // postura — o criador precisa "iniciar nova postura" explicitamente.
      const clutchChicks = activeClutch ? (chicksByClutch.get(activeClutch.id) ?? []) : [];
      const chicksRingedCount = clutchChicks.filter((c) => !!c.birdId).length;
      const isPostureFinalized = !!activeClutch && activeClutch.hatchedChicks > 0 && chicksRingedCount >= activeClutch.hatchedChicks;

      return {
        coupleId: couple.id,
        cageNumber: couple.cageNumber,
        cageId: couple.cageId,
        status,
        formationDate: couple.formationDate,
        maleId: couple.maleId,
        femaleId: couple.femaleId,
        maleRing: male?.ring ?? `#${couple.maleId}`,
        femaleRing: female?.ring ?? `#${couple.femaleId}`,
        maleTitle: male?.displayTitle ?? null,
        femaleTitle: female?.displayTitle ?? null,
        sectorName: cage?.section ?? null,
        // Enquanto a postura está finalizada, não expomos o clutchId ativo
        // pra frente — assim nenhum botão da Rotina consegue gravar nele
        // por engano. O criador precisa clicar "Iniciar Nova Postura".
        activeClutchId: isPostureFinalized ? null : (activeClutch?.id ?? null),
        clutchDate: activeClutch?.clutchDate ?? null,
        daysIncubating,
        totals,
        alerts,
        predictedHatchMin,
        predictedHatchMax,
        hasLogToday: todayLogs.length > 0,
        lastLogDate: lastLog?.createdAt ?? null,
        todayEvents: todayLogs.map((l) => l.eventType),
        isPostureFinalized,
        chicksRingedCount,
        chicksExpected: activeClutch?.hatchedChicks ?? 0,
      };
    });
  }),

  // ─── Registrar evento ──────────────────────────────────────────────────
  logEvent: protectedProcedure
    .input(z.object({
      coupleId: z.number().int().positive(),
      clutchId: z.number().int().positive().optional().nullable(),
      cageId: z.number().int().positive().optional().nullable(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      eventType: z.enum(EVENT_TYPES),
      quantity: z.number().int().min(1).max(99).default(1),
      notePreset: z.string().max(100).optional().nullable(),
      noteText: z.string().max(1000).optional().nullable(),
      photoUrl: z.string().url().optional().nullable(),
      autoCreateClutch: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      await getDb();
      const pool = getPool();
      if (!pool) throw new Error("Banco não disponível.");
      const tenantId = getCurrentTenantId(ctx);
      if (tenantId === null) throw new Error("Selecione um criadouro.");

      const client = await pool.connect();
      const date = input.date ?? TODAY();
      let clutchId = input.clutchId ?? null;
      let warning: string | null = null;
      try {
        await client.query("BEGIN");

        const coupleResult = await client.query(
          `SELECT * FROM couples
            WHERE id = $1 AND "tenantId" = $2 AND "deletedAt" IS NULL
            FOR UPDATE`,
          [input.coupleId, tenantId],
        );
        if (coupleResult.rows.length !== 1) {
          throw new Error("Casal não encontrado neste criadouro.");
        }
        const couple = coupleResult.rows[0];

        if (input.cageId) {
          const cage = await client.query(
            `SELECT id FROM cages
              WHERE id = $1 AND "tenantId" = $2 AND "deletedAt" IS NULL`,
            [input.cageId, tenantId],
          );
          if (cage.rows.length !== 1) throw new Error("Gaiola não encontrada neste criadouro.");
        }

        if (clutchId) {
          const ownedClutch = await client.query(
            `SELECT id FROM clutches
              WHERE id = $1 AND "coupleId" = $2 AND "tenantId" = $3 AND "deletedAt" IS NULL
              FOR UPDATE`,
            [clutchId, input.coupleId, tenantId],
          );
          if (ownedClutch.rows.length !== 1) {
            throw new Error("A postura não pertence ao casal e criadouro informados.");
          }
        }

        if (input.eventType === "EGG_ADDED" && !clutchId && input.autoCreateClutch) {
          const created = await client.query<{ id: number }>(
            `INSERT INTO clutches (
               "coupleId", "clutchDate", "totalEggs", "fertilizedEggs",
               "infertileEggs", "lostEggs", "hatchedChicks", "tenantId"
             ) VALUES ($1, $2, 0, 0, 0, 0, 0, $3)
             RETURNING id`,
            [input.coupleId, dateAtLocalNoon(date), tenantId],
          );
          clutchId = created.rows[0].id;
        }

        if (input.eventType === "EGG_ADDED" && clutchId) {
          const totalResult = await client.query<{ total: number }>(
            `SELECT COALESCE(SUM(CASE
                WHEN "eventType"='EGG_ADDED' THEN quantity
                WHEN "eventType"='EGG_REMOVED' THEN -quantity
                ELSE 0 END), 0)::integer AS total
               FROM breeding_daily_logs WHERE "clutchId"=$1`,
            [clutchId],
          );
          const currentTotal = Math.max(0, totalResult.rows[0]?.total ?? 0);
          if (currentTotal + input.quantity > 8) {
            warning = `Atenção: esta postura passará a ter ${currentTotal + input.quantity} ovos. Verifique se o registro pertence à mesma postura.`;
          }
        }

        const logResult = await client.query(
          `INSERT INTO breeding_daily_logs (
             "coupleId", "clutchId", "cageId", date, "eventType", quantity,
             "notePreset", "noteText", "photoUrl", "createdBy"
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING *`,
          [
            input.coupleId, clutchId, input.cageId ?? couple.cageId ?? null,
            date, input.eventType, input.quantity, input.notePreset ?? null,
            input.noteText ?? null, input.photoUrl ?? null, ctx.user.id,
          ],
        );
        const log = logResult.rows[0];

        if (input.eventType === "CHICK_HATCHED") {
          if (!clutchId) throw new Error("Uma eclosão precisa estar vinculada a uma postura.");
          const hatchDate = dateAtLocalNoon(date);
          for (let i = 0; i < input.quantity; i += 1) {
            await client.query(
              `INSERT INTO chicks (
                 "clutchId", ring, sex, "color_code", "birthDate", "hatchDateTime",
                 "hatchLogId", "birthDateSource", status, "tenantId", notes
               ) VALUES ($1, NULL, NULL, NULL, $2, $2, $3, 'recorded', 'active', $4, $5)`,
              [clutchId, hatchDate, log.id, tenantId, input.quantity > 1 ? `Eclosão ${i + 1}/${input.quantity}` : null],
            );
          }
          const ringDate = addLocalDays(date, 6);
          await client.query(
            `INSERT INTO breeding_reminders ("coupleId", "eventType", "expectedDate", completed, notes)
             SELECT $1, 'ringing', $2, false, $3
              WHERE NOT EXISTS (
                SELECT 1 FROM breeding_reminders
                 WHERE "coupleId"=$1 AND "eventType"='ringing' AND "expectedDate"=$2 AND completed=false
              )`,
            [input.coupleId, ringDate, `Anilhar ${input.quantity} filhote(s) — janela calculada a partir da eclosão registrada.`],
          );
        }

        if (clutchId) {
          await client.query(
            `UPDATE clutches SET
               "totalEggs" = GREATEST(0, COALESCE((SELECT SUM(CASE WHEN "eventType"='EGG_ADDED' THEN quantity WHEN "eventType"='EGG_REMOVED' THEN -quantity ELSE 0 END) FROM breeding_daily_logs WHERE "clutchId"=$1),0)),
               "fertilizedEggs" = GREATEST(0, COALESCE((SELECT SUM(quantity) FROM breeding_daily_logs WHERE "clutchId"=$1 AND "eventType"='EGG_FERTILE'),0)),
               "infertileEggs" = GREATEST(0, COALESCE((SELECT SUM(quantity) FROM breeding_daily_logs WHERE "clutchId"=$1 AND "eventType" IN ('EGG_INFERTILE','EGG_CLEAR')),0)),
               "lostEggs" = GREATEST(0, COALESCE((SELECT SUM(quantity) FROM breeding_daily_logs WHERE "clutchId"=$1 AND "eventType" IN ('EGG_LOST','EGG_BROKEN','EGG_ABANDONED')),0)),
               "hatchedChicks" = GREATEST(0, COALESCE((SELECT SUM(quantity) FROM breeding_daily_logs WHERE "clutchId"=$1 AND "eventType"='CHICK_HATCHED'),0)),
               "updatedAt" = NOW()
             WHERE id=$1 AND "tenantId"=$2`,
            [clutchId, tenantId],
          );
        }

        await client.query("COMMIT");
        return { log, clutchId, warning };
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }),

  // ─── Histórico de logs de um casal ────────────────────────────────────
  getCoupleLogs: protectedProcedure
    .input(z.object({ coupleId: z.number().int().positive(), limitDays: z.number().int().default(30) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const tenantId = getCurrentTenantId(ctx);
      if (tenantId === null) return [];
      const [owned] = await db.select({ id: couples.id }).from(couples).where(and(eq(couples.id, input.coupleId), eq(couples.tenantId, tenantId), isNull(couples.deletedAt))).limit(1);
      if (!owned) throw new Error("Casal não encontrado neste criadouro.");
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - input.limitDays);
      return db.select().from(breeding_daily_logs)
        .where(and(eq(breeding_daily_logs.coupleId, input.coupleId), gte(breeding_daily_logs.createdAt, cutoff)))
        .orderBy(desc(breeding_daily_logs.createdAt));
    }),

  // ─── Linha do tempo de uma postura ────────────────────────────────────
  getClutchTimeline: protectedProcedure
    .input(z.object({ clutchId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const tenantId = getCurrentTenantId(ctx);
      if (tenantId === null) return [];
      const [owned] = await db.select({ id: clutches.id }).from(clutches).where(and(eq(clutches.id, input.clutchId), eq(clutches.tenantId, tenantId), isNull(clutches.deletedAt))).limit(1);
      if (!owned) throw new Error("Postura não encontrada neste criadouro.");
      return db.select().from(breeding_daily_logs)
        .where(eq(breeding_daily_logs.clutchId, input.clutchId))
        .orderBy(breeding_daily_logs.date, breeding_daily_logs.createdAt);
    }),

  // ─── Recalcular totais de uma postura ────────────────────────────────
  recalculateClutch: protectedProcedure
    .input(z.object({ clutchId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const pool = getPool();
      if (!db || !pool) throw new Error("Pool não disponível.");
      const tenantId = getCurrentTenantId(ctx);
      if (tenantId === null) throw new Error("Selecione um criadouro.");
      const [owned] = await db.select({ id: clutches.id }).from(clutches).where(and(eq(clutches.id, input.clutchId), eq(clutches.tenantId, tenantId), isNull(clutches.deletedAt))).limit(1);
      if (!owned) throw new Error("Postura não encontrada neste criadouro.");
      return recalculateClutchFromLogs(pool, input.clutchId);
    }),

  // ─── Casais sem registro hoje ─────────────────────────────────────────
  getDailySummary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { couplesWithLogs: [], couplesWithoutLogs: [], totalActive: 0 };
    const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
    const todayStr = TODAY();
    const coupleWhere = tenantId
      ? and(eq(couples.status, "active"), isNull(couples.deletedAt), eq(couples.tenantId, tenantId))
      : and(eq(couples.status, "active"), isNull(couples.deletedAt));

    const activeCouples = await db.select({ id: couples.id }).from(couples).where(coupleWhere);
    const activeIds = activeCouples.map((couple) => couple.id);
    const todayLogs = activeIds.length === 0
      ? []
      : await db.select({ coupleId: breeding_daily_logs.coupleId })
          .from(breeding_daily_logs)
          .where(and(eq(breeding_daily_logs.date, todayStr), inArray(breeding_daily_logs.coupleId, activeIds)));

    const withLogs = new Set(todayLogs.map((l) => l.coupleId));
    const couplesWithLogs = activeCouples.filter((c) => withLogs.has(c.id)).map((c) => c.id);
    const couplesWithoutLogs = activeCouples.filter((c) => !withLogs.has(c.id)).map((c) => c.id);

    return { couplesWithLogs, couplesWithoutLogs, totalActive: activeCouples.length };
  }),

  // ─── Regras de espécie ────────────────────────────────────────────────
  getSpeciesRules: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(breeding_species_rules);
  }),

  // ─── Excluir log (soft) ───────────────────────────────────────────────
  /**
   * Corrige um registro já lançado (quantidade e/ou observação) — sem isso,
   * um clique errado (ex: "Ovo quebrado" em vez de "Ovo perdido") não tinha
   * como ser corrigido, só apagado e recriado.
   */
  updateLog: protectedProcedure
    .input(z.object({
      logId: z.number().int().positive(),
      quantity: z.number().int().min(1).max(99).optional(),
      noteText: z.string().max(1000).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pool = getPool();
      if (!pool) throw new Error("Banco não disponível.");
      const tenantId = getCurrentTenantId(ctx);
      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        const locked = await client.query<LockedDailyLog>(
          `SELECT l.id,
                  l."coupleId" AS "coupleId",
                  l."clutchId" AS "clutchId",
                  l.date::text AS date,
                  l."eventType" AS "eventType",
                  l.quantity,
                  c."tenantId" AS "tenantId"
             FROM breeding_daily_logs l
             JOIN couples c ON c.id = l."coupleId"
            WHERE l.id=$1
              AND c."deletedAt" IS NULL
              AND ($2::integer IS NULL OR c."tenantId"=$2)
            FOR UPDATE OF l, c`,
          [input.logId, tenantId],
        );
        const log = locked.rows[0];
        if (!log) throw new Error("Log não encontrado neste criadouro.");

        if (log.eventType === "CHICK_HATCHED" && input.quantity !== undefined) {
          if (!log.clutchId) throw new Error("O registro de eclosão não possui postura vinculada.");

          const allLinked = await client.query<{ total: number; activeForTenant: number }>(
            `SELECT COUNT(*)::integer AS total,
                    COUNT(*) FILTER (
                      WHERE "deletedAt" IS NULL AND "tenantId" IS NOT DISTINCT FROM $2
                    )::integer AS "activeForTenant"
               FROM chicks
              WHERE "hatchLogId"=$1`,
            [log.id, log.tenantId],
          );
          if ((allLinked.rows[0]?.total ?? 0) === 0 && log.quantity > 0) {
            throw new Error(
              "Este é um registro de eclosão legado, criado antes da rastreabilidade por filhote. " +
              "A quantidade não pode ser alterada automaticamente sem risco de duplicar ou apagar indivíduos.",
            );
          }

          const activeLinked = await client.query<{
            id: number;
            protected: boolean;
          }>(
            `SELECT ch.id,
                    (
                      ch.ring IS NOT NULL OR ch."birdId" IS NOT NULL OR
                      ch.sex IS NOT NULL OR ch."color_code" IS NOT NULL OR
                      ch.status <> 'active' OR ch."ringDate" IS NOT NULL OR ch."weanDate" IS NOT NULL OR
                      EXISTS (SELECT 1 FROM rings r WHERE r."chickId"=ch.id) OR
                      EXISTS (SELECT 1 FROM photos p WHERE p."entityType"='chick' AND p."entityId"=ch.id)
                    ) AS protected
               FROM chicks ch
              WHERE ch."hatchLogId"=$1
                AND ch."tenantId" IS NOT DISTINCT FROM $2
                AND ch."deletedAt" IS NULL
              ORDER BY ch.id
              FOR UPDATE OF ch`,
            [log.id, log.tenantId],
          );

          if ((allLinked.rows[0]?.total ?? 0) !== activeLinked.rows.length) {
            throw new Error(
              "A eclosão possui filhotes arquivados ou com vínculo de criadouro inconsistente. " +
              "A correção automática foi bloqueada para preservar o histórico.",
            );
          }

          const target = input.quantity;
          const current = activeLinked.rows.length;
          if (target > current) {
            const hatchDate = dateAtLocalNoon(log.date);
            for (let i = current; i < target; i += 1) {
              await client.query(
                `INSERT INTO chicks (
                   "clutchId", ring, sex, "color_code", "birthDate", "hatchDateTime",
                   "hatchLogId", "birthDateSource", status, "tenantId", notes
                 ) VALUES ($1, NULL, NULL, NULL, $2, $2, $3, 'recorded', 'active', $4, $5)`,
                [
                  log.clutchId,
                  hatchDate,
                  log.id,
                  log.tenantId,
                  target > 1 ? `Eclosão ${i + 1}/${target} — quantidade corrigida` : "Eclosão — quantidade corrigida",
                ],
              );
            }
          } else if (target < current) {
            const removeCount = current - target;
            const removableIds = activeLinked.rows
              .filter((row) => !row.protected)
              .slice(-removeCount)
              .map((row) => row.id);
            if (removableIds.length !== removeCount) {
              throw new Error(
                "A quantidade não pode ser reduzida porque um ou mais filhotes deste lançamento já possuem anilha, " +
                "vínculo com o plantel ou fotos. Preserve o histórico e faça uma correção documental.",
              );
            }
            await client.query(
              `DELETE FROM chicks WHERE id = ANY($1::integer[])`,
              [removableIds],
            );
          }
        }

        await client.query(
          `UPDATE breeding_daily_logs
              SET quantity = COALESCE($2, quantity),
                  "noteText" = CASE WHEN $3::boolean THEN $4 ELSE "noteText" END,
                  "updatedAt" = NOW()
            WHERE id=$1`,
          [input.logId, input.quantity ?? null, input.noteText !== undefined, input.noteText ?? null],
        );

        if (log.clutchId) {
          await recalculateClutchInTransaction(client, log.clutchId, log.tenantId);
        }
        if (log.eventType === "CHICK_HATCHED") {
          await syncRingingReminderForHatchDate(client, log.coupleId, log.date);
        }

        await client.query(
          `INSERT INTO audit_logs ("tenantId","userId","action","entityType","entityId","oldValueJson","newValueJson","reason")
           VALUES ($1,$2,'update','breeding_daily_log',$3,$4,$5,'Correção de registro da rotina diária')`,
          [
            log.tenantId,
            ctx.user.id,
            log.id,
            JSON.stringify({ quantity: log.quantity }),
            JSON.stringify({ quantity: input.quantity ?? log.quantity, noteTextChanged: input.noteText !== undefined }),
          ],
        );

        await client.query("COMMIT");
        return { updated: true };
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }),

  deleteLog: protectedProcedure
    .input(z.object({ logId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const pool = getPool();
      if (!pool) throw new Error("Banco não disponível.");
      const tenantId = getCurrentTenantId(ctx);
      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        const locked = await client.query<LockedDailyLog>(
          `SELECT l.id,
                  l."coupleId" AS "coupleId",
                  l."clutchId" AS "clutchId",
                  l.date::text AS date,
                  l."eventType" AS "eventType",
                  l.quantity,
                  c."tenantId" AS "tenantId"
             FROM breeding_daily_logs l
             JOIN couples c ON c.id = l."coupleId"
            WHERE l.id=$1
              AND c."deletedAt" IS NULL
              AND ($2::integer IS NULL OR c."tenantId"=$2)
            FOR UPDATE OF l, c`,
          [input.logId, tenantId],
        );
        const log = locked.rows[0];
        if (!log) throw new Error("Log não encontrado neste criadouro.");

        if (log.eventType === "CHICK_HATCHED") {
          const allLinked = await client.query<{ total: number; activeForTenant: number }>(
            `SELECT COUNT(*)::integer AS total,
                    COUNT(*) FILTER (
                      WHERE "deletedAt" IS NULL AND "tenantId" IS NOT DISTINCT FROM $2
                    )::integer AS "activeForTenant"
               FROM chicks
              WHERE "hatchLogId"=$1`,
            [log.id, log.tenantId],
          );
          if ((allLinked.rows[0]?.total ?? 0) === 0 && log.quantity > 0) {
            throw new Error(
              "Este registro de eclosão é legado e não possui vínculo individual rastreável. " +
              "A exclusão automática foi bloqueada para não deixar filhotes órfãos.",
            );
          }
          if ((allLinked.rows[0]?.total ?? 0) !== (allLinked.rows[0]?.activeForTenant ?? 0)) {
            throw new Error(
              "A eclosão possui filhotes arquivados ou com vínculo de criadouro inconsistente. " +
              "A exclusão automática foi bloqueada para preservar o histórico.",
            );
          }

          const protectedLinked = await client.query<{ total: number }>(
            `SELECT COUNT(*)::integer AS total
               FROM chicks ch
              WHERE ch."hatchLogId"=$1
                AND ch."tenantId" IS NOT DISTINCT FROM $2
                AND ch."deletedAt" IS NULL
                AND (
                  ch.ring IS NOT NULL OR ch."birdId" IS NOT NULL OR
                  ch.sex IS NOT NULL OR ch."color_code" IS NOT NULL OR
                  ch.status <> 'active' OR ch."ringDate" IS NOT NULL OR ch."weanDate" IS NOT NULL OR
                  EXISTS (SELECT 1 FROM rings r WHERE r."chickId"=ch.id) OR
                  EXISTS (SELECT 1 FROM photos p WHERE p."entityType"='chick' AND p."entityId"=ch.id)
                )`,
            [log.id, log.tenantId],
          );
          if ((protectedLinked.rows[0]?.total ?? 0) > 0) {
            throw new Error(
              "O registro de eclosão não pode ser excluído porque já existem filhotes identificados, com status alterado, anilhados, promovidos ou documentados com fotos.",
            );
          }

          await client.query(
            `DELETE FROM chicks
              WHERE "hatchLogId"=$1
                AND "tenantId" IS NOT DISTINCT FROM $2
                AND "deletedAt" IS NULL`,
            [log.id, log.tenantId],
          );
        }

        await client.query(`DELETE FROM breeding_daily_logs WHERE id=$1`, [log.id]);

        if (log.clutchId) {
          await recalculateClutchInTransaction(client, log.clutchId, log.tenantId);
        }
        if (log.eventType === "CHICK_HATCHED") {
          await syncRingingReminderForHatchDate(client, log.coupleId, log.date);
        }

        await client.query(
          `INSERT INTO audit_logs ("tenantId","userId","action","entityType","entityId","oldValueJson","reason")
           VALUES ($1,$2,'delete','breeding_daily_log',$3,$4,'Exclusão corrigida de registro da rotina diária')`,
          [log.tenantId, ctx.user.id, log.id, JSON.stringify(log)],
        );

        await client.query("COMMIT");
        return { deleted: true };
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }),

  // ── Próximos anilhamentos — filhotes para anilhar nos próximos 7 dias ──
  nextRingReminders: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const tenantId = getCurrentTenantId(ctx);
    if (tenantId === null) return [];
    const now = new Date();
    const upcoming = new Date(now);
    upcoming.setDate(upcoming.getDate() + 7);

    const rows = await db.select({
      id: breeding_reminders.id,
      coupleId: breeding_reminders.coupleId,
      expectedDate: breeding_reminders.expectedDate,
      notes: breeding_reminders.notes,
      cageNumber: couples.cageNumber,
    })
      .from(breeding_reminders)
      .innerJoin(couples, eq(couples.id, breeding_reminders.coupleId))
      .where(and(
        eq(couples.tenantId, tenantId),
        isNull(couples.deletedAt),
        eq(breeding_reminders.eventType, "ringing"),
        eq(breeding_reminders.completed, false),
        gte(breeding_reminders.expectedDate, now),
        lte(breeding_reminders.expectedDate, upcoming),
      ))
      .orderBy(breeding_reminders.expectedDate)
      .limit(20);

    return rows.map((row) => {
      const daysLeft = Math.ceil((new Date(row.expectedDate).getTime() - Date.now()) / 86400000);
      return {
        id: row.id,
        coupleId: row.coupleId,
        cageNumber: row.cageNumber ?? "—",
        expectedDate: row.expectedDate,
        daysLeft,
        notes: row.notes,
        isUrgent: daysLeft <= 1,
      };
    });
  }),
});
