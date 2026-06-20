/**
 * colorGenetics.ts
 *
 * Motor de cálculo genético de cores para canários.
 * Implementa cruzamentos mendelianos para:
 *   - Mutações ligadas ao sexo (ágata, canela, ino, acetinado, asas cinza)
 *   - Mutações autossômicas recessivas (pastel, opalino)
 *   - Mutações autossômicas dominantes (crista, branco dominante, plumagem)
 *
 * Sistema sexual dos canários: ZZ (macho) / ZW (fêmea)
 *   - Macho pode ser portador de mutações ligadas ao sexo
 *   - Fêmea NUNCA é portadora silenciosa — se tem o gene, manifesta
 *
 * Regras de herança:
 *   Autossômica dominante: 0 cópias = não visual, 1 = visual, 2 = visual (ou letal se configurado)
 *   Autossômica recessiva: 0 = normal, 1 = portador, 2 = visual
 *   Ligada ao sexo recessiva: macho ZZ pode ser portador, fêmea ZW manifesta com 1 cópia
 */

// ============================================================================
// Tipos
// ============================================================================

export type ZygosityAR = "NN" | "Nm" | "mm"; // autossômica recessiva
export type ZygosityMaleSL = "Z+Z+" | "Z+Z-" | "Z-Z-"; // ligada ao sexo — macho
export type ZygosityFemaleSL = "Z+W" | "Z-W"; // ligada ao sexo — fêmea
export type ZygosityDom = "nn" | "Nn" | "NN"; // autossômica dominante

export type ParentGenotypes = {
  sex: "macho" | "fêmea";
  // Ligadas ao sexo
  agata?: ZygosityMaleSL | ZygosityFemaleSL;
  canela?: ZygosityMaleSL | ZygosityFemaleSL;
  ino?: ZygosityMaleSL | ZygosityFemaleSL;
  acetinado?: ZygosityMaleSL | ZygosityFemaleSL;
  asasCinza?: ZygosityMaleSL | ZygosityFemaleSL;
  // Autossômicas recessivas
  pastel?: ZygosityAR;
  opala?: ZygosityAR;
  brancorecessivo?: ZygosityAR;
  // Autossômicas dominantes
  crista?: ZygosityDom;
  brancoDominante?: ZygosityDom;
  plumagem?: ZygosityDom;
};

export type OffspringDistribution = {
  genotype: string;
  probability: number;
  isVisual: boolean;
  isCarrier: boolean;
  isLethal: boolean;
  sex?: "macho" | "fêmea";
};

export type MutationCrossResult = {
  mutationId: string;
  inheritance: "sex_linked" | "autosomal_recessive" | "autosomal_dominant";
  sons?: Record<string, number>;
  daughters?: Record<string, number>;
  offspring?: Record<string, number>;
  warnings: string[];
};

export type ColorCrossResult = {
  byMutation: Record<string, MutationCrossResult>;
  warnings: string[];
  summary: string;
};

// ============================================================================
// Cruzamento ligado ao sexo
// ============================================================================

function sexLinkedCross(
  fatherGeno: ZygosityMaleSL,
  motherGeno: ZygosityFemaleSL
): { sons: Record<string, number>; daughters: Record<string, number> } {
  // Alelos do pai (ZZ): Z+Z+, Z+Z-, Z-Z-
  const fatherAlleles: [string, string] =
    fatherGeno === "Z+Z+"
      ? ["+", "+"]
      : fatherGeno === "Z+Z-"
      ? ["+", "-"]
      : ["-", "-"];

  // Alelo da mãe (ZW): Z+W ou Z-W
  const motherZ = motherGeno === "Z+W" ? "+" : "-";

  const sons: Record<string, number> = {};
  const daughters: Record<string, number> = {};

  for (const fa of fatherAlleles) {
    // Filho (ZZ): recebe Z do pai + Z da mãe
    const sonKey = fa === "+" && motherZ === "+"
      ? "Z+Z+"
      : fa === "+" && motherZ === "-"
      ? "Z+Z-"
      : fa === "-" && motherZ === "+"
      ? "Z+Z-"
      : "Z-Z-";
    sons[sonKey] = (sons[sonKey] ?? 0) + 0.25;

    // Filha (ZW): recebe Z do pai + W da mãe
    const daughterKey = fa === "+" ? "Z+W" : "Z-W";
    daughters[daughterKey] = (daughters[daughterKey] ?? 0) + 0.25;
  }

  return { sons, daughters };
}

