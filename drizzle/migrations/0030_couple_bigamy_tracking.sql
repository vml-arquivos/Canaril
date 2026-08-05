-- Rastreabilidade do uso reprodutivo do macho e vínculo obrigatório com gaiola cadastrada.
ALTER TABLE "couples" ADD COLUMN IF NOT EXISTS "pairingMethod" varchar(20) NOT NULL DEFAULT 'monogamy';
ALTER TABLE "couples" ADD COLUMN IF NOT EXISTS "maleReuseConfirmed" boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "couples_male_active_idx" ON "couples" ("tenantId", "maleId", "status");
CREATE INDEX IF NOT EXISTS "couples_cage_id_active_idx" ON "couples" ("tenantId", "cageId", "status");
