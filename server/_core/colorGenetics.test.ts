/**
 * colorGenetics.test.ts — Testes do motor genético completo
 *
 * Valida:
 *   - Todas as 18 mutações no MUTATION_CONFIG
 *   - Cruzamentos sex-linked (ZZ/ZW)
 *   - Cruzamentos autossômicos recessivos
 *   - Cruzamentos autossômicos dominantes
 *   - Alertas de risco letal (crista×crista, branco dominante×branco dominante)
 *   - Isabelino e topázio (casos compostos)
 *   - calculateLipochromeCross
 *   - Invariantes matemáticos (probabilidades somam 1.0)
 */
import { describe, it, expect } from "vitest";
import {
  calculateColorCross,
  calculateLipochromeCross,
  MUTATION_CONFIG,
} from "./colorGenetics";

// ─── Helper: constrói um pai/mãe com uma única mutação ───────────────────────

function male(mutations: Record<string, string> = {}) {
  return { sex: "macho" as const, ...mutations };
}
function female(mutations: Record<string, string> = {}) {
  return { sex: "fêmea" as const, ...mutations };
}

// ─── MUTATION_CONFIG — catálogo completo ──────────────────────────────────────

describe("MUTATION_CONFIG — catálogo", () => {
  it("tem pelo menos 18 mutações", () => {
    expect(Object.keys(MUTATION_CONFIG).length).toBeGreaterThanOrEqual(18);
  });

  it("todas as mutações têm label, inheritance e description", () => {
    for (const [id, cfg] of Object.entries(MUTATION_CONFIG)) {
      expect(cfg.label, `${id}.label`).toBeTruthy();
      expect(cfg.inheritance, `${id}.inheritance`).toMatch(/^(sex_linked|autosomal_recessive|autosomal_dominant)$/);
      expect(cfg.description, `${id}.description`).toBeTruthy();
      expect(cfg.phenotypeEffect, `${id}.phenotypeEffect`).toBeTruthy();
    }
  });

  it("mutações ligadas ao sexo incluem: ágata, canela, ino, marfim, acetinado, asasCinza, opalino", () => {
    const slMuts = Object.entries(MUTATION_CONFIG)
      .filter(([, c]) => c.inheritance === "sex_linked")
      .map(([id]) => id);
    for (const expected of ["agata", "canela", "ino", "marfim", "acetinado", "asasCinza", "opalino"]) {
      expect(slMuts, `falta ${expected}`).toContain(expected);
    }
  });

  it("mutações autossômicas recessivas incluem: pastel, brancorecessivo, onix, cobalto, jaspe, feo, asasBrancas", () => {
    const arMuts = Object.entries(MUTATION_CONFIG)
      .filter(([, c]) => c.inheritance === "autosomal_recessive")
      .map(([id]) => id);
    for (const expected of ["pastel", "brancorecessivo", "onix", "cobalto", "jaspe", "feo", "asasBrancas"]) {
      expect(arMuts, `falta ${expected}`).toContain(expected);
    }
  });

  it("mutações autossômicas dominantes: crista, brancoDominante, plumagem", () => {
    const adMuts = Object.entries(MUTATION_CONFIG)
      .filter(([, c]) => c.inheritance === "autosomal_dominant")
      .map(([id]) => id);
    for (const expected of ["crista", "brancoDominante", "plumagem"]) {
      expect(adMuts, `falta ${expected}`).toContain(expected);
    }
  });

  it("crista e brancoDominante têm isLethalHomozygous = true", () => {
    expect(MUTATION_CONFIG["crista"].isLethalHomozygous).toBe(true);
    expect(MUTATION_CONFIG["brancoDominante"].isLethalHomozygous).toBe(true);
  });

  it("marfim tem herança sex_linked (dilui lipocromo)", () => {
    expect(MUTATION_CONFIG["marfim"].inheritance).toBe("sex_linked");
  });
});

// ─── Cruzamentos ligados ao sexo (ZZ/ZW) ─────────────────────────────────────

