/**
 * aiAssistant.ts — Router do Assistente IA Central
 *
 * Integra:
 * - Contexto rico do criadouro (aiContextBuilder)
 * - LLM (Gemini primário / Anthropic fallback via llm.ts)
 * - Base de conhecimento interna (canarilIntelligence)
 * - Histórico de conversas (ai_conversations)
 *
 * Endpoints:
 *   chat          — envia mensagem, recebe resposta da IA
 *   getHistory    — últimas N mensagens da sessão
 *   clearHistory  — limpa histórico da sessão
 *   getStatus     — provedor ativo, stats do criadouro
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getCurrentTenantId } from "../_core/tenant";
import { getDb } from "../db";
import { ai_conversations, birds } from "../../drizzle/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { invokeLLM, getActiveProvider, type Message } from "../_core/llm";
import { buildCriadouroContext } from "../_core/aiContextBuilder";

const MAX_HISTORY_MESSAGES = 20; // mensagens mantidas no contexto da conversa
const MAX_RESPONSE_TOKENS = 1024;

/**
 * O Assistente IA sempre atua sobre o contexto de UM criadouro específico —
 * não faz sentido um "global". Antes, todo lugar deste arquivo usava
 * `ctx.user.tenantId ?? 0`: se o usuário não tivesse tenant, caía
 * silenciosamente no tenant fantasma "0", misturando/perdendo dados em vez
 * de recusar o acesso. Agora falha de forma explícita.
 */
function requireOwnTenantId(ctx: any): number {
  const tenantId = getCurrentTenantId(ctx);
  if (tenantId === null) {
    throw new Error("Seu usuário não está vinculado a um criadouro. Fale com o administrador da plataforma.");
  }
  return tenantId;
}

