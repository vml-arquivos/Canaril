/**
 * plantelOptimizer.test.ts — Testes do otimizador de pareamento do plantel
 */
import { describe, it, expect } from "vitest";
import { optimizePlantelPairing, PlantelBirdInput } from "./plantelOptimizer";
import { SimpleBird } from "./pairingOptimizer";

function bird(id: number, ring: string, sex: "macho" | "fêmea"): SimpleBird {
  return { id, ring, sex, status: "active" };
}

function makeInput(id: number, ring: string, sex: "macho" | "fêmea"): PlantelBirdInput {
  return { bird: bird(id, ring, sex), genotype: null };
}

describe("optimizePlantelPairing — atribuição básica", () => {
  it("com 1 macho e 1 fêmea sem parentesco, forma o único par possível", () => {
    const males = [makeInput(1, "M1", "macho")];
    const females = [makeInput(2, "F1", "fêmea")];
    const result = optimizePlantelPairing({
      males, females,
      coiLookup: () => 0,
      objective: "PLANEJAMENTO_LIVRE",
    });

    expect(result.assignedPairs).toHaveLength(1);
    expect(result.assignedPairs[0].male.ring).toBe("M1");
    expect(result.assignedPairs[0].female.ring).toBe("F1");
    expect(result.unmatchedMales).toHaveLength(0);
    expect(result.unmatchedFemales).toHaveLength(0);
  });

  it("nunca usa o mesmo pássaro em dois pares (exclusividade)", () => {
    const males = [makeInput(1, "M1", "macho"), makeInput(2, "M2", "macho")];
    const females = [makeInput(3, "F1", "fêmea")];
    const result = optimizePlantelPairing({
      males, females,
      coiLookup: () => 0,
      objective: "PLANEJAMENTO_LIVRE",
    });

    expect(result.assignedPairs).toHaveLength(1);
    expect(result.unmatchedMales).toHaveLength(1);
    const usedIds = new Set(result.assignedPairs.map((p) => p.male.id));
    expect(usedIds.size).toBe(result.assignedPairs.length);
  });

  it("prioriza o par com menor COI quando as demais condições são iguais", () => {
    const males = [makeInput(1, "M1", "macho")];
    const females = [makeInput(2, "Baixo COI", "fêmea"), makeInput(3, "Alto COI", "fêmea")];
    const result = optimizePlantelPairing({
      males, females,
      coiLookup: (_m, f) => (f === 2 ? 0 : 0.2),
      objective: "PLANEJAMENTO_LIVRE",
    });

    expect(result.assignedPairs).toHaveLength(1);
    expect(result.assignedPairs[0].female.ring).toBe("Baixo COI");
    expect(result.unmatchedFemales[0].ring).toBe("Alto COI");
  });

  it("nunca atribui um par com trava absoluta (COI acima do limite deve ser recusado)", () => {
    const males = [makeInput(1, "M1", "macho")];
    const females = [makeInput(2, "F1", "fêmea")];
    const result = optimizePlantelPairing({
      males, females,
      coiLookup: () => 0.30,
      objective: "PLANEJAMENTO_LIVRE",
    });

    expect(result.assignedPairs).toHaveLength(0);
    expect(result.skippedBlocked).toBeGreaterThan(0);
    expect(result.unmatchedMales).toHaveLength(1);
    expect(result.unmatchedFemales).toHaveLength(1);
  });

  it("plantel vazio não lança erro", () => {
    const result = optimizePlantelPairing({ males: [], females: [], coiLookup: () => 0, objective: "PLANEJAMENTO_LIVRE" });
    expect(result.assignedPairs).toEqual([]);
    expect(result.averageScore).toBe(0);
  });
});

describe("optimizePlantelPairing — natureza gulosa do algoritmo (documentada, não escondida)", () => {
  // Cenário onde o algoritmo guloso NÃO encontra o ótimo matemático global,
  // de propósito, pra deixar essa limitação documentada em teste (não é bug
  // — é a aproximação intencional descrita no cabeçalho do módulo).
  //
  //   M1×F1: COI 0%   (score alto)
  //   M1×F2: COI 3%   (score médio-alto)
  //   M2×F1: COI 3%   (score médio-alto)
  //   M2×F2: COI 10%  (score médio-baixo, mas ainda abaixo do limite de trava absoluta)
  //
  // Guloso escolhe primeiro o par de maior nota (M1×F1), o que FORÇA o
  // resto a ficar com a pior opção restante (M2×F2) — mesmo a soma
  // M1×F2 + M2×F1 sendo maior no total. É a limitação conhecida do guloso
  // frente ao algoritmo húngaro (ótimo garantido).
  it("escolhe o melhor par disponível a cada passo, mesmo sem garantir o ótimo global", () => {
    const males = [makeInput(1, "M1", "macho"), makeInput(2, "M2", "macho")];
    const females = [makeInput(3, "F1", "fêmea"), makeInput(4, "F2", "fêmea")];
    const coiMap: Record<string, number> = {
      "1-3": 0, "1-4": 0.03, "2-3": 0.03, "2-4": 0.10,
    };
    const result = optimizePlantelPairing({
      males, females,
      coiLookup: (m, f) => coiMap[`${m}-${f}`] ?? 0,
      objective: "PLANEJAMENTO_LIVRE",
    });

    expect(result.assignedPairs).toHaveLength(2);
    const m1Pair = result.assignedPairs.find((p) => p.male.id === 1);
    expect(m1Pair?.female.id).toBe(3);
  });
});
