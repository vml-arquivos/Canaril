/**
 * costAllocation.test.ts — Testes de alocação de custo por pássaro
 */
import { describe, it, expect } from "vitest";
import { allocateCostsPerBird, classifyBirdPigmentCategory, classifyBirdAgeCategory } from "./costAllocation";

describe("classifyBirdPigmentCategory", () => {
  const colors = [
    { id: "com_fator_x", category: "Vermelho", genetics: "Com fator vermelho" },
    { id: "sem_fator_x", category: "Amarelo", genetics: "Sem fator vermelho" },
    { id: "sem_genetics_vermelho", category: "Vermelho" },
    { id: "sem_genetics_amarelo", category: "Amarelo" },
    { id: "outra", category: "Mutação" },
  ];

  it("classifica por genetics quando disponível", () => {
    expect(classifyBirdPigmentCategory("com_fator_x", colors)).toBe("com_fator");
    expect(classifyBirdPigmentCategory("sem_fator_x", colors)).toBe("sem_fator");
  });

  it("cai no fallback por category quando genetics não está disponível", () => {
    expect(classifyBirdPigmentCategory("sem_genetics_vermelho", colors)).toBe("com_fator");
    expect(classifyBirdPigmentCategory("sem_genetics_amarelo", colors)).toBe("sem_fator");
  });

  it("retorna null pra cor sem categoria reconhecida ou código ausente", () => {
    expect(classifyBirdPigmentCategory("outra", colors)).toBeNull();
    expect(classifyBirdPigmentCategory(null, colors)).toBeNull();
    expect(classifyBirdPigmentCategory("inexistente", colors)).toBeNull();
  });
});

describe("classifyBirdAgeCategory", () => {
  const now = new Date("2026-07-31T00:00:00Z");

  it("classifica como filhote até 40 dias", () => {
    expect(classifyBirdAgeCategory("2026-07-20", now)).toBe("filhote"); // 11 dias
    expect(classifyBirdAgeCategory("2026-06-21", now)).toBe("filhote"); // 40 dias
  });

  it("classifica como jovem entre 41 dias e 1 ano", () => {
    expect(classifyBirdAgeCategory("2026-06-01", now)).toBe("jovem"); // 60 dias
    expect(classifyBirdAgeCategory("2025-08-01", now)).toBe("jovem"); // ~1 ano menos alguns dias
  });

  it("classifica como adulto acima de 1 ano", () => {
    expect(classifyBirdAgeCategory("2020-01-01", now)).toBe("adulto");
  });

  it("sem data de nascimento, retorna desconhecido", () => {
    expect(classifyBirdAgeCategory(null, now)).toBe("desconhecido");
    expect(classifyBirdAgeCategory(undefined, now)).toBe("desconhecido");
  });

  it("data no futuro (dado inconsistente) retorna desconhecido, não quebra", () => {
    expect(classifyBirdAgeCategory("2027-01-01", now)).toBe("desconhecido");
  });
});

