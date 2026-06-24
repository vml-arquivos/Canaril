/**
 * TenantAudit.tsx — Auditoria do próprio canaril
 * Rota: /meu-canaril/auditoria
 *
 * Disponível para CANARIL_MANAGER e PLATFORM_ADMIN.
 * CANARIL_MANAGER vê apenas eventos do próprio tenant.
 * PLATFORM_ADMIN sem tenant vê tudo.
 */
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader, LoadingSkeleton } from "@/components/ui-premium";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { History, RefreshCw, Shield } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  create:       "Criado",
  update:       "Editado",
  soft_delete:  "Arquivado",
  restore:      "Restaurado",
  hard_delete:  "Excluído permanentemente",
  cleanup_test_data: "Limpeza de testes",
  reconcile_rings:   "Reconciliação de anilhas",
  fix_orphan_data:   "Correção de órfãos",
  delete_analysis:   "Análises excluídas",
  execute_reset:     "Reset executado",
};

const ENTITY_LABELS: Record<string, string> = {
  bird:        "Pássaro",
  ring:        "Anilha",
  ring_batch:  "Lote de anilhas",
  couple:      "Casal",
  clutch:      "Postura",
  chick:       "Filhote",
  cage:        "Gaiola",
  championship:"Campeonato",
  photo:       "Foto",
  analysis:    "Análise",
  tenant:      "Canaril",
  user:        "Usuário",
  operational: "Operação",
  multiple:    "Múltiplos",
  rings:       "Anilhas",
  analyses:    "Análises",
  test_data:   "Dados de teste",
};

const ACTION_COLORS: Record<string, string> = {
  create:      "bg-green-100 text-green-800 border-green-200",
  update:      "bg-blue-100 text-blue-800 border-blue-200",
  soft_delete: "bg-amber-100 text-amber-800 border-amber-200",
  restore:     "bg-purple-100 text-purple-800 border-purple-200",
  hard_delete: "bg-red-100 text-red-800 border-red-200",
  default:     "bg-gray-100 text-gray-600 border-gray-200",
};

export default function TenantAudit() {
  const [entityType, setEntityType] = useState<string>("__all__");
  const [limit, setLimit] = useState("50");

  const { data: logs, isLoading, refetch } = trpc.admin.listOwnAuditLogs.useQuery({
    limit: Number(limit),
    entityType: entityType === "__all__" ? undefined : entityType,
  });

  function formatDate(d: string | Date | null) {
    if (!d) return "—";
    const date = new Date(d);
    return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  const entityTypes = [
    "__all__", "bird", "ring", "ring_batch", "couple", "clutch", "chick",
    "cage", "championship", "photo", "analysis",
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-4xl">
        <PageHeader
          title="Auditoria do Canaril"
          description="Histórico de todas as ações realizadas no seu canaril."
          badge={<span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5"><Shield className="w-3 h-3" />Apenas o próprio canaril</span>}
        />

        {/* Filtros */}
        <div className="flex gap-3 flex-wrap items-center">
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Tipo de evento" /></SelectTrigger>
            <SelectContent>
              {entityTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t === "__all__" ? "Todos os tipos" : ENTITY_LABELS[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={limit} onValueChange={setLimit}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["25", "50", "100", "200"].map((n) => (
                <SelectItem key={n} value={n}>Últimos {n}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" />Atualizar
          </Button>
        </div>

        {/* Logs */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4"><LoadingSkeleton rows={5} /></div>
            ) : !logs?.length ? (
              <div className="py-12 text-center text-gray-400">
                <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum registro de auditoria encontrado.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {logs.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors">
                    <div className="shrink-0 pt-0.5">
                      <Badge className={`text-xs border ${ACTION_COLORS[log.action] ?? ACTION_COLORS.default}`}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800">
                          {ENTITY_LABELS[log.entityType] ?? log.entityType}
                          {log.entityId ? ` #${log.entityId}` : ""}
                        </span>
                        {log.reason && (
                          <span className="text-xs text-gray-400 truncate max-w-xs">{log.reason}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(log.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
