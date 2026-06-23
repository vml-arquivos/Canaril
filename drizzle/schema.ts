// Use PostgreSQL-specific table and column types. We switch from the MySQL
// dialect (`mysqlTable`, `int`, etc.) to the PostgreSQL dialect provided by
// `drizzle-orm/pg-core`. The `serial` helper defines an auto-incrementing
// primary key, and `integer` represents standard integer columns. Other
// helpers (varchar, text, timestamp, index) remain the same API across
// dialects.
import { serial, integer, varchar, text, timestamp, date, pgTable, index, jsonb, boolean, real } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Estrutura de um possível resultado de cruzamento, usada pela calculadora
 * de matriz (Matchmaker). Armazenada como JSONB em genetic_rules.
 */
export type GeneticOutcome = {
  color_code: string;
  probability: number; // 0-100
  sex_linked: boolean;
  notes?: string;
};

/**
 * Estrutura de um critério avaliado em uma pontuação (juiz humano ou IA).
 * Armazenada como JSONB em scores.criteria_scores e
 * ai_judge_analyses.criteria_scores.
 */
export type CriteriaScore = {
  criterion: string; // ex: "Plumagem", "Postura", "Cor"
  score: number;
  maxScore: number;
  comment?: string;
};

/**
 * Tabela de Usuários (OAuth)
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 20 }).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  deletedAt: timestamp("deletedAt"),
  deletedBy: integer("deletedBy"),
});

/**
 * Tabela de Especialidades de Canários
 */
export const specialties = pgTable("specialties", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  size_cm: varchar("size_cm", { length: 20 }),
  weight_g: varchar("weight_g", { length: 20 }),
  // Referência ao padrão oficial (FOB/OBJO/COM). Mantido como campo de
  // texto livre, alimentado manualmente a partir das tabelas publicadas por
  // cada órgão — essas entidades não oferecem API pública para sincronizar
  // automaticamente.
  official_code: varchar("official_code", { length: 50 }),
  official_body: varchar("official_body", { length: 20 }),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  codeIdx: index("specialties_code_idx").on(table.code),
}));

/**
 * Tabela de Cores e Mutações
 */
export const colors = pgTable("colors", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  genetics: varchar("genetics", { length: 50 }),
  description: text("description"),
  official_code: varchar("official_code", { length: 50 }),
  official_body: varchar("official_body", { length: 20 }),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  codeIdx: index("colors_code_idx").on(table.code),
}));

/**
 * Tabela de Criadores
 */
export const breeders = pgTable("breeders", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 2 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  registration_number: varchar("registration_number", { length: 50 }).unique(),
  association: varchar("association", { length: 200 }),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 100 }),
  website: varchar("website", { length: 200 }),
  description: text("description"),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

/**
 * Tabela de Lotes de Anilhas
 */
export const ring_batches = pgTable("ring_batches", {
  id: serial("id").primaryKey(),
  batch_number: varchar("batch_number", { length: 50 }).notNull(),
  year: integer("year").notNull(),
  color: varchar("color", { length: 50 }).notNull(),
  quantity_total: integer("quantity_total").notNull(),
  quantity_used: integer("quantity_used").default(0).notNull(),
  status: varchar("status", { length: 20 }).default("available").notNull(),
  // Campos expandidos para sistema de anilhas profissional
  breederCode: varchar("breederCode", { length: 50 }),
  associationName: varchar("associationName", { length: 100 }),
  speciesName: varchar("speciesName", { length: 50 }),
  breedName: varchar("breedName", { length: 100 }),
  modality: varchar("modality", { length: 20 }),
  ringGaugeMm: real("ringGaugeMm"),
  month: integer("month"),
  prefix: varchar("prefix", { length: 20 }),
  suffix: varchar("suffix", { length: 20 }),
  startNumber: integer("startNumber").default(1).notNull(),
  endNumber: integer("endNumber").default(200).notNull(),
  currentNumber: integer("currentNumber").default(1).notNull(),
  formatPattern: varchar("formatPattern", { length: 100 }).default("{breederCode}-{year}-{seq}").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  batchIdx: index("ring_batches_batch_idx").on(table.batch_number),
  batchYearIdx: index("ring_batches_year_idx").on(table.year),
  batchStatusIdx: index("ring_batches_status_idx").on(table.status),
}));

/**
 * Tabela de Pássaros
 */
