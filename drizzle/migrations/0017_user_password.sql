-- Migration 0017: Campos de senha e controles adicionais de usuários
--
-- Esta migração adiciona colunas para suportar login multiusuário com
-- senha local e controles de expiração. Todas as adições são seguras
-- (ADD COLUMN IF NOT EXISTS) para evitar erros se já existirem.

BEGIN;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordHash" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN DEFAULT TRUE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "internalNote" TEXT;

COMMIT;