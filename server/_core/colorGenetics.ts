/**
 * colorGenetics.ts — Motor Genético Completo de Canários
 * ============================================================================
 *
 * Implementa Punnett square para TODOS os tipos de herança em canários:
 *
 *   Sistema sexual: ZZ (macho) / ZW (fêmea)
 *   — Macho ZZ pode ser portador de mutações ligadas ao sexo
 *   — Fêmea ZW NUNCA é portadora silenciosa: ou manifesta ou não tem o gene
 *
 * MUTAÇÕES LIGADAS AO SEXO (cromossomo Z):
 *   ágata, canela, ino (lutino/albino/rubino), marfim (ivory),
 *   acetinado (satin), asas cinza (greywing), opalino, topázio*
 *   *tópázio = ino + opalino (ligados ao sexo, compound)
 *
 * MUTAÇÕES AUTOSSÔMICAS RECESSIVAS:
 *   pastel, opalino-autossômico*, branco recessivo, ônix, cobalto,
 *   jaspe, feo, asas brancas, urucum (rubino não-ino)
 *
 * MUTAÇÕES AUTOSSÔMICAS DOMINANTES:
 *   crista/topete, branco dominante, plumagem (nevado/double buffing)
 *
 * CASOS ESPECIAIS / COMPOSTOS:
 *   isabelino  = ágata + canela (dois genes ligados ao sexo simultâneos)
 *   tópázio    = ino + opalino (dois genes ligados ao sexo)
 *   lutino     = ino sobre amarelo
 *   rubino     = ino sobre vermelho (fator vermelho separado)
 *   albino     = ino sobre branco recessivo
 *
 * ============================================================================
 * Fonte: Padrões FOB (Federação Ornitológica do Brasil) / OBJO, e literatura
 * de genética de canários (Krista Koppens, Walker, Vriends).
 * ============================================================================
 */

// ============================================================================
// Tipos base
// ============================================================================

export type ZygosityAR   = "NN" | "Nm" | "mm";          // autossômica recessiva
export type ZygosityMaleSL  = "Z+Z+" | "Z+Z-" | "Z-Z-"; // ligada ao sexo — macho
export type ZygosityFemaleSL = "Z+W" | "Z-W";            // ligada ao sexo — fêmea
export type ZygosityDom  = "nn" | "Nn" | "NN";           // autossômica dominante

export type ParentGenotypes = {
  sex: "macho" | "fêmea";
  // ── Ligadas ao sexo ──────────────────────────────────────────────────────
  agata?:     ZygosityMaleSL | ZygosityFemaleSL;
  canela?:    ZygosityMaleSL | ZygosityFemaleSL;
  ino?:       ZygosityMaleSL | ZygosityFemaleSL;
  marfim?:    ZygosityMaleSL | ZygosityFemaleSL; // ivory — dilui lipocromo
  acetinado?: ZygosityMaleSL | ZygosityFemaleSL; // satin
  asasCinza?: ZygosityMaleSL | ZygosityFemaleSL; // greywing
  opalino?:   ZygosityMaleSL | ZygosityFemaleSL; // sex-linked opalino (= opal)
  // ── Autossômicas recessivas ────────────────────────────────────────────
  pastel?:          ZygosityAR;
  opala?:           ZygosityAR; // alias para pastel-opalino (autossômico em alguns países)
  brancorecessivo?: ZygosityAR; // recessive white
  onix?:            ZygosityAR; // onyx
  cobalto?:         ZygosityAR; // cobalt
  jaspe?:           ZygosityAR;
  feo?:             ZygosityAR; // pheomelanism reducer
  asasBrancas?:     ZygosityAR; // white wings
  // ── Autossômicas dominantes ────────────────────────────────────────────
  crista?:         ZygosityDom; // crest — letal homozigoto
  brancoDominante?: ZygosityDom; // dominant white — semi-letal homozigoto
  plumagem?:       ZygosityDom; // buffing (nevado) — double buffing warning
};

export type OffspringGroup = {
  genotype: string;
  probability: number;   // 0.0 – 1.0
  isVisual: boolean;
  isCarrier: boolean;
  isLethal: boolean;
  sex?: "macho" | "fêmea";
  phenotypeLabel?: string; // nome em PT-BR do fenótipo
};

