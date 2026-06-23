/**
 * intelligence.ts — Router do Canaril Intelligence Core (Missão 5)
 */
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { birds, bird_genotype, bird_genetic_profiles } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  getActiveSpecies, getSpecies,
  getBreedsForSpecies, getBreedsForModality, getBreed,
  LIPOCHROMES, MELANIN_SERIES, FEATHER_CATEGORIES,
  getMutationsForSpecies, getMutation, getValidZygosities, canFemaleBeCarrier,
  explainTerm, getAllTerms,
  computeFieldApplicability,
  analyzeBirdGaps, gapSummary,
  buildBirdProfile,
  advisePairing,
  INTELLIGENCE_VERSION,
} from "../_core/canarilIntelligence";
import { calculateCOIForPair, PedigreeBird } from "../_core/genetics";

export const intelligenceRouter = router({

  // ─── Meta ─────────────────────────────────────────────────────────────────
  version: publicProcedure.query(() => ({
    version: INTELLIGENCE_VERSION,
    description: "Canaril Intelligence Core — Motor de conhecimento interno",
    external_ai_required: false,
  })),

  // ─── Espécies ────────────────────────────────────────────────────────────
  getSpeciesKnowledge: publicProcedure.query(() => getActiveSpecies()),

  // ─── Raças ───────────────────────────────────────────────────────────────
  getBreedKnowledge: publicProcedure
    .input(z.object({ speciesCode: z.string().default("canario"), modality: z.string().optional() }))
    .query(({ input }) => {
      if (input.modality) return getBreedsForModality(input.speciesCode, input.modality as any);
      return getBreedsForSpecies(input.speciesCode);
    }),

  // ─── Cores (lipocromos, melaninas, penas) ────────────────────────────────
  getColorKnowledge: publicProcedure.query(() => ({
    lipochromes: LIPOCHROMES,
    melaninSeries: MELANIN_SERIES,
    featherCategories: FEATHER_CATEGORIES,
  })),

  // ─── Mutações ────────────────────────────────────────────────────────────
  getMutationKnowledge: publicProcedure
    .input(z.object({ speciesCode: z.string().default("canario") }))
    .query(({ input }) => getMutationsForSpecies(input.speciesCode)),

  // ─── Zigosidades válidas por mutação/sexo ────────────────────────────────
  getValidZygosities: publicProcedure
    .input(z.object({ mutationCode: z.string(), sex: z.enum(["macho", "fêmea"]) }))
    .query(({ input }) => ({
      mutationCode: input.mutationCode,
      sex: input.sex,
      validZygosities: getValidZygosities(input.mutationCode, input.sex),
      femaleCanBeCarrier: canFemaleBeCarrier(input.mutationCode),
    })),

  // ─── Campos aplicáveis por contexto ──────────────────────────────────────
  getApplicableFields: publicProcedure
    .input(z.object({
      speciesCode: z.string().default("canario"),
      modality: z.string().optional(),
      breedCode: z.string().optional(),
      sex: z.enum(["macho", "fêmea"]).optional(),
      hasCrest: z.boolean().optional(),
      knownMutations: z.array(z.object({ mutation: z.string(), zygosity: z.string() })).optional(),
    }))
    .query(({ input }) => computeFieldApplicability(input as any)),

  // ─── Explicação de termos ─────────────────────────────────────────────────
  explainTerm: publicProcedure
    .input(z.object({ term: z.string() }))
    .query(({ input }) => explainTerm(input.term) ?? { term: input.term, simpleExplanation: "Termo não encontrado na base de conhecimento.", technicalExplanation: "", examples: [], warnings: "" }),

  getAllExplainableTerms: publicProcedure.query(() => getAllTerms()),

  // ─── Análise de lacunas de um pássaro ────────────────────────────────────
  analyzeDataGaps: protectedProcedure
    .input(z.object({ birdId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [bird] = await db.select().from(birds).where(eq(birds.id, input.birdId)).limit(1);
      if (!bird) return null;

      const [genotype] = await db.select().from(bird_genotype).where(eq(bird_genotype.birdId, input.birdId)).limit(1);
      const [profile] = await db.select().from(bird_genetic_profiles).where(eq(bird_genetic_profiles.birdId, input.birdId)).limit(1);

      const gapInput = {
        fatherId: bird.fatherId ?? null,
        motherId: bird.motherId ?? null,
        officialClassId: bird.officialClassId ?? null,
        hasGenotype: !!genotype,
        hasProfile: !!profile,
        birthDate: bird.birthDate ?? null,
        sex: bird.sex,
        hasPhoto: bird.isPublic ?? false,
        modality: bird.modality ?? null,
        breedName: bird.breedName ?? null,
        colorCode: bird.color_code ?? null,
      };

      const gaps = analyzeBirdGaps(gapInput);
      return { birdId: input.birdId, ring: bird.ring, gaps, summary: gapSummary(gaps) };
    }),

  // ─── Construir perfil genético interno ───────────────────────────────────
  buildBirdProfile: protectedProcedure
    .input(z.object({ birdId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [bird] = await db.select().from(birds).where(eq(birds.id, input.birdId)).limit(1);
      if (!bird) return null;

      const [genotype] = await db.select().from(bird_genotype).where(eq(bird_genotype.birdId, input.birdId)).limit(1);
      const [profile] = await db.select().from(bird_genetic_profiles).where(eq(bird_genetic_profiles.birdId, input.birdId)).limit(1);

      const gapInput = {
        fatherId: bird.fatherId ?? null,
        motherId: bird.motherId ?? null,
        officialClassId: bird.officialClassId ?? null,
        hasGenotype: !!genotype,
        hasProfile: !!profile,
        birthDate: bird.birthDate ?? null,
        sex: bird.sex,
        hasPhoto: bird.isPublic ?? false,
        modality: bird.modality ?? null,
        breedName: bird.breedName ?? null,
        colorCode: bird.color_code ?? null,
      };

      return buildBirdProfile({
        birdId: input.birdId,
        speciesCode: "canario",
        modality: bird.modality,
        breedCode: null,
        sex: bird.sex,
        legacyColorCode: bird.color_code,
        legacySpecialtyCode: bird.specialty_code,
        savedGenotype: genotype ? {
          backgroundColor: genotype.backgroundColor,
          featherType: genotype.featherType,
          hasCrest: genotype.hasCrest,
          mutations: genotype.mutations as any,
        } : null,
        savedProfile: profile ? {
          lipochromeBase: profile.lipochromeBase,
          melaninSeries: profile.melaninSeries,
          featherCategory: profile.featherCategory,
          manualOverride: profile.manualOverride ?? false,
          dominantWhiteStatus: profile.dominantWhiteStatus,
        } : null,
        gapInput,
      });
    }),

  // ─── Aconselhamento de par ────────────────────────────────────────────────
  advisePairing: protectedProcedure
    .input(z.object({
      maleId: z.number().int().positive(),
      femaleId: z.number().int().positive(),
      objective: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [male] = await db.select().from(birds).where(eq(birds.id, input.maleId)).limit(1);
      const [female] = await db.select().from(birds).where(eq(birds.id, input.femaleId)).limit(1);
      if (!male || !female) return null;

      const [maleGeno] = await db.select().from(bird_genotype).where(eq(bird_genotype.birdId, input.maleId)).limit(1);
      const [femaleGeno] = await db.select().from(bird_genotype).where(eq(bird_genotype.birdId, input.femaleId)).limit(1);

      const allBirds = await db.select().from(birds);
      const birdMap = new Map<number, PedigreeBird>(
        allBirds.map((b) => [b.id, { id: b.id, ring: b.ring, specialty_code: b.specialty_code, color_code: b.color_code, sex: b.sex, fatherId: b.fatherId, motherId: b.motherId }])
      );
      const coi = calculateCOIForPair(input.maleId, input.femaleId, birdMap, 5);

      const maleMuts = (maleGeno?.mutations as Array<{ mutation: string; zygosity: string }> | null) ?? [];
      const femaleMuts = (femaleGeno?.mutations as Array<{ mutation: string; zygosity: string }> | null) ?? [];

      return advisePairing({
        maleBirdId: input.maleId,
        femaleBirdId: input.femaleId,
        maleRing: male.ring,
        femaleRing: female.ring,
        coi,
        maleMutations: maleMuts,
        femaleMutations: femaleMuts,
        maleHasCrest: maleGeno?.hasCrest ?? false,
        femaleHasCrest: femaleGeno?.hasCrest ?? false,
        maleHasData: !!maleGeno,
        femaleHasData: !!femaleGeno,
        objective: input.objective,
      });
    }),
});