export const birds = pgTable("birds", {
  id: serial("id").primaryKey(),
  ring: varchar("ring", { length: 50 }).notNull().unique(),
  // Título humano gerado automaticamente para identificação rápida no plantel.
  // Ex.: GF-003-2026-027 — Gloster Consort — Opalino — Macho
  displayTitle: varchar("displayTitle", { length: 250 }),
  // Apelido opcional escolhido pelo criador, sem substituir a anilha oficial.
  nickname: varchar("nickname", { length: 100 }),
  // Campos de classificação evoluída. Mantidos nullable para compatibilidade
  // total com os pássaros já cadastrados antes da ficha genética oficial.
  speciesName: varchar("speciesName", { length: 50 }).default("Canário"),
  modality: varchar("modality", { length: 20 }), // COR | PORTE | CANTO | OUTRA
  breedName: varchar("breedName", { length: 100 }),
  officialClassId: integer("officialClassId"),
  specialty_code: varchar("specialty_code", { length: 50 }).notNull(),
  sex: varchar("sex", { length: 20 }).notNull(),
  color_code: varchar("color_code", { length: 50 }).notNull(),
  birthDate: timestamp("birthDate"),
  procedence: varchar("procedence", { length: 200 }),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  fatherId: integer("fatherId"),
  motherId: integer("motherId"),
  // Gaiola atual do pássaro (mapeamento espacial do criadouro). Mantido
  // nullable: nem todo pássaro precisa estar alocado no momento do cadastro.
  cageId: integer("cageId"),
  // Controla se o pássaro aparece na vitrine pública (Home/Showroom).
  isPublic: boolean("isPublic").default(false).notNull(),
  // Código público único para QR Code — gerado pelo backend, nullable até ser ativado.
  publicCode: varchar("publicCode", { length: 20 }).unique(),
  deletedAt: timestamp("deletedAt"),
  deletedBy: integer("deletedBy"),
  deleteReason: text("deleteReason"),
  updatedBy: integer("updatedBy"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  ringIdx: index("birds_ring_idx").on(table.ring),
  displayTitleIdx: index("birds_display_title_idx").on(table.displayTitle),
  officialClassIdx: index("birds_official_class_idx").on(table.officialClassId),
  speciesIdx: index("birds_species_idx").on(table.speciesName),
  modalityIdx: index("birds_modality_idx").on(table.modality),
  specialtyIdx: index("birds_specialty_idx").on(table.specialty_code),
  colorIdx: index("birds_color_idx").on(table.color_code),
  cageIdx: index("birds_cage_idx").on(table.cageId),
}));

/**
 * Tabela de Casais/Cruzamentos
 */
export const couples = pgTable("couples", {
  id: serial("id").primaryKey(),
  maleId: integer("maleId").notNull(),
  femaleId: integer("femaleId").notNull(),
  cageNumber: varchar("cageNumber", { length: 50 }).notNull(),
  // FK relacional para "cages", em paralelo ao cageNumber (texto livre)
  // existente — mantido nullable para não quebrar casais já cadastrados
  // antes desta tabela existir.
  cageId: integer("cageId"),
  formationDate: timestamp("formationDate").notNull(),
  deletedAt: timestamp("deletedAt"),
  deletedBy: integer("deletedBy"),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  cageIdx: index("couples_cage_idx").on(table.cageNumber),
  statusIdx: index("couples_status_idx").on(table.status),
}));

/**
 * Tabela de Posturas
 */
export const clutches = pgTable("clutches", {
  id: serial("id").primaryKey(),
  coupleId: integer("coupleId").notNull(),
  clutchDate: timestamp("clutchDate").notNull(),
  totalEggs: integer("totalEggs").notNull(),
  fertilizedEggs: integer("fertilizedEggs").notNull(),
  infertileEggs: integer("infertileEggs").default(0).notNull(),
  lostEggs: integer("lostEggs").default(0).notNull(),
  hatchedChicks: integer("hatchedChicks").default(0).notNull(),
  deletedAt: timestamp("deletedAt"),
  deletedBy: integer("deletedBy"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  coupleIdx: index("clutches_couple_idx").on(table.coupleId),
}));

/**
 * Tabela de Filhotes
 */
