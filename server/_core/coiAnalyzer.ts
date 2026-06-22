/**
 * coiAnalyzer.ts — COI Avançado com ancestrais comuns, caminhos e explicação
 *
 * Exporta:
 *   analyzeCoiForPair(fatherId, motherId, birdMap, maxGen)
 *     -> COI value + lista de ancestrais comuns com caminhos
 *        + explicação leigo + explicação técnica
 */
import { PedigreeBird, fullAncestrySet, calculateCOI, classifyCOIRisk } from "./genetics";

export type CoiAncestorPath = {
  ancestorId: number;
  ancestorRing: string;
  /** Distâncias pelo lado do pai (sire) */
  sireDistances: number[];
  /** Distâncias pelo lado da mãe (dam) */
  damDistances: number[];
  /** Geração mais próxima onde aparece (pai=1, avô=2, etc.) */
  closestGeneration: number;
  /** Contribuição percentual ao COI total */
  contributionPct: number;
};

export type CoiAnalysis = {
  coi: number;
  coiPct: string;
  risk: "low" | "moderate" | "high" | "very_high";
  riskLabel: string;
  commonAncestors: CoiAncestorPath[];
  hasCommonAncestors: boolean;
  /** Explicação para o criador leigo */
  explanationSimple: string;
  /** Explicação técnica com fórmula de Wright */
  explanationTechnical: string;
};

// Limiares configuráveis (em percentual)
const COI_THRESHOLDS = {
  low: 0.03,        // 0–3%
  attention: 0.0625, // 3–6.25%
  moderate: 0.125,  // 6.25–12.5%
  high: 0.25,       // 12.5–25%
  // acima de 25% = very_high
};

function classifyRisk(coi: number): CoiAnalysis["risk"] {
  if (coi >= COI_THRESHOLDS.high) return "very_high";
  if (coi >= COI_THRESHOLDS.moderate) return "high";
  if (coi >= COI_THRESHOLDS.attention) return "moderate";
  return "low";
}

function riskLabel(risk: CoiAnalysis["risk"]): string {
  const map: Record<CoiAnalysis["risk"], string> = {
    low: "Baixo (< 3%)",
    moderate: "Atenção (3–12,5%)",
    high: "Alto (12,5–25%)",
    very_high: "Muito alto (> 25%) — não recomendado",
  };
  return map[risk];
}

