/**
 * plantelOptimizer.ts — Otimizador de Pareamento do Plantel Inteiro
 * ============================================================================
 * Responde: "dado o objetivo da temporada, qual é o MELHOR CONJUNTO de
 * casais simultâneos pra formar com o plantel inteiro?" — diferente de
 * pairingOptimizer.ts (server/_core), que sugere parceiros um de cada vez
 * pra UM pássaro específico.
 *
 * 100% aditivo — reaproveita scorePair (pairingOptimizer.ts, já testado)
 * pra pontuar CADA combinação possível macho×fêmea; a única lógica nova
 * aqui é a MONTAGEM do conjunto de pares (algoritmo de atribuição).
 *
 * Algoritmo: guloso (greedy) por maior pontuação — ordena todas as
 * combinações da melhor pra pior e vai atribuindo, pulando qualquer
 * pássaro que já foi usado. É uma APROXIMAÇÃO, não o ótimo matemático
 * garantido (que exigiria o algoritmo húngaro, bem mais caro e arriscado
 * de implementar corretamente sob pressão de tempo) — documentado assim
 * de propósito, sem inflar a precisão real do resultado.
 * ============================================================================
 */
import { scorePair, ScorePairInput, ScorePairResult, SimpleBird, Objective, HealthFlags, ReproductiveHistory } from "./pairingOptimizer";
import { BirdGenotypeInput } from "./mendelian";

export interface PlantelBirdInput {
  bird: SimpleBird;
  genotype: BirdGenotypeInput | null;
  healthFlags?: HealthFlags;
  reproductiveHistory?: ReproductiveHistory | null;
  bestShowScore?: number | null;
}

export interface PlantelOptimizationInput {
  males: PlantelBirdInput[];
  females: PlantelBirdInput[];
  /** Função fornecida pelo chamador (normalmente calculateCOIForPair sobre o pedigree real). */
  coiLookup: (maleId: number, femaleId: number) => number;
  objective: Objective;
  maxCoi?: number;
}

export interface PlantelPairAssignment {
  male: SimpleBird;
  female: SimpleBird;
  score: ScorePairResult;
}

export interface PlantelOptimizationResult {
  assignedPairs: PlantelPairAssignment[];
  unmatchedMales: SimpleBird[];
  unmatchedFemales: SimpleBird[];
  totalPairsConsidered: number;
  averageScore: number;
  skippedBlocked: number; // pares que existiam mas foram descartados por trava absoluta (NAO_RECOMENDADO)
}

export function optimizePlantelPairing(input: PlantelOptimizationInput): PlantelOptimizationResult {
  const { males, females, coiLookup, objective, maxCoi } = input;

  // Pontua TODAS as combinações possíveis macho×fêmea uma vez.
  const allCandidates: PlantelPairAssignment[] = [];
  for (const m of males) {
    for (const f of females) {
      const coi = coiLookup(m.bird.id, f.bird.id);
      const scoreInput: ScorePairInput = {
        male: m.bird,
        female: f.bird,
        coi,
        maleGenotype: m.genotype,
        femaleGenotype: f.genotype,
        objective,
        maxCoi,
        recentHealthFlags: m.healthFlags ?? f.healthFlags,
        reproductiveHistory: m.reproductiveHistory ?? f.reproductiveHistory ?? null,
        bestShowScore: m.bestShowScore ?? f.bestShowScore ?? null,
      };
      allCandidates.push({ male: m.bird, female: f.bird, score: scorePair(scoreInput) });
    }
  }

  // Ordena do melhor pro pior — base do algoritmo guloso.
  allCandidates.sort((a, b) => b.score.finalScore - a.score.finalScore);

  const usedMales = new Set<number>();
  const usedFemales = new Set<number>();
  const assignedPairs: PlantelPairAssignment[] = [];
  let skippedBlocked = 0;

  for (const candidate of allCandidates) {
    if (usedMales.has(candidate.male.id) || usedFemales.has(candidate.female.id)) continue;
    if (candidate.score.status === "NAO_RECOMENDADO") {
      skippedBlocked++;
      continue; // nunca atribui um par com trava absoluta, mesmo que sobrem pássaros sem par
    }
    assignedPairs.push(candidate);
    usedMales.add(candidate.male.id);
    usedFemales.add(candidate.female.id);
  }

  const unmatchedMales = males.map((m) => m.bird).filter((b) => !usedMales.has(b.id));
  const unmatchedFemales = females.map((f) => f.bird).filter((b) => !usedFemales.has(b.id));
  const averageScore = assignedPairs.length > 0 ? assignedPairs.reduce((s, p) => s + p.score.finalScore, 0) / assignedPairs.length : 0;

  return {
    assignedPairs,
    unmatchedMales,
    unmatchedFemales,
    totalPairsConsidered: allCandidates.length,
    averageScore,
    skippedBlocked,
  };
}
