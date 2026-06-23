/**
 * breedKnowledge.ts — Base de raças
 */
export type Modality = "COR" | "PORTE" | "CANTO" | "OUTRA";

export interface BreedRecord {
  code: string;
  speciesCode: string;
  modality: Modality;
  name: string;
  aliases: string[];
  hasCrest: boolean;
  hasPorteStandard: boolean;
  hasColorStandard: boolean;
  defaultRingGaugeMm: number | null;
  description: string;
  active: boolean;
}

export const BREED_KNOWLEDGE: BreedRecord[] = [
  // ─── Canários de Cor ────────────────────────────────────────────────────
  { code: "canario_cor", speciesCode: "canario", modality: "COR", name: "Canário de Cor (Geral)", aliases: ["Cor", "Lipocrômico", "Melânico"], hasCrest: false, hasPorteStandard: false, hasColorStandard: true, defaultRingGaugeMm: 2.7, description: "Categoria geral para canários avaliados pela cor e plumagem.", active: true },
  // ─── Canários de Porte ───────────────────────────────────────────────────
  { code: "gloster_consort", speciesCode: "canario", modality: "PORTE", name: "Gloster Consort", aliases: ["Gloster liso", "Consort"], hasCrest: false, hasPorteStandard: true, hasColorStandard: false, defaultRingGaugeMm: 2.4, description: "Gloster sem topete. Par obrigatório do Gloster Corona.", active: true },
  { code: "gloster_corona", speciesCode: "canario", modality: "PORTE", name: "Gloster Corona", aliases: ["Gloster topetado", "Corona"], hasCrest: true, hasPorteStandard: true, hasColorStandard: false, defaultRingGaugeMm: 2.4, description: "Gloster com topete redondo e compacto. Nunca cruzar Corona × Corona.", active: true },
  { code: "padovano", speciesCode: "canario", modality: "PORTE", name: "Padovano", aliases: ["Paduan"], hasCrest: true, hasPorteStandard: true, hasColorStandard: false, defaultRingGaugeMm: 3.0, description: "Canário de porte com crista pronunciada. Regra crista: nunca com crista x com crista.", active: true },
  { code: "fiorino", speciesCode: "canario", modality: "PORTE", name: "Fiorino", aliases: [], hasCrest: false, hasPorteStandard: true, hasColorStandard: false, defaultRingGaugeMm: 2.5, description: "Canário de porte pequeno italiano.", active: true },
  { code: "crest", speciesCode: "canario", modality: "PORTE", name: "Crest", aliases: ["Crested"], hasCrest: true, hasPorteStandard: true, hasColorStandard: false, defaultRingGaugeMm: 3.2, description: "Canário inglês com crista grande. Crista × Plainhead.", active: true },
  { code: "rheinlander", speciesCode: "canario", modality: "PORTE", name: "Rheinländer", aliases: ["Renano"], hasCrest: false, hasPorteStandard: true, hasColorStandard: false, defaultRingGaugeMm: 2.7, description: "Canário de porte alemão.", active: true },
  { code: "frisado_norte", speciesCode: "canario", modality: "PORTE", name: "Frisado do Norte", aliases: ["Frizé du Nord"], hasCrest: false, hasPorteStandard: true, hasColorStandard: false, defaultRingGaugeMm: 2.9, description: "Penas frisadas para cima e lateralmente.", active: true },
  { code: "frisado_sul", speciesCode: "canario", modality: "PORTE", name: "Frisado do Sul", aliases: ["Frizé du Midi"], hasCrest: false, hasPorteStandard: true, hasColorStandard: false, defaultRingGaugeMm: 2.7, description: "Penas frisadas para baixo.", active: true },
  { code: "fife_fancy", speciesCode: "canario", modality: "PORTE", name: "Fife Fancy", aliases: ["Fife"], hasCrest: false, hasPorteStandard: true, hasColorStandard: false, defaultRingGaugeMm: 2.4, description: "Menor canário de porte. Forma de bola redonda.", active: true },
  { code: "yorkshire", speciesCode: "canario", modality: "PORTE", name: "Yorkshire", aliases: ["Yorkie"], hasCrest: false, hasPorteStandard: true, hasColorStandard: false, defaultRingGaugeMm: 3.2, description: "Maior canário de porte. Posição militar, cabeça fina.", active: true },
  { code: "lizard", speciesCode: "canario", modality: "COR", name: "Lizard", aliases: [], hasCrest: false, hasPorteStandard: false, hasColorStandard: true, defaultRingGaugeMm: 2.7, description: "Único canário avaliado pelo padrão de melanina em escamas.", active: true },
  { code: "border", speciesCode: "canario", modality: "PORTE", name: "Border Fancy", aliases: ["Border"], hasCrest: false, hasPorteStandard: true, hasColorStandard: false, defaultRingGaugeMm: 2.7, description: "Canário de porte inglês/escocês, forma circular.", active: true },
  { code: "norwich", speciesCode: "canario", modality: "PORTE", name: "Norwich", aliases: [], hasCrest: false, hasPorteStandard: true, hasColorStandard: false, defaultRingGaugeMm: 3.0, description: "Canário de porte volumoso e robusto.", active: true },
  { code: "scotch_fancy", speciesCode: "canario", modality: "PORTE", name: "Scotch Fancy", aliases: ["Glasgow Don"], hasCrest: false, hasPorteStandard: true, hasColorStandard: false, defaultRingGaugeMm: 2.7, description: "Posição em lua crescente, postura característica.", active: true },
  { code: "munchener", speciesCode: "canario", modality: "PORTE", name: "Münchener", aliases: ["Munich"], hasCrest: false, hasPorteStandard: true, hasColorStandard: false, defaultRingGaugeMm: 2.9, description: "Canário de porte alemão raro.", active: true },
  // ─── Canários de Canto ───────────────────────────────────────────────────
  { code: "roller", speciesCode: "canario", modality: "CANTO", name: "Roller (Harzer Roller)", aliases: ["Harzer", "Roller"], hasCrest: false, hasPorteStandard: false, hasColorStandard: false, defaultRingGaugeMm: 2.7, description: "Canto suave e contínuo. Bico fechado durante o canto.", active: true },
  { code: "timbrado", speciesCode: "canario", modality: "CANTO", name: "Timbrado Espanhol", aliases: ["Timbrado"], hasCrest: false, hasPorteStandard: false, hasColorStandard: false, defaultRingGaugeMm: 2.7, description: "Canto metálico, rico em ornamentos.", active: true },
  { code: "waterslager", speciesCode: "canario", modality: "CANTO", name: "Waterslager (Malinois)", aliases: ["Malinois", "Belgisch"], hasCrest: false, hasPorteStandard: false, hasColorStandard: false, defaultRingGaugeMm: 2.7, description: "Canto com notas de água, gargarejo.", active: true },
];

export function getBreedsForSpecies(speciesCode: string): BreedRecord[] {
  return BREED_KNOWLEDGE.filter((b) => b.speciesCode === speciesCode && b.active);
}

export function getBreedsForModality(speciesCode: string, modality: Modality): BreedRecord[] {
  return BREED_KNOWLEDGE.filter((b) => b.speciesCode === speciesCode && b.modality === modality && b.active);
}

export function getBreed(code: string): BreedRecord | undefined {
  return BREED_KNOWLEDGE.find((b) => b.code === code);
}

export function hasCrestedRisk(breedCode: string): boolean {
  const breed = getBreed(breedCode);
  return breed?.hasCrest ?? false;
}
