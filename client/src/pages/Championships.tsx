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
import { SPECIALTIES, COLORS } from "@shared/constants";
import { Plus, Trophy, ChevronRight, Edit2, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

export default function Championships() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", association: "", location: "", startDate: "" });

  const { data: championships, refetch } = trpc.championships.list.useQuery();

  const createChampionship = trpc.championships.create.useMutation({
    onSuccess: () => {
      toast.success("Campeonato cadastrado com sucesso!");
      refetch();
      closeDialog();
    },
    onError: (error) => toast.error("Erro ao cadastrar campeonato: " + error.message),
  });

  const updateChampionship = trpc.championships.update.useMutation({
    onSuccess: () => {
      toast.success("Campeonato atualizado com sucesso!");
      refetch();
      closeDialog();
    },
    onError: (error) => toast.error("Erro ao atualizar campeonato: " + error.message),
  });

  const deleteChampionship = trpc.championships.delete.useMutation({
    onSuccess: () => {
      toast.success("Campeonato removido com sucesso!");
      refetch();
      if (selectedId === editingId) setSelectedId(null);
    },
    onError: (error) => toast.error("Erro ao remover campeonato: " + error.message),
  });

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    setFormData({ name: "", association: "", location: "", startDate: "" });
  };

  const openEdit = (c: NonNullable<typeof championships>[number]) => {
    setEditingId(c.id);
    setFormData({
      name: c.name,
      association: c.association ?? "",
      location: c.location ?? "",
      startDate: new Date(c.startDate).toISOString().slice(0, 10),
    });
    setOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza? Isso também remove as inscrições e pontuações desse campeonato.")) {
      deleteChampionship.mutate(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.startDate) {
      toast.error("Preencha nome e data de início");
      return;
    }
    const payload = {
      name: formData.name,
      association: formData.association || undefined,
      location: formData.location || undefined,
      startDate: new Date(formData.startDate),
    };
    if (editingId) {
      updateChampionship.mutate({ id: editingId, ...payload });
    } else {
      createChampionship.mutate(payload);
    }
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
          <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
            <DialogTrigger asChild>
              <Button className="bg-yellow-600 hover:bg-yellow-700" onClick={() => { setEditingId(null); setFormData({ name: "", association: "", location: "", startDate: "" }); }}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Campeonato
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Campeonato" : "Cadastrar Campeonato"}</DialogTitle>
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
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-yellow-600 hover:bg-yellow-700">
                    {editingId ? "Salvar alterações" : "Cadastrar"}
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
                  <div
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left p-3 rounded-lg border flex items-center justify-between transition-colors cursor-pointer ${
                      selectedId === c.id ? "border-yellow-500 bg-yellow-50" : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                      <p className="text-sm text-gray-500 truncate">
                        {c.association ?? "-"} · {new Date(c.startDate).toLocaleDateString("pt-BR")} · {c.location ?? "-"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <ChevronRight className="w-4 h-4 text-gray-400 ml-1" />
                    </div>
                  </div>
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

        <JudgesManager />
      </div>
    </DashboardLayout>
  );
}

function ChampionshipEntries({ championship }: { championship: { id: number; name: string; status: string } }) {
  const [open, setOpen] = useState(false);
  const [birdId, setBirdId] = useState("");
  const [category, setCategory] = useState("");
  const [cageNumberAtShow, setCageNumberAtShow] = useState("");

  const { data: entries, refetch } = trpc.championships.entries.listByChampionship.useQuery(championship.id);
  const { data: birds } = trpc.birds.list.useQuery({});
  const utils = trpc.useUtils();

  const updateStatus = trpc.championships.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status do campeonato atualizado!");
      utils.championships.list.invalidate();
    },
    onError: (error) => toast.error("Erro: " + error.message),
  });

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

  const deleteEntry = trpc.championships.entries.delete.useMutation({
    onSuccess: () => {
      toast.success("Inscrição removida!");
      refetch();
    },
    onError: (error) => toast.error("Erro ao remover: " + error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!birdId || !category) {
      toast.error("Selecione o pássaro");
      return;
    }
    createEntry.mutate({
      championshipId: championship.id,
      birdId: parseInt(birdId),
      category,
      cageNumberAtShow: cageNumberAtShow || undefined,
    });
  };

  // Ao escolher o pássaro, a categoria de julgamento é montada
  // automaticamente a partir da especialidade + cor cadastradas — o
  // criador não precisa digitar nada.
  const handleBirdChange = (value: string) => {
    setBirdId(value);
    const bird = birds?.find((b) => String(b.id) === value);
    if (bird) {
      const specialtyName = SPECIALTIES.find((s) => s.id === bird.specialty_code)?.name ?? bird.specialty_code;
      const colorName = COLORS.find((c) => c.id === bird.color_code)?.name ?? bird.color_code;
      setCategory(`${specialtyName} ${colorName}`);
    }
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
        <div className="flex items-center gap-2">
          <Select value={championship.status} onValueChange={(value) => updateStatus.mutate({ id: championship.id, status: value as "upcoming" | "ongoing" | "finished" })}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">Próximo</SelectItem>
              <SelectItem value="ongoing">Em andamento</SelectItem>
              <SelectItem value="finished">Encerrado</SelectItem>
            </SelectContent>
          </Select>
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
                <Select value={birdId} onValueChange={handleBirdChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {birds?.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.ring} — {SPECIALTIES.find((s) => s.id === b.specialty_code)?.name ?? b.specialty_code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="category">Categoria (preenchida automaticamente)</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Selecione um pássaro acima"
                  className="bg-gray-50"
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
        </div>
      </CardHeader>
      <CardContent>
        {entries && entries.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pássaro</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Gaiola</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const st = statusLabel[entry.status] ?? { label: entry.status, className: "bg-gray-100 text-gray-800" };
                const bird = birds?.find((b) => b.id === entry.birdId);
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono">{bird?.ring ?? `#${entry.birdId}`}</TableCell>
                    <TableCell>{entry.category}</TableCell>
                    <TableCell>{entry.cageNumberAtShow || "-"}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${st.className}`}>{st.label}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <ScoreDialog entryId={entry.id} />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => {
                            if (confirm("Remover esta inscrição?")) deleteEntry.mutate(entry.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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

function ScoreDialog({ entryId }: { entryId: number }) {
  const [open, setOpen] = useState(false);
  const [judgeId, setJudgeId] = useState("");
  const [totalScore, setTotalScore] = useState("");
  const [placement, setPlacement] = useState("");
  const [notes, setNotes] = useState("");

  const { data: existingScores, refetch: refetchEntries } = trpc.championships.scores.listByEntry.useQuery(entryId);
  const { data: judges } = trpc.championships.judges.list.useQuery();
  const utils = trpc.useUtils();

  const createScore = trpc.championships.scores.create.useMutation({
    onSuccess: () => {
      toast.success("Pontuação registrada!");
      refetchEntries();
      utils.championships.entries.listByChampionship.invalidate();
      setOpen(false);
      setTotalScore("");
      setPlacement("");
      setNotes("");
      setJudgeId("");
    },
    onError: (error) => toast.error("Erro ao registrar pontuação: " + error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!totalScore) {
      toast.error("Informe a pontuação total");
      return;
    }
    createScore.mutate({
      entryId,
      judgeId: judgeId ? parseInt(judgeId) : undefined,
      totalScore: parseFloat(totalScore),
      placement: placement ? parseInt(placement) : undefined,
      notes: notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {existingScores && existingScores.length > 0 ? `Nota: ${existingScores[0].totalScore}` : "Pontuar"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Lançar Pontuação</DialogTitle>
          <DialogDescription>Registre a nota do juiz para esta inscrição</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Juiz</Label>
            <Select value={judgeId} onValueChange={setJudgeId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem juiz identificado" />
              </SelectTrigger>
              <SelectContent>
                {judges?.map((j) => (
                  <SelectItem key={j.id} value={String(j.id)}>{j.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="totalScore">Pontuação Total *</Label>
            <Input
              id="totalScore"
              type="number"
              step="0.1"
              value={totalScore}
              onChange={(e) => setTotalScore(e.target.value)}
              placeholder="Ex: 88.5"
            />
          </div>
          <div>
            <Label htmlFor="placement">Colocação (se premiado)</Label>
            <Input
              id="placement"
              type="number"
              min="1"
              value={placement}
              onChange={(e) => setPlacement(e.target.value)}
              placeholder="Ex: 1"
            />
          </div>
          <div>
            <Label htmlFor="notes">Observações do juiz</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function JudgesManager() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", registrationNumber: "", association: "" });

  const { data: judges, refetch } = trpc.championships.judges.list.useQuery();

  const createJudge = trpc.championships.judges.create.useMutation({
    onSuccess: () => { toast.success("Juiz cadastrado!"); refetch(); closeDialog(); },
    onError: (error) => toast.error("Erro: " + error.message),
  });
  const updateJudge = trpc.championships.judges.update.useMutation({
    onSuccess: () => { toast.success("Juiz atualizado!"); refetch(); closeDialog(); },
    onError: (error) => toast.error("Erro: " + error.message),
  });
  const deleteJudge = trpc.championships.judges.delete.useMutation({
    onSuccess: () => { toast.success("Juiz removido!"); refetch(); },
    onError: (error) => toast.error("Erro: " + error.message),
  });

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    setFormData({ name: "", registrationNumber: "", association: "" });
  };

  const openEdit = (j: NonNullable<typeof judges>[number]) => {
    setEditingId(j.id);
    setFormData({ name: j.name, registrationNumber: j.registrationNumber ?? "", association: j.association ?? "" });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Informe o nome do juiz");
      return;
    }
    if (editingId) {
      updateJudge.mutate({ id: editingId, ...formData });
    } else {
      createJudge.mutate(formData);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-yellow-600" />
            Juízes
          </CardTitle>
          <CardDescription>Cadastro de juízes credenciados</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setFormData({ name: "", registrationNumber: "", association: "" }); }}>
              <Plus className="w-4 h-4 mr-1" />
              Novo Juiz
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Juiz" : "Cadastrar Juiz"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="judgeName">Nome *</Label>
                <Input id="judgeName" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="judgeReg">Nº de Registro</Label>
                <Input id="judgeReg" value={formData.registrationNumber} onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="judgeAssoc">Associação</Label>
                <Input id="judgeAssoc" value={formData.association} onChange={(e) => setFormData({ ...formData, association: e.target.value })} placeholder="Ex: FOB" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
                <Button type="submit">{editingId ? "Salvar" : "Cadastrar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {judges && judges.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {judges.map((j) => (
              <div key={j.id} className="flex items-center justify-between border rounded-lg p-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{j.name}</p>
                  <p className="text-xs text-gray-400 truncate">{j.association || "-"} {j.registrationNumber ? `· ${j.registrationNumber}` : ""}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(j)}><Edit2 className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => { if (confirm("Remover este juiz?")) deleteJudge.mutate(j.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">Nenhum juiz cadastrado ainda.</p>
        )}
      </CardContent>
    </Card>
  );
}
