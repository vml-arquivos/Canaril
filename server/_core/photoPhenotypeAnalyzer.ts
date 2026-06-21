/**
 * photoPhenotypeAnalyzer.ts
 *
 * Serviço de análise fenotípica por foto usando IA (Gemini/LLM).
 *
 * REGRAS DE HONESTIDADE GENÉTICA:
 * - A análise é uma AJUDA VISUAL — não confirma genes ocultos.
 * - Tudo que a IA retorna vem com nível de confiança.
 * - Genes portados (não visíveis) são sempre DESCONHECIDO.
 * - O usuário DEVE confirmar antes de salvar no perfil genético.
 * - Texto obrigatório exibido ao usuário:
 *   "Esta análise é uma ajuda visual baseada em fotos. Ela não comprova
 *    genes ocultos. Para aumentar a precisão genética, informe pais,
 *    avós e resultados de ninhadas."
 */

import { invokeLLM } from "./llm";
import { z } from "zod";

// ============================================================================
// Schema de resposta da IA (validado via Zod)
// ============================================================================
export const PhotoAnalysisResponseSchema = z.object({
  lipochromeBase: z.enum([
    "amarelo", "amarelo_marfim", "vermelho", "vermelho_marfim",
    "laranja_intermediario", "branco_dominante", "branco_recessivo", "desconhecido",
  ]).describe("Lipocromo base visível na foto"),

  melaninSeries: z.enum([
    "negro", "agata", "canela", "isabel", "sem_melanina", "desconhecido",
  ]).describe("Série de melanina visível"),

  featherCategory: z.enum([
    "intenso", "nevado", "mosaico_macho", "mosaico_femea", "desconhecido",
  ]).describe("Categoria de pena visível"),

  crestType: z.enum([
    "sem_topete", "com_topete", "corona", "consort", "crista_plana", "desconhecido",
  ]).describe("Tipo de crista/topete"),

  visibleMutations: z.array(z.string()).describe("Mutações visíveis na foto"),

  possibleOfficialClasses: z.array(
    z.object({
      code: z.string().optional(),
      name: z.string(),
      confidence: z.number().min(0).max(1),
      reason: z.string(),
    })
  ).describe("Classes oficiais FOB/OBJO mais prováveis"),

  confidenceOverall: z.number().min(0).max(1).describe("Confiança geral da análise (0-1)"),

  visualDescription: z.string().describe("Descrição visual da ave em português"),

  warnings: z.array(z.string()).describe("Avisos técnicos sobre a análise"),

  recommendations: z.array(z.string()).describe("Recomendações para melhorar a precisão"),

  fieldsNotConfirmed: z.array(z.string()).describe("Campos que a foto NÃO confirma"),
});

export type PhotoAnalysisResponse = z.infer<typeof PhotoAnalysisResponseSchema>;

// ============================================================================
// Prompt do sistema
// ============================================================================
const SYSTEM_PROMPT = `Você é um especialista em genética de canários com conhecimento profundo da nomenclatura oficial FOB/OBJO.

Sua tarefa é analisar fotos de canários e identificar características fenotípicas visíveis.

REGRAS OBRIGATÓRIAS:
1. Analise APENAS o que é visível na foto — nunca invente genes ocultos.
2. Genes portados (ex: portador de branco recessivo, portador de marfim) são SEMPRE "desconhecido" — não é possível ver pela foto.
3. Retorne confiança honesta — se a foto for ruim, diga que a confiança é baixa.
4. Sugira classes oficiais FOB/OBJO reais (ex: "CC0601 — Ágata Amarelo Intenso").
5. Liste campos que a foto NÃO confirma (ex: "Portador de branco recessivo", "Gene marfim em macho").
6. Retorne SEMPRE em JSON válido seguindo o schema fornecido.
7. Use português do Brasil em todas as descrições.

NOMENCLATURA FOB/OBJO:
- Canário de Cor: códigos CC0101 a CC2004
- Canário de Porte: códigos CP0101 a CP1404
- Categorias: intenso, nevado, mosaico
- Melaninas: negro, ágata, canela, isabelino, sem melanina (lipocrômico)
- Lipocromo: amarelo, vermelho, branco dominante, branco recessivo, marfim

HONESTIDADE TÉCNICA:
- Ino (lutino/albino/rubino): visível pela ausência de melanina e olhos vermelhos
- Branco dominante: visível por traços de cor nas bordas das penas
- Branco recessivo: visível apenas em homozigose — portadores são invisíveis
- Marfim: dilui amarelo para marfim — em machos pode ser portador (invisível)
- Topete: visível claramente na foto`;

// ============================================================================
// Função principal de análise
// ============================================================================
export interface PhotoAnalysisInput {
  photoUrls: string[];       // URLs públicas das fotos (máx 6)
  birdSex?: "macho" | "fêmea" | "indeterminado";
  additionalContext?: string; // Informações extras do criador
}

export interface PhotoAnalysisResult {
  analysis: PhotoAnalysisResponse;
  rawResponse: string;
  photosAnalyzed: number;
  disclaimer: string;
  processingTimeMs: number;
}

