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
import { Plus, Trophy, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function Championships() {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", association: "", location: "", startDate: "" });

  const { data: championships, refetch } = trpc.championships.list.useQuery();

  const createChampionship = trpc.championships.create.useMutation({
    onSuccess: () => {
      toast.success("Campeonato cadastrado com sucesso!");
      refetch();
      setOpen(false);
      setFormData({ name: "", association: "", location: "", startDate: "" });
    },
    onError: (error) => toast.error("Erro ao cadastrar campeonato: " + error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.startDate) {
      toast.error("Preencha nome e data de início");
      return;
    }
    createChampionship.mutate({
      name: formData.name,
      association: formData.association || undefined,
      location: formData.location || undefined,
      startDate: new Date(formData.startDate),
    });
  };

  const selected = championships?.find((c) => c.id === selectedId) ?? null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Campeonatos</h1>
            <p className="text-gray-600 mt-2">Gestão de pista, inscrições e pontuações</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-yellow-600 hover:bg-yellow-700">
                <Plus className="w-4 h-4 mr-2" />
                Novo Campeonato
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Cadastrar Campeonato</DialogTitle>
                <DialogDescription>Registre um novo campeonato ou exposição</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Campeonato Brasília 2026"
                  />
                </div>
                <div>
                  <Label htmlFor="association">Associação / Órgão</Label>
                  <Input
                    id="association"
                    value={formData.association}
                    onChange={(e) => setFormData({ ...formData, association: e.target.value })}
                    placeholder="Ex: FOB, OBJO, COM"
                  />
                </div>
                <div>
                  <Label htmlFor="location">Local</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="startDate">Data de Início *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-yellow-600 hover:bg-yellow-700">
                    Cadastrar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Campeonatos Cadastrados</CardTitle>
              <CardDescription>Total: {championships?.length || 0}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {championships && championships.length > 0 ? (
                championships.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left p-3 rounded-lg border flex items-center justify-between transition-colors ${
                      selectedId === c.id ? "border-yellow-500 bg-yellow-50" : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{c.name}</p>
                      <p className="text-sm text-gray-500">
                        {c.association ?? "-"} · {new Date(c.startDate).toLocaleDateString("pt-BR")} · {c.location ?? "-"}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Trophy className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Nenhum campeonato cadastrado ainda.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {selected ? (
            <ChampionshipEntries championship={selected} />
          ) : (
            <Card className="flex items-center justify-center text-gray-400">
              <CardContent className="py-12 text-center">
                <Trophy className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Selecione um campeonato para ver as inscrições</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function ChampionshipEntries({ championship }: { championship: { id: number; name: string } }) {
  const [open, setOpen] = useState(false);
  const [birdId, setBirdId] = useState("");
  const [category, setCategory] = useState("");
  const [cageNumberAtShow, setCageNumberAtShow] = useState("");

  const { data: entries, refetch } = trpc.championships.entries.listByChampionship.useQuery(championship.id);
  const { data: birds } = trpc.birds.list.useQuery({});

  const createEntry = trpc.championships.entries.create.useMutation({
    onSuccess: () => {
      toast.success("Pássaro inscrito com sucesso!");
      refetch();
      setOpen(false);
      setBirdId("");
      setCategory("");
      setCageNumberAtShow("");
    },
    onError: (error) => toast.error("Erro ao inscrever: " + error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!birdId || !category) {
      toast.error("Selecione o pássaro e a categoria");
      return;
    }
    createEntry.mutate({
      championshipId: championship.id,
      birdId: parseInt(birdId),
      category,
      cageNumberAtShow: cageNumberAtShow || undefined,
    });
  };

  const statusLabel: Record<string, { label: string; className: string }> = {
    registered: { label: "Inscrito", className: "bg-blue-100 text-blue-800" },
    judged: { label: "Julgado", className: "bg-green-100 text-green-800" },
    disqualified: { label: "Desclassificado", className: "bg-red-100 text-red-800" },
    awarded: { label: "Premiado", className: "bg-purple-100 text-purple-800" },
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{championship.name}</CardTitle>
          <CardDescription>{entries?.length || 0} pássaros inscritos</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Inscrever
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Inscrever Pássaro</DialogTitle>
              <DialogDescription>Adicione um pássaro do plantel a este campeonato</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Pássaro *</Label>
                <Select value={birdId} onValueChange={setBirdId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {birds?.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.ring} — {b.specialty_code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="category">Categoria *</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ex: Gloster Corona Amarelo Intenso"
                />
              </div>
              <div>
                <Label htmlFor="cageNumberAtShow">Gaiola na exposição</Label>
                <Input
                  id="cageNumberAtShow"
                  value={cageNumberAtShow}
                  onChange={(e) => setCageNumberAtShow(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Inscrever</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {entries && entries.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Gaiola</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const st = statusLabel[entry.status] ?? { label: entry.status, className: "bg-gray-100 text-gray-800" };
                return (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.category}</TableCell>
                    <TableCell>{entry.cageNumberAtShow || "-"}</TableCell>
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
            <p>Nenhum pássaro inscrito ainda.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
