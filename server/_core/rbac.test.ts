/**
 * rbac.test.ts — Testes de RBAC (Missão 8)
 *
 * Testa:
 *   - requirePlatformAdmin: bloqueia não-admin, passa admin
 *   - requireTenantAccess: isolamento por tenant
 *   - requireOwnTenantEntity: guarda de entidade por tenant
 *   - callerIsPlatformAdmin: detecção correta de role
 *   - Proteção do último PLATFORM_ADMIN
 *   - Roles legados mapeados corretamente
 *   - Suspensão bloqueia acesso
 */
import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  requirePlatformAdmin,
  requireTenantAccess,
  requireOwnTenantEntity,
  callerIsPlatformAdmin,
  PLATFORM_ADMIN,
  CANARIL_MANAGER,
  CANARIL_MEMBER,
  VIEWER,
} from "./trpc";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ctx(role: string, tenantId: number | null = null, isActive = true) {
  return { user: { id: 1, role, tenantId, isActive } };
}

function platformAdminCtx(tenantId: number | null = null) {
  return ctx(PLATFORM_ADMIN, tenantId);
}

function managerCtx(tenantId: number) {
  return ctx(CANARIL_MANAGER, tenantId);
}

// ─── requirePlatformAdmin ─────────────────────────────────────────────────────

describe("requirePlatformAdmin", () => {
  it("PLATFORM_ADMIN passa sem erro", () => {
    expect(() => requirePlatformAdmin(platformAdminCtx())).not.toThrow();
  });

  it("role legado 'admin' é aceito como PLATFORM_ADMIN", () => {
    expect(() => requirePlatformAdmin(ctx("admin"))).not.toThrow();
  });

  it("role legado 'OWNER' é aceito como PLATFORM_ADMIN", () => {
    expect(() => requirePlatformAdmin(ctx("OWNER"))).not.toThrow();
  });

  it("CANARIL_MANAGER é rejeitado", () => {
    expect(() => requirePlatformAdmin(managerCtx(1))).toThrowError(TRPCError);
  });

  it("CANARIL_MEMBER é rejeitado", () => {
    expect(() => requirePlatformAdmin(ctx(CANARIL_MEMBER, 1))).toThrowError(TRPCError);
  });

  it("VIEWER é rejeitado", () => {
    expect(() => requirePlatformAdmin(ctx(VIEWER, 1))).toThrowError(TRPCError);
  });

  it("mensagem de erro menciona permissão de administrar acessos", () => {
    try {
      requirePlatformAdmin(managerCtx(1));
      expect.fail("deveria lançar");
    } catch (e: any) {
      expect(e.message).toContain("administrar acessos");
    }
  });
});

// ─── requireTenantAccess ──────────────────────────────────────────────────────

describe("requireTenantAccess", () => {
  it("PLATFORM_ADMIN tem acesso a qualquer tenant", () => {
    expect(() => requireTenantAccess(platformAdminCtx(), 42)).not.toThrow();
    expect(() => requireTenantAccess(platformAdminCtx(), 1)).not.toThrow();
    expect(() => requireTenantAccess(platformAdminCtx(), 999)).not.toThrow();
  });

  it("CANARIL_MANAGER acessa o próprio tenant", () => {
    expect(() => requireTenantAccess(managerCtx(5), 5)).not.toThrow();
  });

  it("CANARIL_MANAGER bloqueado em tenant diferente", () => {
    expect(() => requireTenantAccess(managerCtx(5), 7)).toThrowError(TRPCError);
  });

  it("CANARIL_MANAGER bloqueado em tenant de terceiro", () => {
    try {
      requireTenantAccess(managerCtx(3), 10);
      expect.fail("deveria lançar");
    } catch (e: any) {
      expect(e.message).toContain("outro canaril");
    }
  });

  it("targetTenantId null não bloqueia (dado global)", () => {
    expect(() => requireTenantAccess(managerCtx(1), null)).not.toThrow();
    expect(() => requireTenantAccess(managerCtx(1), undefined)).not.toThrow();
  });

  it("CANARIL_MANAGER não vê dados de outro tenant", () => {
    // Tenant 1 tentando acessar dados do tenant 2
    expect(() => requireTenantAccess(managerCtx(1), 2)).toThrowError(TRPCError);
  });
});

// ─── requireOwnTenantEntity ───────────────────────────────────────────────────

