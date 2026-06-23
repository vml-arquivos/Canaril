/**
 * speciesKnowledge.ts — Base de conhecimento de espécies
 */
export type SexSystem = "ZZ_ZW" | "XY" | "UNKNOWN";

export interface SpeciesRecord {
  code: string;
  commonName: string;
  scientificName: string;
  groupName: string;
  defaultSexSystem: SexSystem;
  notes: string;
  active: boolean;
}

export const SPECIES_KNOWLEDGE: SpeciesRecord[] = [
  {
    code: "canario",
    commonName: "Canário doméstico",
    scientificName: "Serinus canaria domestica",
    groupName: "Fringilídeos",
    defaultSexSystem: "ZZ_ZW",
    notes: "Principal espécie de criadouro. Sistema ZZ/ZW: machos ZZ, fêmeas ZW. Genes ligados ao sexo seguem lógica diferente dos mamíferos.",
    active: true,
  },
];

export function getSpecies(code: string): SpeciesRecord | undefined {
  return SPECIES_KNOWLEDGE.find((s) => s.code === code);
}

export function getActiveSpecies(): SpeciesRecord[] {
  return SPECIES_KNOWLEDGE.filter((s) => s.active);
}
