import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { championship_entries, championships, judges, scores } from "../../drizzle/schema";

const championshipStatusSchema = z.enum(["upcoming", "ongoing", "finished"]);
const entryStatusSchema = z.enum(["registered", "judged", "disqualified", "awarded"]);
const criteriaScoreSchema = z.object({
  criterion: z.string(),
  score: z.number(),
  maxScore: z.number(),
  comment: z.string().optional(),
});

export const championshipsRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    return db.select().from(championships).orderBy(desc(championships.startDate));
  }),

  getById: protectedProcedure
    .input(z.number())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const result = await db.select().from(championships).where(eq(championships.id, input)).limit(1);
      return result[0] ?? null;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1, "Informe o nome do campeonato"),
        association: z.string().trim().optional(),
        location: z.string().trim().optional(),
        startDate: z.date(),
        endDate: z.date().optional(),
        status: championshipStatusSchema.optional(),
        notes: z.string().trim().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");

      const [created] = await db
        .insert(championships)
        .values({
          name: input.name,
          association: input.association || null,
          location: input.location || null,
          startDate: input.startDate,
          endDate: input.endDate,
          status: input.status ?? "upcoming",
          notes: input.notes || null,
        })
        .returning();

      return created;
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: championshipStatusSchema }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");

      const [updated] = await db
        .update(championships)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(championships.id, input.id))
        .returning();

      return updated ?? null;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().trim().min(1).optional(),
        association: z.string().trim().optional(),
        location: z.string().trim().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        status: championshipStatusSchema.optional(),
        notes: z.string().trim().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");
      const { id, ...fields } = input;

      const [updated] = await db
        .update(championships)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(championships.id, id))
        .returning();

      return updated ?? null;
    }),

  delete: protectedProcedure
    .input(z.number())
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");

      // Remove em cascata as inscrições e pontuações desse campeonato —
      // não faz sentido manter inscrições órfãs de um campeonato apagado.
      const entries = await db.select().from(championship_entries).where(eq(championship_entries.championshipId, input));
      for (const entry of entries) {
        await db.delete(scores).where(eq(scores.entryId, entry.id));
      }
      await db.delete(championship_entries).where(eq(championship_entries.championshipId, input));
      await db.delete(championships).where(eq(championships.id, input));

      return { success: true };
    }),

  entries: router({
    listByChampionship: protectedProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        return db
          .select()
          .from(championship_entries)
          .where(eq(championship_entries.championshipId, input))
          .orderBy(desc(championship_entries.createdAt));
      }),

    create: protectedProcedure
      .input(
        z.object({
          championshipId: z.number(),
          birdId: z.number(),
          category: z.string().trim().min(1, "Informe a categoria"),
          cageNumberAtShow: z.string().trim().optional(),
          status: entryStatusSchema.optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");

        const [created] = await db
          .insert(championship_entries)
          .values({
            championshipId: input.championshipId,
            birdId: input.birdId,
            category: input.category,
            cageNumberAtShow: input.cageNumberAtShow || null,
            status: input.status ?? "registered",
          })
          .returning();

        return created;
      }),

    updateStatus: protectedProcedure
      .input(z.object({ id: z.number(), status: entryStatusSchema }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");

        const [updated] = await db
          .update(championship_entries)
          .set({ status: input.status, updatedAt: new Date() })
          .where(eq(championship_entries.id, input.id))
          .returning();

        return updated ?? null;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          birdId: z.number().optional(),
          category: z.string().trim().min(1).optional(),
          cageNumberAtShow: z.string().trim().optional(),
          status: entryStatusSchema.optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        const { id, ...fields } = input;

        const [updated] = await db
          .update(championship_entries)
          .set({ ...fields, updatedAt: new Date() })
          .where(eq(championship_entries.id, id))
          .returning();

        return updated ?? null;
      }),

    delete: protectedProcedure
      .input(z.number())
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        await db.delete(scores).where(eq(scores.entryId, input));
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

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(1, "Informe o nome do juiz"),
          registrationNumber: z.string().trim().optional(),
          association: z.string().trim().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");

        const [created] = await db
          .insert(judges)
          .values({
            name: input.name,
            registrationNumber: input.registrationNumber || null,
            association: input.association || null,
          })
          .returning();

        return created;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().trim().min(1).optional(),
          registrationNumber: z.string().trim().optional(),
          association: z.string().trim().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        const { id, ...fields } = input;

        const [updated] = await db.update(judges).set(fields).where(eq(judges.id, id)).returning();
        return updated ?? null;
      }),

    delete: protectedProcedure
      .input(z.number())
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");
        await db.delete(judges).where(eq(judges.id, input));
        return { success: true };
      }),
  }),

  scores: router({
    listByEntry: protectedProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        return db.select().from(scores).where(eq(scores.entryId, input)).orderBy(desc(scores.createdAt));
      }),

    create: protectedProcedure
      .input(
        z.object({
          entryId: z.number(),
          judgeId: z.number().optional(),
          criteria_scores: z.array(criteriaScoreSchema).optional(),
          totalScore: z.number(),
          placement: z.number().int().optional(),
          notes: z.string().trim().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados não disponível");

        const [created] = await db
          .insert(scores)
          .values({
            entryId: input.entryId,
            judgeId: input.judgeId,
            criteria_scores: input.criteria_scores,
            totalScore: input.totalScore,
            placement: input.placement,
            notes: input.notes || null,
          })
          .returning();

        await db
          .update(championship_entries)
          .set({ status: input.placement ? "awarded" : "judged", updatedAt: new Date() })
          .where(eq(championship_entries.id, input.entryId));

        return created;
      }),
  }),
});
