-- Rastreabilidade entre o lançamento de eclosão e os filhotes criados.
-- Migração aditiva e idempotente: não altera registros existentes.

ALTER TABLE IF EXISTS "chicks"
  ADD COLUMN IF NOT EXISTS "hatchLogId" INTEGER;

CREATE INDEX IF NOT EXISTS "chicks_hatch_log_idx"
  ON "chicks" ("hatchLogId");

COMMENT ON COLUMN "chicks"."hatchLogId" IS
  'Log CHICK_HATCHED responsável pela criação do filhote; usado para correções transacionais.';
