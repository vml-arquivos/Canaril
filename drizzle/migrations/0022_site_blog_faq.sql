-- Migration 0022: Blog e Perguntas/Respostas do site público de cada canaril
--
-- 100% aditiva: cria só tabelas novas. Não altera nenhuma tabela existente,
-- não apaga nada. Zero risco para pássaros, casais, anilhas ou qualquer
-- outro cadastro já existente.
CREATE TABLE IF NOT EXISTS "site_posts" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL,
  "title" varchar(200) NOT NULL,
  "slug" varchar(200) NOT NULL,
  "coverImageUrl" text,
  "excerpt" varchar(300),
  "content" text NOT NULL,
  "published" boolean NOT NULL DEFAULT true,
  "displayOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "site_posts_tenant_slug_idx" ON "site_posts" ("tenantId", "slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_posts_tenant_idx" ON "site_posts" ("tenantId");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "site_faqs" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL,
  "question" varchar(300) NOT NULL,
  "answer" text NOT NULL,
  "published" boolean NOT NULL DEFAULT true,
  "displayOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_faqs_tenant_idx" ON "site_faqs" ("tenantId");