export type MutationCrossResult = {
  mutationId:   string;
  label:        string;
  inheritance:  "sex_linked" | "autosomal_recessive" | "autosomal_dominant";
  inheritanceLabel: string;
  // Para sex-linked: resultado separado por sexo do filhote
  sons?:       Record<string, number>;
  daughters?:  Record<string, number>;
  // Para autossômico: resultado único
  offspring?:  Record<string, number>;
  warnings:    string[];
  explanation: string; // texto em PT-BR para o criador leigo
};

export type ColorCrossResult = {
  byMutation: Record<string, MutationCrossResult>;
  warnings:   string[];
  summary:    string;
  // Diagnóstico adicional por tipo de herança
  phenotypeSummary: PhenotypeSummary;
  recommendations: string[];
};

export type PhenotypeSummary = {
  expectedPhenotypes: PhenotypeGroup[];
  dominantWarnings:   string[];
  lethalFraction:     number;
  geneticDiversity:   "high" | "medium" | "low";
};

export type PhenotypeGroup = {
  description:  string;
  probability:  number;
  sex?:         "macho" | "fêmea" | "ambos";
  isVisual:     boolean;
  isCarrier:    boolean;
};

// ============================================================================
// MUTATION_CONFIG — catálogo completo
// ============================================================================

interface MutationConfig {
  label:               string;
  labelEn:             string;
  inheritance:         "sex_linked" | "autosomal_recessive" | "autosomal_dominant";
  inheritanceLabel:    string;
  isLethalHomozygous?: boolean;
  warningHomozygous?:  string;
  warningCarrier?:     string;
  description:         string;
  phenotypeEffect:     string;  // o que o gene faz visualmente
}

