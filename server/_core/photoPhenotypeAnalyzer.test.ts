import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "./llm";
import { analyzePhotoPhenotype, PhotoAnalysisResponseSchema } from "./photoPhenotypeAnalyzer";

const VALID_RESPONSE = {
  lipochromeBase: "amarelo",
  melaninSeries: "agata",
  featherCategory: "intenso",
  crestType: "sem_topete",
  visibleMutations: ["agata"],
  possibleOfficialClasses: [
    { code: "CC1203", name: "ÁGATA AMARELO INTENSO", confidence: 0.8, reason: "Padrão de melanina compatível com ágata" },
  ],
  confidenceOverall: 0.75,
  visualDescription: "Canário amarelo com padrão melânico ágata, pena intensa.",
  warnings: [],
  recommendations: ["Tire uma foto com luz natural para confirmar o tom exato."],
  fieldsNotConfirmed: ["Portador de branco recessivo", "Portador de marfim"],
};

const ORIGINAL_PHOTO_MODE = process.env.PHOTO_ANALYSIS_MODE;
const ORIGINAL_DISABLE = process.env.DISABLE_EXTERNAL_PHOTO_AI;

describe("photoPhenotypeAnalyzer — modo externo (padrão)", () => {
  beforeEach(() => {
    vi.mocked(invokeLLM).mockReset();
    delete process.env.PHOTO_ANALYSIS_MODE;
    delete process.env.DISABLE_EXTERNAL_PHOTO_AI;
    vi.resetModules();
  });

  afterEach(() => {
    process.env.PHOTO_ANALYSIS_MODE = ORIGINAL_PHOTO_MODE;
    process.env.DISABLE_EXTERNAL_PHOTO_AI = ORIGINAL_DISABLE;
  });

  it("monta o prompt corretamente (sem o bug do template literal quebrado)", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      id: "x", created: 0, model: "claude-sonnet-4-6",
      choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(VALID_RESPONSE) }, finish_reason: "stop" }],
    });

    await analyzePhotoPhenotype({ photoUrls: ["/uploads/a.jpg", "/uploads/b.jpg", "/uploads/c.jpg"] });

    const call = vi.mocked(invokeLLM).mock.calls[0][0];
    const userMsg = call.messages.find((m) => m.role === "user")!;
    const textPart = (userMsg.content as any[]).find((c) => c.type === "text");

    expect(textPart.text).not.toContain('"}');
    expect(textPart.text).toContain("Analise estas 3 fotos de canário");
  });

  it("singular: 1 foto -> 'esta foto' (não 'estas 1 fotos')", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      id: "x", created: 0, model: "claude-sonnet-4-6",
      choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(VALID_RESPONSE) }, finish_reason: "stop" }],
    });

    await analyzePhotoPhenotype({ photoUrls: ["/uploads/a.jpg"] });

    const call = vi.mocked(invokeLLM).mock.calls[0][0];
    const userMsg = call.messages.find((m) => m.role === "user")!;
    const textPart = (userMsg.content as any[]).find((c) => c.type === "text");
    expect(textPart.text).toContain("Analise esta foto de canário");
  });

  it("não fixa o modelo — deixa llm.ts escolher pelo provedor ativo", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      id: "x", created: 0, model: "claude-sonnet-4-6",
      choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(VALID_RESPONSE) }, finish_reason: "stop" }],
    });

    await analyzePhotoPhenotype({ photoUrls: ["/uploads/a.jpg"] });

    const call = vi.mocked(invokeLLM).mock.calls[0][0];
    expect(call.model).toBeUndefined();
  });

  it("valida e retorna a resposta corretamente quando o JSON é válido", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      id: "x", created: 0, model: "claude-sonnet-4-6",
      choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(VALID_RESPONSE) }, finish_reason: "stop" }],
    });

    const result = await analyzePhotoPhenotype({ photoUrls: ["/uploads/a.jpg"] });
    expect(result.analysis.lipochromeBase).toBe("amarelo");
    expect(result.analysis.possibleOfficialClasses[0].code).toBe("CC1203");
    expect(result.disclaimer).toContain("não comprova genes ocultos");
    expect(result.photosAnalyzed).toBe(1);
  });

  it("degrada graciosamente quando o JSON da IA está incompleto/inválido", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      id: "x", created: 0, model: "claude-sonnet-4-6",
      choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify({ lipochromeBase: "amarelo" }) }, finish_reason: "stop" }],
    });

    const result = await analyzePhotoPhenotype({ photoUrls: ["/uploads/a.jpg"] });
    expect(result.analysis.lipochromeBase).toBe("amarelo");
    expect(result.analysis.confidenceOverall).toBeLessThanOrEqual(0.3);
    expect(result.analysis.warnings.length).toBeGreaterThan(0);
  });

  it("lança erro claro quando a IA retorna texto que não é JSON", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      id: "x", created: 0, model: "claude-sonnet-4-6",
      choices: [{ index: 0, message: { role: "assistant", content: "não consigo analisar essa imagem" }, finish_reason: "stop" }],
    });

    await expect(analyzePhotoPhenotype({ photoUrls: ["/uploads/a.jpg"] })).rejects.toThrow(/resposta inválida/);
  });

  it("rejeita análise sem nenhuma foto", async () => {
    await expect(analyzePhotoPhenotype({ photoUrls: [] })).rejects.toThrow(/Nenhuma foto/);
  });

  it("limita a 6 fotos mesmo se mais forem enviadas", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      id: "x", created: 0, model: "claude-sonnet-4-6",
      choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(VALID_RESPONSE) }, finish_reason: "stop" }],
    });

    const urls = Array.from({ length: 10 }, (_, i) => `/uploads/${i}.jpg`);
    const result = await analyzePhotoPhenotype({ photoUrls: urls });
    expect(result.photosAnalyzed).toBe(6);
  });

  it("schema Zod aceita um payload completo válido", () => {
    expect(PhotoAnalysisResponseSchema.safeParse(VALID_RESPONSE).success).toBe(true);
  });

  // ── NOVO: fallback para modo local quando 429 ─────────────────────────────
  it("fallback local dispara automaticamente em erro 429 RESOURCE_EXHAUSTED", async () => {
    vi.mocked(invokeLLM).mockRejectedValue(new Error("Chamada ao Gemini falhou: 429 RESOURCE_EXHAUSTED: Your prepayment credits are depleted."));

    const result = await analyzePhotoPhenotype({
      photoUrls: ["/uploads/a.jpg"],
      localVisualTraits: [{ source: "client_canvas", yellowRatio: 0.5, dominantColor: "yellow" }],
    });

    // Não deve lançar — deve retornar análise local
    expect(result.modelUsed).toBe("internal-local-phenotype-rules-v1");
    expect(result.analysis.warnings.some((w) => w.toLowerCase().includes("fallback") || w.toLowerCase().includes("local"))).toBe(true);
    expect(vi.mocked(invokeLLM)).toHaveBeenCalledTimes(1);
  });

  it("fallback local dispara automaticamente em erro 403 PERMISSION_DENIED", async () => {
    vi.mocked(invokeLLM).mockRejectedValue(new Error("Chamada ao Gemini falhou: 403 PERMISSION_DENIED"));

    const result = await analyzePhotoPhenotype({
      photoUrls: ["/uploads/a.jpg"],
      localVisualTraits: [{ source: "client_canvas", redRatio: 0.4, dominantColor: "red" }],
    });

    expect(result.modelUsed).toBe("internal-local-phenotype-rules-v1");
    expect(result.analysis.fieldsNotConfirmed).toContain("Portador de branco recessivo");
  });

  it("fallback local dispara em erro de billing/quota", async () => {
    vi.mocked(invokeLLM).mockRejectedValue(new Error("billing quota exceeded"));

    const result = await analyzePhotoPhenotype({
      photoUrls: ["/uploads/a.jpg"],
      localVisualTraits: [{ source: "client_canvas", yellowRatio: 0.3 }],
    });

    expect(result.modelUsed).toBe("internal-local-phenotype-rules-v1");
  });

  it("fallback local dispara em erro de chave de API inválida", async () => {
    vi.mocked(invokeLLM).mockRejectedValue(new Error("api key inválida ou não configurada"));

    const result = await analyzePhotoPhenotype({
      photoUrls: ["/uploads/a.jpg"],
      localVisualTraits: [{ source: "client_canvas", whiteRatio: 0.6, dominantColor: "white" }],
    });

    expect(result.modelUsed).toBe("internal-local-phenotype-rules-v1");
  });
});