export const aiAssistantRouter = router({

  // ── Status do assistente ──────────────────────────────────────────────────
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const provider = getActiveProvider();
    const criadouroCtx = await buildCriadouroContext(requireOwnTenantId(ctx));
    return {
      aiAvailable: provider !== null,
      provider: provider ?? "none",
      stats: criadouroCtx.stats,
      generatedAt: criadouroCtx.generatedAt,
    };
  }),

  // ── Enviar mensagem e receber resposta ───────────────────────────────────
  chat: protectedProcedure
    .input(z.object({
      message: z.string().min(1).max(2000),
      sessionId: z.string().min(1).max(64),
      birdId: z.number().int().positive().optional(), // contexto específico de um pássaro
      photoUrl: z.string().optional(),               // foto anexada
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível.");

      const provider = getActiveProvider();
      if (!provider) {
        throw new Error(
          "Nenhuma chave de IA configurada. Configure GEMINI_API_KEY ou ANTHROPIC_API_KEY nas variáveis de ambiente do servidor."
        );
      }

      const tenantId = requireOwnTenantId(ctx);
      const userId = ctx.user.id;

      if (input.birdId !== undefined) {
        const [bird] = await db
          .select({ id: birds.id })
          .from(birds)
          .where(and(
            eq(birds.id, input.birdId),
            eq(birds.tenantId, tenantId),
            isNull(birds.deletedAt),
          ))
          .limit(1);
        if (!bird) {
          throw new Error("Pássaro não encontrado neste criadouro.");
        }
      }

      // 1. Contexto do criadouro
      const criadouroCtx = await buildCriadouroContext(tenantId);

      // 2. Histórico recente da sessão (para manter continuidade)
      const history = await db
        .select({ role: ai_conversations.role, content: ai_conversations.content })
        .from(ai_conversations)
        .where(
          and(
            eq(ai_conversations.tenantId, tenantId),
            eq(ai_conversations.userId, userId),
            eq(ai_conversations.sessionId, input.sessionId)
          )
        )
        .orderBy(desc(ai_conversations.createdAt))
        .limit(MAX_HISTORY_MESSAGES);

      // Reverter para ordem cronológica
      history.reverse();

      // 3. Montar mensagens para o LLM
      const messages: Message[] = [
        {
          role: "system",
          content: criadouroCtx.summary,
        },
        // Histórico anterior
        ...history
          .filter((h) => h.role === "user" || h.role === "assistant")
          .map((h) => ({
            role: h.role as "user" | "assistant",
            content: h.content,
          })),
        // Mensagem atual (com foto opcional)
        {
          role: "user",
          content: input.photoUrl
            ? [
                { type: "text" as const, text: input.message },
                { type: "image_url" as const, image_url: { url: input.photoUrl } },
              ]
            : input.message,
        },
      ];

      // 4. Chamar a IA
      const startTime = Date.now();
      const result = await invokeLLM({
        messages,
        maxTokens: MAX_RESPONSE_TOKENS,
      });

      const responseText = result.choices[0]?.message?.content;
      if (typeof responseText !== "string" || !responseText.trim()) {
        throw new Error("A IA retornou uma resposta vazia. Tente novamente.");
      }

      const latencyMs = Date.now() - startTime;
      const tokensUsed = result.usage?.total_tokens ?? null;

      // 5. Salvar no histórico (user + assistant)
      await db.insert(ai_conversations).values([
        {
          tenantId,
          userId,
          sessionId: input.sessionId,
          role: "user",
          content: input.message,
          provider,
          createdAt: new Date(),
        },
        {
          tenantId,
          userId,
          sessionId: input.sessionId,
          role: "assistant",
          content: responseText,
          tokensUsed,
          provider,
          createdAt: new Date(),
        },
      ]);

      return {
        response: responseText,
        provider,
        latencyMs,
        tokensUsed,
      };
    }),

  // ── Buscar histórico da sessão ────────────────────────────────────────────
  getHistory: protectedProcedure
    .input(z.object({
      sessionId: z.string().min(1).max(64),
      limit: z.number().int().min(1).max(100).default(50),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const tenantId = requireOwnTenantId(ctx);
      const userId = ctx.user.id;

      const rows = await db
        .select({
          id: ai_conversations.id,
          role: ai_conversations.role,
          content: ai_conversations.content,
          provider: ai_conversations.provider,
          tokensUsed: ai_conversations.tokensUsed,
          createdAt: ai_conversations.createdAt,
        })
        .from(ai_conversations)
        .where(
          and(
            eq(ai_conversations.tenantId, tenantId),
            eq(ai_conversations.userId, userId),
            eq(ai_conversations.sessionId, input.sessionId)
          )
        )
        .orderBy(desc(ai_conversations.createdAt))
        .limit(input.limit);

      return rows.reverse();
    }),

  // ── Limpar histórico ──────────────────────────────────────────────────────
  clearHistory: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1).max(64) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { cleared: 0 };

      const tenantId = requireOwnTenantId(ctx);
      const userId = ctx.user.id;

      const deleted = await db
        .delete(ai_conversations)
        .where(
          and(
            eq(ai_conversations.tenantId, tenantId),
            eq(ai_conversations.userId, userId),
            eq(ai_conversations.sessionId, input.sessionId)
          )
        )
        .returning({ id: ai_conversations.id });

      return { cleared: deleted.length };
    }),

  // ── Todas as sessões do tenant (para listagem) ────────────────────────────
  getSessions: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const tenantId = requireOwnTenantId(ctx);
      const userId = ctx.user.id;

      // Última mensagem de cada sessão
      const rows = await db
        .select({
          sessionId: ai_conversations.sessionId,
          lastMessage: ai_conversations.content,
          createdAt: ai_conversations.createdAt,
        })
        .from(ai_conversations)
        .where(and(eq(ai_conversations.tenantId, tenantId), eq(ai_conversations.userId, userId)))
        .orderBy(desc(ai_conversations.createdAt))
        .limit(200);

      // Agrupa por sessionId (apenas a mais recente de cada)
      const seen = new Set<string>();
      const sessions: typeof rows = [];
      for (const r of rows) {
        if (!seen.has(r.sessionId)) {
          seen.add(r.sessionId);
          sessions.push(r);
        }
      }
      return sessions.slice(0, 20);
    }),
});