describe("allocateCostsPerBird — todos adultos (peso igual, equivale à divisão simples)", () => {
  it("insumo geral é dividido igualmente quando todos são adultos", () => {
    const result = allocateCostsPerBird({
      supplies: [{ totalCost: 100, appliesToColorCategory: null }],
      birds: [
        { id: 1, ring: "B1", pigmentCategory: null, ageCategory: "adulto" },
        { id: 2, ring: "B2", pigmentCategory: "com_fator", ageCategory: "adulto" },
      ],
    });

    expect(result.totalGeneral).toBe(100);
    expect(result.perBird.find((p) => p.birdId === 1)?.totalCost).toBe(50);
    expect(result.perBird.find((p) => p.birdId === 2)?.totalCost).toBe(50);
  });

  it("insumo específico só é dividido entre pássaros da categoria correspondente", () => {
    const result = allocateCostsPerBird({
      supplies: [
        { totalCost: 100, appliesToColorCategory: null },
        { totalCost: 30, appliesToColorCategory: "com_fator" },
      ],
      birds: [
        { id: 1, ring: "Amarelo", pigmentCategory: "sem_fator", ageCategory: "adulto" },
        { id: 2, ring: "Vermelho", pigmentCategory: "com_fator", ageCategory: "adulto" },
      ],
    });

    const b1 = result.perBird.find((p) => p.birdId === 1)!;
    const b2 = result.perBird.find((p) => p.birdId === 2)!;

    expect(b1.generalCost).toBe(50);
    expect(b1.specificCost).toBe(0);
    expect(b1.totalCost).toBe(50);

    expect(b2.generalCost).toBe(50);
    expect(b2.specificCost).toBe(30);
    expect(b2.totalCost).toBe(80);

    expect(result.grandTotal).toBe(130);
  });

  it("divide o custo específico entre TODOS os pássaros daquela categoria, não só um", () => {
    const result = allocateCostsPerBird({
      supplies: [{ totalCost: 40, appliesToColorCategory: "com_fator" }],
      birds: [
        { id: 1, ring: "V1", pigmentCategory: "com_fator", ageCategory: "adulto" },
        { id: 2, ring: "V2", pigmentCategory: "com_fator", ageCategory: "adulto" },
        { id: 3, ring: "Amarelo", pigmentCategory: "sem_fator", ageCategory: "adulto" },
      ],
    });

    expect(result.perBird.find((p) => p.birdId === 1)?.specificCost).toBe(20);
    expect(result.perBird.find((p) => p.birdId === 2)?.specificCost).toBe(20);
    expect(result.perBird.find((p) => p.birdId === 3)?.specificCost).toBe(0);
  });

  it("plantel vazio não lança erro", () => {
    const result = allocateCostsPerBird({ supplies: [{ totalCost: 100, appliesToColorCategory: null }], birds: [] });
    expect(result.perBird).toEqual([]);
    expect(result.averagePerBird).toBe(0);
  });

  it("sem nenhum insumo, custo de todos os pássaros é zero", () => {
    const result = allocateCostsPerBird({ supplies: [], birds: [{ id: 1, ring: "B1", pigmentCategory: null, ageCategory: "adulto" }] });
    expect(result.perBird[0].totalCost).toBe(0);
    expect(result.grandTotal).toBe(0);
  });
});

describe("allocateCostsPerBird — proporcional por idade (o novo comportamento)", () => {
  it("filhote (peso 0.3) recebe proporcionalmente menos custo geral que um adulto (peso 1.0)", () => {
    // 1 adulto (peso 1.0) + 1 filhote (peso 0.3) = peso total 1.3
    // R$130 de ração / 1.3 = R$100 por unidade de peso
    // adulto: 1.0 * 100 = R$100 | filhote: 0.3 * 100 = R$30
    const result = allocateCostsPerBird({
      supplies: [{ totalCost: 130, appliesToColorCategory: null }],
      birds: [
        { id: 1, ring: "Adulto", pigmentCategory: null, ageCategory: "adulto" },
        { id: 2, ring: "Filhote", pigmentCategory: null, ageCategory: "filhote" },
      ],
    });

    const adulto = result.perBird.find((p) => p.birdId === 1)!;
    const filhote = result.perBird.find((p) => p.birdId === 2)!;

    expect(adulto.generalCost).toBeCloseTo(100, 5);
    expect(filhote.generalCost).toBeCloseTo(30, 5);
    // Soma das partes bate com o total (nenhum valor "perdido" na divisão)
    expect(adulto.generalCost + filhote.generalCost).toBeCloseTo(130, 5);
  });

  it("jovem (peso 0.65) fica entre filhote e adulto", () => {
    const result = allocateCostsPerBird({
      supplies: [{ totalCost: 165, appliesToColorCategory: null }], // peso total 1.65 (1.0 + 0.65) -> 100 por unidade
      birds: [
        { id: 1, ring: "Adulto", pigmentCategory: null, ageCategory: "adulto" },
        { id: 2, ring: "Jovem", pigmentCategory: null, ageCategory: "jovem" },
      ],
    });

    const adulto = result.perBird.find((p) => p.birdId === 1)!;
    const jovem = result.perBird.find((p) => p.birdId === 2)!;

    expect(adulto.generalCost).toBeCloseTo(100, 5);
    expect(jovem.generalCost).toBeCloseTo(65, 5);
    expect(jovem.generalCost).toBeLessThan(adulto.generalCost);
    expect(jovem.generalCost).toBeGreaterThan(0);
  });

  it("pássaro com idade desconhecida usa peso de adulto (não penaliza nem favorece)", () => {
    const result = allocateCostsPerBird({
      supplies: [{ totalCost: 100, appliesToColorCategory: null }],
      birds: [
        { id: 1, ring: "Adulto", pigmentCategory: null, ageCategory: "adulto" },
        { id: 2, ring: "SemData", pigmentCategory: null, ageCategory: "desconhecido" },
      ],
    });

    const b1 = result.perBird.find((p) => p.birdId === 1)!;
    const b2 = result.perBird.find((p) => p.birdId === 2)!;
    expect(b1.generalCost).toBeCloseTo(b2.generalCost, 5);
  });
});
