// Use PostgreSQL-specific table and column types. We switch from the MySQL
// dialect (`mysqlTable`, `int`, etc.) to the PostgreSQL dialect provided by
// `drizzle-orm/pg-core`. The `serial` helper defines an auto-incrementing
// primary key, and `integer` represents standard integer columns. Other
// helpers (varchar, text, timestamp, index) remain the same API across
// dialects.
import { serial, integer, varchar, text, timestamp, pgTable, index, jsonb, boolean, real } from "drizzle-orm/pg-core";

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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  batchIdx: index("ring_batches_batch_idx").on(table.batch_number),
}));

/**
 * Tabela de Pássaros
 */
export const birds = pgTable("birds", {
  id: serial("id").primaryKey(),
  ring: varchar("ring", { length: 50 }).notNull().unique(),
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
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  ringIdx: index("birds_ring_idx").on(table.ring),
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
  status: varchar("status", { length: 20 }).default("available").notNull(), // available | in_use
  birdId: integer("birdId"),
  chickId: integer("chickId"),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  batchIdx: index("rings_batch_idx").on(table.batchId),
  statusIdx: index("rings_status_idx").on(table.status),
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
 * Types exportados
 */
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Specialty = typeof specialties.$inferSelect;
export type Color = typeof colors.$inferSelect;
export type Breeder = typeof breeders.$inferSelect;
export type RingBatch = typeof ring_batches.$inferSelect;
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
