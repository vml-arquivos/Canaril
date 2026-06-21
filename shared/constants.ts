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

// ============================================================================
// CATÁLOGOS PARA A SUPERCALCULADORA GENÉTICA DINÂMICA
// ============================================================================

/**
 * Categorias de pena completas (inclui mosaico por sexo)
 */
export const FEATHER_CATEGORIES = [
  { id: "intenso",          name: "Intenso",              description: "Pena curta e lisa, cor concentrada" },
  { id: "nevado",           name: "Nevado / Buff",         description: "Pena longa e macia, borda branca" },
  { id: "mosaico_macho",    name: "Mosaico (Macho)",       description: "Distribuição de cor em manchas — macho" },
  { id: "mosaico_femea",    name: "Mosaico (Fêmea)",       description: "Distribuição de cor em manchas — fêmea" },
  { id: "duplo_nevado",     name: "Duplo Nevado",          description: "Nevado × Nevado — alerta de risco" },
  { id: "desconhecido",     name: "Desconhecido",          description: "Categoria de pena não identificada" },
] as const;

/**
 * Tipos de crista/topete
 */
export const CREST_TYPES = [
  { id: "sem_topete",       name: "Sem Topete / Liso",    description: "Cabeça lisa, sem crista" },
  { id: "com_topete",       name: "Com Topete",            description: "Topete presente (crista)" },
  { id: "corona",           name: "Corona (Gloster)",      description: "Crista circular — Gloster Corona" },
  { id: "consort",          name: "Consort (Gloster)",     description: "Sem crista — Gloster Consort" },
  { id: "crista_plana",     name: "Crista Plana",          description: "Crista achatada (Lancashire, Crest)" },
  { id: "nao_aplicavel",    name: "Não Aplicável",         description: "Raça sem topete por padrão" },
  { id: "desconhecido",     name: "Desconhecido",          description: "Tipo de crista não identificado" },
] as const;

/**
 * Lipocromo base (cor de fundo do canário)
 */
export const LIPOCHROME_BASE = [
  { id: "amarelo",               name: "Amarelo",                  description: "Lipocromo amarelo puro" },
  { id: "amarelo_marfim",        name: "Amarelo-Marfim",           description: "Amarelo diluído pelo gene marfim" },
  { id: "vermelho",              name: "Vermelho",                  description: "Fator vermelho visual" },
  { id: "vermelho_marfim",       name: "Vermelho-Marfim (Rosa)",   description: "Vermelho diluído pelo gene marfim" },
  { id: "laranja_intermediario", name: "Laranja / Intermediário",  description: "Cruzamento vermelho × amarelo" },
  { id: "branco_dominante",      name: "Branco Dominante",         description: "Gene dominante suprime lipocromo" },
  { id: "branco_recessivo",      name: "Branco Recessivo",         description: "Ausência total de lipocromo" },
  { id: "desconhecido",          name: "Desconhecido",             description: "Lipocromo não identificado" },
] as const;

/**
 * Série de melanina (pigmento escuro)
 */
export const MELANIN_SERIES = [
  { id: "negro",         name: "Negro",          description: "Melanina preta dominante" },
  { id: "agata",         name: "Ágata",           description: "Melanina ágata (sex-linked)" },
  { id: "canela",        name: "Canela",          description: "Melanina canela (sex-linked)" },
  { id: "isabel",        name: "Isabelino",       description: "Ágata + Canela combinados" },
  { id: "sem_melanina",  name: "Sem Melanina",    description: "100% lipocrômico" },
  { id: "desconhecido",  name: "Desconhecido",    description: "Melanina não identificada" },
] as const;

/**
 * Níveis de certeza genética (confidence levels)
 */
