import { integer, serial, varchar, text, timestamp, pgTable, index } from "drizzle-orm/pg-core";

/**
 * Tabela de Usuários (OAuth/local)
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 128 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 20 }).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
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
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("specialties_code_idx").on(table.code),
]);

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
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("colors_code_idx").on(table.code),
]);

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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("ring_batches_batch_idx").on(table.batch_number),
  index("ring_batches_year_idx").on(table.year),
]);

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
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("birds_ring_idx").on(table.ring),
  index("birds_specialty_idx").on(table.specialty_code),
  index("birds_color_idx").on(table.color_code),
  index("birds_status_idx").on(table.status),
]);

/**
 * Tabela de Casais/Cruzamentos
 */
export const couples = pgTable("couples", {
  id: serial("id").primaryKey(),
  maleId: integer("maleId").notNull(),
  femaleId: integer("femaleId").notNull(),
  cageNumber: varchar("cageNumber", { length: 50 }).notNull(),
  formationDate: timestamp("formationDate").notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("couples_cage_idx").on(table.cageNumber),
  index("couples_status_idx").on(table.status),
  index("couples_male_idx").on(table.maleId),
  index("couples_female_idx").on(table.femaleId),
]);

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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("clutches_couple_idx").on(table.coupleId),
  index("clutches_date_idx").on(table.clutchDate),
]);

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
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("chicks_ring_idx").on(table.ring),
  index("chicks_clutch_idx").on(table.clutchId),
  index("chicks_status_idx").on(table.status),
]);

/**
 * Tabela de Regras Genéticas
 */
export const genetic_rules = pgTable("genetic_rules", {
  id: serial("id").primaryKey(),
  male_color: varchar("male_color", { length: 50 }).notNull(),
  female_color: varchar("female_color", { length: 50 }).notNull(),
  rule_type: varchar("rule_type", { length: 50 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("specialty_colors_idx").on(table.specialty_code, table.color_code),
]);

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
