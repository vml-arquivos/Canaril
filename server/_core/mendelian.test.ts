import { describe, it, expect } from "vitest";
import { autosomalCross, sexLinkedCross, manifests, predictCross, BirdGenotypeInput } from "./mendelian";

function close(actual: number | undefined, expected: number) {
  expect(actual ?? 0).toBeCloseTo(expected, 6);
}

describe("mendelian — exemplos exatos do manual de referência", () => {
  // "Macho ágata × fêmea verde: filhotes machos verdes portadores e
  //  filhotes fêmeas ágata."
  it("ágata: macho manifestante × fêmea normal -> filhos 100% portadores, filhas 100% ágata", () => {
    const { sons, daughters } = sexLinkedCross("homozygous_mutant", "homozygous_normal");
    close(sons.heterozygous_carrier, 1.0);
    close(sons.homozygous_mutant, 0);
    close(daughters.homozygous_mutant, 1.0);
    close(daughters.homozygous_normal, 0);
  });

  // "Macho verde portador × fêmea verde: 25% fêmeas ágata, 25% machos
  //  verdes portadores."
  it("ágata: macho portador × fêmea normal -> 25% filhos portadores e 25% filhas ágata (do total)", () => {
    const { sons, daughters } = sexLinkedCross("heterozygous_carrier", "homozygous_normal");
    // sons/daughters já são frações DENTRO de cada sexo (somam 1.0 cada);
    // pra comparar com "% do total de filhotes" multiplicamos por 0.5
    // (cada sexo é metade da ninhada).
    close((sons.heterozygous_carrier ?? 0) * 0.5, 0.25);
    close((daughters.homozygous_mutant ?? 0) * 0.5, 0.25);
  });

  // "Fêmea canela × macho verde: todos os machos serão portadores; todas
  //  as fêmeas serão verdes normais."
  it("canela: fêmea manifestante × macho normal -> 100% dos filhos portadores, 100% das filhas normais", () => {
    const { sons, daughters } = sexLinkedCross("homozygous_normal", "homozygous_mutant");
    close(sons.heterozygous_carrier, 1.0);
    close(daughters.homozygous_normal, 1.0);
    close(daughters.homozygous_mutant, 0);
  });

  // "Macho canela × fêmea verde: filhotes fêmeas canela e machos verdes
  //  portadores" — mesmo padrão do primeiro exemplo de ágata.
  it("canela: macho manifestante × fêmea normal -> filhos 100% portadores, filhas 100% canela", () => {
    const { sons, daughters } = sexLinkedCross("homozygous_mutant", "homozygous_normal");
    close(sons.heterozygous_carrier, 1.0);
    close(daughters.homozygous_mutant, 1.0);
  });
});

describe("mendelian — autossômico (recessivo e dominante)", () => {
  it("recessivo: heterozigoto × heterozigoto -> 25% mutante, 50% portador, 25% normal", () => {
    const result = autosomalCross("heterozygous_carrier", "heterozygous_carrier");
    close(result.homozygous_mutant, 0.25);
    close(result.heterozygous_carrier, 0.5);
    close(result.homozygous_normal, 0.25);
  });

  it("dominante: heterozigoto × normal -> 50% mutante (manifesta), 50% normal", () => {
    const result = autosomalCross("heterozygous_carrier", "homozygous_normal");
    close(result.heterozygous_carrier, 0.5);
    close(result.homozygous_normal, 0.5);
    expect(manifests("heterozygous_carrier", "autosomal_dominant")).toBe(true);
    expect(manifests("heterozygous_carrier", "autosomal_recessive")).toBe(false);
  });
});

describe("mendelian — genes letais e alertas", () => {
  const baseFather: BirdGenotypeInput = { sex: "macho", mutations: [] };
  const baseMother: BirdGenotypeInput = { sex: "fêmea", mutations: [] };

  it("crista × crista gera alerta de 25% de letalidade", () => {
    const result = predictCross({ ...baseFather, hasCrest: true }, { ...baseMother, hasCrest: true });
    const warning = result.warnings.find((w) => w.type === "crista");
    expect(warning).toBeDefined();
    expect(warning?.lethalFraction).toBeCloseTo(0.25);
  });

  it("crista × cabeça lisa NÃO gera alerta", () => {
    const result = predictCross({ ...baseFather, hasCrest: true }, { ...baseMother, hasCrest: false });
    expect(result.warnings.find((w) => w.type === "crista")).toBeUndefined();
  });

  it("branco dominante × branco dominante gera alerta semi-letal", () => {
    const father: BirdGenotypeInput = {
      ...baseFather,
      mutations: [{ mutation: "branco_dominante_mut", inheritance: "autosomal_dominant", zygosity: "heterozygous_carrier" }],
    };
    const mother: BirdGenotypeInput = {
      ...baseMother,
      mutations: [{ mutation: "branco_dominante_mut", inheritance: "autosomal_dominant", zygosity: "heterozygous_carrier" }],
    };
    const result = predictCross(father, mother);
    expect(result.warnings.find((w) => w.type === "branco_dominante")).toBeDefined();
  });

  it("nevado × nevado gera alerta de double buffing", () => {
    const result = predictCross(
      { ...baseFather, featherType: "nevado" },
      { ...baseMother, featherType: "nevado" }
    );
    expect(result.warnings.find((w) => w.type === "double_buffing")).toBeDefined();
  });

  it("intenso × nevado NÃO gera alerta de double buffing", () => {
    const result = predictCross(
      { ...baseFather, featherType: "intenso" },
      { ...baseMother, featherType: "nevado" }
    );
    expect(result.warnings.find((w) => w.type === "double_buffing")).toBeUndefined();
  });

  it("predictCross combina múltiplas mutações em comum corretamente", () => {
    const father: BirdGenotypeInput = {
      sex: "macho",
      hasCrest: false,
      mutations: [
        { mutation: "agata", inheritance: "sex_linked_recessive", zygosity: "homozygous_mutant" },
        { mutation: "opala", inheritance: "autosomal_recessive", zygosity: "heterozygous_carrier" },
      ],
    };
    const mother: BirdGenotypeInput = {
      sex: "fêmea",
      hasCrest: false,
      mutations: [
        { mutation: "agata", inheritance: "sex_linked_recessive", zygosity: "homozygous_normal" },
        { mutation: "opala", inheritance: "autosomal_recessive", zygosity: "heterozygous_carrier" },
      ],
    };
    const result = predictCross(father, mother);
    expect(result.mutations).toHaveLength(2);
    const agataPred = result.mutations.find((m) => m.mutation === "agata")!;
    close(agataPred.daughters?.homozygous_mutant, 1.0);
    const opalaPred = result.mutations.find((m) => m.mutation === "opala")!;
    close(opalaPred.overall?.homozygous_mutant, 0.25);
  });
});
