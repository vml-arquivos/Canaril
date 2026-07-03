import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Camera, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { SPECIALTIES, COLORS } from "@shared/constants";
import { extractLocalImageTraitsFromUrl } from "@/lib/localImageTraits";

/**
 * Tira/seleciona uma foto e usa a IA para sugerir especialidade e cor
 * automaticamente. Extrai traits locais no browser antes de chamar o backend.
 * Se a API externa (Gemini/Anthropic) falhar com 429/403/billing, o backend
 * usa esses traits como fallback local — o cadastro nunca quebra.
 */
export function BirdPhotoIdentifier({
  onIdentified,
}: {
  onIdentified: (result: {
    specialty_code: string;
    color_code: string;
    confidence: number;
    reasoning: string;
    dataUrl: string;
  }) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    specialty: string;
    color: string;
    confidence: number;
    reasoning: string;
  } | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const identify = trpc.aiJudge.identifyFromPhoto.useMutation({
    onSuccess: (data, variables) => {
      const specialtyName = SPECIALTIES.find((s) => s.id === data.specialty_code)?.name ?? data.specialty_code;
      const colorName = COLORS.find((c) => c.id === data.color_code)?.name ?? data.color_code;
      setLastResult({ specialty: specialtyName, color: colorName, confidence: data.confidence, reasoning: data.reasoning });
      onIdentified({ ...data, dataUrl: variables.dataUrl });
      if (data.confidence < 0.4) {
        toast.warning("Análise local usada (IA externa indisponível). Confira os campos manualmente.");
      } else {
        toast.success("Identificação concluída — confira os campos preenchidos.");
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Imagem muito grande (máximo 8MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setLastResult(null);

      // Extrai traits locais no browser antes de chamar o backend.
      // Se o Gemini falhar (429/403/billing), o backend usa esses traits
      // para retornar uma sugestão local sem quebrar o cadastro.
      setIsExtracting(true);
      let localVisualTraits: Awaited<ReturnType<typeof extractLocalImageTraitsFromUrl>> | undefined;
      try {
        localVisualTraits = await extractLocalImageTraitsFromUrl(dataUrl);
      } catch {
        // Não bloqueia — o backend tem fallback sem traits também
      } finally {
        setIsExtracting(false);
      }

      identify.mutate({ dataUrl, localVisualTraits });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const isPending = identify.isPending || isExtracting;

  return (
    <div className="rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/40 p-4 space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex items-center gap-3">
        {preview ? (
          <img src={preview} alt="Pré-visualização" className="w-16 h-16 rounded-lg object-cover border" />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-white border flex items-center justify-center text-gray-300">
            <Camera className="w-6 h-6" />
          </div>
        )}
        <div className="flex-1">
          <p className="font-medium text-gray-800 text-sm">Identificação automática por foto</p>
          <p className="text-xs text-gray-500">
            {isExtracting
              ? "Lendo foto localmente..."
              : "Tire ou envie uma foto — a IA sugere espécie e cor"}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-1" />
          )}
          {isPending ? "Identificando..." : "Identificar foto"}
        </Button>
      </div>

      {lastResult && (
        <div
          className={`text-sm rounded-lg p-2 ${
            lastResult.confidence < 0.5
              ? "bg-yellow-50 border border-yellow-200"
              : "bg-green-50 border border-green-200"
          }`}
        >
          <p className="font-medium">
            Sugestão: {lastResult.specialty} · {lastResult.color}{" "}
            <span className="text-xs text-gray-500">
              ({Math.round(lastResult.confidence * 100)}% de confiança)
            </span>
          </p>
          <p className="text-xs text-gray-600 mt-0.5">{lastResult.reasoning}</p>
          {lastResult.confidence < 0.5 && (
            <p className="flex items-center gap-1 text-xs text-yellow-700 mt-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Confiança baixa — confira os campos antes de salvar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