export const GENETIC_CERTAINTY_LEVELS = [
  { id: "confirmado",              name: "Confirmado",                color: "bg-green-100 text-green-800 border-green-200",   description: "Gene confirmado por classe oficial ou resultado real de ninhada" },
  { id: "inferido_foto",           name: "Inferido pela foto",        color: "bg-blue-100 text-blue-800 border-blue-200",     description: "Inferido por análise visual de foto via IA" },
  { id: "inferido_classe",         name: "Inferido pela classe",      color: "bg-indigo-100 text-indigo-800 border-indigo-200", description: "Inferido pela classe oficial selecionada" },
  { id: "inferido_pedigree",       name: "Inferido pelo pedigree",    color: "bg-violet-100 text-violet-800 border-violet-200", description: "Inferido pelo histórico genealógico" },
  { id: "possivel",                name: "Possível",                  color: "bg-yellow-100 text-yellow-800 border-yellow-200", description: "Possível mas não confirmado" },
  { id: "desconhecido",            name: "Desconhecido",              color: "bg-gray-100 text-gray-600 border-gray-200",     description: "Gene desconhecido — cálculo aproximado" },
  { id: "corrigido_manualmente",   name: "Corrigido manualmente",     color: "bg-orange-100 text-orange-800 border-orange-200", description: "Corrigido pelo criador — prioridade máxima" },
  { id: "nao_aplicavel",           name: "Não Aplicável",             color: "bg-slate-100 text-slate-500 border-slate-200",  description: "Campo não aplicável para esta ave" },
] as const;

export type GeneticCertaintyLevel = typeof GENETIC_CERTAINTY_LEVELS[number]["id"];

/**
 * Definições completas de genes para a calculadora dinâmica.
 * Cada gene tem: herança, grupo, se é ligado ao sexo, se é letal em homozigose.
 */
export const GENE_DEFINITIONS = [
  // ── Ligados ao sexo (ZW) ──────────────────────────────────────────────────
  { id: "agata",          name: "Ágata",                          group: "melanin",    inheritance: "sex_linked_recessive" as InheritanceType, sexLinked: true,  homozygousLethal: false, description: "Dilui melanina preta para ágata" },
  { id: "canela",         name: "Canela (Cinnamon)",              group: "melanin",    inheritance: "sex_linked_recessive" as InheritanceType, sexLinked: true,  homozygousLethal: false, description: "Dilui melanina para tons canela" },
  { id: "isabel",         name: "Isabelino (Ágata + Canela)",     group: "melanin",    inheritance: "sex_linked_recessive" as InheritanceType, sexLinked: true,  homozygousLethal: false, description: "Combinação de ágata e canela" },
  { id: "acetinado",      name: "Acetinado (Satinê)",             group: "melanin",    inheritance: "sex_linked_recessive" as InheritanceType, sexLinked: true,  homozygousLethal: false, description: "Reduz melanina, pena brilhante" },
  { id: "asas_cinza",     name: "Asas Cinza",                     group: "melanin",    inheritance: "sex_linked_recessive" as InheritanceType, sexLinked: true,  homozygousLethal: false, description: "Asas com melanina cinza reduzida" },
  { id: "ino",            name: "Ino (Lutino / Albino / Rubino)", group: "melanin",    inheritance: "sex_linked_recessive" as InheritanceType, sexLinked: true,  homozygousLethal: false, description: "Elimina melanina — resultado depende do lipocromo" },
  { id: "marfim",         name: "Marfim",                         group: "lipochrome", inheritance: "sex_linked_recessive" as InheritanceType, sexLinked: true,  homozygousLethal: false, description: "Dilui amarelo→marfim, vermelho→rosa" },
  // ── Autossômicas recessivas ────────────────────────────────────────────────
  { id: "pastel",         name: "Pastel",                         group: "melanin",    inheritance: "autosomal_recessive"  as InheritanceType, sexLinked: false, homozygousLethal: false, description: "Dilui melanina para tons pastel" },
  { id: "opala",          name: "Opalino (Opala)",                group: "melanin",    inheritance: "autosomal_recessive"  as InheritanceType, sexLinked: false, homozygousLethal: false, description: "Redistribui melanina — efeito opalescente" },
  { id: "branco_recessivo", name: "Branco Recessivo",             group: "lipochrome", inheritance: "autosomal_recessive"  as InheritanceType, sexLinked: false, homozygousLethal: false, description: "Suprime lipocromo — portador invisível" },
  { id: "feo",            name: "Feo",                            group: "melanin",    inheritance: "autosomal_recessive"  as InheritanceType, sexLinked: false, homozygousLethal: false, description: "Elimina melanina preta, mantém marrom" },
  { id: "topazio",        name: "Topázio",                        group: "melanin",    inheritance: "autosomal_recessive"  as InheritanceType, sexLinked: false, homozygousLethal: false, description: "Mutação de melanina — efeito topázio" },
  // ── Autossômicas dominantes ────────────────────────────────────────────────
  { id: "crista",         name: "Crista / Topete",                group: "structure",  inheritance: "autosomal_dominant"   as InheritanceType, sexLinked: false, homozygousLethal: true,  description: "Topete/crista — homozigoto letal (~25% não viáveis)" },
  { id: "branco_dominante", name: "Branco Dominante",             group: "lipochrome", inheritance: "autosomal_dominant"   as InheritanceType, sexLinked: false, homozygousLethal: true,  description: "Suprime lipocromo — homozigoto letal" },
  { id: "plumagem",       name: "Plumagem (Nevado/Intenso)",      group: "structure",  inheritance: "autosomal_dominant"   as InheritanceType, sexLinked: false, homozygousLethal: false, description: "Controla tipo de pena" },
] as const;

