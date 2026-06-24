/**
 * admin.ts — Administração Total (Missão 4)
 *
 * Soft delete, lixeira, restauração, gestão de usuários,
 * tenants, auditoria e limpeza de dados de teste.
 *
 * RBAC (Missão 8):
 *   - Gestão de usuários/tenants → somente PLATFORM_ADMIN
 *   - Auditoria global           → somente PLATFORM_ADMIN
 *   - Soft delete operacional    → protectedProcedure (qualquer autenticado)
 */
import { z } from "zod";
import {
  protectedProcedure, platformAdminProcedure, router,
  requirePlatformAdmin, callerIsPlatformAdmin,
} from "../_core/trpc";
import { getDb } from "../db";
import {
  users, birds, rings, ring_batches, couples, clutches, chicks, cages,
  championships, tenants, audit_logs,
} from "../../drizzle/schema";
import { eq, and, isNull, isNotNull, ilike, or, sql } from "drizzle-orm";

// ─── Helper: registrar auditoria ─────────────────────────────────────────────

async function writeAudit(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  params: { userId?: number; action: string; entityType: string; entityId?: number; reason?: string; old?: unknown; newVal?: unknown }
) {
  await db.insert(audit_logs).values({
    userId: params.userId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    oldValueJson: params.old ? (params.old as object) : null,
    newValueJson: params.newVal ? (params.newVal as object) : null,
    reason: params.reason ?? null,
  }).catch(() => {}); // audit never throws
}

// ─── Soft delete helper ───────────────────────────────────────────────────────

function softDeletePatch(userId?: number) {
  return { deletedAt: new Date(), deletedBy: userId ?? null };
}
function restorePatch() {
  return { deletedAt: null, deletedBy: null };
}