export const MUTATION_CONFIG: Record<string, MutationConfig> = {
  // ── Ligadas ao sexo ────────────────────────────────────────────────────────
  agata: {
    label: "Ágata",
    labelEn: "Agate",
    inheritance: "sex_linked",
    inheritanceLabel: "ligada ao sexo (cromossomo Z)",
    description: "Reduz e redistribui a eumelanina, criando um padrão de listras finas. Fêmeas com o gene manifestam (nunca portadoras silenciosas).",
    phenotypeEffect: "Dilui melanina negra → tons cinza-acastanhados com listras finas",
  },
  canela: {
    label: "Canela",
    labelEn: "Cinnamon",
    inheritance: "sex_linked",
    inheritanceLabel: "ligada ao sexo (cromossomo Z)",
    description: "Substitui eumelanina negra por melanina marrom-avermelhada (feomelanina). Olhos vermelhos ao nascer.",
    phenotypeEffect: "Melanina negra → marrom-canela; olhos vermelho-vinho",
  },
  ino: {
    label: "Ino (Lutino / Albino / Rubino)",
    labelEn: "Ino",
    inheritance: "sex_linked",
    inheritanceLabel: "ligada ao sexo (cromossomo Z)",
    description: "Elimina completamente a eumelanina. Sobre amarelo = lutino (olhos vermelhos). Sobre vermelho = rubino. Sobre branco recessivo = albino.",
    phenotypeEffect: "Ausência total de eumelanina; plumagem inteiramente lipocrômica",
  },
  marfim: {
    label: "Marfim (Ivory)",
    labelEn: "Ivory",
    inheritance: "sex_linked",
    inheritanceLabel: "ligada ao sexo (cromossomo Z)",
    description: "Dilui o lipocromo: amarelo → marfim claro, vermelho → salmão/rosê. Não afeta a melanina. Machos podem ser portadores.",
    phenotypeEffect: "Diluição do lipocromo: amarelo→marfim, vermelho→salmão",
  },
  acetinado: {
    label: "Acetinado (Satin)",
    labelEn: "Satin",
    inheritance: "sex_linked",
    inheritanceLabel: "ligada ao sexo (cromossomo Z)",
    description: "Altera a estrutura da pluma produzindo reflexo acetinado/sedoso. Afeta especialmente a melanina.",
    phenotypeEffect: "Brilho acetinado nas penas; melanina com aspecto sedoso",
  },
  asasCinza: {
    label: "Asas Cinza (Greywing)",
    labelEn: "Greywing",
    inheritance: "sex_linked",
    inheritanceLabel: "ligada ao sexo (cromossomo Z)",
    description: "Dilui a melanina nas rêmiges (penas de voo) deixando-as cinza-claras em vez de negras.",
    phenotypeEffect: "Rêmiges cinza em vez de negras; resto do padrão mantido",
  },
  opalino: {
    label: "Opalino",
    labelEn: "Opaline",
    inheritance: "sex_linked",
    inheritanceLabel: "ligada ao sexo (cromossomo Z)",
    description: "Redistribui a melanina criando um padrão 'suave' e expandindo a área lipocrômica. Fêmea sempre manifesta.",
    phenotypeEffect: "Padrão opaco; lipocromo expande-se para o manto",
  },
  // ── Autossômicas recessivas ────────────────────────────────────────────────
  pastel: {
    label: "Pastel",
    labelEn: "Pastel",
    inheritance: "autosomal_recessive",
    inheritanceLabel: "autossômica recessiva",
    description: "Reduz parcialmente a eumelanina produzindo tons pastel. Portadores (Nm) parecem normais mas transmitem o gene.",
    phenotypeEffect: "Eumelanina parcialmente diluída → tons acinzentados pastel",
  },
  opala: {
    label: "Opalino Autossômico",
    labelEn: "Autosomal Opaline",
    inheritance: "autosomal_recessive",
    inheritanceLabel: "autossômica recessiva",
    description: "Variante autossômica do opalino, presente em algumas linhagens. Ambos os sexos podem ser portadores.",
    phenotypeEffect: "Padrão opalo com redistribuição de melanina",
  },
  brancorecessivo: {
    label: "Branco Recessivo",
    labelEn: "Recessive White",
    inheritance: "autosomal_recessive",
    inheritanceLabel: "autossômica recessiva",
    description: "Suprime a expressão do lipocromo. Visual (mm) = branco ou levemente amarelado. Portadores (Nm) têm aparência normal.",
    phenotypeEffect: "Inibe lipocromo → branco/creme; eumelanina não afetada",
  },
  onix: {
    label: "Ônix (Onyx)",
    labelEn: "Onyx",
    inheritance: "autosomal_recessive",
    inheritanceLabel: "autossômica recessiva",
    description: "Intensifica a melanina negra e aumenta a extensão de pigmento melânico.",
    phenotypeEffect: "Melanismo intensificado; mais cobertura melânica",
  },
  cobalto: {
    label: "Cobalto (Cobalt)",
    labelEn: "Cobalt",
    inheritance: "autosomal_recessive",
    inheritanceLabel: "autossômica recessiva",
    description: "Mutação da família do negro que altera a deposição de eumelanina, criando tons azul-acinzentados.",
    phenotypeEffect: "Tonalidade azul-acinzentada na melanina",
  },
  jaspe: {
    label: "Jaspe",
    labelEn: "Jaspe",
    inheritance: "autosomal_recessive",
    inheritanceLabel: "autossômica recessiva",
    description: "Reduz fortemente a eumelanina, similar ao pastel mas mais intenso, com aspecto jaspeado.",
    phenotypeEffect: "Eumelanina muito diluída com aspecto jaspeado",
  },
  feo: {
    label: "Feo (Pheomelânico)",
    labelEn: "Feo / Pheo",
    inheritance: "autosomal_recessive",
    inheritanceLabel: "autossômica recessiva",
    description: "Reduz a feomelanina (pigmento marrom-amarelado), produzindo plumas mais claras na área melânica.",
    phenotypeEffect: "Feomelanina reduzida → tons mais claros na área melânica",
  },
  asasBrancas: {
    label: "Asas Brancas (White Wings)",
    labelEn: "White Wings",
    inheritance: "autosomal_recessive",
    inheritanceLabel: "autossômica recessiva",
    description: "Elimina a melanina especificamente nas rêmiges, produzindo asas brancas em pássaros melânicos.",
    phenotypeEffect: "Rêmiges brancas; melanina corporal mantida",
  },
  // ── Autossômicas dominantes ────────────────────────────────────────────────
  crista: {
    label: "Crista / Topete",
    labelEn: "Crest",
    inheritance: "autosomal_dominant",
    inheritanceLabel: "autossômica dominante (letal em dose dupla)",
    isLethalHomozygous: true,
    warningHomozygous: "⚠️ CRISTA × CRISTA: ~25% dos embriões são inviáveis (homozigoto NN letal). Dos filhotes que sobrevivem, ~2/3 terão crista (Nn) e ~1/3 será cabeça lisa (nn). NUNCA cruzar dois topetados.",
    description: "Gene dominante que produz topete. Heterozigoto (Nn) = topetado viável. Homozigoto (NN) = letal.",
    phenotypeEffect: "Penas da cabeça giradas formando topete/corona",
  },
  brancoDominante: {
    label: "Branco Dominante",
    labelEn: "Dominant White",
    inheritance: "autosomal_dominant",
    inheritanceLabel: "autossômica dominante (semi-letal em dose dupla)",
    isLethalHomozygous: true,
    warningHomozygous: "⚠️ BRANCO DOMINANTE × BRANCO DOMINANTE: ~25% dos filhotes homozigotos (NN) são semi-letais. NUNCA cruzar dois portadores de branco dominante.",
    description: "Inibe expressão do lipocromo (dominante). Heterozigoto (Nn) = branco ou levemente tingido. Homozigoto (NN) = letal/semi-letal.",
    phenotypeEffect: "Inibe lipocromo → plumagem branca ou levemente tingida",
  },
  plumagem: {
    label: "Plumagem (Nevado / Double Buffing)",
    labelEn: "Buffing",
    inheritance: "autosomal_dominant",
    inheritanceLabel: "autossômica dominante",
    warningHomozygous: "⚠️ NEVADO × NEVADO (Double Buffing): ~25% dos filhotes terão plumas excessivamente macias, associadas a problemas de saúde. Prefira intenso × nevado.",
    description: "Controla o tipo de pluma: nevado (buffed) vs intenso. Homozigoto nevado = double buffing.",
    phenotypeEffect: "Tipo de pluma: nevado (bordas claras/macias) vs intenso (saturado)",
  },
};

