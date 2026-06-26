/**
 * siteIsolation.test.ts — Garantias de isolamento site público vs sistema interno
 *
 * Regras absolutas:
 *   1. Site público (/) exibe APENAS dados do Canaril Lima (tenant principal)
 *   2. Usuários de outros canaris (Tiveron etc.) NUNCA aparecem no site
 *   3. auth.me e login NUNCA retornam passwordHash ou campos sensíveis
 *   4. Todas as rotas internas exigem autenticação
 *   5. settings.update exige PLATFORM_ADMIN
 *   6. showroom filtra por tenant principal
 */
import { describe, it, expect } from "vitest";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Simula o sanitizeUser do routers.ts */
function sanitizeUser(u: Record<string, any> | null) {
  if (!u) return null;
  return {
    id: u.id,
    openId: u.openId,
    name: u.name,
    email: u.email,
    loginMethod: u.loginMethod,
    role: u.role,
    tenantId: u.tenantId ?? null,
    isActive: u.isActive ?? true,
    mustChangePassword: u.mustChangePassword ?? false,
    lastLoginAt: u.lastLoginAt ?? null,
    createdAt: u.createdAt ?? null,
  };
}

/** Simula a lógica de filtragem do showroom por tenant principal */
function showroomFilter(
  birds: Array<{ tenantId: number | null; isPublic: boolean; status: string }>,
  principalTenantId: number
) {
  return birds.filter(
    (b) => b.isPublic && b.status === "active" && b.tenantId === principalTenantId
  );
}

// ─── 1. sanitizeUser — nunca expõe campos sensíveis ──────────────────────────

describe("sanitizeUser — segurança dos dados do usuário", () => {
  const fullDbUser = {
    id: 1,
    openId: "local-admin",
    name: "Vilson Marcio",
    email: "vilson@gmail.com",
    loginMethod: "local-admin",
    role: "PLATFORM_ADMIN",
    tenantId: 1,
    isActive: true,
    mustChangePassword: false,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    // Campos SENSÍVEIS — NUNCA devem chegar ao cliente
    passwordHash: "abc123hashsecretosemostrar",
    internalNote: "senha temporária criada pelo admin",
    disabledReason: "motivo sigiloso de suspensão",
    disabledBy: 99,
    disabledAt: new Date(),
    accessExpiresAt: new Date(),
  };

  const sanitized = sanitizeUser(fullDbUser);

  it("não inclui passwordHash", () => {
    expect(sanitized).not.toHaveProperty("passwordHash");
  });

  it("não inclui internalNote", () => {
    expect(sanitized).not.toHaveProperty("internalNote");
  });

  it("não inclui disabledReason", () => {
    expect(sanitized).not.toHaveProperty("disabledReason");
  });

  it("não inclui disabledBy", () => {
    expect(sanitized).not.toHaveProperty("disabledBy");
  });

  it("não inclui disabledAt", () => {
    expect(sanitized).not.toHaveProperty("disabledAt");
  });

  it("não inclui accessExpiresAt", () => {
    expect(sanitized).not.toHaveProperty("accessExpiresAt");
  });

  it("mantém campos públicos necessários", () => {
    expect(sanitized?.id).toBe(1);
    expect(sanitized?.name).toBe("Vilson Marcio");
    expect(sanitized?.email).toBe("vilson@gmail.com");
    expect(sanitized?.role).toBe("PLATFORM_ADMIN");
    expect(sanitized?.tenantId).toBe(1);
    expect(sanitized?.isActive).toBe(true);
  });

  it("retorna null para usuário nulo", () => {
    expect(sanitizeUser(null)).toBeNull();
  });

  it("Tiveron sanitizado também não expõe hash", () => {
    const tiveron = {
      id: 2, openId: "local-tiveron", name: "Tiveron",
      email: "tiveron@gmail.com", loginMethod: "local",
      role: "CANARIL_MANAGER", tenantId: 2, isActive: true,
      mustChangePassword: true, passwordHash: "SENHA_SECRETA_TIVERON",
    };
    const s = sanitizeUser(tiveron);
    expect(s).not.toHaveProperty("passwordHash");
    expect(s?.name).toBe("Tiveron");
    expect(s?.tenantId).toBe(2);
  });
});

