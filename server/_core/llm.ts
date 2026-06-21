// Integração com IA — suporta Gemini e Anthropic, escolhidos automaticamente
// pela variável de ambiente configurada.
// ============================================================================
// Se GEMINI_API_KEY estiver definida, o sistema usa o Gemini
// (https://aistudio.google.com/apikey) para todos os recursos de IA. Senão,
// usa ANTHROPIC_API_KEY (https://console.anthropic.com) como antes. As duas
// podem coexistir nas variáveis de ambiente — o Gemini tem prioridade.
//
// A assinatura pública (invokeLLM, listLLMModels, tipos Message/
// ImageContent/etc.) é a MESMA independente do provedor escolhido — quem
// chama (aiJudge.ts, genetics.ts, mendelian.ts, photoPhenotypeAnalyzer.ts)
// não precisa saber nem mudar nada.
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

export type InvokeParams = {
  messages: Message[];
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  model?: string;
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_MAX_TOKENS = 4096;

export type Provider = "gemini" | "anthropic";

/** Qual provedor está ativo, com base nas variáveis de ambiente configuradas. */
export function getActiveProvider(): Provider | null {
  if (ENV.geminiApiKey) return "gemini";
  if (ENV.anthropicApiKey) return "anthropic";
  return null;
}

function assertProvider(): Provider {
  const provider = getActiveProvider();
  if (!provider) {
    throw new Error(
      "Nenhuma chave de IA configurada. Defina GEMINI_API_KEY (https://aistudio.google.com/apikey) " +
        "ou ANTHROPIC_API_KEY (https://console.anthropic.com) nas variáveis de ambiente."
    );
  }
  return provider;
}

/**
 * Resolve uma image_url (data: URL, caminho local /uploads/... ou URL
 * http(s) externa) para os bytes + media type da imagem — compartilhado
 * pelos dois provedores, que só diferem em como EMBRULHAM esses bytes na
 * mensagem.
 */
async function resolveImageBytes(url: string): Promise<{ mediaType: string; base64: string }> {
  const dataUrlMatch = /^data:([^;]+);base64,(.+)$/i.exec(url);
  if (dataUrlMatch) {
    return { mediaType: dataUrlMatch[1], base64: dataUrlMatch[2] };
  }

  if (url.startsWith("/uploads/")) {
    const relative = url.replace(/^\/uploads\//, "");
    const filePath = path.join(ENV.uploadsDir, relative);
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).replace(".", "").toLowerCase();
    const mediaType = ext === "jpg" ? "image/jpeg" : `image/${ext || "jpeg"}`;
    return { mediaType, base64: buffer.toString("base64") };
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Não foi possível baixar a imagem em ${url}: ${response.status}`);
  }
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());
  return { mediaType: contentType, base64: buffer.toString("base64") };
}

function resolveSchema(params: InvokeParams): JsonSchema | undefined {
  return params.responseFormat?.type === "json_schema"
    ? params.responseFormat.json_schema
    : params.response_format?.type === "json_schema"
    ? params.response_format.json_schema
    : params.outputSchema || params.output_schema;
}

// ============================================================================
// Anthropic
// ============================================================================
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

async function normalizeContentAnthropic(content: MessageContent | MessageContent[]): Promise<AnthropicContentBlock[]> {
  const parts = Array.isArray(content) ? content : [content];
  const blocks: AnthropicContentBlock[] = [];

  for (const part of parts) {
    if (typeof part === "string") {
      blocks.push({ type: "text", text: part });
    } else if (part.type === "text") {
      blocks.push({ type: "text", text: part.text });
    } else if (part.type === "image_url") {
      const { mediaType, base64 } = await resolveImageBytes(part.image_url.url);
      blocks.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } });
    } else if (part.type === "file_url") {
      blocks.push({ type: "text", text: `[arquivo anexado: ${part.file_url.url}]` });
    }
  }

  return blocks;
}

async function invokeAnthropic(params: InvokeParams): Promise<InvokeResult> {
  const { messages, model, max_tokens, maxTokens } = params;

  const systemMessages = messages.filter((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system" && m.role !== "tool" && m.role !== "function");

  const systemText = (
    await Promise.all(
      systemMessages.map(async (m) => {
        const blocks = await normalizeContentAnthropic(m.content);
        return blocks.filter((b): b is { type: "text"; text: string } => b.type === "text").map((b) => b.text).join("\n");
      })
    )
  ).join("\n");

  const anthropicMessages = await Promise.all(
    conversationMessages.map(async (m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: await normalizeContentAnthropic(m.content),
    }))
  );

  const payload: Record<string, unknown> = {
    model: model && !model.startsWith("gemini") ? model : DEFAULT_ANTHROPIC_MODEL,
    max_tokens: max_tokens ?? maxTokens ?? DEFAULT_MAX_TOKENS,
    messages: anthropicMessages,
  };
  if (systemText) payload.system = systemText;

  const schema = resolveSchema(params);
  let forcedToolName: string | null = null;
  if (schema) {
    forcedToolName = schema.name || "structured_output";
    payload.tools = [{ name: forcedToolName, description: "Retorna a resposta estruturada conforme o schema solicitado.", input_schema: schema.schema }];
    payload.tool_choice = { type: "tool", name: forcedToolName };
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": ENV.anthropicApiKey, "anthropic-version": ANTHROPIC_VERSION },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chamada à Anthropic falhou: ${response.status} ${response.statusText} – ${errorText}`);
  }

  const data = (await response.json()) as {
    id: string;
    model: string;
    content: Array<{ type: string; text?: string; input?: unknown }>;
    stop_reason: string | null;
    usage?: { input_tokens: number; output_tokens: number };
  };

  let content: string;
  if (forcedToolName) {
    const toolUseBlock = data.content.find((b) => b.type === "tool_use");
    content = toolUseBlock ? JSON.stringify(toolUseBlock.input) : "{}";
  } else {
    content = data.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
  }

  return {
    id: data.id,
    created: Math.floor(Date.now() / 1000),
    model: data.model,
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: data.stop_reason }],
    usage: data.usage
      ? { prompt_tokens: data.usage.input_tokens, completion_tokens: data.usage.output_tokens, total_tokens: data.usage.input_tokens + data.usage.output_tokens }
      : undefined,
  };
}