// ============================================================================
// Engines de cruzamento
// ============================================================================

function sexLinkedCross(
  fatherGeno: ZygosityMaleSL,
  motherGeno: ZygosityFemaleSL
): { sons: Record<string, number>; daughters: Record<string, number> } {
  const fatherAlleles: [string, string] =
    fatherGeno === "Z+Z+" ? ["+", "+"]
    : fatherGeno === "Z+Z-" ? ["+", "-"]
    : ["-", "-"];

  const motherZ = motherGeno === "Z+W" ? "+" : "-";

  const sons: Record<string, number> = {};
  const daughters: Record<string, number> = {};

  for (const fa of fatherAlleles) {
    // Filho ZZ: recebe Z do pai + Z da mãe
    const sonKey = fa === "+" && motherZ === "+" ? "Z+Z+"
      : (fa === "+" && motherZ === "-") || (fa === "-" && motherZ === "+") ? "Z+Z-"
      : "Z-Z-";
    sons[sonKey] = (sons[sonKey] ?? 0) + 0.25;

    // Filha ZW: recebe Z do pai + W da mãe
    const daughterKey = fa === "+" ? "Z+W" : "Z-W";
    daughters[daughterKey] = (daughters[daughterKey] ?? 0) + 0.25;
  }

  return { sons, daughters };
}

function autosomalRecessiveCross(father: ZygosityAR, mother: ZygosityAR): Record<string, number> {
  const fA: [string, string] = father === "NN" ? ["N","N"] : father === "Nm" ? ["N","m"] : ["m","m"];
  const mA: [string, string] = mother === "NN" ? ["N","N"] : mother === "Nm" ? ["N","m"] : ["m","m"];
  const out: Record<string, number> = {};
  for (const fa of fA) {
    for (const ma of mA) {
      const key = fa === "m" && ma === "m" ? "mm"
        : (fa === "N" && ma === "m") || (fa === "m" && ma === "N") ? "Nm"
        : "NN";
      out[key] = (out[key] ?? 0) + 0.25;
    }
  }
  return out;
}

function autosomalDominantCross(father: ZygosityDom, mother: ZygosityDom): Record<string, number> {
  const fA: [string, string] = father === "nn" ? ["n","n"] : father === "Nn" ? ["N","n"] : ["N","N"];
  const mA: [string, string] = mother === "nn" ? ["n","n"] : mother === "Nn" ? ["N","n"] : ["N","N"];
  const out: Record<string, number> = {};
  for (const fa of fA) {
    for (const ma of mA) {
      const key = fa === "N" && ma === "N" ? "NN"
        : fa === "N" || ma === "N" ? "Nn"
        : "nn";
      out[key] = (out[key] ?? 0) + 0.25;
    }
  }
  return out;
}

// ============================================================================
// Helpers de fenótipo
// ============================================================================