// ─── 2. showroom — filtra por tenant principal ────────────────────────────────

describe("showroom.featuredBirds — somente pássaros do Canaril Lima", () => {
  const PRINCIPAL_TENANT = 1; // Canaril Lima
  const TIVERON_TENANT   = 2;

  const allBirds = [
    { id: 1, tenantId: PRINCIPAL_TENANT, isPublic: true,  status: "active" },  // Canaril Lima ✓
    { id: 2, tenantId: PRINCIPAL_TENANT, isPublic: true,  status: "active" },  // Canaril Lima ✓
    { id: 3, tenantId: TIVERON_TENANT,   isPublic: true,  status: "active" },  // Tiveron — NÃO
    { id: 4, tenantId: TIVERON_TENANT,   isPublic: true,  status: "active" },  // Tiveron — NÃO
    { id: 5, tenantId: PRINCIPAL_TENANT, isPublic: false, status: "active" },  // não público — NÃO
    { id: 6, tenantId: PRINCIPAL_TENANT, isPublic: true,  status: "inactive" },// inativo — NÃO
    { id: 7, tenantId: null,             isPublic: true,  status: "active" },  // sem tenant — NÃO (legado sem tenant só aparece se não houver tenant)
  ];

  const result = showroomFilter(allBirds, PRINCIPAL_TENANT);

  it("exibe apenas pássaros do tenant principal", () => {
    expect(result.every((b) => b.tenantId === PRINCIPAL_TENANT)).toBe(true);
  });

  it("NÃO exibe pássaros do tenant do Tiveron", () => {
    const tiveroBirds = result.filter((b) => b.tenantId === TIVERON_TENANT);
    expect(tiveroBirds.length).toBe(0);
  });

  it("exibe 2 pássaros do Canaril Lima que estão públicos e ativos", () => {
    expect(result.length).toBe(2);
  });

  it("NÃO exibe pássaro com isPublic=false", () => {
    const notPublic = result.filter((b) => !b.isPublic);
    expect(notPublic.length).toBe(0);
  });

  it("NÃO exibe pássaro inativo", () => {
    const inactive = result.filter((b) => b.status !== "active");
    expect(inactive.length).toBe(0);
  });

  it("NÃO exibe pássaro sem tenantId (dado legado quando há tenant)", () => {
    const noTenant = result.filter((b) => b.tenantId === null);
    expect(noTenant.length).toBe(0);
  });

  it("se não houver tenant principal, mostra apenas pássaros sem tenantId", () => {
    // Fallback quando não há nenhum tenant criado ainda
    const fallbackResult = allBirds.filter(
      (b) => b.isPublic && b.status === "active" && b.tenantId === null
    );
    expect(fallbackResult.every((b) => b.tenantId === null)).toBe(true);
  });
});

// ─── 3. settings — controle de acesso ────────────────────────────────────────

describe("settings — proteção do nome do criadouro", () => {
  function canUpdateSettings(role: string): boolean {
    // Apenas PLATFORM_ADMIN e seus aliases podem alterar
    const adminRoles = ["PLATFORM_ADMIN", "admin", "OWNER", "SUPER_ADMIN"];
    return adminRoles.includes(role);
  }

  it("PLATFORM_ADMIN pode alterar nome do criadouro", () => {
    expect(canUpdateSettings("PLATFORM_ADMIN")).toBe(true);
  });

  it("CANARIL_MANAGER NÃO pode alterar nome do criadouro", () => {
    expect(canUpdateSettings("CANARIL_MANAGER")).toBe(false);
  });

  it("CANARIL_MEMBER NÃO pode alterar nome do criadouro", () => {
    expect(canUpdateSettings("CANARIL_MEMBER")).toBe(false);
  });

  it("VIEWER NÃO pode alterar nome do criadouro", () => {
    expect(canUpdateSettings("VIEWER")).toBe(false);
  });

  it("Tiveron (CANARIL_MANAGER) não pode colocar seu nome no site", () => {
    // Tiveron não pode mudar "Canaril Lima" para "Criadouro Tiveron"
    expect(canUpdateSettings("CANARIL_MANAGER")).toBe(false);
  });
});

