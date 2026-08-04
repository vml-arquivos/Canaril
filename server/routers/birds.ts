import { z } from "zod";
import { protectedProcedure, router, requireTenantAccess, getCallerTenantId } from "../_core/trpc";
import { getDb, getPool } from "../db";
import { bird_genetic_inference_logs, bird_genetic_profiles, birds, cages, official_bird_classes, rings } from "../../drizzle/schema";
import { eq, desc, and, or, ilike, isNull, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { generateBirdDisplayTitle, deriveLegacyColorCode, deriveLegacySpecialtyCode } from "../_core/birdIdentity";
import { interpretOfficialClass } from "../_core/officialClassInterpreter";
import { getCurrentTenantId, requireTenantId } from "../_core/tenant";
import { assessRingCompatibility, type RingGaugeRuleLike } from "../_core/ringCompatibility";

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

type AtomicBirdInput = {
  tenantId: number;
  ring: string;
  displayTitle: string;
  nickname: string | null;
  speciesName: string;
  modality: string | null;
  breedName: string | null;
  officialClassId: number | null;
  specialtyCode: string;
  sex: string;
  colorCode: string;
  birthDate: Date | null;
  procedence: string | null;
  fatherId: number | null;
  motherId: number | null;
  notes: string | null;
};

async function createBirdAtomic(input: AtomicBirdInput): Promise<Record<string, any>> {
  const pool = getPool();
  if (!pool) throw new Error("Banco de dados não disponível.");
  if (input.fatherId && input.motherId && input.fatherId === input.motherId) {
    throw new Error("Pai e mãe devem ser pássaros diferentes.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const parentIds = [input.fatherId, input.motherId].filter((id): id is number => Number.isInteger(id));
    if (parentIds.length > 0) {
      const parents = await client.query<{ id: number; sex: string }>(
        `SELECT id, sex FROM birds
          WHERE id = ANY($1::integer[]) AND "tenantId"=$2 AND "deletedAt" IS NULL
          FOR SHARE`,
        [parentIds, input.tenantId],
      );
      if (parents.rows.length !== parentIds.length) throw new Error("Pai ou mãe não pertence a este criadouro.");
      const father = input.fatherId ? parents.rows.find((row) => row.id === input.fatherId) : null;
      const mother = input.motherId ? parents.rows.find((row) => row.id === input.motherId) : null;
      if (father && !["macho", "M"].includes(father.sex)) throw new Error("O pássaro informado como pai não está cadastrado como macho.");
      if (mother && !["fêmea", "F"].includes(mother.sex)) throw new Error("O pássaro informado como mãe não está cadastrado como fêmea.");
    }

    const inventory = await client.query<{
      id: number;
      batchId: number;
      tenantId: number | null;
      status: string;
      birdId: number | null;
      chickId: number | null;
      speciesName: string | null;
      breedName: string | null;
      modality: string | null;
      ringGaugeMm: number | null;
      ringDeletedAt: Date | null;
      batchDeletedAt: Date | null;
      batchStatus: string;
    }>(
      `SELECT r.id, r."batchId" AS "batchId", r."tenantId" AS "tenantId", r.status,
              r."birdId" AS "birdId", r."chickId" AS "chickId",
              rb."speciesName" AS "speciesName", rb."breedName" AS "breedName",
              rb.modality, rb."ringGaugeMm" AS "ringGaugeMm",
              r."deletedAt" AS "ringDeletedAt", rb."deletedAt" AS "batchDeletedAt",
              rb.status AS "batchStatus"
         FROM rings r
         JOIN ring_batches rb ON rb.id = r."batchId"
        WHERE r.number=$1 OR r."fullCode"=$1
        ORDER BY r.id
        FOR UPDATE OF r`,
      [input.ring],
    );
    if (inventory.rows.length > 1) {
      throw new Error("A anilha está duplicada no inventário legado. Corrija a duplicidade antes de utilizá-la.");
    }
    const inventoryRing = inventory.rows[0] ?? null;
    if (inventoryRing) {
      if (inventoryRing.tenantId !== input.tenantId) throw new Error("Esta anilha pertence a outro criadouro.");
      if (inventoryRing.ringDeletedAt !== null || inventoryRing.batchDeletedAt !== null) {
        throw new Error("Esta anilha pertence a um lote arquivado e não pode ser utilizada.");
      }
      if (inventoryRing.batchStatus !== "available") {
        throw new Error("O lote desta anilha não está disponível. Revise o estoque antes de cadastrar o pássaro.");
      }
      if (inventoryRing.status !== "available" || inventoryRing.birdId !== null || inventoryRing.chickId !== null) {
        throw new Error("Esta anilha já está reservada ou utilizada.");
      }

      const gaugeRules = (await client.query<RingGaugeRuleLike>(
        `SELECT "speciesName", "breedName", modality,
                "recommendedGaugeMm" AS "recommendedGaugeMm", active
           FROM ring_gauge_rules
          WHERE active = TRUE`,
      )).rows;
      const compatibility = assessRingCompatibility({
        speciesName: input.speciesName,
        breedName: input.breedName,
        modality: input.modality,
      }, {
        speciesName: inventoryRing.speciesName,
        breedName: inventoryRing.breedName,
        modality: inventoryRing.modality,
        ringGaugeMm: inventoryRing.ringGaugeMm,
      }, gaugeRules);
      if (!compatibility.compatible) {
        throw new Error(`A anilha selecionada não é compatível com este pássaro. ${compatibility.reason}`);
      }
    }

    const inserted = await client.query<Record<string, any>>(
      `INSERT INTO birds (
         ring, "displayTitle", nickname, "speciesName", modality, "breedName", "officialClassId",
         specialty_code, sex, color_code, "birthDate", procedence, "fatherId", "motherId", notes, status, "tenantId"
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'active',$16)
       RETURNING *`,
      [
        input.ring, input.displayTitle, input.nickname, input.speciesName, input.modality, input.breedName,
        input.officialClassId, input.specialtyCode, input.sex, input.colorCode, input.birthDate, input.procedence,
        input.fatherId, input.motherId, input.notes, input.tenantId,
      ],
    );
    const bird = inserted.rows[0];
    if (!bird) throw new Error("Não foi possível criar o pássaro.");

    if (inventoryRing) {
      const ringLinked = await client.query(
        `UPDATE rings
            SET status='in_use', "birdId"=$1, "usedAt"=NOW(), "updatedAt"=NOW()
          WHERE id=$2 AND status='available' AND "birdId" IS NULL AND "chickId" IS NULL`,
        [bird.id, inventoryRing.id],
      );
      if ((ringLinked.rowCount ?? 0) !== 1) {
        throw new Error("A anilha deixou de estar disponível durante o cadastro. Nenhum dado foi salvo.");
      }
      await client.query(
        `SELECT id FROM ring_batches WHERE id=$1 AND "tenantId"=$2 FOR UPDATE`,
        [inventoryRing.batchId, input.tenantId],
      );
      await client.query(
        `UPDATE ring_batches rb SET
           quantity_used=(SELECT COUNT(*)::integer FROM rings r WHERE r."batchId"=rb.id AND r.status IN ('in_use','used')),
           "currentNumber"=COALESCE((SELECT MIN(r.sequence) FROM rings r WHERE r."batchId"=rb.id AND r.status='available'), rb."endNumber"+1),
           status=CASE WHEN EXISTS(SELECT 1 FROM rings r WHERE r."batchId"=rb.id AND r.status='available') THEN 'available' ELSE 'exhausted' END,
           "updatedAt"=NOW() WHERE rb.id=$1 AND rb."tenantId"=$2`,
        [inventoryRing.batchId, input.tenantId],
      );
    }

    await client.query("COMMIT");
    return bird;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export const birdsRouter = router({
  // Listar todos os pássaros
  list: protectedProcedure
    .input(z.object({
      specialty_code: z.string().optional(),
      color_code: z.string().optional(),
      sex: z.string().optional(),
      status: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(500).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      try {
        // Se usuário possui tenantId, filtrar por esse tenant. Plataforma Admin (tenantId null) vê todos
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
        const conditions: any[] = [];
        if (tenantId !== null && tenantId !== undefined) conditions.push(eq(birds.tenantId, tenantId));

        // Antes: specialty_code/status/search eram aceitos no input mas
        // NUNCA usados pra filtrar — a lista sempre devolvia o plantel
        // inteiro. Agora filtram de verdade.
        if (input?.specialty_code) conditions.push(eq(birds.specialty_code, input.specialty_code));
        if (input?.color_code) conditions.push(eq(birds.color_code, input.color_code));
        if (input?.sex) conditions.push(eq(birds.sex, input.sex));
        if (input?.status) conditions.push(eq(birds.status, input.status));
        if (input?.search) {
          const term = `%${input.search.trim()}%`;
          conditions.push(or(ilike(birds.ring, term), ilike(birds.displayTitle, term), ilike(birds.nickname, term)));
        }

        let query: any = db.select().from(birds).where(conditions.length > 0 ? and(...conditions) : undefined);
        query = query.orderBy(desc(birds.createdAt));
        if (input?.limit) query = query.limit(input.limit);
        const results = await query;
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
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
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
      ring: z.string().trim().min(1, "Anilha é obrigatória").max(100),
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
      const tenantId = requireTenantId(ctx);

      const birthDate = normalizeBirthDate(input.birthDate);
      const officialClass = await getOfficialClassById(db, input.officialClassId);
      const speciesName = input.speciesName?.trim() || "Canário";
      const modality = input.modality?.trim() || officialClass?.modality || null;
      const breedName = input.breedName?.trim() || officialClass?.breedName || null;
      const specialtyCode = input.specialty_code?.trim() || deriveLegacySpecialtyCode(breedName, modality);
      const colorCode = input.color_code?.trim() || deriveLegacyColorCode(officialClass?.officialName, officialClass?.groupName);
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
        const createdBird = await createBirdAtomic({
          tenantId,
          ring: input.ring.trim(),
          displayTitle,
          nickname: input.nickname?.trim() || null,
          speciesName,
          modality,
          breedName,
          officialClassId: officialClass?.id ?? input.officialClassId ?? null,
          specialtyCode,
          sex: input.sex,
          colorCode,
          birthDate,
          procedence: input.procedence || null,
          fatherId: input.fatherId ?? null,
          motherId: input.motherId ?? null,
          notes: input.notes || null,
        });

        let geneticProfileWarning: string | null = null;
        if (officialClass) {
          try {
            await upsertGeneticProfileFromOfficialClass(db, Number(createdBird.id), officialClass);
          } catch (profileError) {
            // O cadastro principal já foi confirmado em transação. Uma falha de
            // enriquecimento não pode induzir o usuário a repetir o cadastro e
            // gerar conflito/duplicidade. O perfil poderá ser reprocessado.
            geneticProfileWarning = "Pássaro cadastrado; o perfil genético automático será reprocessado.";
            console.error("Genetic profile enrichment failed after bird creation:", profileError);
          }
        }
        return { success: true, bird: createdBird, geneticProfileWarning };
      } catch (error: any) {
        console.error("Error creating bird:", error);
        if (error?.code === "23505" || error?.message?.includes("unique")) {
          throw new TRPCError({ code: "CONFLICT", message: `Anilha "${input.ring}" já está em uso. Escolha outra anilha.` });
        }
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "BAD_REQUEST", message: error?.message ?? "Erro ao cadastrar pássaro." });
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
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
        if (tenantId !== null && tenantId !== undefined) {
          requireTenantAccess(ctx, existingBird.tenantId);
        }

        const officialClass = await getOfficialClassById(db, input.officialClassId ?? existingBird.officialClassId);
        const nextRing = input.ring?.trim() || existingBird.ring;
        const nextSex = input.sex ?? existingBird.sex;

        if (nextRing !== existingBird.ring) {
          const trackedRings = await db.select({
            id: rings.id,
            number: rings.number,
            fullCode: rings.fullCode,
            birdId: rings.birdId,
            tenantId: rings.tenantId,
          }).from(rings).where(or(
            eq(rings.birdId, id),
            eq(rings.number, nextRing),
            eq(rings.fullCode, nextRing),
          ));
          const oldTracked = trackedRings.find((row) => row.birdId === id);
          const newTracked = trackedRings.find((row) => row.number === nextRing || row.fullCode === nextRing);
          if (oldTracked || newTracked) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "A anilha oficial vinculada ao estoque é imutável. Use o fluxo de anilhamento para evitar divergência de inventário e genealogia.",
            });
          }
        }

        if (input.fatherId !== undefined || input.motherId !== undefined) {
          const nextFatherId = input.fatherId !== undefined ? input.fatherId : existingBird.fatherId;
          const nextMotherId = input.motherId !== undefined ? input.motherId : existingBird.motherId;
          if (nextFatherId === id || nextMotherId === id) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Um pássaro não pode ser pai ou mãe de si próprio." });
          }
          if (nextFatherId && nextMotherId && nextFatherId === nextMotherId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Pai e mãe devem ser pássaros diferentes." });
          }
          const parentIds = [nextFatherId, nextMotherId].filter((parentId): parentId is number => Number.isInteger(parentId));
          if (parentIds.length > 0) {
            const parentScope = tenantId === null
              ? and(inArray(birds.id, parentIds), isNull(birds.deletedAt))
              : and(inArray(birds.id, parentIds), eq(birds.tenantId, tenantId), isNull(birds.deletedAt));
            const parents = await db.select({ id: birds.id, sex: birds.sex }).from(birds).where(parentScope);
            if (parents.length !== parentIds.length) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "Pai ou mãe não pertence a este criadouro ou foi excluído." });
            }
            const father = nextFatherId ? parents.find((row) => row.id === nextFatherId) : null;
            const mother = nextMotherId ? parents.find((row) => row.id === nextMotherId) : null;
            if (father && !["macho", "M"].includes(father.sex)) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "O pássaro informado como pai não está cadastrado como macho." });
            }
            if (mother && !["fêmea", "F"].includes(mother.sex)) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "O pássaro informado como mãe não está cadastrado como fêmea." });
            }
          }
        }
        if (input.cageId !== undefined && input.cageId !== null) {
          const cageScope = tenantId === null
            ? and(eq(cages.id, input.cageId), isNull(cages.deletedAt))
            : and(eq(cages.id, input.cageId), eq(cages.tenantId, tenantId), isNull(cages.deletedAt));
          const [ownedCage] = await db.select({ id: cages.id }).from(cages).where(cageScope).limit(1);
          if (!ownedCage) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Gaiola não encontrada neste criadouro." });
          }
        }

        const nextSpeciesName = input.speciesName?.trim() || existingBird.speciesName || "Canário";
        const nextModality = input.modality?.trim() || existingBird.modality || officialClass?.modality || null;
        const nextBreedName = input.breedName?.trim() || existingBird.breedName || officialClass?.breedName || null;
        const nextSpecialty = input.specialty_code?.trim() || existingBird.specialty_code || deriveLegacySpecialtyCode(nextBreedName, nextModality);
        const nextColor = input.color_code?.trim() || existingBird.color_code || deriveLegacyColorCode(officialClass?.officialName, officialClass?.groupName);
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
          ring: nextRing,
          displayTitle: nextTitle,
          speciesName: nextSpeciesName,
          modality: nextModality,
          breedName: nextBreedName,
          officialClassId: officialClass?.id ?? input.officialClassId ?? existingBird.officialClassId ?? null,
          updatedAt: new Date(),
        };
        if (input.nickname !== undefined) updateFields.nickname = input.nickname?.trim() || null;
        if (birthDate !== undefined) updateFields.birthDate = birthDate;

        const updateScope = tenantId === null
          ? eq(birds.id, id)
          : and(eq(birds.id, id), eq(birds.tenantId, tenantId));
        const updated = await db.update(birds).set(updateFields as any).where(updateScope).returning({ id: birds.id });
        if (updated.length !== 1) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Pássaro não encontrado neste criadouro." });
        }

        let geneticProfileWarning: string | null = null;
        if (officialClass) {
          try {
            await upsertGeneticProfileFromOfficialClass(db, id, officialClass);
          } catch (profileError) {
            geneticProfileWarning = "Dados principais atualizados; o perfil genético automático será reprocessado.";
            console.error("Genetic profile enrichment failed after bird update:", profileError);
          }
        }

        return { success: true, geneticProfileWarning };
      } catch (error: any) {
        console.error("Error updating bird:", error);
        if (error?.code === "23505" || error?.message?.includes("unique")) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Anilha já está em uso por outro pássaro.`,
          });
        }
        if (error instanceof TRPCError) throw error;
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
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
        if (tenantId !== null && tenantId !== undefined) {
          requireTenantAccess(ctx, existingBird.tenantId);
        }
        const scopedTenantId = requireTenantId(ctx);
        const updated = await db.update(birds).set({
          status: "inactive",
          deletedAt: new Date(),
          deletedBy: ctx.user.id,
          updatedAt: new Date(),
        }).where(and(eq(birds.id, input), eq(birds.tenantId, scopedTenantId))).returning({ id: birds.id });
        if (updated.length !== 1) throw new TRPCError({ code: "NOT_FOUND", message: "Pássaro não encontrado neste criadouro." });
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
    .input(z.number().int().positive())
    .query(async ({ input: birdId, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const tenantId = getCurrentTenantId(ctx);
      const scope = (id: number) => and(
        eq(birds.id, id),
        isNull(birds.deletedAt),
        ...(tenantId === null ? [] : [eq(birds.tenantId, tenantId)]),
      );

      const [currentBird] = await db.select().from(birds).where(scope(birdId)).limit(1);
      if (!currentBird) return null;

      const load = async (id: number | null | undefined) => {
        if (!id) return null;
        const [row] = await db.select().from(birds).where(scope(id)).limit(1);
        return row ?? null;
      };

      const father = await load(currentBird.fatherId);
      const mother = await load(currentBird.motherId);
      const [paternal_grandfather, paternal_grandmother, maternal_grandfather, maternal_grandmother] = await Promise.all([
        load(father?.fatherId),
        load(father?.motherId),
        load(mother?.fatherId),
        load(mother?.motherId),
      ]);

      return {
        current: currentBird,
        father,
        mother,
        paternal_grandfather,
        paternal_grandmother,
        maternal_grandfather,
        maternal_grandmother,
      };
    }),
});
