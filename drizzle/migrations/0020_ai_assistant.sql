-- Migration 0020: Assistente IA — histórico de conversas por usuário/tenant
CREATE TABLE IF NOT EXISTS "ai_conversations" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL,
  "userId" integer NOT NULL,
  "sessionId" varchar(64) NOT NULL,
  "role" varchar(16) NOT NULL,
  "content" text NOT NULL,
  "context" jsonb,
  "tokensUsed" integer,
  "provider" varchar(20),
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_conv_tenant_idx" ON "ai_conversations" ("tenantId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_conv_session_idx" ON "ai_conversations" ("sessionId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_conv_user_idx" ON "ai_conversations" ("userId");
