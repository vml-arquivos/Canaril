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
   * sistema sugere especialidade e cor automaticamente, pra não precisar
   * digitar/escolher tudo na mão. É IMPORTANTE deixar claro: a IA escolhe
   * entre as opções REALMENTE cadastradas no sistema (enum fechado no
   * schema), nunca inventa uma raça/cor que não exista no catálogo — e
   * sempre retorna uma confiança, pra interface poder avisar quando a
   * sugestão for incerta e pedir conferência manual do criador.
   */
  identifyFromPhoto: protectedProcedure
    .input(z.object({ dataUrl: z.string() }))
    .mutation(async ({ input }) => {
      const specialtyIds = SPECIALTIES.map((s) => s.id);
      const colorIds = COLORS.map((c) => c.id);

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
        // Modelo escolhido automaticamente por server/_core/llm.ts conforme
        // o provedor ativo (Gemini ou Anthropic).
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
        const text = typeof raw === "string" ? raw : raw?.find((c) => c.type === "text")?.text;
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
        throw new Error(
          error instanceof Error && error.message.includes("ANTHROPIC_API_KEY")
            ? "Identificação automática não está disponível: configure a ANTHROPIC_API_KEY nas variáveis de ambiente."
            : "Não foi possível identificar a foto automaticamente. Preencha manualmente."
        );
      }
    }),
});
