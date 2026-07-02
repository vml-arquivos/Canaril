/**
 * photoPhenotypeAnalyzer.ts
 *
 * Serviço de análise fenotípica por foto.
 *
 * Agora suporta dois modos:
 * 1. LOCAL/INTERNO: sem API externa, usando traços visuais extraídos no navegador
 *    e regras técnicas alimentadas pelo catálogo oficial.
 * 2. EXTERNO: Gemini/Anthropic quando configurado, com fallback automático para LOCAL
 *    em caso de 403/429/billing/chave/modelo indisponível.
 *
 * REGRAS DE HONESTIDADE GENÉTICA:
 * - A análise é uma AJUDA VISUAL — não confirma genes ocultos.
 * - Tudo retorna com nível de confiança.
 * - Genes portados (não visíveis) são sempre DESCONHECIDO.
 * - O usuário DEVE confirmar antes de salvar no perfil genético.
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

export type LocalVisualTraits = {
  source?: "client_canvas" | "manual" | string;
  dominantColor?: "yellow" | "orange" | "red" | "white" | "dark" | "mixed" | "unknown" | string;
  yellowRatio?: number;
  orangeRatio?: number;
  redRatio?: number;
  whiteRatio?: number;
  darkRatio?: number;
  saturationAverage?: number;
  brightnessAverage?: number;
  sampleCount?: number;
};

// ============================================================================
// Prompt do sistema externo
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
// Interfaces
// ============================================================================
export interface PhotoAnalysisInput {
  photoUrls: string[];       // URLs públicas das fotos (máx 6)
  birdSex?: "macho" | "fêmea" | "indeterminado";
  additionalContext?: string; // Informações extras do criador
  /**
   * Traços locais extraídos no navegador via Canvas.
   * Permite análise interna sem Gemini/Anthropic e sem custo de API.
   */
  localVisualTraits?: LocalVisualTraits[];
}

export interface PhotoAnalysisResult {
  analysis: PhotoAnalysisResponse;
  rawResponse: string;
  modelUsed: string;
  photosAnalyzed: number;
  disclaimer: string;
  processingTimeMs: number;
}

