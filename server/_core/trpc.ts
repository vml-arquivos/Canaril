/**
 * trpc.ts — Procedures e helpers de autorização do Canaril
 *
 * Roles:
 *   PLATFORM_ADMIN  — administrador global (cria/suspende usuários, acessa tudo)
 *   CANARIL_MANAGER — responsável do canaril (acesso operacional ao próprio tenant)
 *   CANARIL_MEMBER  — membro com acesso limitado ao próprio tenant
 *   VIEWER          — somente leitura
 */
import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

export const router           = t.router;
export const publicProcedure  = t.procedure;

// ─── Roles ───────────────────────────────────────────────────────────────────

export const PLATFORM_ADMIN   = "PLATFORM_ADMIN";
export const CANARIL_MANAGER  = "CANARIL_MANAGER";
export const CANARIL_MEMBER   = "CANARIL_MEMBER";
export const VIEWER           = "VIEWER";

/** Qualquer role que dá acesso ao painel operacional */
export const OPERATIONAL_ROLES = [PLATFORM_ADMIN, CANARIL_MANAGER, CANARIL_MEMBER];

/** Roles legados mapeados como PLATFORM_ADMIN (retrocompatibilidade) */
function isPlatformAdmin(role: string | null | undefined): boolean {
  return role === PLATFORM_ADMIN || role === "admin" || role === "OWNER" || role === "SUPER_ADMIN";
}

function isCanarilManager(role: string | null | undefined): boolean {
  return role === CANARIL_MANAGER;
}

function isOperational(role: string | null | undefined): boolean {
  return isPlatformAdmin(role) || isCanarilManager(role) || role === CANARIL_MEMBER;
}

// ─── Middleware base: usuário autenticado ─────────────────────────────────────

const requireUser = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  // Verificar suspensão (isActive pode não existir em users legados)
  const user = ctx.user as any;
  if (user.isActive === false) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Seu acesso está suspenso. Entre em contato com o administrador da plataforma.",
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// ─── Procedures públicas e protegidas ─────────────────────────────────────────

/** Qualquer usuário autenticado (e ativo) */
export const protectedProcedure = t.procedure.use(requireUser);

/** Somente PLATFORM_ADMIN */
export const platformAdminProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    const user = ctx.user as any;
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    if (user.isActive === false) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Acesso suspenso." });
    }
    if (!isPlatformAdmin(user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Acesso negado. Somente administradores da plataforma podem executar esta ação.",
      });
    }
    return next({ ctx: { ...ctx, user } });
  })
);

/**
 * Retrocompatibilidade: adminProcedure agora mapeia para platformAdminProcedure.
 * Todo código que usava adminProcedure continua funcionando.
 */
export const adminProcedure = platformAdminProcedure;

/** CANARIL_MANAGER ou PLATFORM_ADMIN (acesso operacional) */
export const canarilManagerProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    const user = ctx.user as any;
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    if (user.isActive === false) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Acesso suspenso." });
    }
    if (!isOperational(user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado." });
    }
    return next({ ctx: { ...ctx, user } });
  })
);

// ─── Helpers de autorização (usados nos routers) ─────────────────────────────

/** Lança FORBIDDEN se o usuário não for PLATFORM_ADMIN */
export function requirePlatformAdmin(ctx: any): void {
  const user = ctx.user as any;
  if (!isPlatformAdmin(user?.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso negado. Seu usuário não possui permissão para administrar acessos.",
    });
  }
}

/**
 * Lança FORBIDDEN se o usuário não tiver acesso ao tenantId informado.
 * PLATFORM_ADMIN tem acesso a qualquer tenant.
 */
export function requireTenantAccess(ctx: any, targetTenantId: number | null | undefined): void {
  const user = ctx.user as any;
  if (isPlatformAdmin(user?.role)) return; // admin global tem acesso total
  if (!targetTenantId) return; // sem tenant = dado global/sem restrição de tenant
  if (user?.tenantId !== targetTenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso negado. Este recurso pertence a outro canaril.",
    });
  }
}

/**
 * Lança FORBIDDEN se o tenantId da entidade não pertencer ao usuário atual.
 * Usado para proteger mutations em entidades com campo tenantId.
 */
export function requireOwnTenantEntity(ctx: any, entityTenantId: number | null | undefined): void {
  requireTenantAccess(ctx, entityTenantId);
}

/** Obtém o tenantId do usuário autenticado (nunca do input) */
export function getCallerTenantId(ctx: any): number | null {
  const user = ctx.user as any;
  return user?.tenantId ?? null;
}

/** Verifica se é PLATFORM_ADMIN */
export function callerIsPlatformAdmin(ctx: any): boolean {
  return isPlatformAdmin((ctx.user as any)?.role);
}
