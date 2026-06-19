import { int, varchar, text, timestamp, mysqlTable, index } from "drizzle-orm/mysql-core";

/**
 * Tabela de Usuários (OAuth)
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 20 }).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/**
 * Tabela de Especialidades de Canários
 */
export const specialties = mysqlTable("specialties", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  size_cm: varchar("size_cm", { length: 20 }),
  weight_g: varchar("weight_g", { length: 20 }),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  codeIdx: index("specialties_code_idx").on(table.code),
}));

/**
 * Tabela de Cores e Mutações
 */
export const colors = mysqlTable("colors", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  genetics: varchar("genetics", { length: 50 }),
  description: text("description"),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  codeIdx: index("colors_code_idx").on(table.code),
}));

/**
 * Tabela de Criadores
 */
export const breeders = mysqlTable("breeders", {
  id: int("id").autoincrement().primaryKey(),
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Tabela de Lotes de Anilhas
 */
export const ring_batches = mysqlTable("ring_batches", {
  id: int("id").autoincrement().primaryKey(),
  batch_number: varchar("batch_number", { length: 50 }).notNull(),
  year: int("year").notNull(),
  color: varchar("color", { length: 50 }).notNull(),
  quantity_total: int("quantity_total").notNull(),
  quantity_used: int("quantity_used").default(0).notNull(),
  status: varchar("status", { length: 20 }).default("available").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  batchIdx: index("ring_batches_batch_idx").on(table.batch_number),
}));

/**
 * Tabela de Pássaros
 */
export const birds = mysqlTable("birds", {
  id: int("id").autoincrement().primaryKey(),
  ring: varchar("ring", { length: 50 }).notNull().unique(),
  specialty_code: varchar("specialty_code", { length: 50 }).notNull(),
  sex: varchar("sex", { length: 20 }).notNull(),
  color_code: varchar("color_code", { length: 50 }).notNull(),
  birthDate: timestamp("birthDate"),
  procedence: varchar("procedence", { length: 200 }),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  fatherId: int("fatherId"),
  motherId: int("motherId"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  ringIdx: index("birds_ring_idx").on(table.ring),
  specialtyIdx: index("birds_specialty_idx").on(table.specialty_code),
  colorIdx: index("birds_color_idx").on(table.color_code),
}));

/**
 * Tabela de Casais/Cruzamentos
 */
export const couples = mysqlTable("couples", {
  id: int("id").autoincrement().primaryKey(),
  maleId: int("maleId").notNull(),
  femaleId: int("femaleId").notNull(),
  cageNumber: varchar("cageNumber", { length: 50 }).notNull(),
  formationDate: timestamp("formationDate").notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  cageIdx: index("couples_cage_idx").on(table.cageNumber),
  statusIdx: index("couples_status_idx").on(table.status),
}));

/**
 * Tabela de Posturas
 */
export const clutches = mysqlTable("clutches", {
  id: int("id").autoincrement().primaryKey(),
  coupleId: int("coupleId").notNull(),
  clutchDate: timestamp("clutchDate").notNull(),
  totalEggs: int("totalEggs").notNull(),
  fertilizedEggs: int("fertilizedEggs").notNull(),
  infertileEggs: int("infertileEggs").default(0).notNull(),
  lostEggs: int("lostEggs").default(0).notNull(),
  hatchedChicks: int("hatchedChicks").default(0).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  coupleIdx: index("clutches_couple_idx").on(table.coupleId),
}));

/**
 * Tabela de Filhotes
 */
export const chicks = mysqlTable("chicks", {
  id: int("id").autoincrement().primaryKey(),
  clutchId: int("clutchId").notNull(),
  ring: varchar("ring", { length: 50 }).notNull().unique(),
  sex: varchar("sex", { length: 20 }).notNull(),
  color_code: varchar("color_code", { length: 50 }).notNull(),
  birthDate: timestamp("birthDate").notNull(),
  ringDate: timestamp("ringDate"),
  weanDate: timestamp("weanDate"),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  ringIdx: index("chicks_ring_idx").on(table.ring),
  clutchIdx: index("chicks_clutch_idx").on(table.clutchId),
}));

/**
 * Tabela de Regras Genéticas
 */
export const genetic_rules = mysqlTable("genetic_rules", {
  id: int("id").autoincrement().primaryKey(),
  male_color: varchar("male_color", { length: 50 }).notNull(),
  female_color: varchar("female_color", { length: 50 }).notNull(),
  rule_type: varchar("rule_type", { length: 50 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Tabela de Associação Especialidade-Cor
 */
export const specialty_colors = mysqlTable("specialty_colors", {
  id: int("id").autoincrement().primaryKey(),
  specialty_code: varchar("specialty_code", { length: 50 }).notNull(),
  color_code: varchar("color_code", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  specialtyColorIdx: index("specialty_colors_idx").on(table.specialty_code, table.color_code),
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
