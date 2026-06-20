import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, Syringe, Pill, Scale, ShieldAlert, Wheat, FileText } from "lucide-react";
import { toast } from "sonner";

const TYPE_CONFIG = {
  vaccine: { label: "Vacina", icon: Syringe },
  treatment: { label: "Tratamento", icon: Pill },
  weight: { label: "Pesagem", icon: Scale },
  quarantine: { label: "Quarentena", icon: ShieldAlert },
  diet: { label: "Alimentação", icon: Wheat },
  other: { label: "Outro", icon: FileText },
} as const;

export function HealthLog({ birdId }: { birdId: number }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<keyof typeof TYPE_CONFIG>("weight");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weightGrams, setWeightGrams] = useState("");

  const { data: records, refetch } = trpc.health.listByBird.useQuery(birdId);

  const createRecord = trpc.health.create.useMutation({
    onSuccess: () => {
      toast.success("Registro adicionado!");
      refetch();
      setOpen(false);
      setDescription("");
      setWeightGrams("");
    },
    onError: (error) => toast.error("Erro: " + error.message),
  });

  const deleteRecord = trpc.health.delete.useMutation({
    onSuccess: () => refetch(),
    onError: (error) => toast.error("Erro: " + error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Descreva o registro");
      return;
    }
    createRecord.mutate({
      birdId,
      type,
      description,
      date: new Date(date),
      weightGrams: type === "weight" && weightGrams ? parseFloat(weightGrams) : undefined,
    });
  };

  return (
    <div className="space-y-3">
      {!open ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo registro
        </Button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2 border rounded-lg p-3 bg-gray-50">
          <div className="grid grid-cols-2 gap-2">
            <Select value={type} onValueChange={(v) => setType(v as keyof typeof TYPE_CONFIG)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_CONFIG).map(([key, c]) => (
                  <SelectItem key={key} value={key}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" className="h-9" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Input
            placeholder={type === "weight" ? "Ex: Pesagem mensal" : "Descreva o registro..."}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-9"
          />
          {type === "weight" && (
            <Input
              type="number"
              step="0.1"
              placeholder="Peso em gramas"
              value={weightGrams}
              onChange={(e) => setWeightGrams(e.target.value)}
              className="h-9"
            />
          )}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" size="sm">Salvar</Button>
          </div>
        </form>
      )}

      {records && records.length > 0 ? (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {records.map((r) => {
            const c = TYPE_CONFIG[r.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.other;
            return (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm border-b pb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <c.icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="text-gray-400 shrink-0">{new Date(r.date).toLocaleDateString("pt-BR")}</span>
                  <span className="truncate">{r.description}{r.weightGrams ? ` — ${r.weightGrams}g` : ""}</span>
                </div>
                <button onClick={() => deleteRecord.mutate(r.id)} className="text-gray-300 hover:text-red-500 shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-400">Nenhum registro de saúde ainda.</p>
      )}
    </div>
  );
}
