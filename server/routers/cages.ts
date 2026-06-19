import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { cages } from "../../drizzle/schema";

const cageStatusSchema = z.enum(["free", "occupied", "maintenance"]);

export const cagesRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    return db.select().from(cages).orderBy(desc(cages.createdAt));
  }),

  getById: protectedProcedure
    .input(z.number())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const result = await db.select().from(cages).where(eq(cages.id, input)).limit(1);
      return result[0] ?? null;
    }),

  create: protectedProcedure
    .input(
      z.object({
        code: z.string().trim().min(1, "Informe o código da gaiola"),
        section: z.string().trim().optional(),
        capacity: z.number().int().min(1).default(1),
        status: cageStatusSchema.optional(),
        notes: z.string().trim().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");

      const [created] = await db
        .insert(cages)
        .values({
          code: input.code.trim(),
          section: input.section || null,
          capacity: input.capacity,
          status: input.status ?? "free",
          notes: input.notes || null,
        })
        .returning();

      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        code: z.string().trim().min(1).optional(),
        section: z.string().trim().nullable().optional(),
        capacity: z.number().int().min(1).optional(),
        status: cageStatusSchema.optional(),
        notes: z.string().trim().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");

      const { id, ...patch } = input;
      const [updated] = await db
        .update(cages)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(cages.id, id))
        .returning();

      return updated ?? null;
    }),

  delete: protectedProcedure
    .input(z.number())
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");

      await db.delete(cages).where(eq(cages.id, input));
      return { success: true } as const;
    }),
});
