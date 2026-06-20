/**
 * Constantes e dados pré-carregados para o sistema de gestão de canários
 */

export const SPECIALTIES = [
  { id: "gloster_corona", name: "Gloster Corona", description: "Corpo compacto com crista proeminente", size: "11-12 cm", weight: "12-29g" },
  { id: "gloster_consort", name: "Gloster Consort", description: "Sem crista, cabeça lisa", size: "11-12 cm", weight: "12-29g" },
  { id: "holandês", name: "Holandês", description: "Raça de porte, corpo alongado", size: "13-14 cm", weight: "30-40g" },
  { id: "frisado_norte", name: "Frisado do Norte", description: "Plumagem ondulada, origem holandesa", size: "12-13 cm", weight: "20-35g" },
  { id: "frisado_sul", name: "Frisado do Sul", description: "Plumagem ondulada", size: "12-13 cm", weight: "20-35g" },
  { id: "belga_clássico", name: "Belga Clássico", description: "Raça de porte clássica", size: "13-14 cm", weight: "30-40g" },
  // Raças adicionadas a partir do manual de referência de genética —
  // mantidas com ids novos, não alteram nenhuma das 6 acima.
  { id: "fife", name: "Fife Fancy", description: "Menor canário de forma, corpo arredondado e plumagem sedosa", size: "11-12 cm", weight: "13-15g" },
  { id: "border", name: "Border Fancy", description: "Corpo compacto e arredondado, deve parecer uma bola de qualquer ângulo", size: "até 14,6 cm", weight: "16-20g" },
  { id: "norwich", name: "Norwich", description: "Corpo robusto e \"cobby\", cabeça larga, plumagem densa (nevado/duplo nevado)", size: "~17 cm", weight: "26-28g" },
  { id: "yorkshire", name: "Yorkshire", description: "Postura ereta (~80°), corpo alongado, peito largo, cintura estreita", size: "mín. 17 cm", weight: "20-24g" },
  { id: "lizard", name: "Lizard (Canário Lagarto)", description: "Plumagem espanglada (escamada) nas costas, variantes ouro e prata", size: "~14 cm", weight: "15-18g" },
  { id: "belga_antigo", name: "Belgian Fancy (Belga Antigo / Bossu)", description: "Postura arqueada (hunchback), pescoço longo e fino, pernas longas", size: "~16-17 cm", weight: "18-22g" },
  { id: "scots", name: "Scots Fancy (Escocês)", description: "Corpo em forma de \"C\", dorso curvo, postura inclinada", size: "~15-17 cm", weight: "16-20g" },
  { id: "crest", name: "Crest (Crestado Antigo / Coppy)", description: "Grande, plumagem profusa; variantes coppy (crista) e plainhead", size: "~16-17 cm", weight: "24-28g" },
  { id: "lancashire", name: "Lancashire", description: "Maior raça inglesa, corpo longo, postura ereta; coppy ou plainhead", size: "~20 cm", weight: "28-32g" },
  { id: "frisado_parisiense", name: "Frill (Frisé Parisiense)", description: "Penas encaracoladas (frisé) por todo o corpo", size: "17-22 cm", weight: "25-30g" },
] as const;

export const COLORS = [
  { id: "amarelo_intenso", name: "Amarelo Intenso", category: "Amarelo", genetics: "Recessivo" },
  { id: "amarelo_nevado", name: "Amarelo Nevado", category: "Amarelo", genetics: "Dominante" },
  { id: "amarelo_mosaico", name: "Amarelo Mosaico", category: "Amarelo", genetics: "Ligado ao sexo" },
  { id: "vermelho_intenso", name: "Vermelho Intenso", category: "Vermelho", genetics: "Recessivo" },
  { id: "vermelho_nevado", name: "Vermelho Nevado", category: "Vermelho", genetics: "Dominante" },
  { id: "vermelho_mosaico", name: "Vermelho Mosaico", category: "Vermelho", genetics: "Ligado ao sexo" },
  { id: "branco", name: "Branco", category: "Branco", genetics: "Dominante" },
  { id: "prateado", name: "Prateado", category: "Branco", genetics: "Recessivo" },
  { id: "opalino", name: "Opalino", category: "Mutação", genetics: "Recessivo" },
  { id: "feo", name: "Feo", category: "Mutação", genetics: "Recessivo" },
  { id: "topázio", name: "Topázio", category: "Mutação", genetics: "Recessivo" },
  { id: "albino", name: "Albino", category: "Mutação", genetics: "Recessivo" },
  { id: "lutino", name: "Lutino", category: "Mutação", genetics: "Recessivo" },
] as const;

export const SEXES = [
  { id: "macho", name: "Macho" },
  { id: "fêmea", name: "Fêmea" },
  { id: "indeterminado", name: "Indeterminado" },
] as const;

export const STATUSES = [
  { id: "ativo", name: "Ativo", color: "bg-green-100 text-green-800" },
  { id: "vendido", name: "Vendido", color: "bg-blue-100 text-blue-800" },
  { id: "falecido", name: "Falecido", color: "bg-red-100 text-red-800" },
] as const;

export const RING_STATUSES = [
  { id: "disponível", name: "Disponível", color: "bg-green-100 text-green-800" },
  { id: "em_uso", name: "Em Uso", color: "bg-yellow-100 text-yellow-800" },
  { id: "estoque", name: "Estoque", color: "bg-gray-100 text-gray-800" },
] as const;