export const adminRouter = router({

  // ─── TENANTS (somente PLATFORM_ADMIN) ─────────────────────────────────────

  getTenants: platformAdminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(tenants).where(isNull(tenants.deletedAt));
  }),

  createTenant: platformAdminProcedure
    .input(z.object({
      name: z.string().min(2).max(200),
      slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
      breederCode: z.string().optional(),
      associationName: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível.");
      const [t] = await db.insert(tenants).values({ ...input }).returning();
      await writeAudit(db, { userId: (ctx as any)?.userId, action: "create", entityType: "tenant", entityId: t.id, newVal: t });
      return t;
    }),

  updateTenant: platformAdminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      name: z.string().min(2).max(200).optional(),
      breederCode: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional().nullable(),
      publicSiteEnabled: z.boolean().optional(),
      publicSlug: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível.");
      const { id, ...patch } = input;
      const [old] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
      const [updated] = await db.update(tenants).set(patch).where(eq(tenants.id, id)).returning();
      await writeAudit(db, { userId: (ctx as any)?.userId, action: "update", entityType: "tenant", entityId: id, old, newVal: updated });
      return updated;
    }),

  deleteTenant: platformAdminProcedure
    .input(z.object({ id: z.number().int().positive(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível.");
      const uid = (ctx as any)?.userId;
      await db.update(tenants).set(softDeletePatch(uid)).where(eq(tenants.id, input.id));
      await writeAudit(db, { userId: uid, action: "soft_delete", entityType: "tenant", entityId: input.id, reason: input.reason });
      return { success: true };
    }),

  // ─── USUÁRIOS (somente PLATFORM_ADMIN) ────────────────────────────────────

  listUsers: platformAdminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(users).where(isNull(users.deletedAt));
  }),

  createUser: platformAdminProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      email: z.string().email(),
      role: z.enum(["PLATFORM_ADMIN", "CANARIL_MANAGER", "CANARIL_MEMBER", "VIEWER"]).default("CANARIL_MANAGER"),
      tenantId: z.number().int().positive().optional(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível.");
      const uid = (ctx as any)?.userId;
      // openId gerado como slug único para usuários criados internamente
      const openId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const [created] = await db.insert(users).values({
        openId,
        name: input.name,
        email: input.email,
        role: input.role,
        tenantId: input.tenantId ?? null,
        isActive: input.isActive,
        loginMethod: "local",
        lastSignedIn: new Date(),
      }).returning();
      await writeAudit(db, { userId: uid, action: "create", entityType: "user", entityId: created.id, newVal: created });
      return created;
    }),

  updateUser: platformAdminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      name: z.string().optional().nullable(),
      email: z.string().email().optional().nullable(),
      role: z.enum(["PLATFORM_ADMIN", "CANARIL_MANAGER", "CANARIL_MEMBER", "VIEWER"]).optional(),
      tenantId: z.number().int().positive().optional().nullable(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível.");
      const uid = (ctx as any)?.userId;
      const { id, ...patch } = input;

      // Proteção absoluta: verificar se o alvo é o último PLATFORM_ADMIN
      const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!target) throw new Error("Usuário não encontrado.");
      if (target.role === "PLATFORM_ADMIN" && patch.role && patch.role !== "PLATFORM_ADMIN") {
        const admins = await db.select({ id: users.id }).from(users)
          .where(and(eq(users.role, "PLATFORM_ADMIN"), isNull(users.deletedAt)));
        if (admins.length === 1) throw new Error("Não é possível rebaixar o único PLATFORM_ADMIN do sistema.");
      }

      const [updated] = await db.update(users).set(patch as any).where(eq(users.id, id)).returning();
      await writeAudit(db, { userId: uid, action: "update", entityType: "user", entityId: id, newVal: updated });
      return updated;
    }),

  disableUser: platformAdminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível.");
      const uid = (ctx as any)?.userId;
      const { id } = input;

      // Proteção: não suspender o último PLATFORM_ADMIN
      const [tgt] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (tgt?.role === "PLATFORM_ADMIN") {
        const admins = await db.select({ id: users.id }).from(users)
          .where(and(eq(users.role, "PLATFORM_ADMIN"), isNull(users.deletedAt), eq(users.isActive, true)));
        if (admins.length === 1 && admins[0].id === id) {
          throw new Error("Não é possível suspender o único PLATFORM_ADMIN ativo do sistema.");
        }
      }

      await db.update(users).set({
        isActive: false,
        disabledAt: new Date(),
        disabledBy: uid ?? null,
        disabledReason: input.reason ?? null,
      } as any).where(eq(users.id, id));
      await writeAudit(db, { userId: uid, action: "update", entityType: "user", entityId: id, reason: `suspenso: ${input.reason ?? ""}` });
      return { success: true };
    }),

  restoreUser: platformAdminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível.");
      const uid = (ctx as any)?.userId;
      await db.update(users).set({
        isActive: true,
        disabledAt: null,
        disabledBy: null,
        disabledReason: null,
      } as any).where(eq(users.id, input.id));
      await writeAudit(db, { userId: uid, action: "restore", entityType: "user", entityId: input.id });
      return { success: true };
    }),

  deleteUser: platformAdminProcedure
    .input(z.object({ id: z.number().int().positive(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível.");
      const uid = (ctx as any)?.userId;
      const { id } = input;

      const admins = await db.select({ id: users.id }).from(users)
        .where(and(eq(users.role, "PLATFORM_ADMIN"), isNull(users.deletedAt)));
      if (admins.length === 1 && admins[0].id === id) {
        throw new Error("Não é possível remover o único PLATFORM_ADMIN do sistema.");
      }

      await db.update(users).set(softDeletePatch(uid) as any).where(eq(users.id, id));
      await writeAudit(db, { userId: uid, action: "soft_delete", entityType: "user", entityId: id, reason: input.reason });
      return { success: true };
    }),

  // ─── SOFT DELETE POR MÓDULO ───────────────────────────────────────────────

  softDelete: protectedProcedure
    .input(z.object({
      entityType: z.enum(["bird","ring","ring_batch","couple","clutch","chick","cage","championship"]),
      id: z.number().int().positive(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível.");
      const uid = (ctx as any)?.userId;
      const patch = softDeletePatch(uid);
      const tableMap = { bird: birds, ring: rings, ring_batch: ring_batches, couple: couples, clutch: clutches, chick: chicks, cage: cages, championship: championships };
      const table = tableMap[input.entityType];
      // Guard: clutch with chicks
      if (input.entityType === "clutch") {
        const chickCount = await db.select({ id: chicks.id }).from(chicks).where(and(eq(chicks.clutchId, input.id), isNull(chicks.deletedAt)));
        if (chickCount.length > 0) throw new Error(`Esta postura tem ${chickCount.length} filhote(s). Use deleteWithDependents para excluir junto ou desvincule os filhotes primeiro.`);
      }
      // Guard: cage with couple
      if (input.entityType === "cage") {
        const occupying = await db.select({ id: couples.id }).from(couples).where(and(eq(couples.cageId, input.id), eq(couples.status, "active"), isNull(couples.deletedAt)));
        if (occupying.length > 0) throw new Error("Gaiola ocupada por casal ativo. Finalize o casal antes de excluir a gaiola.");
      }
      // Guard: ring in use
      if (input.entityType === "ring") {
        const [ring] = await db.select().from(rings).where(eq(rings.id, input.id)).limit(1);
        if (ring?.status === "in_use") throw new Error("Anilha está vinculada a um pássaro. Desvincule primeiro ou excluia junto com o pássaro.");
      }
      await (db.update(table as any) as any).set(patch).where(eq((table as any).id, input.id));
      await writeAudit(db, { userId: uid, action: "soft_delete", entityType: input.entityType, entityId: input.id, reason: input.reason });
      return { success: true };
    }),

  // ─── RESTAURAR ───────────────────────────────────────────────────────────

  restore: protectedProcedure
    .input(z.object({
      entityType: z.enum(["bird","ring","ring_batch","couple","clutch","chick","cage","championship","user","tenant"]),
      id: z.number().int().positive(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível.");
      const tableMap: Record<string, any> = { bird: birds, ring: rings, ring_batch: ring_batches, couple: couples, clutch: clutches, chick: chicks, cage: cages, championship: championships, user: users, tenant: tenants };
      const table = tableMap[input.entityType];
      await db.update(table).set(restorePatch()).where(eq(table.id, input.id));
      await writeAudit(db, { userId: (ctx as any)?.userId, action: "restore", entityType: input.entityType, entityId: input.id });
      return { success: true };
    }),

  // ─── LIXEIRA ─────────────────────────────────────────────────────────────

  listTrash: protectedProcedure
    .input(z.object({ entityType: z.enum(["bird","ring","ring_batch","couple","clutch","chick","cage","championship","user"]).optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return {};

      async function getDeleted(table: any, label: string) {
        return db!.select().from(table).where(isNotNull((table as any).deletedAt)).then((rows: any[]) => ({ label, rows }));
      }

      const allTypes = ["bird","ring","ring_batch","couple","clutch","chick","cage","championship","user"] as const;
      const toFetch = input.entityType ? [input.entityType] : allTypes;
      const tableMap: Record<string, any> = { bird: birds, ring: rings, ring_batch: ring_batches, couple: couples, clutch: clutches, chick: chicks, cage: cages, championship: championships, user: users };

      const results = await Promise.all(toFetch.map((t) => getDeleted(tableMap[t], t)));
      return Object.fromEntries(results.map((r) => [r.label, r.rows]));
    }),

  // ─── AUDITORIA GLOBAL (somente PLATFORM_ADMIN) ────────────────────────────

  listAuditLogs: platformAdminProcedure
    .input(z.object({ entityType: z.string().optional(), limit: z.number().int().max(200).default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const q = db.select().from(audit_logs);
      return (input.entityType
        ? q.where(eq(audit_logs.entityType, input.entityType))
        : q
      ).orderBy(sql`${audit_logs.createdAt} DESC`).limit(input.limit);
    }),

  // ─── AUDITORIA DO PRÓPRIO CANARIL (CANARIL_MANAGER + PLATFORM_ADMIN) ──────

  listOwnAuditLogs: protectedProcedure
    .input(z.object({
      limit: z.number().int().max(200).default(50),
      entityType: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const tenantId = (ctx.user as any)?.tenantId ?? null;
      // PLATFORM_ADMIN sem tenant vê tudo; CANARIL_MANAGER vê só o próprio
      const q = db.select().from(audit_logs);
      const filtered = tenantId
        ? q.where(and(
            eq(audit_logs.tenantId as any, tenantId),
            // Não mostrar logs administrativos globais
            sql`${audit_logs.action} NOT IN ('execute_reset','delete_ring_batch','global_reset')`,
            ...(input.entityType ? [eq(audit_logs.entityType, input.entityType)] : [])
          ))
        : (input.entityType ? q.where(eq(audit_logs.entityType, input.entityType)) : q);
      return filtered.orderBy(sql`${audit_logs.createdAt} DESC`).limit(input.limit);
    }),

  // ─── PRÉVIA DE LIMPEZA DE TESTES ────────────────────────────────────────

  previewTestCleanup: protectedProcedure
    .input(z.object({ prefix: z.string().min(1).max(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const pat = `${input.prefix}%`;

      const [birdCount, coupleCount, clutchCount, ringCount, cageCount] = await Promise.all([
        db.select({ id: birds.id }).from(birds).where(and(ilike(birds.ring, pat), isNull(birds.deletedAt))),
        db.select({ id: couples.id }).from(couples).where(isNull(couples.deletedAt)),
        db.select({ id: clutches.id }).from(clutches).where(isNull(clutches.deletedAt)),
        db.select({ id: rings.id }).from(rings).where(ilike(rings.number, pat)),
        db.select({ id: cages.id }).from(cages).where(and(ilike(cages.code, pat), isNull(cages.deletedAt))),
      ]);

      const birdIds = new Set(birdCount.map((b) => b.id));

      const couplesToDelete = coupleCount.filter((c: any) => birdIds.has((c as any).maleId) || birdIds.has((c as any).femaleId));

      return {
        prefix: input.prefix,
        birds: birdCount.length,
        couples: couplesToDelete.length,
        clutches: clutchCount.length,
        rings: ringCount.length,
        cages: cageCount.length,
        total: birdCount.length + couplesToDelete.length + ringCount.length + cageCount.length,
      };
    }),

  // ─── EXECUTAR LIMPEZA DE TESTES ──────────────────────────────────────────

  executeTestCleanup: protectedProcedure
    .input(z.object({
      prefix: z.string().min(1).max(50),
      confirm: z.literal("LIMPAR TESTES"),
      hardDelete: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível.");
      const uid = (ctx as any)?.userId;
      const pat = `${input.prefix}%`;
      const now = new Date();

      const testBirds = await db.select({ id: birds.id, ring: birds.ring })
        .from(birds).where(and(ilike(birds.ring, pat), isNull(birds.deletedAt)));
      const birdIds = testBirds.map((b) => b.id);

      let deleted = 0;

      if (input.hardDelete) {
        // Hard delete — rings first to avoid FK issues
        for (const bid of birdIds) {
          await db.delete(birds).where(eq(birds.id, bid));
          deleted++;
        }
        // Cages with prefix
        const testCages = await db.select({ id: cages.id }).from(cages).where(ilike(cages.code, pat));
        for (const c of testCages) {
          await db.delete(cages).where(eq(cages.id, c.id));
          deleted++;
        }
      } else {
        // Soft delete
        for (const bid of birdIds) {
          await db.update(birds).set({ deletedAt: now, deletedBy: uid } as any).where(eq(birds.id, bid));
          deleted++;
        }
        const testCages = await db.select({ id: cages.id }).from(cages).where(and(ilike(cages.code, pat), isNull(cages.deletedAt)));
        for (const c of testCages) {
          await db.update(cages).set({ deletedAt: now, deletedBy: uid } as any).where(eq(cages.id, c.id));
          deleted++;
        }
      }

      await writeAudit(db, { userId: uid, action: "bulk_delete", entityType: "test_data", reason: `Limpeza: prefixo "${input.prefix}", hard=${input.hardDelete}, ${deleted} itens` });
      return { deleted, prefix: input.prefix, hardDelete: input.hardDelete };
    }),
});
