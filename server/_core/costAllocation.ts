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
}

export interface BirdCostResult {
  birdId: number;
  ring: string;
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

  const generalSupplies = supplies.filter((s) => !s.appliesToColorCategory);
  const totalGeneral = generalSupplies.reduce((s, x) => s + x.totalCost, 0);
  const generalPerBird = birds.length > 0 ? totalGeneral / birds.length : 0;

  const specificTotals: Record<string, number> = {};
  for (const s of supplies) {
    if (s.appliesToColorCategory) {
      specificTotals[s.appliesToColorCategory] = (specificTotals[s.appliesToColorCategory] ?? 0) + s.totalCost;
    }
  }

  const countByCategory: Record<string, number> = {};
  for (const b of birds) {
    if (b.pigmentCategory) countByCategory[b.pigmentCategory] = (countByCategory[b.pigmentCategory] ?? 0) + 1;
  }

  const perBird: BirdCostResult[] = birds.map((b) => {
    const specificCost =
      b.pigmentCategory && countByCategory[b.pigmentCategory] > 0
        ? (specificTotals[b.pigmentCategory] ?? 0) / countByCategory[b.pigmentCategory]
        : 0;
    return {
      birdId: b.id,
      ring: b.ring,
      generalCost: generalPerBird,
      specificCost,
      totalCost: generalPerBird + specificCost,
    };
  });

  const grandTotal = totalGeneral + Object.values(specificTotals).reduce((s, x) => s + x, 0);
  const averagePerBird = birds.length > 0 ? grandTotal / birds.length : 0;

  return { perBird, totalGeneral, totalSpecific: specificTotals, grandTotal, averagePerBird };
}