describe("sex_linked — ágata (representativa de todos os SL)", () => {
  // Macho portador (Z+Z-) × fêmea normal (Z-W)
  it("Z+Z- macho × Z-W fêmea → filhos 50% portadores 50% normais, filhas 50% visuais 50% normais", () => {
    const result = calculateColorCross({
      male: male({ agata: "Z+Z-" }),
      female: female({ agata: "Z-W" }),
    });
    const agata = result.byMutation["agata"];
    expect(agata).toBeDefined();
    // Engine outputs: each genotype within sons/daughters is fraction of TOTAL offspring
    // Z+Z- macho × Z-W fêmea: sons={Z+Z-:0.25, Z-Z-:0.25}, daughters={Z+W:0.25, Z-W:0.25}
    expect(agata.sons?.["Z+Z-"]).toBeCloseTo(0.25, 5);  // portadores (25% do total)
    expect(agata.sons?.["Z-Z-"]).toBeCloseTo(0.25, 5);  // normais
    expect(agata.daughters?.["Z+W"]).toBeCloseTo(0.25, 5);  // visuais
    expect(agata.daughters?.["Z-W"]).toBeCloseTo(0.25, 5);  // normais
    // Sons group total = 0.5 (50% dos filhotes são machos)
    const sonsTotal = Object.values(agata.sons ?? {}).reduce((a, b) => a + b, 0);
    const daughtersTotal = Object.values(agata.daughters ?? {}).reduce((a, b) => a + b, 0);
    expect(sonsTotal).toBeCloseTo(0.5, 5);
    expect(daughtersTotal).toBeCloseTo(0.5, 5);
  });

  // Macho visual homozigoto (Z+Z+) × fêmea normal (Z-W)
  it("Z+Z+ macho × Z-W fêmea → 100% filhos portadores, 100% filhas visuais", () => {
    const result = calculateColorCross({
      male: male({ agata: "Z+Z+" }),
      female: female({ agata: "Z-W" }),
    });
    const agata = result.byMutation["agata"];
    // Cada group (sons/daughters) representa 50% dos filhotes totais
    expect(agata.sons?.["Z+Z-"]).toBeCloseTo(0.5, 5);
    expect(agata.daughters?.["Z+W"]).toBeCloseTo(0.5, 5);
    // Nenhum outro genótipo deve aparecer
    expect(agata.sons?.["Z+Z+"] ?? 0).toBeCloseTo(0, 5);
    expect(agata.sons?.["Z-Z-"] ?? 0).toBeCloseTo(0, 5);
    expect(agata.daughters?.["Z-W"] ?? 0).toBeCloseTo(0, 5);
  });

  // Macho normal × fêmea visual → filhos portadores, filhas normais
  it("Z-Z- macho × Z+W fêmea → filhos todos portadores, filhas todas normais", () => {
    const result = calculateColorCross({
      male: male({ agata: "Z-Z-" }),
      female: female({ agata: "Z+W" }),
    });
    const agata = result.byMutation["agata"];
    expect(agata.sons?.["Z+Z-"]).toBeCloseTo(0.5, 5);
    expect(agata.daughters?.["Z-W"]).toBeCloseTo(0.5, 5);
    // Nenhum visual homozigoto nem normal em sons
    expect(agata.sons?.["Z+Z+"] ?? 0).toBeCloseTo(0, 5);
    expect(agata.daughters?.["Z+W"] ?? 0).toBeCloseTo(0, 5);
  });

  it("probabilidades sons+daughters somam 1.0 para sex_linked", () => {
    const result = calculateColorCross({
      male: male({ canela: "Z+Z-" }),
      female: female({ canela: "Z+W" }),
    });
    const canela = result.byMutation["canela"];
    const sonsTotal = Object.values(canela.sons ?? {}).reduce((a, b) => a + b, 0);
    const daughtersTotal = Object.values(canela.daughters ?? {}).reduce((a, b) => a + b, 0);
    // Sons e daughters cada um representa metade dos filhotes (0.5 cada)
    expect(sonsTotal + daughtersTotal).toBeCloseTo(1.0, 5);
    expect(sonsTotal).toBeCloseTo(0.5, 5);
    expect(daughtersTotal).toBeCloseTo(0.5, 5);
  });

  it("marfim funciona como sex_linked (dilui lipocromo)", () => {
    const result = calculateColorCross({
      male: male({ marfim: "Z+Z-" }),
      female: female({ marfim: "Z-W" }),
    });
    expect(result.byMutation["marfim"]).toBeDefined();
    expect(result.byMutation["marfim"].inheritance).toBe("sex_linked");
    expect(result.byMutation["marfim"].sons).toBeDefined();
    expect(result.byMutation["marfim"].daughters).toBeDefined();
  });
});

// ─── Cruzamentos autossômicos recessivos ──────────────────────────────────────

