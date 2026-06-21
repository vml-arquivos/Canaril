import { describe, it, expect } from "vitest";
import { scorePair, ScorePairInput, SimpleBird } from "./pairingOptimizer";
import { BirdGenotypeInput } from "./mendelian";

function bird(id: number, sex: string, status = "active"): SimpleBird {
  return { id, ring: `B${id}`, sex, status };
}

function baseInput(overrides: Partial<ScorePairInput> = {}): ScorePairInput {
  return {
    male: bird(1, "macho"),
    female: bird(2, "fêmea"),
    coi: 0,
    maleGenotype: null,
    femaleGenotype: null,
    objective: "PLANEJAMENTO_LIVRE",
    ...overrides,
  };
}

describe("pairingOptimizer — travas absolutas", () => {
  it("mesmo sexo -> NAO_RECOMENDADO mesmo com tudo perfeito", () => {
    const result = scorePair(baseInput({ male: bird(1, "macho"), female: bird(2, "macho"), coi: 0 }));
    expect(result.status).toBe("NAO_RECOMENDADO");
    expect(result.absoluteBlock).toMatch(/mesmo sexo/i);
  });

  it("pássaro inativo -> NAO_RECOMENDADO", () => {
    const result = scorePair(baseInput({ female: bird(2, "fêmea", "sold") }));
    expect(result.status).toBe("NAO_RECOMENDADO");
    expect(result.absoluteBlock).toMatch(/status ativo/i);
  });

  it("COI acima do limite configurado -> NAO_RECOMENDADO mesmo com pontuação parcial alta", () => {
    const result = scorePair(baseInput({ coi: 0.25, maxCoi: 0.125 }));
    expect(result.status).toBe("NAO_RECOMENDADO");
    expect(result.absoluteBlock).toMatch(/consanguinidade/i);
  });

  it("COI exatamente no limite -> bloqueado (>=)", () => {
    const result = scorePair(baseInput({ coi: 0.125, maxCoi: 0.125 }));
    expect(result.status).toBe("NAO_RECOMENDADO");
  });

  it("COI abaixo do limite -> não bloqueado por COI", () => {
    const result = scorePair(baseInput({ coi: 0.05, maxCoi: 0.125 }));
    expect(result.absoluteBlock).toBeNull();
  });

  it("crista × crista -> NAO_RECOMENDADO (letal em dose dupla)", () => {
    const maleGenotype: BirdGenotypeInput = { sex: "macho", hasCrest: true, mutations: [] };
    const femaleGenotype: BirdGenotypeInput = { sex: "fêmea", hasCrest: true, mutations: [] };
    const result = scorePair(baseInput({ maleGenotype, femaleGenotype, coi: 0 }));
    expect(result.status).toBe("NAO_RECOMENDADO");
    expect(result.absoluteBlock).toMatch(/crista/i);
  });

  it("crista × sem crista -> NÃO bloqueado por crista", () => {
    const maleGenotype: BirdGenotypeInput = { sex: "macho", hasCrest: true, mutations: [] };
    const femaleGenotype: BirdGenotypeInput = { sex: "fêmea", hasCrest: false, mutations: [] };
    const result = scorePair(baseInput({ maleGenotype, femaleGenotype, coi: 0 }));
    expect(result.absoluteBlock).toBeNull();
  });

  it("branco dominante × branco dominante -> NAO_RECOMENDADO", () => {
    const maleGenotype: BirdGenotypeInput = {
      sex: "macho",
      mutations: [{ mutation: "branco_dominante_mut", inheritance: "autosomal_dominant", zygosity: "heterozygous_carrier" }],
    };
    const femaleGenotype: BirdGenotypeInput = {
      sex: "fêmea",
      mutations: [{ mutation: "branco_dominante_mut", inheritance: "autosomal_dominant", zygosity: "heterozygous_carrier" }],
    };
    const result = scorePair(baseInput({ maleGenotype, femaleGenotype, coi: 0 }));
    expect(result.status).toBe("NAO_RECOMENDADO");
    expect(result.absoluteBlock).toMatch(/branco dominante/i);
  });
});

