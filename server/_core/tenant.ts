/**
 * tenant.ts — Helpers centrais de isolamento multi-canaril
 *
 * Regras:
 *   PLATFORM_ADMIN  → acesso global a qualquer tenant
 *   CANARIL_MANAGER → acesso SOMENTE ao próprio tenantId
 *   CANARIL_MEMBER  → acesso SOMENTE ao próprio tenantId
 *   VIEWER          → acesso SOMENTE ao próprio tenantId (leitura)
 *
 * O tenantId SEMPRE vem da sessão (ctx.user), nunca do input do frontend.
 */
import { TRPCError } from "@trpc/server";

const ADMIN_ROLES = ["PLATFORM_ADMIN", "admin", "OWNER", "SUPER_ADMIN"];

/** True se o usuário é administrador global da plataforma */
export function isPlatformAdmin(ctx: any): boolean {
  return ADMIN_ROLES.includes(ctx?.user?.role ?? "");
}

/** Lança FORBIDDEN se não for PLATFORM_ADMIN */
export function requirePlatformAdmin(ctx: any): void {
  if (!isPlatformAdmin(ctx)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso negado. Seu usuário não possui permissão para administrar acessos.",
    });
  }
}

/**
 * Retorna o tenantId da sessão.
 * Para usuários operacionais, lança erro se não tiver tenantId.
 * Para PLATFORM_ADMIN, retorna null (acesso global).
 */
export function getCurrentTenantId(ctx: any): number | null {
  const user = ctx?.user as any;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário não autenticado." });

  // Admin global não precisa de tenant para acesso global
  if (isPlatformAdmin(ctx)) return user.tenantId ?? null;

  const tenantId = user.tenantId ?? null;
  if (tenantId === null || tenantId === undefined) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Seu usuário não está vinculado a um canaril. Entre em contato com o administrador.",
    });
  }
  return tenantId;
}

/**
 * Para rotas operacionais: garante tenantId e retorna o valor.
 * PLATFORM_ADMIN sem tenantId retorna null (acesso global).
 * Usuário operacional sem tenantId lança erro.
 */
export function requireTenantId(ctx: any): number {
  const tenantId = getCurrentTenantId(ctx);
  if (tenantId === null) {
    // PLATFORM_ADMIN sem tenant configurado — não pode operar sem tenant
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Administrador sem canaril configurado. Configure um tenant principal nas configurações.",
    });
  }
  return tenantId;
}

/**
 * Constrói o filtro WHERE para queries que devem ser tenant-scoped.
 * Retorna o tenantId para usar no WHERE, ou null se admin global sem tenant.
 *
 * Uso típico:
 *   const tid = getQueryTenantId(ctx);
 *   if (tid !== null) query = query.where(eq(table.tenantId, tid));
 */
export function getQueryTenantId(ctx: any): number | null {
  return getCurrentTenantId(ctx);
}

/**
 * Verifica se o usuário tem acesso a uma entidade de um tenant específico.
 * PLATFORM_ADMIN tem acesso a qualquer tenant.
 * CANARIL_MANAGER só tem acesso ao próprio.
 */
export function assertSameTenant(ctx: any, entityTenantId: number | null | undefined): void {
  if (isPlatformAdmin(ctx)) return;

  const userTenantId = (ctx?.user as any)?.tenantId ?? null;

  // Entidade sem tenant (dado legado) — PLATFORM_ADMIN pode acessar; outros não
  if (entityTenantId === null || entityTenantId === undefined) {
    if (!isPlatformAdmin(ctx)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Acesso negado. Este recurso não está vinculado ao seu canaril.",
      });
    }
    return;
  }

  if (userTenantId !== entityTenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso negado. Este recurso pertence a outro canaril.",
    });
  }
}

/**
 * Alias para assertSameTenant — usado em queries de tenant access.
 */
export function requireTenantAccess(ctx: any, entityTenantId: number | null | undefined): void {
  assertSameTenant(ctx, entityTenantId);
}
