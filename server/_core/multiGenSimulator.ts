/**
 * multiGenSimulator.ts — Simulação Genética Multi-Geração (F1 → F2)
 * ============================================================================
 * Responde: "se eu cruzar A×B agora, e na próxima temporada cruzar um dos
 * filhotes (F1) com C, o que eu chego na F2?"
 *
 * 100% aditivo — reaproveita `calculateColorCross` (colorGenetics.ts, já
 * testado) DUAS VEZES em sequência, sem duplicar nenhuma regra de herança:
 *   1ª chamada: A×B → distribuição de genótipos possíveis do F1
 *   2ª chamada, uma vez por genótipo F1 possível: F1×C → resultado
 *   F2 final = soma ponderada pelas probabilidades de cada F1 possível
 *
 * Limitação deliberada: simula UMA mutação por vez (a mesma simplificação
 * de "genes independentes" já usada em calculateColorCross para múltiplas
 * mutações simultâneas — aqui replicada geração a geração, não generalizada
 * para várias mutações ao mesmo tempo, para manter o resultado auditável).
 * ============================================================================
 */
import { calculateColorCross, ParentGenotypes, OffspringGroup } from "./colorGenetics";

export interface F2SimulationInput {
  grandparentA: ParentGenotypes; // pai ou mãe da geração F1 (sexo oposto ao de grandparentB)
  grandparentB: ParentGenotypes;
  mateC: ParentGenotypes;        // cruzado com o F1 resultante (sexo oposto ao F1)
  mutationId: keyof ParentGenotypes & string;
}

export interface F2Outcome {
  genotype: string;
  sex?: "macho" | "fêmea";
  probability: number; // 0–1, já ponderada pelas duas gerações
  phenotypeLabel?: string;
  isVisual: boolean;
  isCarrier: boolean;
  viaF1Genotypes: string[]; // quais genótipos F1 diferentes levam a este resultado (transparência)
}

export interface F2SimulationResult {
  mutationId: string;
  mutationLabel: string;
  f1Distribution: OffspringGroup[]; // geração intermediária, para o criador conferir o caminho
  f1SexUsed: "macho" | "fêmea";     // sexo assumido para o F1 (sempre oposto ao de mateC)
  f2Outcomes: F2Outcome[];
  warnings: string[];
}

/**
 * Extrai só o campo da mutação pedida de um ParentGenotypes — evita que
 * outros campos preenchidos em A/B/C "vazem" pra dentro do cruzamento
 * hipotético do F1 (que só existe pra essa mutação específica).
 */
function isolateMutation(source: ParentGenotypes, mutationId: string): ParentGenotypes {
  return { sex: source.sex, [mutationId]: (source as any)[mutationId] } as ParentGenotypes;
}

export function simulateF2Cross(input: F2SimulationInput): F2SimulationResult {
  const { grandparentA, grandparentB, mateC, mutationId } = input;
  const warnings: string[] = [];

  // 1ª geração: A × B
  const crossAB = calculateColorCross({
    male: isolateMutation(grandparentA.sex === "macho" ? grandparentA : grandparentB, mutationId),
    female: isolateMutation(grandparentA.sex === "fêmea" ? grandparentA : grandparentB, mutationId),
  });
  const mutationResult = crossAB.byMutation[mutationId];
  if (!mutationResult) {
    return {
      mutationId, mutationLabel: mutationId,
      f1Distribution: [], f1SexUsed: mateC.sex === "macho" ? "fêmea" : "macho",
      f2Outcomes: [],
      warnings: [`Não foi possível calcular a mutação "${mutationId}" — confira se A e B têm essa mutação preenchida.`],
    };
  }

  // O F1 precisa ser do sexo OPOSTO a C pra formar um casal válido na 2ª
  // cruza. Para mutação ligada ao sexo, a distribuição de genótipos difere
  // entre filhos e filhas — por isso usamos sons/daughters especificamente,
  // não uma mistura dos dois.
  const f1SexUsed: "macho" | "fêmea" = mateC.sex === "macho" ? "fêmea" : "macho";
  const toGroup = (genotype: string, probability: number, sex?: "macho" | "fêmea"): OffspringGroup => ({
    genotype, probability, isVisual: false, isCarrier: false, isLethal: false, ...(sex ? { sex } : {}),
  });
  const f1Candidates: OffspringGroup[] =
    f1SexUsed === "fêmea"
      ? (mutationResult.daughters ? Object.entries(mutationResult.daughters).map(([g, p]) => toGroup(g, p, "fêmea")) : (mutationResult.offspring ? Object.entries(mutationResult.offspring).map(([g, p]) => toGroup(g, p)) : []))
      : (mutationResult.sons ? Object.entries(mutationResult.sons).map(([g, p]) => toGroup(g, p, "macho")) : (mutationResult.offspring ? Object.entries(mutationResult.offspring).map(([g, p]) => toGroup(g, p)) : []));

  if (f1Candidates.length === 0) {
    warnings.push("Não foi possível determinar a geração F1 para o sexo necessário — confira os dados de entrada.");
  }

  // 2ª geração: cada F1 possível × C, ponderado pela probabilidade do F1
  const aggregated = new Map<string, F2Outcome>();
  for (const f1 of f1Candidates) {
    const f1Genotype: ParentGenotypes = { sex: f1SexUsed, [mutationId]: f1.genotype } as ParentGenotypes;
    const cCleaned = isolateMutation(mateC, mutationId);

    const crossF1C = calculateColorCross({
      male: f1SexUsed === "macho" ? f1Genotype : cCleaned,
      female: f1SexUsed === "fêmea" ? f1Genotype : cCleaned,
    });
    const f2Piece = crossF1C.byMutation[mutationId];
    if (!f2Piece) continue;

    const collectGroups = (groups: Record<string, number> | undefined, sex?: "macho" | "fêmea") => {
      if (!groups) return;
      for (const [genotype, prob] of Object.entries(groups)) {
        const weighted = prob * f1.probability;
        const key = `${genotype}__${sex ?? "-"}`;
        const existing = aggregated.get(key);
        if (existing) {
          existing.probability += weighted;
          if (!existing.viaF1Genotypes.includes(f1.genotype)) existing.viaF1Genotypes.push(f1.genotype);
        } else {
          aggregated.set(key, {
            genotype,
            sex,
            probability: weighted,
            isVisual: genotype.toLowerCase().includes("mm") || /z-z-/i.test(genotype),
            isCarrier: genotype.toLowerCase() === "nm" || /z\+z-/i.test(genotype),
            viaF1Genotypes: [f1.genotype],
          });
        }
      }
    };

    collectGroups(f2Piece.offspring);
    collectGroups(f2Piece.sons, "macho");
    collectGroups(f2Piece.daughters, "fêmea");
  }

  const f2Outcomes = Array.from(aggregated.values()).sort((a, b) => b.probability - a.probability);

  const totalProb = f2Outcomes.reduce((s, o) => s + o.probability, 0);
  if (totalProb > 0 && Math.abs(totalProb - 1) > 0.01) {
    warnings.push(`Soma das probabilidades da F2 ficou em ${(totalProb * 100).toFixed(1)}% (esperado ~100%) — resultado aproximado.`);
  }

  return {
    mutationId,
    mutationLabel: mutationResult.label,
    f1Distribution: f1Candidates,
    f1SexUsed,
    f2Outcomes,
    warnings,
  };
}
