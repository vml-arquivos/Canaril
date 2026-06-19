-- ============================================================================
-- MIGRATION 0004: Expansão v2 — Anilhas individuais, fotos, gaiolas,
-- campeonatos/juízes e Juiz Virtual com IA.
-- ============================================================================
-- 100% idempotente, igual às anteriores: ALTER ... ADD COLUMN IF NOT EXISTS
-- nas tabelas existentes, CREATE TABLE IF NOT EXISTS nas novas.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Novas colunas em tabelas existentes
-- ---------------------------------------------------------------------------
ALTER TABLE "specialties" ADD COLUMN IF NOT EXISTS "official_code" VARCHAR(50);
ALTER TABLE "specialties" ADD COLUMN IF NOT EXISTS "official_body" VARCHAR(20);

ALTER TABLE "colors" ADD COLUMN IF NOT EXISTS "official_code" VARCHAR(50);
ALTER TABLE "colors" ADD COLUMN IF NOT EXISTS "official_body" VARCHAR(20);

ALTER TABLE "birds" ADD COLUMN IF NOT EXISTS "cageId" INTEGER;
ALTER TABLE "birds" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "couples" ADD COLUMN IF NOT EXISTS "cageId" INTEGER;

ALTER TABLE "chicks" ADD COLUMN IF NOT EXISTS "birdId" INTEGER;

ALTER TABLE "genetic_rules" ADD COLUMN IF NOT EXISTS "probability_outcomes" JSONB;

-- ---------------------------------------------------------------------------
-- rings (anilhas individuais)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "rings" (
  "id" SERIAL PRIMARY KEY,
  "batchId" INTEGER NOT NULL,
  "number" VARCHAR(50) NOT NULL UNIQUE,
  "sequence" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'available',
  "birdId" INTEGER,
  "chickId" INTEGER,
  "usedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- photos (polimórfica: bird | chick | breeder | championship_entry)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "photos" (
  "id" SERIAL PRIMARY KEY,
  "entityType" VARCHAR(30) NOT NULL,
  "entityId" INTEGER NOT NULL,
  "storageKey" VARCHAR(500) NOT NULL,
  "url" VARCHAR(500) NOT NULL,
  "caption" VARCHAR(200),
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "takenAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- cages (mapeamento espacial)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "cages" (
  "id" SERIAL PRIMARY KEY,
  "code" VARCHAR(50) NOT NULL UNIQUE,
  "section" VARCHAR(100),
  "capacity" INTEGER NOT NULL DEFAULT 1,
  "status" VARCHAR(20) NOT NULL DEFAULT 'free',
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- championships
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "championships" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(200) NOT NULL,
  "association" VARCHAR(100),
  "location" VARCHAR(200),
  "startDate" TIMESTAMP NOT NULL,
  "endDate" TIMESTAMP,
  "status" VARCHAR(20) NOT NULL DEFAULT 'upcoming',
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- championship_entries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "championship_entries" (
  "id" SERIAL PRIMARY KEY,
  "championshipId" INTEGER NOT NULL,
  "birdId" INTEGER NOT NULL,
  "category" VARCHAR(150) NOT NULL,
  "cageNumberAtShow" VARCHAR(50),
  "status" VARCHAR(20) NOT NULL DEFAULT 'registered',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- judges
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "judges" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(150) NOT NULL,
  "registrationNumber" VARCHAR(50),
  "association" VARCHAR(100),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- scores
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "scores" (
  "id" SERIAL PRIMARY KEY,
  "entryId" INTEGER NOT NULL,
  "judgeId" INTEGER,
  "criteria_scores" JSONB,
  "totalScore" REAL NOT NULL,
  "placement" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- ai_judge_analyses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ai_judge_analyses" (
  "id" SERIAL PRIMARY KEY,
  "birdId" INTEGER,
  "entryId" INTEGER,
  "photoUrl" VARCHAR(500) NOT NULL,
  "specialty_code" VARCHAR(50) NOT NULL,
  "model" VARCHAR(100) NOT NULL,
  "criteria_scores" JSONB,
  "overallScore" REAL,
  "confidence" REAL,
  "summary" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Índices — cada um em bloco defensivo, igual ao padrão da 0001.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "birds_cage_idx" ON "birds" USING btree ("cageId");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index birds_cage_idx: coluna ausente.';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "chicks_bird_idx" ON "chicks" USING btree ("birdId");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index chicks_bird_idx: coluna ausente.';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "rings_batch_idx" ON "rings" USING btree ("batchId");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index rings_batch_idx: coluna ausente.';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "rings_status_idx" ON "rings" USING btree ("status");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index rings_status_idx: coluna ausente.';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "photos_entity_idx" ON "photos" USING btree ("entityType", "entityId");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index photos_entity_idx: coluna ausente.';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "cages_code_idx" ON "cages" USING btree ("code");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index cages_code_idx: coluna ausente.';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "championship_entries_championship_idx" ON "championship_entries" USING btree ("championshipId");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index championship_entries_championship_idx: coluna ausente.';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "championship_entries_bird_idx" ON "championship_entries" USING btree ("birdId");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index championship_entries_bird_idx: coluna ausente.';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "scores_entry_idx" ON "scores" USING btree ("entryId");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index scores_entry_idx: coluna ausente.';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ai_judge_analyses_bird_idx" ON "ai_judge_analyses" USING btree ("birdId");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index ai_judge_analyses_bird_idx: coluna ausente.';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ai_judge_analyses_entry_idx" ON "ai_judge_analyses" USING btree ("entryId");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index ai_judge_analyses_entry_idx: coluna ausente.';
END $$;
