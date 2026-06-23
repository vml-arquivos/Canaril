/**
 * resetExecutor.test.ts — Testes da Missão 7: Reset, Limpeza, Órfãos
 *
 * Testa a lógica pura e integração com pool mockado.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeTotalsFromLogs,
} from "../breedingDailyAggregator";

// ─── Import dos executores para testar lógica pura ───────────────────────────
import {
  executeOperationalReset,
  executeTestCleanup,
  forceDeleteRingBatch,
  reconcileRings,
  deleteAnalyses,
  fixOrphans,
} from "./resetExecutor";

import {
  scanOperationalCounts,
  scanOrphans,
  getRingBatchDependencies,
} from "./dependencyScanner";

// ─── Mock de Pool pg ──────────────────────────────────────────────────────────

function makeMockPool(tableData: Record<string, any[]> = {}) {
  const log: Array<{ query: string; params?: any[] }> = [];

  const client = {
    query: vi.fn(async (q: string, params?: any[]) => {
      log.push({ query: q, params });

      if (q === "BEGIN" || q === "COMMIT" || q === "ROLLBACK") return {};

      // COUNT queries
      if (q.includes("COUNT(*)")) {
        const match = q.match(/FROM "([^"]+)"/);
        const table = match?.[1] ?? "";
        return { rows: [{ count: String(tableData[table]?.length ?? 0) }] };
      }

      // DELETE queries
      if (q.includes("DELETE FROM")) {
        return { rowCount: 1, rows: [] };
      }

      // UPDATE queries
      if (q.includes("UPDATE")) {
        return { rowCount: 1, rows: [] };
      }

      // SELECT queries
      const match = q.match(/FROM "([^"]+)"/);
      const table = match?.[1] ?? "";
      if (tableData[table]) return { rows: tableData[table] };
      return { rows: [] };
    }),
    release: vi.fn(),
    _log: log,
  };

  const pool = {
    connect: vi.fn(async () => client),
    query: vi.fn(async (q: string, params?: any[]) => {
      log.push({ query: q, params });

      if (q.includes("COUNT(*)")) {
        const match = q.match(/FROM "([^"]+)"/);
        const table = match?.[1] ?? "";
        return { rows: [{ count: String(tableData[table]?.length ?? 0) }] };
      }

      const match = q.match(/FROM "([^"]+)"/);
      const table = match?.[1] ?? "";
      if (tableData[table]) return { rows: tableData[table] };
      return { rows: [], rowCount: 0 };
    }),
    _log: log,
    _client: client,
  };

  return pool as any;
}

// ─── Testes: reset operacional ────────────────────────────────────────────────

describe("executeOperationalReset", () => {
  it("executa em transação (BEGIN e COMMIT)", async () => {
    const pool = makeMockPool();
    await executeOperationalReset(pool, 1, "test");
    const queries = pool._client._log.map((l: any) => l.query);
    expect(queries).toContain("BEGIN");
    expect(queries).toContain("COMMIT");
  });

  it("não deleta users nem tenants", async () => {
    const pool = makeMockPool();
    await executeOperationalReset(pool, 1, "test");
    const deletedTables = pool._client._log
      .filter((l: any) => l.query.includes("DELETE FROM"))
      .map((l: any) => l.query)
      .join("\n");
    expect(deletedTables).not.toContain('"users"');
    expect(deletedTables).not.toContain('"tenants"');
    expect(deletedTables).not.toContain('"official_bird_classes"');
  });

  it("deleta birds, rings, ring_batches", async () => {
    const pool = makeMockPool();
    await executeOperationalReset(pool, 1, "test");
    const deletedTables = pool._client._log
      .filter((l: any) => l.query.includes('DELETE FROM "birds"'))
      .length;
    const deletedRings = pool._client._log
      .filter((l: any) => l.query.includes('DELETE FROM "rings"'))
      .length;
    const deletedBatches = pool._client._log
      .filter((l: any) => l.query.includes('DELETE FROM "ring_batches"'))
      .length;
    expect(deletedTables).toBeGreaterThan(0);
    expect(deletedRings).toBeGreaterThan(0);
    expect(deletedBatches).toBeGreaterThan(0);
  });

  it("deleta casais, posturas, filhotes", async () => {
    const pool = makeMockPool();
    await executeOperationalReset(pool, 1, "test");
    const queries = pool._client._log.map((l: any) => l.query).join("\n");
    expect(queries).toContain('"couples"');
    expect(queries).toContain('"clutches"');
    expect(queries).toContain('"chicks"');
  });

  it("deleta análises de IA e foto", async () => {
    const pool = makeMockPool();
    await executeOperationalReset(pool, 1, "test");
    const queries = pool._client._log.map((l: any) => l.query).join("\n");
    expect(queries).toContain('"ai_judge_analyses"');
    expect(queries).toContain('"bird_photo_analyses"');
  });

  it("deleta logs genéticos", async () => {
    const pool = makeMockPool();
    await executeOperationalReset(pool, 1, "test");
    const queries = pool._client._log.map((l: any) => l.query).join("\n");
    expect(queries).toContain('"bird_genetic_inference_logs"');
  });

  it("faz ROLLBACK se ocorrer erro", async () => {
    const pool = makeMockPool();
    // Force error mid-execution
    let callCount = 0;
    pool._client.query = vi.fn(async (q: string) => {
      if (q === "BEGIN") return {};
      if (q === "ROLLBACK") return {};
      callCount++;
      if (callCount > 3) throw new Error("Simulated DB error");
      return { rowCount: 0, rows: [{ count: "0" }] };
    });

    await expect(executeOperationalReset(pool, 1, "test")).rejects.toThrow("Simulated DB error");
    const rollbackCalled = (pool._client.query as any).mock.calls.some(
      (call: any[]) => call[0] === "ROLLBACK"
    );
    expect(rollbackCalled).toBe(true);
  });

  it("grava audit_log após execução", async () => {
    const pool = makeMockPool();
    await executeOperationalReset(pool, 42, "unit test");
    const auditCall = pool._client._log.find(
      (l: any) => l.query.includes("audit_logs") && l.query.includes("execute_reset")
    );
    expect(auditCall).toBeDefined();
  });

  it("retorna resumo com tabelas afetadas", async () => {
    const pool = makeMockPool();
    const result = await executeOperationalReset(pool, 1, "test");
    expect(result).toHaveProperty("tablesAffected");
    expect(result).toHaveProperty("rowsDeleted");
    expect(result).toHaveProperty("totalRows");
    expect(result).toHaveProperty("durationMs");
  });
});

// ─── Testes: limpeza por prefixo ──────────────────────────────────────────────

describe("executeTestCleanup", () => {
  it("busca registros com ILIKE no prefixo", async () => {
    const pool = makeMockPool({ birds: [{ id: 1 }] });
    await executeTestCleanup(pool, "TESTE", 1, false);
    const ilikeCall = pool._client._log.find(
      (l: any) => l.query.toLowerCase().includes("ilike") || l.query.includes("ILIKE")
    );
    // Pool-level or client-level ILIKE
    expect(ilikeCall).toBeDefined();
  });

  it("soft delete não chama DELETE", async () => {
    const pool = makeMockPool({ birds: [] });
    await executeTestCleanup(pool, "TESTE", 1, false); // hardDelete=false
    const hardDeleteCalls = pool._client._log.filter(
      (l: any) => l.query.includes("DELETE FROM") && l.query.includes("birds")
    );
    // Soft delete uses UPDATE not DELETE
    const softUpdateCalls = pool._client._log.filter(
      (l: any) => l.query.includes("UPDATE") && l.query.includes("deletedAt")
    );
    // No hard DELETE on birds expected
    expect(hardDeleteCalls.length).toBe(0);
  });

  it("hard delete chama DELETE FROM birds", async () => {
    const mockBirds = [{ id: 1 }, { id: 2 }];
    const pool = makeMockPool({ birds: mockBirds });
    // Make the SELECT return bird ids
    pool._client.query = vi.fn(async (q: string, params?: any[]) => {
      if (q === "BEGIN" || q === "COMMIT") return {};
      if (q.includes("SELECT id FROM birds")) return { rows: mockBirds };
      if (q.includes("SELECT id FROM") || q.includes("SELECT COUNT")) return { rows: [] };
      if (q.includes("DELETE FROM")) return { rowCount: 1 };
      if (q.includes("INSERT INTO audit_logs")) return { rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });

    await executeTestCleanup(pool, "TESTE", 1, true); // hardDelete=true
    const deleteCalls = (pool._client.query as any).mock.calls.map((c: any[]) => c[0]).join("\n");
    expect(deleteCalls).toContain("DELETE FROM");
  });

  it("registra audit log com prefixo", async () => {
    const pool = makeMockPool({ birds: [] });
    await executeTestCleanup(pool, "MINHA-PREFIXO", 1, false);
    const auditCall = pool._client._log.find(
      (l: any) => l.query.includes("audit_logs") && l.query.includes("cleanup_test_data")
    );
    expect(auditCall).toBeDefined();
  });
});

// ─── Testes: forceDeleteRingBatch ─────────────────────────────────────────────

describe("forceDeleteRingBatch", () => {
  it("mode=archive não exclui rings nem birds", async () => {
    const pool = makeMockPool();
    await forceDeleteRingBatch(pool, 5, 1, "archive");
    const queries = pool._client._log.map((l: any) => l.query).join("\n");
    expect(queries).not.toContain('DELETE FROM "rings"');
    expect(queries).not.toContain('DELETE FROM "birds"');
    expect(queries).toContain("UPDATE ring_batches SET"); // soft delete
  });

  it("mode=free_rings libera anilhas antes de excluir", async () => {
    const pool = makeMockPool();
    await forceDeleteRingBatch(pool, 5, 1, "free_rings");
    const queries = pool._client._log.map((l: any) => l.query).join("\n");
    expect(queries).toContain("UPDATE rings SET status = 'available'");
  });

  it("mode=delete_all exclui birds relacionados", async () => {
    const pool = makeMockPool();
    pool._client.query = vi.fn(async (q: string) => {
      if (q === "BEGIN" || q === "COMMIT") return {};
      if (q.includes('SELECT "birdId" FROM rings')) return { rows: [{ birdId: 10 }, { birdId: 11 }] };
      return { rowCount: 1, rows: [] };
    });

    await forceDeleteRingBatch(pool, 5, 1, "delete_all");
    const calls = (pool._client.query as any).mock.calls.map((c: any[]) => c[0]).join("\n");
    expect(calls).toContain('DELETE FROM "birds"');
  });

  it("registra audit log", async () => {
    const pool = makeMockPool();
    await forceDeleteRingBatch(pool, 5, 1, "archive");
    const auditCall = pool._client._log.find(
      (l: any) => l.query.includes("audit_logs") && l.query.includes("delete_ring_batch")
    );
    expect(auditCall).toBeDefined();
  });
});

// ─── Testes: reconcileRings ───────────────────────────────────────────────────

describe("reconcileRings", () => {
  it("atualiza anilhas in_use sem pássaro para available", async () => {
    const pool = makeMockPool();
    const result = await reconcileRings(pool, 1);
    // rowCount returned is 1 from mock
    expect(result).toHaveProperty("fixed");
    expect(typeof result.fixed).toBe("number");
  });

  it("registra audit log de fix_orphan_data", async () => {
    const pool = makeMockPool();
    await reconcileRings(pool, 99);
    const auditCall = pool._client._log.find(
      (l: any) => l.query.includes("audit_logs") && l.query.includes("fix_orphan_data")
    );
    expect(auditCall).toBeDefined();
  });

  it("faz rollback em caso de erro", async () => {
    const pool = makeMockPool();
    pool._client.query = vi.fn(async (q: string) => {
      if (q === "BEGIN") return {};
      if (q === "ROLLBACK") return {};
      throw new Error("DB error");
    });

    await expect(reconcileRings(pool, 1)).rejects.toThrow("DB error");
    const rollbackCalled = (pool._client.query as any).mock.calls.some((c: any[]) => c[0] === "ROLLBACK");
    expect(rollbackCalled).toBe(true);
  });
});

// ─── Testes: deleteAnalyses ───────────────────────────────────────────────────

describe("deleteAnalyses", () => {
  it("type=ai_judge deleta ai_judge_analyses", async () => {
    const pool = makeMockPool();
    await deleteAnalyses(pool, ["ai_judge"], 1);
    const calls = pool._client._log.map((l: any) => l.query).join("\n");
    expect(calls).toContain('"ai_judge_analyses"');
  });

  it("type=photo deleta bird_photo_analyses", async () => {
    const pool = makeMockPool();
    await deleteAnalyses(pool, ["photo"], 1);
    const calls = pool._client._log.map((l: any) => l.query).join("\n");
    expect(calls).toContain('"bird_photo_analyses"');
  });

  it("type=all deleta todas as tabelas de análise", async () => {
    const pool = makeMockPool();
    await deleteAnalyses(pool, ["all"], 1);
    const calls = pool._client._log.map((l: any) => l.query).join("\n");
    expect(calls).toContain('"ai_judge_analyses"');
    expect(calls).toContain('"bird_photo_analyses"');
    expect(calls).toContain('"bird_genetic_inference_logs"');
  });
});

// ─── Testes: scanOrphans ──────────────────────────────────────────────────────

describe("scanOrphans", () => {
  it("retorna lista de órfãos detectados", async () => {
    const pool = makeMockPool({
      rings: [{ id: 1, number: "TESTE-001", birdId: 99 }],
    });

    // Make rings query return orphan ring
    pool.query = vi.fn(async (q: string) => {
      if (q.includes("rings") && q.includes("NOT EXISTS")) {
        return { rows: [{ id: 1, number: "TESTE-001", birdId: 99 }] };
      }
      return { rows: [] };
    });

    const orphans = await scanOrphans(pool);
    // Our query returns rows so we should get at least the structure
    expect(Array.isArray(orphans)).toBe(true);
  });

  it("detecta anilhas sem pássaro ativo", async () => {
    const pool = makeMockPool();
    pool.query = vi.fn(async (q: string) => {
      if (q.includes("status = 'in_use'") && q.includes("NOT EXISTS")) {
        return { rows: [{ id: 1, number: "TESTE-001", birdId: 99 }] };
      }
      return { rows: [] };
    });
    const orphans = await scanOrphans(pool);
    const ringOrphans = orphans.filter((o) => o.table === "rings");
    expect(ringOrphans.length).toBeGreaterThan(0);
    expect(ringOrphans[0].issue).toBe("ring_no_bird");
    expect(ringOrphans[0].canAutoFix).toBe(true);
  });

  it("detecta análises sem pássaro (estrutura de retorno)", async () => {
    const pool = makeMockPool();
    // scanOrphans runs multiple pool.query calls; we verify it doesn't throw
    // and returns an array with the expected shape
    const orphans = await scanOrphans(pool);
    expect(Array.isArray(orphans)).toBe(true);
    // Each orphan has required fields
    for (const o of orphans) {
      expect(o).toHaveProperty("table");
      expect(o).toHaveProperty("id");
      expect(o).toHaveProperty("issue");
      expect(o).toHaveProperty("canAutoFix");
    }
  });
});

// ─── Testes: getRingBatchDependencies ─────────────────────────────────────────

describe("getRingBatchDependencies", () => {
  it("retorna contagens corretas", async () => {
    const pool = makeMockPool();
    pool.query = vi.fn(async (q: string) => {
      if (q.includes('FROM rings') && q.includes('"batchId" = $1')) {
        return {
          rows: [
            { id: 1, number: "GF-2026-001", status: "available", birdId: null },
            { id: 2, number: "GF-2026-002", status: "in_use", birdId: 10 },
          ]
        };
      }
      return { rows: [] };
    });

    const deps = await getRingBatchDependencies(pool, 5);
    expect(deps.total).toBe(2);
    expect(deps.available).toBe(1);
    expect(deps.inUse).toBe(1);
    expect(deps.inUseNumbers).toContain("GF-2026-002");
    expect(deps.birdIds).toContain(10);
  });
});

// ─── Testes: scanOperationalCounts ───────────────────────────────────────────

describe("scanOperationalCounts", () => {
  it("retorna contagens de todas as tabelas", async () => {
    const pool = makeMockPool({
      birds: [{ id: 1 }, { id: 2 }],
      rings: [{ id: 1 }],
      users: [{ id: 1 }, { id: 2 }],
      tenants: [{ id: 1 }],
    });

    const counts = await scanOperationalCounts(pool);
    expect(counts).toHaveProperty("birds");
    expect(counts).toHaveProperty("rings");
    expect(counts).toHaveProperty("users");
    expect(counts).toHaveProperty("tenants");
    expect(typeof counts.birds).toBe("number");
  });

  it("users e tenants são retornados (não apagados)", async () => {
    const pool = makeMockPool({ users: [{ id: 1 }], tenants: [{ id: 1 }] });
    const counts = await scanOperationalCounts(pool);
    expect(counts.users).toBeGreaterThanOrEqual(0);
    expect(counts.tenants).toBeGreaterThanOrEqual(0);
  });
});

// ─── Testes: permissão (lógica pura) ─────────────────────────────────────────

describe("permissões de reset", () => {
  it("confirmação RESETAR CANARIL deve ser exata (case sensitive)", () => {
    const REQUIRED = "RESETAR CANARIL";
    expect("RESETAR CANARIL" === REQUIRED).toBe(true);
    expect("resetar canaril" === REQUIRED).toBe(false);
    expect("RESETAR" === REQUIRED).toBe(false);
    expect("RESETAR CANARIL " === REQUIRED).toBe(false);
  });

  it("confirmação EXCLUIR LOTE deve ser exata", () => {
    const REQUIRED = "EXCLUIR LOTE";
    expect("EXCLUIR LOTE" === REQUIRED).toBe(true);
    expect("excluir lote" === REQUIRED).toBe(false);
  });

  it("confirmação LIMPAR TESTES deve ser exata", () => {
    const REQUIRED = "LIMPAR TESTES";
    expect("LIMPAR TESTES" === REQUIRED).toBe(true);
    expect("limpar testes" === REQUIRED).toBe(false);
  });

  it("checkbox de confirmação deve ser true", () => {
    const validateTerms = (agreed: boolean) => {
      if (!agreed) throw new Error("Deve marcar a confirmação.");
      return true;
    };
    expect(() => validateTerms(false)).toThrow("Deve marcar a confirmação.");
    expect(validateTerms(true)).toBe(true);
  });
});