export const chicks = pgTable("chicks", {
  id: serial("id").primaryKey(),
  clutchId: integer("clutchId").notNull(),
  ring: varchar("ring", { length: 50 }).notNull().unique(),
  sex: varchar("sex", { length: 20 }).notNull(),
  color_code: varchar("color_code", { length: 50 }).notNull(),
  birthDate: timestamp("birthDate").notNull(),
  ringDate: timestamp("ringDate"),
  weanDate: timestamp("weanDate"),
  deletedAt: timestamp("deletedAt"),
  deletedBy: integer("deletedBy"),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  // Quando o filhote é "promovido" ao plantel reprodutor (vira candidato a
  // formar casais/entrar em exposições), uma linha correspondente é criada
  // em "birds" e referenciada aqui. Sem isso, filhotes nascidos no próprio
  // criadouro ficavam fora da árvore genealógica (fatherId/motherId só
  // existe em "birds").
  birdId: integer("birdId"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  ringIdx: index("chicks_ring_idx").on(table.ring),
  clutchIdx: index("chicks_clutch_idx").on(table.clutchId),
  birdIdx: index("chicks_bird_idx").on(table.birdId),
}));

/**
 * Tabela de Regras Genéticas
 */
export const genetic_rules = pgTable("genetic_rules", {
  id: serial("id").primaryKey(),
  male_color: varchar("male_color", { length: 50 }).notNull(),
  female_color: varchar("female_color", { length: 50 }).notNull(),
  rule_type: varchar("rule_type", { length: 50 }).notNull(),
  description: text("description"),
  // Distribuição de probabilidade dos filhotes para este cruzamento, ex:
  // [{ color_code: "amarelo_intenso", probability: 25, sex_linked: false }]
  // Alimenta a Calculadora de Matriz (Matchmaker) sem precisar de um motor
  // de genética populacional completo — a regra já vem pré-calculada.
  probability_outcomes: jsonb("probability_outcomes").$type<GeneticOutcome[]>(),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

/**
 * Tabela de Associação Especialidade-Cor
 */
export const specialty_colors = pgTable("specialty_colors", {
  id: serial("id").primaryKey(),
  specialty_code: varchar("specialty_code", { length: 50 }).notNull(),
  color_code: varchar("color_code", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  specialtyColorIdx: index("specialty_colors_idx").on(table.specialty_code, table.color_code),
}));

/**
 * Tabela de Anilhas Individuais
 *
 * Complementa "ring_batches" (que só guarda o contador do lote). Cada linha
 * aqui é UMA anilha física, gerada automaticamente quando um lote é dado
 * entrada (ex.: lote 2026 com 200 unidades gera 200 linhas, status
 * "available"). Ao anilhar um filhote, o backend atualiza essa linha para
 * "in_use" e seta birdId/chickId — sem precisar de controle manual de
 * numeração.
 */
export const rings = pgTable("rings", {
  id: serial("id").primaryKey(),
  batchId: integer("batchId").notNull(),
  number: varchar("number", { length: 50 }).notNull().unique(),
  sequence: integer("sequence").notNull(),
  status: varchar("status", { length: 20 }).default("available").notNull(),
  // AVAILABLE | RESERVED | USED | LOST | DAMAGED | CANCELLED
  birdId: integer("birdId"),
  chickId: integer("chickId"),
  usedAt: timestamp("usedAt"),
  // Campos expandidos
  fullCode: varchar("fullCode", { length: 100 }),
  ringSource: varchar("ringSource", { length: 20 }).default("BATCH").notNull(),
  // BATCH | MANUAL
  reservedAt: timestamp("reservedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  batchIdx: index("rings_batch_idx").on(table.batchId),
  statusIdx: index("rings_status_idx").on(table.status),
  fullCodeIdx: index("rings_fullcode_idx").on(table.fullCode),
}));

/**
 * Tabela de Regras de Bitola por Espécie/Raça
 *
 * Catálogo administrativo que define a bitola recomendada para cada
 * combinação espécie+raça. Usado para sugerir automaticamente a bitola
 * correta ao cadastrar um lote ou um pássaro.
 */
export const ring_gauge_rules = pgTable("ring_gauge_rules", {
  id: serial("id").primaryKey(),
  speciesName: varchar("speciesName", { length: 50 }).notNull(),
  breedName: varchar("breedName", { length: 100 }),
  modality: varchar("modality", { length: 20 }),
  recommendedGaugeMm: real("recommendedGaugeMm").notNull(),
  minGaugeMm: real("minGaugeMm"),
  maxGaugeMm: real("maxGaugeMm"),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  gaugeSpeciesIdx: index("ring_gauge_rules_species_idx").on(table.speciesName),
  gaugeBreedIdx: index("ring_gauge_rules_breed_idx").on(table.breedName),
}));

/**
 * Tabela de Fotos (polimórfica)
 *
 * Reaproveitada por pássaro, filhote, criador (showroom) e entradas de
 * campeonato — em vez de duplicar a mesma estrutura de foto em cada
 * tabela. O arquivo em si fica no storage (server/storage.ts ->
 * storagePut), aqui só guardamos a referência (key/url).
 */
export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  entityType: varchar("entityType", { length: 30 }).notNull(), // bird | chick | breeder | championship_entry
  entityId: integer("entityId").notNull(),
  storageKey: varchar("storageKey", { length: 500 }).notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  caption: varchar("caption", { length: 200 }),
  isPrimary: boolean("isPrimary").default(false).notNull(),
  displayOrder: integer("displayOrder").default(0).notNull(),
  takenAt: timestamp("takenAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  entityIdx: index("photos_entity_idx").on(table.entityType, table.entityId),
}));

