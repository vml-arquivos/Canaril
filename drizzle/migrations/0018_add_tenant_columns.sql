-- 0018_add_tenant_columns.sql
-- Esta migration adiciona colunas tenantId às tabelas principais de operação
-- para suportar isolamento multi‑canaril. As colunas são adicionadas como
-- opcionais (NULL) para permitir backfill seguro. Após backfill, novas
-- inserções devem sempre preencher tenantId.

ALTER TABLE "birds" ADD COLUMN IF NOT EXISTS "tenantId" integer;
CREATE INDEX IF NOT EXISTS "idx_birds_tenantId" ON "birds" ("tenantId");

ALTER TABLE "ring_batches" ADD COLUMN IF NOT EXISTS "tenantId" integer;
CREATE INDEX IF NOT EXISTS "idx_ring_batches_tenantId" ON "ring_batches" ("tenantId");

ALTER TABLE "rings" ADD COLUMN IF NOT EXISTS "tenantId" integer;
CREATE INDEX IF NOT EXISTS "idx_rings_tenantId" ON "rings" ("tenantId");

-- Futuras migrations podem adicionar tenantId a outras tabelas (casais, posturas,
-- filhotes, gaiolas, campeonatos, auditoria, etc.) conforme necessário.