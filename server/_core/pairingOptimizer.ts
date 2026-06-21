/**
 * pairingOptimizer.ts — Motor de Recomendação de Pares Ideais
 * ============================================================================
 * Função PURA (sem acesso a banco) que pontua um par macho×fêmea, dados
 * todos os insumos já calculados/buscados por fora (COI, genótipos,
 * sinais de saúde/histórico). Isso permite testar a lógica de pontuação
 * inteira sem precisar de banco de dados — o mesmo padrão usado em
 * mendelian.ts.
 *
 * Reaproveita (não duplica):
 *  - predictCross (mendelian.ts) pra avisos genéticos e prole prevista
 *  - calculateCOIForPair/classifyCOIRisk (genetics.ts) pro componente de COI
 *
 * Fórmula de pontuação (0–100), conforme especificação:
 *   Genética: 35 | COI: 20 | Saúde: 15 | Nutrição: 10 | Histórico: 10 | Objetivo: 10
 *
 * Travas absolutas — força NAO_RECOMENDADO mesmo com pontuação parcial alta:
 *   mesmo sexo, pássaro inativo, branco dominante × branco dominante,
 *   topete × topete, COI acima do limite configurado.
 * ============================================================================
 */

import { predictCross, BirdGenotypeInput, CrossPrediction } from "./mendelian";

export type Objective =
  | "REDUZIR_COI"
  | "REPRODUCAO_SEGURA"
  | "MELHORAR_COR"
  | "MELHORAR_PORTE"
  | "PRODUZIR_PORTADORES"
  | "MANTER_LINHAGEM"
  | "EXPOSICAO"
  | "PLANEJAMENTO_LIVRE";

export type PairStatus = "IDEAL" | "APROVADO" | "ATENCAO" | "NAO_RECOMENDADO";

export type SimpleBird = {
  id: number;
  ring: string;
  sex: string;
  status: string;
};

export type HealthFlags = {
  hasRecentQuarantine: boolean;
  hasRecentWeightCheck: boolean;
  hasRecentDietLog: boolean;
};

export type ReproductiveHistory = {
  totalClutches: number;
  totalEggs: number;
  totalHatched: number;
};

export type ScorePairInput = {
  male: SimpleBird;
  female: SimpleBird;
  coi: number;
  maleGenotype: BirdGenotypeInput | null;
  femaleGenotype: BirdGenotypeInput | null;
  objective: Objective;
  maxCoi?: number; // default 0.125 (12.5% — limiar "alto" já usado no resto do sistema)
  recentHealthFlags?: HealthFlags;
  reproductiveHistory?: ReproductiveHistory | null;
  bestShowScore?: number | null; // 0–100, melhor nota de exposição entre os dois pais
};

export type ScorePairResult = {
  finalScore: number;
  status: PairStatus;
  geneticScore: number;
  coiScore: number;
  healthScore: number;
  nutritionScore: number;
  historyScore: number;
  objectiveScore: number;
  warnings: string[];
  reasons: string[];
  missingData: string[];
  absoluteBlock: string | null;
  predictedOffspring: CrossPrediction | null;
  recommendationText: string;
};

const DEFAULT_MAX_COI = 0.125;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Componente genético (0–35). Usa o motor de Punnett de verdade quando os
 * dois pais têm Genótipo Avançado; senão, dá uma pontuação neutra baixa e
 * sinaliza dado incompleto — nunca finge precisão que não existe.
 */