/**
 * Tabela de Gaiolas (mapeamento espacial do criadouro)
 */
export const cages = pgTable("cages", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(), // ex: "A-12"
  section: varchar("section", { length: 100 }), // ex: "Galpão 1 - Fileira 3"
  capacity: integer("capacity").default(1).notNull(),
  status: varchar("status", { length: 20 }).default("free").notNull(), // free | occupied | maintenance
  // Código público único para QR Code — nullable até ser ativado.
  publicCode: varchar("publicCode", { length: 20 }).unique(),
  deletedAt: timestamp("deletedAt"),
  deletedBy: integer("deletedBy"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  codeIdx: index("cages_code_idx").on(table.code),
}));

/**
 * Tabela de Campeonatos
 */
export const championships = pgTable("championships", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  association: varchar("association", { length: 100 }), // FOB | OBJO | COM | outro
  location: varchar("location", { length: 200 }),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  status: varchar("status", { length: 20 }).default("upcoming").notNull(), // upcoming | ongoing | finished
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),

  deletedAt: timestamp("deletedAt"),
  deletedBy: integer("deletedBy"),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

/**
 * Tabela de Inscrições em Campeonato (Gestão de Pista)
 */
export const championship_entries = pgTable("championship_entries", {
  id: serial("id").primaryKey(),
  championshipId: integer("championshipId").notNull(),
  birdId: integer("birdId").notNull(),
  category: varchar("category", { length: 150 }).notNull(), // ex: "Gloster Corona Amarelo Intenso"
  cageNumberAtShow: varchar("cageNumberAtShow", { length: 50 }),
  status: varchar("status", { length: 20 }).default("registered").notNull(), // registered | judged | disqualified | awarded
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  championshipIdx: index("championship_entries_championship_idx").on(table.championshipId),
  birdIdx: index("championship_entries_bird_idx").on(table.birdId),
}));

/**
 * Tabela de Juízes
 */
