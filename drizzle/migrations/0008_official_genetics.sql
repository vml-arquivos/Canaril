-- Migration 0008: Catálogo Oficial FOB/OBJO e Perfis Genéticos Individuais
-- Adição de tabelas para o sistema de nomenclatura oficial e ficha genética
-- Migração SEGURA: apenas cria novas tabelas, não altera nenhuma existente.

-- Catálogo oficial de classes FOB/OBJO (Canário de Cor e Porte)
CREATE TABLE IF NOT EXISTS "official_bird_classes" (
  "id" serial PRIMARY KEY NOT NULL,
  "modality" varchar(10) NOT NULL,
  "officialCode" varchar(20) NOT NULL UNIQUE,
  "officialName" text NOT NULL,
  "abbreviation" varchar(50),
  "groupName" varchar(200),
  "subgroupName" varchar(200),
  "breedName" varchar(100),
  "bitola" varchar(50),
  "categoryName" varchar(50),
  "sourceYear" integer DEFAULT 2026,
  "sourceEntity" varchar(20) DEFAULT 'FOB/OBJO',
  "rawText" text,
  "interpretedTraits" jsonb,
  "active" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

-- Índices para busca eficiente
CREATE INDEX IF NOT EXISTS "official_bird_classes_code_idx" ON "official_bird_classes" ("officialCode");
CREATE INDEX IF NOT EXISTS "official_bird_classes_modality_idx" ON "official_bird_classes" ("modality");
CREATE INDEX IF NOT EXISTS "official_bird_classes_breed_idx" ON "official_bird_classes" ("breedName");

-- Perfil genético individual de cada pássaro
CREATE TABLE IF NOT EXISTS "bird_genetic_profiles" (
  "id" serial PRIMARY KEY NOT NULL,
  "birdId" integer NOT NULL UNIQUE,
  "officialClassId" integer,

  -- Identificação oficial
  "modality" varchar(10),
  "officialCode" varchar(20),
  "officialName" text,
  "officialAbbreviation" varchar(50),
  "officialGroup" varchar(200),
  "breedName" varchar(100),
  "bitola" varchar(50),

  -- Fenótipo
  "phenotypeName" text,
  "visualColorDescription" text,

  -- Traços genéticos interpretados
  "lipochromeBase" varchar(50),
  "melaninSeries" varchar(50),
  "featherCategory" varchar(30),
  "crestType" varchar(30),

  -- Status de genes especiais
  "dominantWhiteStatus" varchar(20),
  "recessiveWhiteStatus" varchar(20),
  "ivoryStatus" varchar(20),
  "redFactorStatus" varchar(20),
  "inoStatus" varchar(20),
  "urucumStatus" varchar(20),
  "asasBrancasStatus" varchar(20),

  -- Mutações (arrays JSON)
  "visibleMutations" jsonb,
  "carriedMutations" jsonb,
  "possibleCarriedMutations" jsonb,
  "unknownTraits" jsonb,

  -- Genótipo
  "genotypeJson" jsonb,
  "inferredGenotypeJson" jsonb,
  "confidenceScore" real DEFAULT 0.2,
  "geneticWarnings" jsonb,
  "nutritionRecommendations" jsonb,

  -- Controle
  "manualOverride" boolean DEFAULT false NOT NULL,
  "lastInferenceAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS "bird_genetic_profiles_bird_idx" ON "bird_genetic_profiles" ("birdId");
CREATE INDEX IF NOT EXISTS "bird_genetic_profiles_class_idx" ON "bird_genetic_profiles" ("officialClassId");
