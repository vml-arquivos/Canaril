/**
 * TestDataCleanup.tsx — Limpeza de dados de teste por prefixo
 * Rota: /admin/security/test-cleanup
 */
import { useState } from "react";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader, InlineAlert, LoadingSkeleton } from "@/components/ui-premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Trash2, ArrowLeft, CheckCircle2, Loader2, Search } from "lucide-react";

const COMMON_PREFIXES = ["TESTE", "TESTE-", "TESTE-AUDITORIA", "TESTE-AUDITORIA-GPT54", "AUDITORIA"];

export default function TestDataCleanup() {
  const [prefix, setPrefix] = useState("TESTE");
  const [confirmText, setConfirmText] = useState("");
  const [hardDelete, setHardDelete] = useState(false);
  const [done, setDone] = useState<any>(null);

  const { data: preview, isLoading: previewLoading, refetch } = trpc.adminReset.previewTestCleanup.useQuery(
    { prefix },
    { enabled: prefix.length >= 2 }
  );
  const cleanupMutation = trpc.adminReset.executeTestCleanup.useMutation({
    onSuccess: (d) => { setDone(d); setConfirmText(""); toast.success(`Limpeza concluída: ${d.totalRows} itens.`); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/admin/security"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button></Link>
          <PageHeader title="Limpeza de Dados de Teste" description="Remove registros cujo nome/anilha começa com um prefixo específico." />
        </div>

        {done && (
          <InlineAlert variant="success" title={`Limpeza concluída: ${done.totalRows} itens removidos`}>
            Tabelas afetadas: {done.tablesAffected.join(", ")}
          </InlineAlert>
        )}

        {/* Prefixo */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Prefixo de busca</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {COMMON_PREFIXES.map((p) => (
                <button key={p} type="button" onClick={() => setPrefix(p)}
                  className={`rounded-full px-3 py-1.5 text-xs border transition-colors ${prefix === p ? "bg-amber-600 text-white border-amber-600" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                  {p}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="TESTE" className="font-mono" />
              <Button variant="outline" onClick={() => refetch()} disabled={prefix.length < 2}>
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Prévia */}
        {prefix.length >= 2 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Prévia — itens com prefixo "{prefix}"</CardTitle></CardHeader>
            <CardContent>
              {previewLoading ? <LoadingSkeleton rows={3} /> : !preview ? <p className="text-gray-400 text-sm">Nenhum dado encontrado.</p> : (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["Pássaros", preview.birds],
                    ["Anilhas", preview.rings],
                    ["Lotes", preview.ringBatches],
                    ["Casais", preview.couples],
                    ["Posturas", preview.clutches],
                    ["Gaiolas", preview.cages],
                    ["Campeonatos", preview.championships],
                    ["Análises", preview.analyses],
                    ["Total", preview.total],
                  ].map(([l, v]) => (
                    <div key={String(l)} className={`rounded-lg p-3 text-center ${String(l) === "Total" ? "bg-amber-50 col-span-3" : "bg-gray-50"}`}>
                      <p className={`text-xl font-bold ${Number(v) > 0 ? (String(l) === "Total" ? "text-amber-700" : "text-red-600") : "text-gray-300"}`}>{v}</p>
                      <p className="text-xs text-gray-400">{l}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Opções e confirmação */}
        {preview && preview.total > 0 && (
          <Card className="border-orange-200">
            <CardContent className="pt-4 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={hardDelete} onChange={(e) => setHardDelete(e.target.checked)} className="rounded border-gray-300 text-red-600" />
                <span className="text-sm text-gray-700">Exclusão definitiva (sem lixeira)</span>
              </label>
              <div>
                <p className="text-xs text-gray-500 mb-1">Digite <strong>LIMPAR TESTES</strong> para confirmar</p>
                <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="LIMPAR TESTES" className="font-mono" />
              </div>
              <Button
                className="w-full bg-orange-600 hover:bg-orange-700"
                disabled={confirmText !== "LIMPAR TESTES" || cleanupMutation.isPending}
                onClick={() => cleanupMutation.mutate({ prefix, confirm: "LIMPAR TESTES", hardDelete })}
              >
                {cleanupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Limpar {preview.total} itens
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