export const COUPLE_STATUSES = [
  { id: "ativo", name: "Ativo", color: "bg-green-100 text-green-800" },
  { id: "inativo", name: "Inativo", color: "bg-gray-100 text-gray-800" },
  { id: "finalizado", name: "Finalizado", color: "bg-red-100 text-red-800" },
] as const;

/**
 * Validações genéticas para cruzamentos
 */
export const GENETIC_RULES = {
  recommended: [
    { male: "amarelo_intenso", female: "amarelo_intenso", note: "Cruzamento recomendado" },
    { male: "gloster_corona", female: "gloster_consort", note: "Cruzamento recomendado para produção de ambas as variedades" },
    { male: "vermelho_intenso", female: "vermelho_intenso", note: "Cruzamento recomendado" },
  ],
  warning: [
    { male: "branco", female: "branco", note: "Pode gerar filhotes com problemas auditivos" },
    { male: "amarelo_nevado", female: "amarelo_nevado", note: "Pode resultar em filhotes muito claros" },
    { male: "albino", female: "albino", note: "Cruzamento de alto risco" },
  ],
  forbidden: [
    { male: "branco", female: "branco", note: "Branco Dominante x Branco Dominante - PROIBIDO" },
  ],
};

/**
 * Cores possíveis por especialidade
 */
export const COLORS_BY_SPECIALTY: Record<string, string[]> = {
  gloster_corona: ["amarelo_intenso", "amarelo_nevado", "amarelo_mosaico", "vermelho_intenso", "vermelho_nevado", "vermelho_mosaico", "branco", "prateado"],
  gloster_consort: ["amarelo_intenso", "amarelo_nevado", "amarelo_mosaico", "vermelho_intenso", "vermelho_nevado", "vermelho_mosaico", "branco", "prateado"],
  holandês: ["amarelo_intenso", "amarelo_nevado", "vermelho_intenso", "vermelho_nevado", "branco", "prateado"],
  frisado_norte: ["amarelo_intenso", "amarelo_nevado", "vermelho_intenso", "vermelho_nevado", "branco"],
  frisado_sul: ["amarelo_intenso", "amarelo_nevado", "vermelho_intenso", "vermelho_nevado", "branco"],
  belga_clássico: ["amarelo_intenso", "amarelo_nevado", "vermelho_intenso", "vermelho_nevado", "branco", "prateado"],
};

export const BREEDER_INFO = {
  name: "Canário Lima",
  city: "Brasília",
  state: "DF",
  description: "Criadouro profissional especializado em Canários Belga com foco em qualidade genética e bem-estar animal.",
  phone: "(61) 9999-9999",
  email: "contato@canarioslima.com.br",
  website: "www.canarioslima.com.br",
};

/**
 * Módulo de Genética e Cruzamentos — catálogos baseados no manual de
 * referência (genética de canários: lipocromo, melaninas, mutações
 * autossômicas e ligadas ao sexo). Independente do COLORS acima (que
 * continua sendo a cor "de exibição" simples já usada em todo o
 * sistema) — esses catálogos alimentam o motor de cruzamento mendeliano
 * (server/_core/mendelian.ts), no genótipo opcional de cada pássaro.
 */
export type InheritanceType = "autosomal_dominant" | "autosomal_recessive" | "sex_linked_recessive";

export const MELANIN_MUTATIONS = [
  { id: "agata", name: "Ágata", inheritance: "sex_linked_recessive" as InheritanceType },
  { id: "canela", name: "Canela (Cinnamon)", inheritance: "sex_linked_recessive" as InheritanceType },
  { id: "isabel", name: "Isabel", inheritance: "sex_linked_recessive" as InheritanceType },
  { id: "pastel", name: "Pastel", inheritance: "sex_linked_recessive" as InheritanceType },
  { id: "acetinado", name: "Acetinado (Satinê)", inheritance: "sex_linked_recessive" as InheritanceType },
  { id: "asas_cinza", name: "Asas Cinza", inheritance: "sex_linked_recessive" as InheritanceType },
  { id: "opala", name: "Opala (Opal)", inheritance: "autosomal_recessive" as InheritanceType },
  { id: "feo_mutacao", name: "Feo", inheritance: "autosomal_recessive" as InheritanceType },
  { id: "topazio_mutacao", name: "Topázio", inheritance: "autosomal_recessive" as InheritanceType },
  { id: "ino_lipocromico", name: "Ino Lipocrômico", inheritance: "sex_linked_recessive" as InheritanceType },
] as const;

export const LIPOCHROME_MUTATIONS = [
  { id: "marfim", name: "Marfim (dilui amarelo→marfim, vermelho→rosa)", inheritance: "sex_linked_recessive" as InheritanceType },
  { id: "branco_dominante_mut", name: "Branco Dominante", inheritance: "autosomal_dominant" as InheritanceType, homozygousLethal: true },
] as const;

export const BACKGROUND_COLORS = [
  { id: "amarelo", name: "Amarelo" },
  { id: "amarelo_marfim", name: "Amarelo-Marfim" },
  { id: "vermelho", name: "Vermelho" },
  { id: "vermelho_marfim", name: "Vermelho-Marfim (Rosa)" },
  { id: "branco_recessivo", name: "Branco (ausência total de lipocromo)" },
  { id: "branco_dominante_bg", name: "Branco Dominante (traços nas bordas)" },
] as const;

export const FEATHER_TYPES = [
  { id: "intenso", name: "Intenso (pena curta e lisa)" },
  { id: "nevado", name: "Nevado / Buff (pena longa e macia)" },
] as const;
