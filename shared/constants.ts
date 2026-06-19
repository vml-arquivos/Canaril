/**
 * Constantes e dados pré-carregados para o sistema de gestão de canários
 */

export const SPECIALTIES = [
  { id: "gloster_corona", name: "Gloster Corona", description: "Corpo compacto com crista proeminente", size: "11-12 cm", weight: "12-29g" },
  { id: "gloster_consort", name: "Gloster Consort", description: "Sem crista, cabeça lisa", size: "11-12 cm", weight: "12-29g" },
  { id: "holandês", name: "Holandês", description: "Raça de porte, corpo alongado", size: "13-14 cm", weight: "30-40g" },
  { id: "frisado_norte", name: "Frisado do Norte", description: "Plumagem ondulada, origem holandesa", size: "12-13 cm", weight: "20-35g" },
  { id: "frisado_sul", name: "Frisado do Sul", description: "Plumagem ondulada", size: "12-13 cm", weight: "20-35g" },
  { id: "belga_clássico", name: "Belga Clássico", description: "Raça de porte clássica", size: "13-14 cm", weight: "30-40g" },
] as const;

export const COLORS = [
  { id: "amarelo_intenso", name: "Amarelo Intenso", category: "Amarelo", genetics: "Recessivo" },
  { id: "amarelo_nevado", name: "Amarelo Nevado", category: "Amarelo", genetics: "Dominante" },
  { id: "amarelo_mosaico", name: "Amarelo Mosaico", category: "Amarelo", genetics: "Ligado ao sexo" },
  { id: "vermelho_intenso", name: "Vermelho Intenso", category: "Vermelho", genetics: "Recessivo" },
  { id: "vermelho_nevado", name: "Vermelho Nevado", category: "Vermelho", genetics: "Dominante" },
  { id: "vermelho_mosaico", name: "Vermelho Mosaico", category: "Vermelho", genetics: "Ligado ao sexo" },
  { id: "branco", name: "Branco", category: "Branco", genetics: "Dominante" },
  { id: "prateado", name: "Prateado", category: "Branco", genetics: "Recessivo" },
  { id: "opalino", name: "Opalino", category: "Mutação", genetics: "Recessivo" },
  { id: "feo", name: "Feo", category: "Mutação", genetics: "Recessivo" },
  { id: "topázio", name: "Topázio", category: "Mutação", genetics: "Recessivo" },
  { id: "albino", name: "Albino", category: "Mutação", genetics: "Recessivo" },
  { id: "lutino", name: "Lutino", category: "Mutação", genetics: "Recessivo" },
] as const;

export const SEXES = [
  { id: "macho", name: "Macho" },
  { id: "fêmea", name: "Fêmea" },
  { id: "indeterminado", name: "Indeterminado" },
] as const;

export const STATUSES = [
  { id: "ativo", name: "Ativo", color: "bg-green-100 text-green-800" },
  { id: "vendido", name: "Vendido", color: "bg-blue-100 text-blue-800" },
  { id: "falecido", name: "Falecido", color: "bg-red-100 text-red-800" },
] as const;

export const RING_STATUSES = [
  { id: "disponível", name: "Disponível", color: "bg-green-100 text-green-800" },
  { id: "em_uso", name: "Em Uso", color: "bg-yellow-100 text-yellow-800" },
  { id: "estoque", name: "Estoque", color: "bg-gray-100 text-gray-800" },
] as const;

export const COUPLE_STATUSES = [
  { id: "ativo", name: "Ativo", color: "bg-green-100 text-green-800" },
  { id: "inativo", name: "Inativo", color: "bg-gray-100 text-gray-800" },
  { id: "finalizado", name: "Finalizado", color: "bg-red-100 text-red-800" },
] as const;

/**
 * Validações genéticas para cruzamentos
 */
export const GENETIC_RULES = {
  recommended: [
    { male: "amarelo_intenso", female: "amarelo_intenso", note: "Cruzamento recomendado" },
    { male: "gloster_corona", female: "gloster_consort", note: "Cruzamento recomendado para produção de ambas as variedades" },
    { male: "vermelho_intenso", female: "vermelho_intenso", note: "Cruzamento recomendado" },
  ],
  warning: [
    { male: "branco", female: "branco", note: "Pode gerar filhotes com problemas auditivos" },
    { male: "amarelo_nevado", female: "amarelo_nevado", note: "Pode resultar em filhotes muito claros" },
    { male: "albino", female: "albino", note: "Cruzamento de alto risco" },
  ],
  forbidden: [
    { male: "branco", female: "branco", note: "Branco Dominante x Branco Dominante - PROIBIDO" },
  ],
};

/**
 * Cores possíveis por especialidade
 */
export const COLORS_BY_SPECIALTY: Record<string, string[]> = {
  gloster_corona: ["amarelo_intenso", "amarelo_nevado", "amarelo_mosaico", "vermelho_intenso", "vermelho_nevado", "vermelho_mosaico", "branco", "prateado"],
  gloster_consort: ["amarelo_intenso", "amarelo_nevado", "amarelo_mosaico", "vermelho_intenso", "vermelho_nevado", "vermelho_mosaico", "branco", "prateado"],
  holandês: ["amarelo_intenso", "amarelo_nevado", "vermelho_intenso", "vermelho_nevado", "branco", "prateado"],
  frisado_norte: ["amarelo_intenso", "amarelo_nevado", "vermelho_intenso", "vermelho_nevado", "branco"],
  frisado_sul: ["amarelo_intenso", "amarelo_nevado", "vermelho_intenso", "vermelho_nevado", "branco"],
  belga_clássico: ["amarelo_intenso", "amarelo_nevado", "vermelho_intenso", "vermelho_nevado", "branco", "prateado"],
};

export const BREEDER_INFO = {
  name: "Canário Lima",
  city: "Brasília",
  state: "DF",
  description: "Criadouro profissional especializado em Canários Belga com foco em qualidade genética e bem-estar animal.",
  phone: "(61) 9999-9999",
  email: "contato@canarioslima.com.br",
  website: "www.canarioslima.com.br",
};