describe("autosomal_recessive — pastel (representativo)", () => {
  it("portador × portador → 25% visual, 50% portador, 25% normal", () => {
    const result = calculateColorCross({
      male: male({ pastel: "Nm" }),
      female: female({ pastel: "Nm" }),
    });
    const pastel = result.byMutation["pastel"];
    expect(pastel.offspring?.["mm"]).toBeCloseTo(0.25, 5);
    expect(pastel.offspring?.["Nm"]).toBeCloseTo(0.50, 5);
    expect(pastel.offspring?.["NN"]).toBeCloseTo(0.25, 5);
  });

  it("visual × normal → 100% portadores", () => {
    const result = calculateColorCross({
      male: male({ pastel: "mm" }),
      female: female({ pastel: "NN" }),
    });
    const pastel = result.byMutation["pastel"];
    expect(pastel.offspring?.["Nm"]).toBeCloseTo(1.0, 5);
    expect(pastel.offspring?.["mm"] ?? 0).toBeCloseTo(0, 5);
    expect(pastel.offspring?.["NN"] ?? 0).toBeCloseTo(0, 5);
  });

  it("probabilidades offspring somam 1.0", () => {
    for (const combo of [
      { m: "NN", f: "NN" }, { m: "Nm", f: "Nm" }, { m: "mm", f: "Nm" }, { m: "mm", f: "mm" },
    ]) {
      const result = calculateColorCross({
        male: male({ brancorecessivo: combo.m as any }),
        female: female({ brancorecessivo: combo.f as any }),
      });
      const br = result.byMutation["brancorecessivo"];
      const total = Object.values(br.offspring ?? {}).reduce((a, b) => a + b, 0);
      expect(total, `${combo.m}×${combo.f}`).toBeCloseTo(1.0, 5);
    }
  });

  it("ônix, cobalto, jaspe, feo, asasBrancas — todos funcionam como recessivos", () => {
    for (const mut of ["onix", "cobalto", "jaspe", "feo", "asasBrancas"]) {
      const result = calculateColorCross({
        male: male({ [mut]: "Nm" }),
        female: female({ [mut]: "Nm" }),
      });
      const r = result.byMutation[mut];
      expect(r, `${mut} deveria ter resultado`).toBeDefined();
      expect(r.offspring?.["mm"], `${mut} portador×portador deve gerar 25% visual`).toBeCloseTo(0.25, 5);
    }
  });
});

// ─── Cruzamentos autossômicos dominantes ──────────────────────────────────────

describe("autosomal_dominant — crista (dominante letal)", () => {
  it("crista × crista (Nn×Nn) → 25% NN letal, 50% Nn visual, 25% nn normal", () => {
    const result = calculateColorCross({
      male: male({ crista: "Nn" }),
      female: female({ crista: "Nn" }),
    });
    const crista = result.byMutation["crista"];
    expect(crista.offspring?.["NN"]).toBeCloseTo(0.25, 5);
    expect(crista.offspring?.["Nn"]).toBeCloseTo(0.50, 5);
    expect(crista.offspring?.["nn"]).toBeCloseTo(0.25, 5);
  });

  it("crista × crista gera warning de risco letal", () => {
    const result = calculateColorCross({
      male: male({ crista: "Nn" }),
      female: female({ crista: "Nn" }),
    });
    expect(result.warnings.length).toBeGreaterThan(0);
    const hasLethalWarn = result.warnings.some((w) => w.includes("CRISTA") || w.includes("letal") || w.includes("25%"));
    expect(hasLethalWarn).toBe(true);
  });

  it("crista × liso (Nn×nn) → 50% visuais Nn, 50% lisos nn", () => {
    const result = calculateColorCross({
      male: male({ crista: "Nn" }),
      female: female({ crista: "nn" }),
    });
    const crista = result.byMutation["crista"];
    expect(crista.offspring?.["Nn"]).toBeCloseTo(0.5, 5);
    expect(crista.offspring?.["nn"]).toBeCloseTo(0.5, 5);
    expect(crista.offspring?.["NN"] ?? 0).toBeCloseTo(0, 5);
  });

  it("liso × liso → 100% lisos", () => {
    const result = calculateColorCross({
      male: male({ crista: "nn" }),
      female: female({ crista: "nn" }),
    });
    expect(result.byMutation["crista"].offspring?.["nn"]).toBeCloseTo(1.0, 5);
  });

  it("branco dominante × branco dominante gera warning", () => {
    const result = calculateColorCross({
      male: male({ brancoDominante: "Nn" }),
      female: female({ brancoDominante: "Nn" }),
    });
    const hasWarn = result.warnings.some((w) => w.includes("BRANCO DOMINANTE") || w.includes("25%") || w.includes("inviável") || w.includes("letal"));
    expect(hasWarn).toBe(true);
  });

  it("plumagem — nevado×nevado gera warning double buffing", () => {
    const result = calculateColorCross({
      male: male({ plumagem: "Nn" }),
      female: female({ plumagem: "Nn" }),
    });
    const hasWarn = result.warnings.some((w) =>
      w.toLowerCase().includes("nevado") || w.toLowerCase().includes("buffing")
    ) || result.byMutation["plumagem"]?.warnings?.some((w) =>
      w.toLowerCase().includes("nevado") || w.toLowerCase().includes("buffing")
    );
    expect(hasWarn).toBe(true);
  });
});

