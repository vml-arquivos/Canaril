/**
 * RingBatches.tsx — Gestão simplificada de anilhas
 *
 * Objetivo desta revisão:
 * - deixar o cadastro de lotes mais simples para usuários não técnicos;
 * - mostrar de forma clara quais pássaros usam cada bitola;
 * - preencher a bitola automaticamente sempre que houver regra oficial;
 * - manter o backend e a listagem de lotes compatíveis, sem regressão.
 */

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import {
  Plus, Trash2, ChevronDown, ChevronRight, Tag,
  AlertCircle, CheckCircle2, Circle, Layers, Gauge, Info,
} from "lucide-react";
import { toast } from "sonner";
import { generateRingCode } from "../../../server/_core/ringParser";
import {
  OFFICIAL_PORTE_BREEDS,
  OFFICIAL_RING_GUIDE_GROUPS,
  resolveOfficialRingGuide,
} from "@shared/ringGuide";

const MODALITIES = [
  { value: "COR", label: "Canário de Cor" },
  { value: "PORTE", label: "Canário de Porte" },
  { value: "CANTO", label: "Canário de Canto" },
  { value: "OUTRA", label: "Outra espécie / manual" },
] as const;

const FORMAT_PRESETS = [
  { label: "Padrão (GF-003-2026-001)", value: "{breederCode}-{year}-{seq}" },
  { label: "Com mês (GF-003-06-2026-001)", value: "{breederCode}-{month}-{year}-{seq}" },
  { label: "Compacto (GF2026001)", value: "{breederCode}{year}{seq}" },
  { label: "Só sequência (2026-001)", value: "{year}-{seq}" },
  { label: "Personalizado", value: "__custom__" },
] as const;

const COLOR_OPTIONS = ["Verde", "Azul", "Amarela", "Laranja", "Roxa", "Vermelha", "Branca"];

const statusBadge = (status: string) => {
  if (status === "available") return <Badge variant="default" className="bg-green-100 text-green-800">Disponível</Badge>;
  if (status === "exhausted") return <Badge variant="destructive">Esgotado</Badge>;
  if (status === "inactive") return <Badge variant="secondary">Inativo</Badge>;
  return <Badge variant="outline">{status}</Badge>;
};

const ringStatusIcon = (status: string) => {
  if (status === "available") return <Circle className="h-3 w-3 text-green-500 fill-green-500" />;
  if (status === "in_use") return <CheckCircle2 className="h-3 w-3 text-amber-500" />;
  return <AlertCircle className="h-3 w-3 text-red-500" />;
};

const emptyForm = {
  batch_number: "01",
  year: new Date().getFullYear().toString(),
  color: "Verde",
  startNumber: "1",
  endNumber: "200",
  breederCode: "",
  associationName: "",
  speciesName: "Canário",
  breedName: "",
  modality: "COR" as "COR" | "PORTE" | "CANTO" | "OUTRA",
  ringGaugeMm: "3.0",
  month: "",
  prefix: "",
  suffix: "",
  formatPreset: "{breederCode}-{year}-{seq}",
  formatPattern: "{breederCode}-{year}-{seq}",
  notes: "",
};

function buildGuideSummary(group: { birds: string[] }) {
  if (group.birds.length <= 4) return group.birds.join(", ");
  return `${group.birds.slice(0, 4).join(", ")} e mais ${group.birds.length - 4}`;
}

