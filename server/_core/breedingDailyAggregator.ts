/**
 * breedingDailyAggregator.ts — Motor da Rotina Diária
 *
 * Aplica eventos do diário à postura (clutch) e recalcula totais.
 * Regra: O diário registra eventos. A postura guarda o estado consolidado.
 */
import type { Pool } from "pg";
import { breeding_daily_logs, clutches, chicks } from "../../drizzle/schema";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export const EVENT_TYPES = [
  "EGG_ADDED", "EGG_LOST", "EGG_BROKEN", "EGG_REMOVED", "EGG_ABANDONED",
  "EGG_FERTILE", "EGG_INFERTILE", "EGG_CLEAR",
  "CHICK_HATCHED", "CHICK_DIED", "CHICK_RINGED",
  "NEST_PHOTO", "FEEDING_OK", "FEEDING_PROBLEM",
  "NEST_CLEANED", "SUPPLEMENT_GIVEN", "MEDICATION_GIVEN", "GENERAL_NOTE",
] as const;
export type EventType = typeof EVENT_TYPES[number];

export type DailyEvent = {
  coupleId: number;
  clutchId?: number | null;
  cageId?: number | null;
  date?: string;
  eventType: EventType;
  quantity?: number;
  notePreset?: string | null;
  noteText?: string | null;
  photoUrl?: string | null;
  createdBy?: number | null;
};

export type ClutchTotals = {
  totalEggs: number;
  fertilizedEggs: number;
  infertileEggs: number;
  lostEggs: number;
  hatchedChicks: number;
};

// ─── Cálculo de totais a partir dos logs ─────────────────────────────────────

export function computeTotalsFromLogs(logs: Array<{ eventType: string; quantity: number }>): ClutchTotals {
  let totalEggs = 0;
  let fertilizedEggs = 0;
  let infertileEggs = 0;
  let lostEggs = 0;
  let hatchedChicks = 0;

  for (const log of logs) {
    const qty = Math.max(0, log.quantity ?? 1);
    switch (log.eventType as EventType) {
      case "EGG_ADDED":   totalEggs += qty; break;
      case "EGG_LOST":
      case "EGG_BROKEN":
      case "EGG_ABANDONED": lostEggs += qty; break;
      case "EGG_REMOVED": totalEggs = Math.max(0, totalEggs - qty); break;
      case "EGG_FERTILE": fertilizedEggs += qty; break;
      case "EGG_INFERTILE":
      case "EGG_CLEAR":   infertileEggs += qty; break;
      case "CHICK_HATCHED": hatchedChicks += qty; break;
    }
  }

  return {
    totalEggs: Math.max(0, totalEggs),
    fertilizedEggs: Math.max(0, fertilizedEggs),
    infertileEggs: Math.max(0, infertileEggs),
    lostEggs: Math.max(0, lostEggs),
    hatchedChicks: Math.max(0, hatchedChicks),
  };
}

// ─── Recalcular postura a partir dos logs (via pool direto) ──────────────────

export async function recalculateClutchFromLogs(pool: Pool, clutchId: number): Promise<ClutchTotals> {
  const { rows } = await pool.query<{ eventType: string; quantity: number }>(
    `SELECT "eventType", "quantity" FROM "breeding_daily_logs" WHERE "clutchId" = $1`,
    [clutchId]
  );

  const totals = computeTotalsFromLogs(rows);

  await pool.query(
    `UPDATE "clutches"
     SET "totalEggs" = $1, "fertilizedEggs" = $2, "infertileEggs" = $3,
         "lostEggs" = $4, "hatchedChicks" = $5
     WHERE "id" = $6`,
    [totals.totalEggs, totals.fertilizedEggs, totals.infertileEggs, totals.lostEggs, totals.hatchedChicks, clutchId]
  );

  return totals;
}

// ─── Resumo diário de casais ──────────────────────────────────────────────────

export async function getDailyCareSummary(pool: Pool, date: string): Promise<{
  couplesWithLogs: number[];
  couplesWithoutLogs: number[];
  eventsByCouple: Record<number, string[]>;
}> {
  const { rows: logsToday } = await pool.query<{ coupleId: number; eventType: string }>(
    `SELECT "coupleId", "eventType" FROM "breeding_daily_logs" WHERE "date" = $1`,
    [date]
  );

  const { rows: activeCouples } = await pool.query<{ id: number }>(
    `SELECT "id" FROM "couples" WHERE "status" = 'active' AND "deletedAt" IS NULL`
  );

  const eventsByCouple: Record<number, string[]> = {};
  for (const log of logsToday) {
    if (!eventsByCouple[log.coupleId]) eventsByCouple[log.coupleId] = [];
    eventsByCouple[log.coupleId].push(log.eventType);
  }

  const coupleIds = activeCouples.map((c) => c.id);
  const couplesWithLogs = coupleIds.filter((id) => eventsByCouple[id]);
  const couplesWithoutLogs = coupleIds.filter((id) => !eventsByCouple[id]);

  return { couplesWithLogs, couplesWithoutLogs, eventsByCouple };
}

// ─── Gerar alertas de eclosão, ovoscopia e anilhamento ────────────────────────

export type BreedingAlert = {
  type: "CANDLE_EGGS" | "EXPECTED_HATCH" | "RING_CHICKS" | "NO_LOGS";
  coupleId: number;
  clutchId?: number;
  dueDate: string;
  message: string;
};

export function generateBreedingAlerts(
  clutch: { id: number; coupleId: number; clutchDate: Date | string; totalEggs: number },
  today: Date,
  rules: { candlingDay: number; incubationDaysMin: number; incubationDaysMax: number; ringingDayMin: number; ringingDayMax: number }
): BreedingAlert[] {
  const alerts: BreedingAlert[] = [];
  const clutchStart = new Date(clutch.clutchDate);
  const daysSince = Math.floor((today.getTime() - clutchStart.getTime()) / 86400000);

  if (daysSince === rules.candlingDay - 1 || daysSince === rules.candlingDay) {
    alerts.push({ type: "CANDLE_EGGS", coupleId: clutch.coupleId, clutchId: clutch.id, dueDate: today.toISOString().slice(0, 10), message: `Ovoscopia recomendada para postura do casal (${daysSince} dias)` });
  }

  const hatchMin = rules.incubationDaysMin;
  const hatchMax = rules.incubationDaysMax;
  if (daysSince >= hatchMin - 1 && daysSince <= hatchMax + 1) {
    const hatchDate = new Date(clutchStart);
    hatchDate.setDate(hatchDate.getDate() + hatchMin);
    alerts.push({ type: "EXPECTED_HATCH", coupleId: clutch.coupleId, clutchId: clutch.id, dueDate: hatchDate.toISOString().slice(0, 10), message: `Eclosão esperada entre ${hatchMin} e ${hatchMax} dias da postura` });
  }

  return alerts;
}
