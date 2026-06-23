/**
 * ui-premium/index.tsx — Componentes premium do design system Canaril
 *
 * Todos os componentes são acessíveis, responsivos e tipados.
 */
import { ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle, CheckCircle2, Info, XCircle, ChevronRight,
  Loader2, HelpCircle, X,
} from "lucide-react";
import {
  STATUS_CLASSES, COI_RISK_CLASSES, COI_RISK_LABELS,
  GENETIC_STATUS_CLASSES, PAIRING_STATUS_CLASSES, PAIRING_STATUS_LABELS,
  GAP_SEVERITY_CLASSES, GAP_SEVERITY_LABELS,
  type StatusKey,
} from "@/lib/designTokens";

// ─── StatusBadge ────────────────────────────────────────────────────────────

export function StatusBadge({ status, label, size = "sm" }: { status: StatusKey; label?: string; size?: "xs" | "sm" }) {
  const cls = STATUS_CLASSES[status] ?? STATUS_CLASSES.unknown;
  const text = label ?? status;
  return (
    <Badge className={`border ${cls} ${size === "xs" ? "text-xs px-1.5 py-0.5" : "text-xs"}`}>
      {text}
    </Badge>
  );
}

// ─── CoiRiskBadge ────────────────────────────────────────────────────────────

export function CoiRiskBadge({ risk, pct }: { risk: "low" | "moderate" | "high" | null; pct?: string }) {
  if (!risk) return <span className="text-gray-300 text-xs">—</span>;
  const cls = COI_RISK_CLASSES[risk];
  const label = COI_RISK_LABELS[risk];
  return (
    <span className="flex flex-col items-start gap-0.5">
      <Badge className={`${cls} text-xs border-0`}>{label}</Badge>
      {pct && <span className="text-xs text-gray-400 font-mono">{pct}</span>}
    </span>
  );
}

// ─── GeneticStatusBadge ───────────────────────────────────────────────────────

export function GeneticStatusBadge({ complete }: { complete: boolean }) {
  if (complete) {
    return (
      <span className="flex items-center gap-1 text-xs text-green-700">
        <CheckCircle2 className="w-3.5 h-3.5" />Completa
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-amber-600">
      <AlertTriangle className="w-3.5 h-3.5" />Incompleta
    </span>
  );
}

// ─── PairingStatusBadge ───────────────────────────────────────────────────────

export function PairingStatusBadge({ status }: { status: keyof typeof PAIRING_STATUS_LABELS }) {
  const cls = PAIRING_STATUS_CLASSES[status] ?? "";
  const label = PAIRING_STATUS_LABELS[status] ?? status;
  return <Badge className={`border text-xs ${cls}`}>{label}</Badge>;
}

// ─── GapSeverityBadge ────────────────────────────────────────────────────────

export function GapSeverityBadge({ severity }: { severity: keyof typeof GAP_SEVERITY_LABELS }) {
  const cls = GAP_SEVERITY_CLASSES[severity] ?? "";
  const label = GAP_SEVERITY_LABELS[severity] ?? severity;
  return <Badge className={`border text-xs ${cls}`}>{label}</Badge>;
}

// ─── MetricCard ──────────────────────────────────────────────────────────────

export function MetricCard({
  label, value, icon: Icon, color = "text-gray-700", borderColor = "border-l-gray-300",
  sublabel, href,
}: {
  label: string; value: ReactNode; icon?: React.ElementType;
  color?: string; borderColor?: string; sublabel?: string; href?: string;
}) {
  const content = (
    <Card className={`border-l-4 ${borderColor} hover:shadow-sm transition-shadow`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          {Icon && <Icon className={`w-5 h-5 opacity-40 ${color}`} />}
        </div>
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
        {sublabel && <p className="text-xs text-gray-400 mt-1">{sublabel}</p>}
      </CardContent>
    </Card>
  );
  if (href) return <a href={href}>{content}</a>;
  return content;
}

// ─── PageHeader ──────────────────────────────────────────────────────────────

export function PageHeader({
  title, description, actions, badge,
}: {
  title: string; description?: string; actions?: ReactNode; badge?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 print:mb-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h1>
          {badge}
        </div>
        {description && <p className="text-gray-500 mt-1 text-sm sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap items-center shrink-0 print:hidden">{actions}</div>}
    </div>
  );
}

// ─── SectionHeader ───────────────────────────────────────────────────────────

export function SectionHeader({
  title, description, icon: Icon, actions,
}: {
  title: string; description?: string; icon?: React.ElementType; actions?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-amber-600 shrink-0" />}
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {description && <p className="text-xs text-gray-400">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────────────────

export function EmptyState({
  icon: Icon, title, description, action,
}: {
  icon?: React.ElementType; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-gray-300" />
        </div>
      )}
      <p className="text-base font-semibold text-gray-700 mb-1">{title}</p>
      {description && <p className="text-sm text-gray-400 max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  );
}

// ─── LoadingSkeleton ─────────────────────────────────────────────────────────

export function LoadingSkeleton({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse border-l-4 border-l-gray-200" />
      ))}
    </div>
  );
}

// ─── HelpTooltip ─────────────────────────────────────────────────────────────

export function HelpTooltip({ text, technical }: { text: string; technical?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="Ajuda"
        className="text-gray-300 hover:text-amber-500 transition-colors ml-1"
        onClick={() => setOpen(!open)}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-50 text-xs">
          <div className="flex items-start justify-between gap-2">
            <p className="text-gray-700 leading-relaxed">{text}</p>
            <button onClick={() => setOpen(false)} className="text-gray-300 hover:text-gray-600 shrink-0 mt-0.5">
              <X className="w-3 h-3" />
            </button>
          </div>
          {technical && (
            <details className="mt-2">
              <summary className="text-gray-400 cursor-pointer hover:text-gray-600">Técnico</summary>
              <p className="text-gray-500 mt-1">{technical}</p>
            </details>
          )}
        </div>
      )}
    </span>
  );
}

