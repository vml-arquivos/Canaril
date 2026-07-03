import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { ai_judge_analyses, birds, specialties, CriteriaScore } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { eq, desc } from "drizzle-orm";
import { SPECIALTIES, COLORS } from "../../shared/constants";

/**
 * Juiz Virtual com IA (Visão Computacional)
 *
 * Importante: isso NÃO é um modelo de Computer Vision treinado do zero pra
 * julgamento ornitológico — não existe dataset público disso, e treinar um
 * seria um projeto de pesquisa à parte. O que entregamos aqui é uma análise
 * comparativa real e funcional usando um modelo de linguagem com visão
 * (invokeLLM, já configurado na stack), pedindo nota estruturada por
 * critério via response_format json_schema. É genuinamente útil como
 * "segunda opinião" e pré-triagem antes da pista — não substitui o juiz
 * humano, e o prompt deixa isso explícito pro próprio modelo.
 */

const JUDGE_CRITERIA = [
  { criterion: "Tipo e postura", maxScore: 20 },
  { criterion: "Plumagem", maxScore: 20 },
  { criterion: "Cor e padrão", maxScore: 20 },
  { criterion: "Tamanho e proporção", maxScore: 20 },
  { criterion: "Condição geral", maxScore: 20 },
] as const;

const analysisJsonSchema = {
  name: "canary_judging_analysis",
  strict: true,
  schema: {
    type: "object",
    properties: {
      criteria_scores: {
        type: "array",
        items: {
          type: "object",
          properties: {
            criterion: { type: "string" },
            score: { type: "number" },
            maxScore: { type: "number" },
            comment: { type: "string" },
          },
          required: ["criterion", "score", "maxScore", "comment"],
          additionalProperties: false,
        },
      },
      overallScore: { type: "number", description: "Soma das notas, 0 a 100" },
      confidence: { type: "number", description: "Confiança da análise, de 0 a 1" },
      summary: { type: "string", description: "Resumo qualitativo em português, 2-3 frases" },
    },
    required: ["criteria_scores", "overallScore", "confidence", "summary"],
    additionalProperties: false,
  },
} as const;

