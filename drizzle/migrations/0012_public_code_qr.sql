-- Migration 0012: publicCode para pássaros e gaiolas
-- Adição segura de coluna nullable — não quebra dados existentes.
-- O publicCode é gerado pelo backend na primeira vez que o criador ativa.
--
-- Rollback: DROP COLUMN IF EXISTS "publicCode"; em birds e cages

BEGIN;

ALTER TABLE birds
  ADD COLUMN IF NOT EXISTS "publicCode" varchar(20) UNIQUE;

ALTER TABLE cages
  ADD COLUMN IF NOT EXISTS "publicCode" varchar(20) UNIQUE;

CREATE INDEX IF NOT EXISTS birds_public_code_idx ON birds("publicCode")
  WHERE "publicCode" IS NOT NULL;

CREATE INDEX IF NOT EXISTS cages_public_code_idx ON cages("publicCode")
  WHERE "publicCode" IS NOT NULL;

COMMIT;
