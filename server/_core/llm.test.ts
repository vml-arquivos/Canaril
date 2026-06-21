import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL_ANTHROPIC = process.env.ANTHROPIC_API_KEY;
const ORIGINAL_GEMINI = process.env.GEMINI_API_KEY;

describe("llm.invokeLLM (Anthropic)", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key-123";
    process.env.GEMINI_API_KEY = ""; // garante que o Gemini não tem prioridade nesses testes
    vi.resetModules();
  });

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = ORIGINAL_ANTHROPIC;
    process.env.GEMINI_API_KEY = ORIGINAL_GEMINI;
    vi.unstubAllGlobals();
  });

  it("lança erro claro se ANTHROPIC_API_KEY não estiver configurada", async () => {
    process.env.ANTHROPIC_API_KEY = "";
    vi.resetModules();
    const { invokeLLM } = await import("./llm");
    await expect(invokeLLM({ messages: [{ role: "user", content: "oi" }] })).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });

  it("monta o payload correto: separa mensagens de sistema, usa model/max_tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "msg_123",
        model: "claude-sonnet-4-6",
        content: [{ type: "text", text: "Olá! Como posso ajudar?" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "Você é um assistente útil." },
        { role: "user", content: "Olá" },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers["x-api-key"]).toBe("test-key-123");
    expect(init.headers["anthropic-version"]).toBeTruthy();

    const body = JSON.parse(init.body);
    expect(body.system).toBe("Você é um assistente útil.");
    expect(body.messages).toEqual([{ role: "user", content: [{ type: "text", text: "Olá" }] }]);
    expect(body.max_tokens).toBeGreaterThan(0);
    expect(body.model).toBe("claude-sonnet-4-6");

    // Resposta convertida pro formato esperado pelos callers (string em content)
    expect(result.choices[0].message.content).toBe("Olá! Como posso ajudar?");
  });

  it("força tool-use quando response_format json_schema é pedido, e devolve o input como JSON string", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "msg_456",
        model: "claude-sonnet-4-6",
        content: [
          { type: "tool_use", id: "tool_1", name: "my_schema", input: { score: 9, label: "ótimo" } },
        ],
        stop_reason: "tool_use",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    const result = await invokeLLM({
      messages: [{ role: "user", content: "Analise isso" }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "my_schema", schema: { type: "object", properties: { score: { type: "number" } } } },
      },
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.tool_choice).toEqual({ type: "tool", name: "my_schema" });
    expect(body.tools[0].name).toBe("my_schema");

    // O caller faz JSON.parse(content) — precisa ser uma string JSON válida
    const parsed = JSON.parse(result.choices[0].message.content as string);
    expect(parsed).toEqual({ score: 9, label: "ótimo" });
  });

  it("converte um data: URL de imagem em bloco base64 da Anthropic", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "msg_789",
        model: "claude-sonnet-4-6",
        content: [{ type: "text", text: "ok" }],
        stop_reason: "end_turn",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    await invokeLLM({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Veja a foto:" },
            { type: "image_url", image_url: { url: "data:image/png;base64,aGVsbG8=" } },
          ],
        },
      ],
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    const imageBlock = body.messages[0].content.find((b: any) => b.type === "image");
    expect(imageBlock.source).toEqual({ type: "base64", media_type: "image/png", data: "aGVsbG8=" });
  });

  it("propaga erro com status quando a API retorna falha", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => '{"error":"invalid api key"}',
    });
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    await expect(invokeLLM({ messages: [{ role: "user", content: "oi" }] })).rejects.toThrow(/401/);
  });
});

