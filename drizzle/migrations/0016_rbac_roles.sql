-- Migration 0016: RBAC — Roles profissionais e isolamento por tenant
-- Zero destrutiva: apenas ADD COLUMN IF NOT EXISTS e UPDATE seguros
--
-- Roles introduzidos:
--   PLATFORM_ADMIN  — administrador global da plataforma (era 'admin')
--   CANARIL_MANAGER — responsável operacional de um canaril (era 'user')
--   CANARIL_MEMBER  — membro com acesso limitado (novo)
--   VIEWER          — somente leitura (novo)

BEGIN;

-- 1. Expandir role para 30 chars (era 20, agora suporta 'PLATFORM_ADMIN')
DO $$ BEGIN
  IF (
    SELECT character_maximum_length
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'role'
  ) < 30 THEN
    ALTER TABLE "users" ALTER COLUMN "role" TYPE VARCHAR(30);
  END IF;
EXCEPTION WHEN OTHERS THEN
  ALTER TABLE "users" ALTER COLUMN "role" TYPE VARCHAR(30);
END $$;

-- 2. Adicionar colunas de controle de acesso (idempotente)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tenantId"       INTEGER REFERENCES "tenants"("id") ON DELETE SET NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isActive"        BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginAt"     TIMESTAMP;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "disabledAt"      TIMESTAMP;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "disabledBy"      INTEGER;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "disabledReason"  TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "accessExpiresAt" TIMESTAMP;

-- 3. Migrar roles legados → novos (idempotente via CASE)
UPDATE "users"
SET "role" = CASE
  WHEN "role" IN ('admin', 'OWNER', 'SUPER_ADMIN') THEN 'PLATFORM_ADMIN'
  WHEN "role" IN ('user', 'MEMBER')               THEN 'CANARIL_MANAGER'
  ELSE "role"  -- preserva roles já corretos (PLATFORM_ADMIN, CANARIL_MANAGER, etc.)
END
WHERE "role" NOT IN ('PLATFORM_ADMIN', 'CANARIL_MANAGER', 'CANARIL_MEMBER', 'VIEWER');

-- 4. Índices para performance em lookups por tenant e role
CREATE INDEX IF NOT EXISTS users_tenant_idx ON "users"("tenantId") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS users_role_idx   ON "users"("role")     WHERE "deletedAt" IS NULL;

COMMIT;