describe("pairingOptimizer — componentes de pontuação", () => {
  it("COI=0 dá nota máxima de COI (20)", () => {
    const result = scorePair(baseInput({ coi: 0 }));
    expect(result.coiScore).toBe(20);
  });

  it("COI alto reduz a nota de COI proporcionalmente", () => {
    const low = scorePair(baseInput({ coi: 0.01, maxCoi: 1 }));
    const high = scorePair(baseInput({ coi: 0.2, maxCoi: 1 }));
    expect(low.coiScore).toBeGreaterThan(high.coiScore);
  });

  it("sem genótipo em nenhum dos dois -> nota genética neutra baixa, com aviso de dado incompleto", () => {
    const result = scorePair(baseInput());
    expect(result.geneticScore).toBe(15);
    expect(result.missingData.some((m) => m.includes("Genótipo Avançado"))).toBe(true);
  });

  it("plumagem complementar (intenso x nevado) aumenta a nota genética", () => {
    const maleGenotype: BirdGenotypeInput = { sex: "macho", featherType: "intenso", mutations: [] };
    const femaleGenotype: BirdGenotypeInput = { sex: "fêmea", featherType: "nevado", mutations: [] };
    const result = scorePair(baseInput({ maleGenotype, femaleGenotype, coi: 0 }));
    expect(result.geneticScore).toBeGreaterThan(35 - 1); // base 35 + bônus, capado em 35
  });

  it("histórico reprodutivo ausente não penaliza (nota neutra)", () => {
    const result = scorePair(baseInput({ reproductiveHistory: null }));
    expect(result.historyScore).toBe(6);
  });

  it("histórico reprodutivo com boa taxa de eclosão dá nota alta", () => {
    const result = scorePair(baseInput({ reproductiveHistory: { totalClutches: 2, totalEggs: 10, totalHatched: 9 } }));
    expect(result.historyScore).toBeGreaterThanOrEqual(8);
  });

  it("quarentena recente reduz a nota de saúde e gera aviso", () => {
    const result = scorePair(baseInput({ recentHealthFlags: { hasRecentQuarantine: true, hasRecentWeightCheck: false, hasRecentDietLog: false } }));
    expect(result.healthScore).toBeLessThan(12);
    expect(result.warnings.some((w) => w.includes("quarentena"))).toBe(true);
  });
});

describe("pairingOptimizer — diferenciação por objetivo", () => {
  it("REDUZIR_COI pontua melhor um par com COI menor", () => {
    const lowCoi = scorePair(baseInput({ objective: "REDUZIR_COI", coi: 0, maxCoi: 1 }));
    const highCoi = scorePair(baseInput({ objective: "REDUZIR_COI", coi: 0.2, maxCoi: 1 }));
    expect(lowCoi.objectiveScore).toBeGreaterThan(highCoi.objectiveScore);
  });

  it("REPRODUCAO_SEGURA penaliza pares com avisos genéticos", () => {
    const maleGenotype: BirdGenotypeInput = { sex: "macho", featherType: "nevado", mutations: [] };
    const femaleGenotype: BirdGenotypeInput = { sex: "fêmea", featherType: "nevado", mutations: [] };
    const withWarning = scorePair(baseInput({ objective: "REPRODUCAO_SEGURA", maleGenotype, femaleGenotype, coi: 0 }));
    const clean = scorePair(baseInput({ objective: "REPRODUCAO_SEGURA", coi: 0 }));
    expect(withWarning.objectiveScore).toBeLessThan(clean.objectiveScore);
  });

  it("EXPOSICAO usa a melhor nota de campeonato quando disponível", () => {
    const withScore = scorePair(baseInput({ objective: "EXPOSICAO", bestShowScore: 90 }));
    const withoutScore = scorePair(baseInput({ objective: "EXPOSICAO", bestShowScore: null }));
    expect(withScore.objectiveScore).toBeGreaterThan(withoutScore.objectiveScore);
  });

  it("PRODUZIR_PORTADORES identifica chance de portadores quando há mutação em comum", () => {
    const maleGenotype: BirdGenotypeInput = {
      sex: "macho",
      mutations: [{ mutation: "agata", inheritance: "sex_linked_recessive", zygosity: "homozygous_mutant" }],
    };
    const femaleGenotype: BirdGenotypeInput = {
      sex: "fêmea",
      mutations: [{ mutation: "agata", inheritance: "sex_linked_recessive", zygosity: "homozygous_normal" }],
    };
    const result = scorePair(baseInput({ objective: "PRODUZIR_PORTADORES", maleGenotype, femaleGenotype, coi: 0 }));
    expect(result.objectiveScore).toBe(10);
  });
});

describe("pairingOptimizer — status final", () => {
  it("pontuação muito baixa (sem dados, COI bem alto) -> NAO_RECOMENDADO por score, não só por trava", () => {
    const result = scorePair(baseInput({ coi: 0.25, maxCoi: 1 })); // não bate trava (maxCoi alto), mas pontua baixo
    expect(result.finalScore).toBeLessThan(50);
    expect(result.status).toBe("NAO_RECOMENDADO");
  });

  it("par com tudo favorável e objetivo de reprodução segura tende a IDEAL/APROVADO", () => {
    const maleGenotype: BirdGenotypeInput = { sex: "macho", featherType: "intenso", mutations: [] };
    const femaleGenotype: BirdGenotypeInput = { sex: "fêmea", featherType: "nevado", mutations: [] };
    const result = scorePair(
      baseInput({
        objective: "REPRODUCAO_SEGURA",
        coi: 0,
        maleGenotype,
        femaleGenotype,
        recentHealthFlags: { hasRecentQuarantine: false, hasRecentWeightCheck: true, hasRecentDietLog: true },
        reproductiveHistory: { totalClutches: 1, totalEggs: 4, totalHatched: 4 },
      })
    );
    expect(["IDEAL", "APROVADO"]).toContain(result.status);
  });
});
