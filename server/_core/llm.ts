// Integração com IA — chama a API da Anthropic diretamente.
// ============================================================================
// Substitui a dependência do Forge da Manus (BUILT_IN_FORGE_API_URL/KEY),
// que só existe em projetos hospedados pela própria Manus. Como este
// projeto roda self-hosted, usamos uma ANTHROPIC_API_KEY real (obtida em
// https://console.anthropic.com), que o criador pode gerar e colocar como
// variável de ambiente no Coolify.
//
// A assinatura pública (invokeLLM, listLLMModels, tipos Message/
// ImageContent/etc.) foi mantida EXATAMENTE igual à versão anterior — quem
// chama (server/routers/aiJudge.ts, server/routers/genetics.ts) não precisa
// mudar nada.
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

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 4096;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

function assertApiKey() {
  if (!ENV.anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY não está configurada. Gere uma chave em https://console.anthropic.com e adicione como variável de ambiente."
    );
  }
}

/**
 * Resolve uma image_url (que pode ser um data: URL, um caminho local
 * /uploads/... ou uma URL http(s) externa) para o formato de bloco de
 * imagem que a API da Anthropic espera (base64 inline). Inlinar em base64
 * é mais robusto que pedir pra Anthropic buscar a URL — funciona mesmo
 * com caminhos relativos e domínios atrás de firewall/sem DNS público.
 */
async function resolveImageBlock(url: string): Promise<{ type: "image"; source: { type: "base64"; media_type: string; data: string } }> {
  // data:image/png;base64,....
  const dataUrlMatch = /^data:([^;]+);base64,(.+)$/i.exec(url);
  if (dataUrlMatch) {
    return { type: "image", source: { type: "base64", media_type: dataUrlMatch[1], data: dataUrlMatch[2] } };
  }

  // Caminho local servido pela própria aplicação (/uploads/...) — lê
  // direto do disco, do mesmo diretório usado por server/storage.ts.
  if (url.startsWith("/uploads/")) {
    const relative = url.replace(/^\/uploads\//, "");
    const filePath = path.join(ENV.uploadsDir, relative);
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).replace(".", "").toLowerCase();
    const mediaType = ext === "jpg" ? "image/jpeg" : `image/${ext || "jpeg"}`;
    return { type: "image", source: { type: "base64", media_type: mediaType, data: buffer.toString("base64") } };
  }

  // URL externa http(s) — busca e converte pra base64.
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Não foi possível baixar a imagem em ${url}: ${response.status}`);
  }
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());
  return { type: "image", source: { type: "base64", media_type: contentType, data: buffer.toString("base64") } };
}

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

async function normalizeContent(content: MessageContent | MessageContent[]): Promise<AnthropicContentBlock[]> {
  const parts = Array.isArray(content) ? content : [content];
  const blocks: AnthropicContentBlock[] = [];

  for (const part of parts) {
    if (typeof part === "string") {
      blocks.push({ type: "text", text: part });
    } else if (part.type === "text") {
      blocks.push({ type: "text", text: part.text });
    } else if (part.type === "image_url") {
      blocks.push(await resolveImageBlock(part.image_url.url));
    } else if (part.type === "file_url") {
      // A API de Messages da Anthropic não aceita arquivos genéricos
      // (áudio/PDF) como bloco de mensagem da mesma forma — registra como
      // texto descritivo pra não quebrar a chamada, mas isso é uma
      // limitação conhecida (sem caso de uso no app hoje).
      blocks.push({ type: "text", text: `[arquivo anexado: ${part.file_url.url}]` });
    }
  }

  return blocks;
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const { messages, outputSchema, output_schema, responseFormat, response_format, model, max_tokens, maxTokens } = params;

  // A Anthropic usa um campo "system" separado, não uma mensagem com
  // role "system" dentro do array.
  const systemMessages = messages.filter(m => m.role === "system");
  const conversationMessages = messages.filter(m => m.role !== "system" && m.role !== "tool" && m.role !== "function");

  const systemText = (
    await Promise.all(
      systemMessages.map(async m => {
        const blocks = await normalizeContent(m.content);
        return blocks.filter((b): b is { type: "text"; text: string } => b.type === "text").map(b => b.text).join("\n");
      })
    )
  ).join("\n");

  const anthropicMessages = await Promise.all(
    conversationMessages.map(async m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: await normalizeContent(m.content),
    }))
  );

  const payload: Record<string, unknown> = {
    model: model || DEFAULT_MODEL,
    max_tokens: max_tokens ?? maxTokens ?? DEFAULT_MAX_TOKENS,
    messages: anthropicMessages,
  };

  if (systemText) {
    payload.system = systemText;
  }

  // response_format / outputSchema -> Anthropic não tem "json_schema"
  // nativo, então usamos o truque padrão de tool-use forçado: declaramos
  // uma "tool" cujo input_schema é o JSON Schema desejado, e forçamos o
  // modelo a chamá-la. O resultado estruturado vem em tool_use.input.
  const schema = responseFormat?.type === "json_schema" ? responseFormat.json_schema
    : response_format?.type === "json_schema" ? response_format.json_schema
    : outputSchema || output_schema;

  let forcedToolName: string | null = null;
  if (schema) {
    forcedToolName = schema.name || "structured_output";
    payload.tools = [
      {
        name: forcedToolName,
        description: "Retorna a resposta estruturada conforme o schema solicitado.",
        input_schema: schema.schema,
      },
    ];
    payload.tool_choice = { type: "tool", name: forcedToolName };
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ENV.anthropicApiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
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

  // Se foi forçado tool-use pra obter saída estruturada, o resultado vem
  // como o "input" do bloco tool_use — convertemos de volta pra uma
  // string JSON, que é exatamente o formato que aiJudge.ts/genetics.ts já
  // esperam (fazem JSON.parse(content) quando content é string).
  let content: string;
  if (forcedToolName) {
    const toolUseBlock = data.content.find(b => b.type === "tool_use");
    content = toolUseBlock ? JSON.stringify(toolUseBlock.input) : "{}";
  } else {
    content = data.content
      .filter(b => b.type === "text")
      .map(b => b.text ?? "")
      .join("\n");
  }

  return {
    id: data.id,
    created: Math.floor(Date.now() / 1000),
    model: data.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: data.stop_reason,
      },
    ],
    usage: data.usage
      ? {
          prompt_tokens: data.usage.input_tokens,
          completion_tokens: data.usage.output_tokens,
          total_tokens: data.usage.input_tokens + data.usage.output_tokens,
        }
      : undefined,
  };
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
 * Mantida por compatibilidade de interface. A Anthropic não tem um
 * endpoint de listagem de modelos público equivalente ao da OpenAI —
 * retorna estaticamente os modelos suportados pela aplicação.
 */
export async function listLLMModels(): Promise<ModelsResponse> {
  assertApiKey();
  return {
    object: "list",
    data: [
      { id: "claude-sonnet-4-6", object: "model", created: 0, owned_by: "anthropic" },
      { id: "claude-haiku-4-5", object: "model", created: 0, owned_by: "anthropic" },
      { id: "claude-opus-4-1", object: "model", created: 0, owned_by: "anthropic" },
    ],
  };
}
