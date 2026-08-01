/**
 * costAllocation.ts — Alocação de custo de insumos por pássaro
 * ============================================================================
 * Responde: "quanto cada pássaro está custando de verdade?" — separando
 * dois tipos de insumo:
 *   - GERAL (ração, sementes, equipamentos...): dividido igualmente entre
 *     todo o plantel ativo.
 *   - ESPECÍFICO POR PIGMENTO (ex.: cantaxantina só pra pássaros "com fator
 *     vermelho", xantofila só pra "sem fator"/amarelos): dividido só entre
 *     os pássaros daquela categoria específica.
 *
 * 100% aditivo — módulo novo, não toca em nenhuma tabela/lógica existente.
 * A classificação por pigmento reaproveita o campo `genetics`/`category`
 * já existente em COLORS (shared/constants.ts), sem duplicar dado.
 * ============================================================================
 */

export type ColorPigmentCategory = "com_fator" | "sem_fator" | null;

export interface ColorLike {
  id: string;
  category?: string;
  genetics?: string;
}

/**
 * Categoria de idade do pássaro, usada pra ponderar o consumo de insumos —
 * um filhote recém-nascido não come a mesma quantidade de ração que um
 * adulto. Faixas conservadoras, revisáveis conforme feedback real:
 *   filhote  (0–40 dias):  ainda desmamando/dependente dos pais
 *   jovem    (41–365 dias): já independente, mas ainda crescendo
 *   adulto   (> 365 dias):  consumo pleno de adulto
 *
 * FONTES (canário-belga especificamente, não estimativa genérica):
 *   - Independência dos pais aos ~40 dias: NIAAS (Núcleo de Internação
 *     para Aves e Animais Silvestres) — fonte técnica/veterinária.
 *   - Maturidade reprodutiva recomendada aos 12 meses (capaz desde os 8
 *     meses, mas não recomendado): Petz.
 * O PESO DE CONSUMO POR FAIXA (0.3 / 0.65 / 1.0), porém, É UMA ESTIMATIVA
 * DE ENGENHARIA, não um dado de nutrição aviária verificado — não achei
 * fonte confiável com o consumo em gramas/dia por fase pra canário-belga
 * especificamente. Se você tiver esse dado real do seu criadouro, me diga
 * os números e eu ajusto — o cálculo é só esses 3 valores, fácil de trocar.
 */
export type BirdAgeCategory = "filhote" | "jovem" | "adulto" | "desconhecido";

export const AGE_CATEGORY_LABELS: Record<BirdAgeCategory, string> = {
  filhote: "Filhote (até 40 dias)",
  jovem: "Jovem (41 dias a 1 ano)",
  adulto: "Adulto (mais de 1 ano)",
  desconhecido: "Idade desconhecida",
};

/**
 * Peso relativo de consumo por categoria — 1.0 = consumo de um adulto.
 * ATENÇÃO: estes 3 números (0.3 / 0.65 / 1.0) são uma estimativa de
 * engenharia, não um dado de nutrição aviária verificado — ver nota acima.
 */
export const AGE_CATEGORY_WEIGHTS: Record<BirdAgeCategory, number> = {
  filhote: 0.3,
  jovem: 0.65,
  adulto: 1.0,
  desconhecido: 1.0, // sem data cadastrada: assume consumo padrão, não penaliza nem favorece
};

export function classifyBirdAgeCategory(birthDate: Date | string | null | undefined, now: Date = new Date()): BirdAgeCategory {
  if (!birthDate) return "desconhecido";
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return "desconhecido";
  const ageDays = (now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays < 0) return "desconhecido"; // data de nascimento no futuro — dado inconsistente
  if (ageDays <= 40) return "filhote";
  if (ageDays <= 365) return "jovem";
  return "adulto";
}

/** Classifica um pássaro em "com fator" (precisa de cantaxantina) ou "sem fator" (xantofila), a partir do color_code. */
export function classifyBirdPigmentCategory(colorCode: string | null | undefined, colorsList: ColorLike[]): ColorPigmentCategory {
  if (!colorCode) return null;
  const color = colorsList.find((c) => c.id === colorCode);
  if (!color) return null;

  const genetics = (color.genetics || "").toLowerCase();
  if (genetics.includes("com fator")) return "com_fator";
  if (genetics.includes("sem fator")) return "sem_fator";

  // Fallback pras cores mais antigas/simples, que não têm o campo genetics
  // detalhado mas têm category "Amarelo"/"Vermelho".
  if (color.category === "Vermelho") return "com_fator";
  if (color.category === "Amarelo") return "sem_fator";

  return null;
}

export interface SupplyForAllocation {
  totalCost: number;
  appliesToColorCategory: "com_fator" | "sem_fator" | null;
}

export interface BirdForAllocation {
  id: number;
  ring: string;
  pigmentCategory: ColorPigmentCategory;
  ageCategory: BirdAgeCategory;
}

export interface BirdCostResult {
  birdId: number;
  ring: string;
  ageCategory: BirdAgeCategory;
  generalCost: number;
  specificCost: number;
  totalCost: number;
}

export interface CostAllocationResult {
  perBird: BirdCostResult[];
  totalGeneral: number;
  totalSpecific: Record<string, number>;
  grandTotal: number;
  averagePerBird: number;
}

export function allocateCostsPerBird(params: {
  supplies: SupplyForAllocation[];
  birds: BirdForAllocation[];
}): CostAllocationResult {
  const { supplies, birds } = params;

  // Antes: custo geral dividido IGUALMENTE entre todos os pássaros — um
  // filhote de poucos dias "pagava" o mesmo tanto de ração que um adulto,
  // o que distorcia o custo real. Agora divide proporcionalmente ao peso
  // de consumo de cada faixa de idade (AGE_CATEGORY_WEIGHTS).
  const weightOf = (b: BirdForAllocation) => AGE_CATEGORY_WEIGHTS[b.ageCategory];

  const generalSupplies = supplies.filter((s) => !s.appliesToColorCategory);
  const totalGeneral = generalSupplies.reduce((s, x) => s + x.totalCost, 0);
  const totalWeight = birds.reduce((s, b) => s + weightOf(b), 0);
  const generalPerWeightUnit = totalWeight > 0 ? totalGeneral / totalWeight : 0;

  const specificTotals: Record<string, number> = {};
  for (const s of supplies) {
    if (s.appliesToColorCategory) {
      specificTotals[s.appliesToColorCategory] = (specificTotals[s.appliesToColorCategory] ?? 0) + s.totalCost;
    }
  }

  const weightByCategory: Record<string, number> = {};
  for (const b of birds) {
    if (b.pigmentCategory) weightByCategory[b.pigmentCategory] = (weightByCategory[b.pigmentCategory] ?? 0) + weightOf(b);
  }

  const perBird: BirdCostResult[] = birds.map((b) => {
    const w = weightOf(b);
    const generalCost = w * generalPerWeightUnit;
    const specificCost =
      b.pigmentCategory && weightByCategory[b.pigmentCategory] > 0
        ? w * ((specificTotals[b.pigmentCategory] ?? 0) / weightByCategory[b.pigmentCategory])
        : 0;
    return {
      birdId: b.id,
      ring: b.ring,
      ageCategory: b.ageCategory,
      generalCost,
      specificCost,
      totalCost: generalCost + specificCost,
    };
  });

  const grandTotal = totalGeneral + Object.values(specificTotals).reduce((s, x) => s + x, 0);
  const averagePerBird = birds.length > 0 ? grandTotal / birds.length : 0;

  return { perBird, totalGeneral, totalSpecific: specificTotals, grandTotal, averagePerBird };
}
