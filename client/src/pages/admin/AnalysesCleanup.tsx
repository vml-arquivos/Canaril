/**
 * AnalysesCleanup.tsx — Excluir análises de IA, foto e genética
 * Rota: /admin/security/analyses
 */
import { useState } from "react";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader, InlineAlert } from "@/components/ui-premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Search, ArrowLeft, Loader2, Trash2 } from "lucide-react";

export default function AnalysesCleanup() {
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [done, setDone] = useState<any>(null);

  const { data: counts, refetch } = trpc.adminReset.listAnalyses.useQuery();
  const deleteMutation = trpc.adminReset.deleteAnalyses.useMutation({
    onSuccess: (d) => { setDone(d); refetch(); setConfirmText(""); toast.success(`${d.totalRows} análises removidas.`); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const TYPE_MAP: Record<string, string> = {
    "ai_judge_analyses":           "ai_judge",
    "bird_photo_analyses":         "photo",
    "bird_genetic_inference_logs": "genetic_inference",
  };
  const LABELS: Record<string, string> = {
    "ai_judge_analyses":           "Juiz Virtual (IA)",
    "bird_photo_analyses":         "Análises de Foto",
    "bird_genetic_inference_logs": "Logs de Inferência Genética",
  };

  const totalSelected = selected.reduce((sum, t) => sum + (counts?.[t] ?? 0), 0);
  const selectedTypes = selected.map((t) => TYPE_MAP[t]);

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/admin/security"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button></Link>
          <PageHeader title="Limpeza de Análises" description="Remove análises de IA, foto e logs de genética. Os pássaros e dados operacionais são mantidos." />
        </div>

        {done && <InlineAlert variant="success" title={`${done.totalRows} análises removidas`}>Tabelas: {done.tablesAffected.join(", ")}</InlineAlert>}

        <div className="space-y-3">
          {Object.entries(LABELS).map(([table, label]) => (
            <label key={table} className={`flex items-center justify-between rounded-xl border-2 p-4 cursor-pointer transition-colors ${selected.includes(table) ? "border-amber-300 bg-amber-50" : "border-gray-100 hover:border-gray-200"}`}>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={selected.includes(table)} onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, table] : prev.filter((t) => t !== table))} className="rounded border-gray-300" />
                <div>
                  <p className="font-medium text-sm text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400 font-mono">{table}</p>
                </div>
              </div>
              <span className={`text-xl font-bold ${(counts?.[table] ?? 0) > 0 ? "text-red-600" : "text-gray-300"}`}>
                {counts?.[table] ?? "—"}
              </span>
            </label>
          ))}
          <label className="flex items-center gap-3 rounded-xl border-2 border-red-200 bg-red-50 p-4 cursor-pointer">
            <input type="checkbox" checked={selectedTypes.includes("all")}
              onChange={(e) => setSelected(e.target.checked ? ["__all__"] : selected.filter((t) => t !== "__all__"))}
              className="rounded border-red-300 text-red-600" />
            <span className="font-medium text-sm text-red-700">Excluir TUDO de análises</span>
          </label>
        </div>

        {(selected.length > 0 || selected.includes("__all__")) && (
          <Card className="border-red-200">
            <CardContent className="pt-4 space-y-3">
              <p className="text-sm text-gray-600">Serão removidas <strong>{selected.includes("__all__") ? "todas as" : totalSelected}</strong> análises.</p>
              <div>
                <p className="text-xs text-gray-500 mb-1">Digite <strong>EXCLUIR ANÁLISES</strong> para confirmar</p>
                <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="EXCLUIR ANÁLISES" className="font-mono" />
              </div>
              <Button
                className="w-full bg-red-600 hover:bg-red-700"
                disabled={confirmText !== "EXCLUIR ANÁLISES" || deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({
                  types: selected.includes("__all__") ? ["all"] : selectedTypes as any,
                  confirm: "EXCLUIR ANÁLISES",
                })}
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Excluir análises
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