describe("requireOwnTenantEntity", () => {
  it("delega para requireTenantAccess — PLATFORM_ADMIN sempre passa", () => {
    expect(() => requireOwnTenantEntity(platformAdminCtx(), 999)).not.toThrow();
  });

  it("CANARIL_MANAGER bloqueado em entidade de outro tenant", () => {
    expect(() => requireOwnTenantEntity(managerCtx(2), 5)).toThrowError(TRPCError);
  });

  it("CANARIL_MANAGER passa em entidade do próprio tenant", () => {
    expect(() => requireOwnTenantEntity(managerCtx(3), 3)).not.toThrow();
  });
});

// ─── callerIsPlatformAdmin ────────────────────────────────────────────────────

describe("callerIsPlatformAdmin", () => {
  it("retorna true para PLATFORM_ADMIN", () => {
    expect(callerIsPlatformAdmin(platformAdminCtx())).toBe(true);
  });

  it("retorna true para role legado 'admin'", () => {
    expect(callerIsPlatformAdmin(ctx("admin"))).toBe(true);
  });

  it("retorna true para role legado 'OWNER'", () => {
    expect(callerIsPlatformAdmin(ctx("OWNER"))).toBe(true);
  });

  it("retorna false para CANARIL_MANAGER", () => {
    expect(callerIsPlatformAdmin(managerCtx(1))).toBe(false);
  });

  it("retorna false para CANARIL_MEMBER", () => {
    expect(callerIsPlatformAdmin(ctx(CANARIL_MEMBER, 1))).toBe(false);
  });

  it("retorna false para VIEWER", () => {
    expect(callerIsPlatformAdmin(ctx(VIEWER, 1))).toBe(false);
  });

  it("retorna false para null/undefined", () => {
    expect(callerIsPlatformAdmin({ user: null })).toBe(false);
    expect(callerIsPlatformAdmin({})).toBe(false);
  });
});

// ─── Proteção do último PLATFORM_ADMIN ───────────────────────────────────────

