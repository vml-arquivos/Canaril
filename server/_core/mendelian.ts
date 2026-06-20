/**
 * Motor de Cruzamento Mendeliano — Genética de Canários
 * ============================================================================
 * Implementa as regras descritas no manual de referência:
 *  - Mutações autossômicas dominantes e recessivas (Punnett quadrado padrão).
 *  - Mutações ligadas ao sexo, sistema ZZ (macho) / ZW (fêmea): fêmeas nunca
 *    são "portadoras" de uma mutação ligada ao sexo — ou manifestam, ou não
 *    têm o alelo. Machos podem ser portadores sem manifestar.
 *  - Genes letais/semi-letais em dose dupla (crista, branco dominante):
 *    acasalar dois portadores gera ~25% de embriões que não sobrevivem.
 *  - Alerta de "double buffing" (nevado × nevado).
 *
 * Toda a lógica abaixo foi validada contra os três exemplos numéricos do
 * próprio manual de referência (ágata e canela) — ver mendelian.test.ts.
 * ============================================================================
 */

export type Zygosity = "homozygous_mutant" | "heterozygous_carrier" | "homozygous_normal";
export type InheritanceType = "autosomal_dominant" | "autosomal_recessive" | "sex_linked_recessive";

export type MutationGenotype = {
  mutation: string;
  inheritance: InheritanceType;
  zygosity: Zygosity;
};

export type BirdGenotypeInput = {
  sex: "macho" | "fêmea";
  backgroundColor?: string;
  featherType?: "intenso" | "nevado";
  hasCrest?: boolean;
  mutations: MutationGenotype[];
};

type Allele = "N" | "M"; // Normal | Mutante

function allelesFor(zygosity: Zygosity): [Allele, Allele] {
  switch (zygosity) {
    case "homozygous_mutant":
      return ["M", "M"];
    case "heterozygous_carrier":
      return ["N", "M"];
    case "homozygous_normal":
      return ["N", "N"];
  }
}

function classify(a: Allele, b: Allele): Zygosity {
  if (a === "M" && b === "M") return "homozygous_mutant";
  if (a === "N" && b === "N") return "homozygous_normal";
  return "heterozygous_carrier";
}

export type ZygosityDistribution = Partial<Record<Zygosity, number>>;

/**
 * Cruzamento autossômico padrão (Punnett 2x2) — vale tanto pra dominante
 * quanto recessivo; a diferença entre os dois está em qual zigosidade
 * "manifesta" o fenótipo (ver `manifests` abaixo), não na distribuição em
 * si.
 */
export function autosomalCross(father: Zygosity, mother: Zygosity): ZygosityDistribution {
  const fatherAlleles = allelesFor(father);
  const motherAlleles = allelesFor(mother);
  const outcome: ZygosityDistribution = {};

  for (const fa of fatherAlleles) {
    for (const ma of motherAlleles) {
      const key = classify(fa, ma);
      outcome[key] = (outcome[key] ?? 0) + 0.25;
    }
  }
  return outcome;
}

/**
 * Cruzamento ligado ao sexo (cromossomo Z). Diferente do autossômico
 * porque a herança depende do sexo do filhote:
 *  - Filhos (ZZ): recebem um Z do pai (50/50 entre os dois alelos dele) e
 *    um Z da mãe (ela só tem um Z, sempre o mesmo).
 *  - Filhas (ZW): recebem o W da mãe (sem informação genética nesse
 *    locus) e um Z do pai (50/50) — esse é o ÚNICO Z da filha, então ela
 *    sempre manifesta o que herdar (nunca é "portadora").
 *
 * A mãe nunca pode ser "heterozygous_carrier" num traço ligado ao sexo
 * (só tem um Z) — se vier nesse estado por engano, trata como manifestante.
 */
export function sexLinkedCross(
  father: Zygosity,
  mother: Zygosity
): { sons: ZygosityDistribution; daughters: Partial<Record<"homozygous_mutant" | "homozygous_normal", number>> } {
  const fatherAlleles = allelesFor(father);
  const motherZ: Allele = mother === "homozygous_mutant" ? "M" : mother === "heterozygous_carrier" ? "M" : "N";

  const sons: ZygosityDistribution = {};
  for (const fa of fatherAlleles) {
    const key = classify(fa, motherZ);
    sons[key] = (sons[key] ?? 0) + 0.5;
  }

  const daughters: Partial<Record<"homozygous_mutant" | "homozygous_normal", number>> = {};
  for (const fa of fatherAlleles) {
    const key = fa === "M" ? "homozygous_mutant" : "homozygous_normal";
    daughters[key] = (daughters[key] ?? 0) + 0.5;
  }

  return { sons, daughters };
}

