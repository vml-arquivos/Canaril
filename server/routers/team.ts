/**
 * team.ts — Gestão de equipe do próprio canaril (self-service)
 * ============================================================================
 * Permite que o responsável do canaril (role CANARIL_MANAGER) convide e
 * gerencie membros da sua própria equipe (CANARIL_MEMBER / VIEWER), sem
 * precisar de um PLATFORM_ADMIN para cada usuário novo.
 *
 * Reaproveita exatamente o mesmo esquema de hash de senha (scrypt + sal fixo
 * "canaril-salt") já usado em server/routers.ts (verificação de login) e
 * server/routers/admin.ts (criação de usuário pelo admin da plataforma) —
 * criar um usuário aqui com um hash diferente quebraria o login dele.
 *
 * Restrições de segurança deliberadas:
 *   - Só CANARIL_MANAGER (ou PLATFORM_ADMIN) pode convidar/gerenciar.
 *   - Um manager só enxerga/edita usuários do PRÓPRIO tenantId — nunca
 *     recebe tenantId pelo input.
 *   - Só é possível criar/promover para CANARIL_MEMBER ou VIEWER — nunca
 *     para CANARIL_MANAGER ou PLATFORM_ADMIN por este router (evita
 *     auto-escalação de privilégio; promover a manager continua exclusivo
 *     do painel de PLATFORM_ADMIN em admin.ts).
 *   - Ninguém remove a si mesmo por aqui.
 * ============================================================================
 */
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users, audit_logs } from "../../drizzle/schema";

const INVITABLE_ROLES = ["CANARIL_MEMBER", "VIEWER"] as const;

function isPlatformAdmin(role: string | null | undefined): boolean {
  return role === "PLATFORM_ADMIN" || role === "admin" || role === "OWNER" || role === "SUPER_ADMIN";
}

function requireTeamManager(ctx: any): { tenantId: number; userId: number } {
  const caller = ctx.user as any;
  const isManager = caller?.role === "CANARIL_MANAGER" || isPlatformAdmin(caller?.role);
  if (!isManager) {
    throw new Error("Apenas o responsável do canaril pode gerenciar a equipe.");
  }
  const tenantId = caller?.tenantId;
  if (!tenantId) {
    throw new Error("Seu usuário não está vinculado a um canaril (tenant).");
  }
  return { tenantId, userId: caller.id };
}

async function hashPassword(password: string): Promise<string> {
  const crypto = await import("crypto");
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, "canaril-salt", 64, (err: any, derivedKey: Buffer) => {
      if (err) return reject(err);
      resolve(derivedKey.toString("hex"));
    });
  });
}

async function writeAudit(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  params: { userId?: number; action: string; entityId?: number; newVal?: unknown }
) {
  await db
    .insert(audit_logs)
    .values({
      userId: params.userId ?? null,
      action: params.action,
      entityType: "user",
      entityId: params.entityId ?? null,
      newValueJson: params.newVal ? (params.newVal as object) : null,
    })
    .catch(() => {}); // auditoria nunca deve quebrar a operação principal
}

export const teamRouter = router({
  /** Lista os membros ativos (não excluídos) do PRÓPRIO canaril. */
  myTeam: protectedProcedure.query(async ({ ctx }) => {
    const { tenantId } = requireTeamManager(ctx);
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        mustChangePassword: users.mustChangePassword,
        lastSignedIn: users.lastSignedIn,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), isNull(users.deletedAt)));
    return rows;
  }),

  /** Convida (cria) um novo membro no PRÓPRIO canaril. */
  inviteMember: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        email: z.string().email(),
        password: z.string().min(6, "A senha deve ter ao menos 6 caracteres"),
        role: z.enum(INVITABLE_ROLES).default("CANARIL_MEMBER"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId, userId } = requireTeamManager(ctx);
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível.");

      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
      if (existing) throw new Error("Já existe um usuário com esse e-mail.");

      const passwordHash = await hashPassword(input.password);
      const openId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const [created] = await db
        .insert(users)
        .values({
          openId,
          name: input.name,
          email: input.email,
          role: input.role,
          tenantId,
          isActive: true,
          loginMethod: "local",
          passwordHash,
          mustChangePassword: true,
          lastSignedIn: new Date(),
        })
        .returning({ id: users.id, name: users.name, email: users.email, role: users.role });

      await writeAudit(db, { userId, action: "team_invite", entityId: created.id, newVal: created });
      return created;
    }),

  /** Atualiza um membro do PRÓPRIO canaril (nome, papel, ativo/inativo). Nunca promove a manager/admin. */
  updateMember: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(200).optional(),
        role: z.enum(INVITABLE_ROLES).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId, userId } = requireTeamManager(ctx);
      if (input.id === userId) throw new Error("Você não pode editar a própria conta por aqui.");
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível.");

      const [target] = await db.select({ id: users.id, role: users.role }).from(users).where(and(eq(users.id, input.id), eq(users.tenantId, tenantId), isNull(users.deletedAt)));
      if (!target) throw new Error("Membro não encontrado na sua equipe.");
      if (isPlatformAdmin(target.role) || target.role === "CANARIL_MANAGER") {
        throw new Error("Este usuário não pode ser gerenciado por aqui.");
      }

      const [updated] = await db
        .update(users)
        .set({ name: input.name, role: input.role, isActive: input.isActive })
        .where(eq(users.id, input.id))
        .returning({ id: users.id, name: users.name, email: users.email, role: users.role, isActive: users.isActive });

      await writeAudit(db, { userId, action: "team_update", entityId: input.id, newVal: updated });
      return updated;
    }),

  /** Remove (soft delete) um membro do PRÓPRIO canaril. */
  removeMember: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { tenantId, userId } = requireTeamManager(ctx);
      if (input.id === userId) throw new Error("Você não pode remover a própria conta por aqui.");
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível.");

      const [target] = await db.select({ id: users.id, role: users.role }).from(users).where(and(eq(users.id, input.id), eq(users.tenantId, tenantId), isNull(users.deletedAt)));
      if (!target) throw new Error("Membro não encontrado na sua equipe.");
      if (isPlatformAdmin(target.role) || target.role === "CANARIL_MANAGER") {
        throw new Error("Este usuário não pode ser removido por aqui.");
      }

      await db.update(users).set({ deletedAt: new Date(), deletedBy: userId, isActive: false }).where(eq(users.id, input.id));
      await writeAudit(db, { userId, action: "team_remove", entityId: input.id });
      return { success: true };
    }),
});
