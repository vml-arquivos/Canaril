/**
 * photoAnalysis.ts — Router de Reconhecimento do Pássaro por Foto
 *
 * Liga três peças que já existiam mas nunca tinham sido conectadas:
 *   1. server/_core/photoPhenotypeAnalyzer.ts (análise por IA — corrigida)
 *   2. official_bird_classes (catálogo oficial real, já populado no boot)
 *   3. bird_genetic_profiles (ficha genética, via geneticProfileRouter)
 *
 * Fluxo:
 *   analyze()  -> chama a IA, cruza contra o catálogo oficial real,
 *                 salva em bird_photo_analyses, devolve sugestões com
 *                 o disclaimer obrigatório.
 *   confirm()  -> o criador escolhe (ou recusa) uma das sugestões;
 *                 só ENTÃO o perfil genético é criado/atualizado,
 *                 nunca automaticamente.
 *
 * Honestidade genética: a foto nunca confirma genes ocultos (portador
 * de branco recessivo, marfim em macho, etc.) — isso fica sempre como
 * "desconhecido" nos campos correspondentes, ver fieldsNotConfirmed.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { bird_photo_analyses, official_bird_classes, birds } from "../../drizzle/schema";
import { eq, desc, or, ilike } from "drizzle-orm";
import { analyzePhotoPhenotype, DISCLAIMER_TEXT } from "../_core/photoPhenotypeAnalyzer";
import { getActiveProvider } from "../_core/llm";
import { geneticProfileRouter } from "./geneticProfile";

export const photoAnalysisRouter = router({
  /**
   * Analisa de 1 a 6 fotos de um pássaro e sugere classes oficiais reais
   * (cruzadas contra official_bird_classes, não inventadas pela IA).
   */
  analyze: protectedProcedure
    .input(
      z.object({
        birdId: z.number().int().positive(),
        photoUrls: z.array(z.string()).min(1).max(6),
        birdSex: z.enum(["macho", "fêmea", "indeterminado"]).optional(),
        additionalContext: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível.");

      const [bird] = await db.select({ id: birds.id }).from(birds).where(eq(birds.id, input.birdId)).limit(1);
      if (!bird) throw new Error(`Pássaro #${input.birdId} não encontrado.`);

      const startTime = Date.now();
      const result = await analyzePhotoPhenotype({
        photoUrls: input.photoUrls,
        birdSex: input.birdSex,
        additionalContext: input.additionalContext,
      });

      // Cruza cada sugestão da IA contra o catálogo oficial REAL — a IA
      // pode sugerir um código/nome que não existe ou está levemente
      // diferente; aqui resolvemos pro registro real do banco quando
      // possível, em vez de confiar cegamente no texto livre da IA.
      const matchedClasses: Array<{
        suggestedCode?: string;
        suggestedName: string;
        confidence: number;
        reason: string;
        matchedOfficialClassId: number | null;
        matchedOfficialCode: string | null;
      }> = [];

      for (const suggestion of result.analysis.possibleOfficialClasses) {
        let matched: { id: number; officialCode: string } | null = null;

        if (suggestion.code) {
          const [byCode] = await db
            .select({ id: official_bird_classes.id, officialCode: official_bird_classes.officialCode })
            .from(official_bird_classes)
            .where(eq(official_bird_classes.officialCode, suggestion.code.toUpperCase().replace(/\s/g, "")))
            .limit(1);
          if (byCode) matched = byCode;
        }

        if (!matched && suggestion.name) {
          const [byName] = await db
            .select({ id: official_bird_classes.id, officialCode: official_bird_classes.officialCode })
            .from(official_bird_classes)
            .where(or(ilike(official_bird_classes.officialName, suggestion.name), ilike(official_bird_classes.officialName, `%${suggestion.name}%`)))
            .limit(1);
          if (byName) matched = byName;
        }

        matchedClasses.push({
          suggestedCode: suggestion.code,
          suggestedName: suggestion.name,
          confidence: suggestion.confidence,
          reason: suggestion.reason,
          matchedOfficialClassId: matched?.id ?? null,
          matchedOfficialCode: matched?.officialCode ?? null,
        });
      }

      const [saved] = await db
        .insert(bird_photo_analyses)
        .values({
          birdId: input.birdId,
          photos: input.photoUrls,
          aiProvider: getActiveProvider() ?? "desconhecido",
          modelUsed: result.modelUsed,
          rawResponseJson: result.analysis,
          visualTraitsJson: {
            lipochromeBase: result.analysis.lipochromeBase,
            melaninSeries: result.analysis.melaninSeries,
            featherCategory: result.analysis.featherCategory,
            crestType: result.analysis.crestType,
            visibleMutations: result.analysis.visibleMutations,
            visualDescription: result.analysis.visualDescription,
          },
          possibleOfficialClassesJson: matchedClasses,
          confidenceOverall: result.analysis.confidenceOverall,
          warnings: result.analysis.warnings,
          recommendations: result.analysis.recommendations,
          fieldsNotConfirmed: result.analysis.fieldsNotConfirmed,
          acceptedByUser: false,
          processingTimeMs: Date.now() - startTime,
        })
        .returning();

      return {
        analysisId: saved.id,
        analysis: result.analysis,
        matchedClasses,
        disclaimer: DISCLAIMER_TEXT,
        photosAnalyzed: result.photosAnalyzed,
      };
    }),

  /**
   * O criador confirma (ou só registra ciência) de uma análise. Só
   * QUANDO confirmado com uma classe oficial é que o perfil genético é
   * criado/atualizado — nunca automaticamente a partir da foto sozinha.
   */
  confirm: protectedProcedure
    .input(
      z.object({
        analysisId: z.number().int().positive(),
        acceptedOfficialClassId: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível.");

      const [analysis] = await db
        .select()
        .from(bird_photo_analyses)
        .where(eq(bird_photo_analyses.id, input.analysisId))
        .limit(1);
      if (!analysis) throw new Error("Análise não encontrada.");

      await db
        .update(bird_photo_analyses)
        .set({
          acceptedByUser: true,
          acceptedOfficialClassId: input.acceptedOfficialClassId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(bird_photo_analyses.id, input.analysisId));

      if (!input.acceptedOfficialClassId) {
        // Criador só confirmou ciência da análise, sem aceitar nenhuma
        // classe oficial sugerida — não mexe no perfil genético.
        return { success: true, profileUpdated: false };
      }

      const [officialClass] = await db
        .select()
        .from(official_bird_classes)
        .where(eq(official_bird_classes.id, input.acceptedOfficialClassId))
        .limit(1);
      if (!officialClass) throw new Error("Classe oficial não encontrada.");

      const traits = (officialClass.interpretedTraits ?? {}) as Record<string, unknown>;

      // Reaproveita o upsert do geneticProfileRouter (mesma regra de
      // manualOverride, mesmo log de inferência) — não duplica lógica.
      const caller = geneticProfileRouter.createCaller(ctx as any);
      const profile = await caller.upsert({
        birdId: analysis.birdId,
        officialClassId: officialClass.id,
        officialCode: officialClass.officialCode,
        officialName: officialClass.officialName,
        officialAbbreviation: officialClass.abbreviation ?? undefined,
        officialGroup: officialClass.groupName ?? undefined,
        modality: officialClass.modality as "COR" | "PORTE",
        breedName: officialClass.breedName ?? undefined,
        bitola: officialClass.bitola ?? undefined,
        lipochromeBase: traits.lipochromeBase as string | undefined,
        melaninSeries: traits.melaninSeries as string | undefined,
        featherCategory: traits.featherCategory as string | undefined,
        crestType: traits.crestType as string | undefined,
        dominantWhiteStatus: traits.dominantWhiteStatus as string | undefined,
        recessiveWhiteStatus: traits.recessiveWhiteStatus as string | undefined,
        ivoryStatus: traits.ivoryStatus as string | undefined,
        redFactorStatus: traits.redFactorStatus as string | undefined,
        visibleMutations: traits.visibleMutations as string[] | undefined,
        geneticWarnings: traits.geneticWarnings as string[] | undefined,
        nutritionRecommendations: traits.nutritionRecommendations as string[] | undefined,
        confidenceScore: typeof traits.confidenceScore === "number" ? traits.confidenceScore : undefined,
        sourceType: "PHOTO_AI",
        reason: `Confirmado pelo criador a partir de análise de foto (análise #${analysis.id}), classe oficial ${officialClass.officialCode}.`,
        confidence: analysis.confidenceOverall ?? undefined,
      });

      return { success: true, profileUpdated: true, profile };
    }),

  listByBird: protectedProcedure
    .input(z.number().int().positive())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(bird_photo_analyses)
        .where(eq(bird_photo_analyses.birdId, input))
        .orderBy(desc(bird_photo_analyses.createdAt));
    }),
});