/** O fenótipo (visível) depende da zigosidade E do tipo de herança. */
export function manifests(zygosity: Zygosity, inheritance: InheritanceType): boolean {
  if (zygosity === "homozygous_mutant") return true;
  if (zygosity === "homozygous_normal") return false;
  // heterozygous_carrier: manifesta só se dominante
  return inheritance === "autosomal_dominant";
}

export type MutationPrediction = {
  mutation: string;
  inheritance: InheritanceType;
  // Para autossômico: distribuição única (mesma pra machos e fêmeas).
  // Para ligado ao sexo: distribuição separada por sexo do filhote.
  overall?: ZygosityDistribution;
  sons?: ZygosityDistribution;
  daughters?: Partial<Record<"homozygous_mutant" | "homozygous_normal", number>>;
};

export type LethalWarning = {
  type: "crista" | "branco_dominante" | "double_buffing";
  message: string;
  lethalFraction: number; // fração estimada de ovos/filhotes perdidos
};

export type CrossPrediction = {
  mutations: MutationPrediction[];
  warnings: LethalWarning[];
};

/**
 * Função principal: dado o genótipo do pai e da mãe, calcula a predição
 * completa de cruzamento — distribuição de cada mutação em comum entre os
 * dois, mais os alertas de genes letais e double buffing.
 */
export function predictCross(father: BirdGenotypeInput, mother: BirdGenotypeInput): CrossPrediction {
  const mutations: MutationPrediction[] = [];
  const warnings: LethalWarning[] = [];

  // ----- Mutações em comum (mesmo id em ambos os pais) -----
  const fatherMutationsById = new Map(father.mutations.map((m) => [m.mutation, m]));
  const motherMutationsById = new Map(mother.mutations.map((m) => [m.mutation, m]));
  const allMutationIds = new Set([...Array.from(fatherMutationsById.keys()), ...Array.from(motherMutationsById.keys())]);

  for (const id of Array.from(allMutationIds)) {
    const fatherM = fatherMutationsById.get(id);
    const motherM = motherMutationsById.get(id);
    const inheritance = (fatherM ?? motherM)!.inheritance;
    const fatherZ = fatherM?.zygosity ?? "homozygous_normal";
    const motherZ = motherM?.zygosity ?? "homozygous_normal";

    if (inheritance === "sex_linked_recessive") {
      const { sons, daughters } = sexLinkedCross(fatherZ, motherZ);
      mutations.push({ mutation: id, inheritance, sons, daughters });
    } else {
      const overall = autosomalCross(fatherZ, motherZ);
      mutations.push({ mutation: id, inheritance, overall });
    }
  }

  // ----- Gene letal: crista (autossômica dominante, letal em dose dupla) -----
  if (father.hasCrest && mother.hasCrest) {
    warnings.push({
      type: "crista",
      message:
        "Os dois pais têm crista — esse gene é dominante mas letal em dose dupla. " +
        "Aproximadamente 25% dos ovos não sobrevivem (embriões com duas cópias do gene). " +
        "Dos filhotes que sobrevivem, ~2/3 terão crista e ~1/3 será cabeça lisa.",
      lethalFraction: 0.25,
    });
  }

  // ----- Gene semi-letal: branco dominante -----
  const fatherWhiteDominant = father.mutations.find((m) => m.mutation === "branco_dominante_mut" && m.zygosity !== "homozygous_normal");
  const motherWhiteDominant = mother.mutations.find((m) => m.mutation === "branco_dominante_mut" && m.zygosity !== "homozygous_normal");
  if (fatherWhiteDominant && motherWhiteDominant) {
    warnings.push({
      type: "branco_dominante",
      message:
        "Os dois pais carregam Branco Dominante — a forma homozigótica (dose dupla) é semi-letal. " +
        "Não recomendado: evite cruzar dois portadores/manifestantes de Branco Dominante.",
      lethalFraction: 0.25,
    });
  }

  // ----- Double buffing: nevado × nevado -----
  if (father.featherType === "nevado" && mother.featherType === "nevado") {
    warnings.push({
      type: "double_buffing",
      message:
        "Os dois pais são nevados — ~25% dos filhotes podem nascer com plumagem excessivamente " +
        "macia (\"double buffing\"), associada a problemas de saúde. Prefira cruzar intenso × nevado.",
      lethalFraction: 0.25,
    });
  }

  return { mutations, warnings };
}