export function analyzeCoiForPair(
  fatherId: number,
  motherId: number,
  birdMap: Map<number, PedigreeBird>,
  maxGen = 6,
): CoiAnalysis {
  if (fatherId === motherId) {
    return {
      coi: 1, coiPct: "100%", risk: "very_high",
      riskLabel: "Muito alto — mesmo indivíduo",
      commonAncestors: [], hasCommonAncestors: true,
      explanationSimple: "Pai e mãe são o mesmo pássaro. Cruzamento impossível.",
      explanationTechnical: "F = 1 (identidade completa, caso degenerado).",
    };
  }

  const sireSet = fullAncestrySet(fatherId, birdMap, maxGen);
  const damSet  = fullAncestrySet(motherId, birdMap, maxGen);

  const cache = new Map<number, number>();
  let totalCoi = 0;

  const ancestorContributions: CoiAncestorPath[] = [];

  for (const [ancestorId, sireDistances] of Array.from(sireSet.entries())) {
    const damDistances = damSet.get(ancestorId);
    if (!damDistances) continue;

    const bird = birdMap.get(ancestorId);
    const fA = calculateCOI(ancestorId, birdMap, maxGen, cache);

    let contribution = 0;
    for (const n1 of sireDistances) {
      for (const n2 of damDistances) {
        contribution += Math.pow(0.5, n1 + n2 + 1) * (1 + fA);
      }
    }
    totalCoi += contribution;

    ancestorContributions.push({
      ancestorId,
      ancestorRing: bird?.ring ?? `#${ancestorId}`,
      sireDistances,
      damDistances,
      closestGeneration: Math.min(...sireDistances, ...damDistances),
      contributionPct: 0, // calculado depois
    });
  }

  // Calcular percentual de contribuição de cada ancestral
  for (const a of ancestorContributions) {
    const fA = calculateCOI(a.ancestorId, birdMap, maxGen, cache);
    let contribution = 0;
    for (const n1 of a.sireDistances) {
      for (const n2 of a.damDistances) {
        contribution += Math.pow(0.5, n1 + n2 + 1) * (1 + fA);
      }
    }
    a.contributionPct = totalCoi > 0 ? Math.round((contribution / totalCoi) * 100) : 0;
  }

  // Ordenar por contribuição descendente
  ancestorContributions.sort((a, b) => b.contributionPct - a.contributionPct);

  const coi = totalCoi;
  const coiPct = `${(coi * 100).toFixed(2)}%`;
  const risk = classifyRisk(coi);
  const hasCommon = ancestorContributions.length > 0;

  // ─── Explicação leigo ──────────────────────────────────────────────────────
  let explanationSimple: string;
  if (!hasCommon) {
    explanationSimple = "Este casal não possui ancestrais em comum nas gerações analisadas. O risco de consanguinidade é muito baixo — ótima escolha para diversidade genética.";
  } else {
    const topAncestor = ancestorContributions[0];
    const genWord = topAncestor.closestGeneration === 1 ? "pai ou mãe"
      : topAncestor.closestGeneration === 2 ? "avô ou avó"
      : topAncestor.closestGeneration === 3 ? "bisavô ou bisavó"
      : `ancestral de geração ${topAncestor.closestGeneration}`;

    if (risk === "low") {
      explanationSimple = `Este casal possui ${ancestorContributions.length} ancestral(is) em comum, mas em gerações distantes. O nível de consanguinidade é baixo (${coiPct}) e o cruzamento é seguro.`;
    } else if (risk === "moderate") {
      explanationSimple = `Este casal compartilha ${ancestorContributions.length} ancestral(is) comum(s). O ${genWord} "${topAncestor.ancestorRing}" aparece em ambas as linhagens e é o principal fator do COI (${coiPct}). Cruzamento possível com monitoramento.`;
    } else if (risk === "high") {
      explanationSimple = `Atenção: o COI está alto (${coiPct}). O ancestral "${topAncestor.ancestorRing}" aparece repetido nas duas linhagens, aumentando o risco de filhotes com genes idênticos. Considere um casal com menor parentesco.`;
    } else {
      explanationSimple = `⚠️ COI muito alto (${coiPct}). Este cruzamento não é recomendado. Os pássaros compartilham muitos ancestrais próximos, o que aumenta significativamente o risco de problemas genéticos nos filhotes.`;
    }
  }

  // ─── Explicação técnica ────────────────────────────────────────────────────
  const paths = ancestorContributions.slice(0, 5).map((a) => {
    const paths = a.sireDistances.flatMap(n1 =>
      a.damDistances.map(n2 => `(0.5)^(${n1}+${n2}+1) = ${(Math.pow(0.5, n1 + n2 + 1) * 100).toFixed(3)}%`)
    );
    return `  ${a.ancestorRing} → ${paths.join(" + ")}`;
  }).join("\n");

  const explanationTechnical = [
    `Fórmula de Wright: F = Σ [(0.5)^(n₁+n₂+1) × (1 + Fₐ)]`,
    `Gerações analisadas: ${maxGen}`,
    `Ancestrais comuns encontrados: ${ancestorContributions.length}`,
    ancestorContributions.length > 0 ? `\nContribuições principais:\n${paths}` : "",
    `\nCOI total: ${coiPct}`,
  ].filter(Boolean).join("\n");

  return {
    coi,
    coiPct,
    risk,
    riskLabel: riskLabel(risk),
    commonAncestors: ancestorContributions,
    hasCommonAncestors: hasCommon,
    explanationSimple,
    explanationTechnical,
  };
}