function scoreGenetics(
  maleGenotype: BirdGenotypeInput | null,
  femaleGenotype: BirdGenotypeInput | null,
  warnings: string[],
  reasons: string[],
  missingData: string[]
): { score: number; predictedOffspring: CrossPrediction | null } {
  if (!maleGenotype && !femaleGenotype) {
    missingData.push("Nenhum dos dois tem Genótipo Avançado cadastrado — pontuação genética é uma estimativa neutra.");
    return { score: 15, predictedOffspring: null };
  }
  if (!maleGenotype || !femaleGenotype) {
    missingData.push(`${!maleGenotype ? "Macho" : "Fêmea"} não tem Genótipo Avançado cadastrado — pontuação genética parcial.`);
    return { score: 20, predictedOffspring: null };
  }

  const prediction = predictCross(maleGenotype, femaleGenotype);
  let score = 35;

  for (const w of prediction.warnings) {
    if (w.type === "crista" || w.type === "branco_dominante") {
      score -= 25; // já vira trava absoluta separadamente, mas reduz a nota mesmo assim
      warnings.push(w.message);
    } else {
      score -= 8; // ex.: double_buffing
      warnings.push(w.message);
    }
  }

  if (maleGenotype.featherType && femaleGenotype.featherType && maleGenotype.featherType !== femaleGenotype.featherType) {
    score += 3;
    reasons.push("Plumagem complementar (intenso × nevado) — reduz risco de excesso de pena nos filhotes.");
  }

  if (prediction.mutations.length > 0) {
    reasons.push(`${prediction.mutations.length} traço(s) genético(s) em comum calculados via Punnett para a prole.`);
  }

  return { score: clamp(score, 0, 35), predictedOffspring: prediction };
}

/** Componente de COI/pedigree (0–20) — quanto menor o COI, maior a nota. */
function scoreCOI(coi: number, reasons: string[], warnings: string[]): number {
  const score = clamp(Math.round(20 * (1 - coi / 0.25)), 0, 20);
  if (coi === 0) reasons.push("Nenhum parentesco detectado entre os dois no pedigree calculado.");
  else if (coi < 0.0625) reasons.push(`Consanguinidade baixa (${(coi * 100).toFixed(1)}%).`);
  else if (coi < 0.125) warnings.push(`Consanguinidade moderada (${(coi * 100).toFixed(1)}%) — acompanhe.`);
  else warnings.push(`Consanguinidade alta (${(coi * 100).toFixed(1)}%).`);
  return score;
}

/** Componente de saúde (0–15) — sinal aproximado, não é diagnóstico. */
function scoreHealth(flags: HealthFlags | undefined, warnings: string[], missingData: string[]): number {
  if (!flags) {
    missingData.push("Sem registros de saúde recentes para nenhum dos dois — pontuação de saúde é neutra.");
    return 12;
  }
  let score = 12;
  if (flags.hasRecentWeightCheck) score += 3;
  if (flags.hasRecentQuarantine) {
    score -= 8;
    warnings.push("Houve quarentena recente registrada em um dos dois — confirme recuperação antes de cruzar.");
  }
  return clamp(score, 0, 15);
}

/** Componente de nutrição/fase reprodutiva (0–10). */
function scoreNutrition(flags: HealthFlags | undefined, missingData: string[]): number {
  if (!flags) {
    missingData.push("Sem registro de dieta recente — pontuação de nutrição é neutra.");
    return 7;
  }
  return clamp(flags.hasRecentDietLog ? 10 : 7, 0, 10);
}

/** Componente de histórico reprodutivo (0–10) — não penaliza casais novos. */
function scoreHistory(history: ReproductiveHistory | null | undefined, missingData: string[]): number {
  if (!history || history.totalEggs === 0) {
    missingData.push("Sem histórico reprodutivo ainda — pontuação neutra (não penaliza pássaros jovens).");
    return 6;
  }
  const hatchRate = history.totalHatched / history.totalEggs;
  return clamp(Math.round(hatchRate * 10), 0, 10);
}

/** Componente específico do objetivo escolhido (0–10). */
function scoreObjective(
  input: ScorePairInput,
  coi: number,
  warnings: string[],
  predictedOffspring: CrossPrediction | null,
  reasons: string[],
  missingData: string[]
): number {
  switch (input.objective) {
    case "REDUZIR_COI":
      return clamp(Math.round(10 * (1 - coi / 0.25)), 0, 10);

    case "REPRODUCAO_SEGURA":
      return clamp(10 - warnings.length * 4, 0, 10);

    case "PRODUZIR_PORTADORES": {
      if (!predictedOffspring || predictedOffspring.mutations.length === 0) {
        missingData.push("Sem mutações em comum calculáveis para avaliar produção de portadores.");
        return 3;
      }
      const hasCarrierChance = predictedOffspring.mutations.some((m) => {
        const dist = m.overall ?? { ...m.sons, ...m.daughters };
        return (dist.heterozygous_carrier ?? 0) > 0;
      });
      if (hasCarrierChance) reasons.push("Boa chance de produzir filhotes portadores das mutações em comum.");
      return hasCarrierChance ? 10 : 5;

    }

    case "EXPOSICAO":
      if (input.bestShowScore == null) {
        missingData.push("Nenhum dos dois tem histórico de pontuação em campeonato ainda.");
        return 5;
      }
      reasons.push(`Melhor nota de campeonato entre os dois: ${input.bestShowScore}.`);
      return clamp(Math.round(input.bestShowScore / 10), 0, 10);

    case "MELHORAR_COR":
    case "MELHORAR_PORTE":
    case "MANTER_LINHAGEM":
    case "PLANEJAMENTO_LIVRE":
    default:
      reasons.push("Objetivo geral — sem peso específico adicional além da genética, COI, saúde e histórico já considerados.");
      return 7;
  }
}

