import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function Rings() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    batch_number: "",
    year: new Date().getFullYear().toString(),
    color: "",
    startNumber: "1",
    endNumber: "200",
  });

  const { data: rings, refetch } = trpc.management.rings.list.useQuery();

  const createRing = trpc.management.rings.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Lote cadastrado! ${data.generated} anilhas individuais geradas.`);
      refetch();
      setOpen(false);
      setFormData({
        batch_number: "",
        year: new Date().getFullYear().toString(),
        color: "",
        startNumber: "1",
        endNumber: "200",
      });
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar anilhas: " + error.message);
    },
  });

  const deleteRingBatch = trpc.management.rings.delete.useMutation({
    onSuccess: () => {
      toast.success("Lote removido com sucesso!");
      refetch();
    },
    onError: (error) => toast.error("Erro ao remover lote: " + error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.batch_number || !formData.year || !formData.startNumber || !formData.endNumber) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (parseInt(formData.endNumber) < parseInt(formData.startNumber)) {
      toast.error("A numeração final deve ser maior ou igual à inicial");
      return;
    }

    createRing.mutate({
      batch_number: formData.batch_number,
      year: parseInt(formData.year),
      color: formData.color,
      startNumber: parseInt(formData.startNumber),
      endNumber: parseInt(formData.endNumber),
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja remover este lote? Anilhas já em uso bloqueiam a remoção.")) {
      deleteRingBatch.mutate(id);
    }
  };

  const previewCount =
    formData.startNumber && formData.endNumber
      ? Math.max(0, parseInt(formData.endNumber) - parseInt(formData.startNumber) + 1)
      : 0;

  const totalRings = rings?.reduce((sum, r) => sum + r.quantity_total, 0) || 0;
  const usedRings = rings?.reduce((sum, r) => sum + r.quantity_used, 0) || 0;
  const availableRings = totalRings - usedRings;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestão de Anilhas</h1>
            <p className="text-gray-600 mt-2">Controle de lotes e disponibilidade</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4 mr-2" />
                Novo Lote
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Lote de Anilhas</DialogTitle>
                <DialogDescription>Registre um novo lote de anilhas</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="batch_number">Número do Lote *</Label>
                    <Input
                      id="batch_number"
                      value={formData.batch_number}
                      onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                      placeholder="Ex: 001"
                    />
                  </div>
                  <div>
                    <Label htmlFor="year">Ano *</Label>
                    <Input
                      id="year"
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="color">Cor</Label>
                    <Input
                      id="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="Ex: Verde, Azul, Vermelho"
                    />
                  </div>
                  <div>
                    <Label htmlFor="startNumber">Numeração Inicial *</Label>
                    <Input
                      id="startNumber"
                      type="number"
                      min="1"
                      value={formData.startNumber}
                      onChange={(e) => setFormData({ ...formData, startNumber: e.target.value })}
                      placeholder="Ex: 1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endNumber">Numeração Final *</Label>
                    <Input
                      id="endNumber"
                      type="number"
                      min="1"
                      value={formData.endNumber}
                      onChange={(e) => setFormData({ ...formData, endNumber: e.target.value })}
                      placeholder="Ex: 200"
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Serão geradas <strong>{previewCount}</strong> anilhas individuais, numeradas de{" "}
                  <strong>{formData.year}-{String(formData.startNumber || 0).padStart(3, "0")}</strong> até{" "}
                  <strong>{formData.year}-{String(formData.endNumber || 0).padStart(3, "0")}</strong>.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
                    Cadastrar Lote
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total de Anilhas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{totalRings}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Anilhas em Uso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{usedRings}</div>
            </CardContent>
          </Card>
          <Card className={availableRings < 10 ? "border-red-200 bg-red-50" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Disponíveis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${availableRings < 10 ? "text-red-600" : "text-green-600"}`}>
                {availableRings}
              </div>
              {availableRings < 10 && (
                <div className="flex items-center gap-1 text-xs text-red-600 mt-2">
                  <AlertCircle className="w-3 h-3" />
                  Estoque baixo
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lotes de Anilhas</CardTitle>
            <CardDescription>Total: {rings?.length || 0} lotes cadastrados</CardDescription>
          </CardHeader>
          <CardContent>
            {rings && rings.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Ano</TableHead>
                      <TableHead>Cor</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Usadas</TableHead>
                      <TableHead>Disponíveis</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rings.map((ring) => {
                      const available = ring.quantity_total - ring.quantity_used;
                      return (
                        <TableRow key={ring.id}>
                          <TableCell className="font-mono font-semibold">{ring.batch_number}</TableCell>
                          <TableCell>{ring.year}</TableCell>
                          <TableCell>{ring.color || "-"}</TableCell>
                          <TableCell>{ring.quantity_total}</TableCell>
                          <TableCell className="text-yellow-600">{ring.quantity_used}</TableCell>
                          <TableCell className={available < 5 ? "text-red-600 font-semibold" : "text-green-600"}>
                            {available}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              available === 0 ? "bg-red-100 text-red-800" :
                              available < 5 ? "bg-yellow-100 text-yellow-800" :
                              "bg-green-100 text-green-800"
                            }`}>
                              {ring.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600"
                              onClick={() => handleDelete(ring.id)}
                              title="Remover lote (só se nenhuma anilha estiver em uso)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Nenhum lote de anilhas cadastrado ainda.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