function sexLinkedPhenotypeLabel(genotype: string, mutation: string, sex: "macho" | "fêmea"): string {
  const cfg = MUTATION_CONFIG[mutation];
  const lbl = cfg?.label ?? mutation;
  if (sex === "macho") {
    if (genotype === "Z+Z+") return `${lbl}: macho visual homozigoto`;
    if (genotype === "Z+Z-") return `${lbl}: macho portador (heterozigoto)`;
    return `${lbl}: macho normal`;
  }
  if (genotype === "Z+W") return `${lbl}: fêmea visual`;
  return `${lbl}: fêmea normal`;
}

function autosomalRecessivePhenotypeLabel(genotype: string, mutation: string): string {
  const lbl = MUTATION_CONFIG[mutation]?.label ?? mutation;
  if (genotype === "mm") return `${lbl}: visual (homozigoto)`;
  if (genotype === "Nm") return `${lbl}: portador`;
  return `${lbl}: normal`;
}

function autosomalDominantPhenotypeLabel(genotype: string, mutation: string): string {
  const lbl = MUTATION_CONFIG[mutation]?.label ?? mutation;
  if (genotype === "NN") return `${lbl}: visual dose dupla (LETAL)`;
  if (genotype === "Nn") return `${lbl}: visual dose simples`;
  return `${lbl}: não visual`;
}

function buildExplanation(
  mutId: string,
  cfg: MutationConfig,
  result: MutationCrossResult
): string {
  const lines: string[] = [];

  if (cfg.inheritance === "sex_linked") {
    const { sons = {}, daughters = {} } = result;
    const visualSons = Object.entries(sons)
      .filter(([g]) => g === "Z+Z+" || g === "Z+Z-")
      .reduce((a, [, p]) => a + p, 0);
    const carrierSons = (sons["Z+Z-"] ?? 0);
    const visualDaughters = (daughters["Z+W"] ?? 0);

    lines.push(`**${cfg.label}** (${cfg.inheritanceLabel}):`);
    lines.push(`• Filhos machos: ${Math.round(visualSons*100)}% visuais`
      + (carrierSons > 0 ? ` (dos quais ${Math.round(carrierSons / Math.max(visualSons,0.001) * 100)}% serão portadores)` : "")
    );
    lines.push(`• Filhas fêmeas: ${Math.round(visualDaughters*100)}% visuais`);
    lines.push(`  ℹ️ ${cfg.phenotypeEffect}`);
  } else if (cfg.inheritance === "autosomal_recessive") {
    const off = result.offspring ?? {};
    const visual = off["mm"] ?? 0;
    const carrier = off["Nm"] ?? 0;
    const normal = off["NN"] ?? 0;
    lines.push(`**${cfg.label}** (${cfg.inheritanceLabel}):`);
    lines.push(`• ${Math.round(visual*100)}% visuais | ${Math.round(carrier*100)}% portadores | ${Math.round(normal*100)}% normais`);
    lines.push(`  ℹ️ ${cfg.phenotypeEffect}`);
  } else {
    const off = result.offspring ?? {};
    const visual = (off["Nn"] ?? 0) + (off["NN"] ?? 0);
    const lethal = off["NN"] ?? 0;
    const nonVisual = off["nn"] ?? 0;
    lines.push(`**${cfg.label}** (${cfg.inheritanceLabel}):`);
    lines.push(`• ${Math.round(visual*100)}% visuais | ${Math.round(nonVisual*100)}% não visuais`);
    if (lethal > 0) lines.push(`  ⚠️ ${Math.round(lethal*100)}% homozigotos — risco letal`);
    lines.push(`  ℹ️ ${cfg.phenotypeEffect}`);
  }

  return lines.join("\n");
}

// ============================================================================
// Diagnóstico de lipocromo e fenótipos esperados
// ============================================================================

export type LipochromeInput = {
  base: "amarelo" | "vermelho" | "branco_dominante" | "branco_recessivo" | "desconhecido";
  ivoryStatus?: "nenhum" | "portador" | "visual";  // marfim
  featherType?: "intenso" | "nevado";
};

export type LipoExpectedResult = {
  expected: Array<{ phenotype: string; probability: number; notes?: string }>;
  warnings: string[];
};

