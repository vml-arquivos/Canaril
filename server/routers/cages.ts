import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { canarilManagerProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { birds, cages, couples } from "../../drizzle/schema";
import { getCurrentTenantId, requireTenantId } from "../_core/tenant";

const cageStatusSchema = z.enum(["free", "occupied", "maintenance"]);

function cageScope(id: number, tenantId: number | null) {
  return tenantId === null ? eq(cages.id, id) : and(eq(cages.id, id), eq(cages.tenantId, tenantId));
}

export const cagesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const tenantId = getCurrentTenantId(ctx);
    const conditions = [isNull(cages.deletedAt)];
    if (tenantId !== null) conditions.push(eq(cages.tenantId, tenantId));
    return db.select().from(cages).where(and(...conditions)).orderBy(desc(cages.createdAt));
  }),

  getById: protectedProcedure
    .input(z.number().int().positive())
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const tenantId = getCurrentTenantId(ctx);
      const [result] = await db.select().from(cages).where(and(cageScope(input, tenantId), isNull(cages.deletedAt))).limit(1);
      return result ?? null;
    }),

  create: canarilManagerProcedure
    .input(z.object({
      code: z.string().trim().min(1, "Informe o código da gaiola").max(50),
      section: z.string().trim().max(100).optional(),
      capacity: z.number().int().min(1).max(100).default(1),
      status: cageStatusSchema.optional(),
      notes: z.string().trim().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");
      const tenantId = requireTenantId(ctx);

      const duplicate = await db.select({ id: cages.id }).from(cages).where(and(
        eq(cages.tenantId, tenantId),
        eq(cages.code, input.code.trim()),
        isNull(cages.deletedAt),
      )).limit(1);
      if (duplicate.length > 0) throw new Error("Já existe uma gaiola com este código no canaril.");

      const [created] = await db.insert(cages).values({
        code: input.code.trim(),
        section: input.section || null,
        capacity: input.capacity,
        status: input.status ?? "free",
        notes: input.notes || null,
        tenantId,
      }).returning();
      return created;
    }),

  update: canarilManagerProcedure
    .input(z.object({
      id: z.number().int().positive(),
      code: z.string().trim().min(1).max(50).optional(),
      section: z.string().trim().max(100).nullable().optional(),
      capacity: z.number().int().min(1).max(100).optional(),
      status: cageStatusSchema.optional(),
      notes: z.string().trim().max(2000).nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");
      const tenantId = getCurrentTenantId(ctx);
      const { id, ...patch } = input;

      if (patch.code) {
        const duplicate = await db.select({ id: cages.id }).from(cages).where(and(
          ...(tenantId === null ? [] : [eq(cages.tenantId, tenantId)]),
          eq(cages.code, patch.code),
          isNull(cages.deletedAt),
        )).limit(1);
        if (duplicate.some((row) => row.id !== id)) throw new Error("Já existe uma gaiola com este código no canaril.");
      }

      const [updated] = await db.update(cages).set({ ...patch, updatedAt: new Date() })
        .where(and(cageScope(id, tenantId), isNull(cages.deletedAt))).returning();
      if (!updated) throw new Error("Gaiola não encontrada ou sem acesso.");
      return updated;
    }),

  delete: canarilManagerProcedure
    .input(z.number().int().positive())
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");
      const tenantId = getCurrentTenantId(ctx);
      const scope = cageScope(input, tenantId);
      const [cage] = await db.select({ id: cages.id }).from(cages).where(and(scope, isNull(cages.deletedAt))).limit(1);
      if (!cage) throw new Error("Gaiola não encontrada ou sem acesso.");

      const tenantConditions = tenantId === null ? [] : [eq(couples.tenantId, tenantId)];
      const activeCouple = await db.select({ id: couples.id }).from(couples).where(and(
        eq(couples.cageId, input), ...tenantConditions, eq(couples.status, "active"), isNull(couples.deletedAt),
      )).limit(1);
      if (activeCouple.length > 0) throw new Error("A gaiola possui casal ativo e não pode ser arquivada.");

      const birdTenantConditions = tenantId === null ? [] : [eq(birds.tenantId, tenantId)];
      const activeBird = await db.select({ id: birds.id }).from(birds).where(and(
        eq(birds.cageId, input), ...birdTenantConditions, eq(birds.status, "active"), isNull(birds.deletedAt),
      )).limit(1);
      if (activeBird.length > 0) throw new Error("A gaiola possui pássaros ativos e não pode ser arquivada.");

      await db.update(cages).set({ deletedAt: new Date(), deletedBy: ctx.user.id }).where(scope);
      return { success: true } as const;
    }),
});