export const aiJudgeRouter = router({
  // Dispara uma análise para uma foto já enviada (photoUrl deve ser uma URL
  // acessível publicamente — ex: a retornada por storagePut, no formato
  // /manus-storage/{key} servido pela própria plataforma).
  analyze: protectedProcedure
    .input(
      z.object({
        birdId: z.number().optional(),
        photoUrl: z.string().url(),
        specialty_code: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");

      const [specialty] = await db
        .select()
        .from(specialties)
        .where(eq(specialties.code, input.specialty_code));

      if (!specialty) {
        throw new Error(`Especialidade "${input.specialty_code}" não encontrada`);
      }

      // Cria o registro como "pending" antes de chamar o modelo, para que
      // uma falha na chamada (rede, timeout) ainda deixe rastro no banco
      // em vez de simplesmente sumir.
      const [pending] = await db
        .insert(ai_judge_analyses)
        .values({
          birdId: input.birdId,
          photoUrl: input.photoUrl,
          specialty_code: input.specialty_code,
          model: "pending",
          status: "pending",
        })
        .returning();

      try {
        // Modelo escolhido automaticamente por server/_core/llm.ts conforme
        // o provedor ativo (Gemini ou Anthropic).
        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                `Você é um avaliador de apoio para julgamento de canários da raça "${specialty.name}" ` +
                `(${specialty.description ?? "sem descrição cadastrada"}). Analise a foto comparando com o ` +
                `padrão oficial da raça e atribua nota de 0 a 20 para cada critério a seguir: ` +
                JUDGE_CRITERIA.map(c => c.criterion).join(", ") +
                `. Seja crítico e específico nos comentários. Deixe claro que esta é uma pré-análise ` +
                `de apoio, não substitui o julgamento de um juiz humano credenciado.`,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Analise este pássaro para julgamento:" },
                { type: "image_url", image_url: { url: input.photoUrl, detail: "high" } },
              ],
            },
          ],
          response_format: { type: "json_schema", json_schema: analysisJsonSchema },
        });

        const raw = result.choices[0]?.message?.content;
        const text = typeof raw === "string" ? raw : raw?.find(c => c.type === "text")?.text;
        if (!text) throw new Error("Resposta vazia do modelo");

        const parsed = JSON.parse(text) as {
          criteria_scores: CriteriaScore[];
          overallScore: number;
          confidence: number;
          summary: string;
        };

        const [updated] = await db
          .update(ai_judge_analyses)
          .set({
            model: result.model,
            criteria_scores: parsed.criteria_scores,
            overallScore: parsed.overallScore,
            confidence: parsed.confidence,
            summary: parsed.summary,
            status: "completed",
            updatedAt: new Date(),
          })
          .where(eq(ai_judge_analyses.id, pending.id))
          .returning();

        return updated;
      } catch (error) {
        console.error("[AI Judge] Falha na análise:", error);
        await db
          .update(ai_judge_analyses)
          .set({
            status: "failed",
            errorMessage: error instanceof Error ? error.message : String(error),
            updatedAt: new Date(),
          })
          .where(eq(ai_judge_analyses.id, pending.id));
        throw new Error("Não foi possível concluir a análise do Juiz Virtual. Tente novamente.");
      }
    }),

  // Histórico de análises de um pássaro específico
  listByBird: protectedProcedure
    .input(z.number())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(ai_judge_analyses)
        .where(eq(ai_judge_analyses.birdId, input))
        .orderBy(desc(ai_judge_analyses.createdAt));
    }),

  /**
   * Identificação de Espécie/Cor por Foto
   *
   * Usado no cadastro de um pássaro novo: o criador tira uma foto e o
   * sistema sugere especialidade e cor automaticamente. Suporta dois modos:
   * - EXTERNO: Gemini/Anthropic quando configurado
   * - LOCAL: usa localVisualTraits extraídos no browser como fallback
   *   automático quando a API externa falha (429/403/billing/quota/chave)
   */
  identifyFromPhoto: protectedProcedure
    .input(z.object({
      dataUrl: z.string(),
      localVisualTraits: z.object({
        dominantColor: z.string().optional(),
        yellowRatio: z.number().optional(),
        orangeRatio: z.number().optional(),
        redRatio: z.number().optional(),
        whiteRatio: z.number().optional(),
        darkRatio: z.number().optional(),
        saturationAverage: z.number().optional(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      const specialtyIds = SPECIALTIES.map((s) => s.id);
      const colorIds = COLORS.map((c) => c.id);

      // ── Fallback local ────────────────────────────────────────────────────
      // Se PHOTO_ANALYSIS_MODE=local ou DISABLE_EXTERNAL_PHOTO_AI=true,
      // usa os traits locais diretamente sem chamar nenhuma API externa.
      const photoMode = (process.env.PHOTO_ANALYSIS_MODE ?? "").trim().toLowerCase();
      const disableExternal = (process.env.DISABLE_EXTERNAL_PHOTO_AI ?? "").trim().toLowerCase() === "true";
      const forceLocal = photoMode === "local" || photoMode === "internal" || disableExternal;

      function buildLocalIdentification(traits: typeof input.localVisualTraits, reason?: string) {
        const t = traits ?? {};
        const yellow      = (t as any).yellowRatio    ?? 0;
        const orangeRed   = (t as any).orangeRedRatio ?? (t as any).orangeRatio ?? 0;
        const red         = (t as any).redRatio        ?? 0;
        const white       = (t as any).whiteRatio      ?? 0;
        const dominant    = (t as any).dominantColor   ?? "unknown";
        const mosaicIdx   = (t as any).mosaicIndex     ?? 0; // > 0.08 = mosaico provável
        const melaninIdx  = (t as any).melaninIndex    ?? (t as any).darkRatio ?? 0;

        // "Vermelho de canário" é orangeRed (H 10–42) no espaço HSV —
        // NÃO é vermelho puro. Tratamos orange_red como vermelho.
        const effectiveRed = orangeRed + red;

        // ── Inferir cor (COLORS IDs: vermelho_intenso, vermelho_nevado, etc.) ─
        let color_code = colorIds.find((id) => id.includes("amarelo_intenso")) ?? colorIds[0] ?? "amarelo_intenso";
        let colorReason = "Cor não identificada com certeza pela análise local.";
        let confidence = 0.20;

        if (dominant === "white" || white > 0.48) {
          const code = colorIds.find((id) => id === "branco" || id.includes("branco"));
          if (code) { color_code = code; colorReason = "Predominância de branco detectada."; confidence = 0.50; }
        } else if (dominant === "orange_red" || effectiveRed > 0.28) {
          // Canário vermelho: mosaico tem distribuição diferente de intenso/nevado
          let redSubtype: string;
          if (mosaicIdx > 0.08) {
            redSubtype = "vermelho_mosaico";
            colorReason = "Tom vermelho com padrão de saturação assimétrico (centro mais claro) — provável MOSAICO.";
          } else if (effectiveRed > 0.45) {
            redSubtype = "vermelho_intenso";
            colorReason = "Tom vermelho intenso e uniforme detectado.";
          } else {
            redSubtype = "vermelho_nevado";
            colorReason = "Tom vermelho com saturação moderada — provável NEVADO.";
          }
          const code = colorIds.find((id) => id === redSubtype) ?? colorIds.find((id) => id.includes("vermelho"));
          if (code) { color_code = code; confidence = effectiveRed > 0.4 ? 0.60 : 0.45; }
        } else if (dominant === "yellow" || yellow > 0.28) {
          let yellowSubtype: string;
          if (mosaicIdx > 0.08) {
            yellowSubtype = "amarelo_mosaico";
            colorReason = "Tom amarelo com padrão de saturação assimétrico — provável MOSAICO.";
          } else if (yellow > 0.42) {
            yellowSubtype = "amarelo_intenso";
            colorReason = "Tom amarelo intenso e saturado detectado.";
          } else {
            yellowSubtype = "amarelo_nevado";
            colorReason = "Tom amarelo com saturação moderada — provável NEVADO.";
          }
          const code = colorIds.find((id) => id === yellowSubtype) ?? colorIds.find((id) => id.includes("amarelo"));
          if (code) { color_code = code; confidence = yellow > 0.38 ? 0.58 : 0.42; }
        }

        // ── Inferir especialidade ───────────────────────────────────────────
        // Sem dados morfológicos, só sabemos que é canário de cor.
        // Gloster, Yorkshire etc. precisam de análise de forma/topete.
        // specialtyIds vem de SPECIALTIES (shared/constants) que usa IDs como
        // "gloster_corona", "fife" etc — não tem "canario_cor" nessa lista.
        // Para fins de identificação local, usamos o primeiro ID disponível
        // que pareça um canário de cor, ou o primeiro da lista como fallback.
        const specialty_code = (specialtyIds as readonly string[]).find((id) => id.includes("fife") || id.includes("border") || id.includes("gloster_consort"))
          ?? specialtyIds[0]
          ?? "gloster_consort";

        const fallbackMsg = reason ? ` (motivo: ${reason.slice(0, 120)})` : "";
        const mosaicNote = mosaicIdx > 0.08
          ? " Padrão de saturação sugere pena MOSAICO (cor concentrada nas extremidades)."
          : "";
        const melaninNote = melaninIdx > 0.30
          ? " Presença de melanina detectada (pixel escuro > 30%)."
          : "";

        return {
          specialty_code,
          color_code,
          sex_guess: "indeterminado" as const,
          confidence,
          reasoning: `Análise local sem API externa${fallbackMsg}. ${colorReason}${mosaicNote}${melaninNote} Confirme manualmente os campos antes de salvar.`,
        };
      }

      if (forceLocal) {
        return buildLocalIdentification(input.localVisualTraits);
      }

      // ── Tentativa com API externa ─────────────────────────────────────────
      const schema = {
        name: "bird_identification",
        strict: true,
        schema: {
          type: "object",
          properties: {
            specialty_code: { type: "string", enum: specialtyIds, description: "Especialidade/raça mais provável" },
            color_code: { type: "string", enum: colorIds, description: "Cor/mutação mais provável" },
            sex_guess: { type: "string", enum: ["macho", "fêmea", "indeterminado"], description: "Palpite de sexo, se houver pista visual (raramente confiável só pela foto)" },
            confidence: { type: "number", description: "Confiança geral da identificação, de 0 a 1" },
            reasoning: { type: "string", description: "Explicação breve em português do que levou a essa identificação" },
          },
          required: ["specialty_code", "color_code", "sex_guess", "confidence", "reasoning"],
          additionalProperties: false,
        },
      } as const;

      try {
        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                `Você identifica a especialidade (raça) e a cor/mutação de canários a partir de fotos, para um sistema de gestão de criadouro. ` +
                `Escolha SEMPRE uma das opções da lista fechada fornecida no schema — nunca crie uma categoria nova. ` +
                `Se a foto não permitir identificação confiável (ângulo ruim, muito longe, desfocada), ainda assim escolha a opção mais provável, mas reflita a incerteza no campo confidence (valores baixos, perto de 0, quando não tiver certeza). ` +
                `Seja honesto sobre os limites: identificação de mutações de cor por foto tem margem de erro real, principalmente entre tons próximos.`,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Identifique a especialidade e a cor deste canário:" },
                { type: "image_url", image_url: { url: input.dataUrl, detail: "high" } },
              ],
            },
          ],
          response_format: { type: "json_schema", json_schema: schema },
        });

        const raw = result.choices[0]?.message?.content;
        const text = typeof raw === "string" ? raw : (raw as any)?.find?.((c: any) => c.type === "text")?.text;
        if (!text) throw new Error("Resposta vazia do modelo");

        return JSON.parse(text) as {
          specialty_code: string;
          color_code: string;
          sex_guess: string;
          confidence: number;
          reasoning: string;
        };
      } catch (error) {
        console.error("[AI Identify] Falha na identificação:", error);
        const message = error instanceof Error ? error.message : String(error);

        // 429, 403, billing, quota, chave inválida, modelo inválido
        const isBillingOrPermission =
          message.includes("429") || message.includes("403") ||
          message.includes("RESOURCE_EXHAUSTED") || message.includes("PERMISSION_DENIED") ||
          message.includes("billing") || message.includes("quota") ||
          message.includes("api key") || message.includes("chave") ||
          message.includes("model") || message.includes("modelo");

        if (isBillingOrPermission || (input.localVisualTraits != null)) {
          // Fallback silencioso — não quebra o cadastro
          return buildLocalIdentification(input.localVisualTraits, message);
        }

        if (message.includes("Nenhuma chave de IA configurada")) {
          throw new Error("Identificação automática não está disponível: configure GEMINI_API_KEY ou ANTHROPIC_API_KEY nas variáveis de ambiente.");
        }
        throw new Error(`Falha ao identificar a foto: ${message.slice(0, 300)}`);
      }
    }),
});
