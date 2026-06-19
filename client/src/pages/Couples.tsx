import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { SPECIALTIES } from "@shared/constants";
import { Plus, Edit2, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

const emptyForm = { maleId: "", femaleId: "", cageNumber: "", formationDate: "" };

export default function Couples() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const { data: couples, refetch } = trpc.management.couples.list.useQuery();
  const { data: birds } = trpc.birds.list.useQuery({});
  const malesAvailable = birds?.filter((b) => b.sex === "macho");
  const femalesAvailable = birds?.filter((b) => b.sex === "fêmea");
  const ringOf = (id: number) => birds?.find((b) => b.id === id)?.ring ?? `#${id}`;
  const specialtyName = (code: string) => SPECIALTIES.find((s) => s.id === code)?.name ?? code;

  const createCouple = trpc.management.couples.create.useMutation({
    onSuccess: () => {
      toast.success("Casal cadastrado com sucesso!");
      refetch();
      closeDialog();
    },
    onError: (error) => toast.error("Erro ao cadastrar casal: " + error.message),
  });

  const updateCouple = trpc.management.couples.update.useMutation({
    onSuccess: () => {
      toast.success("Casal atualizado com sucesso!");
      refetch();
      closeDialog();
    },
    onError: (error) => toast.error("Erro ao atualizar casal: " + error.message),
  });

  const deleteCouple = trpc.management.couples.delete.useMutation({
    onSuccess: () => {
      toast.success("Casal removido com sucesso!");
      refetch();
    },
    onError: (error) => toast.error("Erro ao remover casal: " + error.message),
  });

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const openEdit = (couple: NonNullable<typeof couples>[number]) => {
    setEditingId(couple.id);
    setFormData({
      maleId: String(couple.maleId),
      femaleId: String(couple.femaleId),
      cageNumber: couple.cageNumber ?? "",
      formationDate: new Date(couple.formationDate).toISOString().slice(0, 10),
    });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.maleId || !formData.femaleId || !formData.formationDate) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const payload = {
      maleId: parseInt(formData.maleId),
      femaleId: parseInt(formData.femaleId),
      cageNumber: formData.cageNumber,
      formationDate: new Date(formData.formationDate),
    };

    if (editingId) {
      updateCouple.mutate({ id: editingId, ...payload });
    } else {
      createCouple.mutate(payload);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja remover este casal?")) {
      deleteCouple.mutate(id);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestão de Cruzamentos</h1>
            <p className="text-gray-600 mt-2">Registre e acompanhe seus casais</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700" onClick={() => { setEditingId(null); setFormData(emptyForm); }}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Casal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Casal" : "Formar Novo Casal"}</DialogTitle>
                <DialogDescription>Selecione o macho e a fêmea para formar o casal</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="maleId">Macho *</Label>
                    <Select value={formData.maleId} onValueChange={(value) => setFormData({ ...formData, maleId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o macho..." />
                      </SelectTrigger>
                      <SelectContent>
                        {malesAvailable?.map((bird) => (
                          <SelectItem key={bird.id} value={bird.id.toString()}>
                            {bird.ring} - {specialtyName(bird.specialty_code)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="femaleId">Fêmea *</Label>
                    <Select value={formData.femaleId} onValueChange={(value) => setFormData({ ...formData, femaleId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a fêmea..." />
                      </SelectTrigger>
                      <SelectContent>
                        {femalesAvailable?.map((bird) => (
                          <SelectItem key={bird.id} value={bird.id.toString()}>
                            {bird.ring} - {specialtyName(bird.specialty_code)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="cageNumber">Número da Gaiola</Label>
                    <Input
                      id="cageNumber"
                      value={formData.cageNumber}
                      onChange={(e) => setFormData({ ...formData, cageNumber: e.target.value })}
                      placeholder="Ex: G-01"
                    />
                  </div>
                  <div>
                    <Label htmlFor="formationDate">Data de Formação *</Label>
                    <Input
                      id="formationDate"
                      type="date"
                      value={formData.formationDate}
                      onChange={(e) => setFormData({ ...formData, formationDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-green-600 hover:bg-green-700">
                    {editingId ? "Salvar alterações" : "Formar Casal"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Casais Cadastrados</CardTitle>
            <CardDescription>Total: {couples?.length || 0} casais</CardDescription>
          </CardHeader>
          <CardContent>
            {couples && couples.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gaiola</TableHead>
                      <TableHead>Macho</TableHead>
                      <TableHead>Fêmea</TableHead>
                      <TableHead>Data Formação</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {couples.map((couple) => (
                      <TableRow key={couple.id}>
                        <TableCell className="font-semibold">{couple.cageNumber || "-"}</TableCell>
                        <TableCell className="font-mono text-sm">{ringOf(couple.maleId)}</TableCell>
                        <TableCell className="font-mono text-sm">{ringOf(couple.femaleId)}</TableCell>
                        <TableCell>{new Date(couple.formationDate).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                            {couple.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Link href={`/ficha-gaiola/${couple.id}`}>
                              <Button size="sm" variant="ghost" title="Gerar Ficha de Gaiola">
                                <FileText className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(couple)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(couple.id)}>
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
                <p>Nenhum casal cadastrado ainda.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
