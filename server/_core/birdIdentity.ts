import { COLORS, SEXES, SPECIALTIES } from "../../shared/constants";

export type BirdIdentityInput = {
  ring: string;
  sex?: string | null;
  specialtyCode?: string | null;
  colorCode?: string | null;
  speciesName?: string | null;
  modality?: string | null;
  breedName?: string | null;
  officialName?: string | null;
  nickname?: string | null;
};

const normalize = (value: string | null | undefined) => (value ?? "").trim();

const toDisplayLabel = (value: string | null | undefined) => {
  const raw = normalize(value);
  if (!raw) return "";
  return raw
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|\s|-)[a-záàâãéêíóôõúç]/g, (m) => m.toUpperCase());
};

export function getSexLabel(sex: string | null | undefined) {
  const raw = normalize(sex);
  return SEXES.find((s) => s.id === raw)?.name ?? toDisplayLabel(raw) ?? "Sexo não informado";
}

export function getSpecialtyLabel(code: string | null | undefined) {
  const raw = normalize(code);
  return SPECIALTIES.find((s) => s.id === raw)?.name ?? toDisplayLabel(raw);
}

export function getColorLabel(code: string | null | undefined) {
  const raw = normalize(code);
  return COLORS.find((c) => c.id === raw)?.name ?? toDisplayLabel(raw);
}

export function modalityLabel(modality: string | null | undefined) {
  switch (normalize(modality).toUpperCase()) {
    case "COR": return "Canário de Cor";
    case "PORTE": return "Canário de Porte";
    case "CANTO": return "Canário de Canto";
    default: return "Canário";
  }
}

export function generateBirdDisplayTitle(input: BirdIdentityInput) {
  const ring = normalize(input.ring) || "Sem anilha";
  const breedOrMode =
    normalize(input.breedName) ||
    modalityLabel(input.modality) ||
    getSpecialtyLabel(input.specialtyCode) ||
    normalize(input.speciesName) ||
    "Canário";
  const phenotype =
    normalize(input.officialName) ||
    getColorLabel(input.colorCode) ||
    "Classe não informada";
  const sex = getSexLabel(input.sex);
  return [ring, breedOrMode, phenotype, sex].filter(Boolean).join(" — ");
}

/**
 * Chave de comparação tolerante a acentuação/maiúsculas/conectores — espelha
 * server/_core/legacyCatalogSync.ts e client/src/pages/Birds.tsx, para casar
 * "Frisado do Norte" (nome oficial) com "Frisado do Norte"/"FRISADO_NORTE"
 * (id em SPECIALTIES) mesmo com grafias/formatos diferentes.
 */
const dedupeKey = (label: string) =>
  label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .filter((token) => !["DO", "DA", "DE", "DOS", "DAS", "E"].includes(token))
    .join("");

export function deriveLegacyColorCode(
  officialName: string | null | undefined,
  groupName: string | null | undefined,
  fallback = "amarelo_intenso"
) {
  // 1) Correspondência exata pelo grupo oficial (mais confiável — é
  //    exatamente o campo que gerou a lista de cores em SPECIALTIES/COLORS).
  if (groupName) {
    const key = dedupeKey(groupName);
    const exact = COLORS.find((c) => dedupeKey(c.name) === key);
    if (exact) return exact.id;
  }
  // 2) Fallback: heurística por palavra-chave no nome completo da classe
  //    (cobre casos legados sem groupName estruturado no banco).
  const upper = normalize(officialName).toUpperCase();
  if (!upper) return fallback;
  if (upper.includes("RUBINO")) return "vermelho_intenso";
  if (upper.includes("LUTINO")) return "lutino";
  if (upper.includes("ALBINO")) return "albino";
  if (upper.includes("BRANCO")) return "branco";
  if (upper.includes("VERMELHO") && upper.includes("MOSAICO")) return "vermelho_mosaico";
  if (upper.includes("VERMELHO") && upper.includes("NEVADO")) return "vermelho_nevado";
  if (upper.includes("VERMELHO")) return "vermelho_intenso";
  if (upper.includes("AMARELO") && upper.includes("MOSAICO")) return "amarelo_mosaico";
  if (upper.includes("AMARELO") && upper.includes("NEVADO")) return "amarelo_nevado";
  if (upper.includes("OPALINO")) return "opalino";
  if (upper.includes("FEO")) return "feo";
  if (upper.includes("TOPÁZIO") || upper.includes("TOPAZIO")) return "topázio";
  return fallback;
}

export function deriveLegacySpecialtyCode(
  breedName: string | null | undefined,
  modality: string | null | undefined,
  fallback = "belga_clássico"
) {
  const breed = normalize(breedName);
  if (breed) {
    // Correspondência exata pelo nome oficial da raça — SPECIALTIES agora
    // cobre as 49 raças/portes oficiais, então isto normalmente resolve
    // sem precisar de heurística nenhuma (e sem o risco de rotular
    // silenciosamente qualquer raça não reconhecida como "Belga Clássico").
    const key = dedupeKey(breed);
    const exact = SPECIALTIES.find((s) => dedupeKey(s.name) === key || dedupeKey(s.id) === key);
    if (exact) return exact.id;
  }
  return normalize(modality).toUpperCase() === "PORTE" ? fallback : "belga_clássico";
}
