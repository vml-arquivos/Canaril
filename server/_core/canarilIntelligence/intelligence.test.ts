/**
 * intelligence.test.ts — Testes do Canaril Intelligence Core (Missão 5)
 */
import { describe, it, expect } from "vitest";
import { getActiveSpecies, getSpecies } from "./speciesKnowledge";
import { getBreedsForSpecies, getBreed, getBreedsForModality } from "./breedKnowledge";
import { getMutationsForSpecies, getMutation, getValidZygosities, canFemaleBeCarrier, isLethalCrossing } from "./geneticKnowledge";
import { explainTerm, getAllTerms } from "./knowledgeExplainer";
import { computeFieldApplicability } from "./fieldApplicability";
import { analyzeBirdGaps, gapSummary } from "./dataGapAnalyzer";
import { buildBirdProfile } from "./birdProfileBuilder";
import { advisePairing } from "./pairingAdvisor";

const BASE_GAP_INPUT = {
  fatherId: 1, motherId: 2, officialClassId: 3, hasGenotype: true, hasProfile: true,
  birthDate: new Date(), sex: "macho", hasPhoto: true, modality: "COR", breedName: "Canário de Cor", colorCode: "amarelo",
};

// ─── Species ───────────────────────────────────────────────────────────────────

describe("speciesKnowledge", () => {
  it("carrega espécie canário", () => {
    const s = getSpecies("canario");
    expect(s).toBeDefined();
    expect(s!.commonName).toContain("Canário");
  });

  it("getActiveSpecies retorna lista não vazia", () => {
    expect(getActiveSpecies().length).toBeGreaterThan(0);
  });

  it("sistema ZZ_ZW para canário", () => {
    const s = getSpecies("canario");
    expect(s?.defaultSexSystem).toBe("ZZ_ZW");
  });
});

// ─── Breeds ─────────────────────────────────────────────────────────────────

describe("breedKnowledge", () => {
  it("carrega raças de canário", () => {
    const breeds = getBreedsForSpecies("canario");
    expect(breeds.length).toBeGreaterThan(10);
  });

  it("Gloster Corona tem hasCrest = true", () => {
    const gloster = getBreed("gloster_corona");
    expect(gloster?.hasCrest).toBe(true);
  });

  it("Gloster Consort tem hasCrest = false", () => {
    const consort = getBreed("gloster_consort");
    expect(consort?.hasCrest).toBe(false);
  });

  it("Yorkshire é modalidade PORTE", () => {
    const york = getBreed("yorkshire");
    expect(york?.modality).toBe("PORTE");
  });

  it("getBreedsForModality filtra por COR", () => {
    const cor = getBreedsForModality("canario", "COR");
    expect(cor.every((b) => b.modality === "COR")).toBe(true);
  });

  it("Padovano tem crista", () => {
    const pad = getBreed("padovano");
    expect(pad?.hasCrest).toBe(true);
  });
});

// ─── Mutations ───────────────────────────────────────────────────────────────

describe("geneticKnowledge — mutações", () => {
  it("carrega mutações para canário", () => {
    const muts = getMutationsForSpecies("canario");
    expect(muts.length).toBeGreaterThan(8);
  });

  it("branco dominante é AUTOSOMAL_DOMINANT", () => {
    const bd = getMutation("branco_dominante");
    expect(bd?.inheritanceType).toBe("AUTOSOMAL_DOMINANT");
  });

  it("branco dominante não permite portador", () => {
    const bd = getMutation("branco_dominante");
    expect(bd?.allowsCarrierMale).toBe(false);
    expect(bd?.allowsCarrierFemale).toBe(false);
  });

  it("branco dominante tem fator letal duplo", () => {
    const bd = getMutation("branco_dominante");
    expect(bd?.hasLethalDoubleFactor).toBe(true);
  });

  it("crista tem fator letal duplo", () => {
    const crista = getMutation("crista");
    expect(crista?.hasLethalDoubleFactor).toBe(true);
  });

  it("marfim é SEX_LINKED_RECESSIVE", () => {
    const marfim = getMutation("marfim");
    expect(marfim?.inheritanceType).toBe("SEX_LINKED_RECESSIVE");
  });

  it("marfim — macho pode ser portador, fêmea não", () => {
    expect(canFemaleBeCarrier("marfim")).toBe(false);
    const marfim = getMutation("marfim");
    expect(marfim?.allowsCarrierMale).toBe(true);
  });

  it("ágata — fêmea não pode ser portadora silenciosa", () => {
    expect(canFemaleBeCarrier("agata")).toBe(false);
  });

  it("pastel — ambos os sexos podem ser portadores (autossômico)", () => {
    const pastel = getMutation("pastel");
    expect(pastel?.allowsCarrierMale).toBe(true);
    expect(pastel?.allowsCarrierFemale).toBe(true);
  });
});

