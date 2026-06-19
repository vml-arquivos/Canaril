-- ============================================================================
-- MIGRATION: Schema inicial PostgreSQL - Canário Gestão Pro
-- ============================================================================

CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "openId" VARCHAR(128) NOT NULL UNIQUE,
  "name" TEXT,
  "email" VARCHAR(320),
  "loginMethod" VARCHAR(64),
  "role" VARCHAR(20) NOT NULL DEFAULT 'user',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSignedIn" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "specialties" (
  "id" SERIAL PRIMARY KEY,
  "code" VARCHAR(50) NOT NULL UNIQUE,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "size_cm" VARCHAR(20),
  "weight_g" VARCHAR(20),
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "specialties_code_idx" ON "specialties" ("code");

CREATE TABLE IF NOT EXISTS "colors" (
  "id" SERIAL PRIMARY KEY,
  "code" VARCHAR(50) NOT NULL UNIQUE,
  "name" VARCHAR(100) NOT NULL,
  "category" VARCHAR(50) NOT NULL,
  "genetics" VARCHAR(50),
  "description" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "colors_code_idx" ON "colors" ("code");

CREATE TABLE IF NOT EXISTS "breeders" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(100) NOT NULL,
  "city" VARCHAR(100) NOT NULL,
  "state" VARCHAR(2) NOT NULL,
  "country" VARCHAR(100) NOT NULL,
  "registration_number" VARCHAR(50) UNIQUE,
  "association" VARCHAR(200),
  "phone" VARCHAR(20),
  "email" VARCHAR(100),
  "website" VARCHAR(200),
  "description" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ring_batches" (
  "id" SERIAL PRIMARY KEY,
  "batch_number" VARCHAR(50) NOT NULL,
  "year" INTEGER NOT NULL,
  "color" VARCHAR(50) NOT NULL,
  "quantity_total" INTEGER NOT NULL,
  "quantity_used" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(20) NOT NULL DEFAULT 'available',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ring_batches_batch_year_unique" UNIQUE ("batch_number", "year")
);
CREATE INDEX IF NOT EXISTS "ring_batches_batch_idx" ON "ring_batches" ("batch_number");
CREATE INDEX IF NOT EXISTS "ring_batches_year_idx" ON "ring_batches" ("year");

CREATE TABLE IF NOT EXISTS "birds" (
  "id" SERIAL PRIMARY KEY,
  "ring" VARCHAR(50) NOT NULL UNIQUE,
  "specialty_code" VARCHAR(50) NOT NULL,
  "sex" VARCHAR(20) NOT NULL,
  "color_code" VARCHAR(50) NOT NULL,
  "birthDate" TIMESTAMP,
  "procedence" VARCHAR(200),
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "fatherId" INTEGER REFERENCES "birds"("id") ON DELETE SET NULL,
  "motherId" INTEGER REFERENCES "birds"("id") ON DELETE SET NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "birds_ring_idx" ON "birds" ("ring");
CREATE INDEX IF NOT EXISTS "birds_specialty_idx" ON "birds" ("specialty_code");
CREATE INDEX IF NOT EXISTS "birds_color_idx" ON "birds" ("color_code");
CREATE INDEX IF NOT EXISTS "birds_status_idx" ON "birds" ("status");

CREATE TABLE IF NOT EXISTS "couples" (
  "id" SERIAL PRIMARY KEY,
  "maleId" INTEGER NOT NULL REFERENCES "birds"("id") ON DELETE RESTRICT,
  "femaleId" INTEGER NOT NULL REFERENCES "birds"("id") ON DELETE RESTRICT,
  "cageNumber" VARCHAR(50) NOT NULL,
  "formationDate" TIMESTAMP NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "couples_cage_idx" ON "couples" ("cageNumber");
CREATE INDEX IF NOT EXISTS "couples_status_idx" ON "couples" ("status");
CREATE INDEX IF NOT EXISTS "couples_male_idx" ON "couples" ("maleId");
CREATE INDEX IF NOT EXISTS "couples_female_idx" ON "couples" ("femaleId");

CREATE TABLE IF NOT EXISTS "clutches" (
  "id" SERIAL PRIMARY KEY,
  "coupleId" INTEGER NOT NULL REFERENCES "couples"("id") ON DELETE CASCADE,
  "clutchDate" TIMESTAMP NOT NULL,
  "totalEggs" INTEGER NOT NULL,
  "fertilizedEggs" INTEGER NOT NULL,
  "infertileEggs" INTEGER NOT NULL DEFAULT 0,
  "lostEggs" INTEGER NOT NULL DEFAULT 0,
  "hatchedChicks" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "clutches_couple_idx" ON "clutches" ("coupleId");
CREATE INDEX IF NOT EXISTS "clutches_date_idx" ON "clutches" ("clutchDate");

CREATE TABLE IF NOT EXISTS "chicks" (
  "id" SERIAL PRIMARY KEY,
  "clutchId" INTEGER NOT NULL REFERENCES "clutches"("id") ON DELETE CASCADE,
  "ring" VARCHAR(50) NOT NULL UNIQUE,
  "sex" VARCHAR(20) NOT NULL,
  "color_code" VARCHAR(50) NOT NULL,
  "birthDate" TIMESTAMP NOT NULL,
  "ringDate" TIMESTAMP,
  "weanDate" TIMESTAMP,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "chicks_ring_idx" ON "chicks" ("ring");
CREATE INDEX IF NOT EXISTS "chicks_clutch_idx" ON "chicks" ("clutchId");
CREATE INDEX IF NOT EXISTS "chicks_status_idx" ON "chicks" ("status");

CREATE TABLE IF NOT EXISTS "genetic_rules" (
  "id" SERIAL PRIMARY KEY,
  "male_color" VARCHAR(50) NOT NULL,
  "female_color" VARCHAR(50) NOT NULL,
  "rule_type" VARCHAR(50) NOT NULL,
  "description" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "genetic_rules_unique" UNIQUE ("male_color", "female_color", "rule_type")
);

CREATE TABLE IF NOT EXISTS "specialty_colors" (
  "id" SERIAL PRIMARY KEY,
  "specialty_code" VARCHAR(50) NOT NULL,
  "color_code" VARCHAR(50) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "specialty_colors_unique" UNIQUE ("specialty_code", "color_code")
);
CREATE INDEX IF NOT EXISTS "specialty_colors_idx" ON "specialty_colors" ("specialty_code", "color_code");
