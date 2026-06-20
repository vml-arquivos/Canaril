-- ============================================================================
-- MIGRATION 0007: Genótipo Avançado (bird_genotype)
-- ============================================================================
-- Tabela opcional, 1:1 com "birds". Não altera nenhuma tabela existente —
-- puramente aditiva. Idempotente, mesmo padrão das anteriores.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "bird_genotype" (
  "id" SERIAL PRIMARY KEY,
  "birdId" INTEGER NOT NULL UNIQUE,
  "backgroundColor" VARCHAR(30),
  "featherType" VARCHAR(20),
  "hasCrest" BOOLEAN NOT NULL DEFAULT false,
  "mutations" JSONB,
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "bird_genotype_bird_idx" ON "bird_genotype" USING btree ("birdId");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index bird_genotype_bird_idx: coluna ausente.';
END $$;
