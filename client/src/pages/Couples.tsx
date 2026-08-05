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
import { Plus, Edit2, FileText, LayoutGrid, List, Bird as BirdIcon, Heart, AlertTriangle, Dna, CheckCircle, ShieldAlert, TrendingUp, Sparkles, History, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

const emptyForm = { maleId: "", femaleId: "", cageId: "", formationDate: "", pairingMethod: "monogamy" as "monogamy" | "bigamy", maleReuseConfirmed: false };

const PAIRING_OBJECTIVES: { value: "cor" | "porte" | "show" | "linhagem" | "diversidade" | "portadores"; label: string; desc: string }[] = [
  { value: "linhagem",    label: "Manter linhagem",      desc: "Preserva as características da linha atual" },
  { value: "cor",          label: "Melhorar cor",          desc: "Prioriza combinações de mutação mais favoráveis" },
  { value: "porte",        label: "Melhorar porte",        desc: "Foca em conformação e tamanho" },
  { value: "show",         label: "Preparar exposição",    desc: "Maximiza classe oficial e conformação" },
  { value: "diversidade",  label: "Reduzir parentesco",    desc: "Prioriza pares com menor COI (evita endogamia)" },
  { value: "portadores",   label: "Produzir portadores",   desc: "Útil para fixar/espalhar uma mutação recessiva" },
];

/**
 * Sugestão de par ideal — assim que o criador escolhe UM dos dois lados
 * (macho ou fêmea), mostra os melhores parceiros disponíveis para a
 * finalidade escolhida, com o motivo de cada recomendação (COI, mutações,
 * avisos de risco). Reaproveita genetics.recommendPairing (já existente e
 * testado), só que agora conectado ao formulário real de formar casal.
 */
function PairSuggestions({
  formData,
  onPick,
}: {
  formData: { maleId: string; femaleId: string };
  onPick: (field: "maleId" | "femaleId", id: number) => void;
}) {
  const [objective, setObjective] = useState<typeof PAIRING_OBJECTIVES[number]["value"]>("linhagem");

  const anchorField: "maleId" | "femaleId" | null =
    formData.maleId && !formData.femaleId ? "maleId" : !formData.maleId && formData.femaleId ? "femaleId" : null;
  const anchorId = anchorField ? Number(formData[anchorField]) : null;
  const targetField: "maleId" | "femaleId" = anchorField === "maleId" ? "femaleId" : "maleId";

  const { data, isLoading } = trpc.genetics.recommendPairing.useQuery(
    { birdId: anchorId ?? 0, objective },
    { enabled: !!anchorId }
  );

  if (!anchorField) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
          <Sparkles className="w-4 h-4" /> Sugestão de par ideal
        </CardTitle>
        <CardDescription className="text-xs">
          Escolha a finalidade da tiragem — o sistema analisa o mapa genético do plantel e ordena os melhores parceiros disponíveis, com o motivo de cada indicação.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={objective} onValueChange={(v: any) => setObjective(v)}>
          <SelectTrigger className="h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAIRING_OBJECTIVES.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                <span className="font-medium">{o.label}</span>
                <span className="text-xs text-gray-400 ml-1.5">— {o.desc}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isLoading && <p className="text-xs text-gray-400">Analisando o plantel...</p>}

        {data && data.candidates.length === 0 && (
          <p className="text-xs text-gray-500">Nenhum parceiro disponível sem risco alto de parentesco foi encontrado para essa finalidade.</p>
        )}

        {data && data.candidates.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              {data.candidates.length} de {data.totalEvaluated} pássaro(s) elegível(is), ordenados pela melhor combinação:
            </p>
            {data.candidates.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg border bg-white p-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-sm">{c.ring}</span>
                    <Badge className="text-xs bg-emerald-100 text-emerald-800 border-emerald-200">{Math.round(c.finalScore)} pts</Badge>
                    <Badge className={`text-xs ${c.coiRisk === "low" ? "bg-green-100 text-green-700" : c.coiRisk === "moderate" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                      COI {c.coiPct}
                    </Badge>
                  </div>
                  {c.displayTitle && <p className="text-xs text-gray-500 truncate mt-0.5">{c.displayTitle}</p>}
                  {c.reasons?.length > 0 && (
                    <ul className="text-xs text-gray-600 mt-1 space-y-0.5">
                      {c.reasons.slice(0, 3).map((r: string, i: number) => (
                        <li key={i} className="flex items-start gap-1"><span className="text-emerald-500">•</span>{r}</li>
                      ))}
                    </ul>
                  )}
                  {c.warnings?.length > 0 && (
                    <p className="text-xs text-red-600 mt-1 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{c.warnings[0]}
                    </p>
                  )}
                </div>
                <Button type="button" size="sm" variant="outline" className="shrink-0 h-7 text-xs" onClick={() => onPick(targetField, c.id)}>
                  Usar este
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
  const { data: cages = [] } = trpc.cages.list.useQuery();
  const { data: maleUsage } = trpc.management.couples.maleUsage.useQuery(
    { maleId: Number(formData.maleId) || 0 },
    { enabled: !!formData.maleId && !editingId },
  );
  const activeMaleUsages = maleUsage?.active ?? [];
  const isMaleAlreadyActive = activeMaleUsages.length > 0;
  // Fêmea já vinculada a um casal ATIVO não pode formar outro casal — some
  // da lista até o casal anterior ser desfeito/excluído. O MACHO pode
  // estar em vários casais ativos ao mesmo tempo (uso em "harém", comum na
  // prática de canaricultura). Ao editar um casal existente, o macho/fêmea
  // dele mesmo continuam aparecendo (senão o próprio formulário ficaria
  // inválido).
  const pairedFemaleIds = new Set(
    couples?.filter((c) => c.status === "active" && c.id !== editingId).map((c) => c.femaleId)
  );
  const malesAvailable = birds?.filter((b) => b.sex === "macho");
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

  const dissolveCouple = trpc.management.couples.dissolve.useMutation({
    onSuccess: () => {
      toast.success("Casal desfeito. O registro completo foi enviado para o histórico.");
      refetch();
    },
    onError: (error) => toast.error("Erro ao desfazer casal: " + error.message),
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
      cageId: couple.cageId ? String(couple.cageId) : "",
      formationDate: new Date(couple.formationDate).toISOString().slice(0, 10),
      pairingMethod: (couple.pairingMethod === "bigamy" ? "bigamy" : "monogamy"),
      maleReuseConfirmed: Boolean(couple.maleReuseConfirmed),
    });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.maleId || !formData.femaleId || !formData.cageId || !formData.formationDate) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const payload = {
      maleId: parseInt(formData.maleId),
      femaleId: parseInt(formData.femaleId),
      cageId: parseInt(formData.cageId),
      pairingMethod: formData.pairingMethod,
      maleReuseConfirmed: formData.maleReuseConfirmed,
      formationDate: new Date(formData.formationDate),
    };

    if (editingId) {
      updateCouple.mutate({ id: editingId, ...payload });
    } else {
      createCouple.mutate(payload);
    }
  };

  const handleDissolve = (id: number) => {
    if (confirm("Desfazer este casal? Ele sairá da página de casais ativos, a gaiola será liberada e todas as posturas, filhotes e dados de linhagem permanecerão preservados no histórico.")) {
      dissolveCouple.mutate({ id });
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
            <Link href="/couples/history">
              <Button variant="outline" className="border-slate-300">
                <History className="w-4 h-4 mr-2" />
                Histórico
              </Button>
            </Link>
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
                        {malesAvailable?.map((bird) => {
                          const activeCount = couples?.filter((c) => c.status === "active" && c.maleId === bird.id && c.id !== editingId).length ?? 0;
                          return (
                            <SelectItem key={bird.id} value={bird.id.toString()}>
                              {bird.ring} - {specialtyName(bird.specialty_code)}
                              {activeCount > 0 && <span className="text-amber-600 ml-1.5">· já em {activeCount} casal{activeCount > 1 ? "is" : ""} ativo{activeCount > 1 ? "s" : ""}</span>}
                            </SelectItem>
                          );
                        })}
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
                    <Label htmlFor="cageId">Gaiola cadastrada *</Label>
                    <Select value={formData.cageId} onValueChange={(value) => setFormData({ ...formData, cageId: value })}>
                      <SelectTrigger id="cageId">
                        <SelectValue placeholder="Selecione a gaiola correta..." />
                      </SelectTrigger>
                      <SelectContent>
                        {cages.map((cage) => {
                          const activeCouple = couples?.find((c) => c.status === "active" && c.cageId === cage.id && c.id !== editingId);
                          const unavailable = cage.status === "maintenance" || Boolean(activeCouple);
                          return (
                            <SelectItem key={cage.id} value={String(cage.id)} disabled={unavailable}>
                              {cage.code}{cage.section ? ` — ${cage.section}` : ""}
                              {cage.status === "maintenance" ? " · manutenção" : activeCouple ? ` · ocupada pelo casal #${activeCouple.id}` : " · disponível"}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {cages.length === 0 && (
                      <p className="text-xs text-red-600 mt-1">Cadastre primeiro as gaiolas em Infraestrutura → Gaiolas.</p>
                    )}
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

                {!editingId && formData.maleId && (
                  <div className={`rounded-xl border-2 p-4 ${isMaleAlreadyActive ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${isMaleAlreadyActive ? "text-amber-600" : "text-emerald-600"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-gray-900">Uso reprodutivo deste macho</p>
                        {isMaleAlreadyActive ? (
                          <>
                            <p className="text-sm text-amber-800 mt-1">
                              Este macho já está em {activeMaleUsages.length} casal{activeMaleUsages.length > 1 ? "is" : ""} ativo{activeMaleUsages.length > 1 ? "s" : ""}. Para formar outro casal, registre explicitamente o método de bigamia.
                            </p>
                            <div className="mt-3 space-y-2">
                              {activeMaleUsages.map((usage: any) => (
                                <div key={usage.id} className="rounded-lg border bg-white px-3 py-2 text-xs text-gray-700">
                                  <div className="font-medium">Gaiola {usage.cageNumber} · Fêmea {usage.femaleRing}</div>
                                  <div className="text-gray-500 mt-0.5">
                                    {usage.femaleTitle || "Sem título completo"} · {usage.clutchCount} postura{usage.clutchCount === 1 ? "" : "s"}
                                    {usage.lastClutchDate ? ` · última em ${new Date(usage.lastClutchDate).toLocaleDateString("pt-BR")}` : ""}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <label className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-white p-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.pairingMethod === "bigamy" && formData.maleReuseConfirmed}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  pairingMethod: e.target.checked ? "bigamy" : "monogamy",
                                  maleReuseConfirmed: e.target.checked,
                                })}
                                className="mt-0.5 h-4 w-4"
                              />
                              <span className="text-sm text-gray-800">
                                Confirmo que este macho será utilizado pelo <strong>método de bigamia</strong> em outra gaiola e estou ciente dos casais e posturas já registrados acima.
                              </span>
                            </label>
                          </>
                        ) : (
                          <p className="text-sm text-emerald-800 mt-1">Nenhum outro casal ativo encontrado para este macho. O método padrão será monogamia.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {!editingId && formData.maleId && (maleUsage?.history?.length ?? 0) > 0 && (
                  <details className="rounded-xl border bg-slate-50 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                      Histórico reprodutivo do macho ({maleUsage?.history.length})
                    </summary>
                    <div className="mt-3 space-y-2">
                      {maleUsage?.history.map((usage: any) => (
                        <div key={usage.id} className="grid gap-1 rounded-lg border bg-white px-3 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_auto]">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate">
                              Fêmea {usage.femaleRing} · Gaiola {usage.cageNumber}
                            </p>
                            <p className="text-gray-500 truncate">{usage.femaleTitle || "Sem título completo"}</p>
                          </div>
                          <div className="text-left text-gray-500 sm:text-right">
                            <p>{usage.clutchCount} postura{usage.clutchCount === 1 ? "" : "s"}</p>
                            <p>{usage.status === "active" && !usage.deletedAt ? "Ativo" : "Encerrado"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Sugestão de par ideal — aparece assim que UM dos dois lados é
                    escolhido, antes do outro. Reaproveita genetics.recommendPairing,
                    que já existia mas só estava exposto dentro da Calculadora
                    Genética, desconectado de onde o casal é realmente formado. */}
                {!editingId && (
                  <PairSuggestions
                    formData={formData}
                    onPick={(field, id) => setFormData((f) => ({ ...f, [field]: String(id) }))}
                  />
                )}

                <CoiWarning maleId={formData.maleId} femaleId={formData.femaleId} />

                {/* Preview genético completo — só aparece ao criar novo casal */}
                {!editingId && (
                  <GeneticPreview maleId={formData.maleId} femaleId={formData.femaleId} />
                )}

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={cages.length === 0 || (isMaleAlreadyActive && !formData.maleReuseConfirmed)}>
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
                        <div className="flex items-center gap-1.5">
                          {couple.pairingMethod === "bigamy" && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800">Bigamia</span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            couple.status === "active" ? "bg-green-100 text-green-800" :
                            couple.status === "finalized" ? "bg-blue-100 text-blue-800" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {couple.status === "active" ? "Ativo" : couple.status === "finalized" ? "Finalizado" : "Desfeito"}
                          </span>
                        </div>
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
                <p>Nenhum casal ativo no momento.</p>
                <p className="text-xs mt-1">Casais desfeitos permanecem disponíveis no Histórico.</p>
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
                      <TableHead>Método</TableHead>
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
                          <Badge className={couple.pairingMethod === "bigamy" ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-700"}>
                            {couple.pairingMethod === "bigamy" ? "Bigamia" : "Monogamia"}
                          </Badge>
                        </TableCell>
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
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-amber-700"
                              title="Desfazer casal e preservar no histórico"
                              onClick={() => handleDissolve(couple.id)}
                            >
                              <Unlink className="w-4 h-4" />
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
                <p>Nenhum casal ativo no momento.</p>
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
  couple: { id: number; cageNumber: string | null; formationDate: Date | string; status: string; pairingMethod?: string | null; maleReuseConfirmed?: boolean | null } | null | undefined;
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
              <div className="flex items-center justify-between rounded-lg border bg-slate-50 p-3">
                <div>
                  <p className="text-xs text-gray-400 uppercase">Método reprodutivo</p>
                  <p className="font-semibold text-gray-900">{couple.pairingMethod === "bigamy" ? "Bigamia" : "Monogamia"}</p>
                </div>
                {couple.pairingMethod === "bigamy" && <Badge className="bg-purple-100 text-purple-800">Macho compartilhado</Badge>}
              </div>
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
