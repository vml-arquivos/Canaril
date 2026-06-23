-- Migration 0015: Canaril Intelligence Core
-- Tabelas de conhecimento interno — todas idempotentes
BEGIN;

CREATE TABLE IF NOT EXISTS "species_knowledge" (
  "id"              SERIAL PRIMARY KEY,
  "code"            VARCHAR(30) NOT NULL UNIQUE,
  "commonName"      VARCHAR(100) NOT NULL,
  "scientificName"  VARCHAR(100),
  "groupName"       VARCHAR(50),
  "defaultSexSystem" VARCHAR(20) DEFAULT 'ZZ_ZW',
  "notes"           TEXT,
  "active"          BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"       TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "breed_knowledge" (
  "id"               SERIAL PRIMARY KEY,
  "speciesCode"      VARCHAR(30) NOT NULL,
  "modality"         VARCHAR(20) NOT NULL,
  "code"             VARCHAR(50) NOT NULL UNIQUE,
  "name"             VARCHAR(100) NOT NULL,
  "aliases"          JSONB DEFAULT '[]',
  "hasCrest"         BOOLEAN NOT NULL DEFAULT FALSE,
  "hasPorteStandard" BOOLEAN NOT NULL DEFAULT FALSE,
  "hasColorStandard" BOOLEAN NOT NULL DEFAULT FALSE,
  "defaultRingGaugeMm" REAL,
  "description"      TEXT,
  "active"           BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"        TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bk_species_mod_idx ON "breed_knowledge"("speciesCode","modality");

CREATE TABLE IF NOT EXISTS "color_knowledge" (
  "id"               SERIAL PRIMARY KEY,
  "speciesCode"      VARCHAR(30) NOT NULL,
  "modality"         VARCHAR(20) NOT NULL,
  "code"             VARCHAR(50) NOT NULL UNIQUE,
  "name"             VARCHAR(100) NOT NULL,
  "type"             VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
  "lipochromeBase"   VARCHAR(50),
  "melaninSeries"    VARCHAR(50),
  "featherCategory"  VARCHAR(30),
  "aliases"          JSONB DEFAULT '[]',
  "description"      TEXT,
  "active"           BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS ck_species_mod_idx ON "color_knowledge"("speciesCode","modality");

CREATE TABLE IF NOT EXISTS "mutation_knowledge" (
  "id"                  SERIAL PRIMARY KEY,
  "speciesCode"         VARCHAR(30) NOT NULL,
  "code"                VARCHAR(50) NOT NULL UNIQUE,
  "name"                VARCHAR(100) NOT NULL,
  "aliases"             JSONB DEFAULT '[]',
  "inheritanceType"     VARCHAR(40) NOT NULL DEFAULT 'UNKNOWN',
  "allowsCarrierMale"   BOOLEAN NOT NULL DEFAULT FALSE,
  "allowsCarrierFemale" BOOLEAN NOT NULL DEFAULT FALSE,
  "hasLethalDoubleFactor" BOOLEAN NOT NULL DEFAULT FALSE,
  "visibleStates"       JSONB DEFAULT '[]',
  "carrierStates"       JSONB DEFAULT '[]',
  "description"         TEXT,
  "warnings"            TEXT,
  "active"              BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS "genetic_rule_knowledge" (
  "id"                  SERIAL PRIMARY KEY,
  "speciesCode"         VARCHAR(30) NOT NULL,
  "ruleCode"            VARCHAR(50) NOT NULL UNIQUE,
  "ruleType"            VARCHAR(30) NOT NULL,
  "title"               VARCHAR(200) NOT NULL,
  "description"         TEXT,
  "conditionJson"       JSONB,
  "resultJson"          JSONB,
  "severity"            VARCHAR(20) NOT NULL DEFAULT 'medium',
  "explanationSimple"   TEXT,
  "explanationTechnical" TEXT,
  "active"              BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS "scenario_rule_knowledge" (
  "id"                  SERIAL PRIMARY KEY,
  "speciesCode"         VARCHAR(30) NOT NULL,
  "scenarioCode"        VARCHAR(50) NOT NULL UNIQUE,
  "title"               VARCHAR(200) NOT NULL,
  "description"         TEXT,
  "appliesTo"           VARCHAR(50),
  "conditionJson"       JSONB,
  "recommendationJson"  JSONB,
  "severity"            VARCHAR(20) NOT NULL DEFAULT 'medium',
  "explanationSimple"   TEXT,
  "active"              BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS "knowledge_explanations" (
  "id"                   SERIAL PRIMARY KEY,
  "term"                 VARCHAR(100) NOT NULL UNIQUE,
  "simpleExplanation"    TEXT NOT NULL,
  "technicalExplanation" TEXT,
  "examples"             JSONB DEFAULT '[]',
  "warnings"             TEXT,
  "active"               BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS "dynamic_field_rules" (
  "id"                   SERIAL PRIMARY KEY,
  "speciesCode"          VARCHAR(30) NOT NULL,
  "modality"             VARCHAR(20),
  "breedCode"            VARCHAR(50),
  "fieldKey"             VARCHAR(50) NOT NULL,
  "showWhenJson"         JSONB,
  "hideWhenJson"         JSONB,
  "requiredWhenJson"     JSONB,
  "allowedValuesJson"    JSONB,
  "defaultValue"         TEXT,
  "helpText"             TEXT,
  "active"               BOOLEAN NOT NULL DEFAULT TRUE
);

COMMIT;