export function calculateLipochromeCross(
  father: LipochromeInput,
  mother: LipochromeInput
): LipoExpectedResult {
  const expected: Array<{ phenotype: string; probability: number; notes?: string }> = [];
  const warnings: string[] = [];

  // Double-buffing warning
  if (father.featherType === "nevado" && mother.featherType === "nevado") {
    warnings.push("NEVADO × NEVADO: 25% dos filhotes com double-buffing (plumas moles excessivas). Prefira INTENSO × NEVADO.");
  }

  // Intenso × Intenso
  if (father.featherType === "intenso" && mother.featherType === "intenso") {
    warnings.push("INTENSO × INTENSO: pode reduzir fertilidade e vigor. Não recomendado como prática contínua.");
  }

  // Branco dominante
  if (father.base === "branco_dominante" && mother.base === "branco_dominante") {
    warnings.push("BRANCO DOMINANTE × BRANCO DOMINANTE: 25% de embriões homozigotos inviáveis.");
    expected.push({ phenotype: "Branco Dominante visual (Nn)", probability: 0.5 });
    expected.push({ phenotype: "Pássaro colorido (nn)", probability: 0.25 });
    expected.push({ phenotype: "Homozigoto BD (NN) — inviável", probability: 0.25, notes: "Não sobrevive" });
    return { expected, warnings };
  }

  // Base lipocromo
  const lipos = [father.base, mother.base];
  if (lipos.includes("vermelho") && lipos.includes("amarelo")) {
    expected.push({ phenotype: "Vermelho (fator vermelho visível)", probability: 0.5, notes: "Exige pigmentação na alimentação" });
    expected.push({ phenotype: "Amarelo", probability: 0.5 });
    warnings.push("Cruzamento vermelho × amarelo: 50% dos filhotes podem expressar fator vermelho com alimentação adequada.");
  } else if (lipos.every((l) => l === "vermelho")) {
    expected.push({ phenotype: "Vermelho (todos)", probability: 1.0, notes: "Exige pigmentação" });
    warnings.push("Todos fator vermelho — garantir protocolo de pigmentação.");
  } else if (lipos.every((l) => l === "amarelo")) {
    expected.push({ phenotype: "Amarelo (todos)", probability: 1.0 });
  }

  // Marfim (ivory)
  const fatherHasIvory = father.ivoryStatus && father.ivoryStatus !== "nenhum";
  const motherHasIvory = mother.ivoryStatus && mother.ivoryStatus !== "nenhum";
  if (fatherHasIvory || motherHasIvory) {
    warnings.push("Marfim é ligado ao sexo. Macho portador (Z+Z-) → 50% das filhas serão visuais. Fêmea visual (Z+W) → 50% dos filhos serão visuais ou portadores.");
  }

  return { expected, warnings };
}

// ============================================================================
// Função principal — calculateColorCross
// ============================================================================

