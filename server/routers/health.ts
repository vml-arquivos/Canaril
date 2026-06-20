import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { health_records } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

const recordTypeSchema = z.enum(["vaccine", "treatment", "weight", "quarantine", "diet", "other"]);

export const healthRouter = router({
  listByBird: protectedProcedure
    .input(z.number())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        return await db.select().from(health_records).where(eq(health_records.birdId, input)).orderBy(desc(health_records.date));
      } catch (error) {
        console.error("Error listing health records:", error);
        return [];
      }
    }),

  create: protectedProcedure
    .input(z.object({
      birdId: z.number(),
      type: recordTypeSchema,
      description: z.string().trim().min(1, "Descreva o registro"),
      date: z.date(),
      weightGrams: z.number().optional(),
      dietPhase: z.enum(["muda", "reproducao", "descanso"]).optional(),
      nextDueDate: z.date().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      try {
        await db.insert(health_records).values(input);
        return { success: true };
      } catch (error) {
        console.error("Error creating health record:", error);
        throw error;
      }
    }),

  delete: protectedProcedure
    .input(z.number())
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(health_records).where(eq(health_records.id, input));
      return { success: true };
    }),

  // Histórico de peso de um pássaro (subconjunto de health_records,
  // type='weight'), já em formato pronto pra gráfico de evolução.
  weightHistory: protectedProcedure
    .input(z.number())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const records = await db
          .select()
          .from(health_records)
          .where(eq(health_records.birdId, input))
          .orderBy(health_records.date);
        return records
          .filter((r) => r.type === "weight" && r.weightGrams != null)
          .map((r) => ({ date: r.date, weightGrams: r.weightGrams as number }));
      } catch (error) {
        console.error("Error listing weight history:", error);
        return [];
      }
    }),
});