export async function analyzePhotoPhenotype(
  input: PhotoAnalysisInput
): Promise<PhotoAnalysisResult> {
  const startTime = Date.now();

  // Limita a 6 fotos por análise
  const photos = input.photoUrls.slice(0, 6);

  if (photos.length === 0) {
    throw new Error("Nenhuma foto fornecida para análise.");
  }

  // Monta o conteúdo da mensagem com as fotos
  const userContent: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [
    {
      type: "text",
      text: `Analise ${photos.length === 1 ? "esta foto" : `estas ${photos.length} fotos`} de canário e retorne o JSON com as características fenotípicas visíveis.${
        input.birdSex ? `\n\nSexo informado pelo criador: ${input.birdSex}` : ""
      }${
        input.additionalContext ? `\n\nInformações adicionais: ${input.additionalContext}` : ""
      }

Retorne APENAS o JSON válido, sem texto adicional.`,
    },
    ...photos.map((url) => ({
      type: "image_url" as const,
      image_url: { url, detail: "high" as const },
    })),
  ];

  // IMPORTANTE: a integração real de IA deste sistema (server/_core/llm.ts)
  // chama a API da Anthropic diretamente — não existe integração com
  // Gemini neste repositório. Usa o mesmo modelo já usado em
  // server/routers/aiJudge.ts e genetics.ts, direto, sem depender de uma
  // variável de ambiente GEMINI_* que, se configurada, quebraria a
  // chamada (o valor seria passado como "model" pra API da Anthropic).
  const result = await invokeLLM({
    model: "claude-sonnet-4-6",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent as any },
    ],
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "photo_analysis",
        schema: {
          type: "object",
          properties: {
            lipochromeBase: { type: "string" },
            melaninSeries: { type: "string" },
            featherCategory: { type: "string" },
            crestType: { type: "string" },
            visibleMutations: { type: "array", items: { type: "string" } },
            possibleOfficialClasses: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  name: { type: "string" },
                  confidence: { type: "number" },
                  reason: { type: "string" },
                },
                required: ["name", "confidence", "reason"],
              },
            },
            confidenceOverall: { type: "number" },
            visualDescription: { type: "string" },
            warnings: { type: "array", items: { type: "string" } },
            recommendations: { type: "array", items: { type: "string" } },
            fieldsNotConfirmed: { type: "array", items: { type: "string" } },
          },
          required: [
            "lipochromeBase", "melaninSeries", "featherCategory", "crestType",
            "visibleMutations", "possibleOfficialClasses", "confidenceOverall",
            "visualDescription", "warnings", "recommendations", "fieldsNotConfirmed",
          ],
        },
        strict: false,
      },
    },
    maxTokens: 2000,
  });

  // Extrai o texto da resposta
  const rawContent = result.choices[0]?.message?.content;
  let rawResponse = "";
  if (typeof rawContent === "string") {
    rawResponse = rawContent;
  } else if (Array.isArray(rawContent)) {
    rawResponse = rawContent.find((c) => c.type === "text")?.text ?? "";
  }

  // Parse e validação do JSON
  let parsedJson: unknown;
  try {
    // Remove possíveis markdown code blocks
    const cleaned = rawResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsedJson = JSON.parse(cleaned);
  } catch {
    throw new Error(`IA retornou resposta inválida (não é JSON válido). Tente novamente.`);
  }

  // Valida com Zod
  const validation = PhotoAnalysisResponseSchema.safeParse(parsedJson);
  if (!validation.success) {
    // Tenta usar o JSON mesmo com campos inválidos (graceful degradation)
    const partial = parsedJson as Partial<PhotoAnalysisResponse>;
    const fallback: PhotoAnalysisResponse = {
      lipochromeBase: (partial.lipochromeBase as PhotoAnalysisResponse["lipochromeBase"]) ?? "desconhecido",
      melaninSeries: (partial.melaninSeries as PhotoAnalysisResponse["melaninSeries"]) ?? "desconhecido",
      featherCategory: (partial.featherCategory as PhotoAnalysisResponse["featherCategory"]) ?? "desconhecido",
      crestType: (partial.crestType as PhotoAnalysisResponse["crestType"]) ?? "desconhecido",
      visibleMutations: partial.visibleMutations ?? [],
      possibleOfficialClasses: partial.possibleOfficialClasses ?? [],
      confidenceOverall: typeof partial.confidenceOverall === "number" ? partial.confidenceOverall : 0.3,
      visualDescription: partial.visualDescription ?? "Análise incompleta.",
      warnings: [...(partial.warnings ?? []), "Resposta da IA incompleta — use com cautela."],
      recommendations: partial.recommendations ?? ["Forneça fotos de melhor qualidade."],
      fieldsNotConfirmed: partial.fieldsNotConfirmed ?? ["Todos os campos requerem confirmação manual."],
    };
    return {
      analysis: fallback,
      rawResponse,
      photosAnalyzed: photos.length,
      disclaimer: DISCLAIMER_TEXT,
      processingTimeMs: Date.now() - startTime,
    };
  }

  return {
    analysis: validation.data,
    rawResponse,
    photosAnalyzed: photos.length,
    disclaimer: DISCLAIMER_TEXT,
    processingTimeMs: Date.now() - startTime,
  };
}

// ============================================================================
// Texto obrigatório de disclaimer (exibir sempre ao usuário)
// ============================================================================
export const DISCLAIMER_TEXT =
  "Esta análise é uma ajuda visual baseada em fotos. Ela não comprova genes ocultos. " +
  "Para aumentar a precisão genética, informe pais, avós e resultados de ninhadas.";