// ============================================================================
// Gemini
// ============================================================================
type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

async function normalizeContentGemini(content: MessageContent | MessageContent[]): Promise<GeminiPart[]> {
  const parts = Array.isArray(content) ? content : [content];
  const blocks: GeminiPart[] = [];

  for (const part of parts) {
    if (typeof part === "string") {
      blocks.push({ text: part });
    } else if (part.type === "text") {
      blocks.push({ text: part.text });
    } else if (part.type === "image_url") {
      const { mediaType, base64 } = await resolveImageBytes(part.image_url.url);
      blocks.push({ inlineData: { mimeType: mediaType, data: base64 } });
    } else if (part.type === "file_url") {
      blocks.push({ text: `[arquivo anexado: ${part.file_url.url}]` });
    }
  }

  return blocks;
}

/**
 * Remove campos que o JSON Schema padrão aceita mas a Gemini não suporta
 * em responseSchema (ex.: "additionalProperties"), recursivamente — sem
 * isso a API retorna erro 400 em schemas vindos de outros provedores.
 */
function sanitizeSchemaForGemini(schema: Record<string, unknown>): Record<string, unknown> {
  const { additionalProperties, ...rest } = schema as Record<string, unknown> & { additionalProperties?: unknown };
  const cleaned: Record<string, unknown> = { ...rest };
  if (cleaned.properties && typeof cleaned.properties === "object") {
    const props = cleaned.properties as Record<string, unknown>;
    cleaned.properties = Object.fromEntries(
      Object.entries(props).map(([k, v]) => [k, typeof v === "object" && v !== null ? sanitizeSchemaForGemini(v as Record<string, unknown>) : v])
    );
  }
  if (cleaned.items && typeof cleaned.items === "object") {
    cleaned.items = sanitizeSchemaForGemini(cleaned.items as Record<string, unknown>);
  }
  return cleaned;
}

function resolveGeminiModel(model: string | undefined): string {
  if (model && model.startsWith("gemini")) return model;
  return ENV.geminiModelVision || ENV.geminiModelPro || DEFAULT_GEMINI_MODEL;
}

async function invokeGemini(params: InvokeParams): Promise<InvokeResult> {
  const { messages, max_tokens, maxTokens } = params;
  const model = resolveGeminiModel(params.model);

  const systemMessages = messages.filter((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system" && m.role !== "tool" && m.role !== "function");

  const systemParts = (await Promise.all(systemMessages.map((m) => normalizeContentGemini(m.content)))).flat();

  const contents = await Promise.all(
    conversationMessages.map(async (m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: await normalizeContentGemini(m.content),
    }))
  );

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: max_tokens ?? maxTokens ?? DEFAULT_MAX_TOKENS,
  };

  const schema = resolveSchema(params);
  if (schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = sanitizeSchemaForGemini(schema.schema);
  }

  const payload: Record<string, unknown> = { contents, generationConfig };
  if (systemParts.length > 0) {
    payload.systemInstruction = { parts: systemParts };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": ENV.geminiApiKey },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chamada ao Gemini falhou: ${response.status} ${response.statusText} – ${errorText}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }>; role?: string };
      finishReason?: string;
    }>;
    usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number };
    modelVersion?: string;
  };

  const candidate = data.candidates?.[0];
  const content = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("\n");

  return {
    id: `gemini-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model: data.modelVersion ?? model,
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: candidate?.finishReason ?? null }],
    usage: data.usageMetadata
      ? {
          prompt_tokens: data.usageMetadata.promptTokenCount,
          completion_tokens: data.usageMetadata.candidatesTokenCount,
          total_tokens: data.usageMetadata.totalTokenCount,
        }
      : undefined,
  };
}

// ============================================================================
// Dispatcher público
// ============================================================================
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const provider = assertProvider();
  return provider === "gemini" ? invokeGemini(params) : invokeAnthropic(params);
}

export type ModelInfo = {
  id: string;
  object: string;
  created: number;
  owned_by: string;
};

export type ModelsResponse = {
  object: string;
  data: ModelInfo[];
};

/**
 * Mantida por compatibilidade de interface. Nenhum dos dois provedores
 * tem um endpoint de listagem equivalente ao da OpenAI — retorna
 * estaticamente os modelos do provedor ativo no momento.
 */
export async function listLLMModels(): Promise<ModelsResponse> {
  const provider = assertProvider();
  if (provider === "gemini") {
    return {
      object: "list",
      data: [
        { id: "gemini-2.5-flash", object: "model", created: 0, owned_by: "google" },
        { id: "gemini-2.5-pro", object: "model", created: 0, owned_by: "google" },
      ],
    };
  }
  return {
    object: "list",
    data: [
      { id: "claude-sonnet-4-6", object: "model", created: 0, owned_by: "anthropic" },
      { id: "claude-haiku-4-5", object: "model", created: 0, owned_by: "anthropic" },
      { id: "claude-opus-4-1", object: "model", created: 0, owned_by: "anthropic" },
    ],
  };
}