// ─── Múltiplas mutações simultâneas ───────────────────────────────────────────

describe("múltiplas mutações simultâneas", () => {
  it("calcula ágata + canela juntos (base do isabelino)", () => {
    const result = calculateColorCross({
      male: male({ agata: "Z+Z-", canela: "Z+Z-" }),
      female: female({ agata: "Z-W", canela: "Z-W" }),
    });
    expect(result.byMutation["agata"]).toBeDefined();
    expect(result.byMutation["canela"]).toBeDefined();
    // Aviso de isabelino deve aparecer
    const hasIsabelinoNote = result.warnings.some((w) => w.toLowerCase().includes("isabelino"));
    expect(hasIsabelinoNote).toBe(true);
  });

  it("ino + opalino juntos geram aviso de topázio", () => {
    const result = calculateColorCross({
      male: male({ ino: "Z+Z-", opalino: "Z+Z-" }),
      female: female({ ino: "Z-W", opalino: "Z-W" }),
    });
    const hasTopazioNote = result.warnings.some((w) => w.toLowerCase().includes("topázio") || w.toLowerCase().includes("topazio"));
    expect(hasTopazioNote).toBe(true);
  });

  it("três mutações: ágata + pastel + crista", () => {
    const result = calculateColorCross({
      male: male({ agata: "Z+Z-", pastel: "Nm", crista: "Nn" }),
      female: female({ agata: "Z-W", pastel: "Nm", crista: "Nn" }),
    });
    expect(Object.keys(result.byMutation).length).toBe(3);
    expect(result.byMutation["agata"]).toBeDefined();
    expect(result.byMutation["pastel"]).toBeDefined();
    expect(result.byMutation["crista"]).toBeDefined();
  });

  it("sem mutações → summary indica ausência de genes", () => {
    const result = calculateColorCross({ male: male(), female: female() });
    expect(Object.keys(result.byMutation).length).toBe(0);
    expect(result.summary).toContain("Nenhuma mutação");
  });
});

// ─── phenotypeSummary e recommendations ───────────────────────────────────────

