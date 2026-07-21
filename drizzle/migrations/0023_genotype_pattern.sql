-- Migration 0023: Padrão de plumagem (comum/mosaico) no genótipo do pássaro
--
-- Aditiva: só adiciona uma coluna nula à tabela bird_genotype já existente.
-- Nenhuma linha existente é alterada; pássaros sem esse dado preenchido
-- simplesmente não disparam o novo alerta de mosaico até o criador informar.
ALTER TABLE "bird_genotype" ADD COLUMN IF NOT EXISTS "pattern" varchar(20);
