import { describe, it, expect, vi, beforeEach } from "vitest";

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

describe("photoPhenotypeAnalyzer.analyzePhotoPhenotype", () => {
  beforeEach(() => {
    vi.mocked(invokeLLM).mockReset();
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

    // Não pode conter o texto malformado do bug original ("}fotos\"}")
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

  it("não fixa o modelo — deixa server/_core/llm.ts escolher pelo provedor ativo (Gemini ou Anthropic)", async () => {
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
});
