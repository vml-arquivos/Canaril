import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { birds, genetic_rules, couples, scores, championship_entries, bird_genotype } from "../../drizzle/schema";
import { eq, or, and } from "drizzle-orm";
import {
  buildPedigreeTree,
  calculateCOI,
  calculateCOIForPair,
  classifyCOIRisk,
  PedigreeBird,
} from "../_core/genetics";
import { calculateColorCross, calculateLipochromeCross, MUTATION_CONFIG } from "../_core/colorGenetics";
import { scorePair, Objective } from "../_core/pairingOptimizer";
import { invokeLLM } from "../_core/llm";
import { SPECIALTIES, COLORS } from "../../shared/constants";

const autosomalRecessiveSchema = z.enum(["NN", "Nm", "mm"]);
const sexLinkedMaleSchema = z.enum(["Z+Z+", "Z+Z-", "Z-Z-"]);
const sexLinkedFemaleSchema = z.enum(["Z+W", "Z-W"]);
const dominantRiskSchema = z.enum(["nn", "Nn", "NN"]);

// Aceita tanto os genótipos de macho quanto de fêmea pros campos
// sexo-ligados — a validação de qual é o correto pro sexo informado
// acontece dentro de calculateColorCross (lança erro claro se inválido).
const sexLinkedSchema = z.union([sexLinkedMaleSchema, sexLinkedFemaleSchema]);

const parentGenotypesSchema = z.object({
  sex: z.enum(["macho", "fêmea"]),
  // Ligadas ao sexo
  agata:     sexLinkedSchema.optional(),
  canela:    sexLinkedSchema.optional(),
  ino:       sexLinkedSchema.optional(),
  marfim:    sexLinkedSchema.optional(),
  acetinado: sexLinkedSchema.optional(),
  asasCinza: sexLinkedSchema.optional(),
  opalino:   sexLinkedSchema.optional(),
  // Autossômicas recessivas
  pastel:         autosomalRecessiveSchema.optional(),
  opala:          autosomalRecessiveSchema.optional(),
  brancorecessivo: autosomalRecessiveSchema.optional(),
  onix:           autosomalRecessiveSchema.optional(),
  cobalto:        autosomalRecessiveSchema.optional(),
  jaspe:          autosomalRecessiveSchema.optional(),
  feo:            autosomalRecessiveSchema.optional(),
  asasBrancas:    autosomalRecessiveSchema.optional(),
  // Autossômicas dominantes
  crista:          dominantRiskSchema.optional(),
  brancoDominante: dominantRiskSchema.optional(),
  plumagem:        dominantRiskSchema.optional(),
});

