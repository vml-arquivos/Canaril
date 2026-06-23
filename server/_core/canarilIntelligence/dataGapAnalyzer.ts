/**
 * dataGapAnalyzer.ts — Análise de lacunas de dados do pássaro
 */
export type GapSeverity = "critical" | "high" | "medium" | "low";

export interface DataGap {
  field: string;
  label: string;
  severity: GapSeverity;
  impact: string;
  suggestion: string;
}

export interface BirdGapInput {
  fatherId: number | null;
  motherId: number | null;
  officialClassId: number | null;
  hasGenotype: boolean;
  hasProfile: boolean;
  birthDate: Date | string | null;
  sex: string;
  hasPhoto: boolean;
  modality: string | null;
  breedName: string | null;
  colorCode: string | null;
}

export function analyzeBirdGaps(bird: BirdGapInput): DataGap[] {
  const gaps: DataGap[] = [];

  if (!bird.fatherId) gaps.push({
    field: "fatherId",
    label: "Pai não cadastrado",
    severity: "high",
    impact: "Sem pai, o COI não pode ser calculado e o pedigree fica incompleto. O par ideal perde precisão.",
    suggestion: "Cadastre o pássaro pai e vincule-o nesta ficha.",
  });

  if (!bird.motherId) gaps.push({
    field: "motherId",
    label: "Mãe não cadastrada",
    severity: "high",
    impact: "Sem mãe, o COI não pode ser calculado e o pedigree fica incompleto.",
    suggestion: "Cadastre o pássaro mãe e vincule-o nesta ficha.",
  });

  if (!bird.officialClassId) gaps.push({
    field: "officialClassId",
    label: "Classe oficial não informada",
    severity: "medium",
    impact: "Sem classe oficial, o perfil genético não pode ser inferido automaticamente e o juiz virtual não funciona.",
    suggestion: "Pesquise a classe FOB/OBJO e selecione no campo 'Classe Oficial'.",
  });

  if (!bird.hasGenotype && !bird.hasProfile) gaps.push({
    field: "genotype",
    label: "Sem ficha genética",
    severity: "high",
    impact: "Sem genótipo, a calculadora avançada fica inoperante para este pássaro. O par ideal usa pontuação genética zero.",
    suggestion: "Preencha o Genótipo Avançado ou selecione uma Classe Oficial para inferir o perfil automaticamente.",
  });

  if (!bird.birthDate) gaps.push({
    field: "birthDate",
    label: "Data de nascimento desconhecida",
    severity: "medium",
    impact: "Sem data de nascimento, a idade não pode ser calculada e alertas de reprodução ficam imprecisos.",
    suggestion: "Preencha a data de nascimento, mesmo que aproximada.",
  });

  if (!bird.sex || bird.sex === "indeterminado") gaps.push({
    field: "sex",
    label: "Sexo não informado",
    severity: "critical",
    impact: "Sem sexo definido, o pássaro não aparece como candidato em casais e as regras de genes ligados ao sexo não se aplicam.",
    suggestion: "Informe o sexo (macho ou fêmea) na ficha do pássaro.",
  });

  if (!bird.hasPhoto) gaps.push({
    field: "photo",
    label: "Sem foto",
    severity: "low",
    impact: "Sem foto, o reconhecimento por IA não está disponível e a ficha fica menos informativa.",
    suggestion: "Adicione pelo menos uma foto pelo celular.",
  });

  if (!bird.modality) gaps.push({
    field: "modality",
    label: "Modalidade não definida",
    severity: "medium",
    impact: "Sem modalidade (COR/PORTE/CANTO), os campos genéticos e de julgamento não são aplicados corretamente.",
    suggestion: "Selecione a modalidade na ficha.",
  });

  if (!bird.colorCode && bird.modality === "COR") gaps.push({
    field: "colorCode",
    label: "Cor não informada (canário de cor)",
    severity: "medium",
    impact: "Para canários de cor, a cor é informação essencial para genética e julgamento.",
    suggestion: "Selecione a cor/mutação na ficha.",
  });

  // Sort: critical first
  const order: Record<GapSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  gaps.sort((a, b) => order[a.severity] - order[b.severity]);

  return gaps;
}

export function gapSummary(gaps: DataGap[]): { total: number; critical: number; high: number; medium: number; low: number; completenessScore: number } {
  const total = gaps.length;
  const critical = gaps.filter((g) => g.severity === "critical").length;
  const high = gaps.filter((g) => g.severity === "high").length;
  const medium = gaps.filter((g) => g.severity === "medium").length;
  const low = gaps.filter((g) => g.severity === "low").length;
  // 10 possible fields max, each gap subtracts
  const maxFields = 9;
  const score = Math.max(0, Math.round(((maxFields - total) / maxFields) * 100));
  return { total, critical, high, medium, low, completenessScore: score };
}
