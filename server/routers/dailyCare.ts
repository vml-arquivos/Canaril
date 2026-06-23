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
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getPool } from "../db";
import {
  couples, birds, cages, clutches, breeding_daily_logs,
  breeding_species_rules, breeding_reminders,
} from "../../drizzle/schema";
import { eq, and, desc, gte, isNull } from "drizzle-orm";
import { EVENT_TYPES, computeTotalsFromLogs, recalculateClutchFromLogs, generateBreedingAlerts } from "../_core/breedingDailyAggregator";

const TODAY = () => new Date().toISOString().slice(0, 10);

export const dailyCareRouter = router({

  // ─── Listar casais ativos com resumo do dia ─────────────────────────────
  listActiveCouples: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const [activeCouples, allBirds, allCages, allClutches, allLogs, speciesRules] = await Promise.all([
      db.select().from(couples).where(and(eq(couples.status, "active"), isNull(couples.deletedAt))),
      db.select().from(birds),
      db.select().from(cages),
      db.select().from(clutches).where(isNull(clutches.deletedAt)),
      db.select().from(breeding_daily_logs),
      db.select().from(breeding_species_rules).limit(1),
    ]);

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
        activeClutchId: activeClutch?.id ?? null,
        clutchDate: activeClutch?.clutchDate ?? null,
        daysIncubating,
        totals,
        alerts,
        predictedHatchMin,
        predictedHatchMax,
        hasLogToday: todayLogs.length > 0,
        lastLogDate: lastLog?.createdAt ?? null,
        todayEvents: todayLogs.map((l) => l.eventType),
      };
    });
  }),

  // ─── Registrar evento ──────────────────────────────────────────────────
  logEvent: protectedProcedure
    .input(z.object({
      coupleId: z.number().int().positive(),
      clutchId: z.number().int().positive().optional().nullable(),
      cageId: z.number().int().positive().optional().nullable(),
      date: z.string().optional(),
      eventType: z.enum(EVENT_TYPES),
      quantity: z.number().int().min(1).max(99).default(1),
      notePreset: z.string().max(100).optional().nullable(),
      noteText: z.string().max(1000).optional().nullable(),
      photoUrl: z.string().url().optional().nullable(),
      autoCreateClutch: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível.");

      const pool = await getPool();
      const date = input.date ?? TODAY();
      let clutchId = input.clutchId ?? null;

      // Auto-create clutch on first EGG_ADDED
      if (input.eventType === "EGG_ADDED" && !clutchId && input.autoCreateClutch) {
        const [newClutch] = await db.insert(clutches).values({
          coupleId: input.coupleId,
          clutchDate: new Date(),
          totalEggs: 0,
          fertilizedEggs: 0,
          infertileEggs: 0,
          lostEggs: 0,
          hatchedChicks: 0,
        }).returning();
        clutchId = newClutch.id;
      }

      // Insert the log
      const [log] = await db.insert(breeding_daily_logs).values({
        coupleId: input.coupleId,
        clutchId,
        cageId: input.cageId ?? null,
        date,
        eventType: input.eventType,
        quantity: input.quantity,
        notePreset: input.notePreset ?? null,
        noteText: input.noteText ?? null,
        photoUrl: input.photoUrl ?? null,
        createdBy: (ctx as any)?.userId ?? null,
      }).returning();

      // Recalculate clutch totals
      if (clutchId && pool) {
        await recalculateClutchFromLogs(pool, clutchId);
      }

      return { log, clutchId };
    }),

  // ─── Histórico de logs de um casal ────────────────────────────────────
  getCoupleLogs: protectedProcedure
    .input(z.object({ coupleId: z.number().int().positive(), limitDays: z.number().int().default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - input.limitDays);
      return db.select().from(breeding_daily_logs)
        .where(and(eq(breeding_daily_logs.coupleId, input.coupleId), gte(breeding_daily_logs.createdAt, cutoff)))
        .orderBy(desc(breeding_daily_logs.createdAt));
    }),

  // ─── Linha do tempo de uma postura ────────────────────────────────────
  getClutchTimeline: protectedProcedure
    .input(z.object({ clutchId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(breeding_daily_logs)
        .where(eq(breeding_daily_logs.clutchId, input.clutchId))
        .orderBy(breeding_daily_logs.date, breeding_daily_logs.createdAt);
    }),

  // ─── Recalcular totais de uma postura ────────────────────────────────
  recalculateClutch: protectedProcedure
    .input(z.object({ clutchId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const pool = await getPool();
      if (!pool) throw new Error("Pool não disponível.");
      return recalculateClutchFromLogs(pool, input.clutchId);
    }),

  // ─── Casais sem registro hoje ─────────────────────────────────────────
  getDailySummary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { couplesWithLogs: [], couplesWithoutLogs: [], totalActive: 0 };

    const todayStr = TODAY();
    const [activeCouples, todayLogs] = await Promise.all([
      db.select({ id: couples.id }).from(couples).where(and(eq(couples.status, "active"), isNull(couples.deletedAt))),
      db.select({ coupleId: breeding_daily_logs.coupleId }).from(breeding_daily_logs).where(eq(breeding_daily_logs.date, todayStr)),
    ]);

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
  deleteLog: protectedProcedure
    .input(z.object({ logId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const pool = await getPool();
      if (!db || !pool) throw new Error("Banco não disponível.");

      const [log] = await db.select().from(breeding_daily_logs).where(eq(breeding_daily_logs.id, input.logId)).limit(1);
      if (!log) throw new Error("Log não encontrado.");

      await db.delete(breeding_daily_logs).where(eq(breeding_daily_logs.id, input.logId));

      if (log.clutchId) {
        await recalculateClutchFromLogs(pool, log.clutchId);
      }

      return { deleted: true };
    }),
});