// ─── Zigosidades válidas ──────────────────────────────────────────────────────

describe("getValidZygosities", () => {
  it("fêmea com gene ligado ao sexo não tem opção portadora", () => {
    const zigs = getValidZygosities("marfim", "fêmea");
    expect(zigs).not.toContain("heterozygous_carrier");
  });

  it("macho com gene ligado ao sexo pode ser portador", () => {
    const zigs = getValidZygosities("marfim", "macho");
    expect(zigs).toContain("heterozygous_carrier");
  });

  it("branco dominante não oferece portador (dominante)", () => {
    const zigs = getValidZygosities("branco_dominante", "macho");
    expect(zigs).not.toContain("heterozygous_carrier_silent");
  });
});

// ─── Cruzamentos letais ───────────────────────────────────────────────────────

describe("isLethalCrossing", () => {
  it("branco_dominante × branco_dominante = alerta letal", () => {
    const maleMuts = [{ mutation: "branco_dominante", zygosity: "heterozygous_carrier" }];
    const femaleMuts = [{ mutation: "branco_dominante", zygosity: "heterozygous_carrier" }];
    const alerts = isLethalCrossing("male", "female", maleMuts, femaleMuts);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].warning).toContain("RISCO LETAL");
  });

  it("branco_dominante macho × normal fêmea = sem alerta", () => {
    const maleMuts = [{ mutation: "branco_dominante", zygosity: "heterozygous_carrier" }];
    const femaleMuts: any[] = [];
    const alerts = isLethalCrossing("male", "female", maleMuts, femaleMuts);
    expect(alerts.length).toBe(0);
  });

  it("crista macho × sem crista fêmea = sem alerta letal", () => {
    const maleMuts = [{ mutation: "crista", zygosity: "heterozygous_carrier" }];
    const femaleMuts: any[] = [];
    const alerts = isLethalCrossing("male", "female", maleMuts, femaleMuts);
    expect(alerts.length).toBe(0);
  });
});

// ─── Field Applicability ──────────────────────────────────────────────────────

describe("fieldApplicability", () => {
  it("Gloster Corona: showCrest = true", () => {
    const result = computeFieldApplicability({ speciesCode: "canario", breedCode: "gloster_corona", sex: "macho", hasCrest: true });
    expect(result.showCrest).toBe(true);
  });

  it("canário de cor genérico: showMosaicSex = true", () => {
    const result = computeFieldApplicability({ speciesCode: "canario", modality: "COR" });
    expect(result.showMosaicSex).toBe(true);
  });

  it("fêmea com marfim marcado como portadora gera aviso", () => {
    const result = computeFieldApplicability({
      speciesCode: "canario",
      sex: "fêmea",
      knownMutations: [{ mutation: "marfim", zygosity: "heterozygous_carrier" }],
    });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("marfim");
  });
});

// ─── Data Gap Analyzer ────────────────────────────────────────────────────────

describe("dataGapAnalyzer", () => {
  it("pássaro completo tem 0 lacunas", () => {
    const gaps = analyzeBirdGaps(BASE_GAP_INPUT);
    expect(gaps.length).toBe(0);
  });

  it("sem pai/mãe tem 2 lacunas high", () => {
    const gaps = analyzeBirdGaps({ ...BASE_GAP_INPUT, fatherId: null, motherId: null });
    expect(gaps.filter((g) => g.field === "fatherId" || g.field === "motherId")).toHaveLength(2);
  });

  it("sexo indeterminado tem lacuna crítica", () => {
    const gaps = analyzeBirdGaps({ ...BASE_GAP_INPUT, sex: "indeterminado" });
    expect(gaps.some((g) => g.severity === "critical")).toBe(true);
  });

  it("gapSummary calcula completenessScore", () => {
    const gaps = analyzeBirdGaps({ ...BASE_GAP_INPUT, fatherId: null, motherId: null });
    const summary = gapSummary(gaps);
    expect(summary.completenessScore).toBeLessThan(100);
    expect(summary.high).toBe(2);
  });
});

// ─── birdProfileBuilder ───────────────────────────────────────────────────────

