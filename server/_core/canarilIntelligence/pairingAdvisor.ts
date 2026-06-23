/**
 * pairingAdvisor.ts — Assistente interno de recomendação de pares
 */
import { isLethalCrossing } from "./geneticKnowledge";
import { classifyCOIRisk } from "../genetics";

export type PairingStatus = "ideal" | "approved" | "caution" | "not_recommended";

export interface PairingAdvisorInput {
  maleBirdId: number;
  femaleBirdId: number;
  maleRing: string;
  femaleRing: string;
  coi: number;
  maleMutations: Array<{ mutation: string; zygosity: string }>;
  femaleMutations: Array<{ mutation: string; zygosity: string }>;
  maleHasCrest: boolean;
  femaleHasCrest: boolean;
  maleHasData: boolean;
  femaleHasData: boolean;
  objective?: string;
}

export interface PairingAdvisorOutput {
  status: PairingStatus;
  score: number;
  coiRisk: ReturnType<typeof classifyCOIRisk>;
  reasons: string[];
  warnings: string[];
  missingData: string[];
  simpleExplanation: string;
  technicalExplanation: string;
  recommendedActions: string[];
}

export function advisePairing(input: PairingAdvisorInput): PairingAdvisorOutput {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const missingData: string[] = [];
  const recommendedActions: string[] = [];
  let score = 60;

  // ─── Alertas letais ──────────────────────────────────────────────────────
  const lethalAlerts = isLethalCrossing("male", "female", input.maleMutations, input.femaleMutations);
  for (const alert of lethalAlerts) {
    warnings.push(alert.warning);
    score -= 60;
  }

  // Crista × crista
  if (input.maleHasCrest && input.femaleHasCrest) {
    warnings.push("RISCO LETAL: ambos têm crista. Nunca cruzar dois pássaros com topete. 25% dos embriões são inviáveis.");
    score -= 60;
  }

  // ─── COI ─────────────────────────────────────────────────────────────────
  const coiRisk = classifyCOIRisk(input.coi);
  const coiPct = `${(input.coi * 100).toFixed(1)}%`;
  if (coiRisk === "low") {
    reasons.push(`COI baixo (${coiPct}) — boa diversidade genética.`);
    score += 30;
  } else if (coiRisk === "moderate") {
    reasons.push(`COI moderado (${coiPct}) — aceitável com monitoramento.`);
    score += 10;
    warnings.push(`COI moderado: ${coiPct}. Monitorar filhotes nas primeiras gerações.`);
  } else if (coiRisk === "high") {
    warnings.push(`COI alto: ${coiPct}. Considere um par com menor parentesco.`);
    score -= 20;
  } else {
    warnings.push(`COI muito alto: ${coiPct}. Cruzamento não recomendado.`);
    score -= 40;
  }

  // ─── Dados faltando ──────────────────────────────────────────────────────
  if (!input.maleHasData) {
    missingData.push(`Macho ${input.maleRing} sem ficha genética completa.`);
    score -= 10;
  }
  if (!input.femaleHasData) {
    missingData.push(`Fêmea ${input.femaleRing} sem ficha genética completa.`);
    score -= 10;
  }

  // ─── Intenso × Intenso ───────────────────────────────────────────────────
  const maleFeather = (input as any).maleFeatherType;
  const femaleFeather = (input as any).femaleFeatherType;
  if (maleFeather === "intenso" && femaleFeather === "intenso") {
    warnings.push("Intenso × intenso: pode reduzir fertilidade. Prefira intenso × nevado.");
    score -= 10;
  }

  // ─── Ações recomendadas ───────────────────────────────────────────────────
  if (missingData.length > 0) {
    recommendedActions.push("Complete a ficha genética dos dois pássaros para aumentar a precisão desta análise.");
  }
  if (coiRisk !== "low") {
    recommendedActions.push("Considere usar o COI Avançado para identificar quais ancestrais geram o parentesco.");
  }
  if (lethalAlerts.length > 0 || (input.maleHasCrest && input.femaleHasCrest)) {
    recommendedActions.push("Substitua um dos pássaros para eliminar o risco letal.");
  }

  // ─── Status final ────────────────────────────────────────────────────────
  const clampedScore = Math.max(0, Math.min(100, score));
  let status: PairingStatus;
  if (warnings.some((w) => w.includes("RISCO LETAL"))) status = "not_recommended";
  else if (coiRisk === "high") status = "caution";
  else if (clampedScore >= 80) status = "ideal";
  else if (clampedScore >= 55) status = "approved";
  else status = "caution";

  // ─── Explicações ─────────────────────────────────────────────────────────
  const statusLabels: Record<PairingStatus, string> = {
    ideal: "Este casal é uma excelente combinação",
    approved: "Este casal é aprovado",
    caution: "Este casal pode ser usado com atenção",
    not_recommended: "Este casal NÃO é recomendado",
  };

  let simpleExplanation = `${statusLabels[status]}.`;
  if (reasons.length > 0) simpleExplanation += ` ${reasons[0]}`;
  if (warnings.length > 0 && status !== "not_recommended") simpleExplanation += ` Atenção: ${warnings[0]}`;
  if (missingData.length > 0) simpleExplanation += ` Para aumentar a precisão, complete a ficha genética dos pássaros.`;

  const technicalExplanation = [
    `Status: ${status} (score ${clampedScore}/100)`,
    `COI: ${coiPct} (${coiRisk})`,
    reasons.length > 0 ? `Pontos positivos: ${reasons.join("; ")}` : null,
    warnings.length > 0 ? `Avisos: ${warnings.join("; ")}` : null,
    missingData.length > 0 ? `Dados faltando: ${missingData.join("; ")}` : null,
  ].filter(Boolean).join("\n");

  return {
    status, score: clampedScore, coiRisk,
    reasons, warnings, missingData,
    simpleExplanation, technicalExplanation, recommendedActions,
  };
}
