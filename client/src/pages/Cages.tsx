import { useMemo, useState } from "react";
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
import { Boxes, DoorOpen, Download, Edit2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

const emptyForm = {
  code: "",
  startNumber: "1",
  endNumber: "20",
  prefix: "",
  padding: "3",
  section: "",
  batchName: "",
  purpose: "",
  specialtyCode: "",
  breedName: "",
  capacity: "1",
  status: "free",
  notes: "",
};

type CageForm = typeof emptyForm;

function specialtyName(code: string | null | undefined) {
  if (!code) return "—";
  return SPECIALTIES.find((item) => item.id === code)?.name ?? code;
}

export default function Cages() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CageForm>(emptyForm);
  const [search, setSearch] = useState("");

  const { data: cages = [], refetch } = trpc.cages.list.useQuery();

  const createCage = trpc.cages.create.useMutation({
    onSuccess: () => {
      toast.success("Gaiola cadastrada com sucesso.");
      refetch();
      closeDialog();
    },
    onError: (error) => toast.error("Erro ao cadastrar gaiola: " + error.message),
  });

  const createBatch = trpc.cages.createBatch.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.count} gaiola${result.count === 1 ? "" : "s"} cadastrada${result.count === 1 ? "" : "s"} no lote.`);
      refetch();
      closeDialog();
    },
    onError: (error) => toast.error("Erro ao cadastrar lote: " + error.message),
  });

  const updateCage = trpc.cages.update.useMutation({
    onSuccess: () => {
      toast.success("Gaiola atualizada com sucesso.");
      refetch();
      closeDialog();
    },
    onError: (error) => toast.error("Erro ao atualizar gaiola: " + error.message),
  });

  const deleteCage = trpc.cages.delete.useMutation({
    onSuccess: (result) => {
      toast.success(`Gaiola ${result.code} apagada com segurança.`);
      refetch();
    },
    onError: (error) => toast.error("Erro ao apagar gaiola: " + error.message),
  });

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    setMode("single");
    setFormData(emptyForm);
  };

  const openNew = () => {
    setEditingId(null);
    setMode("single");
    setFormData(emptyForm);
  };

  const openEdit = (cage: (typeof cages)[number]) => {
    setEditingId(cage.id);
    setMode("single");
    setFormData({
      ...emptyForm,
      code: cage.code,
      section: cage.section ?? "",
      batchName: cage.batchName ?? "",
      purpose: cage.purpose ?? "",
      specialtyCode: cage.specialtyCode ?? "",
      breedName: cage.breedName ?? "",
      capacity: String(cage.capacity),
      status: cage.status,
      notes: cage.notes ?? "",
    });
    setOpen(true);
  };

  const commonPayload = {
    section: formData.section || undefined,
    batchName: formData.batchName || undefined,
    purpose: formData.purpose || undefined,
    specialtyCode: formData.specialtyCode || undefined,
    breedName: formData.breedName || undefined,
    capacity: Number.parseInt(formData.capacity, 10) || 1,
    notes: formData.notes || undefined,
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (editingId) {
      if (!formData.code.trim()) return toast.error("Informe o código da gaiola.");
      updateCage.mutate({
        id: editingId,
        code: formData.code.trim(),
        section: formData.section || null,
        batchName: formData.batchName || null,
        purpose: formData.purpose || null,
        specialtyCode: formData.specialtyCode || null,
        breedName: formData.breedName || null,
        capacity: Number.parseInt(formData.capacity, 10) || 1,
        status: formData.status as "free" | "occupied" | "maintenance",
        notes: formData.notes || null,
      });
      return;
    }

    if (mode === "single") {
      if (!formData.code.trim()) return toast.error("Informe o código da gaiola.");
      createCage.mutate({
        code: formData.code.trim(),
        ...commonPayload,
      });
      return;
    }

    const startNumber = Number.parseInt(formData.startNumber, 10);
    const endNumber = Number.parseInt(formData.endNumber, 10);
    const padding = Number.parseInt(formData.padding, 10);
    if (!Number.isInteger(startNumber) || !Number.isInteger(endNumber)) return toast.error("Informe a numeração inicial e final do lote.");
    if (endNumber < startNumber) return toast.error("O número final deve ser maior ou igual ao inicial.");
    createBatch.mutate({
      startNumber,
      endNumber,
      prefix: formData.prefix,
      padding: Number.isInteger(padding) ? padding : 3,
      ...commonPayload,
    });
  };

  const handleDelete = (cage: (typeof cages)[number]) => {
    if (!cage.canDelete) {
      const reason = cage.activeCoupleCount > 0
        ? "A gaiola possui um casal ativo. Desfaça o casal primeiro."
        : "A gaiola possui pássaros ativos. Transfira-os primeiro.";
      toast.error(reason);
      return;
    }
    if (confirm(`Apagar a gaiola ${cage.code}? O histórico de casais e posturas já encerrados será preservado.`)) {
      deleteCage.mutate(cage.id);
    }
  };

  const filteredCages = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return cages;
    return cages.filter((cage) => [
      cage.code,
      cage.section,
      cage.batchName,
      cage.purpose,
      cage.breedName,
      specialtyName(cage.specialtyCode),
    ].some((value) => String(value ?? "").toLowerCase().includes(term)));
  }, [cages, search]);

  const previewCodes = useMemo(() => {
    const start = Number.parseInt(formData.startNumber, 10);
    const end = Number.parseInt(formData.endNumber, 10);
    const padding = Number.parseInt(formData.padding, 10) || 3;
    if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) return [];
    const count = Math.min(end - start + 1, 4);
    const codes = Array.from({ length: count }, (_, index) => `${formData.prefix}${String(start + index).padStart(padding, "0")}`);
    if (end - start + 1 > count) codes.push("…", `${formData.prefix}${String(end).padStart(padding, "0")}`);
    return codes;
  }, [formData.startNumber, formData.endNumber, formData.padding, formData.prefix]);

  const exportCsv = () => {
    if (filteredCages.length === 0) return;
    const header = ["Código", "Lote", "Setor", "Destinação", "Especialidade", "Raça/variedade", "Capacidade", "Status", "Casais ativos", "Pássaros ativos", "Observações"];
    const rows = filteredCages.map((cage) => [
      cage.code,
      cage.batchName ?? "",
      cage.section ?? "",
      cage.purpose ?? "",
      specialtyName(cage.specialtyCode),
      cage.breedName ?? "",
      cage.capacity,
      cage.status,
      cage.activeCoupleCount,
      cage.activeBirdCount,
      cage.notes ?? "",
    ]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "relatorio-de-gaiolas.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const statusLabel: Record<string, { label: string; className: string }> = {
    free: { label: "Livre", className: "bg-green-100 text-green-800" },
    occupied: { label: "Ocupada", className: "bg-yellow-100 text-yellow-800" },
    maintenance: { label: "Manutenção", className: "bg-red-100 text-red-800" },
  };

  const pending = createCage.isPending || createBatch.isPending || updateCage.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestão de Gaiolas</h1>
            <p className="mt-2 text-gray-600">Cadastro individual ou em lote, com destinação e rastreabilidade.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={filteredCages.length === 0}>
              <Download className="mr-2 h-4 w-4" />Relatório CSV
            </Button>
            <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : closeDialog())}>
              <DialogTrigger asChild>
                <Button className="bg-amber-600 hover:bg-amber-700" onClick={openNew}>
                  <Plus className="mr-2 h-4 w-4" />Nova Gaiola / Lote
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar Gaiola" : "Cadastrar Gaiolas"}</DialogTitle>
                  <DialogDescription>
                    {editingId ? "Atualize a identificação e a destinação desta gaiola." : "Cadastre uma gaiola específica ou uma sequência completa sem criar duplicidades."}
                  </DialogDescription>
                </DialogHeader>

                {!editingId && (
                  <div className="grid grid-cols-2 rounded-lg border p-1">
                    <button
                      type="button"
                      onClick={() => setMode("single")}
                      className={`rounded-md px-3 py-2 text-sm font-medium ${mode === "single" ? "bg-amber-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                    >
                      Uma gaiola
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("batch")}
                      className={`rounded-md px-3 py-2 text-sm font-medium ${mode === "batch" ? "bg-amber-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                    >
                      Lote sequencial
                    </button>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === "single" || editingId ? (
                    <div>
                      <Label htmlFor="code">Código da gaiola *</Label>
                      <Input id="code" value={formData.code} onChange={(event) => setFormData({ ...formData, code: event.target.value })} placeholder="Ex.: 075 ou A-01" />
                      <p className="mt-1 text-xs text-gray-400">Pode ser qualquer código ainda não utilizado no criadouro.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                      <div className="flex items-center gap-2 font-semibold text-amber-900"><Boxes className="h-4 w-4" />Numeração do lote</div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div><Label htmlFor="startNumber">Inicial *</Label><Input id="startNumber" type="number" min="0" value={formData.startNumber} onChange={(event) => setFormData({ ...formData, startNumber: event.target.value })} /></div>
                        <div><Label htmlFor="endNumber">Final *</Label><Input id="endNumber" type="number" min="0" value={formData.endNumber} onChange={(event) => setFormData({ ...formData, endNumber: event.target.value })} /></div>
                        <div><Label htmlFor="prefix">Prefixo</Label><Input id="prefix" value={formData.prefix} onChange={(event) => setFormData({ ...formData, prefix: event.target.value })} placeholder="Ex.: A-" /></div>
                        <div><Label htmlFor="padding">Dígitos</Label><Input id="padding" type="number" min="1" max="6" value={formData.padding} onChange={(event) => setFormData({ ...formData, padding: event.target.value })} /></div>
                      </div>
                      <p className="text-sm text-amber-800">Prévia: {previewCodes.length ? previewCodes.join(", ") : "corrija a numeração"}</p>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><Label htmlFor="batchName">Nome do lote</Label><Input id="batchName" value={formData.batchName} onChange={(event) => setFormData({ ...formData, batchName: event.target.value })} placeholder="Ex.: Reprodução 2026 — Vermelhos" /></div>
                    <div><Label htmlFor="section">Setor / localização</Label><Input id="section" value={formData.section} onChange={(event) => setFormData({ ...formData, section: event.target.value })} placeholder="Ex.: Galpão 1 — Fileira 3" /></div>
                    <div><Label htmlFor="purpose">Destinação / linha</Label><Input id="purpose" value={formData.purpose} onChange={(event) => setFormData({ ...formData, purpose: event.target.value })} placeholder="Ex.: Canários vermelhos" /></div>
                    <div>
                      <Label>Especialidade / raça oficial</Label>
                      <Select value={formData.specialtyCode || "__none__"} onValueChange={(value) => setFormData({ ...formData, specialtyCode: value === "__none__" ? "" : value })}>
                        <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Não informar</SelectItem>
                          {SPECIALTIES.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label htmlFor="breedName">Raça / variedade complementar</Label><Input id="breedName" value={formData.breedName} onChange={(event) => setFormData({ ...formData, breedName: event.target.value })} placeholder="Ex.: Vermelho mosaico" /></div>
                    <div><Label htmlFor="capacity">Capacidade</Label><Input id="capacity" type="number" min="1" max="100" value={formData.capacity} onChange={(event) => setFormData({ ...formData, capacity: event.target.value })} /></div>
                  </div>

                  {editingId && (
                    <div>
                      <Label>Status operacional</Label>
                      <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Livre</SelectItem>
                          <SelectItem value="occupied">Ocupada</SelectItem>
                          <SelectItem value="maintenance">Manutenção</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div><Label htmlFor="notes">Observações</Label><Input id="notes" value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} placeholder="Informação opcional para manejo e relatórios" /></div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
                    <Button type="submit" className="bg-amber-600 hover:bg-amber-700" disabled={pending}>
                      {pending ? "Salvando..." : editingId ? "Salvar alterações" : mode === "batch" ? "Cadastrar lote" : "Cadastrar gaiola"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Gaiolas cadastradas</CardTitle>
            <CardDescription>{cages.length} gaiola{cages.length === 1 ? "" : "s"} ativa{cages.length === 1 ? "" : "s"} no cadastro.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar código, lote, setor, linha ou raça..." />
            </div>

            {filteredCages.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Lote / localização</TableHead>
                      <TableHead>Destinação</TableHead>
                      <TableHead>Capacidade</TableHead>
                      <TableHead>Ocupação</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCages.map((cage) => {
                      const status = statusLabel[cage.status] ?? { label: cage.status, className: "bg-gray-100 text-gray-800" };
                      const deleteReason = cage.activeCoupleCount > 0
                        ? "Possui casal ativo"
                        : cage.activeBirdCount > 0
                          ? "Possui pássaros ativos"
                          : "Apagar gaiola";
                      return (
                        <TableRow key={cage.id}>
                          <TableCell className="font-mono font-bold">{cage.code}</TableCell>
                          <TableCell>
                            <p className="text-sm font-medium">{cage.batchName || "Sem lote"}</p>
                            <p className="text-xs text-gray-400">{cage.section || "Sem localização"}</p>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">{cage.purpose || "—"}</p>
                            <p className="text-xs text-gray-400">{specialtyName(cage.specialtyCode)}{cage.breedName ? ` · ${cage.breedName}` : ""}</p>
                          </TableCell>
                          <TableCell>{cage.capacity}</TableCell>
                          <TableCell className="text-xs text-gray-600">
                            <p>{cage.activeCoupleCount} casal{cage.activeCoupleCount === 1 ? "" : "is"}</p>
                            <p>{cage.activeBirdCount} pássaro{cage.activeBirdCount === 1 ? "" : "s"}</p>
                          </TableCell>
                          <TableCell><span className={`rounded px-2 py-1 text-xs font-medium ${status.className}`}>{status.label}</span></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" title="Editar gaiola" onClick={() => openEdit(cage)}><Edit2 className="h-4 w-4" /></Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className={cage.canDelete ? "text-red-600" : "text-gray-300"}
                                disabled={!cage.canDelete}
                                title={deleteReason}
                                onClick={() => handleDelete(cage)}
                              >
                                <Trash2 className="h-4 w-4" />
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
              <div className="py-10 text-center text-gray-500">
                <DoorOpen className="mx-auto mb-2 h-10 w-10 opacity-30" />
                <p>{search ? "Nenhuma gaiola encontrada para a busca." : "Nenhuma gaiola cadastrada ainda."}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
