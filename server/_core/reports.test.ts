/**
 * reports.test.ts — Testes de regressão para os novos endpoints de relatórios
 *
 * Testa a lógica pura que pode ser verificada sem banco de dados:
 * - Cálculos de COI nos relatórios
 * - Lógica de alertas do painel de Temporada
 * - Classificação de lacunas de dados
 * - Lógica de datas de eclosão
 */
import { describe, it, expect } from "vitest";
import { calculateCOIForPair, classifyCOIRisk, PedigreeBird } from "./genetics";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bird(id: number, fatherId: number | null, motherId: number | null): PedigreeBird {
  return { id, ring: `B${id}`, specialty_code: "cc", color_code: "am", sex: "macho", fatherId, motherId };
}

// ─── Lógica de alertas do Relatório de Lacunas ───────────────────────────────

function getLacunas(b: {
  fatherId: number | null;
  motherId: number | null;
  officialClassId: number | null;
  hasGenotype: boolean;
  hasProfile: boolean;
  birthDate: Date | null;
  sex: string;
}): string[] {
  const lacunas: string[] = [];
  if (!b.fatherId) lacunas.push("Pai");
  if (!b.motherId) lacunas.push("Mãe");
  if (!b.officialClassId) lacunas.push("Classe oficial");
  if (!b.hasGenotype) lacunas.push("Genótipo operacional");
  if (!b.hasProfile) lacunas.push("Perfil genético oficial");
  if (!b.birthDate) lacunas.push("Data de nascimento");
  if (!b.sex || b.sex === "indeterminado") lacunas.push("Sexo");
  return lacunas;
}

describe("relatório de lacunas — classificação", () => {
  it("pássaro sem nenhum dado tem 7 lacunas", () => {
    const l = getLacunas({
      fatherId: null, motherId: null,
      officialClassId: null, hasGenotype: false, hasProfile: false,
      birthDate: null, sex: "indeterminado",
    });
    expect(l).toHaveLength(7);
  });

  it("pássaro com todos os dados tem 0 lacunas", () => {
    const l = getLacunas({
      fatherId: 1, motherId: 2,
      officialClassId: 5, hasGenotype: true, hasProfile: true,
      birthDate: new Date("2024-01-01"), sex: "macho",
    });
    expect(l).toHaveLength(0);
  });

  it("pássaro sem pais mas com genótipo tem 2 lacunas (pai e mãe)", () => {
    const l = getLacunas({
      fatherId: null, motherId: null,
      officialClassId: 3, hasGenotype: true, hasProfile: true,
      birthDate: new Date("2024-06-01"), sex: "fêmea",
    });
    expect(l).toEqual(expect.arrayContaining(["Pai", "Mãe"]));
    expect(l).toHaveLength(2);
  });

  it("sexo 'macho' não gera lacuna de sexo", () => {
    const l = getLacunas({
      fatherId: 1, motherId: 2,
      officialClassId: 1, hasGenotype: true, hasProfile: true,
      birthDate: new Date(), sex: "macho",
    });
    expect(l).not.toContain("Sexo");
  });
});

// ─── Lógica de COI no confronto genético ─────────────────────────────────────

describe("confronto genético — COI e alertas", () => {
  it("casal irmãos completos tem COI de 25%", () => {
    const map = new Map<number, PedigreeBird>([
      [1, bird(1, null, null)],
      [2, bird(2, null, null)],
      [3, bird(3, 1, 2)],
      [4, bird(4, 1, 2)],
    ]);
    const coi = calculateCOIForPair(3, 4, map, 5);
    expect(coi).toBeCloseTo(0.25, 6);
    expect(classifyCOIRisk(coi)).toBe("high");
  });

  it("casal sem parentesco tem COI de 0%", () => {
    const map = new Map<number, PedigreeBird>([
      [1, bird(1, null, null)],
      [2, bird(2, null, null)],
    ]);
    const coi = calculateCOIForPair(1, 2, map, 5);
    expect(coi).toBe(0);
    expect(classifyCOIRisk(coi)).toBe("low");
  });

  it("primos de primeiro grau têm COI ~6.25%", () => {
    const map = new Map<number, PedigreeBird>([
      [1, bird(1, null, null)], // avô paterno
      [2, bird(2, null, null)], // avó paterna
      [3, bird(3, 1, 2)], // pai de A
      [4, bird(4, 1, 2)], // pai de B (irmão de 3)
      [5, bird(5, null, null)], // mãe de A
      [6, bird(6, null, null)], // mãe de B
      [7, bird(7, 3, 5)], // A
      [8, bird(8, 4, 6)], // B
    ]);
    const coi = calculateCOIForPair(7, 8, map, 5);
    expect(coi).toBeCloseTo(0.0625, 4);
    // 6.25% está exatamente no limiar moderate/low — pode ser "moderate"
    expect(["low", "moderate"]).toContain(classifyCOIRisk(coi));
  });
});

