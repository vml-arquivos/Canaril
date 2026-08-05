-- Cadastro de gaiolas em lote, destinação estruturada e histórico seguro de casais.

ALTER TABLE "cages" ADD COLUMN IF NOT EXISTS "batchName" varchar(120);
ALTER TABLE "cages" ADD COLUMN IF NOT EXISTS "purpose" varchar(150);
ALTER TABLE "cages" ADD COLUMN IF NOT EXISTS "specialtyCode" varchar(50);
ALTER TABLE "cages" ADD COLUMN IF NOT EXISTS "breedName" varchar(100);

ALTER TABLE "couples" ADD COLUMN IF NOT EXISTS "endedAt" timestamp;
ALTER TABLE "couples" ADD COLUMN IF NOT EXISTS "endReason" text;

-- O código da gaiola deve ser único dentro de cada criadouro, e não globalmente
-- entre todos os clientes da plataforma. Registros arquivados podem ter o código
-- reutilizado sem apagar o histórico anterior.
ALTER TABLE "cages" DROP CONSTRAINT IF EXISTS "cages_code_unique";
DROP INDEX IF EXISTS "cages_code_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "cages_tenant_code_active_unique"
  ON "cages" ("tenantId", lower("code"))
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "cages_tenant_specialty_idx"
  ON "cages" ("tenantId", "specialtyCode")
  WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "cages_tenant_batch_idx"
  ON "cages" ("tenantId", "batchName")
  WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "couples_tenant_history_idx"
  ON "couples" ("tenantId", "status", "endedAt");

-- Normaliza casais previamente removidos pelo fluxo antigo para que a data de
-- encerramento fique disponível no relatório histórico.
UPDATE "couples"
   SET "endedAt" = COALESCE("endedAt", "deletedAt", "updatedAt")
 WHERE status <> 'active' AND "endedAt" IS NULL;
-- Corrige estados legados: casais já desfeitos não podem manter a gaiola
-- artificialmente ocupada. O estado de manutenção é preservado; nos demais
-- casos a ocupação é recalculada a partir de vínculos realmente ativos.
UPDATE "cages" c
   SET status = CASE
     WHEN c.status = 'maintenance' THEN 'maintenance'
     WHEN EXISTS (
       SELECT 1 FROM "couples" cp
        WHERE cp."tenantId" = c."tenantId"
          AND cp."cageId" = c.id
          AND cp.status = 'active'
          AND cp."deletedAt" IS NULL
     ) OR EXISTS (
       SELECT 1 FROM "birds" b
        WHERE b."tenantId" = c."tenantId"
          AND b."cageId" = c.id
          AND b.status = 'active'
          AND b."deletedAt" IS NULL
     ) THEN 'occupied'
     ELSE 'free'
   END,
       "updatedAt" = NOW()
 WHERE c."deletedAt" IS NULL;