describe("llm.invokeLLM (Gemini)", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.ANTHROPIC_API_KEY = ""; // confirma que o Gemini tem prioridade quando configurado
    vi.resetModules();
  });

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = ORIGINAL_ANTHROPIC;
    process.env.GEMINI_API_KEY = ORIGINAL_GEMINI;
    vi.unstubAllGlobals();
  });

  it("usa o Gemini quando GEMINI_API_KEY está definida, mesmo com ANTHROPIC_API_KEY ausente", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Olá!" }], role: "model" }, finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2, totalTokenCount: 7 },
        modelVersion: "gemini-2.5-flash",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    const result = await invokeLLM({ messages: [{ role: "user", content: "Olá" }] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("generativelanguage.googleapis.com");
    expect(url).toContain("gemini-2.5-flash");
    expect(init.headers["x-goog-api-key"]).toBe("test-gemini-key");
    expect(result.choices[0].message.content).toBe("Olá!");
  });

  it("Gemini tem prioridade sobre Anthropic quando as duas chaves estão configuradas", async () => {
    process.env.ANTHROPIC_API_KEY = "also-set-but-should-be-ignored";
    vi.resetModules();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    await invokeLLM({ messages: [{ role: "user", content: "oi" }] });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("generativelanguage.googleapis.com");
  });

  it("monta system instruction separado e mapeia role assistant -> model", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    await invokeLLM({
      messages: [
        { role: "system", content: "Você é um assistente." },
        { role: "user", content: "Olá" },
        { role: "assistant", content: "Oi! Como posso ajudar?" },
      ],
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.systemInstruction.parts[0].text).toBe("Você é um assistente.");
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "Olá" }] },
      { role: "model", parts: [{ text: "Oi! Como posso ajudar?" }] },
    ]);
  });

  it("usa responseSchema nativo do Gemini (não tool-forcing) e devolve o JSON como string", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"score":9}' }] }, finishReason: "STOP" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    const result = await invokeLLM({
      messages: [{ role: "user", content: "Analise isso" }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "my_schema", schema: { type: "object", properties: { score: { type: "number" } }, additionalProperties: false } },
      },
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    // additionalProperties precisa ser removido — Gemini rejeita esse campo
    expect(body.generationConfig.responseSchema.additionalProperties).toBeUndefined();
    expect(body.generationConfig.responseSchema.properties.score).toEqual({ type: "number" });

    const parsed = JSON.parse(result.choices[0].message.content as string);
    expect(parsed).toEqual({ score: 9 });
  });

  it("converte um data: URL de imagem em inlineData do Gemini", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    await invokeLLM({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Veja a foto:" },
            { type: "image_url", image_url: { url: "data:image/png;base64,aGVsbG8=" } },
          ],
        },
      ],
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    const imagePart = body.contents[0].parts.find((p: any) => p.inlineData);
    expect(imagePart.inlineData).toEqual({ mimeType: "image/png", data: "aGVsbG8=" });
  });

  it("usa o modelo do GEMINI_MODEL_VISION quando configurado, em vez do default", async () => {
    process.env.GEMINI_MODEL_VISION = "gemini-2.5-pro";
    vi.resetModules();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    await invokeLLM({ messages: [{ role: "user", content: "oi" }] });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("gemini-2.5-pro");
    delete process.env.GEMINI_MODEL_VISION;
  });

  it("propaga erro claro quando a API do Gemini falha", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => '{"error":"invalid request"}',
    });
    vi.stubGlobal("fetch", fetchMock);

    const { invokeLLM } = await import("./llm");
    await expect(invokeLLM({ messages: [{ role: "user", content: "oi" }] })).rejects.toThrow(/Gemini.*400/);
  });
});

describe("llm.getActiveProvider", () => {
  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = ORIGINAL_ANTHROPIC;
    process.env.GEMINI_API_KEY = ORIGINAL_GEMINI;
  });

  it("retorna null quando nenhuma chave está configurada", async () => {
    process.env.ANTHROPIC_API_KEY = "";
    process.env.GEMINI_API_KEY = "";
    vi.resetModules();
    const { getActiveProvider } = await import("./llm");
    expect(getActiveProvider()).toBeNull();
  });

  it("retorna 'anthropic' quando só ANTHROPIC_API_KEY está configurada", async () => {
    process.env.ANTHROPIC_API_KEY = "x";
    process.env.GEMINI_API_KEY = "";
    vi.resetModules();
    const { getActiveProvider } = await import("./llm");
    expect(getActiveProvider()).toBe("anthropic");
  });

  it("retorna 'gemini' quando GEMINI_API_KEY está configurada (com ou sem Anthropic)", async () => {
    process.env.ANTHROPIC_API_KEY = "x";
    process.env.GEMINI_API_KEY = "y";
    vi.resetModules();
    const { getActiveProvider } = await import("./llm");
    expect(getActiveProvider()).toBe("gemini");
  });
});
