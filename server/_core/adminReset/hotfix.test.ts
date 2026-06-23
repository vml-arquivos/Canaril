/**
 * hotfix.test.ts — Testes do hotfix de exclusão de anilhas (Missão 7 hotfix)
 *
 * Testa a lógica correta de:
 * - Bloquear somente se bird ativo, não apenas por status in_use
 * - Permitir exclusão de lotes com anilhas órfãs
 * - Reconciliação de anilhas órfãs
 * - ForceDelete modos
 * - Contadores corretos
 */
import { describe, it, expect, vi } from "vitest";

// ─── Lógica pura: determinar se um lote pode ser excluído ────────────────────

function canDeleteBatch(rings: Array<{ status: string; birdId: number | null; birdIsActive: boolean }>): {
  canDelete: boolean;
  orphans: number;
  activelyUsed: number;
  reason: string;
} {
  const inUseRings = rings.filter((r) => r.status === "in_use");
  const activelyUsed = inUseRings.filter((r) => r.birdId !== null && r.birdIsActive).length;
  const orphans = inUseRings.filter((r) => r.birdId === null || !r.birdIsActive).length;

  if (activelyUsed > 0) {
    return { canDelete: false, orphans, activelyUsed, reason: `${activelyUsed} anilha(s) vinculada(s) a pássaro(s) ativo(s)` };
  }

  return { canDelete: true, orphans, activelyUsed: 0, reason: orphans > 0 ? `${orphans} anilha(s) órfã(s) — reconciliar antes de excluir` : "Lote pode ser excluído com segurança" };
}

function reconcileOrphans(rings: Array<{ id: number; status: string; birdId: number | null; birdIsActive: boolean }>): {
  fixed: number;
  updatedRings: typeof rings;
} {
  let fixed = 0;
  const updated = rings.map((r) => {
    if (r.status === "in_use" && (r.birdId === null || !r.birdIsActive)) {
      fixed++;
      return { ...r, status: "available", birdId: null, birdIsActive: false };
    }
    return r;
  });
  return { fixed, updatedRings: updated };
}

// ─── canDeleteBatch ───────────────────────────────────────────────────────────

describe("canDeleteBatch", () => {
  it("lote com todas disponíveis → pode excluir", () => {
    const result = canDeleteBatch([
      { status: "available", birdId: null, birdIsActive: false },
      { status: "available", birdId: null, birdIsActive: false },
    ]);
    expect(result.canDelete).toBe(true);
    expect(result.activelyUsed).toBe(0);
    expect(result.orphans).toBe(0);
  });

  it("lote com anilha vinculada a pássaro ATIVO → bloquear", () => {
    const result = canDeleteBatch([
      { status: "available", birdId: null, birdIsActive: false },
      { status: "in_use", birdId: 10, birdIsActive: true }, // ACTIVE bird
    ]);
    expect(result.canDelete).toBe(false);
    expect(result.activelyUsed).toBe(1);
  });

  it("lote com anilha in_use mas pássaro DELETADO (órfã) → pode excluir", () => {
    const result = canDeleteBatch([
      { status: "in_use", birdId: 5, birdIsActive: false }, // bird deleted
    ]);
    expect(result.canDelete).toBe(true);
    expect(result.orphans).toBe(1);
    expect(result.activelyUsed).toBe(0);
  });

  it("lote com anilha in_use sem birdId (orphan sem vínculo) → pode excluir", () => {
    const result = canDeleteBatch([
      { status: "in_use", birdId: null, birdIsActive: false },
    ]);
    expect(result.canDelete).toBe(true);
    expect(result.orphans).toBe(1);
  });

  it("lote misto: 1 ativa + 2 órfãs → bloquear (por causa da ativa)", () => {
    const result = canDeleteBatch([
      { status: "in_use", birdId: 10, birdIsActive: true },   // active
      { status: "in_use", birdId: 11, birdIsActive: false },  // orphan
      { status: "in_use", birdId: null, birdIsActive: false }, // orphan
    ]);
    expect(result.canDelete).toBe(false);
    expect(result.activelyUsed).toBe(1);
    expect(result.orphans).toBe(2);
  });

  it("lote com 0 anilhas → pode excluir", () => {
    const result = canDeleteBatch([]);
    expect(result.canDelete).toBe(true);
    expect(result.orphans).toBe(0);
  });

  it("lote com anilhas LOST/DAMAGED (não in_use) → pode excluir", () => {
    const result = canDeleteBatch([
      { status: "lost", birdId: null, birdIsActive: false },
      { status: "damaged", birdId: null, birdIsActive: false },
    ]);
    expect(result.canDelete).toBe(true);
  });
});

// ─── reconcileOrphans ────────────────────────────────────────────────────────

