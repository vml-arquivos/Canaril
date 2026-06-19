import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Plus, Edit2, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function Rings() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    number: "",
    year: new Date().getFullYear().toString(),
    color: "",
    quantity: "1",
  });

  const { data: rings, refetch } = trpc.management.rings.list.useQuery();

  const createRing = trpc.management.rings.create.useMutation({
    onSuccess: () => {
      toast.success("Lote de anilhas cadastrado com sucesso!");
      refetch();
      setOpen(false);
      setFormData({
        number: "",
        year: new Date().getFullYear().toString(),
        color: "",
        quantity: "1",
      });
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar anilhas: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.number || !formData.year) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    createRing.mutate({
      number: formData.number,
      year: parseInt(formData.year),
      color: formData.color,
      quantity: parseInt(formData.quantity),
    });
  };

  const totalRings = rings?.reduce((sum, r) => sum + r.quantity, 0) || 0;
  const usedRings = rings?.reduce((sum, r) => sum + r.usedQuantity, 0) || 0;
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
                    <Label htmlFor="number">Número do Lote *</Label>
                    <Input
                      id="number"
                      value={formData.number}
                      onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                      placeholder="Ex: BR-2024-001"
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
                    <Label htmlFor="quantity">Quantidade *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      min="1"
                    />
                  </div>
                </div>
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
                      const available = ring.quantity - ring.usedQuantity;
                      return (
                        <TableRow key={ring.id}>
                          <TableCell className="font-mono font-semibold">{ring.number}</TableCell>
                          <TableCell>{ring.year}</TableCell>
                          <TableCell>{ring.color || "-"}</TableCell>
                          <TableCell>{ring.quantity}</TableCell>
                          <TableCell className="text-yellow-600">{ring.usedQuantity}</TableCell>
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
                            <div className="flex gap-2">
                              <Button size="sm" variant="ghost">
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-red-600">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
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
