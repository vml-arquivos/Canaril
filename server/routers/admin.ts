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
  protectedProcedure, platformAdminProcedure, canarilManagerProcedure, router,
  callerIsPlatformAdmin,
} from "../_core/trpc";
import { getDb } from "../db";
import { hashPassword } from "../_core/password";
import {
  users, birds, rings, ring_batches, couples, clutches, chicks, cages,
  championships, tenants, audit_logs,
} from "../../drizzle/schema";
import { eq, and, isNull, isNotNull, ilike, sql, inArray, or } from "drizzle-orm";
import { getCurrentTenantId } from "../_core/tenant";

// ─── Helper: registrar auditoria ─────────────────────────────────────────────

async function writeAudit(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  params: { tenantId?: number | null; userId?: number; action: string; entityType: string; entityId?: number; reason?: string; old?: unknown; newVal?: unknown }
) {
  await db.insert(audit_logs).values({
    tenantId: params.tenantId ?? null,
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


const safeUserColumns = {
  id: users.id,
  openId: users.openId,
  name: users.name,
  email: users.email,
  loginMethod: users.loginMethod,
  mustChangePassword: users.mustChangePassword,
  role: users.role,
  tenantId: users.tenantId,
  isActive: users.isActive,
  lastLoginAt: users.lastLoginAt,
  disabledAt: users.disabledAt,
  disabledBy: users.disabledBy,
  disabledReason: users.disabledReason,
  accessExpiresAt: users.accessExpiresAt,
  internalNote: users.internalNote,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  lastSignedIn: users.lastSignedIn,
  deletedAt: users.deletedAt,
  deletedBy: users.deletedBy,
};

const operationalTableMap = {
  bird: birds,
  ring: rings,
  ring_batch: ring_batches,
  couple: couples,
  clutch: clutches,
  chick: chicks,
  cage: cages,
  championship: championships,
} as const;

function getOperationalTenantId(ctx: any): number | null {
  return callerIsPlatformAdmin(ctx) ? null : getCurrentTenantId(ctx);
}

function operationalEntityCondition(table: any, id: number, tenantId: number | null) {
  return tenantId === null
    ? eq(table.id, id)
    : and(eq(table.id, id), eq(table.tenantId, tenantId));
}

function tenantDeletedCondition(table: any, tenantId: number | null) {
  return tenantId === null
    ? isNotNull(table.deletedAt)
    : and(eq(table.tenantId, tenantId), isNotNull(table.deletedAt));
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
      await writeAudit(db, { userId: ctx.user.id, action: "create", entityType: "tenant", entityId: t.id, newVal: t });
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
      await writeAudit(db, { userId: ctx.user.id, action: "update", entityType: "tenant", entityId: id, old, newVal: updated });
      return updated;
    }),

  deleteTenant: platformAdminProcedure
    .input(z.object({ id: z.number().int().positive(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível.");
      const uid = ctx.user.id;
      await db.update(tenants).set(softDeletePatch(uid)).where(eq(tenants.id, input.id));
      await writeAudit(db, { userId: uid, action: "soft_delete", entityType: "tenant", entityId: input.id, reason: input.reason });
      return { success: true };
    }),

  // ─── USUÁRIOS (somente PLATFORM_ADMIN) ────────────────────────────────────

  listUsers: platformAdminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select(safeUserColumns).from(users).where(isNull(users.deletedAt));
  }),

  createUser: platformAdminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        email: z.string().email(),
        password: z.string().min(6, "A senha deve ter ao menos 6 caracteres"),
        role: z.enum(["PLATFORM_ADMIN", "CANARIL_MANAGER", "CANARIL_MEMBER", "VIEWER"]).default("CANARIL_MANAGER"),
        tenantId: z.number().int().positive().optional(),
        isActive: z.boolean().default(true).optional(),
        mustChangePassword: z.boolean().default(true).optional(),
        accessExpiresAt: z.string().optional().nullable(),
        internalNote: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível.");
      const uid = ctx.user.id;

      // Verificar se email já existe
      const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (existing.length > 0) {
        throw new Error("E-mail já está em uso.");
      }
      // Se não for PLATFORM_ADMIN, require tenantId
      if (input.role !== "PLATFORM_ADMIN" && !input.tenantId) {
        throw new Error("tenantId é obrigatório para usuários não administradores da plataforma.");
      }

      const passwordHash = await hashPassword(input.password);

      // Gera openId único para usuários criados manualmente
      const openId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const [created] = await db.insert(users).values({
        openId,
        name: input.name,
        email: input.email,
        role: input.role,
        tenantId: input.role === "PLATFORM_ADMIN" ? null : input.tenantId ?? null,
        isActive: input.isActive ?? true,
        loginMethod: "local",
        passwordHash,
        mustChangePassword: input.mustChangePassword ?? true,
        accessExpiresAt: input.accessExpiresAt ? new Date(input.accessExpiresAt as any) : null,
        internalNote: input.internalNote ?? null,
        lastSignedIn: new Date(),
      }).returning(safeUserColumns);
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
      const uid = ctx.user.id;
      const { id, ...patch } = input;

      // Proteção absoluta: verificar se o alvo é o último PLATFORM_ADMIN
      const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!target) throw new Error("Usuário não encontrado.");
      if (target.role === "PLATFORM_ADMIN" && patch.role && patch.role !== "PLATFORM_ADMIN") {
        const admins = await db.select({ id: users.id }).from(users)
          .where(and(eq(users.role, "PLATFORM_ADMIN"), isNull(users.deletedAt)));
        if (admins.length === 1) throw new Error("Não é possível rebaixar o único PLATFORM_ADMIN do sistema.");
      }

      const [updated] = await db.update(users).set(patch as any).where(eq(users.id, id)).returning(safeUserColumns);
      await writeAudit(db, { userId: uid, action: "update", entityType: "user", entityId: id, newVal: updated });
      return updated;
    }),

  /** Reseta a senha usando o mesmo formato seguro e versionado do login. */
  resetPassword: platformAdminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      newPassword: z.string().min(6, "A senha deve ter ao menos 6 caracteres"),
      forceChangeOnNextLogin: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível.");
      const uid = ctx.user.id;

      const [target] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, input.id), isNull(users.deletedAt))).limit(1);
      if (!target) throw new Error("Usuário não encontrado.");

      const passwordHash = await hashPassword(input.newPassword);

      await db.update(users).set({
        passwordHash,
        loginMethod: "local",
        mustChangePassword: input.forceChangeOnNextLogin,
      }).where(eq(users.id, input.id));

      await writeAudit(db, { userId: uid, action: "reset_password", entityType: "user", entityId: input.id });
      return { success: true };
    }),

  disableUser: platformAdminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível.");
      const uid = ctx.user.id;
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
      const uid = ctx.user.id;
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
      const uid = ctx.user.id;
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

  softDelete: canarilManagerProcedure
    .input(z.object({
      entityType: z.enum(["bird","ring","ring_batch","couple","clutch","chick","cage","championship"]),
      id: z.number().int().positive(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível.");
      const uid = ctx.user.id;
      const tenantId = getOperationalTenantId(ctx);
      const table = operationalTableMap[input.entityType] as any;
      const condition = operationalEntityCondition(table, input.id, tenantId);
      const [entity] = await (db.select({ id: table.id, tenantId: table.tenantId }).from(table) as any).where(condition).limit(1);
      if (!entity) throw new Error("Registro não encontrado ou sem acesso para este canaril.");

      if (input.entityType === "clutch") {
        const chickCount = await db.select({ id: chicks.id }).from(chicks).where(and(
          eq(chicks.clutchId, input.id),
          ...(tenantId === null ? [] : [eq(chicks.tenantId, tenantId)]),
          isNull(chicks.deletedAt),
        ));
        if (chickCount.length > 0) {
          throw new Error(`Esta postura tem ${chickCount.length} filhote(s). Desvincule ou arquive os filhotes primeiro.`);
        }
      }
      if (input.entityType === "cage") {
        const occupying = await db.select({ id: couples.id }).from(couples).where(and(
          eq(couples.cageId, input.id),
          ...(tenantId === null ? [] : [eq(couples.tenantId, tenantId)]),
          eq(couples.status, "active"),
          isNull(couples.deletedAt),
        ));
        if (occupying.length > 0) throw new Error("Gaiola ocupada por casal ativo. Finalize o casal antes de arquivar a gaiola.");
      }
      if (input.entityType === "ring") {
        const [ring] = await db.select({ birdId: rings.birdId, chickId: rings.chickId, usedAt: rings.usedAt })
          .from(rings).where(operationalEntityCondition(rings, input.id, tenantId)).limit(1);
        if (ring?.birdId || ring?.chickId || ring?.usedAt) {
          throw new Error("Anilha possui histórico de utilização e não pode ser arquivada. Marque-a como perdida ou danificada.");
        }
      }
      if (input.entityType === "ring_batch") {
        const used = await db.select({ id: rings.id }).from(rings).where(and(
          eq(rings.batchId, input.id),
          ...(tenantId === null ? [] : [eq(rings.tenantId, tenantId)]),
          sql`(${rings.birdId} IS NOT NULL OR ${rings.chickId} IS NOT NULL OR ${rings.usedAt} IS NOT NULL)`,
        )).limit(1);
        if (used.length > 0) throw new Error("Lote possui anilhas com histórico de uso e não pode ser arquivado.");
      }

      await (db.update(table) as any).set(softDeletePatch(uid)).where(condition);
      await writeAudit(db, {
        tenantId: entity.tenantId ?? tenantId, userId: uid, action: "soft_delete",
        entityType: input.entityType, entityId: input.id, reason: input.reason,
      });
      return { success: true };
    }),

  // ─── RESTAURAR ───────────────────────────────────────────────────────────

  restore: canarilManagerProcedure
    .input(z.object({
      entityType: z.enum(["bird","ring","ring_batch","couple","clutch","chick","cage","championship","user","tenant"]),
      id: z.number().int().positive(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível.");

      if (input.entityType === "user" || input.entityType === "tenant") {
        if (!callerIsPlatformAdmin(ctx)) throw new Error("Somente o administrador da plataforma pode restaurar usuários ou canaris.");
        const table = input.entityType === "user" ? users : tenants;
        const [restored] = await db.update(table as any).set(restorePatch()).where(eq((table as any).id, input.id)).returning({ id: (table as any).id });
        if (!restored) throw new Error("Registro não encontrado.");
        await writeAudit(db, { userId: ctx.user.id, action: "restore", entityType: input.entityType, entityId: input.id });
        return { success: true };
      }

      const tenantId = getOperationalTenantId(ctx);
      const table = operationalTableMap[input.entityType] as any;
      const condition = operationalEntityCondition(table, input.id, tenantId);
      const [entity] = await (db.select({ id: table.id, tenantId: table.tenantId }).from(table) as any).where(condition).limit(1);
      if (!entity) throw new Error("Registro não encontrado ou sem acesso para este canaril.");
      await (db.update(table) as any).set(restorePatch()).where(condition);
      await writeAudit(db, { tenantId: entity.tenantId ?? tenantId, userId: ctx.user.id, action: "restore", entityType: input.entityType, entityId: input.id });
      return { success: true };
    }),

  // ─── LIXEIRA ─────────────────────────────────────────────────────────────

  listTrash: protectedProcedure
    .input(z.object({ entityType: z.enum(["bird","ring","ring_batch","couple","clutch","chick","cage","championship","user"]).optional() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return {};
      const platformAdmin = callerIsPlatformAdmin(ctx);
      const tenantId = platformAdmin ? null : getCurrentTenantId(ctx);

      if (input.entityType === "user" && !platformAdmin) {
        throw new Error("Somente o administrador da plataforma pode consultar usuários removidos.");
      }

      const allTypes = platformAdmin
        ? (["bird","ring","ring_batch","couple","clutch","chick","cage","championship","user"] as const)
        : (["bird","ring","ring_batch","couple","clutch","chick","cage","championship"] as const);
      const toFetch = input.entityType ? [input.entityType] : [...allTypes];
      const results: Array<{ label: string; rows: unknown[] }> = [];

      for (const entityType of toFetch) {
        if (entityType === "user") {
          const rows = await db.select(safeUserColumns).from(users).where(isNotNull(users.deletedAt));
          results.push({ label: entityType, rows });
          continue;
        }
        const table = operationalTableMap[entityType as keyof typeof operationalTableMap] as any;
        const rows = await (db.select().from(table) as any).where(tenantDeletedCondition(table, tenantId));
        results.push({ label: entityType, rows });
      }
      return Object.fromEntries(results.map((result) => [result.label, result.rows]));
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
      const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant
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

  previewTestCleanup: canarilManagerProcedure
    .input(z.object({ prefix: z.string().min(1).max(50) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const tenantId = getOperationalTenantId(ctx);
      const pat = `${input.prefix}%`;
      const tenantBird = tenantId === null ? [] : [eq(birds.tenantId, tenantId)];
      const tenantCouple = tenantId === null ? [] : [eq(couples.tenantId, tenantId)];
      const tenantRing = tenantId === null ? [] : [eq(rings.tenantId, tenantId)];
      const tenantCage = tenantId === null ? [] : [eq(cages.tenantId, tenantId)];

      const birdRows = await db.select({ id: birds.id }).from(birds).where(and(ilike(birds.ring, pat), ...tenantBird, isNull(birds.deletedAt)));
      const birdIds = birdRows.map((row) => row.id);
      const coupleRows = birdIds.length === 0 ? [] : await db.select({ id: couples.id }).from(couples).where(and(
        ...tenantCouple,
        or(inArray(couples.maleId, birdIds), inArray(couples.femaleId, birdIds)),
        isNull(couples.deletedAt),
      ));
      const coupleIds = coupleRows.map((row) => row.id);
      const clutchRows = coupleIds.length === 0 ? [] : await db.select({ id: clutches.id }).from(clutches).where(and(
        inArray(clutches.coupleId, coupleIds),
        ...(tenantId === null ? [] : [eq(clutches.tenantId, tenantId)]),
        isNull(clutches.deletedAt),
      ));
      const [ringRows, cageRows] = await Promise.all([
        db.select({ id: rings.id }).from(rings).where(and(ilike(rings.number, pat), ...tenantRing, isNull(rings.deletedAt))),
        db.select({ id: cages.id }).from(cages).where(and(ilike(cages.code, pat), ...tenantCage, isNull(cages.deletedAt))),
      ]);

      return {
        prefix: input.prefix, birds: birdRows.length, couples: coupleRows.length,
        clutches: clutchRows.length, rings: ringRows.length, cages: cageRows.length,
        total: birdRows.length + coupleRows.length + clutchRows.length + ringRows.length + cageRows.length,
      };
    }),

  // ─── EXECUTAR LIMPEZA DE TESTES ──────────────────────────────────────────

  executeTestCleanup: canarilManagerProcedure
    .input(z.object({
      prefix: z.string().min(1).max(50),
      confirm: z.literal("LIMPAR TESTES"),
      hardDelete: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível.");
      if (input.hardDelete) {
        throw new Error("Exclusão física foi desativada para preservar histórico e integridade referencial. Use a limpeza segura (soft delete).");
      }

      const uid = ctx.user.id;
      const tenantId = getOperationalTenantId(ctx);
      const pat = `${input.prefix}%`;
      const now = new Date();
      const tenantBird = tenantId === null ? [] : [eq(birds.tenantId, tenantId)];
      const tenantCage = tenantId === null ? [] : [eq(cages.tenantId, tenantId)];

      const testBirds = await db.select({ id: birds.id }).from(birds).where(and(ilike(birds.ring, pat), ...tenantBird, isNull(birds.deletedAt)));
      const testCages = await db.select({ id: cages.id }).from(cages).where(and(ilike(cages.code, pat), ...tenantCage, isNull(cages.deletedAt)));

      let deleted = 0;
      for (const bird of testBirds) {
        await db.update(birds).set({ deletedAt: now, deletedBy: uid } as any).where(and(eq(birds.id, bird.id), ...tenantBird));
        deleted++;
      }
      for (const cage of testCages) {
        const occupied = await db.select({ id: couples.id }).from(couples).where(and(
          eq(couples.cageId, cage.id),
          ...(tenantId === null ? [] : [eq(couples.tenantId, tenantId)]),
          eq(couples.status, "active"),
          isNull(couples.deletedAt),
        )).limit(1);
        if (occupied.length > 0) continue;
        await db.update(cages).set({ deletedAt: now, deletedBy: uid } as any).where(and(eq(cages.id, cage.id), ...tenantCage));
        deleted++;
      }

      await writeAudit(db, {
        tenantId, userId: uid, action: "bulk_delete", entityType: "test_data",
        reason: `Limpeza segura: prefixo "${input.prefix}", ${deleted} itens arquivados`,
      });
      return { deleted, prefix: input.prefix, hardDelete: false };
    }),
});
