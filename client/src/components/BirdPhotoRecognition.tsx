import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, ImageOff, Eye } from "lucide-react";
import { toast } from "sonner";

/**
 * Reconhecimento do pássaro por foto — usa as fotos JÁ cadastradas na
 * ficha (não pede upload de novo) e cruza o resultado da IA contra o
 * catálogo oficial FOB/OBJO real, nunca contra texto livre inventado.
 *
 * Regra de honestidade genética: a foto só sugere o que é VISÍVEL.
 * Genes ocultos (portador de branco recessivo, marfim em macho etc.)
 * nunca são confirmados por aqui — ficam listados em "não confirmado
 * pela foto". Nada é aplicado ao perfil genético sem o criador
 * confirmar explicitamente qual classe oficial aceita.
 */
export function BirdPhotoRecognition({ birdId }: { birdId: number }) {
  const [analysisId, setAnalysisId] = useState<number | null>(null);

  const { data: photos } = trpc.photos.listByEntity.useQuery({ entityType: "bird", entityId: birdId });
  const { data: pastAnalyses, refetch: refetchHistory } = trpc.photoAnalysis.listByBird.useQuery(birdId);

  const analyze = trpc.photoAnalysis.analyze.useMutation({
    onSuccess: (data) => {
      setAnalysisId(data.analysisId);
      toast.success("Análise concluída — confira as sugestões abaixo.");
    },
    onError: (error) => toast.error("Erro na análise: " + error.message),
  });

  const confirm = trpc.photoAnalysis.confirm.useMutation({
    onSuccess: (data) => {
      toast.success(data.profileUpdated ? "Classe confirmada — perfil genético atualizado!" : "Análise registrada.");
      refetchHistory();
    },
    onError: (error) => toast.error("Erro: " + error.message),
  });

  const currentResult = analyze.data;
  const hasPhotos = (photos?.length ?? 0) > 0;

  const handleAnalyze = () => {
    if (!photos || photos.length === 0) return;
    analyze.mutate({ birdId, photoUrls: photos.slice(0, 6).map((p) => p.url) });
  };

  return (
    <div className="space-y-3">
      {!hasPhotos ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-50 rounded-lg p-3 border border-dashed">
          <ImageOff className="w-4 h-4 shrink-0" />
          Adicione pelo menos uma foto na seção "Fotos" acima para poder reconhecer o pássaro.
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" disabled={analyze.isPending} onClick={handleAnalyze}>
          {analyze.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
          {analyze.isPending ? "Analisando foto(s)..." : `Reconhecer pássaro por foto (${Math.min(photos!.length, 6)} foto${photos!.length > 1 ? "s" : ""})`}
        </Button>
      )}

      {currentResult && (
        <div className="space-y-3 border rounded-lg p-3 bg-amber-50/40 border-amber-200">
          <p className="text-xs text-amber-800 bg-amber-100 rounded p-2">{currentResult.disclaimer}</p>

          <div className="text-sm text-gray-700">
            <p className="font-medium">Descrição visual:</p>
            <p className="text-gray-600">{currentResult.analysis.visualDescription}</p>
            <p className="text-xs text-gray-400 mt-1">Confiança geral: {Math.round(currentResult.analysis.confidenceOverall * 100)}%</p>
          </div>

          {currentResult.matchedClasses.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1.5">Classes oficiais sugeridas:</p>
              <div className="space-y-1.5">
                {currentResult.matchedClasses
                  .slice()
                  .sort((a, b) => b.confidence - a.confidence)
                  .map((m, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 bg-white rounded-lg border p-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">
                          {m.matchedOfficialCode ? `${m.matchedOfficialCode} — ` : ""}
                          {m.suggestedName}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{m.reason}</p>
                        {!m.matchedOfficialClassId && (
                          <p className="text-xs text-amber-600">Não encontrada no catálogo oficial carregado — confirme manualmente.</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">{Math.round(m.confidence * 100)}%</span>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!m.matchedOfficialClassId || confirm.isPending}
                          onClick={() => confirm.mutate({ analysisId: currentResult.analysisId, acceptedOfficialClassId: m.matchedOfficialClassId! })}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Confirmar
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {currentResult.analysis.fieldsNotConfirmed.length > 0 && (
            <div className="text-xs text-gray-500">
              <p className="font-medium flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" />A foto NÃO confirma:</p>
              <p>{currentResult.analysis.fieldsNotConfirmed.join(" · ")}</p>
            </div>
          )}

          {currentResult.analysis.warnings.length > 0 && (
            <div className="text-xs text-red-600">{currentResult.analysis.warnings.join(" · ")}</div>
          )}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={confirm.isPending}
            onClick={() => confirm.mutate({ analysisId: currentResult.analysisId })}
          >
            Só registrar ciência (sem aplicar nenhuma classe)
          </Button>
        </div>
      )}

      {pastAnalyses && pastAnalyses.length > 0 && (
        <div className="text-xs text-gray-400 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" />
          {pastAnalyses.length} análise(s) anterior(es) registrada(s) para este pássaro.
        </div>
      )}
    </div>
  );
}
