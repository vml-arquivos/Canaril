-- Migration 0013: Melhorias Missão 3
-- 1. Tabela bird_events (Linha do Tempo)
-- 2. Tabela judging_criteria_profiles (Juiz IA por raça/classe)
-- 3. Índice parcial no status dos pássaros para queries de plantel
-- Todas as adições são seguras (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS)

BEGIN;

-- ─── 1. Linha do Tempo: bird_events ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "bird_events" (
  "id"          SERIAL PRIMARY KEY,
  "birdId"      INTEGER NOT NULL REFERENCES "birds"("id") ON DELETE CASCADE,
  "eventType"   VARCHAR(30) NOT NULL,  -- birth|ring|photo|genotype|couple|clutch|health|champ|note
  "eventDate"   TIMESTAMP NOT NULL,
  "title"       VARCHAR(200) NOT NULL,
  "description" TEXT,
  "metadata"    JSONB,                 -- dados extras por tipo (ex: score, coupleId)
  "createdAt"   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bird_events_bird_idx ON "bird_events"("birdId");
CREATE INDEX IF NOT EXISTS bird_events_date_idx ON "bird_events"("eventDate" DESC);

-- ─── 2. Perfis de critério para Juiz IA ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "judging_criteria_profiles" (
  "id"          SERIAL PRIMARY KEY,
  "modality"    VARCHAR(30) NOT NULL,   -- COR | PORTE | CANTO | MOSAICO
  "raceName"    VARCHAR(100),           -- null = aplica a toda modalidade
  "officialCode" VARCHAR(20),           -- código FOB/OBJO específico
  "criteria"    JSONB NOT NULL,         -- array de {criterion, maxScore, weight, description}
  "description" VARCHAR(300),
  "isDefault"   BOOLEAN DEFAULT false NOT NULL,
  "createdAt"   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS judging_profiles_modality_idx ON "judging_criteria_profiles"("modality");

-- Seed: perfil padrão para cada modalidade principal
INSERT INTO "judging_criteria_profiles"
  ("modality", "raceName", "criteria", "description", "isDefault")
VALUES
  ('COR', NULL,
   '[
     {"criterion": "Cor e intensidade", "maxScore": 25, "weight": 0.25, "description": "Pureza e saturação do lipocromo"},
     {"criterion": "Plumagem e condição", "maxScore": 25, "weight": 0.25, "description": "Estado das penas, ausência de defeitos"},
     {"criterion": "Tipo e postura", "maxScore": 20, "weight": 0.20, "description": "Posição no poleiro, porte geral"},
     {"criterion": "Tamanho e proporção", "maxScore": 15, "weight": 0.15, "description": "Proporção cabeça/corpo/cauda"},
     {"criterion": "Condição geral", "maxScore": 15, "weight": 0.15, "description": "Vitalidade, saúde aparente"}
   ]',
   'Perfil padrão para canários de cor (lipocromo)', true),
  ('PORTE', NULL,
   '[
     {"criterion": "Tipo racial", "maxScore": 30, "weight": 0.30, "description": "Conformidade com o padrão da raça"},
     {"criterion": "Posição e postura", "maxScore": 25, "weight": 0.25, "description": "Ângulo e firmeza no poleiro"},
     {"criterion": "Plumagem", "maxScore": 20, "weight": 0.20, "description": "Qualidade e limpeza das penas"},
     {"criterion": "Tamanho", "maxScore": 15, "weight": 0.15, "description": "Correspondência ao padrão de tamanho da raça"},
     {"criterion": "Condição geral", "maxScore": 10, "weight": 0.10, "description": "Saúde e vitalidade aparente"}
   ]',
   'Perfil padrão para canários de porte', true),
  ('MOSAICO', NULL,
   '[
     {"criterion": "Distribuição do mosaico", "maxScore": 30, "weight": 0.30, "description": "Concentração do pigmento nas zonas corretas (máscara, ombros, coxa)"},
     {"criterion": "Cor e saturação", "maxScore": 25, "weight": 0.25, "description": "Intensidade do lipocromo nas zonas de mosaico"},
     {"criterion": "Nitidez das bordas", "maxScore": 20, "weight": 0.20, "description": "Contraste entre zona colorida e zona branca/clara"},
     {"criterion": "Plumagem e condição", "maxScore": 15, "weight": 0.15, "description": "Estado das penas"},
     {"criterion": "Condição geral", "maxScore": 10, "weight": 0.10, "description": "Vitalidade e saúde aparente"}
   ]',
   'Perfil padrão para canários mosaico', true)
ON CONFLICT DO NOTHING;

-- ─── 3. Índice de performance para relatório de plantel ───────────────────────
CREATE INDEX IF NOT EXISTS birds_status_sex_idx ON "birds"("status", "sex");

COMMIT;
