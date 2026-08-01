/**
 * costAllocation.test.ts — Testes de alocação de custo por pássaro
 */
import { describe, it, expect } from "vitest";
import { allocateCostsPerBird, classifyBirdPigmentCategory } from "./costAllocation";

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

describe("allocateCostsPerBird", () => {
  it("insumo geral é dividido igualmente entre todos os pássaros", () => {
    const result = allocateCostsPerBird({
      supplies: [{ totalCost: 100, appliesToColorCategory: null }],
      birds: [
        { id: 1, ring: "B1", pigmentCategory: null },
        { id: 2, ring: "B2", pigmentCategory: "com_fator" },
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
        { id: 1, ring: "Amarelo", pigmentCategory: "sem_fator" },
        { id: 2, ring: "Vermelho", pigmentCategory: "com_fator" },
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
        { id: 1, ring: "V1", pigmentCategory: "com_fator" },
        { id: 2, ring: "V2", pigmentCategory: "com_fator" },
        { id: 3, ring: "Amarelo", pigmentCategory: "sem_fator" },
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
    const result = allocateCostsPerBird({ supplies: [], birds: [{ id: 1, ring: "B1", pigmentCategory: null }] });
    expect(result.perBird[0].totalCost).toBe(0);
    expect(result.grandTotal).toBe(0);
  });
});
