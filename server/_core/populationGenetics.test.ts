/**
 * populationGenetics.test.ts — Testes do módulo de Genética Populacional
 */
import { describe, it, expect } from "vitest";
import {
  calculateMeanKinshipForBird,
  calculateEffectivePopulationSize,
  classifyNeStatus,
  identifyFounders,
  calculateFounderContributions,
  buildPopulationGeneticsReport,
} from "./populationGenetics";
import { PedigreeBird } from "./genetics";

function bird(id: number, sex: "macho" | "fêmea", fatherId: number | null, motherId: number | null): PedigreeBird {
  return { id, ring: `B${id}`, specialty_code: "cc", color_code: "am", sex, fatherId, motherId };
}

// Pedigree usado em vários testes abaixo:
//   Fundadores (sem pai/mãe): 1(M), 2(F), 3(M), 4(F) — todos sem parentesco entre si
//   5(M) = filho de 1×2
//   6(F) = filho de 3×4
//   7(M) = filho de 5×6  (bisneto de todos os 4 fundadores, um caminho de cada)
const pedigreeMap = new Map<number, PedigreeBird>([
  [1, bird(1, "macho", null, null)],
  [2, bird(2, "fêmea", null, null)],
  [3, bird(3, "macho", null, null)],
  [4, bird(4, "fêmea", null, null)],
  [5, bird(5, "macho", 1, 2)],
  [6, bird(6, "fêmea", 3, 4)],
  [7, bird(7, "macho", 5, 6)],
]);

describe("calculateEffectivePopulationSize", () => {
  it("aplica a fórmula de Wright (1938): Ne = 4·Nm·Nf/(Nm+Nf)", () => {
    // 4 machos, 4 fêmeas -> Ne = 4*4*4/8 = 8
    expect(calculateEffectivePopulationSize(4, 4)).toBe(8);
  });

  it("proporção de sexo desigual reduz o Ne mesmo com o mesmo total", () => {
    const balanced = calculateEffectivePopulationSize(5, 5); // total 10
    const unbalanced = calculateEffectivePopulationSize(9, 1); // total 10
    expect(unbalanced).toBeLessThan(balanced);
  });

  it("retorna 0 se não há machos ou não há fêmeas reprodutores", () => {
    expect(calculateEffectivePopulationSize(0, 5)).toBe(0);
    expect(calculateEffectivePopulationSize(5, 0)).toBe(0);
  });
});

describe("classifyNeStatus", () => {
  it("classifica Ne muito baixo como crítico", () => {
    expect(classifyNeStatus(5).status).toBe("critical");
  });
  it("classifica Ne intermediário como baixo", () => {
    expect(classifyNeStatus(20).status).toBe("low");
  });
  it("classifica Ne alto como saudável", () => {
    expect(classifyNeStatus(50).status).toBe("healthy");
  });
});

describe("identifyFounders", () => {
  it("identifica só os pássaros sem pai e sem mãe no sistema", () => {
    const founders = identifyFounders(pedigreeMap);
    const ids = founders.map((f) => f.id).sort();
    expect(ids).toEqual([1, 2, 3, 4]);
  });

  it("não considera fundador um pássaro com pelo menos um dos pais conhecido", () => {
    const founders = identifyFounders(pedigreeMap);
    expect(founders.find((f) => f.id === 5)).toBeUndefined();
    expect(founders.find((f) => f.id === 7)).toBeUndefined();
  });
});

describe("calculateFounderContributions", () => {
  it("um bisneto de 4 fundadores distintos recebe 25% de cada um (soma 100%)", () => {
    const contributions = calculateFounderContributions([7], pedigreeMap, 6);
    expect(contributions).toHaveLength(4);
    for (const c of contributions) {
      expect(c.averageContribution).toBeCloseTo(0.25, 5);
    }
    const total = contributions.reduce((s, c) => s + c.averageContribution, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it("marca fundador como 'dominant' quando contribui >= 25% do plantel ativo", () => {
    // Plantel ativo = só o bird 7: cada fundador contribui exatamente 25%,
    // que é o limiar de "dominant" (>= 0.25).
    const contributions = calculateFounderContributions([7], pedigreeMap, 6);
    expect(contributions.every((c) => c.flag === "dominant")).toBe(true);
  });

  it("retorna lista vazia se não há pássaros ativos", () => {
    expect(calculateFounderContributions([], pedigreeMap, 6)).toEqual([]);
  });
});

describe("calculateMeanKinshipForBird", () => {
  it("fundadores sem parentesco entre si têm mean kinship 0", () => {
    // 1 e 3 são fundadores completamente distintos, sem ancestral em comum.
    const result = calculateMeanKinshipForBird(1, [1, 3], pedigreeMap, 6);
    expect(result.meanKinship).toBe(0);
    expect(result.comparedAgainst).toBe(1);
  });

  it("um pássaro sozinho no plantel ativo (sem ninguém pra comparar) retorna kinship 0", () => {
    const result = calculateMeanKinshipForBird(1, [1], pedigreeMap, 6);
    expect(result.meanKinship).toBe(0);
    expect(result.comparedAgainst).toBe(0);
  });

  it("pássaro aparentado (pai) tem mean kinship maior que pássaro não aparentado", () => {
    // 5 é pai de 7 (aparentados). Para comparação com um pássaro SEM
    // NENHUM ancestral em comum, precisa ser alguém fora da árvore de 7
    // inteira — bird 3 não serve (é avô de 7 via 6), por isso um fundador
    // isolado (8) foi adicionado só para este teste.
    const mapWithIsolated = new Map(pedigreeMap);
    mapWithIsolated.set(8, bird(8, "macho", null, null));

    const kinshipWithFather = calculateMeanKinshipForBird(7, [7, 5], mapWithIsolated, 6).meanKinship;
    const kinshipWithUnrelated = calculateMeanKinshipForBird(7, [7, 8], mapWithIsolated, 6).meanKinship;
    expect(kinshipWithFather).toBeGreaterThan(kinshipWithUnrelated);
    expect(kinshipWithUnrelated).toBe(0);
  });
});

describe("buildPopulationGeneticsReport", () => {
  it("monta o relatório completo sem lançar erro e com contagens corretas", () => {
    const activeBirds = [pedigreeMap.get(5)!, pedigreeMap.get(6)!, pedigreeMap.get(7)!];
    const report = buildPopulationGeneticsReport({ activeBirds, birdMap: pedigreeMap, maxGenerations: 6 });

    expect(report.totalActive).toBe(3);
    expect(report.breedingMales).toBe(2); // 5 e 7
    expect(report.breedingFemales).toBe(1); // 6
    expect(report.meanKinshipByBird).toHaveLength(3);
    expect(report.founders.length).toBeGreaterThan(0);
    expect(report.effectivePopulationSize).toBeGreaterThan(0);
  });

  it("plantel vazio não lança erro e devolve zeros", () => {
    const report = buildPopulationGeneticsReport({ activeBirds: [], birdMap: pedigreeMap });
    expect(report.totalActive).toBe(0);
    expect(report.effectivePopulationSize).toBe(0);
    expect(report.meanKinshipByBird).toEqual([]);
    expect(report.founders).toEqual([]);
  });
});
