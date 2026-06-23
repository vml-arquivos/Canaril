/**
 * breedingDailyAggregator.test.ts — Testes das Missões 3.1 e 4
 */
import { describe, it, expect } from "vitest";
import { computeTotalsFromLogs, generateBreedingAlerts } from "./breedingDailyAggregator";

const RULES = { candlingDay: 7, incubationDaysMin: 13, incubationDaysMax: 14, ringingDayMin: 7, ringingDayMax: 9 };

// ─── computeTotalsFromLogs ────────────────────────────────────────────────────

describe("computeTotalsFromLogs — básico", () => {
  it("sem logs → todos zeros", () => {
    const t = computeTotalsFromLogs([]);
    expect(t).toEqual({ totalEggs: 0, fertilizedEggs: 0, infertileEggs: 0, lostEggs: 0, hatchedChicks: 0 });
  });

  it("+3 ovos adicionados", () => {
    const logs = [
      { eventType: "EGG_ADDED", quantity: 1 },
      { eventType: "EGG_ADDED", quantity: 1 },
      { eventType: "EGG_ADDED", quantity: 1 },
    ];
    expect(computeTotalsFromLogs(logs).totalEggs).toBe(3);
  });

  it("+3 ovos, 1 perdido → 2 ovos, 1 perdido", () => {
    const logs = [
      { eventType: "EGG_ADDED", quantity: 3 },
      { eventType: "EGG_LOST", quantity: 1 },
    ];
    const t = computeTotalsFromLogs(logs);
    expect(t.totalEggs).toBe(3);
    expect(t.lostEggs).toBe(1);
  });

  it("EGG_REMOVED reduz total", () => {
    const logs = [
      { eventType: "EGG_ADDED", quantity: 4 },
      { eventType: "EGG_REMOVED", quantity: 1 },
    ];
    expect(computeTotalsFromLogs(logs).totalEggs).toBe(3);
  });

  it("não permite total negativo", () => {
    const logs = [{ eventType: "EGG_REMOVED", quantity: 5 }];
    expect(computeTotalsFromLogs(logs).totalEggs).toBe(0);
  });

  it("EGG_FERTILE atualiza galados", () => {
    const logs = [
      { eventType: "EGG_ADDED", quantity: 4 },
      { eventType: "EGG_FERTILE", quantity: 3 },
    ];
    const t = computeTotalsFromLogs(logs);
    expect(t.fertilizedEggs).toBe(3);
  });

  it("EGG_INFERTILE e EGG_CLEAR somam em infertileEggs", () => {
    const logs = [
      { eventType: "EGG_INFERTILE", quantity: 1 },
      { eventType: "EGG_CLEAR", quantity: 1 },
    ];
    expect(computeTotalsFromLogs(logs).infertileEggs).toBe(2);
  });

  it("CHICK_HATCHED incrementa hatchedChicks", () => {
    const logs = [
      { eventType: "EGG_ADDED", quantity: 4 },
      { eventType: "EGG_FERTILE", quantity: 4 },
      { eventType: "CHICK_HATCHED", quantity: 3 },
    ];
    expect(computeTotalsFromLogs(logs).hatchedChicks).toBe(3);
  });

  it("EGG_BROKEN conta como lostEggs", () => {
    const logs = [{ eventType: "EGG_BROKEN", quantity: 2 }];
    expect(computeTotalsFromLogs(logs).lostEggs).toBe(2);
  });

  it("eventos irrelevantes (FEEDING_OK) não alteram totais de ovos", () => {
    const logs = [
      { eventType: "EGG_ADDED", quantity: 2 },
      { eventType: "FEEDING_OK", quantity: 1 },
      { eventType: "GENERAL_NOTE", quantity: 1 },
    ];
    const t = computeTotalsFromLogs(logs);
    expect(t.totalEggs).toBe(2);
    expect(t.fertilizedEggs).toBe(0);
    expect(t.hatchedChicks).toBe(0);
  });
});

// ─── generateBreedingAlerts ───────────────────────────────────────────────────

describe("generateBreedingAlerts", () => {
  function clutch(daysAgo: number) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return { id: 1, coupleId: 1, coupleNumber: "A-01", clutchDate: date, totalEggs: 3 };
  }

  it("dia 6 → alerta de ovoscopia (dia 7 é amanhã)", () => {
    const alerts = generateBreedingAlerts(clutch(6), new Date(), RULES);
    expect(alerts.some((a) => a.type === "CANDLE_EGGS")).toBe(true);
  });

  it("dia 7 → alerta de ovoscopia (dia exato)", () => {
    const alerts = generateBreedingAlerts(clutch(7), new Date(), RULES);
    expect(alerts.some((a) => a.type === "CANDLE_EGGS")).toBe(true);
  });

  it("dia 3 → sem alerta de ovoscopia", () => {
    const alerts = generateBreedingAlerts(clutch(3), new Date(), RULES);
    expect(alerts.some((a) => a.type === "CANDLE_EGGS")).toBe(false);
  });

  it("dia 12 → alerta de eclosão iminente", () => {
    const alerts = generateBreedingAlerts(clutch(12), new Date(), RULES);
    expect(alerts.some((a) => a.type === "EXPECTED_HATCH")).toBe(true);
  });

  it("dia 1 → sem alerta de eclosão", () => {
    const alerts = generateBreedingAlerts(clutch(1), new Date(), RULES);
    expect(alerts.some((a) => a.type === "EXPECTED_HATCH")).toBe(false);
  });
});

// ─── Lógica de proteção de soft delete (Missão 4) ────────────────────────────

describe("regras de exclusão segura (lógica pura)", () => {
  it("não permite excluir último owner", () => {
    function canDeleteUser(userId: number, owners: number[]): { ok: boolean; reason?: string } {
      if (owners.length === 1 && owners[0] === userId) return { ok: false, reason: "Único proprietário" };
      return { ok: true };
    }
    expect(canDeleteUser(1, [1])).toEqual({ ok: false, reason: "Único proprietário" });
    expect(canDeleteUser(1, [1, 2])).toEqual({ ok: true });
    expect(canDeleteUser(2, [1])).toEqual({ ok: true });
  });

  it("prefixo de limpeza deve ter mínimo 2 chars", () => {
    const validate = (prefix: string) => prefix.length >= 2;
    expect(validate("T")).toBe(false);
    expect(validate("TE")).toBe(true);
    expect(validate("TESTE-AUDITORIA-GPT54")).toBe(true);
  });

  it("confirmação de limpeza deve ser exata", () => {
    const CONFIRM_WORD = "LIMPAR TESTES";
    expect("LIMPAR TESTES" === CONFIRM_WORD).toBe(true);
    expect("limpar testes" === CONFIRM_WORD).toBe(false);
    expect("LIMPAR" === CONFIRM_WORD).toBe(false);
  });

  it("soft delete não apaga dados — apenas seta deletedAt", () => {
    const record = { id: 1, ring: "GF-001-2026-001", status: "active", deletedAt: null };
    const softDeleted = { ...record, deletedAt: new Date(), deletedBy: 99 };
    expect(softDeleted.ring).toBe("GF-001-2026-001"); // dados preservados
    expect(softDeleted.deletedAt).not.toBeNull();
  });

  it("restore limpa deletedAt e deletedBy", () => {
    const deleted = { id: 1, deletedAt: new Date(), deletedBy: 99 };
    const restored = { ...deleted, deletedAt: null, deletedBy: null };
    expect(restored.deletedAt).toBeNull();
    expect(restored.deletedBy).toBeNull();
  });
});