describe("birdProfileBuilder", () => {
  it("constrói perfil por classe oficial", () => {
    const profile = buildBirdProfile({
      birdId: 1,
      speciesCode: "canario",
      sex: "macho",
      officialClassInterpreted: { lipochromeBase: "amarelo", featherCategory: "intenso" },
    });
    expect(profile.source).toBe("official_class");
    expect(profile.lipochromeBase).toBe("amarelo");
  });

  it("respeita manualOverride", () => {
    const profile = buildBirdProfile({
      birdId: 1,
      speciesCode: "canario",
      sex: "macho",
      savedProfile: { lipochromeBase: "vermelho", melaninSeries: null, featherCategory: "nevado", manualOverride: true, dominantWhiteStatus: null },
    });
    expect(profile.source).toBe("manual_override");
    expect(profile.lipochromeBase).toBe("vermelho");
    expect(profile.confidenceScore).toBeGreaterThanOrEqual(90);
  });

  it("branco dominante gera aviso", () => {
    const profile = buildBirdProfile({
      birdId: 1,
      speciesCode: "canario",
      sex: "macho",
      savedGenotype: { backgroundColor: "branco", featherType: "intenso", hasCrest: false, mutations: [{ mutation: "branco_dominante", inheritance: "AUTOSOMAL_DOMINANT", zygosity: "heterozygous_carrier" }] },
    });
    expect(profile.dominantWhiteRisk).toBe(true);
    expect(profile.warnings.some((w) => w.includes("branco dominante"))).toBe(true);
  });

  it("crista gera aviso", () => {
    const profile = buildBirdProfile({
      birdId: 1,
      speciesCode: "canario",
      sex: "macho",
      savedGenotype: { hasCrest: true },
    });
    expect(profile.hasCrest).toBe(true);
    expect(profile.warnings.some((w) => w.includes("crista"))).toBe(true);
  });
});

// ─── knowledgeExplainer ───────────────────────────────────────────────────────

describe("knowledgeExplainer", () => {
  it("explica COI", () => {
    const e = explainTerm("coi");
    expect(e).toBeDefined();
    expect(e!.simpleExplanation).toBeTruthy();
  });

  it("explica lipocromo", () => {
    const e = explainTerm("lipocromo");
    expect(e).toBeDefined();
    expect(e!.technicalExplanation).toBeTruthy();
  });

  it("explica branco dominante", () => {
    const e = explainTerm("branco_dominante");
    expect(e).toBeDefined();
    expect(e!.warnings).toContain("RISCO LETAL");
  });

  it("getAllTerms retorna lista não vazia", () => {
    expect(getAllTerms().length).toBeGreaterThan(10);
  });
});

// ─── pairingAdvisor ───────────────────────────────────────────────────────────

describe("pairingAdvisor", () => {
  it("casal sem parentesco e sem riscos é ideal ou aprovado", () => {
    const result = advisePairing({
      maleBirdId: 1, femaleBirdId: 2,
      maleRing: "B001", femaleRing: "B002",
      coi: 0,
      maleMutations: [], femaleMutations: [],
      maleHasCrest: false, femaleHasCrest: false,
      maleHasData: true, femaleHasData: true,
    });
    expect(["ideal", "approved"]).toContain(result.status);
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it("crista × crista gera not_recommended", () => {
    const result = advisePairing({
      maleBirdId: 1, femaleBirdId: 2,
      maleRing: "B001", femaleRing: "B002",
      coi: 0.02,
      maleMutations: [], femaleMutations: [],
      maleHasCrest: true, femaleHasCrest: true,
      maleHasData: true, femaleHasData: true,
    });
    expect(result.status).toBe("not_recommended");
    expect(result.warnings.some((w) => w.includes("RISCO LETAL"))).toBe(true);
  });

  it("COI alto gera status caution", () => {
    const result = advisePairing({
      maleBirdId: 1, femaleBirdId: 2,
      maleRing: "B001", femaleRing: "B002",
      coi: 0.20,
      maleMutations: [], femaleMutations: [],
      maleHasCrest: false, femaleHasCrest: false,
      maleHasData: true, femaleHasData: true,
    });
    expect(result.status).toBe("caution");
  });

  it("gera explicação simples não vazia", () => {
    const result = advisePairing({
      maleBirdId: 1, femaleBirdId: 2,
      maleRing: "B001", femaleRing: "B002",
      coi: 0.05,
      maleMutations: [], femaleMutations: [],
      maleHasCrest: false, femaleHasCrest: false,
      maleHasData: false, femaleHasData: false,
    });
    expect(result.simpleExplanation.length).toBeGreaterThan(10);
    expect(result.missingData.length).toBeGreaterThan(0);
  });
});
