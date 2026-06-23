/**
 * OrphanDataRepair.tsx — Detecta e corrige dados órfãos
 * Rota: /admin/security/orphans
 */
import { useState } from "react";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader, InlineAlert, GapSeverityBadge, LoadingSkeleton } from "@/components/ui-premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, Bug, CheckCircle2, Loader2, RotateCcw } from "lucide-react";

export default function OrphanDataRepair() {
  const [confirmText, setConfirmText] = useState("");
  const [done, setDone] = useState<any>(null);

  const { data: orphans, isLoading, refetch } = trpc.adminReset.scanOrphans.useQuery();
  const reconcile = trpc.adminReset.reconcileRings.useMutation({
    onSuccess: (d) => { toast.success(`${d.fixed} anilha(s) reconciliada(s).`); refetch(); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const fixMutation = trpc.adminReset.fixOrphans.useMutation({
    onSuccess: (d) => { setDone(d); refetch(); setConfirmText(""); toast.success(`${d.fixed} órfão(s) corrigido(s).`); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const autoFixable = (orphans ?? []).filter((o) => o.canAutoFix);
  const tables = Array.from(new Set(autoFixable.map((o) => o.table)));

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/admin/security"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button></Link>
          <PageHeader title="Dados Órfãos" description="Detecta e corrige inconsistências no banco de dados." />
        </div>

        {done && <InlineAlert variant="success" title={`${done.fixed} órfão(s) corrigido(s)`}>Tabelas: {Object.keys(done.details).join(", ")}</InlineAlert>}

        {/* Reconciliar anilhas rápido */}
        <Card className="border-blue-100">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><RotateCcw className="w-4 h-4 text-blue-600" />Reconciliar Anilhas Órfãs</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-3">Anilhas marcadas como "em uso" cujo pássaro foi excluído voltam para "disponível" automaticamente.</p>
            <Button variant="outline" onClick={() => reconcile.mutate()} disabled={reconcile.isPending} className="border-blue-200 text-blue-700">
              {reconcile.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Reconciliar agora
            </Button>
          </CardContent>
        </Card>

        {/* Lista de órfãos */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Órfãos detectados</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => refetch()}><RotateCcw className="w-3.5 h-3.5 mr-1" />Escanear</Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <LoadingSkeleton rows={3} /> :
              !orphans || orphans.length === 0 ? (
                <div className="flex items-center gap-2 text-green-700 py-4"><CheckCircle2 className="w-5 h-5" />Nenhum dado órfão detectado.</div>
              ) : (
                <div className="space-y-2">
                  {orphans.map((o, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 text-sm border-b border-gray-50 pb-2 last:border-0">
                      <div>
                        <p className="text-gray-800">{o.description}</p>
                        <p className="text-xs text-gray-400 font-mono">{o.table} #{o.id}</p>
                      </div>
                      {o.canAutoFix && <GapSeverityBadge severity="medium" />}
                    </div>
                  ))}
                </div>
              )}
          </CardContent>
        </Card>

        {/* Corrigir auto-fixáveis */}
        {autoFixable.length > 0 && (
          <Card className="border-amber-200">
            <CardContent className="pt-4 space-y-3">
              <p className="text-sm text-gray-700">{autoFixable.length} item(s) pode(m) ser corrigido(s) automaticamente.</p>
              <div>
                <p className="text-xs text-gray-500 mb-1">Digite <strong>CORRIGIR ORPHANS</strong> para confirmar</p>
                <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="CORRIGIR ORPHANS" className="font-mono" />
              </div>
              <Button
                className="w-full bg-amber-600 hover:bg-amber-700"
                disabled={confirmText !== "CORRIGIR ORPHANS" || fixMutation.isPending}
                onClick={() => fixMutation.mutate({ tables, confirm: "CORRIGIR ORPHANS" })}
              >
                {fixMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Bug className="w-4 h-4 mr-2" />}
                Corrigir {autoFixable.length} órfão(s)
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