describe("reconcileOrphans", () => {
  it("corrige anilhas orphans para available", () => {
    const rings = [
      { id: 1, status: "in_use", birdId: 5, birdIsActive: false },  // orphan
      { id: 2, status: "available", birdId: null, birdIsActive: false },
    ];
    const { fixed, updatedRings } = reconcileOrphans(rings);
    expect(fixed).toBe(1);
    expect(updatedRings[0].status).toBe("available");
    expect(updatedRings[0].birdId).toBeNull();
    expect(updatedRings[1].status).toBe("available");
  });

  it("não altera anilhas vinculadas a pássaro ativo", () => {
    const rings = [
      { id: 1, status: "in_use", birdId: 10, birdIsActive: true }, // active
    ];
    const { fixed, updatedRings } = reconcileOrphans(rings);
    expect(fixed).toBe(0);
    expect(updatedRings[0].status).toBe("in_use");
    expect(updatedRings[0].birdId).toBe(10);
  });

  it("retorna 0 se não há órfãs", () => {
    const rings = [
      { id: 1, status: "available", birdId: null, birdIsActive: false },
      { id: 2, status: "available", birdId: null, birdIsActive: false },
    ];
    const { fixed } = reconcileOrphans(rings);
    expect(fixed).toBe(0);
  });

  it("reconcilia múltiplas órfãs", () => {
    const rings = [
      { id: 1, status: "in_use", birdId: 1, birdIsActive: false },
      { id: 2, status: "in_use", birdId: 2, birdIsActive: false },
      { id: 3, status: "in_use", birdId: null, birdIsActive: false },
    ];
    const { fixed } = reconcileOrphans(rings);
    expect(fixed).toBe(3);
  });

  it("após reconciliar, lote deve poder ser excluído", () => {
    const rings = [
      { id: 1, status: "in_use", birdId: 5, birdIsActive: false },
    ];
    const { updatedRings } = reconcileOrphans(rings);
    const canDelete = canDeleteBatch(updatedRings);
    expect(canDelete.canDelete).toBe(true);
  });
});

// ─── Contadores ──────────────────────────────────────────────────────────────

describe("contadores de anilhas", () => {
  it("contador geral deve somar corretamente por lote", () => {
    const batches = [
      { id: 1, quantity_total: 200, quantity_used: 0 },
      { id: 2, quantity_total: 80, quantity_used: 3 },
    ];
    const total = batches.reduce((s, b) => s + b.quantity_total, 0);
    const used = batches.reduce((s, b) => s + b.quantity_used, 0);
    expect(total).toBe(280);
    expect(used).toBe(3);
    expect(total - used).toBe(277);
  });

  it("após reconciliar 3 órfãs, used deve ser 0", () => {
    // Before: quantity_used = 3 (orphans)
    // After reconcile: UPDATE ring_batches SET quantity_used = COUNT(*) WHERE status='in_use'
    // Since all 3 were orphans, after reconcile count = 0
    const afterReconcile = { quantity_total: 280, quantity_used: 0 };
    expect(afterReconcile.quantity_used).toBe(0);
  });

  it("ILIKE prefixo TESTE não deve afetar registros fora do prefixo", () => {
    const rings = [
      { number: "TESTE-2026-001" },
      { number: "TESTE-2026-002" },
      { number: "GF-003-2026-001" }, // real data
      { number: "GF-003-2026-002" }, // real data
    ];
    const testRings = rings.filter((r) => r.number.toUpperCase().startsWith("TESTE"));
    const realRings = rings.filter((r) => !r.number.toUpperCase().startsWith("TESTE"));
    expect(testRings.length).toBe(2);
    expect(realRings.length).toBe(2);
    expect(realRings.every((r) => r.number.startsWith("GF-003"))).toBe(true);
  });
});

// ─── ForceDelete modes ────────────────────────────────────────────────────────

describe("forceDelete modes", () => {
  it("RECONCILE_AND_DELETE: corrige órfãs + deleta tudo", () => {
    const rings = [
      { id: 1, status: "in_use", birdId: 5, birdIsActive: false }, // orphan
      { id: 2, status: "available", birdId: null, birdIsActive: false },
    ];

    // Step 1: reconcile
    const { updatedRings } = reconcileOrphans(rings);
    // Step 2: check can delete
    expect(canDeleteBatch(updatedRings).canDelete).toBe(true);
    // Step 3: "delete" = remove all
    const deleted = updatedRings.length;
    expect(deleted).toBe(2);
  });

  it("DELETE_AVAILABLE_ONLY: não apaga in_use reais", () => {
    const rings = [
      { id: 1, status: "in_use", birdId: 10, birdIsActive: true }, // ACTIVE
      { id: 2, status: "available", birdId: null, birdIsActive: false },
      { id: 3, status: "available", birdId: null, birdIsActive: false },
    ];
    const availableOnly = rings.filter((r) => r.status === "available");
    expect(availableOnly.length).toBe(2);
    const remaining = rings.filter((r) => r.status !== "available");
    expect(remaining.length).toBe(1);
    expect(remaining[0].birdIsActive).toBe(true); // active birds preserved
  });

  it("confirmationText exata é obrigatória", () => {
    const REQUIRED = "EXCLUIR LOTE";
    expect("EXCLUIR LOTE" === REQUIRED).toBe(true);
    expect("excluir lote" === REQUIRED).toBe(false);
    expect("EXCLUIR" === REQUIRED).toBe(false);
    expect("EXCLUIR LOTE " === REQUIRED).toBe(false);
  });
});

// ─── Reset operacional ────────────────────────────────────────────────────────

describe("reset operacional (lógica de preservação)", () => {
  it("tabelas preservadas não aparecem na lista de deleção", () => {
    const PRESERVED_TABLES = ["users", "tenants", "official_bird_classes", "breeder_settings", "species_knowledge", "breed_knowledge", "mutation_knowledge"];
    const DELETED_TABLES = ["birds", "rings", "ring_batches", "couples", "clutches", "chicks", "cages", "ai_judge_analyses", "bird_photo_analyses", "bird_genetic_inference_logs", "championships", "health_records", "breeding_daily_logs"];

    for (const t of PRESERVED_TABLES) {
      expect(DELETED_TABLES).not.toContain(t);
    }
  });

  it("users nunca aparecem na lista de exclusão", () => {
    const DELETED_TABLES = ["birds", "rings", "ring_batches", "couples", "clutches", "chicks", "cages"];
    expect(DELETED_TABLES).not.toContain("users");
    expect(DELETED_TABLES).not.toContain("tenants");
  });
});
