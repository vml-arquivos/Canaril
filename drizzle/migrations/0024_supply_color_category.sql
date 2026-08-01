-- Migration 0024: Insumo aplicável a categoria de pigmento (com/sem fator vermelho)
--
-- Aditiva: só adiciona uma coluna nula à tabela supply_records já existente.
-- Nenhuma linha existente é alterada — insumos já cadastrados continuam
-- valendo pra todos os pássaros (comportamento "geral", igual já era).
ALTER TABLE "supply_records" ADD COLUMN IF NOT EXISTS "appliesToColorCategory" varchar(20);
