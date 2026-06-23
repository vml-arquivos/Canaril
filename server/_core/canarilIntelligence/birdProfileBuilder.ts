/**
 * birdProfileBuilder.ts — Construção de perfil genético sem IA externa
 *
 * Fontes de inferência (prioridade decrescente):
 * 1. manualOverride
 * 2. Genótipo avançado salvo
 * 3. Classe oficial
 * 4. Dados legados (color_code, specialty_code)
 */
import { getMutation, isLethalCrossing, MutationRecord } from "./geneticKnowledge";
import { getLipohromeByCode } from "./colorKnowledge";
import { analyzeBirdGaps, BirdGapInput } from "./dataGapAnalyzer";

export interface BirdProfileInput {
  birdId: number;
  speciesCode: string;
  modality?: string | null;
  breedCode?: string | null;
  officialClassCode?: string | null;
  officialClassInterpreted?: {
    lipochromeBase?: string;
    melaninSeries?: string;
    featherCategory?: string;
    hasCrest?: boolean;
    crestType?: string;
    dominantWhiteStatus?: string;
  } | null;
  sex: string;
  legacyColorCode?: string | null;
  legacySpecialtyCode?: string | null;
  savedGenotype?: {
    backgroundColor?: string | null;
    featherType?: string | null;
    hasCrest?: boolean;
    mutations?: Array<{ mutation: string; inheritance: string; zygosity: string }>;
  } | null;
  savedProfile?: {
    lipochromeBase?: string | null;
    melaninSeries?: string | null;
    featherCategory?: string | null;
    manualOverride?: boolean;
    dominantWhiteStatus?: string | null;
  } | null;
  gapInput?: BirdGapInput | null;
}

export interface BirdProfileOutput {
  source: "manual_override" | "saved_genotype" | "official_class" | "legacy" | "unknown";
  phenotypeSummary: string;
  lipochromeBase: string | null;
  melaninSeries: string | null;
  featherCategory: string | null;
  hasCrest: boolean;
  dominantWhiteRisk: boolean;
  confirmedMutations: string[];
  inferredMutations: string[];
  possibleMutations: string[];
  unknownFields: string[];
  warnings: string[];
  recommendations: string[];
  confidenceScore: number; // 0-100
  explanation: string;
  gaps: ReturnType<typeof analyzeBirdGaps>;
}

