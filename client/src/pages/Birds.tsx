import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { SEXES } from "@shared/constants";
import { Plus, Edit2, Trash2, GitBranch, Eye, LayoutGrid, List, Bird as BirdIcon, Sparkles, Tag, Dna, ChevronsUpDown, Check, Search } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { PhotoUploader } from "@/components/PhotoUploader";
import { BirdPhotoRecognition } from "@/components/BirdPhotoRecognition";
import { AIJudgePanel } from "@/components/AIJudgePanel";
import { HealthLog } from "@/components/HealthLog";
import { GenotypeEditor } from "@/components/GenotypeEditor";
import { GenotypeEditorDraft, EMPTY_GENOTYPE_DRAFT, type GenotypeDraft } from "@/components/GenotypeEditorDraft";
import { BirdFicha } from "@/components/BirdFicha";
import { BirdPhotoIdentifier } from "@/components/BirdPhotoIdentifier";

const CUSTOM_OPTION = "__custom__";

const emptyForm = {
  ring: "",
  nickname: "",
  speciesName: "Canário",
  modality: "COR",
  officialClassId: "",
  breedName: "",
  fatherId: "",
  motherId: "",
  specialty: "",
  sex: "",
  color: "",
  birthDate: "",
  procedence: "",
  notes: "",
  isPublic: false,
};

const SPECIES_OPTIONS = [
  { id: "Canário", name: "Canário" },
  { id: "Ave ornamental", name: "Ave ornamental / outra espécie" },
];

const MODALITY_OPTIONS = [
  { id: "COR", name: "Canário de Cor" },
  { id: "PORTE", name: "Canário de Porte" },
  { id: "CANTO", name: "Canário de Canto" },
  { id: "OUTRA", name: "Outra modalidade" },
];

/**
 * Chave de comparação tolerante a acentuação/maiúsculas/conectores — espelha
 * server/_core/legacyCatalogSync.ts, para casar "Frisado do Norte" (oficial)
 * com "FRISADO_DO_NORTE" (banco) mesmo com grafias diferentes.
 */
function dedupeKey(label: string): string {
  const noAccents = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  return noAccents
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .filter((token) => !["DO", "DA", "DE", "DOS", "DAS", "E"].includes(token))
    .join("");
}

type CatalogOption = { code: string; name: string };

/**
 * Encontra a especialidade correspondente à raça (breedName) da classe
 * oficial selecionada. Comparação exata por nome normalizado — a classe
 * oficial já traz o nome correto da raça, então não há necessidade (nem
 * espaço para erro) de adivinhar por palavras-chave como antes.
 */
function deriveSpecialtyFromOfficialClass(
  specialtiesList: readonly CatalogOption[],
  cls?: { breedName?: string | null }
): string {
  if (!cls?.breedName) return "";
  const key = dedupeKey(cls.breedName);
  return specialtiesList.find((s) => dedupeKey(s.name) === key)?.code ?? "";
}

/**
 * Encontra a cor/mutação correspondente ao grupo oficial (groupName) da
 * classe selecionada. Mesma lógica: comparação exata, não heurística.
 */
function deriveColorFromOfficialClass(
  colorsList: readonly CatalogOption[],
  cls?: { groupName?: string | null }
): string {
  if (!cls?.groupName) return "";
  const key = dedupeKey(cls.groupName);
  return colorsList.find((c) => dedupeKey(c.name) === key)?.code ?? "";
}

function labelFromId<T extends { id: string; name: string }>(items: readonly T[], id?: string | null) {
  return items.find((i) => i.id === id)?.name ?? id ?? "";
}

// Mesma classificação usada no backend (server/_core/costAllocation.ts) —
// fonte: NIAAS (independência dos pais aos ~40 dias) e Petz (maturidade
// reprodutiva recomendada em 1 ano) para canário-belga.
function ageCategoryOf(birthDate: string | Date | null | undefined): "filhote" | "jovem" | "adulto" | "desconhecido" {
  if (!birthDate) return "desconhecido";
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return "desconhecido";
  const ageDays = (Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays < 0) return "desconhecido";
  if (ageDays <= 40) return "filhote";
  if (ageDays <= 365) return "jovem";
  return "adulto";
}

