-- Migration 0019: Movimentação do plantel + controle de insumos/financeiro
-- Totalmente segura: ADD COLUMN IF NOT EXISTS + CREATE TABLE IF NOT EXISTS
-- Zero destrutiva. Backfill automático para tenant principal.

BEGIN;

-- ─── 1. Expandir status de birds para incluir saídas ─────────────────────────
-- Não há ENUM no Drizzle (usa VARCHAR), então só garantimos o comprimento
ALTER TABLE "birds" ALTER COLUMN "status" TYPE VARCHAR(20);

-- ─── 2. Campos de movimentação no próprio birds ───────────────────────────────
ALTER TABLE "birds" ADD COLUMN IF NOT EXISTS "exitDate"       TIMESTAMP;
ALTER TABLE "birds" ADD COLUMN IF NOT EXISTS "exitReason"     VARCHAR(20);  -- sold|dead|escaped|donated|transferred
ALTER TABLE "birds" ADD COLUMN IF NOT EXISTS "salePrice"      NUMERIC(10,2);
ALTER TABLE "birds" ADD COLUMN IF NOT EXISTS "buyerName"      VARCHAR(200);
ALTER TABLE "birds" ADD COLUMN IF NOT EXISTS "purchasePrice"  NUMERIC(10,2);
ALTER TABLE "birds" ADD COLUMN IF NOT EXISTS "supplierName"   VARCHAR(200);
ALTER TABLE "birds" ADD COLUMN IF NOT EXISTS "acquisitionDate" TIMESTAMP;
ALTER TABLE "birds" ADD COLUMN IF NOT EXISTS "acquisitionType" VARCHAR(20); -- bred|bought|donated|transferred

-- ─── 3. Tabela de movimentações (log completo de entradas/saídas) ─────────────
CREATE TABLE IF NOT EXISTS "bird_movements" (
  "id"           SERIAL PRIMARY KEY,
  "birdId"       INTEGER NOT NULL REFERENCES "birds"("id") ON DELETE CASCADE,
  "type"         VARCHAR(30) NOT NULL,
  -- ENTRADAS: bought | bred | donated_in | transferred_in
  -- SAÍDAS:   sold | died | escaped | donated_out | transferred_out | culled
  "date"         TIMESTAMP NOT NULL DEFAULT NOW(),
  "price"        NUMERIC(10,2),          -- valor da compra ou venda
  "counterpart"  VARCHAR(200),           -- comprador, vendedor, criadouro origem/destino
  "notes"        TEXT,
  "tenantId"     INTEGER,
  "createdAt"    TIMESTAMP NOT NULL DEFAULT NOW(),
  "createdBy"    INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_bird_movements_birdId"   ON "bird_movements"("birdId");
CREATE INDEX IF NOT EXISTS "idx_bird_movements_type"     ON "bird_movements"("type");
CREATE INDEX IF NOT EXISTS "idx_bird_movements_tenantId" ON "bird_movements"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_bird_movements_date"     ON "bird_movements"("date");

-- ─── 4. Tabela de insumos/suprimentos ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "supply_records" (
  "id"           SERIAL PRIMARY KEY,
  "category"     VARCHAR(30) NOT NULL,
  -- racao | semente | folhagem | fruta | suplemento | medicamento | material_ninho | equipamento | outro
  "name"         VARCHAR(200) NOT NULL,  -- ex: "Ração Versele-Laga", "Alface", "Vitamina E"
  "quantity"     NUMERIC(10,3) NOT NULL,
  "unit"         VARCHAR(10) NOT NULL,   -- kg | g | L | ml | un | sc(saco)
  "unitCost"     NUMERIC(10,2),          -- custo por unidade
  "totalCost"    NUMERIC(10,2),          -- total = quantity * unitCost (ou informado direto)
  "supplier"     VARCHAR(200),
  "date"         TIMESTAMP NOT NULL DEFAULT NOW(),
  "notes"        TEXT,
  "tenantId"     INTEGER,
  "createdAt"    TIMESTAMP NOT NULL DEFAULT NOW(),
  "createdBy"    INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_supply_records_category" ON "supply_records"("category");
CREATE INDEX IF NOT EXISTS "idx_supply_records_date"     ON "supply_records"("date");
CREATE INDEX IF NOT EXISTS "idx_supply_records_tenantId" ON "supply_records"("tenantId");

-- ─── 5. Backfill tenantId para dados antigos ─────────────────────────────────
DO $$
DECLARE v_tenant INTEGER;
BEGIN
  SELECT id INTO v_tenant FROM "tenants" WHERE "deletedAt" IS NULL ORDER BY id ASC LIMIT 1;
  IF v_tenant IS NOT NULL THEN
    UPDATE "bird_movements" SET "tenantId" = v_tenant WHERE "tenantId" IS NULL;
    UPDATE "supply_records"  SET "tenantId" = v_tenant WHERE "tenantId" IS NULL;
  END IF;
END $$;

COMMIT;
