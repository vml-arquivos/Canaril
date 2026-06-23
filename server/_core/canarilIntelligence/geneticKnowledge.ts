/**
 * geneticKnowledge.ts — Mutações, regras genéticas e validações
 */
export type InheritanceType =
  | "AUTOSOMAL_DOMINANT"
  | "AUTOSOMAL_RECESSIVE"
  | "SEX_LINKED_RECESSIVE"
  | "POLYGENIC"
  | "CONFIGURABLE"
  | "UNKNOWN";

export interface MutationRecord {
  code: string;
  speciesCode: string;
  name: string;
  aliases: string[];
  inheritanceType: InheritanceType;
  allowsCarrierMale: boolean;
  allowsCarrierFemale: boolean; // ZZ/ZW: fêmea ZW nunca é portadora silenciosa de ligada ao sexo
  hasLethalDoubleFactor: boolean;
  visibleStates: string[];
  carrierStates: string[];
  description: string;
  warnings: string;
}

export const MUTATIONS: MutationRecord[] = [
  {
    code: "branco_dominante",
    speciesCode: "canario",
    name: "Branco Dominante",
    aliases: ["BD", "Dominant White"],
    inheritanceType: "AUTOSOMAL_DOMINANT",
    allowsCarrierMale: false,   // dominante: sem portador oculto
    allowsCarrierFemale: false,
    hasLethalDoubleFactor: true,
    visibleStates: ["homozygous_mutant_lethal", "heterozygous_carrier"],
    carrierStates: [],
    description: "Gene dominante que inibe expressão do lipocromo. Heterozigoto: visual. Homozigoto: letal.",
    warnings: "RISCO LETAL: Branco Dominante × Branco Dominante produz 25% de embriões inviáveis. Nunca cruzar dois portadores.",
  },
  {
    code: "branco_recessivo",
    speciesCode: "canario",
    name: "Branco Recessivo",
    aliases: ["BR", "Recessive White"],
    inheritanceType: "AUTOSOMAL_RECESSIVE",
    allowsCarrierMale: true,
    allowsCarrierFemale: true,
    hasLethalDoubleFactor: false,
    visibleStates: ["homozygous_mutant"],
    carrierStates: ["heterozygous_carrier"],
    description: "Gene recessivo. Portadores parecem normais mas transmitem o gene. Cruzamento portador × portador = 25% visual.",
    warnings: "Portador × portador = 25% branco recessivo visual, 50% portadores, 25% normais.",
  },
  {
    code: "marfim",
    speciesCode: "canario",
    name: "Marfim",
    aliases: ["Ivory"],
    inheritanceType: "SEX_LINKED_RECESSIVE",
    allowsCarrierMale: true,
    allowsCarrierFemale: false,
    hasLethalDoubleFactor: false,
    visibleStates: ["homozygous_mutant", "hemizygous_female"],
    carrierStates: ["heterozygous_carrier"],
    description: "Dilui o lipocromo (amarelo→marfim, vermelho→salmão). Ligado ao sexo: machos podem ser portadores, fêmeas ZW não.",
    warnings: "Fêmea não é portadora silenciosa. Macho portador transmite para metade das filhas (visuais) e metade dos filhos (portadores).",
  },
  {
    code: "agata",
    speciesCode: "canario",
    name: "Ágata",
    aliases: ["Agate"],
    inheritanceType: "SEX_LINKED_RECESSIVE",
    allowsCarrierMale: true,
    allowsCarrierFemale: false,
    hasLethalDoubleFactor: false,
    visibleStates: ["homozygous_mutant", "hemizygous_female"],
    carrierStates: ["heterozygous_carrier"],
    description: "Eumelanina com desenho diferenciado. Ligada ao sexo.",
    warnings: "Fêmea não é portadora silenciosa.",
  },
  {
    code: "canela",
    speciesCode: "canario",
    name: "Canela",
    aliases: ["Cinnamon"],
    inheritanceType: "SEX_LINKED_RECESSIVE",
    allowsCarrierMale: true,
    allowsCarrierFemale: false,
    hasLethalDoubleFactor: false,
    visibleStates: ["homozygous_mutant", "hemizygous_female"],
    carrierStates: ["heterozygous_carrier"],
    description: "Eumelanina marrom-avermelhada. Ligada ao sexo.",
    warnings: "Fêmea não é portadora silenciosa.",
  },
  {
    code: "isabelino",
    speciesCode: "canario",
    name: "Isabelino",
    aliases: ["Isabel"],
    inheritanceType: "SEX_LINKED_RECESSIVE",
    allowsCarrierMale: true,
    allowsCarrierFemale: false,
    hasLethalDoubleFactor: false,
    visibleStates: ["homozygous_mutant", "hemizygous_female"],
    carrierStates: ["heterozygous_carrier"],
    description: "Redução máxima de eumelanina. Combinação de ágata + canela.",
    warnings: "Fêmea não é portadora silenciosa. Requer ambas as mutações para expressão.",
  },
  {
    code: "ino",
    speciesCode: "canario",
    name: "Ino (Lutino / Albino)",
    aliases: ["Lutino", "Albino", "Ino"],
    inheritanceType: "SEX_LINKED_RECESSIVE",
    allowsCarrierMale: true,
    allowsCarrierFemale: false,
    hasLethalDoubleFactor: false,
    visibleStates: ["homozygous_mutant", "hemizygous_female"],
    carrierStates: ["heterozygous_carrier"],
    description: "Elimina toda eumelanina. Sobre amarelo = lutino. Sobre branco = albino.",
    warnings: "Fêmea não é portadora silenciosa.",
  },
  {
    code: "opalino",
    speciesCode: "canario",
    name: "Opalino",
    aliases: ["Opal"],
    inheritanceType: "SEX_LINKED_RECESSIVE",
    allowsCarrierMale: true,
    allowsCarrierFemale: false,
    hasLethalDoubleFactor: false,
    visibleStates: ["homozygous_mutant", "hemizygous_female"],
    carrierStates: ["heterozygous_carrier"],
    description: "Redistribui melanina com efeito opaco, ligada ao sexo.",
    warnings: "Fêmea não é portadora silenciosa.",
  },
  {
    code: "acetinado",
    speciesCode: "canario",
    name: "Acetinado",
    aliases: ["Satin"],
    inheritanceType: "SEX_LINKED_RECESSIVE",
    allowsCarrierMale: true,
    allowsCarrierFemale: false,
    hasLethalDoubleFactor: false,
    visibleStates: ["homozygous_mutant", "hemizygous_female"],
    carrierStates: ["heterozygous_carrier"],
    description: "Suaviza a melanina, efeito acetinado. Ligada ao sexo.",
    warnings: "Fêmea não é portadora silenciosa.",
  },
  {
    code: "asas_cinza",
    speciesCode: "canario",
    name: "Asas Cinza",
    aliases: ["Greywing"],
    inheritanceType: "SEX_LINKED_RECESSIVE",
    allowsCarrierMale: true,
    allowsCarrierFemale: false,
    hasLethalDoubleFactor: false,
    visibleStates: ["homozygous_mutant", "hemizygous_female"],
    carrierStates: ["heterozygous_carrier"],
    description: "Rêmiges acinzentadas. Ligada ao sexo.",
    warnings: "Fêmea não é portadora silenciosa.",
  },
  {
    code: "pastel",
    speciesCode: "canario",
    name: "Pastel",
    aliases: [],
    inheritanceType: "AUTOSOMAL_RECESSIVE",
    allowsCarrierMale: true,
    allowsCarrierFemale: true,
    hasLethalDoubleFactor: false,
    visibleStates: ["homozygous_mutant"],
    carrierStates: ["heterozygous_carrier"],
    description: "Redução parcial de eumelanina, autossômica. Ambos os sexos podem ser portadores.",
    warnings: "Portador × portador = 25% visual.",
  },
  {
    code: "onix",
    speciesCode: "canario",
    name: "Ônix",
    aliases: ["Onyx"],
    inheritanceType: "AUTOSOMAL_RECESSIVE",
    allowsCarrierMale: true,
    allowsCarrierFemale: true,
    hasLethalDoubleFactor: false,
    visibleStates: ["homozygous_mutant"],
    carrierStates: ["heterozygous_carrier"],
    description: "Melanismo intensificado, autossômico.",
    warnings: "Portador × portador = 25% visual.",
  },
  {
    code: "asas_brancas",
    speciesCode: "canario",
    name: "Asas Brancas",
    aliases: ["Whitewings"],
    inheritanceType: "AUTOSOMAL_RECESSIVE",
    allowsCarrierMale: true,
    allowsCarrierFemale: true,
    hasLethalDoubleFactor: false,
    visibleStates: ["homozygous_mutant"],
    carrierStates: ["heterozygous_carrier"],
    description: "Rêmiges brancas, autossômica.",
    warnings: "Portador × portador = 25% visual.",
  },
  {
    code: "crista",
    speciesCode: "canario",
    name: "Crista / Topete",
    aliases: ["Crest", "Topete"],
    inheritanceType: "AUTOSOMAL_DOMINANT",
    allowsCarrierMale: false,
    allowsCarrierFemale: false,
    hasLethalDoubleFactor: true,
    visibleStates: ["heterozygous_carrier"],
    carrierStates: [],
    description: "Gene dominante. Heterozigoto: com topete. Homozigoto: letal.",
    warnings: "RISCO LETAL: Topetado × Topetado produz 25% de embriões inviáveis. Sempre cruzar topetado × liso.",
  },
];