export const judges = pgTable("judges", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  registrationNumber: varchar("registrationNumber", { length: 50 }),
  association: varchar("association", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Tabela de Pontuações (juiz humano)
 */
export const scores = pgTable("scores", {
  id: serial("id").primaryKey(),
  entryId: integer("entryId").notNull(),
  judgeId: integer("judgeId"),
  criteria_scores: jsonb("criteria_scores").$type<CriteriaScore[]>(),
  totalScore: real("totalScore").notNull(),
  placement: integer("placement"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  entryIdx: index("scores_entry_idx").on(table.entryId),
}));

/**
 * Tabela de Análises do Juiz Virtual (IA)
 *
 * Cada linha é o resultado de UMA chamada ao modelo de visão (invokeLLM
 * com image_url + response_format json_schema, ver server/_core/llm.ts).
 * Não é um modelo de Computer Vision treinado do zero — é uma análise
 * comparativa via LLM com visão contra os critérios do padrão oficial da
 * especialidade.
 */
export const ai_judge_analyses = pgTable("ai_judge_analyses", {
  id: serial("id").primaryKey(),
  birdId: integer("birdId"),
  entryId: integer("entryId"), // opcional: vínculo com uma inscrição de campeonato
  photoUrl: varchar("photoUrl", { length: 500 }).notNull(),
  specialty_code: varchar("specialty_code", { length: 50 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  criteria_scores: jsonb("criteria_scores").$type<CriteriaScore[]>(),
  overallScore: real("overallScore"),
  confidence: real("confidence"), // 0 a 1
  summary: text("summary"),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending | completed | failed
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  birdIdx: index("ai_judge_analyses_bird_idx").on(table.birdId),
  entryIdx: index("ai_judge_analyses_entry_idx").on(table.entryId),
}));

/**
 * Configurações do Criadouro (registro único, id sempre = 1)
 *
 * Fonte única de verdade para nome, contato e identidade visual do
 * criadouro — usada tanto na Home pública quanto na Ficha de Gaiola
 * impressa e em qualquer outro painel que precise exibir essa informação.
 * Antes esses dados ficavam fixos em shared/constants.ts (BREEDER_INFO);
 * agora são editáveis via tela de Configurações, sem precisar mexer em
 * código pra trocar nome/telefone/endereço.
 */
export const breeder_settings = pgTable("breeder_settings", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull().default("Meu Criadouro"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  address: varchar("address", { length: 250 }),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 150 }),
  website: varchar("website", { length: 200 }),
  description: text("description"),
  logoUrl: varchar("logoUrl", { length: 500 }),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

/**
 * Registros de Saúde e Alimentação
 *
 * Cobre vacinas, tratamentos, pesagens, quarentena e diário alimentar num
 * único histórico por pássaro — mais simples de consultar do que separar
 * em várias tabelas, já que tudo é "um evento numa data, com uma nota".
 */
export const health_records = pgTable("health_records", {
  id: serial("id").primaryKey(),
  birdId: integer("birdId").notNull(),
  type: varchar("type", { length: 20 }).notNull(), // vaccine | treatment | weight | quarantine | diet | other
  description: varchar("description", { length: 300 }).notNull(),
  date: timestamp("date").notNull(),
  weightGrams: real("weightGrams"), // preenchido quando type = 'weight'
  dietPhase: varchar("dietPhase", { length: 20 }), // muda | reproducao | descanso — quando type = 'diet'
  nextDueDate: timestamp("nextDueDate"), // próxima dose/retorno, quando aplicável
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  birdIdx: index("health_records_bird_idx").on(table.birdId),
  typeIdx: index("health_records_type_idx").on(table.type),
}));

/**
 * Lembretes Automáticos de Reprodução
 *
 * Gerados automaticamente quando um casal é formado (ver
 * server/_core/breeding.ts), com as datas estimadas de cada etapa do
 * ciclo reprodutivo. O criador marca como concluído conforme acontece —
 * isso também alimenta o calendário/dashboard.
 */
export const breeding_reminders = pgTable("breeding_reminders", {
  id: serial("id").primaryKey(),
  coupleId: integer("coupleId").notNull(),
  eventType: varchar("eventType", { length: 30 }).notNull(), // posture_start | candling | egg_return | hatching | ringing | weaning
  expectedDate: timestamp("expectedDate").notNull(),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  coupleIdx: index("breeding_reminders_couple_idx").on(table.coupleId),
  dateIdx: index("breeding_reminders_date_idx").on(table.expectedDate),
}));

/**
 * Leituras de Sensores de Ambiente (IoT) — preparo de schema
 *
 * Estrutura pronta para receber dados de sensores de temperatura, umidade,
 * luminosidade e amônia por gaiola/setor, quando o criador instalar esse
 * tipo de equipamento. Faixas de referência: temperatura 16–24°C, umidade
 * 40–60% (ver server/_core/iotThresholds.ts).
 */
export const cage_sensor_readings = pgTable("cage_sensor_readings", {
  id: serial("id").primaryKey(),
  cageId: integer("cageId"),
  section: varchar("section", { length: 100 }), // alternativa a cageId, pra sensor por setor/galpão inteiro
  temperatureC: real("temperatureC"),
  humidityPct: real("humidityPct"),
  luminosityLux: real("luminosityLux"),
  ammoniaPpm: real("ammoniaPpm"),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
}, (table) => ({
  cageIdx: index("cage_sensor_readings_cage_idx").on(table.cageId),
  recordedIdx: index("cage_sensor_readings_recorded_idx").on(table.recordedAt),
}));

/**
 * Estrutura de uma mutação no genótipo de um pássaro: tipo de herança e
 * zigosidade. Para mutações ligadas ao sexo, fêmeas só podem ser
 * "homozygous_mutant" (manifestam) ou "homozygous_normal" (normais) —
 * nunca "heterozygous_carrier", pois só têm um cromossomo Z.
 */
export type GenotypeZygosity = "homozygous_mutant" | "heterozygous_carrier" | "homozygous_normal";
export type GenotypeMutation = {
  mutation: string; // id de MELANIN_MUTATIONS ou LIPOCHROME_MUTATIONS (shared/constants.ts)
  inheritance: "autosomal_dominant" | "autosomal_recessive" | "sex_linked_recessive";
  zygosity: GenotypeZygosity;
};

/**
 * Genótipo de Genética Avançada (Módulo de Cruzamentos Mendelianos)
 *
 * Tabela opcional, 1:1 com "birds" — complementa (não substitui) os campos
 * simples já existentes (specialty_code/color_code), que continuam sendo a
 * cor "de exibição" usada em todo o resto do sistema. Esse genótipo
 * detalhado só é usado pelo motor de predição de cruzamento
 * (server/_core/mendelian.ts) quando o criador opta por preenchê-lo.
 */
export const bird_genotype = pgTable("bird_genotype", {
  id: serial("id").primaryKey(),
  birdId: integer("birdId").notNull().unique(),
  backgroundColor: varchar("backgroundColor", { length: 30 }), // id de BACKGROUND_COLORS
  featherType: varchar("featherType", { length: 20 }), // "intenso" | "nevado"
  hasCrest: boolean("hasCrest").default(false).notNull(),
  // Cada mutação que o pássaro carrega/manifesta, com tipo de herança e
  // zigosidade — ver GenotypeMutation acima.
  mutations: jsonb("mutations").$type<GenotypeMutation[]>(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  birdIdx: index("bird_genotype_bird_idx").on(table.birdId),
}));

/**
 * Catálogo Oficial FOB/OBJO — classes oficiais de Canário de Cor e Porte.
 *
 * Armazena as 1469 classes oficiais (CC#### para Cor, CP#### para Porte)
 * com os traços genéticos interpretados pelo officialClassInterpreter.
 * Não é a genética completa — é o fenótipo oficial de entrada.
 */
export const official_bird_classes = pgTable("official_bird_classes", {
  id: serial("id").primaryKey(),
  modality: varchar("modality", { length: 10 }).notNull(), // 'COR' | 'PORTE'
  officialCode: varchar("officialCode", { length: 20 }).notNull().unique(), // CC0102, CP0240 etc.
  officialName: text("officialName").notNull(), // BRANCO DOMINANTE, PADOVANO COM TOPETE...
  abbreviation: varchar("abbreviation", { length: 50 }), // BR DO, PA CT BR LI...
  groupName: varchar("groupName", { length: 200 }), // Lipocrômicos sem fator, Padovano...
  subgroupName: varchar("subgroupName", { length: 200 }), // Brancos, Vermelhos, Ágatas...
  breedName: varchar("breedName", { length: 100 }), // para PORTE: Padovano, Gloster...
  bitola: varchar("bitola", { length: 50 }), // para PORTE: tamanho/bitola
  categoryName: varchar("categoryName", { length: 50 }), // intenso, nevado, mosaico...
  sourceYear: integer("sourceYear").default(2026),
  sourceEntity: varchar("sourceEntity", { length: 20 }).default("FOB/OBJO"),
  rawText: text("rawText"), // origem bruta do PDF/CSV
  interpretedTraits: jsonb("interpretedTraits"), // resultado do interpretOfficialClass()
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  codeIdx: index("official_bird_classes_code_idx").on(table.officialCode),
  modalityIdx: index("official_bird_classes_modality_idx").on(table.modality),
  breedIdx: index("official_bird_classes_breed_idx").on(table.breedName),
}));

