/**
 * populationGenetics.ts — Genética Populacional do Plantel
 * ============================================================================
 * Item novo, 100% aditivo, construído inteiramente sobre `calculateCOIForPair`
 * e `fullAncestrySet` (já existentes em genetics.ts, já testados) — nenhuma
 * dessas duas funções foi alterada.
 *
 * Enquanto o COI (genetics.ts) responde "quão aparentados são ESTES DOIS
 * pássaros", este módulo responde três perguntas em nível de PLANTEL:
 *
 *   1. Mean Kinship — para cada pássaro, o quão aparentado ele é, em média,
 *      com o resto do plantel ativo (não só com um parceiro específico).
 *      Útil para identificar quem é "genericamente raro" no plantel
 *      (mean kinship baixo — vale a pena preservar) e quem está
 *      genericamente sobrerrepresentado (mean kinship alto).
 *
 *   2. Ne (Tamanho Efetivo da População) — estimativa padrão da genética de
 *      conservação, baseada na proporção de machos/fêmeas reprodutores
 *      (fórmula de Wright, 1938: Ne = 4·Nm·Nf/(Nm+Nf)). É uma aproximação
 *      conhecida e documentada como tal — não substitui um cálculo de Ne
 *      baseado em variância de kinship entre gerações (bem mais caro
 *      computacionalmente), mas é o padrão usado por programas de
 *      conservação/criação quando não há gerações discretas suficientes
 *      para o cálculo completo.
 *
 *   3. Fundadores — pássaros sem pai/mãe registrados no sistema (a raiz de
 *      cada linhagem conhecida) e a contribuição genética esperada de cada
 *      um para o plantel atual, via soma de (1/2)^distância por caminho de
 *      ancestralidade (fórmula padrão de contribuição de fundador).
 * ============================================================================
 */
import { fullAncestrySet, calculateCOIForPair, type PedigreeBird } from "./genetics";

export interface MeanKinshipResult {
  birdId: number;
  ring: string;
  meanKinship: number; // 0–1, média do COI contra todo o resto do plantel ativo
  meanKinshipPct: string;
  comparedAgainst: number; // quantos outros pássaros entraram na média
}

export interface FounderContribution {
  founderId: number;
  ring: string;
  sex: string;
  /** Contribuição genética média esperada para o plantel ativo atual (0–1). */
  averageContribution: number;
  averageContributionPct: string;
  /** Em quantos pássaros ativos esse fundador aparece na ancestralidade. */
  descendantsInPlantel: number;
  /** Sinal de alerta: linhagem dominando demais ou sumindo. */
  flag: "dominant" | "vanishing" | null;
}

export interface PopulationGeneticsReport {
  totalActive: number;
  breedingMales: number;
  breedingFemales: number;
  /** Ne estimado pela proporção de sexos reprodutores (Wright, 1938). Aproximação documentada — ver cabeçalho do arquivo. */
  effectivePopulationSize: number;
  neStatus: "critical" | "low" | "healthy";
  neReferenceNote: string;
  meanKinshipByBird: MeanKinshipResult[];
  plantelAverageMeanKinship: number;
  founders: FounderContribution[];
}

/**
 * Mean Kinship de um pássaro contra o resto do plantel ativo. O(n) chamadas
 * a calculateCOIForPair — para plantéis muito grandes, ver nota de limite
 * de segurança no router (mesma cautela já aplicada no Mapa de
 * Consanguinidade, reports.mapaConsanguinidade).
 */
export function calculateMeanKinshipForBird(
  birdId: number,
  activeBirdIds: number[],
  birdMap: Map<number, PedigreeBird>,
  maxGenerations: number,
  cache?: Map<string, number>
): MeanKinshipResult {
  const bird = birdMap.get(birdId);
  const others = activeBirdIds.filter((id) => id !== birdId);
  if (others.length === 0) {
    return { birdId, ring: bird?.ring ?? `#${birdId}`, meanKinship: 0, meanKinshipPct: "0.00%", comparedAgainst: 0 };
  }

  let sum = 0;
  for (const otherId of others) {
    const cacheKey = birdId < otherId ? `${birdId}-${otherId}` : `${otherId}-${birdId}`;
    let coi = cache?.get(cacheKey);
    if (coi === undefined) {
      coi = calculateCOIForPair(birdId, otherId, birdMap, maxGenerations);
      cache?.set(cacheKey, coi);
    }
    sum += coi;
  }

  const mean = sum / others.length;
  return {
    birdId,
    ring: bird?.ring ?? `#${birdId}`,
    meanKinship: mean,
    meanKinshipPct: `${(mean * 100).toFixed(2)}%`,
    comparedAgainst: others.length,
  };
}

/**
 * Ne pela proporção de sexos reprodutores (Wright, 1938):
 *   Ne = 4·Nm·Nf / (Nm + Nf)
 * Referência de saúde genética adaptada à escala de um criadouro
 * hobby/comercial (a literatura acadêmica de conservação usa Ne ≥ 50 para
 * curto prazo e Ne ≥ 500 para viabilidade de longuíssimo prazo em
 * populações selvagens — aqui usamos como referência relativa, não como
 * limiar absoluto de "extinção").
 */
