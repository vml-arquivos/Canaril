import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function AIJudgePanel({
  birdId,
  specialtyCode,
  primaryPhotoUrl,
}: {
  birdId: number;
  specialtyCode: string;
  primaryPhotoUrl: string | null;
}) {
  const { data: analyses, refetch } = trpc.aiJudge.listByBird.useQuery(birdId);

  const analyze = trpc.aiJudge.analyze.useMutation({
    onSuccess: () => {
      toast.success("Análise concluída!");
      refetch();
    },
    onError: (error) => toast.error("Erro na análise: " + error.message),
  });

  const latest = analyses?.[0];

  if (!primaryPhotoUrl) {
    return (
      <p className="text-sm text-gray-400 italic">
        Adicione uma foto de capa para liberar a análise do Juiz Virtual.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={analyze.isPending}
        onClick={() => analyze.mutate({ birdId, photoUrl: primaryPhotoUrl, specialty_code: specialtyCode })}
      >
        {analyze.isPending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4 mr-2" />
        )}
        {analyze.isPending ? "Analisando..." : "Analisar com Juiz Virtual (IA)"}
      </Button>

      {latest && latest.status === "completed" && (
        <div className="rounded-lg border bg-amber-50/50 border-amber-200 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-amber-900">
              Nota geral: {latest.overallScore?.toFixed(0) ?? "-"}/100
            </span>
            <span className="text-xs text-gray-500">
              confiança {latest.confidence != null ? `${Math.round(latest.confidence * 100)}%` : "-"}
            </span>
          </div>
          {latest.criteria_scores && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {latest.criteria_scores.map((c, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-gray-600">{c.criterion}</span>
                  <span className="font-medium">{c.score}/{c.maxScore}</span>
                </div>
              ))}
            </div>
          )}
          {latest.summary && <p className="text-sm text-gray-700 italic">"{latest.summary}"</p>}
          <p className="text-xs text-gray-400">
            Pré-análise de apoio — não substitui o julgamento de um juiz humano credenciado.
          </p>
        </div>
      )}

      {latest && latest.status === "failed" && (
        <p className="text-sm text-red-600">A última análise falhou: {latest.errorMessage}</p>
      )}
    </div>
  );
}
