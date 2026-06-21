/**
 * routers/pairingOptimizer.ts — Par Ideal
 *
 * Busca todos os candidatos do sexo oposto no plantel, monta os insumos
 * reais (genótipo, COI, sinais de saúde, histórico reprodutivo, melhor
 * nota de exposição) e delega a pontuação pro motor puro e já testado
 * em server/_core/pairingOptimizer.ts.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { birds, bird_genotype, health_records, couples, clutches, championship_entries, scores } from "../../drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { scorePair, Objective, HealthFlags, ReproductiveHistory } from "../_core/pairingOptimizer";
import { calculateCOIForPair, PedigreeBird } from "../_core/genetics";
import { BirdGenotypeInput } from "../_core/mendelian";
import { SPECIALTIES, COLORS } from "../../shared/constants";

const objectiveSchema = z.enum([
  "REDUZIR_COI", "REPRODUCAO_SEGURA", "MELHORAR_COR", "MELHORAR_PORTE",
  "PRODUZIR_PORTADORES", "MANTER_LINHAGEM", "EXPOSICAO", "PLANEJAMENTO_LIVRE",
]);

const RECENT_DAYS = 60;

function toGenotypeInput(g: typeof bird_genotype.$inferSelect | undefined, sex: "macho" | "fêmea"): BirdGenotypeInput | null {
  if (!g) return null;
  return {
    sex,
    backgroundColor: g.backgroundColor ?? undefined,
    featherType: (g.featherType as "intenso" | "nevado" | null) ?? undefined,
    hasCrest: g.hasCrest,
    mutations: g.mutations ?? [],
  };
}

export const pairingOptimizerRouter = router({
  findIdealPairs: protectedProcedure
    .input(
      z.object({
        baseBirdId: z.number(),
        objective: objectiveSchema.default("PLANEJAMENTO_LIVRE"),
        maxCoi: z.number().min(0).max(1).optional(),
        limit: z.number().min(1).max(30).default(10),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { baseBird: null, recommendations: [] };

      const [base] = await db.select().from(birds).where(eq(birds.id, input.baseBirdId));
      if (!base) throw new Error("Pássaro não encontrado");

      const oppositeSex = base.sex === "macho" ? "fêmea" : "macho";
      const allActive = await db.select().from(birds).where(eq(birds.status, "active"));
      const candidates = allActive.filter((b) => b.sex === oppositeSex && b.id !== base.id);

      const allGenotypes = await db.select().from(bird_genotype);
      const genotypeByBird = new Map(allGenotypes.map((g) => [g.birdId, g]));

      const birdMap: Map<number, PedigreeBird> = new Map(
        allActive.map((b) => [b.id, { id: b.id, ring: b.ring, specialty_code: b.specialty_code, color_code: b.color_code, sex: b.sex, fatherId: b.fatherId, motherId: b.motherId }])
      );

      const baseGenotype = toGenotypeInput(genotypeByBird.get(base.id), base.sex === "macho" ? "macho" : "fêmea");

      // Sinais de saúde/nutrição recentes (últimos 60 dias), em lote pra
      // não fazer uma query por candidato.
      const relevantBirdIds = [base.id, ...candidates.map((c) => c.id)];
      const cutoff = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);
      const recentHealth = relevantBirdIds.length
        ? await db.select().from(health_records).where(inArray(health_records.birdId, relevantBirdIds))
        : [];
      const healthByBird = new Map<number, HealthFlags>();
      for (const id of relevantBirdIds) {
        const records = recentHealth.filter((r) => r.birdId === id && new Date(r.date) >= cutoff);
        healthByBird.set(id, {
          hasRecentQuarantine: records.some((r) => r.type === "quarantine"),
          hasRecentWeightCheck: records.some((r) => r.type === "weight"),
          hasRecentDietLog: records.some((r) => r.type === "diet"),
        });
      }

      // Histórico reprodutivo: casais (de qualquer status) envolvendo cada
      // pássaro, somando ovos/eclosões de todas as posturas desses casais.
      const allCouples = await db.select().from(couples);
      const allClutches = await db.select().from(clutches);
      function historyFor(birdId: number): ReproductiveHistory | null {
        const myCouples = allCouples.filter((c) => c.maleId === birdId || c.femaleId === birdId);
        if (myCouples.length === 0) return null;
        const myClutches = allClutches.filter((cl) => myCouples.some((c) => c.id === cl.coupleId));
        if (myClutches.length === 0) return null;
        return {
          totalClutches: myClutches.length,
          totalEggs: myClutches.reduce((sum, cl) => sum + cl.totalEggs, 0),
          totalHatched: myClutches.reduce((sum, cl) => sum + cl.hatchedChicks, 0),
        };
      }

      // Melhor nota de exposição de cada pássaro (se houver).
      const allEntries = relevantBirdIds.length
        ? await db.select().from(championship_entries).where(inArray(championship_entries.birdId, relevantBirdIds))
        : [];
      const allScores = allEntries.length ? await db.select().from(scores).where(inArray(scores.entryId, allEntries.map((e) => e.id))) : [];
      function bestScoreFor(birdId: number): number | null {
        const myEntryIds = allEntries.filter((e) => e.birdId === birdId).map((e) => e.id);
        const myScores = allScores.filter((s) => myEntryIds.includes(s.entryId));
        if (myScores.length === 0) return null;
        return Math.max(...myScores.map((s) => s.totalScore));
      }

      const baseHistory = historyFor(base.id);
      const baseBestScore = bestScoreFor(base.id);

      const recommendations = candidates.map((candidate) => {
        const fatherId = base.sex === "macho" ? base.id : candidate.id;
        const motherId = base.sex === "macho" ? candidate.id : base.id;
        const coi = calculateCOIForPair(fatherId, motherId, birdMap, 5);

        const candidateGenotype = toGenotypeInput(genotypeByBird.get(candidate.id), candidate.sex === "macho" ? "macho" : "fêmea");
        const candidateHistory = historyFor(candidate.id);
        const candidateBestScore = bestScoreFor(candidate.id);
        const combinedHistory: ReproductiveHistory | null =
          baseHistory || candidateHistory
            ? {
                totalClutches: (baseHistory?.totalClutches ?? 0) + (candidateHistory?.totalClutches ?? 0),
                totalEggs: (baseHistory?.totalEggs ?? 0) + (candidateHistory?.totalEggs ?? 0),
                totalHatched: (baseHistory?.totalHatched ?? 0) + (candidateHistory?.totalHatched ?? 0),
              }
            : null;
        const scoreCandidates = [baseBestScore, candidateBestScore].filter((s): s is number => s != null);
        const bestShowScore = scoreCandidates.length > 0 ? Math.max(...scoreCandidates) : null;

        const result = scorePair({
          male: base.sex === "macho" ? { id: base.id, ring: base.ring, sex: base.sex, status: base.status } : { id: candidate.id, ring: candidate.ring, sex: candidate.sex, status: candidate.status },
          female: base.sex === "macho" ? { id: candidate.id, ring: candidate.ring, sex: candidate.sex, status: candidate.status } : { id: base.id, ring: base.ring, sex: base.sex, status: base.status },
          coi,
          maleGenotype: base.sex === "macho" ? baseGenotype : candidateGenotype,
          femaleGenotype: base.sex === "macho" ? candidateGenotype : baseGenotype,
          objective: input.objective as Objective,
          maxCoi: input.maxCoi,
          recentHealthFlags: healthByBird.get(candidate.id),
          reproductiveHistory: combinedHistory,
          bestShowScore,
        });

        return {
          candidateBirdId: candidate.id,
          ring: candidate.ring,
          specialtyName: SPECIALTIES.find((s) => s.id === candidate.specialty_code)?.name ?? candidate.specialty_code,
          colorName: COLORS.find((c) => c.id === candidate.color_code)?.name ?? candidate.color_code,
          hasGenotype: !!candidateGenotype,
          coi,
          ...result,
        };
      });

      recommendations.sort((a, b) => b.finalScore - a.finalScore);

      return {
        baseBird: { id: base.id, ring: base.ring, sex: base.sex, hasGenotype: !!baseGenotype },
        recommendations: recommendations.slice(0, input.limit),
      };
    }),
});