/**
 * Perfil Genético Individual de cada pássaro.
 *
 * Criado/atualizado automaticamente quando o criador seleciona uma classe
 * oficial na ficha da ave. Armazena o resultado da interpretação genética
 * com níveis de certeza (CONFIRMADO, INFERIDO, POSSÍVEL, DESCONHECIDO).
 * Permite correção manual sem perder a inferência original.
 */
export const bird_genetic_profiles = pgTable("bird_genetic_profiles", {
  id: serial("id").primaryKey(),
  birdId: integer("birdId").notNull().unique(),
  officialClassId: integer("officialClassId"), // FK para official_bird_classes

  // Identificação oficial
  modality: varchar("modality", { length: 10 }), // 'COR' | 'PORTE'
  officialCode: varchar("officialCode", { length: 20 }),
  officialName: text("officialName"),
  officialAbbreviation: varchar("officialAbbreviation", { length: 50 }),
  officialGroup: varchar("officialGroup", { length: 200 }),
  breedName: varchar("breedName", { length: 100 }),
  bitola: varchar("bitola", { length: 50 }),

  // Fenótipo
  phenotypeName: text("phenotypeName"),
  visualColorDescription: text("visualColorDescription"),

  // Traços genéticos interpretados
  lipochromeBase: varchar("lipochromeBase", { length: 50 }),
  melaninSeries: varchar("melaninSeries", { length: 50 }),
  featherCategory: varchar("featherCategory", { length: 30 }), // intenso|nevado|mosaico_macho|mosaico_femea
  crestType: varchar("crestType", { length: 30 }), // com_topete|sem_topete|corona|consort

  // Status de genes especiais
  dominantWhiteStatus: varchar("dominantWhiteStatus", { length: 20 }), // visual|desconhecido
  recessiveWhiteStatus: varchar("recessiveWhiteStatus", { length: 20 }), // visual|portador|desconhecido
  ivoryStatus: varchar("ivoryStatus", { length: 20 }), // visual|portador|desconhecido
  redFactorStatus: varchar("redFactorStatus", { length: 20 }), // visual|desconhecido
  inoStatus: varchar("inoStatus", { length: 20 }),
  urucumStatus: varchar("urucumStatus", { length: 20 }),
  asasBrancasStatus: varchar("asasBrancasStatus", { length: 20 }),

  // Mutações
  visibleMutations: jsonb("visibleMutations").$type<string[]>(),
  carriedMutations: jsonb("carriedMutations").$type<string[]>(),
  possibleCarriedMutations: jsonb("possibleCarriedMutations").$type<string[]>(),
  unknownTraits: jsonb("unknownTraits").$type<string[]>(),

  // Genótipo
  genotypeJson: jsonb("genotypeJson"), // genótipo confirmado
  inferredGenotypeJson: jsonb("inferredGenotypeJson"), // genótipo inferido
  confidenceScore: real("confidenceScore").default(0.2), // 0 a 1
  geneticWarnings: jsonb("geneticWarnings").$type<string[]>(),
  nutritionRecommendations: jsonb("nutritionRecommendations").$type<string[]>(),

  // Controle
  manualOverride: boolean("manualOverride").default(false).notNull(),
  lastInferenceAt: timestamp("lastInferenceAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  birdIdx: index("bird_genetic_profiles_bird_idx").on(table.birdId),
  officialClassIdx: index("bird_genetic_profiles_class_idx").on(table.officialClassId),
}));

