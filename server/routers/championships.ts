import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { canarilManagerProcedure, platformAdminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { birds, championship_entries, championships, judges, scores } from "../../drizzle/schema";
import { getCurrentTenantId, requireTenantId } from "../_core/tenant";

const championshipStatusSchema = z.enum(["upcoming", "ongoing", "finished"]);
const entryStatusSchema = z.enum(["registered", "judged", "disqualified", "awarded"]);
const criteriaScoreSchema = z.object({
  criterion: z.string().trim().min(1).max(100),
  score: z.number().finite().min(0),
  maxScore: z.number().finite().positive(),
  comment: z.string().trim().max(1000).optional(),
}).refine((item) => item.score <= item.maxScore, { message: "A nota não pode superar a nota máxima." });

function championshipScope(id: number, tenantId: number | null) {
  return tenantId === null
    ? and(eq(championships.id, id), isNull(championships.deletedAt))
    : and(eq(championships.id, id), eq(championships.tenantId, tenantId), isNull(championships.deletedAt));
}

async function requireOwnedChampionship(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, id: number, tenantId: number | null) {
  const [championship] = await db.select().from(championships).where(championshipScope(id, tenantId)).limit(1);
  if (!championship) throw new Error("Campeonato não encontrado ou sem acesso.");
  return championship;
}

async function requireOwnedEntry(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, id: number, tenantId: number | null) {
  const [row] = await db.select({ entry: championship_entries, championship: championships })
    .from(championship_entries)
    .innerJoin(championships, and(
      eq(championships.id, championship_entries.championshipId),
      isNull(championships.deletedAt),
      ...(tenantId === null ? [] : [eq(championships.tenantId, tenantId)]),
    ))
    .where(eq(championship_entries.id, id))
    .limit(1);
  if (!row) throw new Error("Inscrição não encontrada ou sem acesso.");
  return row;
}

export const championshipsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const tenantId = getCurrentTenantId(ctx);
    return db.select().from(championships).where(and(
      ...(tenantId === null ? [] : [eq(championships.tenantId, tenantId)]),
      isNull(championships.deletedAt),
    )).orderBy(desc(championships.startDate));
  }),

  getById: protectedProcedure
    .input(z.number().int().positive())
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const tenantId = getCurrentTenantId(ctx);
      const [result] = await db.select().from(championships).where(championshipScope(input, tenantId)).limit(1);
      return result ?? null;
    }),

  create: canarilManagerProcedure
    .input(z.object({
      name: z.string().trim().min(1, "Informe o nome do campeonato").max(200),
      association: z.string().trim().max(100).optional(),
      location: z.string().trim().max(200).optional(),
      startDate: z.date(),
      endDate: z.date().optional(),
      status: championshipStatusSchema.optional(),
      notes: z.string().trim().max(3000).optional(),
    }).refine((value) => !value.endDate || value.endDate >= value.startDate, {
      message: "A data final não pode ser anterior à data inicial.",
      path: ["endDate"],
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");
      const tenantId = requireTenantId(ctx);
      const [created] = await db.insert(championships).values({
        name: input.name,
        association: input.association || null,
        location: input.location || null,
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status ?? "upcoming",
        notes: input.notes || null,
        tenantId,
      }).returning();
      return created;
    }),

  updateStatus: canarilManagerProcedure
    .input(z.object({ id: z.number().int().positive(), status: championshipStatusSchema }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");
      const tenantId = getCurrentTenantId(ctx);
      const [updated] = await db.update(championships)
        .set({ status: input.status, updatedAt: new Date() })
        .where(championshipScope(input.id, tenantId)).returning();
      if (!updated) throw new Error("Campeonato não encontrado ou sem acesso.");
      return updated;
    }),

  update: canarilManagerProcedure
    .input(z.object({
      id: z.number().int().positive(),
      name: z.string().trim().min(1).max(200).optional(),
      association: z.string().trim().max(100).nullable().optional(),
      location: z.string().trim().max(200).nullable().optional(),
      startDate: z.date().optional(),
      endDate: z.date().nullable().optional(),
      status: championshipStatusSchema.optional(),
      notes: z.string().trim().max(3000).nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");
      const tenantId = getCurrentTenantId(ctx);
      const current = await requireOwnedChampionship(db, input.id, tenantId);
      const startDate = input.startDate ?? current.startDate;
      const endDate = input.endDate === undefined ? current.endDate : input.endDate;
      if (endDate && endDate < startDate) throw new Error("A data final não pode ser anterior à data inicial.");
      const { id, ...fields } = input;
      const [updated] = await db.update(championships)
        .set({ ...fields, updatedAt: new Date() })
        .where(championshipScope(id, tenantId)).returning();
      return updated;
    }),

  delete: canarilManagerProcedure
    .input(z.number().int().positive())
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");
      const tenantId = getCurrentTenantId(ctx);
      await requireOwnedChampionship(db, input, tenantId);
      await db.update(championships).set({ deletedAt: new Date(), deletedBy: ctx.user.id, updatedAt: new Date() })
        .where(championshipScope(input, tenantId));
      return { success: true };
    }),

  entries: router({
    listByChampionship: protectedProcedure
      .input(z.number().int().positive())
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        const tenantId = getCurrentTenantId(ctx);
        await requireOwnedChampionship(db, input, tenantId);
        return db.select().from(championship_entries)
          .where(eq(championship_entries.championshipId, input))
          .orderBy(desc(championship_entries.createdAt));
      }),

    create: canarilManagerProcedure
      .input(z.object({
        championshipId: z.number().int().positive(),
        birdId: z.number().int().positive(),
        category: z.string().trim().min(1, "Informe a categoria").max(150),
        cageNumberAtShow: z.string().trim().max(50).optional(),
        status: entryStatusSchema.optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        const tenantId = getCurrentTenantId(ctx);
        const championship = await requireOwnedChampionship(db, input.championshipId, tenantId);
        const [bird] = await db.select({ id: birds.id }).from(birds).where(and(
          eq(birds.id, input.birdId),
          eq(birds.tenantId, championship.tenantId!),
          isNull(birds.deletedAt),
        )).limit(1);
        if (!bird) throw new Error("Pássaro não encontrado neste canaril.");
        const duplicate = await db.select({ id: championship_entries.id }).from(championship_entries).where(and(
          eq(championship_entries.championshipId, input.championshipId),
          eq(championship_entries.birdId, input.birdId),
        )).limit(1);
        if (duplicate.length > 0) throw new Error("Este pássaro já está inscrito neste campeonato.");
        const [created] = await db.insert(championship_entries).values({
          championshipId: input.championshipId,
          birdId: input.birdId,
          category: input.category,
          cageNumberAtShow: input.cageNumberAtShow || null,
          status: input.status ?? "registered",
        }).returning();
        return created;
      }),

    updateStatus: canarilManagerProcedure
      .input(z.object({ id: z.number().int().positive(), status: entryStatusSchema }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        const tenantId = getCurrentTenantId(ctx);
        await requireOwnedEntry(db, input.id, tenantId);
        const [updated] = await db.update(championship_entries)
          .set({ status: input.status, updatedAt: new Date() })
          .where(eq(championship_entries.id, input.id)).returning();
        return updated;
      }),

    update: canarilManagerProcedure
      .input(z.object({
        id: z.number().int().positive(),
        birdId: z.number().int().positive().optional(),
        category: z.string().trim().min(1).max(150).optional(),
        cageNumberAtShow: z.string().trim().max(50).nullable().optional(),
        status: entryStatusSchema.optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        const tenantId = getCurrentTenantId(ctx);
        const owned = await requireOwnedEntry(db, input.id, tenantId);
        if (input.birdId) {
          const [bird] = await db.select({ id: birds.id }).from(birds).where(and(
            eq(birds.id, input.birdId),
            eq(birds.tenantId, owned.championship.tenantId!),
            isNull(birds.deletedAt),
          )).limit(1);
          if (!bird) throw new Error("Pássaro não encontrado neste canaril.");
        }
        const { id, ...fields } = input;
        const [updated] = await db.update(championship_entries)
          .set({ ...fields, updatedAt: new Date() })
          .where(eq(championship_entries.id, id)).returning();
        return updated;
      }),

    delete: canarilManagerProcedure
      .input(z.number().int().positive())
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        const tenantId = getCurrentTenantId(ctx);
        await requireOwnedEntry(db, input, tenantId);
        const scoreExists = await db.select({ id: scores.id }).from(scores).where(eq(scores.entryId, input)).limit(1);
        if (scoreExists.length > 0) throw new Error("Inscrição já julgada. Preserve o histórico e marque-a como desclassificada.");
        await db.delete(championship_entries).where(eq(championship_entries.id, input));
        return { success: true };
      }),
  }),

  judges: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(judges).orderBy(desc(judges.createdAt));
    }),

    create: platformAdminProcedure
      .input(z.object({
        name: z.string().trim().min(1, "Informe o nome do juiz").max(200),
        registrationNumber: z.string().trim().max(100).optional(),
        association: z.string().trim().max(100).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        const [created] = await db.insert(judges).values({
          name: input.name,
          registrationNumber: input.registrationNumber || null,
          association: input.association || null,
        }).returning();
        return created;
      }),

    update: platformAdminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1).max(200).optional(),
        registrationNumber: z.string().trim().max(100).nullable().optional(),
        association: z.string().trim().max(100).nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        const { id, ...fields } = input;
        const [updated] = await db.update(judges).set(fields).where(eq(judges.id, id)).returning();
        if (!updated) throw new Error("Juiz não encontrado.");
        return updated;
      }),

    delete: platformAdminProcedure
      .input(z.number().int().positive())
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        const scoreExists = await db.select({ id: scores.id }).from(scores).where(eq(scores.judgeId, input)).limit(1);
        if (scoreExists.length > 0) throw new Error("Juiz possui avaliações registradas e não pode ser excluído.");
        await db.delete(judges).where(eq(judges.id, input));
        return { success: true };
      }),
  }),

  scores: router({
    listByEntry: protectedProcedure
      .input(z.number().int().positive())
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return [];
        await requireOwnedEntry(db, input, getCurrentTenantId(ctx));
        return db.select().from(scores).where(eq(scores.entryId, input)).orderBy(desc(scores.createdAt));
      }),

    create: canarilManagerProcedure
      .input(z.object({
        entryId: z.number().int().positive(),
        judgeId: z.number().int().positive().optional(),
        criteria_scores: z.array(criteriaScoreSchema).max(100).optional(),
        totalScore: z.number().finite().min(0),
        placement: z.number().int().positive().optional(),
        notes: z.string().trim().max(3000).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        await requireOwnedEntry(db, input.entryId, getCurrentTenantId(ctx));
        if (input.judgeId) {
          const judge = await db.select({ id: judges.id }).from(judges).where(eq(judges.id, input.judgeId)).limit(1);
          if (judge.length === 0) throw new Error("Juiz não encontrado.");
        }
        if (input.criteria_scores?.length) {
          const calculated = input.criteria_scores.reduce((sum, item) => sum + item.score, 0);
          if (Math.abs(calculated - input.totalScore) > 0.01) {
            throw new Error("A nota total não corresponde à soma dos critérios.");
          }
        }
        const [created] = await db.insert(scores).values({
          entryId: input.entryId,
          judgeId: input.judgeId,
          criteria_scores: input.criteria_scores,
          totalScore: input.totalScore,
          placement: input.placement,
          notes: input.notes || null,
        }).returning();
        await db.update(championship_entries)
          .set({ status: input.placement ? "awarded" : "judged", updatedAt: new Date() })
          .where(eq(championship_entries.id, input.entryId));
        return created;
      }),
  }),
});