export function scorePair(input: ScorePairInput): ScorePairResult {
  const warnings: string[] = [];
  const reasons: string[] = [];
  const missingData: string[] = [];
  const maxCoi = input.maxCoi ?? DEFAULT_MAX_COI;

  // ----- Travas absolutas -----
  let absoluteBlock: string | null = null;
  if (input.male.sex === input.female.sex) {
    absoluteBlock = "Mesmo sexo — cruzamento biologicamente impossível.";
  } else if (input.male.status !== "active" || input.female.status !== "active") {
    absoluteBlock = "Um dos dois pássaros não está com status ativo no plantel.";
  } else if (input.coi >= maxCoi) {
    absoluteBlock = `Consanguinidade (${(input.coi * 100).toFixed(1)}%) acima do limite configurado (${(maxCoi * 100).toFixed(1)}%).`;
  }

  const { score: geneticScore, predictedOffspring } = scoreGenetics(input.maleGenotype, input.femaleGenotype, warnings, reasons, missingData);

  if (!absoluteBlock && predictedOffspring) {
    const fatalWarning = predictedOffspring.warnings.find((w) => w.type === "crista" || w.type === "branco_dominante");
    if (fatalWarning) {
      absoluteBlock = fatalWarning.type === "crista"
        ? "Os dois têm crista — risco de ~25% de embriões não viáveis (homozigose letal)."
        : "Os dois carregam Branco Dominante — risco de ~25% de embriões não viáveis (homozigose letal).";
    }
  }

  const coiScore = scoreCOI(input.coi, reasons, warnings);
  const healthScore = scoreHealth(input.recentHealthFlags, warnings, missingData);
  const nutritionScore = scoreNutrition(input.recentHealthFlags, missingData);
  const historyScore = scoreHistory(input.reproductiveHistory, missingData);
  const objectiveScore = scoreObjective(input, input.coi, warnings, predictedOffspring, reasons, missingData);

  const finalScore = clamp(geneticScore + coiScore + healthScore + nutritionScore + historyScore + objectiveScore, 0, 100);

  let status: PairStatus;
  if (absoluteBlock) status = "NAO_RECOMENDADO";
  else if (finalScore >= 90) status = "IDEAL";
  else if (finalScore >= 75) status = "APROVADO";
  else if (finalScore >= 50) status = "ATENCAO";
  else status = "NAO_RECOMENDADO";

  const recommendationText = absoluteBlock
    ? `Não recomendado: ${absoluteBlock}`
    : status === "IDEAL"
    ? `Par ideal — ${reasons.slice(0, 2).join(" ") || "boa combinação genética e baixo risco."}`
    : status === "APROVADO"
    ? `Aprovado — boa combinação, com pontos de atenção: ${warnings.slice(0, 1).join(" ") || "nenhum alerta relevante."}`
    : status === "ATENCAO"
    ? `Use com atenção — ${warnings.slice(0, 2).join(" ") || "dados incompletos reduzem a confiança da recomendação."}`
    : `Não recomendado — pontuação final baixa (${finalScore}/100).`;

  return {
    finalScore,
    status,
    geneticScore,
    coiScore,
    healthScore,
    nutritionScore,
    historyScore,
    objectiveScore,
    warnings,
    reasons,
    missingData,
    absoluteBlock,
    predictedOffspring,
    recommendationText,
  };
}