/**
 * Análises fenotípicas por foto (IA)
 *
 * Registra cada análise feita pela IA com base em fotos do pássaro.
 * O usuário deve CONFIRMAR antes de salvar no perfil genético.
 */
export const bird_photo_analyses = pgTable("bird_photo_analyses", {
  id: serial("id").primaryKey(),
  birdId: integer("birdId").notNull(),
  photos: jsonb("photos").$type<string[]>(),
  aiProvider: varchar("aiProvider", { length: 50 }).default("gemini"),
  modelUsed: varchar("modelUsed", { length: 100 }),
  rawResponseJson: jsonb("rawResponseJson"),
  visualTraitsJson: jsonb("visualTraitsJson"),
  possibleOfficialClassesJson: jsonb("possibleOfficialClassesJson"),
  confidenceOverall: real("confidenceOverall").default(0),
  warnings: jsonb("warnings").$type<string[]>(),
  recommendations: jsonb("recommendations").$type<string[]>(),
  fieldsNotConfirmed: jsonb("fieldsNotConfirmed").$type<string[]>(),
  acceptedByUser: boolean("acceptedByUser").default(false).notNull(),
  acceptedOfficialClassId: integer("acceptedOfficialClassId"),
  processingTimeMs: integer("processingTimeMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  birdIdx: index("bird_photo_analyses_bird_idx").on(table.birdId),
}));

/**
 * Log de inferências genéticas
 *
 * Registra cada vez que o perfil genético de um pássaro é atualizado,
 * com a fonte, o estado anterior e o novo estado.
 * Fontes: PHOTO_AI | OFFICIAL_CLASS | PEDIGREE | OFFSPRING_RESULT | MANUAL
 */
export const bird_genetic_inference_logs = pgTable("bird_genetic_inference_logs", {
  id: serial("id").primaryKey(),
  birdId: integer("birdId").notNull(),
  sourceType: varchar("sourceType", { length: 30 }).notNull(),
  beforeJson: jsonb("beforeJson"),
  afterJson: jsonb("afterJson"),
  confidence: real("confidence").default(0),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  birdIdx: index("bird_genetic_inference_logs_bird_idx").on(table.birdId),
  sourceIdx: index("bird_genetic_inference_logs_source_idx").on(table.sourceType),
}));

