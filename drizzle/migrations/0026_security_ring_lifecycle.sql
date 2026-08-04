-- 0026 — Hardening de segurança, ciclo real do filhote e integridade de anilhas
-- Migration aditiva e idempotente. Não apaga nem reescreve dados históricos.

ALTER TABLE IF EXISTS chicks
  ALTER COLUMN ring DROP NOT NULL,
  ALTER COLUMN sex DROP NOT NULL,
  ALTER COLUMN "color_code" DROP NOT NULL;

ALTER TABLE IF EXISTS chicks
  ADD COLUMN IF NOT EXISTS "hatchDateTime" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "birthDateSource" VARCHAR(24) NOT NULL DEFAULT 'recorded';

UPDATE chicks
   SET "hatchDateTime" = COALESCE("hatchDateTime", "birthDate"),
       "birthDateSource" = COALESCE(NULLIF("birthDateSource", ''), 'legacy')
 WHERE "hatchDateTime" IS NULL OR "birthDateSource" IS NULL OR "birthDateSource" = '';

-- Índices não exclusivos são sempre seguros e melhoram as consultas mesmo em
-- bancos legados que ainda tenham duplicidades a corrigir.
CREATE INDEX IF NOT EXISTS rings_full_code_lookup_idx
  ON rings ("fullCode") WHERE "fullCode" IS NOT NULL;
CREATE INDEX IF NOT EXISTS rings_bird_lookup_idx
  ON rings ("birdId") WHERE "birdId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS rings_chick_lookup_idx
  ON rings ("chickId") WHERE "chickId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS chicks_bird_lookup_idx
  ON chicks ("birdId") WHERE "birdId" IS NOT NULL;

-- Só cria as restrições exclusivas quando o banco histórico já está limpo.
-- Isso evita derrubar o deploy em instalações antigas; o backend transacional
-- impede novas duplicidades mesmo quando uma restrição ainda não pôde ser criada.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM rings WHERE "fullCode" IS NOT NULL
    GROUP BY "fullCode" HAVING COUNT(*) > 1 LIMIT 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS rings_full_code_unique_not_null
      ON rings ("fullCode") WHERE "fullCode" IS NOT NULL;
  ELSE
    RAISE NOTICE '0026: fullCode duplicado em rings; índice exclusivo não criado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM rings WHERE "birdId" IS NOT NULL
    GROUP BY "birdId" HAVING COUNT(*) > 1 LIMIT 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS rings_bird_unique_not_null
      ON rings ("birdId") WHERE "birdId" IS NOT NULL;
  ELSE
    RAISE NOTICE '0026: birdId duplicado em rings; índice exclusivo não criado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM rings WHERE "chickId" IS NOT NULL
    GROUP BY "chickId" HAVING COUNT(*) > 1 LIMIT 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS rings_chick_unique_not_null
      ON rings ("chickId") WHERE "chickId" IS NOT NULL;
  ELSE
    RAISE NOTICE '0026: chickId duplicado em rings; índice exclusivo não criado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM chicks WHERE "birdId" IS NOT NULL
    GROUP BY "birdId" HAVING COUNT(*) > 1 LIMIT 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS chicks_bird_unique_not_null
      ON chicks ("birdId") WHERE "birdId" IS NOT NULL;
  ELSE
    RAISE NOTICE '0026: birdId duplicado em chicks; índice exclusivo não criado.';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS chicks_pending_ringing_idx
  ON chicks ("tenantId", "clutchId", "birthDate")
  WHERE ring IS NULL AND "birdId" IS NULL AND "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS ai_conv_owner_session_idx
  ON ai_conversations ("tenantId", "userId", "sessionId", "createdAt" DESC);

-- Os contadores passam a refletir as linhas reais, preservando lotes arquivados.
UPDATE ring_batches rb
   SET quantity_used = (
         SELECT COUNT(*)::integer
           FROM rings r
          WHERE r."batchId" = rb.id
            AND r.status IN ('in_use', 'used')
       ),
       status = CASE
         WHEN rb.status = 'archived' THEN 'archived'
         WHEN EXISTS (
           SELECT 1 FROM rings r
            WHERE r."batchId" = rb.id AND r.status = 'available'
         ) THEN 'available'
         ELSE 'exhausted'
       END,
       "updatedAt" = NOW();
