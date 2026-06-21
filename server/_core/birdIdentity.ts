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

export function deriveLegacyColorCode(officialName: string | null | undefined, fallback = "amarelo_intenso") {
  const upper = normalize(officialName).toUpperCase();
  if (!upper) return fallback;
  if (upper.includes("RUBINO")) return "vermelho_intenso";
  if (upper.includes("LUTINO")) return "amarelo_intenso";
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
  if (upper.includes("LUTINO")) return "lutino";
  return fallback;
}

export function deriveLegacySpecialtyCode(breedName: string | null | undefined, modality: string | null | undefined, fallback = "belga_clássico") {
  const breed = normalize(breedName).toLowerCase();
  if (breed) {
    const exact = SPECIALTIES.find((s) => s.name.toLowerCase() === breed || s.id.toLowerCase() === breed);
    if (exact) return exact.id;
    const partial = SPECIALTIES.find((s) => breed.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(breed));
    if (partial) return partial.id;
    if (breed.includes("gloster") && breed.includes("corona")) return "gloster_corona";
    if (breed.includes("gloster")) return "gloster_consort";
    if (breed.includes("frisado") && breed.includes("norte")) return "frisado_norte";
    if (breed.includes("frisado") && breed.includes("sul")) return "frisado_sul";
    if (breed.includes("fife")) return "fife";
    if (breed.includes("border")) return "border";
    if (breed.includes("norwich")) return "norwich";
    if (breed.includes("yorkshire")) return "yorkshire";
    if (breed.includes("lizard")) return "lizard";
    if (breed.includes("crest")) return "crest";
    if (breed.includes("lancashire")) return "lancashire";
  }
  return normalize(modality).toUpperCase() === "PORTE" ? fallback : "belga_clássico";
}