// ============================================================================
// Cruzamento autossômico recessivo
// ============================================================================

function autosomalRecessiveCross(
  father: ZygosityAR,
  mother: ZygosityAR
): Record<string, number> {
  const fAlleles: [string, string] =
    father === "mm" ? ["m", "m"] : father === "Nm" ? ["N", "m"] : ["N", "N"];
  const mAlleles: [string, string] =
    mother === "mm" ? ["m", "m"] : mother === "Nm" ? ["N", "m"] : ["N", "N"];

  const result: Record<string, number> = {};
  for (const fa of fAlleles) {
    for (const ma of mAlleles) {
      const alleles = [fa, ma].sort().join("");
      const key: ZygosityAR = alleles === "mm" ? "mm" : alleles === "Nm" || alleles === "mN" ? "Nm" : "NN";
      result[key] = (result[key] ?? 0) + 0.25;
    }
  }
  return result;
}

// ============================================================================
// Cruzamento autossômico dominante
// ============================================================================

function autosomalDominantCross(
  father: ZygosityDom,
  mother: ZygosityDom
): Record<string, number> {
  const fAlleles: [string, string] =
    father === "NN" ? ["N", "N"] : father === "Nn" ? ["N", "n"] : ["n", "n"];
  const mAlleles: [string, string] =
    mother === "NN" ? ["N", "N"] : mother === "Nn" ? ["N", "n"] : ["n", "n"];

  const result: Record<string, number> = {};
  for (const fa of fAlleles) {
    for (const ma of mAlleles) {
      const alleles = [fa, ma].sort().reverse().join(""); // NN > Nn > nn
      const key: ZygosityDom = alleles === "NN" ? "NN" : alleles === "Nn" || alleles === "nN" ? "Nn" : "nn";
      result[key] = (result[key] ?? 0) + 0.25;
    }
  }
  return result;
}

// ============================================================================
// Configuração das mutações
// ============================================================================

const MUTATION_CONFIG: Record<
  string,
  {
    label: string;
    inheritance: "sex_linked" | "autosomal_recessive" | "autosomal_dominant";
    isLethalHomozygous?: boolean; // para dominantes com homozigose letal
    warningHomozygous?: string;
  }
> = {
  agata: {
    label: "Ágata",
    inheritance: "sex_linked",
  },
  canela: {
    label: "Canela",
    inheritance: "sex_linked",
  },
  ino: {
    label: "Ino (Lutino/Albino/Rubino)",
    inheritance: "sex_linked",
  },
  acetinado: {
    label: "Acetinado",
    inheritance: "sex_linked",
  },
  asasCinza: {
    label: "Asas Cinza",
    inheritance: "sex_linked",
  },
  pastel: {
    label: "Pastel",
    inheritance: "autosomal_recessive",
  },
  opala: {
    label: "Opalino",
    inheritance: "autosomal_recessive",
  },
  brancorecessivo: {
    label: "Branco Recessivo",
    inheritance: "autosomal_recessive",
  },
  crista: {
    label: "Crista/Topete",
    inheritance: "autosomal_dominant",
    isLethalHomozygous: true,
    warningHomozygous:
      "Topetado × topetado: ~25% dos filhotes serão homozigotos (NN) — não viáveis ou fortemente indesejáveis. Cruzar sempre topetado × sem topete.",
  },
  brancoDominante: {
    label: "Branco Dominante",
    inheritance: "autosomal_dominant",
    isLethalHomozygous: true,
    warningHomozygous:
      "Branco Dominante × Branco Dominante: ~25% dos filhotes serão homozigotos (NN) — embriões não viáveis. Nunca cruzar dois Brancos Dominantes.",
  },
  plumagem: {
    label: "Plumagem (Nevado)",
    inheritance: "autosomal_dominant",
    warningHomozygous:
      "Nevado × Nevado: risco de excesso de plumagem nos filhotes homozigotos — evitar este cruzamento.",
  },
};

// ============================================================================
// Função principal
// ============================================================================

