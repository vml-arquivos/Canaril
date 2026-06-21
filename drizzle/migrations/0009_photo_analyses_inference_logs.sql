-- Migration 0009: bird_photo_analyses e bird_genetic_inference_logs
-- Tabelas para análise fenotípica por foto (IA) e log de inferências genéticas.
-- SAFE: usa IF NOT EXISTS em todas as operações.

-- ============================================================================
-- Tabela: bird_photo_analyses
-- Registra análises fenotípicas por foto feitas pela IA.
-- O usuário deve confirmar antes de salvar no perfil genético.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "bird_photo_analyses" (
  "id"                        SERIAL PRIMARY KEY,
  "birdId"                    INTEGER NOT NULL,
  "photos"                    JSONB,
  "aiProvider"                VARCHAR(50) DEFAULT 'gemini',
  "modelUsed"                 VARCHAR(100),
  "rawResponseJson"           JSONB,
  "visualTraitsJson"          JSONB,
  "possibleOfficialClassesJson" JSONB,
  "confidenceOverall"         REAL DEFAULT 0,
  "warnings"                  JSONB,
  "recommendations"           JSONB,
  "fieldsNotConfirmed"        JSONB,
  "acceptedByUser"            BOOLEAN NOT NULL DEFAULT FALSE,
  "acceptedOfficialClassId"   INTEGER,
  "processingTimeMs"          INTEGER,
  "createdAt"                 TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"                 TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "bird_photo_analyses_bird_idx"
  ON "bird_photo_analyses" ("birdId");

-- ============================================================================
-- Tabela: bird_genetic_inference_logs
-- Log de cada atualização do perfil genético de um pássaro.
-- Fontes: PHOTO_AI | OFFICIAL_CLASS | PEDIGREE | OFFSPRING_RESULT | MANUAL
-- ============================================================================
CREATE TABLE IF NOT EXISTS "bird_genetic_inference_logs" (
  "id"          SERIAL PRIMARY KEY,
  "birdId"      INTEGER NOT NULL,
  "sourceType"  VARCHAR(30) NOT NULL,
  "beforeJson"  JSONB,
  "afterJson"   JSONB,
  "confidence"  REAL DEFAULT 0,
  "reason"      TEXT,
  "createdAt"   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "bird_genetic_inference_logs_bird_idx"
  ON "bird_genetic_inference_logs" ("birdId");

CREATE INDEX IF NOT EXISTS "bird_genetic_inference_logs_source_idx"
  ON "bird_genetic_inference_logs" ("sourceType");