// ─── Lógica de eclosão (Painel de Temporada) ──────────────────────────────────

describe("temporada — cálculo de datas de eclosão", () => {
  const INCUBATION_DAYS = 14;

  function expectedHatchDate(clutchDate: Date): Date {
    return new Date(clutchDate.getTime() + INCUBATION_DAYS * 24 * 60 * 60 * 1000);
  }

  function isNearHatch(clutchDate: Date, now: Date, windowDays = 7): boolean {
    const hatch = expectedHatchDate(clutchDate);
    const window = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);
    return hatch >= now && hatch <= window;
  }

  it("postura de hoje eclode em 14 dias — está no alerta (janela 7 dias: não)", () => {
    const now = new Date("2025-09-01");
    const clutchDate = new Date("2025-09-01"); // postura hoje -> eclode 15 set
    expect(isNearHatch(clutchDate, now, 7)).toBe(false); // 14 dias > 7 dias de janela
  });

  it("postura de 8 dias atrás eclode daqui a 6 dias — está no alerta", () => {
    const now = new Date("2025-09-09");
    const clutchDate = new Date("2025-09-01"); // postura 1 set -> eclode 15 set = 6 dias
    expect(isNearHatch(clutchDate, now, 7)).toBe(true);
  });

  it("postura de 15 dias atrás já eclodiu — não está no alerta", () => {
    const now = new Date("2025-09-16");
    const clutchDate = new Date("2025-09-01"); // eclodiu 15 set = ontem
    expect(isNearHatch(clutchDate, now, 7)).toBe(false);
  });

  it("postura exatamente no limite de 7 dias — está no alerta", () => {
    const now = new Date("2025-09-08");
    const clutchDate = new Date("2025-09-01"); // eclode 15 set = 7 dias exatos
    expect(isNearHatch(clutchDate, now, 7)).toBe(true);
  });
});

// ─── Lógica de anilhamento (Painel de Temporada) ──────────────────────────────

describe("temporada — janela de anilhamento", () => {
  // Backend usa: ageDays >= (RINGING_DAYS_AFTER_HATCH - 1) && ageDays <= RINGING_MAX
  // RINGING_DAYS_AFTER_HATCH = 8, portanto janela começa em 7 dias
  const RINGING_START = 7; // 8 - 1
  const RINGING_MAX_DAYS = 11;

  function isDueRinging(birthDate: Date, now: Date): boolean {
    const ageDays = (now.getTime() - birthDate.getTime()) / (24 * 60 * 60 * 1000);
    return ageDays >= RINGING_START && ageDays <= RINGING_MAX_DAYS;
  }

  it("filhote de 5 dias — ainda cedo para anilhar", () => {
    const now = new Date("2025-09-10");
    const birth = new Date("2025-09-05"); // 5 dias
    expect(isDueRinging(birth, now)).toBe(false);
  });

  it("filhote de 7 dias — no início da janela ideal", () => {
    const now = new Date("2025-09-10");
    const birth = new Date("2025-09-03"); // 7 dias
    expect(isDueRinging(birth, now)).toBe(true);
  });

  it("filhote de 9 dias — no prazo ideal", () => {
    const now = new Date("2025-09-10");
    const birth = new Date("2025-09-01"); // 9 dias
    expect(isDueRinging(birth, now)).toBe(true);
  });

  it("filhote de 12 dias — passou do prazo ideal", () => {
    const now = new Date("2025-09-10");
    const birth = new Date("2025-08-29"); // 12 dias
    expect(isDueRinging(birth, now)).toBe(false);
  });

  it("filhote de 11 dias — último dia da janela", () => {
    const now = new Date("2025-09-10");
    const birth = new Date("2025-08-30"); // 11 dias
    expect(isDueRinging(birth, now)).toBe(true);
  });
});

// ─── classifyCOIRisk ──────────────────────────────────────────────────────────

describe("classifyCOIRisk", () => {
  it("0% -> low", () => expect(classifyCOIRisk(0)).toBe("low"));
  it("5% -> low", () => expect(classifyCOIRisk(0.05)).toBe("low"));
  it("6.25% -> moderate", () => expect(classifyCOIRisk(0.0625)).toBe("moderate"));
  it("10% -> moderate", () => expect(classifyCOIRisk(0.10)).toBe("moderate"));
  it("12.5% -> high (limiar do sistema)", () => expect(classifyCOIRisk(0.125)).toBe("high"));
  it("25% -> high", () => expect(classifyCOIRisk(0.25)).toBe("high"));
  it("50% -> high", () => expect(classifyCOIRisk(0.5)).toBe("high"));
});
