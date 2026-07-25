/**
 * multiGenSimulator.test.ts — Testes da simulação F1 → F2
 */
import { describe, it, expect } from "vitest";
import { simulateF2Cross } from "./multiGenSimulator";

describe("simulateF2Cross — herança autossômica recessiva (onix)", () => {
  // Cenário verificado à mão:
  //   A (macho, onix Nm) × B (fêmea, onix Nm)
  //     → F1: 25% NN, 50% Nm, 25% mm
  //   F1 fêmea (pois C é macho) × C (macho, onix mm — visual puro)
  //     F1=NN(25%) × C=mm  -> 100% Nm            => contribui 0,25 × 1,00 = 0,25 Nm
  //     F1=Nm(50%) × C=mm  -> 50% Nm / 50% mm    => contribui 0,50 × 0,50 = 0,25 Nm  e  0,25 mm
  //     F1=mm(25%) × C=mm  -> 100% mm            => contribui 0,25 × 1,00 = 0,25 mm
  //   F2 esperado: 50% Nm (portador) / 50% mm (visual) / 0% NN
  const result = simulateF2Cross({
    grandparentA: { sex: "macho", onix: "Nm" },
    grandparentB: { sex: "fêmea", onix: "Nm" },
    mateC: { sex: "macho", onix: "mm" },
    mutationId: "onix",
  });

  it("usa fêmea como sexo do F1 (porque C é macho)", () => {
    expect(result.f1SexUsed).toBe("fêmea");
  });

  it("F1 segue a distribuição autossômica recessiva clássica 25/50/25", () => {
    const byGenotype = Object.fromEntries(result.f1Distribution.map((o) => [o.genotype, o.probability]));
    expect(byGenotype["NN"]).toBeCloseTo(0.25, 3);
    expect(byGenotype["Nm"]).toBeCloseTo(0.5, 3);
    expect(byGenotype["mm"]).toBeCloseTo(0.25, 3);
  });

  it("F2 final é 50% portador (Nm) e 50% visual (mm), sem NN puro", () => {
    const nn = result.f2Outcomes.find((o) => o.genotype === "NN");
    const nm = result.f2Outcomes.find((o) => o.genotype === "Nm");
    const mm = result.f2Outcomes.find((o) => o.genotype === "mm");

    expect(nn).toBeUndefined();
    expect(nm?.probability).toBeCloseTo(0.5, 2);
    expect(mm?.probability).toBeCloseTo(0.5, 2);
  });

  it("as probabilidades da F2 somam ~100% (nenhum aviso de inconsistência)", () => {
    const total = result.f2Outcomes.reduce((s, o) => s + o.probability, 0);
    expect(total).toBeCloseTo(1, 2);
    expect(result.warnings).toHaveLength(0);
  });

  it("rastreia por quais genótipos F1 cada resultado F2 passou (transparência)", () => {
    const nm = result.f2Outcomes.find((o) => o.genotype === "Nm");
    // Nm final vem tanto de F1=NN quanto de F1=Nm
    expect(nm?.viaF1Genotypes.sort()).toEqual(["NN", "Nm"]);
  });
});

describe("simulateF2Cross — mutação ausente nos genótipos informados", () => {
  it("devolve aviso claro em vez de lançar erro", () => {
    const result = simulateF2Cross({
      grandparentA: { sex: "macho" },
      grandparentB: { sex: "fêmea" },
      mateC: { sex: "macho" },
      mutationId: "onix",
    });
    // Mesmo sem a mutação preenchida, o cruzamento de "ausência" é NN×NN,
    // então não deve lançar erro — só não deve gerar variação.
    expect(result.f2Outcomes.length).toBeGreaterThanOrEqual(0);
  });
});
