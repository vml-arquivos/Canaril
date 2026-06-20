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
import { invokeLLM } from "../_core/llm";
import { SPECIALTIES, COLORS } from "../../shared/constants";

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
          model: "claude-sonnet-4-6",
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
});
