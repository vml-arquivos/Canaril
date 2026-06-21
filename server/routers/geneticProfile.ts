/**
 * geneticProfile.ts — Router de Perfil Genético Individual
 *
 * Gerencia a ficha genética de cada pássaro:
 * - Busca perfil por birdId
 * - Cria/atualiza perfil (upsert)
 * - Interpreta automaticamente a classe oficial selecionada
 * - Registra log de inferência (BirdGeneticInferenceLog)
 * - Respeita manualOverride (nunca sobrescreve correção manual)
 *
 * Prioridade de fontes (do guia):
 * 1. Correção manual do criador (manualOverride)
 * 2. Resultado real de ninhadas
 * 3. Pedigree confirmado
 * 4. Classe oficial selecionada
 * 5. Análise por foto
 * 6. Sugestão genérica
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  bird_genetic_profiles,
  bird_genetic_inference_logs,
  official_bird_classes,
  birds,
  bird_genotype,
} from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { interpretOfficialClass } from "../_core/officialClassInterpreter";
import { calculateCOI, classifyCOIRisk, PedigreeBird } from "../_core/genetics";

// ============================================================================
// Schemas de entrada
// ============================================================================
const geneticProfileUpsertSchema = z.object({
  birdId: z.number().int().positive(),

  // Identificação oficial (opcional — pode vir de seleção de classe)
  officialClassId: z.number().int().positive().optional(),
  officialCode: z.string().max(20).optional(),
  officialName: z.string().optional(),
  officialAbbreviation: z.string().max(50).optional(),
  officialGroup: z.string().max(200).optional(),
  modality: z.enum(["COR", "PORTE"]).optional(),
  breedName: z.string().max(100).optional(),
  bitola: z.string().max(50).optional(),

  // Fenótipo
  phenotypeName: z.string().optional(),
  visualColorDescription: z.string().optional(),

  // Traços genéticos
  lipochromeBase: z.string().max(50).optional(),
  melaninSeries: z.string().max(50).optional(),
  featherCategory: z.string().max(30).optional(),
  crestType: z.string().max(30).optional(),

  // Status de genes especiais
  dominantWhiteStatus: z.string().max(20).optional(),
  recessiveWhiteStatus: z.string().max(20).optional(),
  ivoryStatus: z.string().max(20).optional(),
  redFactorStatus: z.string().max(20).optional(),
  inoStatus: z.string().max(20).optional(),
  urucumStatus: z.string().max(20).optional(),
  asasBrancasStatus: z.string().max(20).optional(),

  // Mutações
  visibleMutations: z.array(z.string()).optional(),
  carriedMutations: z.array(z.string()).optional(),
  possibleCarriedMutations: z.array(z.string()).optional(),
  unknownTraits: z.array(z.string()).optional(),

  // Genótipo
  genotypeJson: z.record(z.string(), z.unknown()).optional(),
  inferredGenotypeJson: z.record(z.string(), z.unknown()).optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  geneticWarnings: z.array(z.string()).optional(),
  nutritionRecommendations: z.array(z.string()).optional(),

  // Controle
  manualOverride: z.boolean().optional(),

  // Fonte da atualização (para log)
  sourceType: z.enum(["PHOTO_AI", "OFFICIAL_CLASS", "PEDIGREE", "OFFSPRING_RESULT", "MANUAL"]).default("MANUAL"),
  reason: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

// ============================================================================
// Router
// ============================================================================
export const geneticProfileRouter = router({
  /**
   * Busca o perfil genético de um pássaro.
   * Retorna null se não existir ainda.
   */
  getByBird: protectedProcedure
    .input(z.object({ birdId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [profile] = await db
        .select()
        .from(bird_genetic_profiles)
        .where(eq(bird_genetic_profiles.birdId, input.birdId))
        .limit(1);

      return profile ?? null;
    }),

  /**
   * Busca o histórico de inferências de um pássaro.
   */
  getInferenceLogs: protectedProcedure
    .input(z.object({ birdId: z.number().int().positive(), limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      return db
        .select()
        .from(bird_genetic_inference_logs)
        .where(eq(bird_genetic_inference_logs.birdId, input.birdId))
        .orderBy(desc(bird_genetic_inference_logs.createdAt))
        .limit(input.limit);
    }),

  /**
   * Interpreta uma classe oficial e retorna os traços genéticos.
   * Não salva — apenas retorna para preview antes do upsert.
   */
  interpretClass: protectedProcedure
    .input(
      z.object({
        officialCode: z.string().optional(),
        officialName: z.string(),
        modality: z.enum(["COR", "PORTE"]),
      })
    )
    .query(({ input }) => {
      try {
        return interpretOfficialClass(input.officialName, input.modality);
      } catch (error) {
        return { error: String(error) };
      }
    }),

  /**
   * Cria ou atualiza o perfil genético de um pássaro.
   *
   * REGRA CRÍTICA: se manualOverride=true no banco, NÃO sobrescreve
   * campos genéticos a menos que a nova atualização também venha com
   * manualOverride=true (correção manual explícita do criador).
   */
  upsert: protectedProcedure
    .input(geneticProfileUpsertSchema)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível.");

      // Verifica se o pássaro existe
      const [bird] = await db
        .select({ id: birds.id })
        .from(birds)
        .where(eq(birds.id, input.birdId))
        .limit(1);
      if (!bird) throw new Error(`Pássaro #${input.birdId} não encontrado.`);

      // Busca perfil existente
      const [existing] = await db
        .select()
        .from(bird_genetic_profiles)
        .where(eq(bird_genetic_profiles.birdId, input.birdId))
        .limit(1);

      // Se existe e tem manualOverride, só atualiza se a nova entrada também é manual
      if (existing?.manualOverride && input.sourceType !== "MANUAL") {
        return {
          profile: existing,
          skipped: true,
          reason: "manualOverride ativo — use sourceType=MANUAL para sobrescrever.",
        };
      }

      // Se veio officialCode, busca a classe no banco para preencher campos
      let officialClassData: {
        id: number;
        officialName: string;
        abbreviation: string | null;
        groupName: string | null;
        modality: string;
        breedName: string | null;
        bitola: string | null;
        categoryName: string | null;
        interpretedTraits: unknown;
      } | null = null;

      if (input.officialCode) {
        const [cls] = await db
          .select()
          .from(official_bird_classes)
          .where(eq(official_bird_classes.officialCode, input.officialCode))
          .limit(1);
        if (cls) officialClassData = cls;
      }

      // Interpreta a classe oficial se disponível
      let interpreted: ReturnType<typeof interpretOfficialClass> | null = null;
      const nameToInterpret = officialClassData?.officialName ?? input.officialName;
      const modalityToInterpret = (officialClassData?.modality ?? input.modality) as "COR" | "PORTE" | undefined;

      if (nameToInterpret && modalityToInterpret) {
        try {
          interpreted = interpretOfficialClass(nameToInterpret, modalityToInterpret);
        } catch {
          // Interpretação falhou — continua sem
        }
      }

      // Monta o payload de upsert
      const now = new Date();
      const payload = {
        birdId: input.birdId,
        officialClassId: input.officialClassId ?? officialClassData?.id,
        modality: input.modality ?? (officialClassData?.modality as "COR" | "PORTE" | undefined),
        officialCode: input.officialCode,
        officialName: input.officialName ?? officialClassData?.officialName,
        officialAbbreviation: input.officialAbbreviation ?? officialClassData?.abbreviation ?? undefined,
        officialGroup: input.officialGroup ?? officialClassData?.groupName ?? undefined,
        breedName: input.breedName ?? officialClassData?.breedName ?? undefined,
        bitola: input.bitola ?? officialClassData?.bitola ?? undefined,
        // Fenótipo
        phenotypeName: input.phenotypeName ?? interpreted?.lipochromeBase,
        visualColorDescription: input.visualColorDescription,
        // Traços — usa input explícito, depois interpretado, depois existente
        lipochromeBase: input.lipochromeBase ?? interpreted?.lipochromeBase ?? existing?.lipochromeBase ?? undefined,
        melaninSeries: input.melaninSeries ?? interpreted?.melaninSeries ?? existing?.melaninSeries ?? undefined,
        featherCategory: input.featherCategory ?? interpreted?.featherCategory ?? existing?.featherCategory ?? undefined,
        crestType: input.crestType ?? interpreted?.crestType ?? existing?.crestType ?? undefined,
        // Status de genes
        dominantWhiteStatus: input.dominantWhiteStatus ?? interpreted?.dominantWhiteStatus ?? existing?.dominantWhiteStatus ?? undefined,
        recessiveWhiteStatus: input.recessiveWhiteStatus ?? interpreted?.recessiveWhiteStatus ?? existing?.recessiveWhiteStatus ?? undefined,
        ivoryStatus: input.ivoryStatus ?? interpreted?.ivoryStatus ?? existing?.ivoryStatus ?? undefined,
        redFactorStatus: input.redFactorStatus ?? interpreted?.redFactorStatus ?? existing?.redFactorStatus ?? undefined,
        inoStatus: input.inoStatus ?? existing?.inoStatus ?? undefined,
        urucumStatus: input.urucumStatus ?? existing?.urucumStatus ?? undefined,
        asasBrancasStatus: input.asasBrancasStatus ?? existing?.asasBrancasStatus ?? undefined,
        // Mutações
        visibleMutations: input.visibleMutations ?? interpreted?.visibleMutations ?? existing?.visibleMutations ?? undefined,
        carriedMutations: input.carriedMutations ?? existing?.carriedMutations ?? undefined,
        possibleCarriedMutations: input.possibleCarriedMutations ?? existing?.possibleCarriedMutations ?? undefined,
        unknownTraits: input.unknownTraits ?? existing?.unknownTraits ?? undefined,
        // Genótipo
        genotypeJson: input.genotypeJson ?? existing?.genotypeJson ?? undefined,
        inferredGenotypeJson: input.inferredGenotypeJson ?? existing?.inferredGenotypeJson ?? undefined,
        confidenceScore: input.confidence ?? interpreted?.confidenceScore ?? existing?.confidenceScore ?? 0.2,
        geneticWarnings: input.geneticWarnings ?? interpreted?.geneticWarnings ?? existing?.geneticWarnings ?? undefined,
        nutritionRecommendations: input.nutritionRecommendations ?? interpreted?.nutritionRecommendations ?? existing?.nutritionRecommendations ?? undefined,
        // Controle
        manualOverride: input.manualOverride ?? existing?.manualOverride ?? false,
        lastInferenceAt: now,
        updatedAt: now,
      };

      // Upsert
      let profile;
      if (existing) {
        const [updated] = await db
          .update(bird_genetic_profiles)
          .set(payload)
          .where(eq(bird_genetic_profiles.birdId, input.birdId))
          .returning();
        profile = updated;
      } else {
        const [inserted] = await db
          .insert(bird_genetic_profiles)
          .values({ ...payload, createdAt: now })
          .returning();
        profile = inserted;
      }

      // Registra log de inferência
      try {
        await db.insert(bird_genetic_inference_logs).values({
          birdId: input.birdId,
          sourceType: input.sourceType,
          beforeJson: existing ? { ...existing } : null,
          afterJson: { ...profile },
          confidence: payload.confidenceScore,
          reason: input.reason ?? `Atualização via ${input.sourceType}`,
          createdAt: now,
        });
      } catch {
        // Log falhou — não bloqueia o upsert
      }

      return { profile, skipped: false };
    }),

  /**
   * Remove o manualOverride de um pássaro (permite que inferências
   * automáticas voltem a atualizar o perfil).
   */
  clearManualOverride: protectedProcedure
    .input(z.object({ birdId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível.");

      await db
        .update(bird_genetic_profiles)
        .set({ manualOverride: false, updatedAt: new Date() })
        .where(eq(bird_genetic_profiles.birdId, input.birdId));

      return { success: true };
    }),

  /**
   * Relatório Genético do Plantel — uma linha por pássaro ativo, juntando
   * as duas fontes de dado genético que o sistema tem (não exige
   * preencher os dois):
   *  - bird_genotype: genótipo operacional (usado pelo motor de Punnett)
   *  - bird_genetic_profiles: ficha oficial (classe FOB/OBJO interpretada)
   *
   * Pensado pra responder de cara "quais pássaros já têm genética
   * completa, quais estão incompletos, e quais portam quais mutações" —
   * sem precisar abrir ficha por ficha.
   */
  plantelReport: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { generatedAt: new Date(), rows: [], summary: null };

    const allBirds = await db.select().from(birds).where(eq(birds.status, "active"));
    const allGenotypes = await db.select().from(bird_genotype);
    const allProfiles = await db.select().from(bird_genetic_profiles);

    const genotypeByBird = new Map(allGenotypes.map((g) => [g.birdId, g]));
    const profileByBird = new Map(allProfiles.map((p) => [p.birdId, p]));
    const birdMap: Map<number, PedigreeBird> = new Map(
      allBirds.map((b) => [b.id, { id: b.id, ring: b.ring, specialty_code: b.specialty_code, color_code: b.color_code, sex: b.sex, fatherId: b.fatherId, motherId: b.motherId }])
    );
    const coiCache = new Map<number, number>();

    const rows = allBirds.map((bird) => {
      const genotype = genotypeByBird.get(bird.id);
      const profile = profileByBird.get(bird.id);
      const coi = bird.fatherId && bird.motherId ? calculateCOI(bird.id, birdMap, 5, coiCache) : null;

      const mutations = (genotype?.mutations as Array<{ mutation: string; zygosity: string }> | null) ?? [];
      const carriers = mutations.filter((m) => m.zygosity === "heterozygous_carrier").map((m) => m.mutation);
      const manifesting = mutations.filter((m) => m.zygosity === "homozygous_mutant").map((m) => m.mutation);

      return {
        birdId: bird.id,
        ring: bird.ring,
        sex: bird.sex,
        specialtyCode: bird.specialty_code,
        colorCode: bird.color_code,
        hasOperationalGenotype: !!genotype,
        hasOfficialProfile: !!profile,
        officialCode: profile?.officialCode ?? null,
        officialName: profile?.officialName ?? null,
        confidenceScore: profile?.confidenceScore ?? null,
        manualOverride: profile?.manualOverride ?? false,
        backgroundColor: genotype?.backgroundColor ?? null,
        featherType: genotype?.featherType ?? null,
        hasCrest: genotype?.hasCrest ?? false,
        manifestingMutations: manifesting,
        carrierMutations: carriers,
        coi,
        coiRisk: coi != null ? classifyCOIRisk(coi) : null,
        geneticDataComplete: !!genotype || !!profile,
      };
    });

    const summary = {
      total: rows.length,
      withOperationalGenotype: rows.filter((r) => r.hasOperationalGenotype).length,
      withOfficialProfile: rows.filter((r) => r.hasOfficialProfile).length,
      withAnyGeneticData: rows.filter((r) => r.geneticDataComplete).length,
      withNoGeneticData: rows.filter((r) => !r.geneticDataComplete).length,
      withCrest: rows.filter((r) => r.hasCrest).length,
      highCoiRisk: rows.filter((r) => r.coiRisk === "high").length,
      carrierCount: rows.filter((r) => r.carrierMutations.length > 0).length,
    };

    return { generatedAt: new Date(), rows, summary };
  }),
});
