-- Migration 0010: Sistema profissional de anilhas
-- Expande ring_batches e rings com campos avançados e cria ring_gauge_rules
-- Todas as operações são seguras (IF NOT EXISTS / IF NOT EXISTS na coluna)

-- ============================================================
-- 1. Expandir ring_batches com campos do sistema profissional
-- ============================================================
ALTER TABLE ring_batches ADD COLUMN IF NOT EXISTS "breederCode"       VARCHAR(50);
ALTER TABLE ring_batches ADD COLUMN IF NOT EXISTS "associationName"   VARCHAR(100);
ALTER TABLE ring_batches ADD COLUMN IF NOT EXISTS "speciesName"       VARCHAR(50);
ALTER TABLE ring_batches ADD COLUMN IF NOT EXISTS "breedName"         VARCHAR(100);
ALTER TABLE ring_batches ADD COLUMN IF NOT EXISTS "modality"          VARCHAR(20);
ALTER TABLE ring_batches ADD COLUMN IF NOT EXISTS "ringGaugeMm"       REAL;
ALTER TABLE ring_batches ADD COLUMN IF NOT EXISTS "month"             INTEGER;
ALTER TABLE ring_batches ADD COLUMN IF NOT EXISTS "prefix"            VARCHAR(20);
ALTER TABLE ring_batches ADD COLUMN IF NOT EXISTS "suffix"            VARCHAR(20);
ALTER TABLE ring_batches ADD COLUMN IF NOT EXISTS "startNumber"       INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ring_batches ADD COLUMN IF NOT EXISTS "endNumber"         INTEGER NOT NULL DEFAULT 200;
ALTER TABLE ring_batches ADD COLUMN IF NOT EXISTS "currentNumber"     INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ring_batches ADD COLUMN IF NOT EXISTS "formatPattern"     VARCHAR(100) NOT NULL DEFAULT '{breederCode}-{year}-{seq}';
ALTER TABLE ring_batches ADD COLUMN IF NOT EXISTS "notes"             TEXT;

-- Índices adicionais para ring_batches
CREATE INDEX IF NOT EXISTS ring_batches_year_idx   ON ring_batches ("year");
CREATE INDEX IF NOT EXISTS ring_batches_status_idx ON ring_batches ("status");

-- ============================================================
-- 2. Expandir rings com fullCode, ringSource e campos extras
-- ============================================================
ALTER TABLE rings ADD COLUMN IF NOT EXISTS "fullCode"    VARCHAR(100);
ALTER TABLE rings ADD COLUMN IF NOT EXISTS "ringSource"  VARCHAR(20) NOT NULL DEFAULT 'BATCH';
ALTER TABLE rings ADD COLUMN IF NOT EXISTS "reservedAt"  TIMESTAMP;
ALTER TABLE rings ADD COLUMN IF NOT EXISTS "notes"       TEXT;

-- Índice para fullCode (busca rápida por código completo)
CREATE INDEX IF NOT EXISTS rings_fullcode_idx ON rings ("fullCode");

-- Preencher fullCode retroativamente para rings existentes (usa o number como fallback)
UPDATE rings SET "fullCode" = "number" WHERE "fullCode" IS NULL;

-- ============================================================
-- 3. Criar tabela ring_gauge_rules (bitola por espécie/raça)
-- ============================================================
CREATE TABLE IF NOT EXISTS ring_gauge_rules (
  id                  SERIAL PRIMARY KEY,
  "speciesName"       VARCHAR(50)  NOT NULL,
  "breedName"         VARCHAR(100),
  "modality"          VARCHAR(20),
  "recommendedGaugeMm" REAL        NOT NULL,
  "minGaugeMm"        REAL,
  "maxGaugeMm"        REAL,
  notes               TEXT,
  active              BOOLEAN      NOT NULL DEFAULT TRUE,
  "createdAt"         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ring_gauge_rules_species_idx ON ring_gauge_rules ("speciesName");
CREATE INDEX IF NOT EXISTS ring_gauge_rules_breed_idx   ON ring_gauge_rules ("breedName");

-- ============================================================
-- 4. Seed inicial de bitolas por espécie/raça (canários)
-- ============================================================
INSERT INTO ring_gauge_rules ("speciesName", "breedName", "modality", "recommendedGaugeMm", "minGaugeMm", "maxGaugeMm", notes)
VALUES
  -- Canário de Cor (bitola padrão 2.9mm)
  ('Canário', NULL,              'COR',   2.9, 2.7, 3.1, 'Bitola padrão FOB para canário de cor'),
  ('Canário', 'Gloster',        'PORTE', 2.9, 2.7, 3.1, 'Gloster Corona e Consort — porte pequeno'),
  ('Canário', 'Fife Fancy',     'PORTE', 2.9, 2.7, 3.0, 'Fife Fancy — menor raça de porte'),
  ('Canário', 'Border Fancy',   'PORTE', 3.0, 2.9, 3.2, 'Border Fancy — porte médio'),
  ('Canário', 'Yorkshire',      'PORTE', 3.2, 3.0, 3.4, 'Yorkshire — porte grande'),
  ('Canário', 'Norwich',        'PORTE', 3.2, 3.0, 3.4, 'Norwich — porte grande robusto'),
  ('Canário', 'Scotch Fancy',   'PORTE', 3.0, 2.9, 3.2, 'Scotch Fancy — porte médio'),
  ('Canário', 'Frisado do Sul', 'PORTE', 3.2, 3.0, 3.4, 'Frisado do Sul — porte grande'),
  ('Canário', 'Frisado do Norte','PORTE',3.2, 3.0, 3.4, 'Frisado do Norte — porte grande'),
  ('Canário', 'Belga Clássico', 'PORTE', 3.2, 3.0, 3.4, 'Belga Clássico — porte grande'),
  ('Canário', 'Lizard',         'PORTE', 2.9, 2.7, 3.1, 'Lizard — porte pequeno/médio'),
  ('Canário', 'Lancashire',     'PORTE', 3.4, 3.2, 3.6, 'Lancashire — maior raça de porte'),
  ('Canário', 'Hollander',      'PORTE', 3.0, 2.9, 3.2, 'Hollander — porte médio'),
  -- Canário de Canto
  ('Canário', 'Roller',         'CANTO', 2.9, 2.7, 3.1, 'Roller / Harzer — porte pequeno'),
  ('Canário', 'Malinois',       'CANTO', 2.9, 2.7, 3.1, 'Malinois Waterslager'),
  ('Canário', 'Timbrado',       'CANTO', 2.9, 2.7, 3.1, 'Timbrado Espanhol'),
  -- Outras espécies comuns em criadouros
  ('Pintassilgo', NULL, 'OUTRA', 2.5, 2.3, 2.7, 'Pintassilgo europeu'),
  ('Coleiro',     NULL, 'OUTRA', 2.5, 2.3, 2.7, 'Coleiro do brejo'),
  ('Curió',       NULL, 'OUTRA', 2.7, 2.5, 2.9, 'Curió'),
  ('Bicudo',      NULL, 'OUTRA', 3.0, 2.8, 3.2, 'Bicudo')
ON CONFLICT DO NOTHING;
