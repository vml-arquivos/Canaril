/**
 * permissions.ts — Definição centralizada de papéis (roles) e utilitários
 *
 * Este arquivo consolida os papéis oficiais da plataforma, seus rótulos
 * legíveis e funções auxiliares para verificação de privilégios. Ao
 * centralizar estes valores aqui, garantimos que a aplicação inteira
 * (frontend e backend) permaneça em sincronia caso seja necessário
 * ajustar nomenclaturas ou adicionar novos papéis no futuro.
 *
 * Papéis oficiais:
 *   - PLATFORM_ADMIN   → administrador global da plataforma
 *   - CANARIL_MANAGER  → gestor do próprio canaril (tenant)
 *   - CANARIL_MEMBER   → membro com permissões limitadas no canaril
 *   - VIEWER           → acesso somente leitura
 *
 * Observação: papéis legados como "admin", "OWNER" ou "SUPER_ADMIN"
 * foram mapeados no banco de dados para PLATFORM_ADMIN, mas ainda
 * podem existir registros antigos. A função isPlatformAdmin inclui
 * estes valores para retrocompatibilidade.
 */

export const ROLES = [
  "PLATFORM_ADMIN",
  "CANARIL_MANAGER",
  "CANARIL_MEMBER",
  "VIEWER",
] as const;

export type Role = typeof ROLES[number];

/**
 * Rótulos legíveis para exibir em selects e tabelas. Utilize estes
 * valores no frontend em vez das constantes internas.
 */
export const ROLE_LABELS: Record<Role, string> = {
  PLATFORM_ADMIN: "Administrador da Plataforma",
  CANARIL_MANAGER: "Gestor do Canaril",
  CANARIL_MEMBER: "Membro do Canaril",
  VIEWER: "Somente Leitura",
};

/**
 * Determina se um determinado papel possui privilégios de administrador
 * global. Além de reconhecer o valor oficial PLATFORM_ADMIN, esta
 * função também trata valores legados como "admin", "OWNER" ou
 * "SUPER_ADMIN" para permitir acesso enquanto existir dados não
 * normalizados no banco. No futuro, após a migração completa, esta
 * função poderá ser simplificada para apenas comparar com
 * PLATFORM_ADMIN.
 */
export function isPlatformAdmin(role: string | null | undefined): boolean {
  return (
    role === "PLATFORM_ADMIN" ||
    role === "admin" ||
    role === "OWNER" ||
    role === "SUPER_ADMIN"
  );
}

/**
 * Verifica se um papel é um gestor de canaril. Útil para aplicar
 * permissões específicas de CANARIL_MANAGER.
 */
export function isCanarilManager(role: string | null | undefined): boolean {
  return role === "CANARIL_MANAGER";
}

/**
 * Determina se um papel possui acesso operacional (qualquer acesso
 * além de leitura). Inclui PLATFORM_ADMIN, CANARIL_MANAGER e
 * CANARIL_MEMBER.
 */
export function hasOperationalAccess(role: string | null | undefined): boolean {
  return isPlatformAdmin(role) || role === "CANARIL_MANAGER" || role === "CANARIL_MEMBER";
}