export function getMutation(code: string): MutationRecord | undefined {
  return MUTATIONS.find((m) => m.code === code);
}

export function getMutationsForSpecies(speciesCode: string): MutationRecord[] {
  return MUTATIONS.filter((m) => m.speciesCode === speciesCode);
}

export function isLethalCrossing(
  maleCode: string,
  femaleCode: string,
  maleMuts: Array<{ mutation: string; zygosity: string }>,
  femaleMuts: Array<{ mutation: string; zygosity: string }>
): Array<{ mutation: string; warning: string }> {
  const alerts: Array<{ mutation: string; warning: string }> = [];

  for (const mut of MUTATIONS.filter((m) => m.hasLethalDoubleFactor)) {
    const maleHas = maleMuts.some((m) => m.mutation === mut.code && m.zygosity !== "homozygous_normal");
    const femaleHas = femaleMuts.some((m) => m.mutation === mut.code && m.zygosity !== "homozygous_normal");
    if (maleHas && femaleHas) {
      alerts.push({ mutation: mut.code, warning: mut.warnings });
    }
  }

  return alerts;
}

export function canFemaleBeCarrier(mutationCode: string): boolean {
  const mut = getMutation(mutationCode);
  if (!mut) return false;
  return mut.allowsCarrierFemale;
}

export function getValidZygosities(mutationCode: string, sex: "macho" | "fêmea"): string[] {
  const mut = getMutation(mutationCode);
  if (!mut) return ["homozygous_normal", "homozygous_mutant", "heterozygous_carrier"];

  const states: string[] = ["homozygous_normal"];

  if (mut.inheritanceType === "SEX_LINKED_RECESSIVE") {
    if (sex === "macho") {
      states.push("homozygous_mutant", "heterozygous_carrier");
    } else {
      // fêmea ZW: visual ou normal, não portadora silenciosa
      states.push("hemizygous_female_mutant");
    }
  } else if (mut.inheritanceType === "AUTOSOMAL_DOMINANT") {
    states.push("heterozygous_carrier"); // visual dominante
    // homozigoto dominante = letal, não oferece
  } else {
    if (mut.allowsCarrierMale && sex === "macho") states.push("heterozygous_carrier");
    if (mut.allowsCarrierFemale && sex === "fêmea") states.push("heterozygous_carrier");
    states.push("homozygous_mutant");
  }

  return states;
}
