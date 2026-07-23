import { z } from "zod";
import { protectedProcedure, router, requireTenantAccess } from "../_core/trpc";
import { getCurrentTenantId } from "../_core/tenant";
import { getDb } from "../db";
import { breeding_reminders, couples } from "../../drizzle/schema";
import { eq, asc, gte, and, inArray } from "drizzle-orm";
import { BREEDING_EVENT_LABELS } from "../_core/breeding";

/**
 * breeding_reminders não tem coluna própria de tenantId — pertence a um
 * casal (coupleId), que sim tem tenantId. Antes desta correção, nenhum
 * endpoint deste router filtrava por tenant: "upcoming" (usado no
 * Dashboard) mostrava os lembretes de TODOS os criadouros da plataforma
 * juntos, e listByCouple/markCompleted/updateDate aceitavam qualquer
 * id sem checar dono.
 */
async function assertReminderCoupleAccess(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, ctx: any, coupleId: number) {
  const [couple] = await db.select({ tenantId: couples.tenantId }).from(couples).where(eq(couples.id, coupleId)).limit(1);
  if (!couple) throw new Error("Casal não encontrado.");
  requireTenantAccess(ctx, couple.tenantId);
}

export const remindersRouter = router({
  // Próximos lembretes não concluídos, em ordem de data — usado no
  // Dashboard como "calendário" simplificado.
  upcoming: protectedProcedure
    .input(z.object({ daysAhead: z.number().default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant
        const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // inclui até 3 dias atrasados

        const myCoupleIds = tenantId !== null
          ? (await db.select({ id: couples.id }).from(couples).where(eq(couples.tenantId, tenantId))).map((c) => c.id)
          : null; // PLATFORM_ADMIN sem tenant: sem filtro (visão global)

        const conditions = [eq(breeding_reminders.completed, false), gte(breeding_reminders.expectedDate, cutoff)];
        if (myCoupleIds !== null) {
          if (myCoupleIds.length === 0) return [];
          conditions.push(inArray(breeding_reminders.coupleId, myCoupleIds));
        }

        const rows = await db
          .select()
          .from(breeding_reminders)
          .where(and(...conditions))
          .orderBy(asc(breeding_reminders.expectedDate));
        return rows.map((r) => ({ ...r, eventLabel: BREEDING_EVENT_LABELS[r.eventType as keyof typeof BREEDING_EVENT_LABELS] ?? r.eventType }));
      } catch (error) {
        console.error("Error listing upcoming reminders:", error);
        return [];
      }
    }),

  listByCouple: protectedProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        await assertReminderCoupleAccess(db, ctx, input);
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
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [reminder] = await db.select({ coupleId: breeding_reminders.coupleId }).from(breeding_reminders).where(eq(breeding_reminders.id, input.id)).limit(1);
      if (!reminder) throw new Error("Lembrete não encontrado.");
      await assertReminderCoupleAccess(db, ctx, reminder.coupleId);
      await db
        .update(breeding_reminders)
        .set({ completed: input.completed, completedAt: input.completed ? new Date() : null })
        .where(eq(breeding_reminders.id, input.id));
      return { success: true };
    }),

  updateDate: protectedProcedure
    .input(z.object({ id: z.number(), expectedDate: z.date() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [reminder] = await db.select({ coupleId: breeding_reminders.coupleId }).from(breeding_reminders).where(eq(breeding_reminders.id, input.id)).limit(1);
      if (!reminder) throw new Error("Lembrete não encontrado.");
      await assertReminderCoupleAccess(db, ctx, reminder.coupleId);
      await db.update(breeding_reminders).set({ expectedDate: input.expectedDate }).where(eq(breeding_reminders.id, input.id));
      return { success: true };
    }),
});
