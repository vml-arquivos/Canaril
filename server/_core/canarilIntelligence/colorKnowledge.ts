/**
 * colorKnowledge.ts — Lipocromos, melaninas, categorias de pena
 */
export type ColorType = "LIPOCHROME" | "MELANIC" | "MIXED" | "WHITE" | "UNKNOWN";

export interface LipochromeRecord {
  code: string;
  name: string;
  description: string;
  requiresPigmentation: boolean; // fator vermelho exige manejo de alimentação
}

export const LIPOCHROMES: LipochromeRecord[] = [
  { code: "amarelo",           name: "Amarelo",               description: "Lipocromo base amarelo, sem fator vermelho.",               requiresPigmentation: false },
  { code: "vermelho",          name: "Vermelho / Laranja",     description: "Lipocromo vermelho. Exige protocolo de pigmentação alimentar para expressão máxima.", requiresPigmentation: true },
  { code: "branco_dominante",  name: "Branco Dominante",       description: "Gene dominante inibe expressão do lipocromo. Homozigoto letal.",                       requiresPigmentation: false },
  { code: "branco_recessivo",  name: "Branco Recessivo",       description: "Gene recessivo. Portadores visuais têm plumagem branca ou quase branca.",              requiresPigmentation: false },
  { code: "marfim_amarelo",    name: "Amarelo Marfim",         description: "Amarelo diluído pelo gene marfim (ligado ao sexo).",        requiresPigmentation: false },
  { code: "marfim_vermelho",   name: "Vermelho Marfim",        description: "Vermelho diluído pelo gene marfim.",                        requiresPigmentation: true },
  { code: "laranja",           name: "Laranja / Intermediário", description: "Tom intermediário entre amarelo e vermelho.",              requiresPigmentation: false },
];

export interface MelaninSeriesRecord {
  code: string;
  name: string;
  type: "EUMELANIC" | "PHEOMELANIC" | "MIXED" | "REDUCED" | "ABSENT";
  description: string;
  inheritanceHint: string;
}

export const MELANIN_SERIES: MelaninSeriesRecord[] = [
  { code: "negro",      name: "Negro",          type: "EUMELANIC",    description: "Melanina negra intensa.",                                inheritanceHint: "Autossômica" },
  { code: "verde",      name: "Verde",          type: "MIXED",        description: "Negro + amarelo = tom verde.",                           inheritanceHint: "Autossômica" },
  { code: "azul",       name: "Azul",           type: "EUMELANIC",    description: "Melanina negra sobre branco.",                           inheritanceHint: "Autossômica" },
  { code: "agata",      name: "Ágata",          type: "EUMELANIC",    description: "Eumelanina com desenho específico, ligada ao sexo.",    inheritanceHint: "Ligada ao sexo" },
  { code: "canela",     name: "Canela",         type: "EUMELANIC",    description: "Eumelanina marrom-avermelhada, ligada ao sexo.",        inheritanceHint: "Ligada ao sexo" },
  { code: "isabelino",  name: "Isabelino",      type: "PHEOMELANIC",  description: "Redução máxima de eumelanina, ligada ao sexo.",         inheritanceHint: "Ligada ao sexo" },
  { code: "pastel",     name: "Pastel",         type: "REDUCED",      description: "Redução parcial da melanina, autossômica.",             inheritanceHint: "Autossômica" },
  { code: "opalino",    name: "Opalino",        type: "MIXED",        description: "Redistribuição da melanina, ligada ao sexo.",           inheritanceHint: "Ligada ao sexo" },
  { code: "topazio",    name: "Topázio",        type: "MIXED",        description: "Combinação opalino+ino sobre branco.",                  inheritanceHint: "Ver regras" },
  { code: "onix",       name: "Ônix",           type: "EUMELANIC",    description: "Melanismo intensificado, autossômico.",                 inheritanceHint: "Autossômica" },
  { code: "cobalto",    name: "Cobalto",        type: "EUMELANIC",    description: "Mutação recente da família do negro.",                  inheritanceHint: "Autossômica" },
  { code: "jaspe",      name: "Jaspe",          type: "REDUCED",      description: "Variante de pastel.",                                   inheritanceHint: "Autossômica" },
  { code: "feo",        name: "Feo",            type: "REDUCED",      description: "Redução da feomelanina.",                               inheritanceHint: "Autossômica" },
  { code: "ino",        name: "Ino (Lutino/Albino)", type: "ABSENT",  description: "Elimina eumelanina. Fêmea não é portadora silenciosa.", inheritanceHint: "Ligada ao sexo" },
  { code: "acetinado",  name: "Acetinado",      type: "REDUCED",      description: "Suavização da melanina, ligada ao sexo.",               inheritanceHint: "Ligada ao sexo" },
  { code: "asas_cinza", name: "Asas Cinza",     type: "REDUCED",      description: "Redução apenas nas rêmiges, ligada ao sexo.",          inheritanceHint: "Ligada ao sexo" },
  { code: "asas_brancas", name: "Asas Brancas", type: "REDUCED",      description: "Rêmiges brancas, autossômica.",                        inheritanceHint: "Autossômica" },
  { code: "pintado",    name: "Pintado / Variegado", type: "MIXED",   description: "Distribuição irregular de melanina.",                   inheritanceHint: "Poligênica" },
  { code: "lipocromico", name: "100% Lipocrômico", type: "ABSENT",    description: "Ausência total de melanina, exibe só lipocromo.",      inheritanceHint: "Ver regras" },
  { code: "melanico",   name: "100% Melânico",  type: "EUMELANIC",    description: "Cobertura total de melanina.",                          inheritanceHint: "Autossômica" },
];

export type FeatherCategory = "intenso" | "nevado" | "mosaico_m" | "mosaico_f" | "mosaico_unknown";

export const FEATHER_CATEGORIES: { code: FeatherCategory; name: string; description: string; warning?: string }[] = [
  { code: "intenso",          name: "Intenso (IT)",          description: "Pigmento lipocrômico uniforme e concentrado. Penas mais curtas.", warning: "Intenso × Intenso: evitar, pode reduzir fertilidade." },
  { code: "nevado",           name: "Nevado (NV)",           description: "Pigmento no centro das penas, bordas claras. Penas mais longas.", },
  { code: "mosaico_m",        name: "Mosaico Macho",         description: "Pigmento restrito a zonas específicas (fronte, ombros, coxa) — macho.", },
  { code: "mosaico_f",        name: "Mosaico Fêmea",         description: "Pigmento restrito a zonas específicas — fêmea.", },
  { code: "mosaico_unknown",  name: "Mosaico (sexo indefinido)", description: "Mosaico sem sexo definido.", },
];

export function getLipohromeByCode(code: string): LipochromeRecord | undefined {
  return LIPOCHROMES.find((l) => l.code === code);
}

export function getMelaninByCode(code: string): MelaninSeriesRecord | undefined {
  return MELANIN_SERIES.find((m) => m.code === code);
}
