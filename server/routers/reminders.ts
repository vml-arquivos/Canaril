import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { breeding_reminders } from "../../drizzle/schema";
import { eq, asc, gte, and } from "drizzle-orm";
import { BREEDING_EVENT_LABELS } from "../_core/breeding";

export const remindersRouter = router({
  // Próximos lembretes não concluídos, em ordem de data — usado no
  // Dashboard como "calendário" simplificado.
  upcoming: protectedProcedure
    .input(z.object({ daysAhead: z.number().default(30) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // inclui até 3 dias atrasados
        const rows = await db
          .select()
          .from(breeding_reminders)
          .where(and(eq(breeding_reminders.completed, false), gte(breeding_reminders.expectedDate, cutoff)))
          .orderBy(asc(breeding_reminders.expectedDate));
        return rows.map((r) => ({ ...r, eventLabel: BREEDING_EVENT_LABELS[r.eventType as keyof typeof BREEDING_EVENT_LABELS] ?? r.eventType }));
      } catch (error) {
        console.error("Error listing upcoming reminders:", error);
        return [];
      }
    }),

  listByCouple: protectedProcedure
    .input(z.number())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const rows = await db
          .select()
          .from(breeding_reminders)
          .where(eq(breeding_reminders.coupleId, input))
          .orderBy(asc(breeding_reminders.expectedDate));
        return rows.map((r) => ({ ...r, eventLabel: BREEDING_EVENT_LABELS[r.eventType as keyof typeof BREEDING_EVENT_LABELS] ?? r.eventType }));
      } catch (error) {
        console.error("Error listing reminders by couple:", error);
        return [];
      }
    }),

  markCompleted: protectedProcedure
    .input(z.object({ id: z.number(), completed: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(breeding_reminders)
        .set({ completed: input.completed, completedAt: input.completed ? new Date() : null })
        .where(eq(breeding_reminders.id, input.id));
      return { success: true };
    }),

  updateDate: protectedProcedure
    .input(z.object({ id: z.number(), expectedDate: z.date() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(breeding_reminders).set({ expectedDate: input.expectedDate }).where(eq(breeding_reminders.id, input.id));
      return { success: true };
    }),
});
