import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Camera, Star, Trash2, Loader2, ImageOff } from "lucide-react";
import { toast } from "sonner";

type EntityType = "bird" | "chick" | "breeder" | "championship_entry";

/**
 * Upload e galeria de fotos para qualquer entidade do sistema (pássaro,
 * filhote, criador, inscrição de campeonato). Usa o endpoint photos.upload
 * (que por sua vez usa storagePut, já configurado na plataforma) — não
 * depende de nenhum serviço externo novo.
 */
export function PhotoUploader({ entityType, entityId }: { entityType: EntityType; entityId: number }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: photos, refetch } = trpc.photos.listByEntity.useQuery({ entityType, entityId });

  const uploadPhoto = trpc.photos.create.useMutation({
    onSuccess: () => {
      toast.success("Foto enviada!");
      refetch();
    },
    onError: (error: { message: string }) => toast.error("Erro ao enviar foto: " + error.message),
    onSettled: () => setUploading(false),
  });

  const setPrimary = trpc.photos.setPrimary.useMutation({
    onSuccess: () => refetch(),
    onError: (error: { message: string }) => toast.error("Erro: " + error.message),
  });

  const removePhoto = trpc.photos.delete.useMutation({
    onSuccess: () => refetch(),
    onError: (error: { message: string }) => toast.error("Erro ao remover: " + error.message),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Imagem muito grande (máximo 8MB). Tente uma foto com menor resolução.");
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      uploadPhoto.mutate({
        entityType,
        entityId,
        dataUrl,
        isPrimary: !photos || photos.length === 0, // primeira foto já entra como capa
      });
    };
    reader.onerror = () => {
      toast.error("Não foi possível ler a imagem");
      setUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // permite selecionar o mesmo arquivo de novo depois
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
          {uploading ? "Enviando..." : "Adicionar foto"}
        </Button>
        <span className="text-xs text-gray-400">{photos?.length ?? 0} foto(s)</span>
      </div>

      {photos && photos.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group rounded-lg overflow-hidden border bg-gray-50 aspect-square">
              <img src={photo.url} alt={photo.caption ?? ""} className="w-full h-full object-cover" />
              {photo.isPrimary && (
                <span className="absolute top-1 left-1 bg-amber-500 text-white rounded-full p-0.5">
                  <Star className="w-3 h-3 fill-current" />
                </span>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                {!photo.isPrimary && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 w-7 p-0"
                    title="Tornar capa"
                    onClick={() => setPrimary.mutate({ id: photo.id, entityType, entityId })}
                  >
                    <Star className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-7 w-7 p-0"
                  title="Remover"
                  onClick={() => removePhoto.mutate(photo.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4 justify-center border border-dashed rounded-lg">
          <ImageOff className="w-4 h-4" />
          Nenhuma foto ainda
        </div>
      )}
    </div>
  );
}
