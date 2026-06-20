/**
 * Motor de Genética — Coeficiente de Endogamia (COI) e Árvore Genealógica
 * ============================================================================
 * Implementa o método de contagem de caminhos de Sewall Wright para
 * calcular o Coeficiente de Endogamia (Coefficient of Inbreeding — COI):
 *
 *   F_X = Σ (1/2)^(n1 + n2 + 1) × (1 + F_A)
 *
 * onde, para cada ancestral comum A entre o pai e a mãe de X:
 *   n1 = número de gerações do pai de X até A
 *   n2 = número de gerações da mãe de X até A
 *   F_A = coeficiente de endogamia do próprio ancestral A (recursivo)
 *
 * A implementação enumera TODOS os caminhos distintos até cada ancestral
 * (não só a distância mínima), o que é necessário pra contar corretamente
 * quando o mesmo ancestral aparece por mais de uma linhagem — caso comum
 * em plantéis pequenos depois de algumas gerações.
 *
 * Limitado a 5 gerações (configurável), que é o padrão pedido para
 * pedigree de canários e mantém o cálculo rápido mesmo em plantéis
 * grandes (no pior caso, ~2^5 = 32 caminhos por lado).
 * ============================================================================
 */

export type PedigreeBird = {
  id: number;
  ring: string;
  specialty_code: string;
  color_code: string;
  sex: string;
  fatherId: number | null;
  motherId: number | null;
};

export type PedigreeNode = {
  id: number;
  ring: string;
  specialty_code: string;
  color_code: string;
  sex: string;
  generation: number; // 0 = o próprio pássaro, 1 = pais, 2 = avós...
  father: PedigreeNode | null;
  mother: PedigreeNode | null;
  /** true quando o pedigree foi cortado aqui por atingir o limite de gerações, não por falta de dado */
  truncated: boolean;
};

const MAX_GENERATIONS_DEFAULT = 5;

/**
 * Monta a árvore de ancestrais de um pássaro, até N gerações. Recebe a
 * lista completa de pássaros do criadouro (já carregada em memória) em vez
 * de fazer uma query por ancestral — muito mais rápido e simples do que
 * resolver recursivamente no banco.
 */
export function buildPedigreeTree(
  birdId: number,
  birdMap: Map<number, PedigreeBird>,
  maxGenerations: number = MAX_GENERATIONS_DEFAULT,
): PedigreeNode | null {
  const bird = birdMap.get(birdId);
  if (!bird) return null;

  function walk(currentId: number, generation: number): PedigreeNode | null {
    const current = birdMap.get(currentId);
    if (!current) return null;

    const atLimit = generation >= maxGenerations;
    const father =
      !atLimit && current.fatherId != null ? walk(current.fatherId, generation + 1) : null;
    const mother =
      !atLimit && current.motherId != null ? walk(current.motherId, generation + 1) : null;

    return {
      id: current.id,
      ring: current.ring,
      specialty_code: current.specialty_code,
      color_code: current.color_code,
      sex: current.sex,
      generation,
      father,
      mother,
      truncated: atLimit && (current.fatherId != null || current.motherId != null),
    };
  }

  return walk(birdId, 0);
}

/**
 * Para um indivíduo (real ou hipotético), enumera todos os ancestrais
 * alcançáveis a partir dele dentro de maxDepth gerações, junto com a
 * distância (em gerações) de CADA caminho distinto até cada ancestral —
 * um mesmo ancestral pode aparecer mais de uma vez se houver mais de uma
 * linha de descendência até ele.
 *
 * O próprio indivíduo entra no resultado com distância 0 (necessário para
 * detectar cruzamento pai×filha, irmão×irmã etc., onde um dos pais É o
 * ancestral comum).
 */
function fullAncestrySet(
  personId: number,
  birdMap: Map<number, PedigreeBird>,
  maxDepth: number,
): Map<number, number[]> {
  const result = new Map<number, number[]>();

  function addPath(ancestorId: number, distance: number) {
    const existing = result.get(ancestorId);
    if (existing) existing.push(distance);
    else result.set(ancestorId, [distance]);
  }

  function walk(currentId: number, distance: number) {
    if (distance > maxDepth) return;
    addPath(currentId, distance);
    const current = birdMap.get(currentId);
    if (!current) return;
    if (current.fatherId != null) walk(current.fatherId, distance + 1);
    if (current.motherId != null) walk(current.motherId, distance + 1);
  }

  walk(personId, 0);
  return result;
}

/**
 * Calcula o COI de um indivíduo JÁ EXISTENTE no banco (com fatherId/
 * motherId preenchidos). Resultado entre 0 e 1 (multiplique por 100 pra
 * exibir como porcentagem).
 */
export function calculateCOI(
  birdId: number,
  birdMap: Map<number, PedigreeBird>,
  maxGenerations: number = MAX_GENERATIONS_DEFAULT,
  cache: Map<number, number> = new Map(),
): number {
  if (cache.has(birdId)) return cache.get(birdId)!;

  const bird = birdMap.get(birdId);
  if (!bird || bird.fatherId == null || bird.motherId == null) {
    cache.set(birdId, 0);
    return 0;
  }

  const f = calculateCOIForPair(bird.fatherId, bird.motherId, birdMap, maxGenerations, cache);
  cache.set(birdId, f);
  return f;
}

/**
 * Calcula o COI que um FILHOTE HIPOTÉTICO desse casal teria — usado antes
 * de formar o casal de fato, pra alertar o criador com antecedência (não
 * precisa o filhote existir no banco pra calcular isso).
 */
export function calculateCOIForPair(
  fatherId: number,
  motherId: number,
  birdMap: Map<number, PedigreeBird>,
  maxGenerations: number = MAX_GENERATIONS_DEFAULT,
  cache: Map<number, number> = new Map(),
): number {
  if (fatherId === motherId) return 1; // mesmo indivíduo — caso degenerado, máxima endogamia

  const sireSet = fullAncestrySet(fatherId, birdMap, maxGenerations);
  const damSet = fullAncestrySet(motherId, birdMap, maxGenerations);

  let f = 0;
  for (const [ancestorId, sireDistances] of Array.from(sireSet.entries())) {
    const damDistances = damSet.get(ancestorId);
    if (!damDistances) continue;

    const fA = calculateCOI(ancestorId, birdMap, maxGenerations, cache);

    for (const n1 of sireDistances) {
      for (const n2 of damDistances) {
        f += Math.pow(0.5, n1 + n2 + 1) * (1 + fA);
      }
    }
  }

  return f;
}

/**
 * Classifica o nível de risco do COI pra exibição com cor (vermelho/
 * amarelo/verde) na interface. Faixas seguem o uso comum em zootecnia:
 * acima de 12,5% (equivalente a meio-irmãos) já é considerado alto risco
 * pra aves de pequeno porte como canários.
 */
export function classifyCOIRisk(coi: number): "low" | "moderate" | "high" {
  if (coi >= 0.125) return "high";
  if (coi >= 0.0625) return "moderate";
  return "low";
}