export function calculateEffectivePopulationSize(breedingMales: number, breedingFemales: number): number {
  if (breedingMales === 0 || breedingFemales === 0) return 0;
  return (4 * breedingMales * breedingFemales) / (breedingMales + breedingFemales);
}

export function classifyNeStatus(ne: number): { status: "critical" | "low" | "healthy"; note: string } {
  if (ne <= 0) return { status: "critical", note: "Sem machos ou fêmeas reprodutores suficientes para estimar Ne." };
  if (ne < 10) return { status: "critical", note: "Ne muito baixo — risco real de perda de variabilidade genética em poucas gerações. Priorize adquirir sangue novo sem parentesco." };
  if (ne < 30) return { status: "low", note: "Ne abaixo do recomendado para um plantel saudável a médio prazo. Avalie diversificar reprodutores." };
  return { status: "healthy", note: "Ne dentro de uma faixa saudável para o tamanho típico de um criadouro hobby/comercial." };
}

/** Identifica pássaros "fundadores": sem pai e sem mãe conhecidos no sistema. */
export function identifyFounders(birdMap: Map<number, PedigreeBird>): PedigreeBird[] {
  return Array.from(birdMap.values()).filter((b) => b.fatherId == null && b.motherId == null);
}

/**
 * Contribuição genética esperada de cada fundador para o plantel ativo
 * atual — soma de (1/2)^distância por caminho de ancestralidade até cada
 * fundador, calculada para cada pássaro ativo e depois calculada a média
 * entre os pássaros ativos (fórmula padrão de "founder contribution" em
 * genética de conservação/populações fundadoras).
 */
export function calculateFounderContributions(
  activeBirdIds: number[],
  birdMap: Map<number, PedigreeBird>,
  maxGenerations: number
): FounderContribution[] {
  const founders = identifyFounders(birdMap);
  if (founders.length === 0 || activeBirdIds.length === 0) return [];

  const founderIds = new Set(founders.map((f) => f.id));
  const totals = new Map<number, { sum: number; count: number }>();
  for (const id of Array.from(founderIds)) totals.set(id, { sum: 0, count: 0 });

  for (const birdId of activeBirdIds) {
    const ancestry = fullAncestrySet(birdId, birdMap, maxGenerations);
    for (const [ancestorId, distances] of Array.from(ancestry.entries())) {
      if (!founderIds.has(ancestorId)) continue;
      // Cada caminho distinto até o fundador contribui (1/2)^distância;
      // se há mais de um caminho (o que só ocorre naturalmente se o próprio
      // fundador está fora do papel de "ancestral único", caso raro), soma-se.
      const contribution = distances.reduce((acc, d) => acc + Math.pow(0.5, d), 0);
      const entry = totals.get(ancestorId)!;
      entry.sum += Math.min(contribution, 1); // trava em 100% por indivíduo
      entry.count += 1;
    }
  }

  const n = activeBirdIds.length;
  const results: FounderContribution[] = founders.map((f) => {
    const entry = totals.get(f.id)!;
    const avg = entry.sum / n;
    let flag: FounderContribution["flag"] = null;
    if (avg >= 0.25) flag = "dominant";
    else if (avg > 0 && avg < 0.02) flag = "vanishing";
    return {
      founderId: f.id,
      ring: f.ring,
      sex: f.sex,
      averageContribution: avg,
      averageContributionPct: `${(avg * 100).toFixed(2)}%`,
      descendantsInPlantel: entry.count,
      flag,
    };
  });

  return results.sort((a, b) => b.averageContribution - a.averageContribution);
}

/**
 * Monta o relatório completo de genética populacional do plantel. Único
 * ponto de entrada usado pelo router — mantém a lógica de composição num
 * só lugar, testável isoladamente das consultas ao banco.
 */
export function buildPopulationGeneticsReport(params: {
  activeBirds: PedigreeBird[];
  birdMap: Map<number, PedigreeBird>;
  maxGenerations?: number;
}): PopulationGeneticsReport {
  const { activeBirds, birdMap, maxGenerations = 6 } = params;
  const activeBirdIds = activeBirds.map((b) => b.id);

  const breedingMales = activeBirds.filter((b) => b.sex === "macho").length;
  const breedingFemales = activeBirds.filter((b) => b.sex === "fêmea").length;
  const ne = calculateEffectivePopulationSize(breedingMales, breedingFemales);
  const neClass = classifyNeStatus(ne);

  const cache = new Map<string, number>();
  const meanKinshipByBird = activeBirdIds.map((id) =>
    calculateMeanKinshipForBird(id, activeBirdIds, birdMap, maxGenerations, cache)
  );
  meanKinshipByBird.sort((a, b) => b.meanKinship - a.meanKinship);

  const plantelAverageMeanKinship =
    meanKinshipByBird.length > 0
      ? meanKinshipByBird.reduce((s, r) => s + r.meanKinship, 0) / meanKinshipByBird.length
      : 0;

  const founders = calculateFounderContributions(activeBirdIds, birdMap, maxGenerations);

  return {
    totalActive: activeBirds.length,
    breedingMales,
    breedingFemales,
    effectivePopulationSize: Math.round(ne * 10) / 10,
    neStatus: neClass.status,
    neReferenceNote: neClass.note,
    meanKinshipByBird,
    plantelAverageMeanKinship,
    founders,
  };
}