export function calculateColorCross(input: {
  male: ParentGenotypes;
  female: ParentGenotypes;
}): ColorCrossResult {
  const { male, female } = input;

  if (male.sex !== "macho")  throw new Error("O primeiro parâmetro deve ser o macho (sex: 'macho').");
  if (female.sex !== "fêmea") throw new Error("O segundo parâmetro deve ser a fêmea (sex: 'fêmea').");

  const byMutation: Record<string, MutationCrossResult> = {};
  const globalWarnings: string[] = [];
  const recommendations: string[] = [];
  let lethalFraction = 0;

  // ─── Processar cada mutação ────────────────────────────────────────────────
  for (const [mutId, cfg] of Object.entries(MUTATION_CONFIG)) {
    const maleGeno = (male as any)[mutId];
    const femaleGeno = (female as any)[mutId];

    // Pula se nenhum dos dois tem o gene informado
    if (!maleGeno && !femaleGeno) continue;

    const mutResult: MutationCrossResult = {
      mutationId: mutId,
      label: cfg.label,
      inheritance: cfg.inheritance,
      inheritanceLabel: cfg.inheritanceLabel,
      warnings: [],
      explanation: "",
    };

    if (cfg.inheritance === "sex_linked") {
      const mGeno = (maleGeno ?? "Z-Z-") as ZygosityMaleSL;
      const fGeno = (femaleGeno ?? "Z-W") as ZygosityFemaleSL;

      if (!["Z+Z+", "Z+Z-", "Z-Z-"].includes(mGeno)) {
        mutResult.warnings.push(`Genótipo de macho inválido para ${cfg.label}: "${mGeno}". Use Z+Z+, Z+Z- ou Z-Z-.`);
        continue;
      }
      if (!["Z+W", "Z-W"].includes(fGeno)) {
        mutResult.warnings.push(`Genótipo de fêmea inválido para ${cfg.label}: "${fGeno}". Use Z+W ou Z-W.`);
        continue;
      }

      const { sons, daughters } = sexLinkedCross(mGeno, fGeno);
      mutResult.sons = sons;
      mutResult.daughters = daughters;

    } else if (cfg.inheritance === "autosomal_recessive") {
      const mGeno = (maleGeno ?? "NN") as ZygosityAR;
      const fGeno = (femaleGeno ?? "NN") as ZygosityAR;
      mutResult.offspring = autosomalRecessiveCross(mGeno, fGeno);

    } else {
      // autosomal_dominant
      const mGeno = (maleGeno ?? "nn") as ZygosityDom;
      const fGeno = (femaleGeno ?? "nn") as ZygosityDom;
      mutResult.offspring = autosomalDominantCross(mGeno, fGeno);

      const lethalPct = mutResult.offspring["NN"] ?? 0;
      if (cfg.isLethalHomozygous && lethalPct > 0) {
        lethalFraction = Math.max(lethalFraction, lethalPct);
        const warning = cfg.warningHomozygous ?? `${Math.round(lethalPct*100)}% homozigotos — risco letal.`;
        mutResult.warnings.push(warning);
        globalWarnings.push(warning);
      } else if (cfg.warningHomozygous && (mutResult.offspring["NN"] ?? 0) > 0) {
        mutResult.warnings.push(cfg.warningHomozygous);
      }
    }

    mutResult.explanation = buildExplanation(mutId, cfg, mutResult);
    byMutation[mutId] = mutResult;
  }

  // ─── Avisos especiais compostos ────────────────────────────────────────────

  // Isabelino = ágata + canela simultâneos (ambos ligados ao sexo)
  const maleAgata = male.agata;
  const maleCanela = male.canela;
  const femaleAgata = female.agata;
  const femaleCanela = female.canela;
  if ((maleAgata || femaleAgata) && (maleCanela || femaleCanela)) {
    globalWarnings.push(
      "ISABELINO: quando ágata e canela ocorrem simultaneamente no mesmo pássaro (ambos ZZ+ para ágata E canela), o resultado é o isabelino — melanina fortemente reduzida, plumagem muito clara."
    );
    recommendations.push("Para calcular isabelinos precisamente, considere ambos os genes ligados ao sexo no mesmo pássaro.");
  }

  // Ino + Opalino = Topázio
  if ((male.ino || female.ino) && (male.opalino || female.opalino)) {
    globalWarnings.push(
      "TOPÁZIO: a combinação de ino + opalino (ambos ligados ao sexo) produz o topázio. Calcule cada gene separadamente e combine os resultados."
    );
  }

  // Marfim sobre vermelho = vermelho marfim (diluição)
  if (male.marfim || female.marfim) {
    recommendations.push("Marfim dilui o lipocromo: amarelo→marfim claro, vermelho→salmão/rosê. Filhotes marfim sobre vermelho = vermelho marfim.");
  }

  // Plumagem nevado × nevado
  if (male.plumagem === "Nn" && female.plumagem === "Nn") {
    globalWarnings.push("DOUBLE BUFFING: nevado × nevado gera 25% de pássaros com plumas excessivamente macias. Prefira intenso × nevado.");
  }

  // Branco dominante × branco dominante
  const mBD = male.brancoDominante;
  const fBD = female.brancoDominante;
  if (mBD && mBD !== "nn" && fBD && fBD !== "nn") {
    if (!globalWarnings.some((w) => w.includes("BRANCO DOMINANTE"))) {
      globalWarnings.push("⚠️ BRANCO DOMINANTE × BRANCO DOMINANTE: 25% de embriões homozigotos inviáveis.");
    }
    lethalFraction = Math.max(lethalFraction, 0.25);
  }

  // ─── Recomendações gerais ─────────────────────────────────────────────────
  if (lethalFraction >= 0.25) {
    recommendations.unshift("⚠️ Este cruzamento tem risco de embriões inviáveis. Evite sempre que possível.");
  }
  if (Object.keys(byMutation).length === 0) {
    recommendations.push("Nenhuma mutação foi configurada. Preencha os genótipos para ver as probabilidades completas.");
  }

  // ─── Phenotype summary ────────────────────────────────────────────────────
  const dominantWarnings = globalWarnings.filter((w) => w.includes("LETAL") || w.includes("⚠️"));
  const diversity: "high" | "medium" | "low" =
    Object.keys(byMutation).length >= 3 ? "high"
    : Object.keys(byMutation).length >= 1 ? "medium"
    : "low";

  const phenotypeSummary: PhenotypeSummary = {
    expectedPhenotypes: buildExpectedPhenotypes(byMutation),
    dominantWarnings,
    lethalFraction,
    geneticDiversity: diversity,
  };

  // ─── Summary text ─────────────────────────────────────────────────────────
  const summary = buildSummaryText(byMutation, globalWarnings);

  return { byMutation, warnings: globalWarnings, summary, phenotypeSummary, recommendations };
}