function avg(values: Array<number | undefined>): number {
  const valid = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (valid.length === 0) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function normalizeContext(value?: string): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function inferFeatherCategory(context: string, sex?: PhotoAnalysisInput["birdSex"]): PhotoAnalysisResponse["featherCategory"] {
  if (context.includes("mosaico")) return sex === "fêmea" ? "mosaico_femea" : "mosaico_macho";
  if (context.includes("intenso")) return "intenso";
  if (context.includes("nevado")) return "nevado";
  return "desconhecido";
}

function inferCrestType(context: string): PhotoAnalysisResponse["crestType"] {
  if (context.includes("corona")) return "corona";
  if (context.includes("consort")) return "consort";
  if (context.includes("topete") || context.includes("crista")) return "com_topete";
  return "desconhecido";
}

function classNameFor(lipo: PhotoAnalysisResponse["lipochromeBase"], feather: PhotoAnalysisResponse["featherCategory"], melanin: PhotoAnalysisResponse["melaninSeries"]) {
  const melPrefix = melanin !== "sem_melanina" && melanin !== "desconhecido" ? `${melanin} ` : "";
  const category =
    feather === "intenso" ? "INTENSO" :
    feather === "nevado" ? "NEVADO" :
    feather === "mosaico_macho" || feather === "mosaico_femea" ? "MOSAICO" :
    "";

  if (lipo === "amarelo") return `${melPrefix}AMARELO ${category}`.trim();
  if (lipo === "vermelho") return `${melPrefix}VERMELHO ${category}`.trim();
  if (lipo === "laranja_intermediario") return `${melPrefix}AMARELO ${category}`.trim();
  if (lipo === "branco_dominante") return `${melPrefix}BRANCO DOMINANTE`.trim();
  if (lipo === "branco_recessivo") return `${melPrefix}BRANCO RECESSIVO`.trim();
  return `${melPrefix}CANÁRIO DE COR`.trim();
}

function isExternalBillingOrPermissionError(error: unknown): boolean {
  const message = String((error as any)?.message ?? error ?? "").toLowerCase();
  return (
    message.includes("429") ||
    message.includes("403") ||
    message.includes("permission_denied") ||
    message.includes("billing") ||
    message.includes("quota") ||
    message.includes("api key") ||
    message.includes("chave") ||
    message.includes("model") ||
    message.includes("modelo")
  );
}

function buildLocalAnalysis(input: PhotoAnalysisInput, startTime: number, fallbackReason?: string): PhotoAnalysisResult {
  const traits = input.localVisualTraits ?? [];
  const context = normalizeContext(input.additionalContext);

  const yellowRatio = avg(traits.map((t) => t.yellowRatio));
  const orangeRatio = avg(traits.map((t) => t.orangeRatio));
  const redRatio = avg(traits.map((t) => t.redRatio));
  const whiteRatio = avg(traits.map((t) => t.whiteRatio));
  const darkRatio = avg(traits.map((t) => t.darkRatio));
  const saturationAverage = avg(traits.map((t) => t.saturationAverage));

  let lipochromeBase: PhotoAnalysisResponse["lipochromeBase"] = "desconhecido";
  if (context.includes("branco dominante")) lipochromeBase = "branco_dominante";
  else if (context.includes("branco recessivo")) lipochromeBase = "branco_recessivo";
  else if (context.includes("vermelho")) lipochromeBase = "vermelho";
  else if (context.includes("amarelo")) lipochromeBase = "amarelo";
  else if (context.includes("marfim") && yellowRatio > 0.08) lipochromeBase = "amarelo_marfim";
  else if (whiteRatio > 0.48 && yellowRatio < 0.12 && redRatio < 0.12) lipochromeBase = "branco_dominante";
  else if (redRatio > 0.16) lipochromeBase = "vermelho";
  else if (orangeRatio > 0.18) lipochromeBase = "laranja_intermediario";
  else if (yellowRatio > 0.14) lipochromeBase = "amarelo";

  let melaninSeries: PhotoAnalysisResponse["melaninSeries"] = "desconhecido";
  if (context.includes("agata") || context.includes("agata")) melaninSeries = "agata";
  else if (context.includes("canela")) melaninSeries = "canela";
  else if (context.includes("isabel")) melaninSeries = "isabel";
  else if (darkRatio > 0.28 && saturationAverage < 0.55) melaninSeries = "negro";
  else if (lipochromeBase !== "desconhecido") melaninSeries = "sem_melanina";

  const featherCategory = inferFeatherCategory(context, input.birdSex);
  const crestType = inferCrestType(context);

  const possibleName = classNameFor(lipochromeBase, featherCategory, melaninSeries);
  const confidence =
    lipochromeBase === "desconhecido" ? 0.28 :
    traits.length === 0 ? 0.35 :
    featherCategory === "desconhecido" ? 0.48 :
    0.62;

  const warnings = [
    "Análise interna local: não usa Gemini, Anthropic nem qualquer API externa.",
    "A leitura local usa histograma de cor e contexto informado; confirme manualmente antes de aplicar.",
  ];
  if (fallbackReason) warnings.unshift(`Fallback interno acionado: ${fallbackReason}`);
  if (featherCategory === "desconhecido") warnings.push("Categoria de pena não foi confirmada pela foto; informe intenso, nevado ou mosaico para melhorar a sugestão.");

  const analysis: PhotoAnalysisResponse = {
    lipochromeBase,
    melaninSeries,
    featherCategory,
    crestType,
    visibleMutations: crestType !== "desconhecido" && crestType !== "sem_topete" ? [crestType] : [],
    possibleOfficialClasses: [
      {
        name: possibleName,
        confidence,
        reason: "Sugestão gerada por classificador interno local a partir de cor predominante, contexto informado e catálogo oficial.",
      },
    ],
    confidenceOverall: confidence,
    visualDescription:
      lipochromeBase === "desconhecido"
        ? "A análise local não conseguiu determinar com segurança o lipocromo visível. Informe cor/classe manualmente para aumentar a precisão."
        : `Análise local sugere lipocromo ${lipochromeBase.replace(/_/g, " ")}${melaninSeries !== "desconhecido" ? `, série ${melaninSeries}` : ""}.`,
    warnings,
    recommendations: [
      "Use foto lateral nítida, bem iluminada e com fundo neutro.",
      "Informe manualmente classe oficial, categoria de pena e sexo quando souber.",
      "Informe pais, avós e resultados de ninhadas para melhorar a precisão genética real.",
    ],
    fieldsNotConfirmed: [
      "Portador de branco recessivo",
      "Portador de marfim",
      "Genes recessivos ocultos",
      "Consanguinidade",
      "Qualidade genética para reprodução",
    ],
  };

  return {
    analysis,
    rawResponse: JSON.stringify({ source: "internal-local", traits, analysis }, null, 2),
    modelUsed: "internal-local-phenotype-rules-v1",
    photosAnalyzed: input.photoUrls.slice(0, 6).length,
    disclaimer: DISCLAIMER_TEXT,
    processingTimeMs: Date.now() - startTime,
  };
}

// ============================================================================
// Função principal de análise
// ============================================================================
export async function analyzePhotoPhenotype(
  input: PhotoAnalysisInput
): Promise<PhotoAnalysisResult> {
  const startTime = Date.now();

  const photos = input.photoUrls.slice(0, 6);

  if (photos.length === 0) {
    throw new Error("Nenhuma foto fornecida para análise.");
  }

  const photoMode = (process.env.PHOTO_ANALYSIS_MODE ?? "").trim().toLowerCase();
  const disableExternal = (process.env.DISABLE_EXTERNAL_PHOTO_AI ?? "").trim().toLowerCase() === "true";

  // Modo 100% interno: não chama API externa.
  if (photoMode === "local" || photoMode === "internal" || disableExternal) {
    return buildLocalAnalysis(input, startTime);
  }

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

  try {
    const result = await invokeLLM({
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

    const rawContent = result.choices[0]?.message?.content;
    let rawResponse = "";
    if (typeof rawContent === "string") {
      rawResponse = rawContent;
    } else if (Array.isArray(rawContent)) {
      rawResponse = rawContent.find((c) => c.type === "text")?.text ?? "";
    }

    let parsedJson: unknown;
    try {
      const cleaned = rawResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsedJson = JSON.parse(cleaned);
    } catch {
      throw new Error(`IA retornou resposta inválida (não é JSON válido). Tente novamente.`);
    }

    const validation = PhotoAnalysisResponseSchema.safeParse(parsedJson);
    if (!validation.success) {
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
        modelUsed: result.model,
        photosAnalyzed: photos.length,
        disclaimer: DISCLAIMER_TEXT,
        processingTimeMs: Date.now() - startTime,
      };
    }

    return {
      analysis: validation.data,
      rawResponse,
      modelUsed: result.model,
      photosAnalyzed: photos.length,
      disclaimer: DISCLAIMER_TEXT,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    // Falhas de cobrança, quota, permissão, chave ou modelo não devem quebrar o cadastro.
    if (isExternalBillingOrPermissionError(error)) {
      return buildLocalAnalysis(input, startTime, String((error as any)?.message ?? error));
    }

    // Mesmo erros não previstos podem cair para análise local se houver traços locais.
    if ((input.localVisualTraits?.length ?? 0) > 0) {
      return buildLocalAnalysis(input, startTime, String((error as any)?.message ?? error));
    }

    throw error;
  }
}

// ============================================================================
// Texto obrigatório de disclaimer
// ============================================================================
export const DISCLAIMER_TEXT =
  "Esta análise é uma ajuda visual baseada em fotos. Ela não comprova genes ocultos. " +
  "Para aumentar a precisão genética, informe pais, avós e resultados de ninhadas.";
