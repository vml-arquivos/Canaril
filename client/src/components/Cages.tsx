import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Plus, DoorOpen } from "lucide-react";
import { toast } from "sonner";

export default function Cages() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ code: "", section: "", capacity: "1", notes: "" });

  const { data: cages, refetch } = trpc.cages.list.useQuery();

  const createCage = trpc.cages.create.useMutation({
    onSuccess: () => {
      toast.success("Gaiola cadastrada com sucesso!");
      refetch();
      setOpen(false);
      setFormData({ code: "", section: "", capacity: "1", notes: "" });
    },
    onError: (error) => toast.error("Erro ao cadastrar gaiola: " + error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code) {
      toast.error("Informe o código da gaiola");
      return;
    }
    createCage.mutate({
      code: formData.code,
      section: formData.section || undefined,
      capacity: parseInt(formData.capacity) || 1,
      notes: formData.notes || undefined,
    });
  };

  const statusLabel: Record<string, { label: string; className: string }> = {
    free: { label: "Livre", className: "bg-green-100 text-green-800" },
    occupied: { label: "Ocupada", className: "bg-yellow-100 text-yellow-800" },
    maintenance: { label: "Manutenção", className: "bg-red-100 text-red-800" },
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestão de Gaiolas</h1>
            <p className="text-gray-600 mt-2">Mapeamento espacial do criadouro</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-600 hover:bg-amber-700">
                <Plus className="w-4 h-4 mr-2" />
                Nova Gaiola
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Cadastrar Gaiola</DialogTitle>
                <DialogDescription>Registre uma gaiola do criadouro</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="code">Código *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Ex: A-01"
                  />
                </div>
                <div>
                  <Label htmlFor="section">Setor / Localização</Label>
                  <Input
                    id="section"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    placeholder="Ex: Galpão 1 - Fileira 3"
                  />
                </div>
                <div>
                  <Label htmlFor="capacity">Capacidade</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-amber-600 hover:bg-amber-700">
                    Cadastrar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Gaiolas Cadastradas</CardTitle>
            <CardDescription>Total: {cages?.length || 0} gaiolas</CardDescription>
          </CardHeader>
          <CardContent>
            {cages && cages.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Capacidade</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cages.map((cage) => {
                    const st = statusLabel[cage.status] ?? { label: cage.status, className: "bg-gray-100 text-gray-800" };
                    return (
                      <TableRow key={cage.id}>
                        <TableCell className="font-mono font-semibold">{cage.code}</TableCell>
                        <TableCell>{cage.section || "-"}</TableCell>
                        <TableCell>{cage.capacity}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${st.className}`}>{st.label}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <DoorOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Nenhuma gaiola cadastrada ainda.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