export type GeneId = typeof GENE_DEFINITIONS[number]["id"];

/**
 * Regras de cruzamento obrigatórias (genética honesta)
 */
export const PAIRING_RULES = [
  {
    id: "branco_dom_x_branco_dom",
    label: "Branco Dominante × Branco Dominante",
    level: "danger" as const,
    message: "25% dos filhotes serão não viáveis (homozigoto letal). Evite este cruzamento.",
    genes: ["branco_dominante"],
  },
  {
    id: "crista_x_crista",
    label: "Crista × Crista (Topetado × Topetado)",
    level: "danger" as const,
    message: "~25% dos filhotes serão não viáveis. Sempre cruzar topetado com liso.",
    genes: ["crista"],
  },
  {
    id: "nevado_x_nevado",
    label: "Nevado × Nevado",
    level: "warning" as const,
    message: "Duplo nevado — filhotes podem ter plumagem excessiva e problemas de fertilidade.",
    genes: ["plumagem"],
  },
  {
    id: "intenso_x_intenso",
    label: "Intenso × Intenso",
    level: "info" as const,
    message: "Pode reduzir qualidade de pena nas gerações seguintes. Prefira intenso × nevado.",
    genes: ["plumagem"],
  },
  {
    id: "vermelho_x_amarelo",
    label: "Vermelho × Amarelo",
    level: "info" as const,
    message: "Filhotes intermediários (laranja). Alimentação pigmentante não altera o genótipo.",
    genes: [],
  },
] as const;

/**
 * Prioridade de fontes de informação genética
 * (maior número = maior prioridade)
 */
export const GENETIC_SOURCE_PRIORITY = [
  { id: "manual_override",    name: "Correção manual do criador",   priority: 6 },
  { id: "offspring_result",   name: "Resultado real de ninhada",    priority: 5 },
  { id: "pedigree",           name: "Pedigree confirmado",          priority: 4 },
  { id: "official_class",     name: "Classe oficial selecionada",   priority: 3 },
  { id: "photo_ai",           name: "Análise por foto (IA)",        priority: 2 },
  { id: "generic_suggestion", name: "Sugestão genérica",            priority: 1 },
] as const;

/**
 * Modalidades do sistema FOB/OBJO
 */
export const BIRD_MODALITIES = [
  { id: "COR",   name: "Canário de Cor",   description: "Classificado por cor e mutações" },
  { id: "PORTE", name: "Canário de Porte", description: "Classificado por raça e conformação" },
] as const;