function buildExpectedPhenotypes(byMutation: Record<string, MutationCrossResult>): PhenotypeGroup[] {
  const phenotypes: PhenotypeGroup[] = [];

  for (const [mutId, res] of Object.entries(byMutation)) {
    const cfg = MUTATION_CONFIG[mutId];
    if (!cfg) continue;

    if (res.sons && res.daughters) {
      // Sex-linked: separate by sex
      for (const [geno, prob] of Object.entries(res.sons)) {
        if (prob <= 0) continue;
        phenotypes.push({
          description: sexLinkedPhenotypeLabel(geno, mutId, "macho"),
          probability: prob,
          sex: "macho",
          isVisual: geno === "Z+Z+" || geno === "Z+Z-",
          isCarrier: geno === "Z+Z-",
        });
      }
      for (const [geno, prob] of Object.entries(res.daughters)) {
        if (prob <= 0) continue;
        phenotypes.push({
          description: sexLinkedPhenotypeLabel(geno, mutId, "fêmea"),
          probability: prob,
          sex: "fêmea",
          isVisual: geno === "Z+W",
          isCarrier: false,
        });
      }
    } else if (res.offspring) {
      for (const [geno, prob] of Object.entries(res.offspring)) {
        if (prob <= 0) continue;
        const isVisual = cfg.inheritance === "autosomal_recessive"
          ? geno === "mm"
          : geno === "Nn" || geno === "NN";
        const isCarrier = cfg.inheritance === "autosomal_recessive" ? geno === "Nm" : false;
        phenotypes.push({
          description: cfg.inheritance === "autosomal_recessive"
            ? autosomalRecessivePhenotypeLabel(geno, mutId)
            : autosomalDominantPhenotypeLabel(geno, mutId),
          probability: prob,
          sex: "ambos",
          isVisual,
          isCarrier,
        });
      }
    }
  }

  return phenotypes.filter((p) => p.probability > 0);
}

function buildSummaryText(
  byMutation: Record<string, MutationCrossResult>,
  warnings: string[]
): string {
  const mutCount = Object.keys(byMutation).length;
  if (mutCount === 0) {
    return "Nenhuma mutação configurada. Preencha os genótipos do macho e da fêmea para ver as probabilidades completas.";
  }

  const parts: string[] = [];
  for (const [mutId, res] of Object.entries(byMutation)) {
    const cfg = MUTATION_CONFIG[mutId];
    if (!cfg) continue;

    if (res.sons && res.daughters) {
      const visualSons = Object.entries(res.sons)
        .filter(([g]) => g === "Z+Z+" || g === "Z+Z-")
        .reduce((a, [, p]) => a + p, 0);
      const visualDaughters = (res.daughters["Z+W"] ?? 0);
      parts.push(`${cfg.label}: ${Math.round(visualSons*100)}% filhos machos visuais, ${Math.round(visualDaughters*100)}% filhas visuais`);
    } else if (res.offspring) {
      if (cfg.inheritance === "autosomal_recessive") {
        const visual = Math.round((res.offspring["mm"] ?? 0)*100);
        const carrier = Math.round((res.offspring["Nm"] ?? 0)*100);
        parts.push(`${cfg.label}: ${visual}% visuais, ${carrier}% portadores`);
      } else {
        const visual = Math.round(((res.offspring["Nn"] ?? 0) + (res.offspring["NN"] ?? 0))*100);
        parts.push(`${cfg.label}: ${visual}% visuais`);
      }
    }
  }

  let text = parts.join(" | ");
  if (warnings.length > 0) text += ". ⚠️ " + warnings.slice(0, 2).join("; ");
  return text;
}