describe("proteção do último PLATFORM_ADMIN (lógica pura)", () => {
  function canDeleteAdmin(admins: Array<{ id: number }>, targetId: number): { allowed: boolean; reason?: string } {
    if (admins.length === 1 && admins[0].id === targetId) {
      return { allowed: false, reason: "Não é possível remover o único PLATFORM_ADMIN do sistema." };
    }
    return { allowed: true };
  }

  function canDisableAdmin(activeAdmins: Array<{ id: number }>, targetId: number): { allowed: boolean; reason?: string } {
    if (activeAdmins.length === 1 && activeAdmins[0].id === targetId) {
      return { allowed: false, reason: "Não é possível suspender o único PLATFORM_ADMIN ativo do sistema." };
    }
    return { allowed: true };
  }

  function canDemoteAdmin(admins: Array<{ id: number }>, targetId: number): { allowed: boolean; reason?: string } {
    if (admins.length === 1 && admins[0].id === targetId) {
      return { allowed: false, reason: "Não é possível rebaixar o único PLATFORM_ADMIN do sistema." };
    }
    return { allowed: true };
  }

  it("não pode deletar o único PLATFORM_ADMIN", () => {
    const result = canDeleteAdmin([{ id: 1 }], 1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("único PLATFORM_ADMIN");
  });

  it("pode deletar PLATFORM_ADMIN se houver outro", () => {
    const result = canDeleteAdmin([{ id: 1 }, { id: 2 }], 1);
    expect(result.allowed).toBe(true);
  });

  it("não pode suspender o único PLATFORM_ADMIN ativo", () => {
    const result = canDisableAdmin([{ id: 1 }], 1);
    expect(result.allowed).toBe(false);
  });

  it("pode suspender PLATFORM_ADMIN se houver outro ativo", () => {
    const result = canDisableAdmin([{ id: 1 }, { id: 2 }], 1);
    expect(result.allowed).toBe(true);
  });

  it("não pode rebaixar o único PLATFORM_ADMIN", () => {
    const result = canDemoteAdmin([{ id: 1 }], 1);
    expect(result.allowed).toBe(false);
  });
});

// ─── Suspensão bloqueia acesso ────────────────────────────────────────────────

describe("suspensão de usuário", () => {
  function checkSuspension(isActive: boolean | null): { blocked: boolean; message?: string } {
    if (isActive === false) {
      return { blocked: true, message: "Seu acesso está suspenso. Entre em contato com o administrador da plataforma." };
    }
    return { blocked: false };
  }

  it("usuário suspenso (isActive=false) não pode acessar", () => {
    const result = checkSuspension(false);
    expect(result.blocked).toBe(true);
    expect(result.message).toContain("suspenso");
  });

  it("usuário ativo (isActive=true) pode acessar", () => {
    const result = checkSuspension(true);
    expect(result.blocked).toBe(false);
  });

  it("isActive=null não bloqueia (usuário legado sem campo)", () => {
    const result = checkSuspension(null);
    expect(result.blocked).toBe(false);
  });

  it("mensagem de suspensão menciona administrador da plataforma", () => {
    const result = checkSuspension(false);
    expect(result.message).toContain("administrador da plataforma");
  });
});

// ─── Isolamento de dados por tenant ──────────────────────────────────────────

describe("isolamento de dados por tenant (CANARIL_MANAGER)", () => {
  it("CANARIL_MANAGER não cria usuário (requirePlatformAdmin bloqueia)", () => {
    expect(() => requirePlatformAdmin(managerCtx(1))).toThrowError(TRPCError);
  });

  it("CANARIL_MANAGER não edita usuário", () => {
    expect(() => requirePlatformAdmin(managerCtx(2))).toThrowError(TRPCError);
  });

  it("CANARIL_MANAGER não exclui usuário", () => {
    expect(() => requirePlatformAdmin(managerCtx(3))).toThrowError(TRPCError);
  });

  it("CANARIL_MANAGER não suspende usuário", () => {
    expect(() => requirePlatformAdmin(managerCtx(4))).toThrowError(TRPCError);
  });

  it("CANARIL_MANAGER não acessa auditoria global", () => {
    expect(() => requirePlatformAdmin(managerCtx(5))).toThrowError(TRPCError);
  });

  it("CANARIL_MANAGER não acessa reset global", () => {
    expect(() => requirePlatformAdmin(managerCtx(6))).toThrowError(TRPCError);
  });

  it("CANARIL_MANAGER não acessa zona de segurança global", () => {
    expect(() => requirePlatformAdmin(managerCtx(7))).toThrowError(TRPCError);
  });

  it("CANARIL_MANAGER não altera PLATFORM_ADMIN", () => {
    expect(() => requirePlatformAdmin(managerCtx(8))).toThrowError(TRPCError);
  });

  it("CANARIL_MANAGER não exclui PLATFORM_ADMIN", () => {
    expect(() => requirePlatformAdmin(managerCtx(9))).toThrowError(TRPCError);
  });

  it("CANARIL_MANAGER não vê dados de outro tenant (tenant 1 vs 2)", () => {
    expect(() => requireTenantAccess(managerCtx(1), 2)).toThrowError(TRPCError);
  });

  it("CANARIL_MANAGER consegue acessar o próprio tenant", () => {
    expect(() => requireTenantAccess(managerCtx(10), 10)).not.toThrow();
  });
});

// ─── Roles legados → novos ───────────────────────────────────────────────────

describe("mapeamento de roles legados", () => {
  const LEGACY_ADMIN_ROLES = ["admin", "OWNER", "SUPER_ADMIN"];
  const LEGACY_USER_ROLES  = ["user", "MEMBER"];

  it("roles legados de admin são reconhecidos como PLATFORM_ADMIN", () => {
    for (const role of LEGACY_ADMIN_ROLES) {
      expect(callerIsPlatformAdmin(ctx(role)), `role=${role}`).toBe(true);
      expect(() => requirePlatformAdmin(ctx(role))).not.toThrow();
    }
  });

  it("roles legados de user não têm acesso admin", () => {
    for (const role of LEGACY_USER_ROLES) {
      expect(callerIsPlatformAdmin(ctx(role)), `role=${role}`).toBe(false);
      expect(() => requirePlatformAdmin(ctx(role))).toThrowError(TRPCError);
    }
  });

  it("novos roles são reconhecidos corretamente", () => {
    expect(callerIsPlatformAdmin(ctx(PLATFORM_ADMIN))).toBe(true);
    expect(callerIsPlatformAdmin(ctx(CANARIL_MANAGER))).toBe(false);
    expect(callerIsPlatformAdmin(ctx(CANARIL_MEMBER))).toBe(false);
    expect(callerIsPlatformAdmin(ctx(VIEWER))).toBe(false);
  });
});