// ─── ConfirmDialog ───────────────────────────────────────────────────────────

export function ConfirmDialog({
  open, title, description, confirmLabel = "Confirmar", danger = false,
  onConfirm, onCancel, loading = false,
}: {
  open: boolean; title: string; description?: string;
  confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          {danger
            ? <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            : <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}
          <div>
            <p className="font-semibold text-gray-900">{title}</p>
            {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button
            className={`flex-1 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── StickySaveBar ───────────────────────────────────────────────────────────

export function StickySaveBar({
  isDirty, onSave, onDiscard, saving = false, label = "Alterações não salvas",
}: {
  isDirty: boolean; onSave: () => void; onDiscard?: () => void;
  saving?: boolean; label?: string;
}) {
  if (!isDirty) return null;
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-between gap-3 bg-gray-900/95 backdrop-blur text-white px-4 py-3 shadow-2xl print:hidden">
      <div className="flex items-center gap-2 text-sm">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        {label}
      </div>
      <div className="flex gap-2">
        {onDiscard && (
          <Button size="sm" variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10" onClick={onDiscard}>
            Descartar
          </Button>
        )}
        <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
          Salvar
        </Button>
      </div>
    </div>
  );
}

// ─── InlineAlert ─────────────────────────────────────────────────────────────

type AlertVariant = "info" | "warning" | "error" | "success";
const ALERT_VARIANTS: Record<AlertVariant, { bg: string; border: string; text: string; icon: React.ElementType }> = {
  info:    { bg: "bg-blue-50",   border: "border-blue-200",  text: "text-blue-800",  icon: Info },
  warning: { bg: "bg-amber-50",  border: "border-amber-200", text: "text-amber-800", icon: AlertTriangle },
  error:   { bg: "bg-red-50",    border: "border-red-200",   text: "text-red-800",   icon: XCircle },
  success: { bg: "bg-green-50",  border: "border-green-200", text: "text-green-800", icon: CheckCircle2 },
};

export function InlineAlert({ variant = "info", title, children }: { variant?: AlertVariant; title?: string; children: ReactNode }) {
  const v = ALERT_VARIANTS[variant];
  const Icon = v.icon;
  return (
    <div className={`rounded-lg border p-3 ${v.bg} ${v.border} ${v.text}`}>
      <div className="flex items-start gap-2.5">
        <Icon className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="text-sm">
          {title && <p className="font-semibold mb-0.5">{title}</p>}
          <div className="opacity-90">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ─── ScoreBar ─────────────────────────────────────────────────────────────────

export function ScoreBar({ value, max = 100, showValue = true, color }: { value: number; max?: number; showValue?: boolean; color?: string }) {
  const pct = Math.min(Math.max(0, (value / max) * 100), 100);
  const autoColor = pct >= 80 ? "bg-green-500" : pct >= 55 ? "bg-amber-500" : "bg-red-400";
  const barColor = color ?? autoColor;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {showValue && <span className="text-xs text-gray-500 font-mono w-8 text-right">{value}</span>}
    </div>
  );
}

// ─── SexBadge ────────────────────────────────────────────────────────────────

export function SexBadge({ sex }: { sex: string }) {
  if (sex === "macho" || sex === "M") return <Badge className="bg-blue-50 text-blue-800 border-blue-200 text-xs">♂</Badge>;
  if (sex === "fêmea" || sex === "F") return <Badge className="bg-rose-50 text-rose-800 border-rose-200 text-xs">♀</Badge>;
  return <Badge variant="outline" className="text-xs">{sex || "?"}</Badge>;
}

// ─── RingCode ────────────────────────────────────────────────────────────────

export function RingCode({ ring, size = "sm" }: { ring: string; size?: "sm" | "base" }) {
  return (
    <span className={`font-mono font-semibold text-gray-800 tracking-tight ${size === "base" ? "text-base" : "text-sm"}`}>
      {ring}
    </span>
  );
}

// ─── ActionChip ──────────────────────────────────────────────────────────────

export function ActionChip({
  icon: Icon, label, onClick, variant = "default", disabled = false,
}: {
  icon?: React.ElementType; label: string;
  onClick: () => void; variant?: "default" | "danger" | "primary";
  disabled?: boolean;
}) {
  const colors = {
    default: "bg-white border-gray-200 text-gray-700 hover:border-gray-300",
    primary: "bg-amber-600 border-amber-600 text-white hover:bg-amber-700",
    danger:  "bg-white border-red-200 text-red-700 hover:border-red-400",
  }[variant];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 disabled:opacity-40 ${colors}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}
