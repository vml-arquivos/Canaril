import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { birds, genetic_rules, couples, scores, championship_entries } from "../../drizzle/schema";
import { eq, or } from "drizzle-orm";
import {
  buildPedigreeTree,
  calculateCOI,
  calculateCOIForPair,
  classifyCOIRisk,
  PedigreeBird,
} from "../_core/genetics";
import { calculateColorCross, calculateLipochromeCross, MUTATION_CONFIG } from "../_core/colorGenetics";
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
    .input(z.object({ birdId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const target = (await db.select().from(birds).where(eq(birds.id, input.birdId)))[0];
      if (!target) throw new Error("Pássaro não encontrado");

      const oppositeSex = target.sex === "macho" ? "fêmea" : "macho";
      const allBirds = await db.select().from(birds);
      const birdMap: Map<number, PedigreeBird> = new Map(
        allBirds.map((b) => [b.id, { id: b.id, ring: b.ring, specialty_code: b.specialty_code, color_code: b.color_code, sex: b.sex, fatherId: b.fatherId, motherId: b.motherId }])
      );

      const activeCouples = await db.select().from(couples).where(eq(couples.status, "active"));
      const pairedIds = new Set(activeCouples.flatMap((c) => [c.maleId, c.femaleId]));

      const allScores = await db.select().from(scores);
      const allEntries = await db.select().from(championship_entries);
      const bestScoreByBird = new Map<number, number>();
      for (const entry of allEntries) {
        const entryScores = allScores.filter((s) => s.entryId === entry.id);
        const best = Math.max(0, ...entryScores.map((s) => s.totalScore));
        if (best > (bestScoreByBird.get(entry.birdId) ?? 0)) bestScoreByBird.set(entry.birdId, best);
      }

      const candidates = allBirds
        .filter((b) => b.sex === oppositeSex && b.id !== target.id && b.status === "active" && !pairedIds.has(b.id))
        .map((b) => {
          const coi = calculateCOIForPair(
            target.sex === "macho" ? target.id : b.id,
            target.sex === "macho" ? b.id : target.id,
            birdMap,
            5
          );
          return {
            id: b.id,
            ring: b.ring,
            specialty_code: b.specialty_code,
            color_code: b.color_code,
            coi,
            risk: classifyCOIRisk(coi),
            bestScore: bestScoreByBird.get(b.id) ?? null,
          };
        })
        // Tira do páreo cruzamentos de alto risco genético antes de
        // qualquer recomendação — isso não é negociável.
        .filter((c) => c.risk !== "high")
        .sort((a, b) => a.coi - b.coi || (b.bestScore ?? 0) - (a.bestScore ?? 0))
        .slice(0, 5);

      if (candidates.length === 0) {
        return {
          summary: "Não há candidatos de baixo/médio risco genético disponíveis no plantel no momento — todos os pássaros compatíveis com sexo oposto já estão pareados ou apresentam consanguinidade alta com este pássaro.",
          candidates: [],
        };
      }

      const specialtyName = (code: string) => SPECIALTIES.find((s) => s.id === code)?.name ?? code;
      const colorName = (code: string) => COLORS.find((c) => c.id === code)?.name ?? code;

      const candidateSummary = candidates
        .map((c, i) => `${i + 1}. Anilha ${c.ring} — ${specialtyName(c.specialty_code)}, cor ${colorName(c.color_code)}. COI do filhote estimado: ${(c.coi * 100).toFixed(1)}%. Melhor nota em campeonato: ${c.bestScore ?? "sem histórico"}.`)
        .join("\n");

      let summary = `Candidatos ordenados por menor risco genético, do ${candidates[0].ring} ao ${candidates[candidates.length - 1].ring}.`;

      try {
        const result = await invokeLLM({
          model: "gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "Você é um assistente de apoio à decisão para um criador de canários. Os números de consanguinidade (COI) e pontuações JÁ FORAM CALCULADOS — não invente nem recalcule nada, apenas explique o resultado de forma clara e acessível em português, para alguém com pouco conhecimento técnico. Seja breve (3-4 frases).",
            },
            {
              role: "user",
              content: `Pássaro: anilha ${target.ring}, ${specialtyName(target.specialty_code)}, cor ${colorName(target.color_code)}.\n\nCandidatos a parceiro(a):\n${candidateSummary}\n\nExplique resumidamente por que o primeiro candidato da lista é a melhor opção, e avise sobre qualquer ponto de atenção dos demais.`,
            },
          ],
        });
        const raw = result.choices[0]?.message?.content;
        const text = typeof raw === "string" ? raw : raw?.find((c) => c.type === "text")?.text;
        if (text) summary = text;
      } catch (error) {
        console.error("[Genetics] Falha ao gerar explicação da IA (recomendação segue válida, só sem o texto):", error);
      }

      return { summary, candidates };
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