async function loadBirdMap(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<Map<number, PedigreeBird>> {
  const all = await db.select().from(birds);
  return new Map(
    all.map((b) => [
      b.id,
      {
        id: b.id,
        ring: b.ring,
        specialty_code: b.specialty_code,
        color_code: b.color_code,
        sex: b.sex,
        fatherId: b.fatherId,
        motherId: b.motherId,
      },
    ])
  );
}

export const geneticsRouter = router({
  // Árvore genealógica visual de até 5 gerações
  pedigree: protectedProcedure
    .input(z.object({ birdId: z.number(), generations: z.number().min(1).max(5).default(5) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const birdMap = await loadBirdMap(db);
      const tree = buildPedigreeTree(input.birdId, birdMap, input.generations);
      const coiCache = new Map<number, number>();
      const coi = calculateCOI(input.birdId, birdMap, 5, coiCache);
      return { tree, coi, coiRisk: classifyCOIRisk(coi) };
    }),

  // COI de um pássaro já cadastrado
  coi: protectedProcedure
    .input(z.number())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { coi: 0, risk: "low" as const };
      const birdMap = await loadBirdMap(db);
      const coi = calculateCOI(input, birdMap, 5);
      return { coi, risk: classifyCOIRisk(coi) };
    }),

  // COI que um filhote HIPOTÉTICO desse casal teria — usado antes de
  // confirmar o casal, para alertar com antecedência.
  coiForPair: protectedProcedure
    .input(z.object({ maleId: z.number(), femaleId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { coi: 0, risk: "low" as const };
      const birdMap = await loadBirdMap(db);
      const coi = calculateCOIForPair(input.maleId, input.femaleId, birdMap, 5);
      return { coi, risk: classifyCOIRisk(coi) };
    }),

  // Predição de cores dos filhotes a partir das regras cadastradas em
  // genetic_rules (cruza male_color × female_color)
  predictCross: protectedProcedure
    .input(z.object({ maleColor: z.string(), femaleColor: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const rules = await db
          .select()
          .from(genetic_rules)
          .where(
            or(
              eq(genetic_rules.male_color, input.maleColor),
              eq(genetic_rules.female_color, input.femaleColor)
            )
          );
        // Prioriza regra exata (cor do macho E da fêmea batendo); se não
        // houver, retorna regras parciais que mencionem qualquer uma das
        // duas cores como pista geral.
        const exact = rules.filter(
          (r) => r.male_color === input.maleColor && r.female_color === input.femaleColor
        );
        return exact.length > 0 ? exact : rules;
      } catch (error) {
        console.error("Error predicting cross:", error);
        return [];
      }
    }),

  /**
   * Recomendação de Acasalamento (IA)
   *
   * IMPORTANTE: a IA não calcula genética — ela só explica em português,
   * de forma clara, o resultado de um cálculo determinístico já feito no
   * servidor (COI real via Wright + histórico de pontuações). Isso evita
   * que o modelo "invente" números de consanguinidade, que precisam ser
   * exatos.
   */
  recommendPairing: protectedProcedure
    .input(z.object({
      birdId: z.number(),
      objective: z.enum(["cor", "porte", "show", "linhagem", "diversidade", "portadores"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const tenantId = (ctx.user as any)?.tenantId ?? null;

      const target = (await db.select().from(birds).where(eq(birds.id, input.birdId)))[0];
      if (!target) throw new Error("Pássaro não encontrado");

      const oppositeSex = target.sex === "macho" ? "fêmea" : "macho";

      // Pássaros do tenant
      const tenantFilter = tenantId
        ? and(eq(birds.status, "active"), eq(birds.tenantId, tenantId))
        : eq(birds.status, "active");
      const allBirds = await db.select().from(birds).where(tenantFilter);

      const birdMap: Map<number, PedigreeBird> = new Map(
        allBirds.map((b) => [b.id, {
          id: b.id, ring: b.ring, specialty_code: b.specialty_code,
          color_code: b.color_code, sex: b.sex, fatherId: b.fatherId, motherId: b.motherId,
        }])
      );

      const activeCouples = await db.select().from(couples).where(eq(couples.status, "active"));
      const pairedIds = new Set(activeCouples.flatMap((c) => [c.maleId, c.femaleId]));

      const allGenotypes = await db.select().from(bird_genotype);
      const genoByBird = new Map(allGenotypes.map((g) => [g.birdId, g]));

      // Map frontend objective to Objective enum
      const objectiveMap: Record<string, Objective> = {
        cor: "MELHORAR_COR", porte: "MELHORAR_PORTE", show: "EXPOSICAO",
        linhagem: "MANTER_LINHAGEM", diversidade: "REDUZIR_COI", portadores: "PRODUZIR_PORTADORES",
      };
      const objective: Objective = objectiveMap[input.objective ?? "linhagem"] ?? "MANTER_LINHAGEM";

      const candidateResults = allBirds
        .filter((b) => b.sex === oppositeSex && b.id !== target.id && !pairedIds.has(b.id))
        .map((candidate) => {
          const maleId   = target.sex === "macho" ? target.id : candidate.id;
          const femaleId = target.sex === "macho" ? candidate.id : target.id;
          const maleBird  = allBirds.find((b) => b.id === maleId) ?? target;
          const femBird   = allBirds.find((b) => b.id === femaleId) ?? candidate;

          const maleGeno  = genoByBird.get(maleId);
          const femaleGeno = genoByBird.get(femaleId);

          const coi = calculateCOIForPair(maleId, femaleId, birdMap, 6);
          const coiRisk = classifyCOIRisk(coi);

          const scored = scorePair({
            male:   { id: maleBird.id,  ring: maleBird.ring,  sex: "macho",  status: maleBird.status ?? "active" },
            female: { id: femBird.id,   ring: femBird.ring,   sex: "fêmea",  status: femBird.status ?? "active" },
            coi,
            maleGenotype:   maleGeno   ? { sex: "macho",  mutations: (maleGeno.mutations as any) ?? [],  backgroundColor: maleGeno.backgroundColor ?? undefined,  featherType: (maleGeno.featherType as any) ?? undefined,  hasCrest: maleGeno.hasCrest } : null,
            femaleGenotype: femaleGeno ? { sex: "fêmea",  mutations: (femaleGeno.mutations as any) ?? [], backgroundColor: femaleGeno.backgroundColor ?? undefined, featherType: (femaleGeno.featherType as any) ?? undefined, hasCrest: femaleGeno.hasCrest } : null,
            objective,
          });

          return {
            id: candidate.id,
            ring: candidate.ring,
            displayTitle: candidate.displayTitle,
            sex: candidate.sex,
            modality: candidate.modality,
            specialty_code: candidate.specialty_code,
            color_code: candidate.color_code,
            hasGenotype: !!genoByBird.get(candidate.id),
            finalScore:     scored.finalScore,
            geneticScore:   scored.geneticScore,
            coiScore:       scored.coiScore,
            coi,
            coiRisk,
            coiPct:         `${(coi * 100).toFixed(2)}%`,
            reasons:        scored.reasons,
            warnings:       scored.warnings,
            missingData:    scored.missingData,
            recommendationText: scored.recommendationText,
            predictedOffspring: scored.predictedOffspring,
          };
        })
        .filter((c) => c.coiRisk !== "high")
        .sort((a, b) => b.finalScore - a.finalScore)
        .slice(0, 8);

      return {
        target: {
          id: target.id, ring: target.ring, displayTitle: target.displayTitle,
          sex: target.sex, modality: target.modality,
          hasGenotype: !!genoByBird.get(target.id),
        },
        objective: input.objective ?? "linhagem",
        candidates: candidateResults,
        totalEvaluated: allBirds.filter((b) => b.sex === oppositeSex && b.id !== target.id).length,
      };
    }),

  // =========================================================================
  // Compara múltiplos cenários de cruzamento
  // =========================================================================
  compareCrossings: protectedProcedure
    .input(z.object({
      scenarios: z.array(z.object({
        label: z.string().max(50),
        male: parentGenotypesSchema,
        female: parentGenotypesSchema,
        maleId: z.number().optional(),   // pássaro real para COI
        femaleId: z.number().optional(),  // pássaro real para COI
      })).min(2).max(6),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();

      // Montar birdMap para COI se houver pássaros reais
      let birdMap: Map<number, PedigreeBird> | null = null;
      if (db) {
        const tenantId = (ctx.user as any)?.tenantId ?? null;
        const allBirdsQ = tenantId
          ? db.select().from(birds).where(eq(birds.tenantId, tenantId))
          : db.select().from(birds);
        const allBirds = await allBirdsQ;
        birdMap = new Map(
          allBirds.map((b) => [b.id, {
            id: b.id, ring: b.ring, specialty_code: b.specialty_code,
            color_code: b.color_code, sex: b.sex, fatherId: b.fatherId, motherId: b.motherId,
          }])
        );
      }

      const results = input.scenarios.map((scenario) => {
        const result = calculateColorCross({ male: scenario.male as any, female: scenario.female as any });
        const lethalFraction = result.phenotypeSummary.lethalFraction;
        const mutCount = Object.keys(result.byMutation).length;

        // COI real se tiver IDs de pássaros
        let coi: number | null = null;
        let coiRisk: "low" | "moderate" | "high" | null = null;
        if (birdMap && scenario.maleId && scenario.femaleId) {
          coi = calculateCOIForPair(scenario.maleId, scenario.femaleId, birdMap, 6);
          coiRisk = classifyCOIRisk(coi);
        }

        const riskScore =
          lethalFraction > 0 || coiRisk === "high" ? "RISCO_LETAL"
          : result.warnings.length > 0 || coiRisk === "moderate" ? "ATENCAO"
          : mutCount === 0 ? "SEM_DADOS"
          : "APROVADO";

        // Score composto para ranking (menor = melhor)
        const rankPenalty =
          (lethalFraction > 0 ? 1000 : 0) +
          (coiRisk === "high" ? 500 : coiRisk === "moderate" ? 100 : 0) +
          result.warnings.length * 10 -
          mutCount; // mais mutações analisadas = mais informação = melhor

        return {
          label: scenario.label,
          result,
          riskScore,
          mutationCount: mutCount,
          hasLethalRisk: lethalFraction > 0,
          warningCount: result.warnings.length,
          summary: result.summary,
          coi,
          coiRisk,
          coiPct: coi !== null ? `${(coi * 100).toFixed(2)}%` : null,
          rankPenalty,
        };
      });

      // Ordenar do melhor para o pior
      results.sort((a, b) => a.rankPenalty - b.rankPenalty);

      return results;
    }),

  // =========================================================================
  // Relatório completo de cruzamento — inclui dados de pássaros reais
  // =========================================================================
  buildCrossReport: protectedProcedure
    .input(z.object({ maleId: z.number().int().positive(), femaleId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const [male]   = await db.select().from(birds).where(eq(birds.id, input.maleId)).limit(1);
      const [female] = await db.select().from(birds).where(eq(birds.id, input.femaleId)).limit(1);
      if (!male || !female) return null;

      const [maleGeno]   = await db.select().from(bird_genotype).where(eq(bird_genotype.birdId, input.maleId)).limit(1);
      const [femaleGeno] = await db.select().from(bird_genotype).where(eq(bird_genotype.birdId, input.femaleId)).limit(1);

      // COI — usa pássaros do tenant para não contaminar com dados externos
      const tenantId = (ctx.user as any)?.tenantId ?? null;
      const allBirds = tenantId
        ? await db.select().from(birds).where(eq(birds.tenantId, tenantId))
        : await db.select().from(birds);
      const birdMap = new Map<number, PedigreeBird>(
        allBirds.map((b) => [b.id, { id: b.id, ring: b.ring, specialty_code: b.specialty_code, color_code: b.color_code, sex: b.sex, fatherId: b.fatherId, motherId: b.motherId }])
      );
      const coi    = calculateCOIForPair(male.id, female.id, birdMap, 6);
      const coiRisk = classifyCOIRisk(coi);

      // Confidence
      const hasMaleGeno   = !!maleGeno   && (maleGeno.mutations as any[])?.length > 0;
      const hasFemaleGeno = !!femaleGeno && (femaleGeno.mutations as any[])?.length > 0;
      const hasBothParents = !!(male.fatherId && male.motherId && female.fatherId && female.motherId);
      const confidenceScore =
        hasMaleGeno && hasFemaleGeno && hasBothParents ? 0.90
        : hasMaleGeno && hasFemaleGeno ? 0.75
        : (hasMaleGeno || hasFemaleGeno) && hasBothParents ? 0.60
        : hasMaleGeno || hasFemaleGeno ? 0.45
        : hasBothParents ? 0.30
        : 0.15;
      const confidenceLabel =
        confidenceScore >= 0.75 ? "Alta" : confidenceScore >= 0.45 ? "Média" : "Baixa";

      // Build genotype input for color cross if genotypes exist
      let colorResult = null;
      if (hasMaleGeno && hasFemaleGeno) {
        const mutForColor = (geno: typeof maleGeno, sex: "macho" | "fêmea") => {
          const muts = (geno?.mutations as Array<{ mutation: string; zygosity: string }> | null) ?? [];
          const out: Record<string, string> = { sex };
          for (const m of muts) {
            if (!m.mutation || !m.zygosity) continue;
            if ((MUTATION_CONFIG as any)[m.mutation]) {
              const cfg = (MUTATION_CONFIG as any)[m.mutation];
              if (cfg.inheritance === "sex_linked") {
                out[m.mutation] = sex === "macho"
                  ? m.zygosity === "homozygous_mutant" ? "Z+Z+" : m.zygosity === "heterozygous_carrier" ? "Z+Z-" : "Z-Z-"
                  : m.zygosity === "homozygous_mutant" ? "Z+W" : "Z-W";
              } else if (cfg.inheritance === "autosomal_recessive") {
                out[m.mutation] = m.zygosity === "homozygous_mutant" ? "mm" : m.zygosity === "heterozygous_carrier" ? "Nm" : "NN";
              } else {
                out[m.mutation] = m.zygosity === "homozygous_mutant" ? "NN" : m.zygosity === "heterozygous_carrier" ? "Nn" : "nn";
              }
            }
          }
          return out as any;
        };
        colorResult = calculateColorCross({
          male:   mutForColor(maleGeno!,   "macho"),
          female: mutForColor(femaleGeno!, "fêmea"),
        });
      }

      // Missing data
      const missingData: string[] = [];
      if (!hasMaleGeno)   missingData.push("Genótipo do macho não cadastrado");
      if (!hasFemaleGeno) missingData.push("Genótipo da fêmea não cadastrado");
      if (!male.fatherId)   missingData.push("Pai do macho desconhecido");
      if (!male.motherId)   missingData.push("Mãe do macho desconhecida");
      if (!female.fatherId) missingData.push("Pai da fêmea desconhecido");
      if (!female.motherId) missingData.push("Mãe da fêmea desconhecida");

      // Status
      const hasLethal = (colorResult?.phenotypeSummary?.lethalFraction ?? 0) > 0 || coiRisk === "high";
      const status: "IDEAL" | "APROVADO" | "ATENCAO" | "NAO_RECOMENDADO" | "DADOS_INSUFICIENTES" =
        !hasMaleGeno && !hasFemaleGeno ? "DADOS_INSUFICIENTES"
        : hasLethal ? "NAO_RECOMENDADO"
        : coiRisk === "moderate" ? "ATENCAO"
        : "APROVADO";

      return {
        male:   { id: male.id,   ring: male.ring,   displayTitle: male.displayTitle,   sex: male.sex,   modality: male.modality,   breedName: male.breedName,   hasGenotype: hasMaleGeno },
        female: { id: female.id, ring: female.ring, displayTitle: female.displayTitle, sex: female.sex, modality: female.modality, breedName: female.breedName, hasGenotype: hasFemaleGeno },
        coi,   coiRisk,
        coiPct: `${(coi * 100).toFixed(2)}%`,
        confidenceScore,
        confidenceLabel,
        missingData,
        status,
        colorResult,
        warnings: colorResult?.warnings ?? [],
        recommendations: colorResult?.recommendations ?? [],
        generatedAt: new Date(),
      };
    }),

  // =========================================================================
  // Lista de mutações disponíveis para a calculadora
  // =========================================================================
  listMutations: protectedProcedure.query(() => {
    return Object.entries(MUTATION_CONFIG).map(([id, cfg]) => ({
      id,
      label: cfg.label,
      labelEn: cfg.labelEn,
      inheritance: cfg.inheritance,
      inheritanceLabel: cfg.inheritanceLabel,
      description: cfg.description,
      phenotypeEffect: cfg.phenotypeEffect,
      isLethalHomozygous: cfg.isLethalHomozygous ?? false,
    }));
  }),

  // =========================================================================
  // Cálculo de lipocromo (cor de fundo) entre dois pais
  // =========================================================================
  calculateLipochromeCross: protectedProcedure
    .input(z.object({
      father: z.object({
        base: z.enum(["amarelo", "vermelho", "branco_dominante", "branco_recessivo", "desconhecido"]),
        ivoryStatus: z.enum(["nenhum", "portador", "visual"]).optional(),
        featherType: z.enum(["intenso", "nevado"]).optional(),
      }),
      mother: z.object({
        base: z.enum(["amarelo", "vermelho", "branco_dominante", "branco_recessivo", "desconhecido"]),
        ivoryStatus: z.enum(["nenhum", "portador", "visual"]).optional(),
        featherType: z.enum(["intenso", "nevado"]).optional(),
      }),
    }))
    .query(({ input }) => calculateLipochromeCross(input.father, input.mother)),

  // =========================================================================
  // Calculadora Genética de Cores (Punnett square completo)
  // =========================================================================
  calculateColorCross: protectedProcedure
    .input(
      z.object({
        male: parentGenotypesSchema,
        female: parentGenotypesSchema,
      })
    )
    .query(({ input }) => {
      // Puramente matemático — não toca no banco, não precisa de pássaros
      // cadastrados. Lança erro claro (capturado pelo tRPC) se os sexos
      // dos genótipos não baterem com macho/fêmea.
      return calculateColorCross(input as any);
    }),
});
