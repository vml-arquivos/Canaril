import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { SPECIALTIES, COLORS, SEXES } from "@shared/constants";
import { Plus, Edit2, Trash2, GitBranch, Eye, LayoutGrid, List, Bird as BirdIcon, Sparkles, Tag } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { PhotoUploader } from "@/components/PhotoUploader";
import { AIJudgePanel } from "@/components/AIJudgePanel";
import { HealthLog } from "@/components/HealthLog";
import { GenotypeEditor } from "@/components/GenotypeEditor";
import { GenotypeEditorDraft, EMPTY_GENOTYPE_DRAFT, type GenotypeDraft } from "@/components/GenotypeEditorDraft";
import { BirdFicha } from "@/components/BirdFicha";
import { BirdPhotoIdentifier } from "@/components/BirdPhotoIdentifier";

const emptyForm = {
  ring: "",
  specialty: "",
  sex: "",
  color: "",
  birthDate: "",
  procedence: "",
  notes: "",
  isPublic: false,
};

export default function Birds() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  // Genótipo draft — usado apenas no modal de CRIAÇÃO (sem birdId ainda)
  const [genotypeDraft, setGenotypeDraft] = useState<GenotypeDraft>(EMPTY_GENOTYPE_DRAFT);

  const { data: birds, refetch } = trpc.birds.list.useQuery({});
  const [fichaBird, setFichaBird] = useState<NonNullable<typeof birds>[number] | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const { data: primaryPhotos } = trpc.photos.primaryByEntityType.useQuery({ entityType: "bird" });
  const { data: editingPhotos } = trpc.photos.listByEntity.useQuery(
    { entityType: "bird", entityId: editingId ?? 0 },
    { enabled: !!editingId }
  );

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
  }, [open, editingId, nextRing]);

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    setFormData(emptyForm);
    setPendingPhoto(null);
    setGenotypeDraft(EMPTY_GENOTYPE_DRAFT);
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setGenotypeDraft(EMPTY_GENOTYPE_DRAFT);
    setOpen(true);
  };

  const openEdit = (bird: NonNullable<typeof birds>[number]) => {
    setEditingId(bird.id);
    setFormData({
      ring: bird.ring,
      specialty: bird.specialty_code,
      sex: bird.sex,
      color: bird.color_code,
      birthDate: bird.birthDate ? new Date(bird.birthDate).toISOString().slice(0, 10) : "",
      procedence: bird.procedence ?? "",
      notes: bird.notes ?? "",
      isPublic: bird.isPublic ?? false,
    });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ring || !formData.specialty || !formData.sex || !formData.color) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // birthDate é enviado como string 'YYYY-MM-DD' (ou undefined se vazio)
    // O servidor aceita string ISO via birthDateSchema (z.union([z.date(), z.string()]))
    const payload = {
      ring: formData.ring,
      specialty_code: formData.specialty,
      sex: formData.sex,
      color_code: formData.color,
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
            <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
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
                      setFormData((prev) => ({ ...prev, specialty: result.specialty_code, color: result.color_code }));
                      setPendingPhoto(result.dataUrl);
                    }}
                  />
                )}
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
                        onChange={(e) => setFormData({ ...formData, ring: e.target.value })}
                        placeholder="Ex: 2026-001"
                        className="flex-1"
                      />
                      {!editingId && nextRing && nextRing.fullCode !== formData.ring && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-green-600 border-green-300 hover:bg-green-50 shrink-0"
                          onClick={() => setFormData(prev => ({ ...prev, ring: nextRing.fullCode }))}
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
                    <Label htmlFor="specialty">Especialidade *</Label>
                    <Select value={formData.specialty} onValueChange={(value) => setFormData({ ...formData, specialty: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {SPECIALTIES.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="sex">Sexo *</Label>
                    <Select value={formData.sex} onValueChange={(value) => setFormData({ ...formData, sex: value })}>
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
                    <Label htmlFor="color">Cor/Mutação *</Label>
                    <Select value={formData.color} onValueChange={(value) => setFormData({ ...formData, color: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COLORS.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="birthDate">Data de Nascimento</Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="procedence">Procedência</Label>
                    <Input
                      id="procedence"
                      value={formData.procedence}
                      onChange={(e) => setFormData({ ...formData, procedence: e.target.value })}
                      placeholder="Ex: Criadouro XYZ (se vier de outro plantel)"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
                        setFormData({ ...formData, isPublic: checked });
                        updateBird.mutate({ id: editingId, isPublic: checked });
                      }}
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Fotos</h3>
                    <PhotoUploader entityType="bird" entityId={editingId} />
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
                      <div className="aspect-square bg-gray-100">
                        {photoUrl ? (
                          <img src={photoUrl} alt={bird.ring} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <BirdIcon className="w-10 h-10" />
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="font-mono font-bold text-sm text-gray-900 truncate">{bird.ring}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {SPECIALTIES.find((s) => s.id === bird.specialty_code)?.name ?? bird.specialty_code}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {COLORS.find((c) => c.id === bird.color_code)?.name ?? bird.color_code}
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
                      <TableHead>Anilha</TableHead>
                      <TableHead>Especialidade</TableHead>
                      <TableHead>Sexo</TableHead>
                      <TableHead>Cor</TableHead>
                      <TableHead>Data Nascimento</TableHead>
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
                        <TableCell className="font-mono font-semibold">{bird.ring}</TableCell>
                        <TableCell>{SPECIALTIES.find((s) => s.id === bird.specialty_code)?.name ?? bird.specialty_code}</TableCell>
                        <TableCell>{SEXES.find((s) => s.id === bird.sex)?.name ?? bird.sex}</TableCell>
                        <TableCell>{COLORS.find((c) => c.id === bird.color_code)?.name ?? bird.color_code}</TableCell>
                        <TableCell>{bird.birthDate ? new Date(bird.birthDate).toLocaleDateString("pt-BR") : "-"}</TableCell>
                        <TableCell>
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                            {bird.status}
                          </span>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setFichaBird(bird)} title="Ver ficha completa">
                              <Eye className="w-4 h-4" />
                            </Button>
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
