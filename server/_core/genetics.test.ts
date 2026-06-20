import { describe, it, expect } from "vitest";
import { calculateCOI, calculateCOIForPair, buildPedigreeTree, classifyCOIRisk, PedigreeBird } from "./genetics";

function bird(id: number, fatherId: number | null, motherId: number | null): PedigreeBird {
  return { id, ring: `B${id}`, specialty_code: "x", color_code: "y", sex: "macho", fatherId, motherId };
}

describe("genetics.calculateCOIForPair", () => {
  it("irmãos completos (mesmo pai e mesma mãe) -> 25%", () => {
    const map = new Map<number, PedigreeBird>([
      [1, bird(1, null, null)], // pai F
      [2, bird(2, null, null)], // mãe M
      [3, bird(3, 1, 2)], // A
      [4, bird(4, 1, 2)], // B
    ]);
    expect(calculateCOIForPair(3, 4, map, 5)).toBeCloseTo(0.25, 6);
  });

  it("meio-irmãos (mesmo pai, mães diferentes) -> 12.5%", () => {
    const map = new Map<number, PedigreeBird>([
      [1, bird(1, null, null)],
      [2, bird(2, null, null)],
      [5, bird(5, null, null)],
      [3, bird(3, 1, 2)],
      [4, bird(4, 1, 5)],
    ]);
    expect(calculateCOIForPair(3, 4, map, 5)).toBeCloseTo(0.125, 6);
  });

  it("pai x filha -> 25%", () => {
    const map = new Map<number, PedigreeBird>([
      [1, bird(1, null, null)],
      [2, bird(2, null, null)],
      [3, bird(3, 1, 2)],
    ]);
    expect(calculateCOIForPair(1, 3, map, 5)).toBeCloseTo(0.25, 6);
  });

  it("não aparentados -> 0%", () => {
    const map = new Map<number, PedigreeBird>([
      [1, bird(1, null, null)],
      [2, bird(2, null, null)],
    ]);
    expect(calculateCOIForPair(1, 2, map, 5)).toBe(0);
  });

  it("avô x neta -> 12.5%", () => {
    const map = new Map<number, PedigreeBird>([
      [1, bird(1, null, null)],
      [2, bird(2, null, null)],
      [3, bird(3, 1, 2)],
      [4, bird(4, null, null)],
      [5, bird(5, 3, 4)],
    ]);
    expect(calculateCOIForPair(1, 5, map, 5)).toBeCloseTo(0.125, 6);
  });

  it("primos de primeiro grau (mesmos avós) -> 6.25%", () => {
    const map = new Map<number, PedigreeBird>([
      [1, bird(1, null, null)],
      [2, bird(2, null, null)],
      [3, bird(3, 1, 2)],
      [4, bird(4, 1, 2)],
      [5, bird(5, null, null)],
      [6, bird(6, null, null)],
      [7, bird(7, 3, 5)],
      [8, bird(8, 4, 6)],
    ]);
    expect(calculateCOIForPair(7, 8, map, 5)).toBeCloseTo(0.0625, 6);
  });
});

describe("genetics.calculateCOI", () => {
  it("pássaro já cadastrado, filho de irmãos completos -> 25%", () => {
    const map = new Map<number, PedigreeBird>([
      [1, bird(1, null, null)],
      [2, bird(2, null, null)],
      [3, bird(3, 1, 2)],
      [4, bird(4, 1, 2)],
      [9, bird(9, 3, 4)],
    ]);
    expect(calculateCOI(9, map, 5)).toBeCloseTo(0.25, 6);
  });
});

describe("genetics.classifyCOIRisk", () => {
  it("classifica corretamente as faixas de risco", () => {
    expect(classifyCOIRisk(0.25)).toBe("high");
    expect(classifyCOIRisk(0.0625)).toBe("moderate");
    expect(classifyCOIRisk(0.01)).toBe("low");
  });
});

describe("genetics.buildPedigreeTree", () => {
  it("trunca corretamente em 5 gerações", () => {
    const map = new Map<number, PedigreeBird>();
    for (let i = 1; i <= 7; i++) {
      map.set(i, bird(i, i < 7 ? i + 1 : null, null));
    }
    const tree = buildPedigreeTree(1, map, 5);
    let depth = 0;
    let node = tree;
    while (node?.father) {
      depth++;
      node = node.father;
    }
    expect(depth).toBe(5);
    expect(node?.truncated).toBe(true);
  });

  it("retorna null para pássaro inexistente", () => {
    const map = new Map<number, PedigreeBird>();
    expect(buildPedigreeTree(999, map, 5)).toBeNull();
  });
});
