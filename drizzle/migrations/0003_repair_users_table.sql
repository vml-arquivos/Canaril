-- ============================================================================
-- MIGRATION 0003: Reparo defensivo da tabela "users"
-- ============================================================================
-- Garante que "users" fique exatamente no formato esperado pelo código atual
-- (drizzle/schema.ts + server/db.ts), não importa qual era o estado anterior
-- do banco. Sempre idempotente: pode rodar quantas vezes for preciso.
--
-- Cobre, em particular, dois problemas reais identificados:
--
-- 1) Versões antigas deste projeto criavam "role" como ENUM ('user','admin')
--    em vez de VARCHAR(20). O código atual (Drizzle) trata "role" como
--    varchar simples — se o banco ainda tiver o enum, toda escrita feita
--    pelo ORM pode falhar. Aqui convertemos para varchar(20) NOT NULL
--    DEFAULT 'user' e removemos o tipo enum órfão, se não estiver mais em
--    uso por nenhuma outra coluna.
--
-- 2) Versões antigas criavam UNIQUE em "email". O schema atual NÃO declara
--    "email" como único. Isso é perigoso: o login faz
--    INSERT ... ON CONFLICT ("openId") DO UPDATE — ou seja, o Postgres só
--    ignora conflito em "openId". Se já existir qualquer linha antiga com o
--    mesmo e-mail mas openId diferente (de uma tentativa de deploy/config
--    anterior), o INSERT falha com "duplicate key value violates unique
--    constraint users_email_key", gerando exatamente o 500 visto no print
--    de erro do navegador. Removemos essa constraint para alinhar o banco
--    ao schema real.
-- ============================================================================

DO $$
DECLARE
  v_role_udt TEXT;
BEGIN
  -- Só atua se a tabela "users" já existir (em banco novo, a 0001 acima já
  -- cria tudo no formato correto e não há nada a reparar aqui).
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN

    -- ------------------------------------------------------------------
    -- 1) Corrigir o tipo da coluna "role" (enum legado -> varchar(20))
    -- ------------------------------------------------------------------
    SELECT udt_name INTO v_role_udt
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role';

    IF v_role_udt IS NOT NULL AND v_role_udt <> 'varchar' THEN
      RAISE NOTICE 'Convertendo users.role de % para varchar(20)...', v_role_udt;
      ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
      ALTER TABLE "users" ALTER COLUMN "role" TYPE VARCHAR(20) USING "role"::text;
      ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user';
    END IF;

    -- Garante NOT NULL + DEFAULT corretos independentemente do tipo anterior
    UPDATE "users" SET "role" = 'user' WHERE "role" IS NULL;
    ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user';
    ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;

    -- Remove o tipo enum legado "role", se existir e não estiver mais em uso
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
      BEGIN
        DROP TYPE "role";
        RAISE NOTICE 'Tipo enum legado "role" removido (não estava mais em uso).';
      EXCEPTION WHEN dependent_objects_still_exist OR OTHERS THEN
        RAISE NOTICE 'Tipo enum legado "role" mantido (ainda em uso em outro lugar) — sem problema.';
      END;
    END IF;

    -- ------------------------------------------------------------------
    -- 2) Remover UNIQUE constraint legada em "email" (schema atual não a
    --    declara única, e ela pode causar falha silenciosa no upsert de
    --    login feito via ON CONFLICT ("openId")).
    -- ------------------------------------------------------------------
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'users'
        AND constraint_type = 'UNIQUE' AND constraint_name = 'users_email_key'
    ) THEN
      ALTER TABLE "users" DROP CONSTRAINT "users_email_key";
      RAISE NOTICE 'Constraint legada users_email_key (UNIQUE em email) removida.';
    END IF;

    -- ------------------------------------------------------------------
    -- 3) Garantir que todas as colunas esperadas existam (caso a tabela
    --    tenha sido criada manualmente, fora de qualquer migration, com um
    --    subconjunto de colunas).
    -- ------------------------------------------------------------------
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" TEXT;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" VARCHAR(320);
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "loginMethod" VARCHAR(64);
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastSignedIn" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

    -- ------------------------------------------------------------------
    -- 4) Garantir UNIQUE em "openId" (alvo do ON CONFLICT do login). Se já
    --    existir qualquer índice/constraint único cobrindo a coluna, não
    --    faz nada; só cria se realmente faltar.
    -- ------------------------------------------------------------------
    IF NOT EXISTS (
      SELECT 1
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = '"users"'::regclass AND i.indisunique AND a.attname = 'openId'
    ) THEN
      ALTER TABLE "users" ADD CONSTRAINT "users_openid_unique" UNIQUE ("openId");
      RAISE NOTICE 'UNIQUE constraint em users.openId criada (estava faltando).';
    END IF;

  END IF;
END $$;

-- ============================================================================
-- Verificação final (aparece nos logs de deploy para conferência rápida)
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    SELECT COUNT(*) INTO v_count FROM "users";
    RAISE NOTICE '[0003] Tabela users OK. Linhas existentes: %', v_count;
  END IF;
END $$;
