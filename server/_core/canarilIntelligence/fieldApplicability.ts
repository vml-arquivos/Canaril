/**
 * fieldApplicability.ts — Campos dinâmicos por espécie/raça/classe/sexo
 */
import { getBreed } from "./breedKnowledge";
import { getMutation, canFemaleBeCarrier, getValidZygosities } from "./geneticKnowledge";

export interface FieldApplicabilityInput {
  speciesCode: string;
  modality?: string;
  breedCode?: string;
  sex?: "macho" | "fêmea";
  hasCrest?: boolean;
  knownMutations?: Array<{ mutation: string; zygosity: string }>;
}

export interface FieldApplicabilityOutput {
  showCrest: boolean;
  showMosaicSex: boolean;
  showRedFactor: boolean;
  availableZygositiesFor: Record<string, string[]>;
  warnings: string[];
  hints: Record<string, string>;
}

export function computeFieldApplicability(input: FieldApplicabilityInput): FieldApplicabilityOutput {
  const breed = input.breedCode ? getBreed(input.breedCode) : undefined;
  const warnings: string[] = [];
  const hints: Record<string, string> = {};
  const availableZygositiesFor: Record<string, string[]> = {};

  // ─── Crista/topete ───────────────────────────────────────────────────────
  // Mostrar campo crista se raça tem possibilidade de crista
  const showCrest = breed ? breed.hasCrest || input.hasCrest === true : input.hasCrest === true;
  if (input.hasCrest && input.modality === "COR") {
    hints["hasCrest"] = "Crista é rara em canários de cor. Verifique se a classe oficial confirma esta característica.";
  }

  // ─── Mosaico sexo ────────────────────────────────────────────────────────
  const showMosaicSex = input.modality === "COR";

  // ─── Fator vermelho ──────────────────────────────────────────────────────
  const showRedFactor = input.modality === "COR" || !input.modality;
  if (showRedFactor) {
    hints["redFactor"] = "Canários de fator vermelho precisam de pigmentação na alimentação para expressar a cor. Sem manejo, a cor sai amarelada.";
  }

  // ─── Zigosidades disponíveis por mutação/sexo ────────────────────────────
  const mutationsToCheck = input.knownMutations?.map((m) => m.mutation) ?? [];
  for (const mutCode of mutationsToCheck) {
    if (input.sex) {
      availableZygositiesFor[mutCode] = getValidZygosities(mutCode, input.sex);
    }
  }

  // ─── Alertas por sexo para genes ligados ao sexo ────────────────────────
  if (input.sex === "fêmea" && input.knownMutations) {
    for (const m of input.knownMutations) {
      if (!canFemaleBeCarrier(m.mutation) && m.zygosity === "heterozygous_carrier") {
        warnings.push(`Fêmeas não podem ser portadoras silenciosas de "${m.mutation}" (gene ligado ao sexo). Corrija para "manifesta" ou "normal".`);
      }
    }
  }

  return { showCrest, showMosaicSex, showRedFactor, availableZygositiesFor, warnings, hints };
}
