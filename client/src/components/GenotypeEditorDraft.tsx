/**
 * GenotypeEditorDraft.tsx
 *
 * Versão "draft" (sem birdId) do GenotypeEditor.
 * Usada no modal de CRIAÇÃO de pássaro — armazena o genótipo em estado local
 * e expõe o valor via `onChange`. O Birds.tsx salva no banco após o pássaro
 * ser criado (onSuccess do createBird.mutate).
 *
 * Regra inquebrável: não faz nenhuma query/mutation ao banco — é puramente
 * controlado pelo pai via `value` / `onChange`.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BACKGROUND_COLORS, FEATHER_TYPES, MELANIN_MUTATIONS, LIPOCHROME_MUTATIONS } from "@shared/constants";
import { Plus, Trash2, Dna } from "lucide-react";

const ALL_MUTATIONS = [...MELANIN_MUTATIONS, ...LIPOCHROME_MUTATIONS];

const ZYGOSITY_LABELS: Record<string, string> = {
  homozygous_mutant: "Manifesta (dose dupla)",
  heterozygous_carrier: "Portador (não manifesta, se recessivo)",
  homozygous_normal: "Normal",
};

export type MutationRow = {
  mutation: string;
  inheritance: "autosomal_dominant" | "autosomal_recessive" | "sex_linked_recessive";
  zygosity: "homozygous_mutant" | "heterozygous_carrier" | "homozygous_normal";
};

export interface GenotypeDraft {
  backgroundColor: string;
  featherType: string;
  hasCrest: boolean;
  mutations: MutationRow[];
}

export const EMPTY_GENOTYPE_DRAFT: GenotypeDraft = {
  backgroundColor: "",
  featherType: "",
  hasCrest: false,
  mutations: [],
};

interface Props {
  sex: string;
  value: GenotypeDraft;
  onChange: (draft: GenotypeDraft) => void;
}

export function GenotypeEditorDraft({ sex, value, onChange }: Props) {
  const update = (patch: Partial<GenotypeDraft>) => onChange({ ...value, ...patch });

  const addMutation = () => {
    const first = ALL_MUTATIONS[0];
    update({
      mutations: [
        ...value.mutations,
        { mutation: first.id, inheritance: first.inheritance, zygosity: "heterozygous_carrier" },
      ],
    });
  };

  const updateMutation = (index: number, patch: Partial<MutationRow>) => {
    update({
      mutations: value.mutations.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    });
  };

  const removeMutation = (index: number) => {
    update({ mutations: value.mutations.filter((_, i) => i !== index) });
  };

  const isEmpty =
    !value.backgroundColor &&
    !value.featherType &&
    !value.hasCrest &&
    value.mutations.length === 0;

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-amber-300 bg-amber-50/40 p-3">
      <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
        <Dna className="w-3.5 h-3.5" />
        Genótipo Avançado — opcional, salvo automaticamente após cadastrar o pássaro
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Cor de Fundo (Lipocromo)</Label>
          <Select
            value={value.backgroundColor || "__none__"}
            onValueChange={(v) => update({ backgroundColor: v === "__none__" ? "" : v })}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Não informado —</SelectItem>
              {BACKGROUND_COLORS.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Plumagem</Label>
          <Select
            value={value.featherType || "__none__"}
            onValueChange={(v) => update({ featherType: v === "__none__" ? "" : v })}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Não informado —</SelectItem>
              {FEATHER_TYPES.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-white p-2.5">
        <div>
          <p className="text-sm font-medium">Tem crista</p>
          <p className="text-xs text-gray-400">Gene dominante, letal em dose dupla — evite cruzar dois com crista</p>
        </div>
        <Switch checked={value.hasCrest} onCheckedChange={(v) => update({ hasCrest: v })} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs">Mutações Melânicas / Lipocrômicas</Label>
          <Button type="button" size="sm" variant="ghost" onClick={addMutation}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Adicionar
          </Button>
        </div>
        {value.mutations.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhuma mutação registrada.</p>
        ) : (
          <div className="space-y-2">
            {value.mutations.map((m, i) => (
              <div key={i} className="flex items-center gap-2 border rounded-lg p-2 bg-white">
                <Select
                  value={m.mutation}
                  onValueChange={(val) => {
                    const def = ALL_MUTATIONS.find((x) => x.id === val)!;
                    updateMutation(i, { mutation: val, inheritance: def.inheritance });
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
                  onValueChange={(val) => updateMutation(i, { zygosity: val as MutationRow["zygosity"] })}
                >
                  <SelectTrigger className="h-8 text-xs w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ZYGOSITY_LABELS)
                      // Fêmeas não podem ser "portadoras" em traço ligado ao sexo (sistema ZW)
                      .filter(([key]) => !(sex === "fêmea" && m.inheritance === "sex_linked_recessive" && key === "heterozygous_carrier"))
                      .map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => removeMutation(i)}
                  className="text-gray-300 hover:text-red-500 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isEmpty && (
        <p className="text-xs text-amber-600">
          ✓ Genótipo será salvo automaticamente após cadastrar o pássaro
        </p>
      )}
    </div>
  );
}
