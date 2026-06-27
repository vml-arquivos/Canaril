import React, { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { SPECIALTIES, COLORS } from "@shared/constants";
import { Plus, Edit2, Trash2, FileText, LayoutGrid, List, Bird as BirdIcon, Heart, AlertTriangle, Dna, CheckCircle, ShieldAlert, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

const emptyForm = { maleId: "", femaleId: "", cageNumber: "", formationDate: "", status: "active" };

// ── Preview genético inline no modal de criação de casal ──────────────────────
function GeneticPreview({ maleId, femaleId }: { maleId: string; femaleId: string }) {
  const enabled = !!maleId && !!femaleId && maleId !== femaleId;
  const { data, isLoading } = trpc.genetics.buildCrossReport.useQuery(
    { maleId: Number(maleId), femaleId: Number(femaleId) },
    { enabled }
  );

  if (!enabled) return null;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-blue-600 animate-pulse">
        Calculando genética do casal…
      </div>
    );
  }

  if (!data) return null;

  const statusColors = {
    IDEAL:          "border-emerald-300 bg-emerald-50",
    APROVADO:       "border-blue-200 bg-blue-50",
    ATENCAO:        "border-amber-300 bg-amber-50",
    NAO_RECOMENDADO:"border-red-300 bg-red-50",
  } as Record<string, string>;

  const statusIcons: Record<string, React.ReactNode> = {
    IDEAL:           <CheckCircle className="w-4 h-4 text-emerald-600" />,
    APROVADO:        <CheckCircle className="w-4 h-4 text-blue-600" />,
    ATENCAO:         <AlertTriangle className="w-4 h-4 text-amber-600" />,
    NAO_RECOMENDADO: <ShieldAlert className="w-4 h-4 text-red-600" />,
  };

  const statusLabels = {
    IDEAL: "Par ideal", APROVADO: "Aprovado", ATENCAO: "Atenção", NAO_RECOMENDADO: "Não recomendado",
  } as Record<string, string>;

  const status = (data as any).status ?? "APROVADO";
  const coiPct = `${(((data as any).coi ?? 0) * 100).toFixed(1)}%`;
  const confidence = (data as any).confidenceLabel ?? "—";
  const warnings = (data as any).warnings ?? [];
  const missingData = (data as any).missingData ?? [];

  return (
    <div className={`rounded-xl border-2 px-4 py-3 space-y-2 ${statusColors[status] ?? statusColors.APROVADO}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Dna className="w-4 h-4 text-gray-500" />
          <span className="font-semibold text-sm text-gray-800">Análise genética do par</span>
        </div>
        <div className="flex items-center gap-1.5">
          {statusIcons[status]}
          <span className="text-sm font-bold">{statusLabels[status] ?? status}</span>
        </div>
      </div>

      <div className="flex gap-4 text-xs text-gray-600 flex-wrap">
        <span className="flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5" />
          <strong>COI:</strong> {coiPct}
          {(data as any).coiRisk === "high" && <span className="text-red-600 font-bold ml-1">⚠️ Alto</span>}
          {(data as any).coiRisk === "moderate" && <span className="text-amber-600 font-bold ml-1">Moderado</span>}
        </span>
        <span><strong>Confiança:</strong> {confidence}</span>
      </div>

      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.slice(0, 2).map((w: string, i: number) => (
            <p key={i} className="text-xs text-amber-800 flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{w}
            </p>
          ))}
        </div>
      )}

      {missingData.length > 0 && (
        <p className="text-xs text-gray-400">
          Genótipo incompleto: {missingData.join(", ")} — resultado aproximado
        </p>
      )}
    </div>
  );
}

export default function Couples() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [view, setView] = useState<"visual" | "table">("visual");
  const [detailId, setDetailId] = useState<number | null>(null);

  const { data: couples, refetch } = trpc.management.couples.list.useQuery();
  const { data: birds } = trpc.birds.list.useQuery({});
  // Pássaros já vinculados a um casal ATIVO não podem formar outro casal —
  // somem da lista de disponíveis até o casal anterior ser desfeito/
  // excluído. Ao editar um casal existente, o macho/fêmea dele mesmo
  // continuam aparecendo (senão o próprio formulário ficaria inválido).
  const pairedMaleIds = new Set(
    couples?.filter((c) => c.status === "active" && c.id !== editingId).map((c) => c.maleId)
  );
  const pairedFemaleIds = new Set(
    couples?.filter((c) => c.status === "active" && c.id !== editingId).map((c) => c.femaleId)
  );
  const malesAvailable = birds?.filter((b) => b.sex === "macho" && !pairedMaleIds.has(b.id));
  const femalesAvailable = birds?.filter((b) => b.sex === "fêmea" && !pairedFemaleIds.has(b.id));
  const ringOf = (id: number) => birds?.find((b) => b.id === id)?.ring ?? `#${id}`;
  const birdOf = (id: number) => birds?.find((b) => b.id === id);
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
      status: couple.status,
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
      updateCouple.mutate({ id: editingId, ...payload, status: formData.status });
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
          <div className="flex items-center gap-2">
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setView("visual")}
                className={`p-2 ${view === "visual" ? "bg-green-600 text-white" : "bg-white text-gray-500"}`}
                title="Visualização em gaiolas"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView("table")}
                className={`p-2 ${view === "table" ? "bg-green-600 text-white" : "bg-white text-gray-500"}`}
                title="Visualização em tabela"
              >
                <List className="w-4 h-4" />
              </button>
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
                  {editingId && (
                    <div>
                      <Label>Status</Label>
                      <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="inactive">Desfeito (libera os pássaros)</SelectItem>
                          <SelectItem value="finalized">Finalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <CoiWarning maleId={formData.maleId} femaleId={formData.femaleId} />

                {/* Preview genético completo — só aparece ao criar novo casal */}
                {!editingId && (
                  <GeneticPreview maleId={formData.maleId} femaleId={formData.femaleId} />
                )}

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
        </div>

        {/* Visualização em gaiolas (visual) ou tabela */}
        {view === "visual" ? (
          <div>
            {couples && couples.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {couples.map((couple) => {
                  const male = birdOf(couple.maleId);
                  const female = birdOf(couple.femaleId);
                  return (
                    <button
                      key={couple.id}
                      onClick={() => setDetailId(couple.id)}
                      className="text-left rounded-xl border-2 border-amber-200 bg-gradient-to-b from-amber-50 to-white p-4 hover:shadow-md hover:border-amber-400 transition-all relative"
                    >
                      {/* "grade" decorativa simulando uma gaiola */}
                      <div className="absolute inset-x-3 top-0 h-2 bg-[repeating-linear-gradient(90deg,#d4a574_0px,#d4a574_2px,transparent_2px,transparent_8px)] opacity-40 rounded-t" />
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                          Gaiola {couple.cageNumber || "-"}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          couple.status === "active" ? "bg-green-100 text-green-800" :
                          couple.status === "finalized" ? "bg-blue-100 text-blue-800" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {couple.status === "active" ? "Ativo" : couple.status === "finalized" ? "Finalizado" : "Desfeito"}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-3 py-2">
                        <BirdMini bird={male} symbol="♂" color="text-blue-500" />
                        <Heart className="w-5 h-5 text-rose-300 shrink-0" />
                        <BirdMini bird={female} symbol="♀" color="text-rose-500" />
                      </div>
                      <p className="text-center text-xs text-gray-400 mt-2">
                        Formado em {new Date(couple.formationDate).toLocaleDateString("pt-BR")}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400 border border-dashed rounded-xl">
                <BirdIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Nenhum casal formado ainda.</p>
              </div>
            )}
          </div>
        ) : (
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
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            couple.status === "active" ? "bg-green-100 text-green-800" :
                            couple.status === "finalized" ? "bg-blue-100 text-blue-800" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {couple.status === "active" ? "Ativo" : couple.status === "finalized" ? "Finalizado" : "Desfeito"}
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
        )}
      </div>

      {/* Ficha rápida ao clicar no card visual */}
      <CoupleDetailDialog
        couple={couples?.find((c) => c.id === detailId) ?? null}
        male={detailId ? birdOf(couples?.find((c) => c.id === detailId)?.maleId ?? -1) : undefined}
        female={detailId ? birdOf(couples?.find((c) => c.id === detailId)?.femaleId ?? -1) : undefined}
        onClose={() => setDetailId(null)}
        onEdit={(couple) => {
          setDetailId(null);
          openEdit(couple);
        }}
      />
    </DashboardLayout>
  );
}

function CoiWarning({ maleId, femaleId }: { maleId: string; femaleId: string }) {
  const enabled = !!maleId && !!femaleId;
  const { data } = trpc.genetics.coiForPair.useQuery(
    { maleId: parseInt(maleId || "0"), femaleId: parseInt(femaleId || "0") },
    { enabled }
  );

  if (!enabled || !data) return null;

  const config = {
    low: { label: "Parentesco baixo ou ausente — situação genética saudável.", className: "bg-green-50 border-green-200 text-green-800" },
    moderate: { label: "Parentesco moderado entre os pais — vale acompanhar com atenção.", className: "bg-yellow-50 border-yellow-200 text-yellow-800" },
    high: { label: "Parentesco ALTO entre os pais — risco genético elevado para os filhotes. Considere outro par.", className: "bg-red-50 border-red-300 text-red-800" },
  } as const;

  const c = config[data.risk as keyof typeof config];

  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${c.className}`}>
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold">Consanguinidade estimada do filhote: {(data.coi * 100).toFixed(1)}%</p>
        <p>{c.label}</p>
      </div>
    </div>
  );
}

function MendelianPrediction({ fatherId, motherId }: { fatherId: number; motherId: number }) {
  const { data, isLoading, error } = trpc.mendelian.predictCross.useQuery(
    { fatherId, motherId },
    { retry: false }
  );

  if (isLoading) return null;

  if (error) {
    return (
      <div className="border-t pt-3 mt-1">
        <p className="text-xs text-gray-400 italic">{error.message}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="border-t pt-3 mt-1 space-y-2">
      <p className="text-xs text-gray-400 uppercase flex items-center gap-1">
        <Dna className="w-3.5 h-3.5" />
        Predição Mendeliana
      </p>

      {data.warnings.map((w, i) => (
        <div key={i} className="rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-800">
          ⚠️ {w.message}
        </div>
      ))}

      {data.mutations.map((m) => (
        <div key={m.mutation} className="text-sm border rounded-lg p-2">
          <p className="font-medium text-gray-800 capitalize">{m.mutation.replace(/_/g, " ")}</p>
          {m.overall && (
            <p className="text-xs text-gray-500">
              {Object.entries(m.overall).map(([k, v]) => `${Math.round((v ?? 0) * 100)}% ${ZYGOSITY_SHORT[k]}`).join(" · ")}
            </p>
          )}
          {m.sons && m.daughters && (
            <div className="text-xs text-gray-500 space-y-0.5">
              <p>♂ {Object.entries(m.sons).map(([k, v]) => `${Math.round((v ?? 0) * 100)}% ${ZYGOSITY_SHORT[k]}`).join(" · ")}</p>
              <p>♀ {Object.entries(m.daughters).map(([k, v]) => `${Math.round((v ?? 0) * 100)}% ${ZYGOSITY_SHORT[k]}`).join(" · ")}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const ZYGOSITY_SHORT: Record<string, string> = {
  homozygous_mutant: "manifesta",
  heterozygous_carrier: "portador",
  homozygous_normal: "normal",
};

function BirdMini({ bird, symbol, color }: { bird: { ring: string; specialty_code: string; color_code: string } | undefined; symbol: string; color: string }) {
  if (!bird) {
    return (
      <div className="flex flex-col items-center gap-1 w-24">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-300">
          <BirdIcon className="w-6 h-6" />
        </div>
        <span className="text-xs text-gray-300">-</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1 w-24">
      <div className={`w-12 h-12 rounded-full bg-white border-2 border-current flex items-center justify-center text-lg font-bold ${color}`}>
        {symbol}
      </div>
      <span className="text-xs font-mono font-semibold text-gray-700 truncate max-w-full">{bird.ring}</span>
      <span className="text-[10px] text-gray-400 truncate max-w-full">
        {COLORS.find((c) => c.id === bird.color_code)?.name ?? bird.color_code}
      </span>
    </div>
  );
}

function CoupleDetailDialog({
  couple,
  male,
  female,
  onClose,
  onEdit,
}: {
  couple: { id: number; cageNumber: string | null; formationDate: Date | string; status: string } | null | undefined;
  male: { id: number; ring: string; specialty_code: string; color_code: string; sex: string } | undefined;
  female: { id: number; ring: string; specialty_code: string; color_code: string; sex: string } | undefined;
  onClose: () => void;
  onEdit: (couple: any) => void;
}) {
  return (
    <Dialog open={!!couple} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        {couple && (
          <>
            <DialogHeader>
              <DialogTitle>Ficha do Casal — Gaiola {couple.cageNumber || "-"}</DialogTitle>
              <DialogDescription>
                Formado em {new Date(couple.formationDate).toLocaleDateString("pt-BR")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {[
                { label: "Macho", bird: male },
                { label: "Fêmea", bird: female },
              ].map(({ label, bird }) => (
                <div key={label} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-xs text-gray-400 uppercase">{label}</p>
                    <p className="font-mono font-semibold text-gray-900">{bird?.ring ?? "-"}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-gray-700">{SPECIALTIES.find((s) => s.id === bird?.specialty_code)?.name ?? bird?.specialty_code}</p>
                    <p className="text-gray-400">{COLORS.find((c) => c.id === bird?.color_code)?.name ?? bird?.color_code}</p>
                  </div>
                </div>
              ))}
            </div>

            {male && female && <MendelianPrediction fatherId={male.id} motherId={female.id} />}

            <div className="flex gap-2 justify-end pt-2">
              <Link href={`/ficha-gaiola/${couple.id}`}>
                <Button variant="outline" size="sm">
                  <FileText className="w-4 h-4 mr-1" />
                  Imprimir ficha
                </Button>
              </Link>
              <Button size="sm" onClick={() => onEdit(couple)}>
                <Edit2 className="w-4 h-4 mr-1" />
                Editar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