describe("photoPhenotypeAnalyzer — modo local (PHOTO_ANALYSIS_MODE=local)", () => {
  beforeEach(() => {
    vi.mocked(invokeLLM).mockReset();
    process.env.PHOTO_ANALYSIS_MODE = "local";
    delete process.env.DISABLE_EXTERNAL_PHOTO_AI;
  });

  afterEach(() => {
    process.env.PHOTO_ANALYSIS_MODE = ORIGINAL_PHOTO_MODE;
    process.env.DISABLE_EXTERNAL_PHOTO_AI = ORIGINAL_DISABLE;
  });

  it("modo local não chama invokeLLM", async () => {
    const result = await analyzePhotoPhenotype({
      photoUrls: ["/uploads/a.jpg"],
      localVisualTraits: [{ source: "client_canvas", yellowRatio: 0.4, dominantColor: "yellow" }],
    });

    expect(vi.mocked(invokeLLM)).not.toHaveBeenCalled();
    expect(result.modelUsed).toBe("internal-local-phenotype-rules-v1");
  });

  it("modo local retorna shape válido pelo Zod", async () => {
    const result = await analyzePhotoPhenotype({
      photoUrls: ["/uploads/a.jpg"],
      localVisualTraits: [{ source: "client_canvas", yellowRatio: 0.5 }],
    });

    const parsed = PhotoAnalysisResponseSchema.safeParse(result.analysis);
    expect(parsed.success).toBe(true);
  });

  it("modo local nunca confirma genes ocultos", async () => {
    const result = await analyzePhotoPhenotype({
      photoUrls: ["/uploads/a.jpg"],
      localVisualTraits: [{ source: "client_canvas", yellowRatio: 0.5 }],
    });

    expect(result.analysis.fieldsNotConfirmed).toContain("Portador de branco recessivo");
    expect(result.analysis.fieldsNotConfirmed).toContain("Portador de marfim");
    expect(result.analysis.fieldsNotConfirmed).toContain("Genes recessivos ocultos");
  });

  it("modo local com amarelo dominante -> sugere amarelo", async () => {
    const result = await analyzePhotoPhenotype({
      photoUrls: ["/uploads/a.jpg"],
      localVisualTraits: [{ source: "client_canvas", yellowRatio: 0.55, orangeRatio: 0.05, redRatio: 0.02, whiteRatio: 0.1 }],
    });

    expect(result.analysis.lipochromeBase).toBe("amarelo");
  });

  it("modo local com vermelho dominante -> sugere vermelho", async () => {
    const result = await analyzePhotoPhenotype({
      photoUrls: ["/uploads/a.jpg"],
      localVisualTraits: [{ source: "client_canvas", yellowRatio: 0.05, orangeRatio: 0.1, redRatio: 0.45, whiteRatio: 0.05 }],
    });

    expect(result.analysis.lipochromeBase).toBe("vermelho");
  });

  it("modo local com branco dominante -> sugere branco_dominante", async () => {
    const result = await analyzePhotoPhenotype({
      photoUrls: ["/uploads/a.jpg"],
      localVisualTraits: [{ source: "client_canvas", whiteRatio: 0.7, yellowRatio: 0.05, redRatio: 0.02 }],
    });

    expect(result.analysis.lipochromeBase).toBe("branco_dominante");
  });

  it("modo local com contexto 'intenso' -> featherCategory intenso", async () => {
    const result = await analyzePhotoPhenotype({
      photoUrls: ["/uploads/a.jpg"],
      additionalContext: "Pena intenso",
      localVisualTraits: [{ source: "client_canvas", yellowRatio: 0.4 }],
    });

    expect(result.analysis.featherCategory).toBe("intenso");
  });

  it("modo local sem traits retorna confidence conservadora", async () => {
    const result = await analyzePhotoPhenotype({
      photoUrls: ["/uploads/a.jpg"],
    });

    expect(result.analysis.confidenceOverall).toBeLessThanOrEqual(0.4);
    expect(result.analysis.warnings.length).toBeGreaterThan(0);
  });

  it("modo local rejeita análise sem nenhuma foto", async () => {
    await expect(analyzePhotoPhenotype({ photoUrls: [] })).rejects.toThrow(/Nenhuma foto/);
  });
});

describe("photoPhenotypeAnalyzer — DISABLE_EXTERNAL_PHOTO_AI=true", () => {
  beforeEach(() => {
    vi.mocked(invokeLLM).mockReset();
    delete process.env.PHOTO_ANALYSIS_MODE;
    process.env.DISABLE_EXTERNAL_PHOTO_AI = "true";
  });

  afterEach(() => {
    process.env.PHOTO_ANALYSIS_MODE = ORIGINAL_PHOTO_MODE;
    process.env.DISABLE_EXTERNAL_PHOTO_AI = ORIGINAL_DISABLE;
  });

  it("DISABLE_EXTERNAL_PHOTO_AI=true não chama invokeLLM", async () => {
    const result = await analyzePhotoPhenotype({
      photoUrls: ["/uploads/a.jpg"],
      localVisualTraits: [{ source: "client_canvas", yellowRatio: 0.3 }],
    });

    expect(vi.mocked(invokeLLM)).not.toHaveBeenCalled();
    expect(result.modelUsed).toBe("internal-local-phenotype-rules-v1");
  });
});
