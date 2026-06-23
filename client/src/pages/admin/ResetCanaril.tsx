/**
 * ResetCanaril.tsx — Reset Total Operacional do Canaril
 * Rota: /admin/security/reset
 */
import { useState } from "react";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader, InlineAlert, EmptyState, LoadingSkeleton } from "@/components/ui-premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { AlertTriangle, Zap, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

const PRESERVED = [
  "Usuários e logins", "Permissões e papéis", "Criadouro / Tenant",
  "Configurações básicas", "Base de conhecimento (raças, mutações, regras)",
  "Classes oficiais FOB/OBJO", "Site público (preservado por padrão)",
];

const DELETED = [
  "Pássaros", "Fotos", "Anilhas e lotes", "Casais", "Posturas",
  "Filhotes", "Gaiolas e sensores", "Campeonatos e inscrições",
  "Genótipos e perfis genéticos", "Análises de IA e foto",
  "Logs de inferência genética", "Rotina diária e lembretes",
  "Históricos de saúde", "Campeonatos e pontuações",
];

export default function ResetCanaril() {
  const [confirmText, setConfirmText] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState<any>(null);

  const { data: preview, isLoading: previewLoading } = trpc.adminReset.previewOperationalReset.useQuery();
  const resetMutation = trpc.adminReset.executeOperationalReset.useMutation({
    onSuccess: (data) => { setDone(data); toast.success(`Reset concluído. ${data.totalRows} registros removidos.`); },
    onError: (e) => toast.error("Erro no reset: " + e.message),
  });

  const canExecute = confirmText === "RESETAR CANARIL" && agreed;

  if (done) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl space-y-5">
          <div className="text-center py-10">
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900">Reset Concluído</h2>
            <p className="text-gray-500 mt-2">{done.totalRows} registros removidos em {done.durationMs}ms</p>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm">Resumo</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                {done.tablesAffected.map((t: string) => (
                  <div key={t} className="flex justify-between text-gray-600">
                    <span>{t}</span>
                    <span className="font-mono text-gray-400">{done.rowsDeleted[t]}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Link href="/dashboard">
            <Button className="w-full bg-amber-600 hover:bg-amber-700">Ir para o Dashboard</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/admin/security"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button></Link>
          <PageHeader title="Reset Total Operacional" description="Remove todos os dados operacionais. Usuários e configurações são mantidos." />
        </div>

        <InlineAlert variant="error" title="Ação irreversível">
          Este reset apaga permanentemente todos os pássaros, anilhas, casais, posturas e demais dados operacionais. Não há como desfazer após a execução.
        </InlineAlert>

        <div className="grid sm:grid-cols-2 gap-4">
          <Card className="border-green-100">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-green-700">✓ Preservados</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {PRESERVED.map((p) => <p key={p} className="text-xs text-gray-600">• {p}</p>)}
            </CardContent>
          </Card>
          <Card className="border-red-100">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700">✗ Removidos</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {DELETED.map((d) => <p key={d} className="text-xs text-gray-600">• {d}</p>)}
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Prévia do que será removido</CardTitle></CardHeader>
          <CardContent>
            {previewLoading ? <LoadingSkeleton rows={4} /> : !preview ? <p className="text-gray-400 text-sm">Não disponível</p> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  ["Pássaros", preview.birds],
                  ["Anilhas", preview.rings],
                  ["Lotes", preview.ringBatches],
                  ["Casais", preview.couples],
                  ["Posturas", preview.clutches],
                  ["Filhotes", preview.chicks],
                  ["Gaiolas", preview.cages],
                  ["Campeonatos", preview.championships],
                  ["Análises IA", preview.aiJudgeAnalyses + preview.birdPhotoAnalyses],
                  ["Genótipos", preview.birdGenotype],
                  ["Fotos", preview.photos],
                  ["Logs rotina", preview.breedingDailyLogs],
                ].map(([label, value]) => (
                  <div key={String(label)} className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className={`text-2xl font-bold ${Number(value) > 0 ? "text-red-600" : "text-gray-300"}`}>{value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirmation */}
        <Card className="border-red-200">
          <CardHeader className="pb-3"><CardTitle className="text-sm text-red-700">Confirmação obrigatória</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-red-600"
              />
              <span className="text-sm text-gray-700">
                Entendo que todos os dados operacionais serão removidos permanentemente e que esta ação não pode ser desfeita.
              </span>
            </label>
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Digite <strong>RESETAR CANARIL</strong> para confirmar</p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESETAR CANARIL"
                className="font-mono"
              />
            </div>
            <Button
              className="w-full bg-red-600 hover:bg-red-700 text-white"
              disabled={!canExecute || resetMutation.isPending}
              onClick={() => resetMutation.mutate({ confirm: "RESETAR CANARIL", agreedToTerms: true })}
            >
              {resetMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Executando reset...</>
                : <><Zap className="w-4 h-4 mr-2" />Executar Reset Total</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