const AGE_BADGE_STYLE: Record<string, string> = {
  filhote: "bg-green-100 text-green-700",
  jovem: "bg-blue-100 text-blue-700",
  adulto: "bg-gray-100 text-gray-600",
  desconhecido: "bg-amber-50 text-amber-600",
};
const AGE_BADGE_LABEL: Record<string, string> = {
  filhote: "Filhote", jovem: "Jovem", adulto: "Adulto", desconhecido: "Idade ?",
};

function labelFromCode(items: readonly CatalogOption[], code?: string | null) {
  return items.find((i) => i.code === code)?.name ?? code ?? "";
}

function previewTitle(
  form: typeof emptyForm,
  officialName: string | null | undefined,
  specialtiesList: readonly CatalogOption[],
  colorsList: readonly CatalogOption[]
) {
  const modalityName = MODALITY_OPTIONS.find((m) => m.id === form.modality)?.name ?? "Canário";
  const breedOrMode = form.breedName || modalityName || labelFromCode(specialtiesList, form.specialty) || "Canário";
  const phenotype = officialName || labelFromCode(colorsList, form.color) || "Classe não informada";
  const sex = labelFromId(SEXES, form.sex) || "Sexo não informado";
  return `${form.ring || "Sem anilha"} — ${breedOrMode} — ${phenotype} — ${sex}`;
}

