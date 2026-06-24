-- Migration 0017: Isolamento multi-canaril — tenantId em todas as tabelas operacionais
-- Totalmente segura: ADD COLUMN IF NOT EXISTS (nullable), sem NOT NULL, sem DROP
-- O backfill dos dados antigos para o tenant principal é feito no bloco BACKFILL abaixo.

BEGIN;

-- ─── birds ────────────────────────────────────────────────────────────────────
ALTER TABLE "birds" ADD COLUMN IF NOT EXISTS "tenantId" integer;
CREATE INDEX IF NOT EXISTS "idx_birds_tenantId" ON "birds"("tenantId");

-- ─── ring_batches ─────────────────────────────────────────────────────────────
ALTER TABLE "ring_batches" ADD COLUMN IF NOT EXISTS "tenantId" integer;
CREATE INDEX IF NOT EXISTS "idx_ring_batches_tenantId" ON "ring_batches"("tenantId");

-- ─── rings ────────────────────────────────────────────────────────────────────
ALTER TABLE "rings" ADD COLUMN IF NOT EXISTS "tenantId" integer;
CREATE INDEX IF NOT EXISTS "idx_rings_tenantId" ON "rings"("tenantId");

-- ─── couples ──────────────────────────────────────────────────────────────────
ALTER TABLE "couples" ADD COLUMN IF NOT EXISTS "tenantId" integer;
CREATE INDEX IF NOT EXISTS "idx_couples_tenantId" ON "couples"("tenantId");

-- ─── clutches ─────────────────────────────────────────────────────────────────
ALTER TABLE "clutches" ADD COLUMN IF NOT EXISTS "tenantId" integer;
CREATE INDEX IF NOT EXISTS "idx_clutches_tenantId" ON "clutches"("tenantId");

-- ─── chicks ───────────────────────────────────────────────────────────────────
ALTER TABLE "chicks" ADD COLUMN IF NOT EXISTS "tenantId" integer;
CREATE INDEX IF NOT EXISTS "idx_chicks_tenantId" ON "chicks"("tenantId");

-- ─── cages ────────────────────────────────────────────────────────────────────
ALTER TABLE "cages" ADD COLUMN IF NOT EXISTS "tenantId" integer;
CREATE INDEX IF NOT EXISTS "idx_cages_tenantId" ON "cages"("tenantId");

-- ─── championships ────────────────────────────────────────────────────────────
ALTER TABLE "championships" ADD COLUMN IF NOT EXISTS "tenantId" integer;
CREATE INDEX IF NOT EXISTS "idx_championships_tenantId" ON "championships"("tenantId");

-- ─── championship_entries ─────────────────────────────────────────────────────
ALTER TABLE "championship_entries" ADD COLUMN IF NOT EXISTS "tenantId" integer;
CREATE INDEX IF NOT EXISTS "idx_championship_entries_tenantId" ON "championship_entries"("tenantId");

-- ─── health_records ───────────────────────────────────────────────────────────
ALTER TABLE "health_records" ADD COLUMN IF NOT EXISTS "tenantId" integer;
CREATE INDEX IF NOT EXISTS "idx_health_records_tenantId" ON "health_records"("tenantId");

-- ─── breeding_daily_logs ──────────────────────────────────────────────────────
ALTER TABLE "breeding_daily_logs" ADD COLUMN IF NOT EXISTS "tenantId" integer;
CREATE INDEX IF NOT EXISTS "idx_breeding_daily_logs_tenantId" ON "breeding_daily_logs"("tenantId");

-- ─── breeding_reminders ───────────────────────────────────────────────────────
ALTER TABLE "breeding_reminders" ADD COLUMN IF NOT EXISTS "tenantId" integer;

-- ─── bird_genotype ────────────────────────────────────────────────────────────
ALTER TABLE "bird_genotype" ADD COLUMN IF NOT EXISTS "tenantId" integer;

-- ─── bird_genetic_profiles ────────────────────────────────────────────────────
ALTER TABLE "bird_genetic_profiles" ADD COLUMN IF NOT EXISTS "tenantId" integer;

-- ─── ai_judge_analyses ────────────────────────────────────────────────────────
ALTER TABLE "ai_judge_analyses" ADD COLUMN IF NOT EXISTS "tenantId" integer;

-- ─── bird_photo_analyses ─────────────────────────────────────────────────────
ALTER TABLE "bird_photo_analyses" ADD COLUMN IF NOT EXISTS "tenantId" integer;

-- ─── bird_genetic_inference_logs ─────────────────────────────────────────────
ALTER TABLE "bird_genetic_inference_logs" ADD COLUMN IF NOT EXISTS "tenantId" integer;

-- ─── photos ───────────────────────────────────────────────────────────────────
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "tenantId" integer;

-- ─── BACKFILL: dados antigos pertencem ao tenant principal (id=1) ─────────────
-- Usa id=1 como padrão seguro. Se o tenant principal tiver outro id, ajustar manualmente.
-- Este UPDATE só afeta linhas sem tenantId (dados pré-existentes).
DO $$
DECLARE
  v_tenant_id integer;
BEGIN
  -- Descobrir o tenant principal (o de menor id não deletado)
  SELECT id INTO v_tenant_id FROM "tenants" WHERE "deletedAt" IS NULL ORDER BY id ASC LIMIT 1;
  IF v_tenant_id IS NULL THEN
    -- Se não houver tenant ainda, não faz backfill (será feito após criar o primeiro tenant)
    RETURN;
  END IF;

  UPDATE "birds"             SET "tenantId" = v_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "ring_batches"      SET "tenantId" = v_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "rings"             SET "tenantId" = v_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "couples"           SET "tenantId" = v_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "clutches"          SET "tenantId" = v_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "chicks"            SET "tenantId" = v_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "cages"             SET "tenantId" = v_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "championships"     SET "tenantId" = v_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "championship_entries" SET "tenantId" = v_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "health_records"    SET "tenantId" = v_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "breeding_daily_logs"   SET "tenantId" = v_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "breeding_reminders"    SET "tenantId" = v_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "bird_genotype"         SET "tenantId" = v_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "bird_genetic_profiles" SET "tenantId" = v_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "ai_judge_analyses"     SET "tenantId" = v_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "bird_photo_analyses"   SET "tenantId" = v_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "bird_genetic_inference_logs" SET "tenantId" = v_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "photos"                SET "tenantId" = v_tenant_id WHERE "tenantId" IS NULL;

  -- Atualizar o usuário PLATFORM_ADMIN principal para vinculá-lo ao tenant principal
  UPDATE "users"
    SET "tenantId" = v_tenant_id
  WHERE "tenantId" IS NULL
    AND "role" IN ('PLATFORM_ADMIN', 'admin', 'OWNER', 'SUPER_ADMIN')
    AND "deletedAt" IS NULL;

END $$;

COMMIT;