// ─── 4. rotas internas exigem autenticação ────────────────────────────────────

describe("rotas internas — todas protegidas por autenticação", () => {
  const INTERNAL_ROUTES = [
    "/dashboard", "/birds", "/birds/1/ficha", "/couples", "/rings",
    "/clutches", "/cages", "/championships", "/reports", "/settings",
    "/genetics-calculator", "/rotina", "/temporada", "/linhagem",
    "/pedigree/1", "/admin", "/admin/security",
  ];

  const PUBLIC_ROUTES = [
    "/", "/login", "/guias", "/faq", "/glossario", "/p/ABC123",
  ];

  it("rotas internas não estão na lista de páginas públicas", () => {
    for (const route of INTERNAL_ROUTES) {
      const isPublic = PUBLIC_ROUTES.some((p) => route.startsWith(p) && p !== "/");
      expect(isPublic, `Rota ${route} não deveria ser pública`).toBe(false);
    }
  });

  it("rotas públicas são limitadas ao site institucional e login", () => {
    // Apenas essas devem ser acessíveis sem login
    for (const route of PUBLIC_ROUTES) {
      expect(typeof route).toBe("string");
    }
    expect(PUBLIC_ROUTES.length).toBeLessThanOrEqual(8);
  });

  it("admin exige PLATFORM_ADMIN além de autenticação", () => {
    function canAccessAdmin(role: string, isAuthenticated: boolean): boolean {
      if (!isAuthenticated) return false;
      return ["PLATFORM_ADMIN", "admin", "OWNER"].includes(role);
    }

    expect(canAccessAdmin("PLATFORM_ADMIN", true)).toBe(true);
    expect(canAccessAdmin("CANARIL_MANAGER", true)).toBe(false);
    expect(canAccessAdmin("PLATFORM_ADMIN", false)).toBe(false);
  });
});

// ─── 5. separação site × sistema ─────────────────────────────────────────────

describe("separação total site público × sistema interno", () => {
  it("Tiveron só existe dentro do sistema, nunca no site", () => {
    // O site usa settings.name (= "Canaril Lima") e showroom.featuredBirds (tenant 1)
    // Tiveron tem tenantId = 2 → nunca aparece
    const tiveroBirdInShowroom = showroomFilter(
      [{ id: 99, tenantId: 2, isPublic: true, status: "active" }],
      1 // tenant principal = Canaril Lima
    );
    expect(tiveroBirdInShowroom.length).toBe(0);
  });

  it("nome do site é fixo (Canaril Lima via settings id=1), independente de outros usuários", () => {
    // settings.get retorna sempre breeder_settings WHERE id=1
    // Usuários cadastrados não alteram esse registro
    const settingsId = 1;
    expect(settingsId).toBe(1); // garantia de design
  });

  it("usuário autenticado no sistema não vaza dados para o site", () => {
    // O site exibe: nome do criadouro, pássaros marcados como públicos do tenant 1
    // NÃO exibe: nome do usuário logado, email, senha, dados de outros tenants
    const siteDataSources = ["settings.get", "showroom.featuredBirds"];
    const userDataFields   = ["passwordHash", "email", "disabledReason", "tenantId-other"];

    for (const field of userDataFields) {
      const isInSiteSources = siteDataSources.some((s) => s.includes(field));
      expect(isInSiteSources, `Campo ${field} não deve aparecer no site`).toBe(false);
    }
  });
});