/**
 * Types exportados
 */
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Specialty = typeof specialties.$inferSelect;
export type Color = typeof colors.$inferSelect;
export type Breeder = typeof breeders.$inferSelect;
export type RingBatch = typeof ring_batches.$inferSelect;
export type InsertRingBatch = typeof ring_batches.$inferInsert;
export type InsertRing = typeof rings.$inferInsert;
export type RingGaugeRule = typeof ring_gauge_rules.$inferSelect;
export type InsertRingGaugeRule = typeof ring_gauge_rules.$inferInsert;
export type Bird = typeof birds.$inferSelect;
export type Couple = typeof couples.$inferSelect;
export type Clutch = typeof clutches.$inferSelect;
export type Chick = typeof chicks.$inferSelect;
export type GeneticRule = typeof genetic_rules.$inferSelect;
export type SpecialtyColor = typeof specialty_colors.$inferSelect;

export type Ring = typeof rings.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type Cage = typeof cages.$inferSelect;
export type Championship = typeof championships.$inferSelect;
export type ChampionshipEntry = typeof championship_entries.$inferSelect;
export type Judge = typeof judges.$inferSelect;
export type Score = typeof scores.$inferSelect;
export type AiJudgeAnalysis = typeof ai_judge_analyses.$inferSelect;
export type BreederSettings = typeof breeder_settings.$inferSelect;
export type HealthRecord = typeof health_records.$inferSelect;
export type BreedingReminder = typeof breeding_reminders.$inferSelect;
export type CageSensorReading = typeof cage_sensor_readings.$inferSelect;
export type BirdGenotype = typeof bird_genotype.$inferSelect;
export type OfficialBirdClass = typeof official_bird_classes.$inferSelect;
export type InsertOfficialBirdClass = typeof official_bird_classes.$inferInsert;
export type BirdGeneticProfile = typeof bird_genetic_profiles.$inferSelect;
export type InsertBirdGeneticProfile = typeof bird_genetic_profiles.$inferInsert;
export type BirdPhotoAnalysis = typeof bird_photo_analyses.$inferSelect;
export type InsertBirdPhotoAnalysis = typeof bird_photo_analyses.$inferInsert;
export type BirdGeneticInferenceLog = typeof bird_genetic_inference_logs.$inferSelect;
export type InsertBirdGeneticInferenceLog = typeof bird_genetic_inference_logs.$inferInsert;

// ─── Missão 3.1 + 4: Rotina Diária & Administração ───────────────────────────

export const breeding_daily_logs = pgTable("breeding_daily_logs", {
  id: serial("id").primaryKey(),
  coupleId: integer("coupleId").notNull(),
  clutchId: integer("clutchId"),
  cageId: integer("cageId"),
  date: date("date").notNull().default(sql`CURRENT_DATE`),
  eventType: varchar("eventType", { length: 30 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  notePreset: varchar("notePreset", { length: 100 }),
  noteText: text("noteText"),
  photoUrl: text("photoUrl"),
  createdBy: integer("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  coupleDateIdx: index("bdl_couple_date_idx2").on(t.coupleId, t.date),
}));

export const breeding_species_rules = pgTable("breeding_species_rules", {
  id: serial("id").primaryKey(),
  species: varchar("species", { length: 50 }).notNull().unique(),
  incubationDaysMin: integer("incubationDaysMin").notNull().default(13),
  incubationDaysMax: integer("incubationDaysMax").notNull().default(14),
  candlingDay: integer("candlingDay").notNull().default(7),
  ringingDayMin: integer("ringingDayMin").notNull().default(7),
  ringingDayMax: integer("ringingDayMax").notNull().default(9),
  maxClutchesPerSeason: integer("maxClutchesPerSeason").notNull().default(3),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  ownerUserId: integer("ownerUserId"),
  breederCode: varchar("breederCode", { length: 50 }),
  associationName: varchar("associationName", { length: 100 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  country: varchar("country", { length: 10 }).default("BR"),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 200 }),
  logoUrl: text("logoUrl"),
  publicSiteEnabled: boolean("publicSiteEnabled").notNull().default(true),
  publicSlug: varchar("publicSlug", { length: 100 }).unique(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  deletedAt: timestamp("deletedAt"),
  deletedBy: integer("deletedBy"),
});

export const audit_logs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  userId: integer("userId"),
  action: varchar("action", { length: 30 }).notNull(),
  entityType: varchar("entityType", { length: 50 }).notNull(),
  entityId: integer("entityId"),
  oldValueJson: jsonb("oldValueJson"),
  newValueJson: jsonb("newValueJson"),
  reason: text("reason"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  entityIdx: index("al_entity_idx2").on(t.entityType, t.entityId),
  dateIdx: index("al_date_idx2").on(t.createdAt),
}));

export type BreedingDailyLog = typeof breeding_daily_logs.$inferSelect;
export type BreedingSpeciesRule = typeof breeding_species_rules.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
export type AuditLog = typeof audit_logs.$inferSelect;