export function calculateColorCross(input: {
  male: ParentGenotypes;
  female: ParentGenotypes;
}): ColorCrossResult {
  const { male, female } = input;

  if (male.sex !== "macho") {
    throw new Error("O primeiro parâmetro deve ser o macho (sex: 'macho').");
  }
  if (female.sex !== "fêmea") {
    throw new Error("O segundo parâmetro deve ser a fêmea (sex: 'fêmea').");
  }

  const byMutation: Record<string, MutationCrossResult> = {};
  const globalWarnings: string[] = [];

  for (const [mutId, config] of Object.entries(MUTATION_CONFIG)) {
    const maleGeno = (male as any)[mutId];
    const femaleGeno = (female as any)[mutId];

    // Pula se nenhum dos dois tem o gene informado
    if (!maleGeno && !femaleGeno) continue;

    const mutResult: MutationCrossResult = {
      mutationId: mutId,
      inheritance: config.inheritance,
      warnings: [],
    };

    if (config.inheritance === "sex_linked") {
      // Valida que o macho tem genótipo ZZ e a fêmea ZW
      const mGeno = (maleGeno ?? "Z-Z-") as ZygosityMaleSL;
      const fGeno = (femaleGeno ?? "Z-W") as ZygosityFemaleSL;

      if (!["Z+Z+", "Z+Z-", "Z-Z-"].includes(mGeno)) {
        mutResult.warnings.push(
          `Genótipo de macho inválido para ${config.label}: "${mGeno}". Use Z+Z+, Z+Z- ou Z-Z-.`
        );
        continue;
      }
      if (!["Z+W", "Z-W"].includes(fGeno)) {
        mutResult.warnings.push(
          `Genótipo de fêmea inválido para ${config.label}: "${fGeno}". Use Z+W ou Z-W.`
        );
        continue;
      }

      const { sons, daughters } = sexLinkedCross(mGeno, fGeno);
      mutResult.sons = sons;
      mutResult.daughters = daughters;
    } else if (config.inheritance === "autosomal_recessive") {
      const mGeno = (maleGeno ?? "NN") as ZygosityAR;
      const fGeno = (femaleGeno ?? "NN") as ZygosityAR;
      mutResult.offspring = autosomalRecessiveCross(mGeno, fGeno);
    } else {
      // autosomal_dominant
      const mGeno = (maleGeno ?? "nn") as ZygosityDom;
      const fGeno = (femaleGeno ?? "nn") as ZygosityDom;
      mutResult.offspring = autosomalDominantCross(mGeno, fGeno);

      // Aviso de homozigose letal
      if (config.isLethalHomozygous && (mutResult.offspring["NN"] ?? 0) > 0) {
        const pct = Math.round((mutResult.offspring["NN"] ?? 0) * 100);
        mutResult.warnings.push(
          config.warningHomozygous ??
            `${pct}% dos filhotes serão homozigotos — risco de não viabilidade.`
        );
        globalWarnings.push(mutResult.warnings[mutResult.warnings.length - 1]);
      } else if (config.warningHomozygous && (mutResult.offspring["NN"] ?? 0) > 0) {
        mutResult.warnings.push(config.warningHomozygous);
      }
    }

    byMutation[mutId] = mutResult;
  }

  // Resumo em texto
  const mutationCount = Object.keys(byMutation).length;
  let summary = "";
  if (mutationCount === 0) {
    summary =
      "Nenhuma mutação foi informada para este cruzamento. Configure os genótipos do macho e da fêmea para ver as probabilidades.";
  } else {
    const parts: string[] = [];
    for (const [mutId, res] of Object.entries(byMutation)) {
      const config = MUTATION_CONFIG[mutId];
      if (!config) continue;

      if (res.sons && res.daughters) {
        const visualSons = Object.entries(res.sons)
          .filter(([g]) => g === "Z+Z+" || g === "Z+Z-")
          .reduce((acc, [, p]) => acc + p, 0);
        const visualDaughters = Object.entries(res.daughters)
          .filter(([g]) => g === "Z+W")
          .reduce((acc, [, p]) => acc + p, 0);
        parts.push(
          `${config.label}: ${Math.round(visualSons * 100)}% dos filhos machos visuais, ${Math.round(visualDaughters * 100)}% das filhas fêmeas visuais.`
        );
      } else if (res.offspring) {
        if (config.inheritance === "autosomal_recessive") {
          const visual = (res.offspring["mm"] ?? 0) * 100;
          const carrier = (res.offspring["Nm"] ?? 0) * 100;
          parts.push(
            `${config.label}: ${Math.round(visual)}% visuais, ${Math.round(carrier)}% portadores.`
          );
        } else {
          const visual = ((res.offspring["Nn"] ?? 0) + (res.offspring["NN"] ?? 0)) * 100;
          parts.push(`${config.label}: ${Math.round(visual)}% visuais.`);
        }
      }
    }
    summary = parts.join(" | ");
  }

  return { byMutation, warnings: globalWarnings, summary };
}
