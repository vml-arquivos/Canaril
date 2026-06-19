import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, date, boolean, index, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Tabela de anilhas
 */
export const rings = mysqlTable(
  "rings",
  {
    id: int("id").autoincrement().primaryKey(),
    number: varchar("number", { length: 50 }).notNull(),
    year: int("year").notNull(),
    color: varchar("color", { length: 50 }),
    status: varchar("status", { length: 50 }).default("disponível").notNull(),
    quantity: int("quantity").notNull().default(1),
    usedQuantity: int("usedQuantity").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    numberYearIdx: uniqueIndex("rings_number_year_idx").on(table.number, table.year),
  })
);

export type Ring = typeof rings.$inferSelect;
export type InsertRing = typeof rings.$inferInsert;

/**
 * Tabela de pássaros
 */
export const birds = mysqlTable(
  "birds",
  {
    id: int("id").autoincrement().primaryKey(),
    ringId: int("ringId"),
    ring: varchar("ring", { length: 50 }).notNull().unique(),
    specialty: varchar("specialty", { length: 50 }).notNull(),
    sex: varchar("sex", { length: 50 }).notNull(),
    color: varchar("color", { length: 50 }).notNull(),
    birthDate: date("birthDate"),
    procedence: varchar("procedence", { length: 255 }),
    status: varchar("status", { length: 50 }).default("ativo").notNull(),
    photoUrl: text("photoUrl"),
    fatherId: int("fatherId"),
    motherId: int("motherId"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    ringIdx: uniqueIndex("birds_ring_idx").on(table.ring),
    fatherIdx: index("birds_fatherId_idx").on(table.fatherId),
    motherIdx: index("birds_motherId_idx").on(table.motherId),
    statusIdx: index("birds_status_idx").on(table.status),
  })
);

export type Bird = typeof birds.$inferSelect;
export type InsertBird = typeof birds.$inferInsert;

/**
 * Tabela de casais (cruzamentos)
 */
export const couples = mysqlTable(
  "couples",
  {
    id: int("id").autoincrement().primaryKey(),
    maleId: int("maleId").notNull(),
    femaleId: int("femaleId").notNull(),
    cageNumber: varchar("cageNumber", { length: 50 }),
    formationDate: date("formationDate").notNull(),
    status: varchar("status", { length: 50 }).default("ativo").notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    maleIdx: index("couples_maleId_idx").on(table.maleId),
    femaleIdx: index("couples_femaleId_idx").on(table.femaleId),
    statusIdx: index("couples_status_idx").on(table.status),
  })
);

export type Couple = typeof couples.$inferSelect;
export type InsertCouple = typeof couples.$inferInsert;

/**
 * Tabela de posturas
 */
export const clutches = mysqlTable(
  "clutches",
  {
    id: int("id").autoincrement().primaryKey(),
    coupleId: int("coupleId").notNull(),
    clutchDate: date("clutchDate").notNull(),
    totalEggs: int("totalEggs").notNull().default(0),
    fertilizedEggs: int("fertilizedEggs").notNull().default(0),
    infertileEggs: int("infertileEggs").notNull().default(0),
    lostEggs: int("lostEggs").notNull().default(0),
    hatchDate: date("hatchDate"),
    hatchedChicks: int("hatchedChicks").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    coupleIdx: index("clutches_coupleId_idx").on(table.coupleId),
    clutchDateIdx: index("clutches_clutchDate_idx").on(table.clutchDate),
  })
);

export type Clutch = typeof clutches.$inferSelect;
export type InsertClutch = typeof clutches.$inferInsert;

/**
 * Tabela de filhotes
 */
export const chicks = mysqlTable(
  "chicks",
  {
    id: int("id").autoincrement().primaryKey(),
    clutchId: int("clutchId").notNull(),
    ringId: int("ringId"),
    ring: varchar("ring", { length: 50 }).unique(),
    sex: varchar("sex", { length: 50 }),
    color: varchar("color", { length: 50 }),
    birthDate: date("birthDate").notNull(),
    ringDate: date("ringDate"),
    weanDate: date("weanDate"),
    status: varchar("status", { length: 50 }).default("ativo").notNull(),
    photoUrl: text("photoUrl"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    clutchIdx: index("chicks_clutchId_idx").on(table.clutchId),
    ringIdx: index("chicks_ring_idx").on(table.ring),
    statusIdx: index("chicks_status_idx").on(table.status),
  })
);

export type Chick = typeof chicks.$inferSelect;
export type InsertChick = typeof chicks.$inferInsert;

/**
 * Tabela de galeria de fotos do criadouro
 */
export const galleryPhotos = mysqlTable(
  "galleryPhotos",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    photoUrl: text("photoUrl").notNull(),
    specialty: varchar("specialty", { length: 50 }),
    displayOrder: int("displayOrder").notNull().default(0),
    isActive: boolean("isActive").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    displayOrderIdx: index("galleryPhotos_displayOrder_idx").on(table.displayOrder),
  })
);

export type GalleryPhoto = typeof galleryPhotos.$inferSelect;
export type InsertGalleryPhoto = typeof galleryPhotos.$inferInsert;

/**
 * Tabela de informações do criadouro
 */
export const breederInfo = mysqlTable("breederInfo", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  city: varchar("city", { length: 255 }).notNull(),
  state: varchar("state", { length: 2 }).notNull(),
  description: text("description"),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  website: varchar("website", { length: 255 }),
  logoUrl: text("logoUrl"),
  bannerUrl: text("bannerUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BreederInfo = typeof breederInfo.$inferSelect;
export type InsertBreederInfo = typeof breederInfo.$inferInsert;
