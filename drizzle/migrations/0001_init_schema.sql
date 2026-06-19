-- ============================================================================
-- MIGRATION 0001: Schema inicial — Canário Lima
-- ============================================================================
-- Gerada diretamente a partir da fonte da verdade (drizzle/schema.ts) atual.
-- 100% idempotente: pode ser executada repetidamente sem erro, em qualquer
-- estado prévio do banco (vazio, parcialmente criado, ou criado por uma
-- versão antiga e incompatível deste mesmo arquivo).
--
-- IMPORTANTE: este arquivo NÃO usa enums (o schema.ts atual usa varchar para
-- todos os campos de "tipo"/"status"). Uma versão anterior deste arquivo
-- criava enums e tabelas antigas (rings, galleryPhotos, breederInfo) que não
-- têm relação com o código atual — essa versão antiga foi substituída.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "openId" VARCHAR(64) NOT NULL UNIQUE,
  "name" TEXT,
  "email" VARCHAR(320),
  "loginMethod" VARCHAR(64),
  "role" VARCHAR(20) NOT NULL DEFAULT 'user',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSignedIn" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- specialties
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- colors
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- breeders
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- ring_batches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ring_batches" (
  "id" SERIAL PRIMARY KEY,
  "batch_number" VARCHAR(50) NOT NULL,
  "year" INTEGER NOT NULL,
  "color" VARCHAR(50) NOT NULL,
  "quantity_total" INTEGER NOT NULL,
  "quantity_used" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(20) NOT NULL DEFAULT 'available',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- birds — pássaros do plantel (próprios). Pássaros de outros criadores
-- entram pelo campo "procedence" + o vínculo com "breeders"; ver nota no
-- final deste arquivo sobre o fluxo de registro multi-criador.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "birds" (
  "id" SERIAL PRIMARY KEY,
  "ring" VARCHAR(50) NOT NULL UNIQUE,
  "specialty_code" VARCHAR(50) NOT NULL,
  "sex" VARCHAR(20) NOT NULL,
  "color_code" VARCHAR(50) NOT NULL,
  "birthDate" TIMESTAMP,
  "procedence" VARCHAR(200),
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "fatherId" INTEGER,
  "motherId" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- couples (casais / pares de acasalamento)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "couples" (
  "id" SERIAL PRIMARY KEY,
  "maleId" INTEGER NOT NULL,
  "femaleId" INTEGER NOT NULL,
  "cageNumber" VARCHAR(50) NOT NULL,
  "formationDate" TIMESTAMP NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- clutches (posturas)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "clutches" (
  "id" SERIAL PRIMARY KEY,
  "coupleId" INTEGER NOT NULL,
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

-- ---------------------------------------------------------------------------
-- chicks (filhotes — origem da árvore genealógica junto com fatherId/motherId
-- em "birds")
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chicks" (
  "id" SERIAL PRIMARY KEY,
  "clutchId" INTEGER NOT NULL,
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

-- ---------------------------------------------------------------------------
-- genetic_rules (regras de cruzamento por cor)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "genetic_rules" (
  "id" SERIAL PRIMARY KEY,
  "male_color" VARCHAR(50) NOT NULL,
  "female_color" VARCHAR(50) NOT NULL,
  "rule_type" VARCHAR(50) NOT NULL,
  "description" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- specialty_colors (associação especialidade <-> cor permitida)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "specialty_colors" (
  "id" SERIAL PRIMARY KEY,
  "specialty_code" VARCHAR(50) NOT NULL,
  "color_code" VARCHAR(50) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Índices — cada um isolado em um bloco defensivo. Se alguma tabela já
-- existir de uma versão anterior/incompatível (sem a coluna referenciada), o
-- índice correspondente é apenas pulado (com aviso no log) em vez de abortar
-- a migration inteira.
-- ============================================================================
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "specialties_code_idx" ON "specialties" USING btree ("code");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index specialties_code_idx: coluna ausente (schema legado).';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "colors_code_idx" ON "colors" USING btree ("code");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index colors_code_idx: coluna ausente (schema legado).';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ring_batches_batch_idx" ON "ring_batches" USING btree ("batch_number");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index ring_batches_batch_idx: coluna ausente (schema legado).';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "birds_ring_idx" ON "birds" USING btree ("ring");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index birds_ring_idx: coluna ausente (schema legado).';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "birds_specialty_idx" ON "birds" USING btree ("specialty_code");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index birds_specialty_idx: coluna ausente (schema legado).';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "birds_color_idx" ON "birds" USING btree ("color_code");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index birds_color_idx: coluna ausente (schema legado).';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "couples_cage_idx" ON "couples" USING btree ("cageNumber");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index couples_cage_idx: coluna ausente (schema legado).';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "couples_status_idx" ON "couples" USING btree ("status");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index couples_status_idx: coluna ausente (schema legado).';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "clutches_couple_idx" ON "clutches" USING btree ("coupleId");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index clutches_couple_idx: coluna ausente (schema legado).';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "chicks_ring_idx" ON "chicks" USING btree ("ring");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index chicks_ring_idx: coluna ausente (schema legado).';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "chicks_clutch_idx" ON "chicks" USING btree ("clutchId");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index chicks_clutch_idx: coluna ausente (schema legado).';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "specialty_colors_idx" ON "specialty_colors" USING btree ("specialty_code", "color_code");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index specialty_colors_idx: coluna ausente (schema legado).';
END $$;

-- ============================================================================
-- NOTA sobre o fluxo "pássaro de outro criador" (registro multi-plantel):
-- O campo "procedence" em birds/chicks comporta o nome/identificação do
-- criador de origem em texto livre, e a tabela "breeders" já guarda o
-- cadastro completo de criadores externos (incluindo registro/associação).
-- Isso permite registrar um pássaro vindo de outro plantel sem misturar a
-- numeração de anilhas — basta usar a anilha original do pássaro (campo
-- "ring", que é livre/string, não gerada localmente) e preencher
-- "procedence" com a referência ao criador de origem (cadastrado em
-- "breeders"). A árvore genealógica (fatherId/motherId) funciona
-- normalmente mesmo quando um dos pais é um pássaro externo registrado
-- dessa forma, pois ele também ganha um "id" local na tabela "birds".
-- ============================================================================
