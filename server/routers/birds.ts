import { z } from "zod";
import { protectedProcedure, router, requireTenantAccess, getCallerTenantId } from "../_core/trpc";
import { getDb } from "../db";
import { bird_genetic_inference_logs, bird_genetic_profiles, birds, official_bird_classes, rings } from "../../drizzle/schema";
import { eq, desc, and, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { generateBirdDisplayTitle, deriveLegacyColorCode, deriveLegacySpecialtyCode } from "../_core/birdIdentity";
import { interpretOfficialClass } from "../_core/officialClassInterpreter";

// Schema reutilizável para birthDate: aceita Date (superjson) ou string 'YYYY-MM-DD'
const birthDateSchema = z
  .union([z.date(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
  .optional()
  .nullable();

/** Normaliza birthDate para Date ou undefined, nunca Invalid Date */
function normalizeBirthDate(raw: Date | string | null | undefined): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  // string 'YYYY-MM-DD' — usa T12:00:00Z para evitar off-by-one de fuso
  const d = new Date(raw + "T12:00:00Z");
  return isNaN(d.getTime()) ? null : d;
}


const birdIdentitySchema = {
  displayTitle: z.string().max(250).optional().nullable(),
  nickname: z.string().max(100).optional().nullable(),
  speciesName: z.string().max(50).optional().nullable(),
  modality: z.string().max(20).optional().nullable(),
  breedName: z.string().max(100).optional().nullable(),
  officialClassId: z.number().int().positive().optional().nullable(),
};

type DbClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function getOfficialClassById(db: DbClient, officialClassId?: number | null) {
  if (!officialClassId) return null;
  const [cls] = await db
    .select()
    .from(official_bird_classes)
    .where(eq(official_bird_classes.id, officialClassId))
    .limit(1);
  return cls ?? null;
}

async function upsertGeneticProfileFromOfficialClass(db: DbClient, birdId: number, officialClass: Awaited<ReturnType<typeof getOfficialClassById>>) {
  if (!officialClass) return;

  const interpreted = interpretOfficialClass(officialClass.officialName, officialClass.modality as "COR" | "PORTE");
  const now = new Date();

  const payload = {
    birdId,
    officialClassId: officialClass.id,
    modality: officialClass.modality,
    officialCode: officialClass.officialCode,
    officialName: officialClass.officialName,
    officialAbbreviation: officialClass.abbreviation ?? null,
    officialGroup: officialClass.groupName ?? null,
    breedName: officialClass.breedName ?? interpreted.breedName ?? null,
    bitola: officialClass.bitola ?? null,
    phenotypeName: officialClass.officialName,
    visualColorDescription: officialClass.officialName,
    lipochromeBase: interpreted.lipochromeBase ?? null,
    melaninSeries: interpreted.melaninSeries ?? null,
    featherCategory: interpreted.featherCategory ?? null,
    crestType: interpreted.crestType ?? null,
    dominantWhiteStatus: interpreted.dominantWhiteStatus ?? null,
    recessiveWhiteStatus: interpreted.recessiveWhiteStatus ?? null,
    ivoryStatus: interpreted.ivoryStatus ?? null,
    redFactorStatus: interpreted.redFactorStatus ?? null,
    visibleMutations: interpreted.visibleMutations ?? [],
    unknownTraits: ["Genes ocultos não confirmados apenas pela classe oficial"],
    confidenceScore: interpreted.confidenceScore ?? 0.2,
    geneticWarnings: interpreted.geneticWarnings ?? [],
    nutritionRecommendations: interpreted.nutritionRecommendations ?? [],
    manualOverride: false,
    lastInferenceAt: now,
    updatedAt: now,
  };

  const [existing] = await db
    .select()
    .from(bird_genetic_profiles)
    .where(eq(bird_genetic_profiles.birdId, birdId))
    .limit(1);

  if (existing?.manualOverride) {
    await db.insert(bird_genetic_inference_logs).values({
      birdId,
      sourceType: "OFFICIAL_CLASS",
      beforeJson: existing,
      afterJson: payload,
      confidence: interpreted.confidenceScore ?? 0.2,
      reason: "Classe oficial selecionada, mas perfil manualOverride=true não foi sobrescrito.",
    });
    return;
  }

  if (existing) {
    await db.update(bird_genetic_profiles).set(payload).where(eq(bird_genetic_profiles.id, existing.id));
  } else {
    await db.insert(bird_genetic_profiles).values({ ...payload, createdAt: now });
  }

  await db.insert(bird_genetic_inference_logs).values({
    birdId,
    sourceType: "OFFICIAL_CLASS",
    beforeJson: existing ?? null,
    afterJson: payload,
    confidence: interpreted.confidenceScore ?? 0.2,
    reason: `Perfil genético criado/atualizado a partir da classe oficial ${officialClass.officialCode} — ${officialClass.officialName}.`,
  });
}

export const birdsRouter = router({
  // Listar todos os pássaros
  list: protectedProcedure
    .input(z.object({
      specialty_code: z.string().optional(),
      status: z.string().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      try {
        // Se usuário possui tenantId, filtrar por esse tenant. Plataforma Admin (tenantId null) vê todos
        const tenantId = (ctx.user as any)?.tenantId ?? null;
        let query = db.select().from(birds);
        if (tenantId !== null && tenantId !== undefined) {
          query = query.where(eq(birds.tenantId, tenantId));
        }
        const results = await query.orderBy(desc(birds.createdAt));
        return results;
      } catch (error) {
        console.error("Error listing birds:", error);
        return [];
      }
    }),

  // Obter pássaro por ID
  getById: protectedProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      try {
        const result = await db.select().from(birds).where(eq(birds.id, input));
        const bird = result[0] || null;
        if (!bird) return null;
        // Verifica se o pássaro pertence ao tenant atual (exceto para admins globais)
        const tenantId = (ctx.user as any)?.tenantId ?? null;
        if (tenantId !== null && tenantId !== undefined) {
          requireTenantAccess(ctx, bird.tenantId);
        }
        return bird;
      } catch (error) {
        console.error("Error getting bird:", error);
        return null;
      }
    }),

  // Verificar se uma anilha já está em uso
  checkRingAvailable: protectedProcedure
    .input(z.object({ ring: z.string(), excludeBirdId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { available: true };
      const existing = await db
        .select({ id: birds.id })
        .from(birds)
        .where(eq(birds.ring, input.ring))
        .limit(1);
      const inUse = existing.length > 0 && existing[0].id !== input.excludeBirdId;
      return { available: !inUse };
    }),

  // Criar novo pássaro
  create: protectedProcedure
    .input(z.object({
      ring: z.string().min(1, "Anilha é obrigatória"),
      specialty_code: z.string().optional().nullable(),
      sex: z.string().min(1, "Sexo é obrigatório"),
      color_code: z.string().optional().nullable(),
      birthDate: birthDateSchema,
      procedence: z.string().optional().nullable(),
      fatherId: z.number().optional().nullable(),
      motherId: z.number().optional().nullable(),
      notes: z.string().optional().nullable(),
      ...birdIdentitySchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });

      // Verifica unicidade da anilha na tabela birds (global)
      const tenantId = (ctx.user as any)?.tenantId ?? null;
      const existing = await db
        .select({ id: birds.id })
        .from(birds)
        .where(eq(birds.ring, input.ring))
        .limit(1);
      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Anilha "${input.ring}" já está em uso por outro pássaro. Escolha outra anilha ou verifique o lote.`,
        });
      }

      const birthDate = normalizeBirthDate(input.birthDate);
      const officialClass = await getOfficialClassById(db, input.officialClassId);
      const speciesName = input.speciesName?.trim() || "Canário";
      const modality = input.modality?.trim() || officialClass?.modality || null;
      const breedName = input.breedName?.trim() || officialClass?.breedName || null;
      const specialtyCode = input.specialty_code?.trim() || deriveLegacySpecialtyCode(breedName, modality);
      const colorCode = input.color_code?.trim() || deriveLegacyColorCode(officialClass?.officialName);
      const displayTitle = input.displayTitle?.trim() || generateBirdDisplayTitle({
        ring: input.ring,
        sex: input.sex,
        specialtyCode,
        colorCode,
        speciesName,
        modality,
        breedName,
        officialName: officialClass?.officialName,
        nickname: input.nickname,
      });

      try {
        const [createdBird] = await db.insert(birds).values({
          ring: input.ring,
          displayTitle,
          nickname: input.nickname?.trim() || null,
          speciesName,
          modality,
          breedName,
          officialClassId: officialClass?.id ?? input.officialClassId ?? null,
          specialty_code: specialtyCode,
          sex: input.sex,
          color_code: colorCode,
          birthDate: birthDate,
          procedence: input.procedence || null,
          fatherId: input.fatherId ?? null,
          motherId: input.motherId ?? null,
          notes: input.notes || null,
          status: "active",
          tenantId: tenantId,
        }).returning();

        if (createdBird && officialClass) {
          await upsertGeneticProfileFromOfficialClass(db, createdBird.id, officialClass);
        }

        if (createdBird) {
          // Marca a anilha como em uso na tabela rings (se existir lá)
          await db
            .update(rings)
            .set({
              status: "in_use",
              birdId: createdBird.id,
              usedAt: new Date(),
              updatedAt: new Date(),
              tenantId: tenantId,
            })
            .where(
              and(
                or(
                  eq(rings.number, createdBird.ring),
                  eq(rings.fullCode, createdBird.ring)
                ),
                eq(rings.status, "available")
              )
            );
        }

        return { success: true, bird: createdBird };
      } catch (error: any) {
        console.error("Error creating bird:", error);
        if (error?.code === "23505" || error?.message?.includes("unique")) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Anilha "${input.ring}" já está em uso. Escolha outra anilha.`,
          });
        }
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message ?? "Erro ao cadastrar pássaro. Tente novamente.",
        });
      }
    }),

  // Editar pássaro
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      ring: z.string().optional(),
      specialty_code: z.string().optional(),
      sex: z.string().optional(),
      color_code: z.string().optional(),
      birthDate: birthDateSchema,
      procedence: z.string().optional().nullable(),
      fatherId: z.number().nullable().optional(),
      motherId: z.number().nullable().optional(),
      cageId: z.number().nullable().optional(),
      status: z.string().optional(),
      isPublic: z.boolean().optional(),
      notes: z.string().optional().nullable(),
      ...birdIdentitySchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });

      const { id, birthDate: rawBirthDate, ...fields } = input;

      const birthDate = rawBirthDate !== undefined ? normalizeBirthDate(rawBirthDate) : undefined;

      try {
        const [existingBird] = await db.select().from(birds).where(eq(birds.id, id)).limit(1);
        if (!existingBird) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Pássaro não encontrado." });
        }
        // Verifica se pertence ao tenant do usuário
        const tenantId = (ctx.user as any)?.tenantId ?? null;
        if (tenantId !== null && tenantId !== undefined) {
          requireTenantAccess(ctx, existingBird.tenantId);
        }

        const officialClass = await getOfficialClassById(db, input.officialClassId ?? existingBird.officialClassId);
        const nextRing = input.ring ?? existingBird.ring;
        const nextSex = input.sex ?? existingBird.sex;
        const nextSpeciesName = input.speciesName?.trim() || existingBird.speciesName || "Canário";
        const nextModality = input.modality?.trim() || existingBird.modality || officialClass?.modality || null;
        const nextBreedName = input.breedName?.trim() || existingBird.breedName || officialClass?.breedName || null;
        const nextSpecialty = input.specialty_code?.trim() || existingBird.specialty_code || deriveLegacySpecialtyCode(nextBreedName, nextModality);
        const nextColor = input.color_code?.trim() || existingBird.color_code || deriveLegacyColorCode(officialClass?.officialName);
        const nextTitle = input.displayTitle?.trim() || generateBirdDisplayTitle({
          ring: nextRing,
          sex: nextSex,
          specialtyCode: nextSpecialty,
          colorCode: nextColor,
          speciesName: nextSpeciesName,
          modality: nextModality,
          breedName: nextBreedName,
          officialName: officialClass?.officialName,
          nickname: input.nickname ?? existingBird.nickname,
        });

        const updateFields: Record<string, unknown> = {
          ...fields,
          displayTitle: nextTitle,
          speciesName: nextSpeciesName,
          modality: nextModality,
          breedName: nextBreedName,
          officialClassId: officialClass?.id ?? input.officialClassId ?? existingBird.officialClassId ?? null,
          updatedAt: new Date(),
        };
        if (input.nickname !== undefined) updateFields.nickname = input.nickname?.trim() || null;
        if (birthDate !== undefined) updateFields.birthDate = birthDate;

        await db.update(birds).set(updateFields as any).where(eq(birds.id, id));

        if (officialClass) {
          await upsertGeneticProfileFromOfficialClass(db, id, officialClass);
        }

        return { success: true };
      } catch (error: any) {
        console.error("Error updating bird:", error);
        if (error?.code === "23505" || error?.message?.includes("unique")) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Anilha já está em uso por outro pássaro.`,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message ?? "Erro ao atualizar pássaro.",
        });
      }
    }),

  // Deletar pássaro
  delete: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });

      try {
        const [existingBird] = await db.select().from(birds).where(eq(birds.id, input)).limit(1);
        if (!existingBird) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Pássaro não encontrado." });
        }
        const tenantId = (ctx.user as any)?.tenantId ?? null;
        if (tenantId !== null && tenantId !== undefined) {
          requireTenantAccess(ctx, existingBird.tenantId);
        }
        await db.delete(birds).where(eq(birds.id, input));
        return { success: true };
      } catch (error: any) {
        console.error("Error deleting bird:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message ?? "Erro ao deletar pássaro.",
        });
      }
    }),

  // Obter genealogia (pais, avós, bisavós)
  getGenealogy: protectedProcedure
    .input(z.number())
    .query(async ({ input: birdId }) => {
      const db = await getDb();
      if (!db) return null;

      try {
        const bird = await db.select().from(birds).where(eq(birds.id, birdId)).limit(1);
        if (!bird.length) return null;

        const currentBird = bird[0];
        let father = null;
        let mother = null;
        let paternal_grandfather = null;
        let paternal_grandmother = null;
        let maternal_grandfather = null;
        let maternal_grandmother = null;

        // Pais
        if (currentBird.fatherId) {
          const fatherResult = await db.select().from(birds).where(eq(birds.id, currentBird.fatherId)).limit(1);
          father = fatherResult[0] || null;

          // Avós paternos
          if (father && father.fatherId) {
            const pgResult = await db.select().from(birds).where(eq(birds.id, father.fatherId)).limit(1);
            paternal_grandfather = pgResult[0] || null;
          }
          if (father && father.motherId) {
            const pgmResult = await db.select().from(birds).where(eq(birds.id, father.motherId)).limit(1);
            paternal_grandmother = pgmResult[0] || null;
          }
        }

        if (currentBird.motherId) {
          const motherResult = await db.select().from(birds).where(eq(birds.id, currentBird.motherId)).limit(1);
          mother = motherResult[0] || null;

          // Avós maternos
          if (mother && mother.fatherId) {
            const mgResult = await db.select().from(birds).where(eq(birds.id, mother.fatherId)).limit(1);
            maternal_grandfather = mgResult[0] || null;
          }
          if (mother && mother.motherId) {
            const mgmResult = await db.select().from(birds).where(eq(birds.id, mother.motherId)).limit(1);
            maternal_grandmother = mgmResult[0] || null;
          }
        }

        return {
          current: currentBird,
          father,
          mother,
          paternal_grandfather,
          paternal_grandmother,
          maternal_grandfather,
          maternal_grandmother,
        };
      } catch (error) {
        console.error("Error getting genealogy:", error);
        return null;
      }
    }),
});