export default function RingBatches() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [expandedBatch, setExpanded] = useState<number | null>(null);
  const [ringPage, setRingPage] = useState(1);
  const [ringFilter, setRingFilter] = useState("__all__");

  const { data: stats, refetch: refetchStats } = trpc.ringsV2.stats.useQuery();
  const { data: batches = [], refetch: refetchBatches } = trpc.ringsV2.batches.list.useQuery();

  const { data: batchRings } = trpc.ringsV2.rings.listByBatch.useQuery(
    {
      batchId: expandedBatch ?? 0,
      status: ringFilter === "__all__" ? undefined : ringFilter,
      page: ringPage,
      pageSize: 100,
    },
    { enabled: expandedBatch !== null }
  );

  const officialSuggestion = useMemo(() => {
    return resolveOfficialRingGuide({
      speciesName: formData.speciesName || "Canário",
      breedName: formData.breedName || undefined,
      modality: formData.modality || undefined,
    });
  }, [formData.speciesName, formData.breedName, formData.modality]);

  useEffect(() => {
    if (!officialSuggestion) return;
    setFormData((prev) => {
      const nextGauge = String(officialSuggestion.recommendedGaugeMm);
      if (
        prev.ringGaugeMm === nextGauge
        && prev.speciesName === "Canário"
      ) {
        return prev;
      }
      return {
        ...prev,
        speciesName: "Canário",
        ringGaugeMm: nextGauge,
      };
    });
  }, [officialSuggestion]);

  const codePreview = useMemo(() => {
    try {
      return generateRingCode({
        breederCode: formData.breederCode || "GF-003",
        year: parseInt(formData.year) || new Date().getFullYear(),
        month: formData.month ? parseInt(formData.month) : undefined,
        sequence: parseInt(formData.startNumber) || 1,
        prefix: formData.prefix,
        suffix: formData.suffix,
        formatPattern: formData.formatPattern,
      });
    } catch {
      return "—";
    }
  }, [formData]);

  const createBatch = trpc.ringsV2.batches.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Lote criado! ${data.generated} anilhas geradas.`);
      refetchBatches();
      refetchStats();
      setOpen(false);
      setFormData(emptyForm);
    },
    onError: (e) => toast.error("Erro ao criar lote: " + e.message),
  });

  const deleteBatch = trpc.ringsV2.batches.delete.useMutation({
    onSuccess: () => {
      toast.success("Lote removido.");
      refetchBatches();
      refetchStats();
      if (expandedBatch !== null) setExpanded(null);
    },
    onError: (e) => toast.error("Erro ao remover: " + e.message),
  });

  const handleFormatPreset = (preset: string) => {
    setFormData((prev) => ({
      ...prev,
      formatPreset: preset,
      formatPattern: preset === "__custom__" ? prev.formatPattern : preset,
    }));
  };

  const handleModalityChange = (value: typeof formData.modality) => {
    setFormData((prev) => ({
      ...prev,
      modality: value,
      speciesName: value === "OUTRA" ? prev.speciesName || "" : "Canário",
      breedName: value === "PORTE" ? prev.breedName : "",
      ringGaugeMm: value === "OUTRA" ? prev.ringGaugeMm : "",
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.batch_number || !formData.year || !formData.color) {
      toast.error("Preencha os campos obrigatórios: número do lote, ano e cor.");
      return;
    }
    if (formData.modality === "PORTE" && !formData.breedName) {
      toast.error("Selecione a raça do canário de porte para o sistema definir a bitola correta.");
      return;
    }

    const ringGaugeValue = officialSuggestion?.recommendedGaugeMm
      ?? (formData.ringGaugeMm ? parseFloat(formData.ringGaugeMm) : undefined);

    if (!ringGaugeValue || Number.isNaN(ringGaugeValue)) {
      toast.error("Informe uma bitola válida.");
      return;
    }

    createBatch.mutate({
      batch_number: formData.batch_number,
      year: parseInt(formData.year),
      color: formData.color,
      startNumber: parseInt(formData.startNumber) || 1,
      endNumber: parseInt(formData.endNumber) || 200,
      breederCode: formData.breederCode || undefined,
      associationName: formData.associationName || undefined,
      speciesName: formData.speciesName || undefined,
      breedName: formData.breedName || undefined,
      modality: formData.modality || undefined,
      ringGaugeMm: ringGaugeValue,
      month: formData.month ? parseInt(formData.month) : undefined,
      prefix: formData.prefix || undefined,
      suffix: formData.suffix || undefined,
      formatPattern: formData.formatPattern,
      notes: formData.notes || undefined,
    });
  };

  const toggleExpand = (id: number) => {
    setExpanded((prev) => prev === id ? null : id);
    setRingPage(1);
    setRingFilter("__all__");
  };

  const totalPreview = Math.max(0, (parseInt(formData.endNumber) || 200) - (parseInt(formData.startNumber) || 1) + 1);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestão de Anilhas</h1>
            <p className="text-sm text-gray-500 mt-1">
              Cadastro simples, bitola automática e referência visual clara para o criador.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <SplitOrderDialog onCreated={() => { refetchStats(); refetchBatches(); }} />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-amber-600 hover:bg-amber-700">
                  <Plus className="h-4 w-4 mr-2" /> Novo Lote
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100vw-1.5rem)] max-w-5xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto overflow-x-hidden p-5 sm:p-6">
                <DialogHeader className="pr-8 border-b pb-4">
                  <DialogTitle>Criar lote de anilhas</DialogTitle>
                  <DialogDescription>
                    Preencha só o essencial. O sistema já sugere a bitola oficial automaticamente.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 mt-2">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">1. Dados básicos do lote</CardTitle>
                      <CardDescription>Esses campos identificam o lote e a faixa de numeração.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Número do lote *</Label>
                          <Input
                            value={formData.batch_number}
                            onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                            placeholder="Ex: 01"
                          />
                        </div>
                        <div>
                          <Label>Ano *</Label>
                          <Input
                            type="number"
                            value={formData.year}
                            onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                            min={2000}
                            max={2100}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Cor da anilha *</Label>
                          <Select value={formData.color} onValueChange={(value) => setFormData({ ...formData, color: value })}>
                            <SelectTrigger><SelectValue placeholder="Selecione a cor" /></SelectTrigger>
                            <SelectContent>
                              {COLOR_OPTIONS.map((color) => (
                                <SelectItem key={color} value={color}>{color}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Código do criador</Label>
                          <Input
                            value={formData.breederCode}
                            onChange={(e) => setFormData({ ...formData, breederCode: e.target.value })}
                            placeholder="Ex: GF-003"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Número inicial</Label>
                          <Input
                            type="number"
                            value={formData.startNumber}
                            onChange={(e) => setFormData({ ...formData, startNumber: e.target.value })}
                            min={1}
                          />
                        </div>
                        <div>
                          <Label>Número final</Label>
                          <Input
                            type="number"
                            value={formData.endNumber}
                            onChange={(e) => setFormData({ ...formData, endNumber: e.target.value })}
                            min={1}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">2. Quem vai usar essas anilhas?</CardTitle>
                      <CardDescription>
                        Escolha o tipo do pássaro. Para canário, a bitola será preenchida sozinha conforme a tabela oficial.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Tipo *</Label>
                          <Select value={formData.modality} onValueChange={(value) => handleModalityChange(value as typeof formData.modality)}>
                            <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                            <SelectContent>
                              {MODALITIES.map((m) => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {formData.modality === "PORTE" ? (
                          <div>
                            <Label>Raça do canário de porte *</Label>
                            <Select value={formData.breedName || "__empty__"} onValueChange={(value) => setFormData({ ...formData, breedName: value === "__empty__" ? "" : value })}>
                              <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Selecione a raça" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__empty__">Selecione a raça...</SelectItem>
                                {OFFICIAL_PORTE_BREEDS.map((breed) => (
                                  <SelectItem key={breed} value={breed}>{breed}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div>
                            <Label>Espécie</Label>
                            <Input
                              value={formData.speciesName}
                              onChange={(e) => setFormData({ ...formData, speciesName: e.target.value })}
                              disabled={formData.modality !== "OUTRA"}
                              placeholder="Ex: Canário"
                            />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        <div>
                          <Label>Bitola (mm)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={officialSuggestion ? String(officialSuggestion.recommendedGaugeMm) : formData.ringGaugeMm}
                            onChange={(e) => setFormData({ ...formData, ringGaugeMm: e.target.value })}
                            readOnly={!!officialSuggestion}
                            placeholder="Ex: 3.0"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            {officialSuggestion
                              ? "Preenchimento automático pela tabela oficial."
                              : "Preencha manualmente somente quando não houver regra automática."}
                          </p>
                        </div>

                        <div className="rounded-lg border bg-amber-50 p-3">
                          <div className="flex items-start gap-2">
                            <Info className="h-4 w-4 text-amber-700 mt-0.5" />
                            <div className="text-sm">
                              <p className="font-semibold text-amber-900">
                                {officialSuggestion ? officialSuggestion.title : "Selecione o tipo e, se for porte, a raça."}
                              </p>
                              <p className="text-amber-800 text-xs mt-1">
                                {officialSuggestion
                                  ? officialSuggestion.appliesTo.join(", ")
                                  : "Exemplo: Canário de Cor = 3,0 mm. Canário de Porte depende da raça."}
                              </p>
                              {officialSuggestion?.notes && (
                                <p className="text-amber-700 text-xs mt-1">{officialSuggestion.notes}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">3. Tabela rápida de referência</CardTitle>
                      <CardDescription>
                        Consulte rapidamente quais pássaros costumam usar cada tamanho de anilha.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {OFFICIAL_RING_GUIDE_GROUPS.map((group) => (
                          <div key={group.gaugeMm} className="rounded-lg border p-3 bg-white">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-gray-900">{group.gaugeMm.toFixed(1)} mm</p>
                                <p className="text-xs text-gray-500">{group.title}</p>
                              </div>
                              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                                {group.birds.length} referência(s)
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-700 mt-2">{buildGuideSummary(group)}</p>
                            {group.notes && <p className="text-xs text-gray-500 mt-1">{group.notes}</p>}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <details className="rounded-lg border bg-gray-50 p-4">
                    <summary className="cursor-pointer font-medium text-sm text-gray-900">
                      Configuração avançada (opcional)
                    </summary>
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Associação</Label>
                          <Input
                            value={formData.associationName}
                            onChange={(e) => setFormData({ ...formData, associationName: e.target.value })}
                            placeholder="Ex: FOCB, FOB, OBJO"
                          />
                        </div>
                        <div>
                          <Label>Observações</Label>
                          <Input
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Notas opcionais"
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Modelo do código</Label>
                        <Select value={formData.formatPreset} onValueChange={handleFormatPreset}>
                          <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FORMAT_PRESETS.map((preset) => (
                              <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.formatPreset === "__custom__" && (
                        <div>
                          <Label>Padrão personalizado</Label>
                          <Input
                            value={formData.formatPattern}
                            onChange={(e) => setFormData({ ...formData, formatPattern: e.target.value })}
                            placeholder="{breederCode}-{year}-{seq}"
                            className="font-mono"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Tokens: {"{breederCode}"} {"{year}"} {"{month}"} {"{seq}"} {"{prefix}"} {"{suffix}"}
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label>Mês (opcional)</Label>
                          <Input
                            type="number"
                            value={formData.month}
                            onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                            min={1}
                            max={12}
                            placeholder="1-12"
                          />
                        </div>
                        <div>
                          <Label>Prefixo</Label>
                          <Input
                            value={formData.prefix}
                            onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                            placeholder="Ex: BR"
                          />
                        </div>
                        <div>
                          <Label>Sufixo</Label>
                          <Input
                            value={formData.suffix}
                            onChange={(e) => setFormData({ ...formData, suffix: e.target.value })}
                            placeholder="Ex: -A"
                          />
                        </div>
                      </div>

                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                        <p className="text-xs text-amber-700 font-medium mb-1">Prévia da primeira anilha</p>
                        <p className="font-mono text-lg font-bold text-amber-900">{codePreview}</p>
                        <p className="text-xs text-amber-600 mt-1">Total previsto: {totalPreview} anilhas</p>
                      </div>
                    </div>
                  </details>

                  <div className="flex gap-2 pt-2">
                    <Button
                      type="submit"
                      className="flex-1 bg-amber-600 hover:bg-amber-700"
                      disabled={createBatch.isPending}
                    >
                      {createBatch.isPending ? "Criando..." : "Criar lote"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total de anilhas", value: stats.total, icon: Tag, color: "text-gray-700" },
              { label: "Disponíveis", value: stats.available, icon: Circle, color: "text-green-600" },
              { label: "Em uso", value: stats.inUse, icon: CheckCircle2, color: "text-amber-600" },
              { label: "Lotes", value: stats.batches, icon: Layers, color: "text-blue-600" },
              { label: "Lotes esgotados", value: stats.exhaustedBatches, icon: AlertCircle, color: "text-red-500" },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <s.icon className={`h-8 w-8 ${s.color}`} />
                  <div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Lotes de Anilhas</CardTitle>
            <CardDescription>Clique em um lote para ver as anilhas individuais.</CardDescription>
          </CardHeader>
          <CardContent>
            {batches.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Tag className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum lote cadastrado.</p>
                <p className="text-sm mt-1">Crie o primeiro lote para começar.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {batches.map((batch) => {
                  const pct = batch.quantity_total > 0
                    ? Math.round((batch.quantity_used / batch.quantity_total) * 100)
                    : 0;
                  const isExpanded = expandedBatch === batch.id;

                  return (
                    <div key={batch.id} className="border rounded-lg overflow-hidden">
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => toggleExpand(batch.id)}
                      >
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                          : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm">{batch.batch_number}</span>
                            <span className="text-gray-500 text-xs">{batch.year}</span>
                            {batch.color && <Badge variant="outline" className="text-xs">{batch.color}</Badge>}
                            {batch.modality && (
                              <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
                                {batch.modality}
                              </Badge>
                            )}
                            {batch.ringGaugeMm && (
                              <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                                <Gauge className="h-3 w-3 mr-1" />{batch.ringGaugeMm}mm
                              </Badge>
                            )}
                            {statusBadge(batch.status)}
                          </div>
                          <div className="flex items-center gap-4 mt-1">
                            <Progress value={pct} className="h-1.5 flex-1 max-w-40" />
                            <span className="text-xs text-gray-500 shrink-0">
                              {batch.quantity_used}/{batch.quantity_total} ({pct}%)
                            </span>
                            {batch.breedName && <span className="text-xs text-gray-400">{batch.breedName}</span>}
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Remover lote "${batch.batch_number}"? Esta ação é irreversível.`)) {
                              deleteBatch.mutate(batch.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {isExpanded && (
                        <div className="border-t bg-gray-50 p-3">
                          <div className="flex items-center gap-2 mb-3">
                            <Select value={ringFilter} onValueChange={(v) => { setRingFilter(v); setRingPage(1); }}>
                              <SelectTrigger className="w-40 h-8 text-xs">
                                <SelectValue placeholder="Filtrar status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__all__">Todas</SelectItem>
                                <SelectItem value="available">Disponíveis</SelectItem>
                                <SelectItem value="in_use">Em uso</SelectItem>
                              </SelectContent>
                            </Select>
                            {batchRings && <span className="text-xs text-gray-500">{batchRings.total} anilhas</span>}
                          </div>

                          {batchRings?.items && batchRings.items.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
                              {batchRings.items.map((ring) => (
                                <div
                                  key={ring.id}
                                  className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-mono border ${ring.status === "available" ? "bg-white border-green-200" : "bg-amber-50 border-amber-200"}`}
                                >
                                  {ringStatusIcon(ring.status)}
                                  <span className="truncate">{ring.fullCode ?? ring.number}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 text-center py-4">Nenhuma anilha encontrada.</p>
                          )}

                          {batchRings && batchRings.total > 100 && (
                            <div className="flex justify-center gap-2 mt-3">
                              <Button variant="outline" size="sm" disabled={ringPage === 1} onClick={() => setRingPage((p) => p - 1)}>
                                Anterior
                              </Button>
                              <span className="text-xs self-center text-gray-500">
                                Pág. {ringPage} de {Math.ceil(batchRings.total / 100)}
                              </span>
                              <Button variant="outline" size="sm" disabled={ringPage >= Math.ceil(batchRings.total / 100)} onClick={() => setRingPage((p) => p + 1)}>
                                Próxima
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

type SplitRow = {
  modality: "COR" | "PORTE" | "CANTO";
  breedName: string;
  ringGaugeMm: string;
  quantity: string;
  color: string;
};

function emptySplitRow(): SplitRow {
  return { modality: "PORTE", breedName: "", ringGaugeMm: "", quantity: "", color: "Verde" };
}

function SplitOrderDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [breederCode, setBreederCode] = useState("");
  const [rows, setRows] = useState<SplitRow[]>([emptySplitRow()]);

  const createSplit = trpc.ringsV2.batches.createSplitOrder.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.batches.length} lote(s) criado(s), ${data.totalGenerated} anilhas geradas ao todo.`);
      setOpen(false);
      setRows([emptySplitRow()]);
      onCreated();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateRow = (index: number, patch: Partial<SplitRow>) => {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const resolveRowSuggestion = (row: SplitRow) => resolveOfficialRingGuide({ speciesName: "Canário", modality: row.modality, breedName: row.breedName || undefined });

  const handleModalityChange = (index: number, value: SplitRow["modality"]) => {
    const suggestion = resolveOfficialRingGuide({ speciesName: "Canário", modality: value });
    updateRow(index, {
      modality: value,
      breedName: value === "PORTE" ? rows[index].breedName : "",
      ringGaugeMm: suggestion ? String(suggestion.recommendedGaugeMm) : "",
    });
  };

  useEffect(() => {
    setRows((current) => current.map((row) => {
      const suggestion = resolveRowSuggestion(row);
      if (!suggestion) return row;
      const nextGauge = String(suggestion.recommendedGaugeMm);
      return row.ringGaugeMm === nextGauge ? row : { ...row, ringGaugeMm: nextGauge };
    }));
  }, []);

  const preview = useMemo(() => {
    let cursor = 1;
    return rows.map((row) => {
      const qty = parseInt(row.quantity) || 0;
      const start = cursor;
      const end = cursor + Math.max(qty, 0) - 1;
      if (qty > 0) cursor = end + 1;
      return { qty, start, end: qty > 0 ? end : start - 1 };
    });
  }, [rows]);

  const totalQuantity = rows.reduce((sum, row) => sum + (parseInt(row.quantity) || 0), 0);

  const handleSubmit = () => {
    const validRows = rows.flatMap((row) => {
      const suggestion = resolveRowSuggestion(row);
      const gauge = suggestion?.recommendedGaugeMm ?? parseFloat(row.ringGaugeMm);
      const quantity = parseInt(row.quantity) || 0;
      if (quantity <= 0) return [];
      if (row.modality === "PORTE" && !row.breedName) return [];
      if (!gauge || Number.isNaN(gauge)) return [];
      return [{
        breedName: row.modality === "PORTE" ? row.breedName : row.modality === "COR" ? "Canário de Cor" : "Canário de Canto",
        modality: row.modality,
        ringGaugeMm: gauge,
        quantity,
        color: row.color,
      }];
    });

    if (validRows.length === 0) {
      toast.error("Preencha ao menos uma linha com quantidade e bitola válidas.");
      return;
    }

    createSplit.mutate({
      year: parseInt(year),
      breederCode: breederCode || undefined,
      splits: validRows,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4 mr-2" /> Pedido rápido por raça
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-5xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto overflow-x-hidden p-5 sm:p-6">
        <DialogHeader className="pr-8 border-b pb-4">
          <DialogTitle>Pedido rápido de anilhas</DialogTitle>
          <DialogDescription>
            Ideal para pedir o ano inteiro de uma vez, separado por raça ou tipo de canário.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Ano *</Label>
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div>
            <Label>Código do criador (opcional)</Label>
            <Input value={breederCode} onChange={(e) => setBreederCode(e.target.value)} placeholder="Ex: GF-003" />
          </div>
        </div>

        <div className="space-y-3 mt-2">
          {rows.map((row, index) => {
            const suggestion = resolveRowSuggestion(row);
            return (
              <div key={index} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-4 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                  <div className="lg:col-span-3 min-w-0">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={row.modality} onValueChange={(value) => handleModalityChange(index, value as SplitRow["modality"])}>
                      <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="COR">Canário de Cor</SelectItem>
                        <SelectItem value="PORTE">Canário de Porte</SelectItem>
                        <SelectItem value="CANTO">Canário de Canto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-1 lg:col-span-5 min-w-0">
                    <Label className="text-xs">Raça</Label>
                    {row.modality === "PORTE" ? (
                      <Select value={row.breedName || "__empty__"} onValueChange={(value) => updateRow(index, { breedName: value === "__empty__" ? "" : value })}>
                        <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Selecione a raça" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__empty__">Selecione a raça...</SelectItem>
                          {OFFICIAL_PORTE_BREEDS.map((breed) => (
                            <SelectItem key={breed} value={breed}>{breed}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={row.modality === "COR" ? "Canário de Cor" : "Canário de Canto"} readOnly />
                    )}
                  </div>

                  <div className="lg:col-span-2 min-w-0">
                    <Label className="text-xs">Bitola</Label>
                    <Input value={suggestion ? `${suggestion.recommendedGaugeMm}` : row.ringGaugeMm} readOnly={!!suggestion} onChange={(e) => updateRow(index, { ringGaugeMm: e.target.value })} />
                  </div>

                  <div className="lg:col-span-2 min-w-0">
                    <Label className="text-xs">Quantidade</Label>
                    <Input type="number" value={row.quantity} onChange={(e) => updateRow(index, { quantity: e.target.value })} placeholder="Ex: 50" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                  <div className="lg:col-span-3 min-w-0">
                    <Label className="text-xs">Cor</Label>
                    <Select value={row.color} onValueChange={(value) => updateRow(index, { color: value })}>
                      <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COLOR_OPTIONS.map((color) => (
                          <SelectItem key={color} value={color}>{color}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-1 lg:col-span-7 min-w-0">
                    <Label className="text-xs">Faixa que será criada</Label>
                    <div className="h-10 rounded-md border bg-white px-3 flex items-center text-sm text-gray-700 font-mono">
                      {preview[index].qty > 0 ? `${preview[index].start} – ${preview[index].end}` : "Informe a quantidade"}
                    </div>
                  </div>
                  <div className="flex justify-end lg:col-span-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setRows((current) => current.filter((_, i) => i !== index))} disabled={rows.length <= 1}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  {suggestion ? suggestion.title : "Selecione os dados acima para o sistema sugerir a bitola oficial."}
                </p>
              </div>
            );
          })}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={() => setRows((current) => [...current, emptySplitRow()])}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar linha
        </Button>

        <div className="sticky bottom-0 z-20 -mx-5 mt-4 flex flex-col gap-3 border-t bg-white/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-gray-600">Total do pedido: <span className="font-bold">{totalQuantity}</span> anilhas</p>
          <Button onClick={handleSubmit} disabled={createSplit.isPending} className="bg-amber-600 hover:bg-amber-700">
            {createSplit.isPending ? "Criando..." : "Confirmar pedido"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
