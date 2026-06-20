import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { BACKGROUND_COLORS, FEATHER_TYPES, MELANIN_MUTATIONS, LIPOCHROME_MUTATIONS } from "@shared/constants";
import { Plus, Trash2, Dna } from "lucide-react";
import { toast } from "sonner";

const ALL_MUTATIONS = [...MELANIN_MUTATIONS, ...LIPOCHROME_MUTATIONS];

const ZYGOSITY_LABELS: Record<string, string> = {
  homozygous_mutant: "Manifesta (dose dupla)",
  heterozygous_carrier: "Portador (não manifesta, se recessivo)",
  homozygous_normal: "Normal",
};

type MutationRow = { mutation: string; inheritance: "autosomal_dominant" | "autosomal_recessive" | "sex_linked_recessive"; zygosity: "homozygous_mutant" | "heterozygous_carrier" | "homozygous_normal" };

/**
 * Seção opcional de genótipo detalhado, usada pelo motor de cruzamento
 * mendeliano (server/_core/mendelian.ts). Não interfere em nada do
 * cadastro simples já existente (specialty_code/color_code continuam
 * sendo a cor "de exibição" normal do sistema).
 */
export function GenotypeEditor({ birdId, sex }: { birdId: number; sex: string }) {
  const { data: genotype, refetch } = trpc.mendelian.getGenotype.useQuery(birdId);
  const [backgroundColor, setBackgroundColor] = useState<string>("");
  const [featherType, setFeatherType] = useState<string>("");
  const [hasCrest, setHasCrest] = useState(false);
  const [mutations, setMutations] = useState<MutationRow[]>([]);

  useEffect(() => {
    if (genotype) {
      setBackgroundColor(genotype.backgroundColor ?? "");
      setFeatherType(genotype.featherType ?? "");
      setHasCrest(genotype.hasCrest);
      setMutations((genotype.mutations as MutationRow[]) ?? []);
    }
  }, [genotype]);

  const save = trpc.mendelian.upsertGenotype.useMutation({
    onSuccess: () => {
      toast.success("Genótipo salvo!");
      refetch();
    },
    onError: (error) => toast.error("Erro: " + error.message),
  });

  const handleSave = () => {
    save.mutate({
      birdId,
      backgroundColor: backgroundColor || undefined,
      featherType: (featherType as "intenso" | "nevado") || undefined,
      hasCrest,
      mutations,
    });
  };

  const addMutation = () => {
    const first = ALL_MUTATIONS[0];
    setMutations([...mutations, { mutation: first.id, inheritance: first.inheritance, zygosity: "heterozygous_carrier" }]);
  };

  const updateMutation = (index: number, patch: Partial<MutationRow>) => {
    setMutations(mutations.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  const removeMutation = (index: number) => {
    setMutations(mutations.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Cor de Fundo (Lipocromo)</Label>
          <Select value={backgroundColor} onValueChange={setBackgroundColor}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {BACKGROUND_COLORS.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Plumagem</Label>
          <Select value={featherType} onValueChange={setFeatherType}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {FEATHER_TYPES.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-2.5">
        <div>
          <p className="text-sm font-medium">Tem crista</p>
          <p className="text-xs text-gray-400">Gene dominante, letal em dose dupla — evite cruzar dois com crista</p>
        </div>
        <Switch checked={hasCrest} onCheckedChange={setHasCrest} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs">Mutações Melânicas / Lipocrômicas</Label>
          <Button type="button" size="sm" variant="ghost" onClick={addMutation}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Adicionar
          </Button>
        </div>
        {mutations.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhuma mutação registrada.</p>
        ) : (
          <div className="space-y-2">
            {mutations.map((m, i) => (
              <div key={i} className="flex items-center gap-2 border rounded-lg p-2">
                <Select
                  value={m.mutation}
                  onValueChange={(value) => {
                    const def = ALL_MUTATIONS.find((x) => x.id === value)!;
                    updateMutation(i, { mutation: value, inheritance: def.inheritance });
                  }}
                >
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_MUTATIONS.map((mut) => (
                      <SelectItem key={mut.id} value={mut.id}>{mut.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={m.zygosity}
                  onValueChange={(value) => updateMutation(i, { zygosity: value as MutationRow["zygosity"] })}
                >
                  <SelectTrigger className="h-8 text-xs w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ZYGOSITY_LABELS)
                      // fêmeas não podem ser "portadoras" em traço ligado ao sexo
                      .filter(([key]) => !(sex === "fêmea" && m.inheritance === "sex_linked_recessive" && key === "heterozygous_carrier"))
                      .map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <button onClick={() => removeMutation(i)} className="text-gray-300 hover:text-red-500 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button type="button" size="sm" onClick={handleSave} disabled={save.isPending}>
        <Dna className="w-4 h-4 mr-1.5" />
        {save.isPending ? "Salvando..." : "Salvar Genótipo"}
      </Button>
    </div>
  );
}