describe("phenotypeSummary e recommendations", () => {
  it("phenotypeSummary.expectedPhenotypes é array", () => {
    const result = calculateColorCross({
      male: male({ agata: "Z+Z-" }),
      female: female({ agata: "Z-W" }),
    });
    expect(Array.isArray(result.phenotypeSummary.expectedPhenotypes)).toBe(true);
  });

  it("recommendations é array", () => {
    const result = calculateColorCross({
      male: male({ crista: "Nn" }),
      female: female({ crista: "Nn" }),
    });
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it("risco letal → recommendations inclui aviso", () => {
    const result = calculateColorCross({
      male: male({ crista: "Nn" }),
      female: female({ crista: "Nn" }),
    });
    const hasRiskRec = result.recommendations.some((r) =>
      r.includes("inviável") || r.includes("Evite") || r.includes("risco")
    );
    expect(hasRiskRec).toBe(true);
  });

  it("geneticDiversity cresce com mais mutações", () => {
    const r1 = calculateColorCross({ male: male(), female: female() });
    const r3 = calculateColorCross({
      male: male({ agata: "Z+Z-", pastel: "Nm", onix: "Nm" }),
      female: female({ agata: "Z-W", pastel: "Nm", onix: "Nm" }),
    });
    // 0 mutations → low; 3 mutations → high
    expect(r1.phenotypeSummary.geneticDiversity).toBe("low");
    expect(r3.phenotypeSummary.geneticDiversity).toBe("high");
  });
});

// ─── calculateLipochromeCross ─────────────────────────────────────────────────

describe("calculateLipochromeCross", () => {
  it("vermelho × amarelo → aviso de cruzamento", () => {
    const result = calculateLipochromeCross(
      { base: "vermelho", featherType: "intenso" },
      { base: "amarelo",  featherType: "nevado" }
    );
    expect(result.warnings.some((w) => w.includes("vermelho") || w.includes("amarelo"))).toBe(true);
  });

  it("nevado × nevado → warning de double buffing", () => {
    const result = calculateLipochromeCross(
      { base: "amarelo", featherType: "nevado" },
      { base: "amarelo", featherType: "nevado" }
    );
    expect(result.warnings.some((w) => w.toLowerCase().includes("nevado") || w.toLowerCase().includes("buffing"))).toBe(true);
  });

  it("branco dominante × branco dominante → warning de homozigoto letal", () => {
    const result = calculateLipochromeCross(
      { base: "branco_dominante" },
      { base: "branco_dominante" }
    );
    expect(result.warnings.some((w) => w.toLowerCase().includes("branco dominante") || w.includes("25%"))).toBe(true);
    const lethalGroup = result.expected.find((e) => e.phenotype.includes("inviável") || e.phenotype.includes("Homozigoto"));
    expect(lethalGroup).toBeDefined();
    expect(lethalGroup?.probability).toBeCloseTo(0.25, 5);
  });

  it("marfim present → aviso sobre herança ligada ao sexo", () => {
    const result = calculateLipochromeCross(
      { base: "amarelo", ivoryStatus: "portador" },
      { base: "amarelo" }
    );
    expect(result.warnings.some((w) => w.toLowerCase().includes("marfim"))).toBe(true);
  });

  it("intenso × nevado sem marfim → sem warnings críticos", () => {
    const result = calculateLipochromeCross(
      { base: "amarelo", featherType: "intenso" },
      { base: "amarelo", featherType: "nevado" }
    );
    const criticalWarnings = result.warnings.filter((w) => w.includes("⚠️") || w.includes("LETAL"));
    expect(criticalWarnings.length).toBe(0);
  });
});

// ─── Invariantes matemáticos ──────────────────────────────────────────────────

describe("invariantes matemáticos — probabilidades sempre somam 1.0", () => {
  const sexLinkedCombos = [
    { m: "Z+Z+", f: "Z+W" }, { m: "Z+Z+", f: "Z-W" },
    { m: "Z+Z-", f: "Z+W" }, { m: "Z+Z-", f: "Z-W" },
    { m: "Z-Z-", f: "Z+W" }, { m: "Z-Z-", f: "Z-W" },
  ];

  for (const combo of sexLinkedCombos) {
    it(`SL ${combo.m} × ${combo.f}: sons+daughters juntos somam 1.0`, () => {
      const result = calculateColorCross({
        male: male({ agata: combo.m as any }),
        female: female({ agata: combo.f as any }),
      });
      const agata = result.byMutation["agata"];
      const sT = Object.values(agata.sons ?? {}).reduce((a, b) => a + b, 0);
      const dT = Object.values(agata.daughters ?? {}).reduce((a, b) => a + b, 0);
      // sons representam 50% dos filhotes, daughters os outros 50%
      expect(sT + dT).toBeCloseTo(1.0, 4);
      // cada grupo internamente deve somar 0.5
      expect(sT).toBeCloseTo(0.5, 4);
      expect(dT).toBeCloseTo(0.5, 4);
    });
  }

  const arCombos = [
    { m: "NN", f: "NN" }, { m: "NN", f: "Nm" }, { m: "NN", f: "mm" },
    { m: "Nm", f: "Nm" }, { m: "Nm", f: "mm" }, { m: "mm", f: "mm" },
  ];
  for (const combo of arCombos) {
    it(`AR ${combo.m} × ${combo.f}: offspring soma 1.0`, () => {
      const result = calculateColorCross({
        male: male({ pastel: combo.m as any }),
        female: female({ pastel: combo.f as any }),
      });
      const total = Object.values(result.byMutation["pastel"].offspring ?? {}).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1.0, 4);
    });
  }

  const adCombos = [
    { m: "nn", f: "nn" }, { m: "nn", f: "Nn" }, { m: "Nn", f: "Nn" },
    { m: "Nn", f: "NN" }, { m: "NN", f: "NN" },
  ];
  for (const combo of adCombos) {
    it(`AD ${combo.m} × ${combo.f}: offspring soma 1.0`, () => {
      const result = calculateColorCross({
        male: male({ crista: combo.m as any }),
        female: female({ crista: combo.f as any }),
      });
      const total = Object.values(result.byMutation["crista"].offspring ?? {}).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1.0, 4);
    });
  }
});
