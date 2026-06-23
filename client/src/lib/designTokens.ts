/**
 * designTokens.ts — Design System Tokens do Canaril
 *
 * Paleta e semântica visual consistente em toda a plataforma.
 * Baseada na identidade visual amber/dourado do canário.
 */

// ─── Status colors ─────────────────────────────────────────────────────────

export const STATUS_CLASSES = {
  active:      "bg-green-100 text-green-800 border-green-200",
  inactive:    "bg-gray-100 text-gray-600 border-gray-200",
  archived:    "bg-gray-100 text-gray-500 border-gray-200",
  attention:   "bg-amber-100 text-amber-800 border-amber-200",
  risk:        "bg-red-100 text-red-800 border-red-200",
  ideal:       "bg-emerald-100 text-emerald-800 border-emerald-200",
  approved:    "bg-blue-100 text-blue-800 border-blue-200",
  incomplete:  "bg-orange-100 text-orange-800 border-orange-200",
  complete:    "bg-green-100 text-green-800 border-green-200",
  unknown:     "bg-gray-50 text-gray-500 border-gray-200",
} as const;

export type StatusKey = keyof typeof STATUS_CLASSES;

// ─── COI Risk colors ─────────────────────────────────────────────────────────

export const COI_RISK_CLASSES = {
  low:      "bg-green-100 text-green-800",
  moderate: "bg-amber-100 text-amber-800",
  high:     "bg-red-100 text-red-800",
} as const;

export const COI_RISK_LABELS = {
  low:      "Baixo",
  moderate: "Moderado",
  high:     "Alto",
} as const;

// ─── Genetic status ───────────────────────────────────────────────────────────

export const GENETIC_STATUS_CLASSES = {
  complete:   "bg-green-100 text-green-800",
  incomplete: "bg-amber-100 text-amber-800",
  missing:    "bg-red-50 text-red-700",
  inferred:   "bg-blue-100 text-blue-800",
} as const;

// ─── Pairing status ───────────────────────────────────────────────────────────

export const PAIRING_STATUS_CLASSES = {
  ideal:           "bg-emerald-100 text-emerald-800 border-emerald-200",
  approved:        "bg-blue-100 text-blue-800 border-blue-200",
  caution:         "bg-amber-100 text-amber-800 border-amber-200",
  not_recommended: "bg-red-100 text-red-800 border-red-200",
} as const;

export const PAIRING_STATUS_LABELS = {
  ideal:           "Ideal",
  approved:        "Aprovado",
  caution:         "Atenção",
  not_recommended: "Não recomendado",
} as const;

// ─── Module icon map ──────────────────────────────────────────────────────────

export const MODULE_COLORS = {
  birds:       "text-amber-600",
  couples:     "text-rose-500",
  rings:       "text-purple-600",
  clutches:    "text-yellow-600",
  cages:       "text-slate-600",
  genetics:    "text-blue-600",
  reports:     "text-indigo-600",
  temporada:   "text-green-600",
  admin:       "text-red-600",
  intelligence: "text-teal-600",
} as const;

// ─── Gap severity ─────────────────────────────────────────────────────────────

export const GAP_SEVERITY_CLASSES = {
  critical: "bg-red-100 text-red-800 border-red-300",
  high:     "bg-orange-100 text-orange-800 border-orange-300",
  medium:   "bg-amber-100 text-amber-800 border-amber-300",
  low:      "bg-gray-100 text-gray-600 border-gray-300",
} as const;

export const GAP_SEVERITY_LABELS = {
  critical: "Crítica",
  high:     "Alta",
  medium:   "Média",
  low:      "Baixa",
} as const;
