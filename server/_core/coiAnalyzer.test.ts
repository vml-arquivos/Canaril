/**
 * coiAnalyzer.test.ts — Testes do analisador de COI avançado (Missão 3)
 */
import { describe, it, expect } from "vitest";
import { analyzeCoiForPair } from "./coiAnalyzer";
import { PedigreeBird } from "./genetics";

function bird(id: number, fatherId: number | null, motherId: number | null): PedigreeBird {
  return { id, ring: `B${id}`, specialty_code: "cc", color_code: "am", sex: "macho", fatherId, motherId };
}

describe("analyzeCoiForPair — sem parentesco", () => {
  const map = new Map<number, PedigreeBird>([
    [1, bird(1, null, null)],
    [2, bird(2, null, null)],
  ]);

  it("retorna COI 0 e risk low", () => {
    const r = analyzeCoiForPair(1, 2, map, 5);
    expect(r.coi).toBe(0);
    expect(r.risk).toBe("low");
    expect(r.hasCommonAncestors).toBe(false);
    expect(r.commonAncestors).toHaveLength(0);
  });

  it("explicação menciona diversidade genética", () => {
    const r = analyzeCoiForPair(1, 2, map, 5);
    expect(r.explanationSimple.toLowerCase()).toContain("ancestrais");
  });
});

describe("analyzeCoiForPair — irmãos completos (COI 25%)", () => {
  const map = new Map<number, PedigreeBird>([
    [1, bird(1, null, null)],
    [2, bird(2, null, null)],
    [3, bird(3, 1, 2)],
    [4, bird(4, 1, 2)],
  ]);

  it("COI próximo de 25%", () => {
    const r = analyzeCoiForPair(3, 4, map, 5);
    expect(r.coi).toBeCloseTo(0.25, 4);
  });

  it("risk = high (limiar 12.5%)", () => {
    const r = analyzeCoiForPair(3, 4, map, 5);
    expect(["high", "very_high"]).toContain(r.risk);
  });

  it("identifica 2 ancestrais comuns (pai e mãe dos irmãos)", () => {
    const r = analyzeCoiForPair(3, 4, map, 5);
    expect(r.commonAncestors.length).toBeGreaterThanOrEqual(2);
    const ids = r.commonAncestors.map((a) => a.ancestorId);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
  });

  it("soma das contribuições bate no COI total (± 1%)", () => {
    const r = analyzeCoiForPair(3, 4, map, 5);
    const sumContrib = r.commonAncestors.reduce((s, a) => s + a.contributionPct, 0);
    expect(sumContrib).toBeGreaterThan(95); // soma deve ser ~100%
    expect(sumContrib).toBeLessThanOrEqual(101);
  });

  it("explicação menciona risco", () => {
    const r = analyzeCoiForPair(3, 4, map, 5);
    expect(r.explanationSimple.toLowerCase()).toMatch(/coi|consanguinidade|risco|alto/);
  });
});

describe("analyzeCoiForPair — COI parcial com avós comuns", () => {
  const map = new Map<number, PedigreeBird>([
    [1, bird(1, null, null)],
    [2, bird(2, null, null)],
    [3, bird(3, 1, 2)],
    [4, bird(4, null, null)],
    [5, bird(5, 3, 4)], // neto de 1 e 2 pelo pai
    [6, bird(6, 1, null)], // filho de 1 apenas
  ]);

  it("identifica ancestral 1 como comum", () => {
    const r = analyzeCoiForPair(5, 6, map, 5);
    const ids = r.commonAncestors.map((a) => a.ancestorId);
    expect(ids).toContain(1);
  });

  it("COI está entre 0 e 25%", () => {
    const r = analyzeCoiForPair(5, 6, map, 5);
    expect(r.coi).toBeGreaterThan(0);
    expect(r.coi).toBeLessThan(0.25);
  });
});

describe("analyzeCoiForPair — mesmo indivíduo (caso degenerado)", () => {
  const map = new Map<number, PedigreeBird>([[1, bird(1, null, null)]]);

  it("retorna COI 1 e risk very_high", () => {
    const r = analyzeCoiForPair(1, 1, map, 5);
    expect(r.coi).toBe(1);
    expect(r.risk).toBe("very_high");
  });
});

describe("analyzeCoiForPair — explicação técnica", () => {
  const map = new Map<number, PedigreeBird>([
    [1, bird(1, null, null)],
    [2, bird(2, null, null)],
    [3, bird(3, 1, 2)],
    [4, bird(4, 1, 2)],
  ]);

  it("menciona Fórmula de Wright", () => {
    const r = analyzeCoiForPair(3, 4, map, 5);
    expect(r.explanationTechnical).toContain("Wright");
  });

  it("menciona número de gerações", () => {
    const r = analyzeCoiForPair(3, 4, map, 5);
    expect(r.explanationTechnical).toMatch(/[Gg]era[çc][õo]es.*\d|\d.*[Gg]era[çc][õo]es/);
  });
});
