/**
 * SecurityZone.tsx — Zona de Segurança: hub central para todas as operações destrutivas
 * Rota: /admin/security
 */
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/ui-premium";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, Trash2, Zap, AlertTriangle, Search, Bug, History } from "lucide-react";

const ZONES = [
  {
    href: "/admin/security/reset",
    icon: Zap,
    title: "Reset do Canaril",
    description: "Remove todos os dados operacionais e inicia do zero. Usuários e configurações são preservados.",
    severity: "critical",
    badge: "OWNER only",
  },
  {
    href: "/admin/security/test-cleanup",
    icon: Trash2,
    title: "Limpeza de Testes",
    description: "Remove dados criados durante testes por prefixo (ex: TESTE, AUDITORIA). Com prévia antes de apagar.",
    severity: "high",
  },
  {
    href: "/admin/security/analyses",
    icon: Search,
    title: "Análises de IA",
    description: "Exclui análises de foto, juiz virtual, genética e logs de inferência. Os pássaros são mantidos.",
    severity: "medium",
  },
  {
    href: "/admin/security/orphans",
    icon: Bug,
    title: "Dados Órfãos",
    description: "Detecta e corrige inconsistências: anilhas usadas sem pássaro, perfis genéticos sem pássaro, fotos sem vínculo.",
    severity: "low",
  },
  {
    href: "/admin",
    icon: History,
    title: "Lixeira e Auditoria",
    description: "Restaurar registros excluídos e ver histórico de todas as ações administrativas.",
    severity: "info",
  },
];

const SEV_COLORS: Record<string, string> = {
  critical: "border-red-200 bg-red-50 hover:border-red-400",
  high:     "border-orange-200 bg-orange-50 hover:border-orange-400",
  medium:   "border-amber-200 bg-amber-50 hover:border-amber-400",
  low:      "border-blue-200 bg-blue-50 hover:border-blue-400",
  info:     "border-gray-200 bg-gray-50 hover:border-gray-300",
};

const SEV_ICON_COLORS: Record<string, string> = {
  critical: "text-red-500",
  high:     "text-orange-500",
  medium:   "text-amber-600",
  low:      "text-blue-500",
  info:     "text-gray-500",
};

export default function SecurityZone() {
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <PageHeader
          title="Zona de Segurança"
          description="Operações destrutivas e de manutenção. Use com cuidado — todas exigem confirmação."
          badge={<span className="flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5"><Shield className="w-3 h-3" />Admin only</span>}
        />

        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-sm text-amber-800">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-semibold">Todas as operações desta área são auditadas.</p>
            <p className="text-amber-700 mt-0.5">Cada ação registra quem executou, quando e quantos registros foram afetados. Operações de reset rodam em transação — se algo falhar, o banco é restaurado automaticamente.</p>
          </div>
        </div>

        <div className="space-y-3">
          {ZONES.map((zone) => (
            <Link key={zone.href} href={zone.href}>
              <div className={`rounded-xl border-2 p-5 cursor-pointer transition-all active:scale-[0.99] ${SEV_COLORS[zone.severity]}`}>
                <div className="flex items-start gap-4">
                  <div className={`shrink-0 mt-0.5 ${SEV_ICON_COLORS[zone.severity]}`}>
                    <zone.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900">{zone.title}</p>
                      {zone.badge && <span className="text-xs text-red-700 bg-red-100 border border-red-200 rounded-full px-2 py-0.5">{zone.badge}</span>}
                    </div>
                    <p className="text-sm text-gray-600">{zone.description}</p>
                  </div>
                  <span className="text-gray-400 text-lg shrink-0">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
