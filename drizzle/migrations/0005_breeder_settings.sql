-- ============================================================================
-- MIGRATION 0005: Configurações do Criadouro (breeder_settings)
-- ============================================================================
-- Registro único (id sempre 1) com nome, contato e identidade do criadouro.
-- Idempotente: cria a tabela se não existir e garante o registro id=1
-- (sem sobrescrever se já tiver sido configurado por uma migration anterior
-- ou pela própria tela de Configurações).
-- ============================================================================

CREATE TABLE IF NOT EXISTS "breeder_settings" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(150) NOT NULL DEFAULT 'Meu Criadouro',
  "city" VARCHAR(100),
  "state" VARCHAR(2),
  "address" VARCHAR(250),
  "phone" VARCHAR(30),
  "email" VARCHAR(150),
  "website" VARCHAR(200),
  "description" TEXT,
  "logoUrl" VARCHAR(500),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Garante que o registro id=1 sempre exista, com os valores que já estavam
-- fixos em shared/constants.ts (BREEDER_INFO) como ponto de partida — assim
-- a migração para o sistema configurável não perde os dados já usados na
-- Home e na Ficha de Gaiola.
INSERT INTO "breeder_settings" ("id", "name", "city", "state", "phone", "email", "website", "description")
VALUES (
  1,
  'Canário Lima',
  'Brasília',
  'DF',
  '(61) 9999-9999',
  'contato@canarioslima.com.br',
  'www.canarioslima.com.br',
  'Criadouro profissional especializado em Canários Belga com foco em qualidade genética e bem-estar animal.'
)
ON CONFLICT (id) DO NOTHING;
