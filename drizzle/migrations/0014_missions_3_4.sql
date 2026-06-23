-- Migration 0014: Missões 3.1 e 4
-- Rotina Diária + Administração Total
-- Todas as operações são seguras: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS

BEGIN;

-- ─── MISSÃO 3.1: Rotina Diária ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "breeding_daily_logs" (
  "id"          SERIAL PRIMARY KEY,
  "coupleId"    INTEGER NOT NULL REFERENCES "couples"("id") ON DELETE CASCADE,
  "clutchId"    INTEGER REFERENCES "clutches"("id") ON DELETE SET NULL,
  "cageId"      INTEGER REFERENCES "cages"("id") ON DELETE SET NULL,
  "date"        DATE NOT NULL DEFAULT CURRENT_DATE,
  "eventType"   VARCHAR(30) NOT NULL,
  -- EGG_ADDED|EGG_LOST|EGG_BROKEN|EGG_REMOVED|EGG_ABANDONED|EGG_FERTILE
  -- EGG_INFERTILE|EGG_CLEAR|CHICK_HATCHED|CHICK_DIED|CHICK_RINGED
  -- NEST_PHOTO|FEEDING_OK|FEEDING_PROBLEM|NEST_CLEANED
  -- SUPPLEMENT_GIVEN|MEDICATION_GIVEN|GENERAL_NOTE
  "quantity"    INTEGER NOT NULL DEFAULT 1,
  "notePreset"  VARCHAR(100),
  "noteText"    TEXT,
  "photoUrl"    TEXT,
  "createdBy"   INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt"   TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bdl_couple_date_idx ON "breeding_daily_logs"("coupleId", "date" DESC);
CREATE INDEX IF NOT EXISTS bdl_clutch_idx      ON "breeding_daily_logs"("clutchId");
CREATE INDEX IF NOT EXISTS bdl_date_idx        ON "breeding_daily_logs"("date" DESC);

CREATE TABLE IF NOT EXISTS "breeding_species_rules" (
  "id"                  SERIAL PRIMARY KEY,
  "species"             VARCHAR(50) NOT NULL UNIQUE,
  "incubationDaysMin"   INTEGER NOT NULL DEFAULT 13,
  "incubationDaysMax"   INTEGER NOT NULL DEFAULT 14,
  "candlingDay"         INTEGER NOT NULL DEFAULT 7,
  "ringingDayMin"       INTEGER NOT NULL DEFAULT 7,
  "ringingDayMax"       INTEGER NOT NULL DEFAULT 9,
  "maxClutchesPerSeason" INTEGER NOT NULL DEFAULT 3,
  "createdAt"           TIMESTAMP NOT NULL DEFAULT NOW()
);
INSERT INTO "breeding_species_rules"
  ("species","incubationDaysMin","incubationDaysMax","candlingDay","ringingDayMin","ringingDayMax","maxClutchesPerSeason")
VALUES ('Canário',13,14,7,7,9,3)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS "breeding_reminders" (
  "id"          SERIAL PRIMARY KEY,
  "coupleId"    INTEGER REFERENCES "couples"("id") ON DELETE CASCADE,
  "clutchId"    INTEGER REFERENCES "clutches"("id") ON DELETE CASCADE,
  "birdId"      INTEGER REFERENCES "birds"("id") ON DELETE CASCADE,
  "reminderType" VARCHAR(30) NOT NULL,
  -- CHECK_NEST|CANDLE_EGGS|EXPECTED_HATCH|RING_CHICKS|CLEAN_NEST|REST_FEMALE
  "dueDate"     DATE NOT NULL,
  "title"       VARCHAR(200) NOT NULL,
  "notes"       TEXT,
  "dismissed"   BOOLEAN NOT NULL DEFAULT FALSE,
  "dismissedAt" TIMESTAMP,
  "createdAt"   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS br_due_date_idx  ON "breeding_reminders"("dueDate");
CREATE INDEX IF NOT EXISTS br_couple_idx    ON "breeding_reminders"("coupleId");

-- ─── MISSÃO 4: Administração Total ───────────────────────────────────────────

-- Tenants (multi-criadouro)
CREATE TABLE IF NOT EXISTS "tenants" (
  "id"                SERIAL PRIMARY KEY,
  "name"              VARCHAR(200) NOT NULL,
  "slug"              VARCHAR(100) NOT NULL UNIQUE,
  "ownerUserId"       INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "breederCode"       VARCHAR(50),
  "associationName"   VARCHAR(100),
  "city"              VARCHAR(100),
  "state"             VARCHAR(50),
  "country"           VARCHAR(10) DEFAULT 'BR',
  "phone"             VARCHAR(30),
  "email"             VARCHAR(200),
  "logoUrl"           TEXT,
  "publicSiteEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "publicSlug"        VARCHAR(100) UNIQUE,
  "status"            VARCHAR(20) NOT NULL DEFAULT 'active',
  "createdAt"         TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMP NOT NULL DEFAULT NOW(),
  "deletedAt"         TIMESTAMP,
  "deletedBy"         INTEGER REFERENCES "users"("id") ON DELETE SET NULL
);
-- Seed: tenant padrão Canaril Lima
INSERT INTO "tenants" ("name","slug","breederCode","associationName","publicSiteEnabled","publicSlug")
VALUES ('Canaril Lima','canaril-lima','GF-003','FOB','true','canaril-lima')
ON CONFLICT DO NOTHING;

-- Audit log
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"            SERIAL PRIMARY KEY,
  "tenantId"      INTEGER REFERENCES "tenants"("id") ON DELETE SET NULL,
  "userId"        INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "action"        VARCHAR(30) NOT NULL,
  -- create|update|soft_delete|restore|hard_delete|login|permission_change|bulk_delete
  "entityType"    VARCHAR(50) NOT NULL,
  "entityId"      INTEGER,
  "oldValueJson"  JSONB,
  "newValueJson"  JSONB,
  "reason"        TEXT,
  "ipAddress"     VARCHAR(45),
  "userAgent"     TEXT,
  "createdAt"     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS al_entity_idx ON "audit_logs"("entityType","entityId");
CREATE INDEX IF NOT EXISTS al_user_idx   ON "audit_logs"("userId");
CREATE INDEX IF NOT EXISTS al_date_idx   ON "audit_logs"("createdAt" DESC);

-- Soft delete fields: add to all main tables
ALTER TABLE "birds"           ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
ALTER TABLE "birds"           ADD COLUMN IF NOT EXISTS "deletedBy" INTEGER REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "birds"           ADD COLUMN IF NOT EXISTS "deleteReason" TEXT;
ALTER TABLE "birds"           ADD COLUMN IF NOT EXISTS "updatedBy" INTEGER REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "rings"           ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
ALTER TABLE "rings"           ADD COLUMN IF NOT EXISTS "deletedBy" INTEGER REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "ring_batches"    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
ALTER TABLE "ring_batches"    ADD COLUMN IF NOT EXISTS "deletedBy" INTEGER REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "couples"         ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
ALTER TABLE "couples"         ADD COLUMN IF NOT EXISTS "deletedBy" INTEGER REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "clutches"        ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
ALTER TABLE "clutches"        ADD COLUMN IF NOT EXISTS "deletedBy" INTEGER REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "chicks"          ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
ALTER TABLE "chicks"          ADD COLUMN IF NOT EXISTS "deletedBy" INTEGER REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "cages"           ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
ALTER TABLE "cages"           ADD COLUMN IF NOT EXISTS "deletedBy" INTEGER REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "championships"   ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
ALTER TABLE "championships"   ADD COLUMN IF NOT EXISTS "deletedBy" INTEGER REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "users"           ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
ALTER TABLE "users"           ADD COLUMN IF NOT EXISTS "deletedBy" INTEGER REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "users"           ADD COLUMN IF NOT EXISTS "role" VARCHAR(30) NOT NULL DEFAULT 'MEMBER';
ALTER TABLE "users"           ADD COLUMN IF NOT EXISTS "tenantId" INTEGER REFERENCES "tenants"("id") ON DELETE SET NULL;
ALTER TABLE "users"           ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP;
ALTER TABLE "users"           ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE;

-- Index for soft-deleted queries
CREATE INDEX IF NOT EXISTS birds_deleted_idx        ON "birds"("deletedAt") WHERE "deletedAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS rings_deleted_idx        ON "rings"("deletedAt") WHERE "deletedAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS couples_deleted_idx      ON "couples"("deletedAt") WHERE "deletedAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS clutches_deleted_idx     ON "clutches"("deletedAt") WHERE "deletedAt" IS NOT NULL;

COMMIT;
