import { useState } from "react";
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
import { Plus, Edit2, Trash2, GitBranch } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { PhotoUploader } from "@/components/PhotoUploader";
import { AIJudgePanel } from "@/components/AIJudgePanel";
import { HealthLog } from "@/components/HealthLog";

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

  const { data: birds, refetch } = trpc.birds.list.useQuery({});
  const { data: editingPhotos } = trpc.photos.listByEntity.useQuery(
    { entityType: "bird", entityId: editingId ?? 0 },
    { enabled: !!editingId }
  );

  const createBird = trpc.birds.create.useMutation({
    onSuccess: () => {
      toast.success("Pássaro cadastrado com sucesso!");
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

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
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

    const payload = {
      ring: formData.ring,
      specialty_code: formData.specialty,
      sex: formData.sex,
      color_code: formData.color,
      birthDate: formData.birthDate ? new Date(formData.birthDate) : undefined,
      procedence: formData.procedence,
      notes: formData.notes,
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
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ring">Anilha *</Label>
                    <Input
                      id="ring"
                      value={formData.ring}
                      onChange={(e) => setFormData({ ...formData, ring: e.target.value })}
                      placeholder="Ex: 2026-001"
                    />
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
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    {editingId ? "Fechar" : "Cancelar"}
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    {editingId ? "Salvar alterações" : "Cadastrar"}
                  </Button>
                </div>
              </form>

              {/* Fotos e Juiz Virtual só ficam disponíveis depois que o
                  pássaro já existe (precisam de um ID para vincular). */}
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
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Table */}
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
                      <TableRow key={bird.id}>
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
                        <TableCell>
                          <div className="flex gap-2">
                            <Link href={`/pedigree/${bird.id}`}>
                              <Button size="sm" variant="ghost" title="Ver pedigree e consanguinidade">
                                <GitBranch className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(bird)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(bird.id)}>
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
      </div>
    </DashboardLayout>
  );
}
