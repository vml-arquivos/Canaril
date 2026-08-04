-- Migration 0025: Corrige anilhas já geradas sem tenantId
--
-- Bug raiz: generateRingsForBatch() nunca preenchia o tenantId de cada
-- anilha individual, só o do lote (ring_batches). Resultado: os contadores
-- que filtram por criadouro (dashboard de Anilhas, alocação automática no
-- anilhamento pela Rotina) sempre davam zero, mesmo com anilhas reais
-- cadastradas — exatamente o "Sem anilhas disponíveis" reportado com um
-- lote de 50 anilhas visível na tela.
--
-- Esta migration só PREENCHE dados que estavam faltando (nunca sobrescreve
-- um tenantId já correto) — aditiva e segura de rodar quantas vezes for.
UPDATE "rings" r
SET "tenantId" = rb."tenantId"
FROM "ring_batches" rb
WHERE r."batchId" = rb.id
  AND r."tenantId" IS NULL
  AND rb."tenantId" IS NOT NULL;