export function buildBirdProfile(input: BirdProfileInput): BirdProfileOutput {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  const confirmedMutations: string[] = [];
  const inferredMutations: string[] = [];
  const possibleMutations: string[] = [];
  const unknownFields: string[] = [];

  let source: BirdProfileOutput["source"] = "unknown";
  let lipochromeBase: string | null = null;
  let melaninSeries: string | null = null;
  let featherCategory: string | null = null;
  let hasCrest = false;
  let confidenceScore = 0;

  // ─── 1. manualOverride ───────────────────────────────────────────────────
  if (input.savedProfile?.manualOverride) {
    source = "manual_override";
    lipochromeBase = input.savedProfile.lipochromeBase ?? null;
    melaninSeries = input.savedProfile.melaninSeries ?? null;
    featherCategory = input.savedProfile.featherCategory ?? null;
    confidenceScore = 95;
    recommendations.push("Perfil com override manual. Dados protegidos contra sobrescrita automática.");
  }

  // ─── 2. Genótipo avançado salvo ──────────────────────────────────────────
  else if (input.savedGenotype && (input.savedGenotype.backgroundColor || input.savedGenotype.featherType || input.savedGenotype.hasCrest || input.savedGenotype.mutations?.length)) {
    source = "saved_genotype";
    lipochromeBase = input.savedGenotype.backgroundColor ?? null;
    featherCategory = input.savedGenotype.featherType ?? null;
    hasCrest = input.savedGenotype.hasCrest ?? false;
    confidenceScore = 80;

    const muts = input.savedGenotype.mutations ?? [];
    for (const m of muts) {
      if (m.zygosity === "homozygous_mutant" || m.zygosity === "hemizygous_female_mutant") confirmedMutations.push(m.mutation);
      else if (m.zygosity === "heterozygous_carrier") confirmedMutations.push(m.mutation);
    }
  }

  // ─── 3. Classe oficial interpretada ─────────────────────────────────────
  else if (input.officialClassInterpreted) {
    source = "official_class";
    lipochromeBase = input.officialClassInterpreted.lipochromeBase ?? null;
    melaninSeries = input.officialClassInterpreted.melaninSeries ?? null;
    featherCategory = input.officialClassInterpreted.featherCategory ?? null;
    hasCrest = input.officialClassInterpreted.hasCrest ?? false;
    confidenceScore = 70;

    if (input.officialClassInterpreted.dominantWhiteStatus === "visual") {
      inferredMutations.push("branco_dominante");
    }
  }

  // ─── 4. Dados legados ────────────────────────────────────────────────────
  else if (input.legacyColorCode || input.legacySpecialtyCode) {
    source = "legacy";
    lipochromeBase = input.legacyColorCode ?? null;
    confidenceScore = 30;
    unknownFields.push("melaninSeries", "featherCategory", "mutations");
    recommendations.push("Dados inferidos de campos legados. Preencha o Genótipo Avançado para aumentar a precisão.");
  }

  // ─── Análise de riscos ───────────────────────────────────────────────────
  const dominantWhiteRisk = confirmedMutations.includes("branco_dominante") || inferredMutations.includes("branco_dominante");
  if (dominantWhiteRisk) {
    warnings.push("Este pássaro tem branco dominante. Nunca cruzar com outro portador de branco dominante.");
  }
  if (hasCrest) {
    warnings.push("Este pássaro tem crista. Nunca cruzar com outro pássaro de crista. Sempre cruzar com liso.");
  }

  // ─── Verificar sexo vs genes ligados ao sexo ────────────────────────────
  if (input.sex === "fêmea") {
    const allMutCodes = [...confirmedMutations, ...inferredMutations];
    for (const mutCode of allMutCodes) {
      const mut = getMutation(mutCode);
      if (mut && !mut.allowsCarrierFemale && mut.inheritanceType === "SEX_LINKED_RECESSIVE") {
        // Fêmea: ou é visual ou é normal
        recommendations.push(`"${mutCode}" é ligado ao sexo. Fêmea não é portadora silenciosa — apenas manifesta ou normal.`);
      }
    }
  }

  // ─── Pigmentação para fator vermelho ────────────────────────────────────
  const lipochrome = getLipohromeByCode(lipochromeBase ?? "");
  if (lipochrome?.requiresPigmentation) {
    recommendations.push("Fator vermelho: aplique protocolo de pigmentação na alimentação para expressão máxima da cor.");
  }

  // ─── Campos desconhecidos ────────────────────────────────────────────────
  if (!lipochromeBase) unknownFields.push("lipochromeBase");
  if (!melaninSeries && input.modality === "COR") unknownFields.push("melaninSeries");
  if (!featherCategory && input.modality === "COR") unknownFields.push("featherCategory");

  // ─── Lacunas de dados ────────────────────────────────────────────────────
  const gaps = input.gapInput ? analyzeBirdGaps(input.gapInput) : [];

  // ─── Phenotype summary ───────────────────────────────────────────────────
  const parts: string[] = [];
  if (lipochromeBase) parts.push(lipochromeBase);
  if (melaninSeries) parts.push(melaninSeries);
  if (featherCategory) parts.push(featherCategory);
  if (hasCrest) parts.push("com crista");
  if (confirmedMutations.length > 0) parts.push(confirmedMutations.join(", "));
  const phenotypeSummary = parts.length > 0 ? parts.join(" · ") : "Fenótipo desconhecido";

  // ─── Explanation ─────────────────────────────────────────────────────────
  const sourceLabels: Record<BirdProfileOutput["source"], string> = {
    manual_override: "override manual do criador",
    saved_genotype: "genótipo avançado cadastrado",
    official_class: "classe oficial FOB/OBJO",
    legacy: "dados legados de cor/especialidade",
    unknown: "dados insuficientes",
  };
  const explanation = `Perfil construído a partir de ${sourceLabels[source]}. Confiança: ${confidenceScore}%.${unknownFields.length > 0 ? ` Campos desconhecidos: ${unknownFields.join(", ")}.` : ""}`;

  return {
    source,
    phenotypeSummary,
    lipochromeBase,
    melaninSeries,
    featherCategory,
    hasCrest,
    dominantWhiteRisk,
    confirmedMutations,
    inferredMutations,
    possibleMutations,
    unknownFields,
    warnings,
    recommendations,
    confidenceScore,
    explanation,
    gaps,
  };
}
