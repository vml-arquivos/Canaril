-- Padroniza a capacidade do código completo da anilha.
-- Alteração somente de ampliação: não trunca nem reescreve valores existentes.

ALTER TABLE IF EXISTS rings
  ALTER COLUMN number TYPE VARCHAR(100);

ALTER TABLE IF EXISTS birds
  ALTER COLUMN ring TYPE VARCHAR(100);

ALTER TABLE IF EXISTS chicks
  ALTER COLUMN ring TYPE VARCHAR(100);
