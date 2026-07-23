import { z } from "zod";
import { protectedProcedure, router, requireTenantAccess } from "../_core/trpc";
import { getDb } from "../db";
import { health_records, birds } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

const recordTypeSchema = z.enum(["vaccine", "treatment", "weight", "quarantine", "diet", "other"]);

/**
 * Confere que o pássaro existe e pertence ao tenant do usuário logado antes
 * de qualquer leitura/escrita em seus registros de saúde. Antes desta
 * correção, health.ts não tinha NENHUMA verificação de tenant — qualquer
 * usuário autenticado, de qualquer criadouro, podia ler, criar ou apagar
 * registros de saúde de um pássaro de outro criadouro só sabendo o ID.
 */
async function assertBirdAccess(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, ctx: any, birdId: number) {
  const [bird] = await db.select({ id: birds.id, tenantId: birds.tenantId }).from(birds).where(eq(birds.id, birdId)).limit(1);
  if (!bird) throw new Error("Pássaro não encontrado.");
  requireTenantAccess(ctx, bird.tenantId);
  return bird;
}

export const healthRouter = router({
  listByBird: protectedProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        await assertBirdAccess(db, ctx, input);
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
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      try {
        await assertBirdAccess(db, ctx, input.birdId);
        await db.insert(health_records).values(input);
        return { success: true };
      } catch (error) {
        console.error("Error creating health record:", error);
        throw error;
      }
    }),

  delete: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [record] = await db.select({ id: health_records.id, birdId: health_records.birdId }).from(health_records).where(eq(health_records.id, input)).limit(1);
      if (!record) throw new Error("Registro não encontrado.");
      await assertBirdAccess(db, ctx, record.birdId);
      await db.delete(health_records).where(eq(health_records.id, input));
      return { success: true };
    }),

  // Histórico de peso de um pássaro (subconjunto de health_records,
  // type='weight'), já em formato pronto pra gráfico de evolução.
  weightHistory: protectedProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        await assertBirdAccess(db, ctx, input);
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
