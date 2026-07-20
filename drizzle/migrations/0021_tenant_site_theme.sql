-- Migration 0021: Personalização do site público de cada canaril (tenant)
--
-- 100% aditiva: só adiciona colunas novas, nulas/com default, à tabela
-- `tenants` já existente. Não apaga, não renomeia e não altera nenhuma
-- coluna ou linha existente — nenhum dado de pássaros, casais, anilhas ou
-- qualquer outro cadastro é tocado por esta migration.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "themePrimaryColor" varchar(20) DEFAULT '#D97706';
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "themeSecondaryColor" varchar(20) DEFAULT '#78350F';
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "themeBackgroundImageUrl" text;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "themeTagline" varchar(200);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "themeBio" text;
