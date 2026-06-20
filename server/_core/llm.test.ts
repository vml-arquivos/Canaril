import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL_ENV = process.env.ANTHROPIC_API_KEY;

describe("llm.invokeLLM (Anthropic)", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key-123";
    vi.resetModules();
  });

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = ORIGINAL_ENV;
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