export default function Birds() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [officialClassSearch, setOfficialClassSearch] = useState("");
  const [officialClassPopoverOpen, setOfficialClassPopoverOpen] = useState(false);
  const [specialtyCustom, setSpecialtyCustom] = useState(false);
  const [colorCustom, setColorCustom] = useState(false);
  const [officialClassLimit, setOfficialClassLimit] = useState(800);
  // isDirty: previne fechamento acidental quando o criador já alterou algo no formulário
  const [isDirty, setIsDirty] = useState(false);

  // Helper: atualiza formData e marca isDirty
  const patchForm = (patch: Partial<typeof emptyForm>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
    setIsDirty(true);
  };

  // Genótipo draft — usado apenas no modal de CRIAÇÃO (sem birdId ainda)
  const [genotypeDraft, setGenotypeDraft] = useState<GenotypeDraft>(EMPTY_GENOTYPE_DRAFT);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState("");
  const [filterColor, setFilterColor] = useState("");
  const [filterSex, setFilterSex] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Lista SEM filtro — usada só pra alimentar os seletores de Pai/Mãe no
  // formulário. Não pode ser filtrada pela busca da tela, senão o criador
  // não conseguiria escolher um pai/mãe fora do que está sendo buscado.
  const { data: allBirdsForSelects } = trpc.birds.list.useQuery({});

  // Lista FILTRADA — usada na grade/lista principal da tela.
  const { data: birds, refetch } = trpc.birds.list.useQuery({
    search: searchTerm || undefined,
    specialty_code: filterSpecialty || undefined,
    color_code: filterColor || undefined,
    sex: filterSex || undefined,
    status: filterStatus || undefined,
  });
  const { data: officialClassResults } = trpc.catalog.searchOfficialClasses.useQuery(
    {
      query: officialClassSearch || undefined,
      modality: formData.modality === "COR" || formData.modality === "PORTE" ? formData.modality : undefined,
      limit: officialClassLimit,
      offset: 0,
    },
    { enabled: open && (formData.modality === "COR" || formData.modality === "PORTE") }
  );
  const [fichaBird, setFichaBird] = useState<NonNullable<typeof birds>[number] | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const { data: primaryPhotos } = trpc.photos.primaryByEntityType.useQuery({ entityType: "bird" });
  const { data: editingPhotos } = trpc.photos.listByEntity.useQuery(
    { entityType: "bird", entityId: editingId ?? 0 },
    { enabled: !!editingId }
  );

  // Especialidades (raças) e Cores/Mutações — únicas fontes agora são estas
  // duas queries, que leem diretamente specialties/colors no banco (mesmas
  // tabelas populadas pelo catálogo oficial FOB/OBJO). Substituem as listas
  // hardcoded que existiam em shared/constants.ts, que podiam divergir do
  // catálogo real.
  const { data: specialtiesData } = trpc.catalog.specialtiesList.useQuery();
  const { data: colorsData } = trpc.catalog.colorsList.useQuery();
  const specialtiesList = specialtiesData ?? [];
  const colorsList = colorsData ?? [];

  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const uploadPendingPhoto = trpc.photos.create.useMutation();

  // Salva genótipo draft após criar o pássaro
  const saveGenotype = trpc.mendelian.upsertGenotype.useMutation({
    onError: () => {
      toast.warning("Pássaro cadastrado, mas o genótipo não pôde ser salvo. Edite o pássaro para tentar novamente.");
    },
  });

  const createBird = trpc.birds.create.useMutation({
    onSuccess: async (data) => {
      toast.success("Pássaro cadastrado com sucesso!");

      // Salva a foto pendente
      if (pendingPhoto && data.bird) {
        try {
          await uploadPendingPhoto.mutateAsync({
            entityType: "bird",
            entityId: data.bird.id,
            dataUrl: pendingPhoto,
            isPrimary: true,
          });
        } catch {
          toast.error("Pássaro salvo, mas a foto não pôde ser anexada. Adicione-a editando o pássaro.");
        }
      }

      // Salva o genótipo draft se tiver algum dado preenchido
      if (data.bird) {
        const hasGenotype =
          genotypeDraft.backgroundColor ||
          genotypeDraft.featherType ||
          genotypeDraft.hasCrest ||
          genotypeDraft.mutations.length > 0;

        if (hasGenotype) {
          saveGenotype.mutate({
            birdId: data.bird.id,
            backgroundColor: genotypeDraft.backgroundColor || undefined,
            featherType: (genotypeDraft.featherType as "intenso" | "nevado") || undefined,
            hasCrest: genotypeDraft.hasCrest,
            mutations: genotypeDraft.mutations,
          });
        }
      }

      refetch();
      closeDialog();
    },
    onError: (error) => toast.error("Erro ao cadastrar pássaro: " + error.message),
  });

  const updateBird = trpc.birds.update.useMutation({
    onSuccess: () => {
      toast.success("Pássaro atualizado com sucesso!");
      refetch();
    },
    onError: (error) => toast.error("Erro ao atualizar pássaro: " + error.message),
  });

  const deleteBird = trpc.birds.delete.useMutation({
    onSuccess: () => {
      toast.success("Pássaro deletado com sucesso!");
      refetch();
    },
    onError: (error) => toast.error("Erro ao deletar pássaro: " + error.message),
  });

  // Sugestão automática de próxima anilha disponível
  const { data: nextRing } = trpc.ringsV2.rings.getNext.useQuery(
    {},
    { enabled: open && !editingId }
  );

  // Preenche automaticamente o campo de anilha ao abrir o formulário de criação
  useEffect(() => {
    if (open && !editingId && nextRing?.fullCode && !formData.ring) {
      setFormData(prev => ({ ...prev, ring: nextRing.fullCode }));
    }
  }, [open, editingId, nextRing, formData.ring]);

  const selectedOfficialClass = officialClassResults?.items.find((cls) => String(cls.id) === formData.officialClassId);

  // Agrupa as classes por categoria (grupo de cor, para COR; raça, para
  // PORTE) — em vez de uma lista plana de até 771 itens, o combobox mostra
  // seções com cabeçalho, muito mais fácil de escanear visualmente.
  const groupedOfficialClasses = (() => {
    const items = officialClassResults?.items ?? [];
    const groups = new Map<string, typeof items>();
    for (const cls of items) {
      const heading = (cls.groupName || cls.breedName || "Outras classes") as string;
      if (!groups.has(heading)) groups.set(heading, []);
      groups.get(heading)!.push(cls);
    }
    return Array.from(groups.entries());
  })();

  useEffect(() => {
    if (!selectedOfficialClass) return;
    setFormData((prev) => {
      const nextSpecialty = prev.specialty || deriveSpecialtyFromOfficialClass(specialtiesList, selectedOfficialClass);
      const nextColor = prev.color || deriveColorFromOfficialClass(colorsList, selectedOfficialClass);
      return {
        ...prev,
        modality: selectedOfficialClass.modality,
        breedName: selectedOfficialClass.breedName ?? prev.breedName,
        specialty: nextSpecialty,
        color: nextColor,
      };
    });
  }, [selectedOfficialClass, specialtiesList, colorsList]);

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    setFormData(emptyForm);
    setPendingPhoto(null);
    setGenotypeDraft(EMPTY_GENOTYPE_DRAFT);
    setOfficialClassSearch("");
    setIsDirty(false);
  };

  // Guarda o fechamento acidental via clique fora do modal
  const handleDialogOpenChange = (v: boolean) => {
    if (!v && isDirty) {
      const confirm = window.confirm("Você tem alterações não salvas. Deseja sair sem salvar?");
      if (!confirm) return;
    }
    if (v) {
      setOpen(true);
    } else {
      closeDialog();
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setGenotypeDraft(EMPTY_GENOTYPE_DRAFT);
    setOfficialClassSearch("");
    setIsDirty(false);
    setOpen(true);
  };

  const openEdit = (bird: NonNullable<typeof birds>[number]) => {
    setEditingId(bird.id);
    setFormData({
      ring: bird.ring,
      nickname: bird.nickname ?? "",
      speciesName: bird.speciesName ?? "Canário",
      modality: bird.modality ?? "COR",
      officialClassId: bird.officialClassId ? String(bird.officialClassId) : "",
      breedName: bird.breedName ?? "",
      fatherId: bird.fatherId ? String(bird.fatherId) : "",
      motherId: bird.motherId ? String(bird.motherId) : "",
      specialty: bird.specialty_code,
      sex: bird.sex,
      color: bird.color_code,
      birthDate: bird.birthDate ? new Date(bird.birthDate).toISOString().slice(0, 10) : "",
      procedence: bird.procedence ?? "",
      notes: bird.notes ?? "",
      isPublic: bird.isPublic ?? false,
    });
    setOfficialClassSearch(bird.breedName ?? "");
    setIsDirty(false);
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ring || !formData.sex) {
      toast.error("Informe anilha e sexo. Classe oficial, especialidade e cor podem ser preenchidas por select ou inferidas pela classe oficial.");
      return;
    }

    const officialId = formData.officialClassId ? Number(formData.officialClassId) : undefined;
    const payload = {
      ring: formData.ring,
      nickname: formData.nickname || undefined,
      speciesName: formData.speciesName || "Canário",
      modality: formData.modality || undefined,
      officialClassId: Number.isFinite(officialId) ? officialId : undefined,
      breedName: formData.breedName || undefined,
      fatherId: formData.fatherId && formData.fatherId !== "none" ? Number(formData.fatherId) : undefined,
      motherId: formData.motherId && formData.motherId !== "none" ? Number(formData.motherId) : undefined,
      specialty_code: formData.specialty || undefined,
      sex: formData.sex,
      color_code: formData.color || undefined,
      birthDate: formData.birthDate || undefined,
      procedence: formData.procedence || undefined,
      notes: formData.notes || undefined,
    };

    if (editingId) {
      updateBird.mutate({ id: editingId, ...payload, isPublic: formData.isPublic });
    } else {
      createBird.mutate(payload);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja deletar este pássaro?")) {
      deleteBird.mutate(id);
    }
  };

  const primaryPhotoUrl = editingPhotos?.find((p) => p.isPrimary)?.url ?? editingPhotos?.[0]?.url ?? null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestão de Pássaros</h1>
            <p className="text-gray-600 mt-2">Cadastre e gerencie seus pássaros</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setView("grid")}
                className={`p-2 ${view === "grid" ? "bg-blue-600 text-white" : "bg-white text-gray-500"}`}
                title="Visualização em blocos"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView("list")}
                className={`p-2 ${view === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-500"}`}
                title="Visualização em lista"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <Dialog open={open} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Pássaro
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Pássaro" : "Cadastrar Novo Pássaro"}</DialogTitle>
                <DialogDescription>
                  {editingId ? "Atualize os dados do pássaro" : "Preencha os dados do pássaro abaixo"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingId && (
                  <BirdPhotoIdentifier
                    onIdentified={(result) => {
                      const colorName = colorsList.find((c) => c.code === result.color_code)?.name;
                      setFormData((prev) => ({
                        ...prev,
                        specialty: result.specialty_code,
                        color: result.color_code,
                        modality: prev.modality || "COR",
                      }));
                      setIsDirty(true);
                      setPendingPhoto(result.dataUrl);
                      // Pré-filtra o combobox de classe oficial com o nome da
                      // cor que a IA identificou, para a nomenclatura já
                      // aparecer sugerida quando o criador rolar até lá —
                      // em vez de uma lista vazia/genérica para preencher do zero.
                      if (colorName) setOfficialClassSearch(colorName);
                    }}
                  />
                )}
                <div className="rounded-xl border bg-blue-50/60 p-3 space-y-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Ficha inteligente do pássaro</h3>
                    <p className="text-xs text-gray-500">Use os selects oficiais para gerar título, ficha genética e dados para confronto de casais.</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="nickname">Apelido / nome interno</Label>
                      <Input
                        id="nickname"
                        value={formData.nickname}
                        onChange={(e) => patchForm({ nickname: e.target.value })}
                        placeholder="Ex: Matriz 01, Campeão, Fêmea Topete"
                      />
                    </div>
                    <div>
                      <Label htmlFor="speciesName">Espécie *</Label>
                      <Select value={formData.speciesName} onValueChange={(value) => patchForm({ speciesName: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {SPECIES_OPTIONS.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="modality">Modalidade</Label>
                      <Select
                        value={formData.modality}
                        onValueChange={(value) => { patchForm({ modality: value, officialClassId: "" }); setOfficialClassLimit(800); }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {MODALITY_OPTIONS.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="breedName">Raça / linhagem visual</Label>
                      <Input
                        id="breedName"
                        value={formData.breedName}
                        onChange={(e) => patchForm({ breedName: e.target.value })}
                        placeholder="Preenchido pela classe oficial quando houver"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="officialClassSearch">Classe oficial FOB/OBJO</Label>
                    <Popover open={officialClassPopoverOpen} onOpenChange={setOfficialClassPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          disabled={formData.modality !== "COR" && formData.modality !== "PORTE"}
                          className="w-full justify-between font-normal"
                        >
                          <span className="truncate text-left">
                            {selectedOfficialClass
                              ? `${selectedOfficialClass.officialCode} — ${selectedOfficialClass.officialName}`
                              : "Digite para buscar na nomenclatura oficial..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Busque: ágata, gloster, branco, vermelho, mosaico..."
                            value={officialClassSearch}
                            onValueChange={setOfficialClassSearch}
                          />
                          <div className="px-3 py-1.5 text-xs text-gray-400 border-b flex items-center justify-between gap-2">
                            <span>
                              {officialClassResults
                                ? officialClassResults.total > (officialClassResults.items?.length ?? 0)
                                  ? `Mostrando ${officialClassResults.items.length} de ${officialClassResults.total} classes`
                                  : `${officialClassResults.total} classe${officialClassResults.total === 1 ? "" : "s"} encontrada${officialClassResults.total === 1 ? "" : "s"}`
                                : "Carregando nomenclatura..."}
                            </span>
                            {officialClassResults && officialClassResults.total > officialClassResults.items.length && (
                              <button
                                type="button"
                                className="text-amber-600 hover:underline shrink-0"
                                onClick={() => setOfficialClassLimit(officialClassResults.total)}
                              >
                                Mostrar todas
                              </button>
                            )}
                          </div>
                          <CommandList>
                            <CommandEmpty>Nenhuma classe encontrada para essa busca.</CommandEmpty>
                            {groupedOfficialClasses.map(([heading, items]) => (
                              <CommandGroup key={heading} heading={heading}>
                                {items.map((cls) => (
                                  <CommandItem
                                    key={cls.id}
                                    value={String(cls.id)}
                                    onSelect={() => {
                                      patchForm({ officialClassId: String(cls.id) });
                                      setOfficialClassPopoverOpen(false);
                                    }}
                                  >
                                    <Check className={`mr-2 h-4 w-4 ${String(cls.id) === formData.officialClassId ? "opacity-100" : "opacity-0"}`} />
                                    <span className="truncate">
                                      {cls.officialCode} — {cls.officialName}
                                      {cls.breedName ? ` · ${cls.breedName}` : ""}
                                    </span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            ))}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {selectedOfficialClass && (
                      <p className="text-xs text-green-700 bg-green-50 rounded p-2">
                        Selecionado: {selectedOfficialClass.officialCode} — {selectedOfficialClass.officialName}.
                        O sistema criará/atualizará o perfil genético interpretado automaticamente.
                      </p>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="fatherId">Pai conhecido</Label>
                      <Select value={formData.fatherId} onValueChange={(value) => patchForm({ fatherId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Não informado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Não informado</SelectItem>
                          {(allBirdsForSelects ?? []).filter((b) => b.id !== editingId && b.sex !== "fêmea").map((b) => (
                            <SelectItem key={b.id} value={String(b.id)}>
                              {(b.displayTitle || b.ring)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="motherId">Mãe conhecida</Label>
                      <Select value={formData.motherId} onValueChange={(value) => patchForm({ motherId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Não informado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Não informado</SelectItem>
                          {(allBirdsForSelects ?? []).filter((b) => b.id !== editingId && b.sex !== "macho").map((b) => (
                            <SelectItem key={b.id} value={String(b.id)}>
                              {(b.displayTitle || b.ring)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-white p-2">
                    <p className="text-xs text-gray-400 uppercase">Título automático</p>
                    <p className="text-sm font-medium text-gray-900">{previewTitle(formData, selectedOfficialClass?.officialName, specialtiesList, colorsList)}</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ring" className="flex items-center gap-2">
                      Anilha *
                      {!editingId && nextRing && (
                        <span className="text-xs text-green-600 font-normal flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          próxima disponível
                        </span>
                      )}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="ring"
                        value={formData.ring}
                        onChange={(e) => patchForm({ ring: e.target.value })}
                        placeholder="Ex: 2026-001"
                        className="flex-1"
                      />
                      {!editingId && nextRing && nextRing.fullCode !== formData.ring && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-green-600 border-green-300 hover:bg-green-50 shrink-0"
                          onClick={() => { setFormData(prev => ({ ...prev, ring: nextRing.fullCode })); setIsDirty(true); }}
                          title={`Usar próxima anilha disponível: ${nextRing.fullCode}`}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    {!editingId && nextRing?.batch && (
                      <p className="text-xs text-gray-400 mt-1">
                        Lote: {nextRing.batch.batch_number}
                        {nextRing.batch.ringGaugeMm ? ` • ${nextRing.batch.ringGaugeMm}mm` : ""}
                        {nextRing.batch.color ? ` • ${nextRing.batch.color}` : ""}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="specialty">Especialidade / resumo <span className="text-xs font-normal text-gray-400">({specialtiesList.length} disponíveis)</span></Label>
                    {specialtyCustom ? (
                      <div className="flex gap-2">
                        <Input
                          id="specialty"
                          value={formData.specialty}
                          onChange={(e) => patchForm({ specialty: e.target.value })}
                          placeholder="Digite a raça/especialidade"
                        />
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setSpecialtyCustom(false); patchForm({ specialty: "" }); }}>
                          Usar lista
                        </Button>
                      </div>
                    ) : (
                      <Select
                        value={formData.specialty}
                        onValueChange={(value) => {
                          if (value === CUSTOM_OPTION) { setSpecialtyCustom(true); patchForm({ specialty: "" }); return; }
                          patchForm({ specialty: value });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {specialtiesList.map((s) => (
                            <SelectItem key={s.code} value={s.code}>
                              {s.name}
                            </SelectItem>
                          ))}
                          <SelectItem value={CUSTOM_OPTION}>✎ Outro (digitar manualmente)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="sex">Sexo *</Label>
                    <Select value={formData.sex} onValueChange={(value) => patchForm({ sex: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {SEXES.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="color">Cor/Mutação / resumo <span className="text-xs font-normal text-gray-400">({colorsList.length} disponíveis)</span></Label>
                    {colorCustom ? (
                      <div className="flex gap-2">
                        <Input
                          id="color"
                          value={formData.color}
                          onChange={(e) => patchForm({ color: e.target.value })}
                          placeholder="Digite a cor/mutação"
                        />
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setColorCustom(false); patchForm({ color: "" }); }}>
                          Usar lista
                        </Button>
                      </div>
                    ) : (
                      <Select
                        value={formData.color}
                        onValueChange={(value) => {
                          if (value === CUSTOM_OPTION) { setColorCustom(true); patchForm({ color: "" }); return; }
                          patchForm({ color: value });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {colorsList.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.name}
                            </SelectItem>
                          ))}
                          <SelectItem value={CUSTOM_OPTION}>✎ Outro (digitar manualmente)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="birthDate">Data de Nascimento</Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) => patchForm({ birthDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="procedence">Procedência</Label>
                    <Input
                      id="procedence"
                      value={formData.procedence}
                      onChange={(e) => patchForm({ procedence: e.target.value })}
                      placeholder="Ex: Criadouro XYZ (se vier de outro plantel)"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => patchForm({ notes: e.target.value })}
                    placeholder="Notas adicionais..."
                  />
                </div>

                {/* Genótipo Avançado disponível TAMBÉM no modal de criação */}
                {!editingId && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1 text-sm">Genótipo Avançado (opcional)</h3>
                    <p className="text-xs text-gray-400 mb-2">
                      Preencha para liberar a predição mendeliana de cruzamento (cor de fundo, plumagem, crista e mutações)
                    </p>
                    <GenotypeEditorDraft
                      sex={formData.sex}
                      value={genotypeDraft}
                      onChange={setGenotypeDraft}
                    />
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    {editingId ? "Fechar" : "Cancelar"}
                  </Button>
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={createBird.isPending || updateBird.isPending}
                  >
                    {createBird.isPending || updateBird.isPending
                      ? "Salvando..."
                      : editingId
                      ? "Salvar alterações"
                      : "Cadastrar"}
                  </Button>
                </div>
              </form>

              {/* Fotos, Juiz Virtual, Saúde e Genótipo Avançado (modo edição)
                  ficam disponíveis depois que o pássaro já existe (precisam de um ID). */}
              {editingId && (
                <div className="border-t pt-4 mt-2 space-y-5">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium text-gray-900">Exibir na vitrine pública</p>
                      <p className="text-sm text-gray-500">Aparece na página inicial do criadouro, com a foto de capa</p>
                    </div>
                    <Switch
                      checked={formData.isPublic}
                      onCheckedChange={(checked) => {
                        patchForm({ isPublic: checked });
                        updateBird.mutate({ id: editingId, isPublic: checked });
                      }}
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Fotos</h3>
                    <PhotoUploader entityType="bird" entityId={editingId} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Reconhecimento por Foto (IA)</h3>
                    <p className="text-xs text-gray-400 mb-2">
                      Sugere a classe oficial FOB/OBJO a partir das fotos já cadastradas — você sempre confirma antes de aplicar.
                    </p>
                    <BirdPhotoRecognition birdId={editingId} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Juiz Virtual (IA)</h3>
                    <AIJudgePanel birdId={editingId} specialtyCode={formData.specialty} primaryPhotoUrl={primaryPhotoUrl} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Saúde e Alimentação</h3>
                    <HealthLog birdId={editingId} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Genótipo Avançado (opcional)</h3>
                    <p className="text-xs text-gray-400 mb-2">
                      Preencha pra liberar a predição mendeliana de cruzamento (cor de fundo, plumagem, crista e mutações)
                    </p>
                    <GenotypeEditor birdId={editingId} sex={formData.sex} />
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Busca e filtros */}
        <div className="flex flex-wrap items-center gap-2 bg-white border rounded-xl p-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar por anilha ou apelido..."
              className="pl-9 h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterSpecialty || "__all__"} onValueChange={(v) => setFilterSpecialty(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Especialidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as especialidades</SelectItem>
              {specialtiesList.map((s) => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterColor || "__all__"} onValueChange={(v) => setFilterColor(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Cor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as cores</SelectItem>
              {colorsList.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSex || "__all__"} onValueChange={(v) => setFilterSex(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="Sexo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Ambos</SelectItem>
              <SelectItem value="macho">♂ Macho</SelectItem>
              <SelectItem value="fêmea">♀ Fêmea</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus || "__all__"} onValueChange={(v) => setFilterStatus(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="sold">Vendido</SelectItem>
              <SelectItem value="deceased">Falecido</SelectItem>
              <SelectItem value="transferred">Transferido</SelectItem>
            </SelectContent>
          </Select>
          {(searchTerm || filterSpecialty || filterColor || filterSex || filterStatus) && (
            <Button variant="ghost" size="sm" className="h-9 text-xs text-gray-500"
              onClick={() => { setSearchTerm(""); setFilterSpecialty(""); setFilterColor(""); setFilterSex(""); setFilterStatus(""); }}>
              Limpar filtros
            </Button>
          )}
          <span className="text-xs text-gray-400 ml-auto shrink-0">{birds?.length ?? 0} resultado{(birds?.length ?? 0) === 1 ? "" : "s"}</span>
        </div>

        {/* Visualização em blocos (grade com avatar) ou lista (tabela) */}
        {view === "grid" ? (
          <div>
            {birds && birds.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {birds.map((bird) => {
                  const photoUrl = primaryPhotos?.[bird.id];
                  return (
                    <button
                      key={bird.id}
                      onClick={() => setFichaBird(bird)}
                      className="text-left rounded-xl border bg-white overflow-hidden hover:shadow-md hover:border-blue-300 transition-all"
                    >
                      <div className="aspect-square bg-gray-100 relative">
                        {photoUrl ? (
                          <img src={photoUrl} alt={bird.ring} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <BirdIcon className="w-10 h-10" />
                          </div>
                        )}
                        <span className={`absolute top-1.5 right-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${AGE_BADGE_STYLE[ageCategoryOf(bird.birthDate)]}`}>
                          {AGE_BADGE_LABEL[ageCategoryOf(bird.birthDate)]}
                        </span>
                      </div>
                      <div className="p-2.5">
                        <p className="font-bold text-sm text-gray-900 truncate">{bird.displayTitle || bird.ring}</p>
                        {bird.nickname && <p className="text-xs text-blue-600 truncate">{bird.nickname}</p>}
                        <p className="text-xs text-gray-500 truncate">
                          {bird.breedName || labelFromCode(specialtiesList, bird.specialty_code)}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {labelFromCode(colorsList, bird.color_code)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400 border border-dashed rounded-xl">
                <BirdIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Nenhum pássaro cadastrado ainda.</p>
              </div>
            )}
          </div>
        ) : (
        <Card>
          <CardHeader>
            <CardTitle>Pássaros Cadastrados</CardTitle>
            <CardDescription>Total: {birds?.length || 0} pássaros</CardDescription>
          </CardHeader>
          <CardContent>
            {birds && birds.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pássaro</TableHead>
                      <TableHead>Identificação</TableHead>
                      <TableHead>Sexo</TableHead>
                      <TableHead>Cor</TableHead>
                      <TableHead>Data Nascimento</TableHead>
                      <TableHead>Idade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {birds.map((bird) => (
                      <TableRow
                        key={bird.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => setFichaBird(bird)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-semibold text-gray-900">{bird.displayTitle || bird.ring}</p>
                            {bird.nickname && <p className="text-xs text-blue-600">{bird.nickname}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{bird.breedName || labelFromCode(specialtiesList, bird.specialty_code)}</p>
                            <p className="text-xs text-gray-400 font-mono">{bird.ring}</p>
                          </div>
                        </TableCell>
                        <TableCell>{SEXES.find((s) => s.id === bird.sex)?.name ?? bird.sex}</TableCell>
                        <TableCell>{labelFromCode(colorsList, bird.color_code)}</TableCell>
                        <TableCell>{bird.birthDate ? new Date(bird.birthDate).toLocaleDateString("pt-BR") : "-"}</TableCell>
                        <TableCell>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${AGE_BADGE_STYLE[ageCategoryOf(bird.birthDate)]}`}>
                            {AGE_BADGE_LABEL[ageCategoryOf(bird.birthDate)]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                            {bird.status}
                          </span>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setFichaBird(bird)} title="Ver ficha rápida">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Link href={`/birds/${bird.id}/ficha`}>
                              <Button size="sm" variant="ghost" title="Ficha premium completa (nova página)">
                                <Dna className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Link href={`/pedigree/${bird.id}`}>
                              <Button size="sm" variant="ghost" title="Ver pedigree e consanguinidade">
                                <GitBranch className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(bird)} title="Editar">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(bird.id)} title="Excluir">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Nenhum pássaro cadastrado ainda.</p>
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      <BirdFicha
        bird={fichaBird}
        onClose={() => setFichaBird(null)}
        onEdit={(bird) => {
          setFichaBird(null);
          openEdit(bird as NonNullable<typeof birds>[number]);
        }}
      />
    </DashboardLayout>
  );
}
