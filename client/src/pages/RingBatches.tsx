/**
 * RingBatches.tsx — Gestão profissional de anilhas
 *
 * Funcionalidades:
 *   - Estatísticas gerais (total, disponíveis, em uso, lotes)
 *   - Criação de lotes com formatPattern configurável
 *   - Sugestão automática de bitola por espécie/raça
 *   - Listagem de lotes com indicadores de uso
 *   - Drill-down de anilhas individuais por lote
 *   - Preview do código gerado em tempo real
 */

import { useState, useMemo } from "react";
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  Plus, Trash2, Edit2, ChevronDown, ChevronRight, Tag,
  AlertCircle, CheckCircle2, Circle, Layers, Gauge,
} from "lucide-react";
import { toast } from "sonner";
import { generateRingCode } from "../../../server/_core/ringParser";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MODALITIES = [
  { value: "COR",   label: "Canário de Cor" },
  { value: "PORTE", label: "Canário de Porte" },
  { value: "CANTO", label: "Canário de Canto" },
  { value: "OUTRA", label: "Outra espécie" },
];

const FORMAT_PRESETS = [
  { label: "Padrão (GF-003-2026-001)",     value: "{breederCode}-{year}-{seq}" },
  { label: "Com mês (GF-003-06-2026-001)", value: "{breederCode}-{month}-{year}-{seq}" },
  { label: "Compacto (GF2026001)",          value: "{breederCode}{year}{seq}" },
  { label: "Só sequência (2026-001)",       value: "{year}-{seq}" },
  { label: "Personalizado",                 value: "__custom__" },
];

const statusBadge = (status: string) => {
  if (status === "available")  return <Badge variant="default"  className="bg-green-100 text-green-800">Disponível</Badge>;
  if (status === "exhausted")  return <Badge variant="destructive">Esgotado</Badge>;
  if (status === "inactive")   return <Badge variant="secondary">Inativo</Badge>;
  return <Badge variant="outline">{status}</Badge>;
};

const ringStatusIcon = (status: string) => {
  if (status === "available") return <Circle className="h-3 w-3 text-green-500 fill-green-500" />;
  if (status === "in_use")    return <CheckCircle2 className="h-3 w-3 text-amber-500" />;
  return <AlertCircle className="h-3 w-3 text-red-500" />;
};

// ─── Formulário de criação de lote ───────────────────────────────────────────
const emptyForm = {
  batch_number:    "",
  year:            new Date().getFullYear().toString(),
  color:           "",
  startNumber:     "1",
  endNumber:       "200",
  breederCode:     "",
  associationName: "",
  speciesName:     "Canário",
  breedName:       "",
  modality:        "COR" as "COR" | "PORTE" | "CANTO" | "OUTRA",
  ringGaugeMm:     "",
  month:           "",
  prefix:          "",
  suffix:          "",
  formatPreset:    "{breederCode}-{year}-{seq}",
  formatPattern:   "{breederCode}-{year}-{seq}",
  notes:           "",
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function RingBatches() {
  const [open, setOpen]               = useState(false);
  const [formData, setFormData]       = useState(emptyForm);
  const [expandedBatch, setExpanded]  = useState<number | null>(null);
  const [ringPage, setRingPage]       = useState(1);
  const [ringFilter, setRingFilter]   = useState("__all__");

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: stats, refetch: refetchStats } = trpc.ringsV2.stats.useQuery();
  const { data: batches = [], refetch: refetchBatches } = trpc.ringsV2.batches.list.useQuery();
  const { data: gaugeRules = [] } = trpc.ringsV2.gaugeRules.list.useQuery();

  const { data: batchRings, refetch: refetchRings } = trpc.ringsV2.rings.listByBatch.useQuery(
    {
      batchId:  expandedBatch ?? 0,
      status:   ringFilter === "__all__" ? undefined : ringFilter,
      page:     ringPage,
      pageSize: 100,
    },
    { enabled: expandedBatch !== null }
  );

  // ── Sugestão de bitola ───────────────────────────────────────────────────
  const { data: suggestedGauge } = trpc.ringsV2.gaugeRules.suggest.useQuery(
    {
      speciesName: formData.speciesName || "Canário",
      breedName:   formData.breedName || undefined,
      modality:    formData.modality || undefined,
    },
    { enabled: !!formData.speciesName }
  );

  // ── Preview do código ────────────────────────────────────────────────────
  const codePreview = useMemo(() => {
    try {
      return generateRingCode({
        breederCode:   formData.breederCode || "GF-003",
        year:          parseInt(formData.year) || new Date().getFullYear(),
        month:         formData.month ? parseInt(formData.month) : undefined,
        sequence:      parseInt(formData.startNumber) || 1,
        prefix:        formData.prefix,
        suffix:        formData.suffix,
        formatPattern: formData.formatPattern,
      });
    } catch {
      return "—";
    }
  }, [formData]);

  // ── Mutations ────────────────────────────────────────────────────────────
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

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleFormatPreset = (preset: string) => {
    setFormData(prev => ({
      ...prev,
      formatPreset:  preset,
      formatPattern: preset === "__custom__" ? prev.formatPattern : preset,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.batch_number || !formData.year || !formData.color) {
      toast.error("Preencha os campos obrigatórios: número do lote, ano e cor.");
      return;
    }
    createBatch.mutate({
      batch_number:    formData.batch_number,
      year:            parseInt(formData.year),
      color:           formData.color,
      startNumber:     parseInt(formData.startNumber) || 1,
      endNumber:       parseInt(formData.endNumber) || 200,
      breederCode:     formData.breederCode || undefined,
      associationName: formData.associationName || undefined,
      speciesName:     formData.speciesName || undefined,
      breedName:       formData.breedName || undefined,
      modality:        formData.modality || undefined,
      ringGaugeMm:     formData.ringGaugeMm ? parseFloat(formData.ringGaugeMm) : undefined,
      month:           formData.month ? parseInt(formData.month) : undefined,
      prefix:          formData.prefix || undefined,
      suffix:          formData.suffix || undefined,
      formatPattern:   formData.formatPattern,
      notes:           formData.notes || undefined,
    });
  };

  const toggleExpand = (id: number) => {
    setExpanded(prev => prev === id ? null : id);
    setRingPage(1);
    setRingFilter("__all__");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestão de Anilhas</h1>
            <p className="text-sm text-gray-500 mt-1">
              Controle profissional de lotes, bitolas e alocação transacional
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-600 hover:bg-amber-700">
                <Plus className="h-4 w-4 mr-2" /> Novo Lote
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Lote de Anilhas</DialogTitle>
                <DialogDescription>
                  Configure o lote e as anilhas serão geradas automaticamente.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                <Tabs defaultValue="basic">
                  <TabsList className="w-full">
                    <TabsTrigger value="basic"   className="flex-1">Básico</TabsTrigger>
                    <TabsTrigger value="species" className="flex-1">Espécie/Raça</TabsTrigger>
                    <TabsTrigger value="format"  className="flex-1">Formato</TabsTrigger>
                  </TabsList>

                  {/* Aba Básico */}
                  <TabsContent value="basic" className="space-y-3 pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Número do lote *</Label>
                        <Input
                          value={formData.batch_number}
                          onChange={e => setFormData({ ...formData, batch_number: e.target.value })}
                          placeholder="Ex: FOCB-2026-A"
                        />
                      </div>
                      <div>
                        <Label>Ano *</Label>
                        <Input
                          type="number"
                          value={formData.year}
                          onChange={e => setFormData({ ...formData, year: e.target.value })}
                          min={2000} max={2100}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Cor da anilha *</Label>
                        <Input
                          value={formData.color}
                          onChange={e => setFormData({ ...formData, color: e.target.value })}
                          placeholder="Ex: Azul, Amarela, Verde"
                        />
                      </div>
                      <div>
                        <Label>Código do criador</Label>
                        <Input
                          value={formData.breederCode}
                          onChange={e => setFormData({ ...formData, breederCode: e.target.value })}
                          placeholder="Ex: GF-003"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Número inicial</Label>
                        <Input
                          type="number"
                          value={formData.startNumber}
                          onChange={e => setFormData({ ...formData, startNumber: e.target.value })}
                          min={1}
                        />
                      </div>
                      <div>
                        <Label>Número final</Label>
                        <Input
                          type="number"
                          value={formData.endNumber}
                          onChange={e => setFormData({ ...formData, endNumber: e.target.value })}
                          min={1}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Associação</Label>
                      <Input
                        value={formData.associationName}
                        onChange={e => setFormData({ ...formData, associationName: e.target.value })}
                        placeholder="Ex: FOCB, FOB, OBJO"
                      />
                    </div>
                    <div>
                      <Label>Observações</Label>
                      <Input
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Notas opcionais"
                      />
                    </div>
                  </TabsContent>

                  {/* Aba Espécie/Raça */}
                  <TabsContent value="species" className="space-y-3 pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Espécie</Label>
                        <Input
                          value={formData.speciesName}
                          onChange={e => setFormData({ ...formData, speciesName: e.target.value })}
                          placeholder="Ex: Canário"
                        />
                      </div>
                      <div>
                        <Label>Raça</Label>
                        <Input
                          value={formData.breedName}
                          onChange={e => setFormData({ ...formData, breedName: e.target.value })}
                          placeholder="Ex: Gloster, Border"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Modalidade</Label>
                      <Select
                        value={formData.modality}
                        onValueChange={v => setFormData({ ...formData, modality: v as typeof formData.modality })}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {MODALITIES.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="flex items-center gap-2">
                        Bitola (mm)
                        {suggestedGauge && (
                          <span className="text-xs text-amber-600 font-normal">
                            Sugerida: {suggestedGauge.recommendedGaugeMm}mm
                            ({suggestedGauge.minGaugeMm}–{suggestedGauge.maxGaugeMm}mm)
                          </span>
                        )}
                      </Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.ringGaugeMm}
                        onChange={e => setFormData({ ...formData, ringGaugeMm: e.target.value })}
                        placeholder={suggestedGauge ? String(suggestedGauge.recommendedGaugeMm) : "Ex: 2.9"}
                      />
                      {suggestedGauge && !formData.ringGaugeMm && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-1 text-amber-600 h-7 px-2"
                          onClick={() => setFormData({ ...formData, ringGaugeMm: String(suggestedGauge.recommendedGaugeMm) })}
                        >
                          Usar {suggestedGauge.recommendedGaugeMm}mm sugerida
                        </Button>
                      )}
                    </div>
                    {/* Tabela de bitolas */}
                    {gaugeRules.length > 0 && (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Espécie</TableHead>
                              <TableHead>Raça</TableHead>
                              <TableHead>Bitola</TableHead>
                              <TableHead>Faixa</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {gaugeRules.slice(0, 8).map(r => (
                              <TableRow
                                key={r.id}
                                className="cursor-pointer hover:bg-amber-50"
                                onClick={() => setFormData({
                                  ...formData,
                                  speciesName: r.speciesName,
                                  breedName:   r.breedName ?? "",
                                  modality:    (r.modality as typeof formData.modality) ?? formData.modality,
                                  ringGaugeMm: String(r.recommendedGaugeMm),
                                })}
                              >
                                <TableCell>{r.speciesName}</TableCell>
                                <TableCell>{r.breedName ?? "—"}</TableCell>
                                <TableCell className="font-mono font-bold">{r.recommendedGaugeMm}mm</TableCell>
                                <TableCell className="text-xs text-gray-500">{r.minGaugeMm}–{r.maxGaugeMm}mm</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </TabsContent>

                  {/* Aba Formato */}
                  <TabsContent value="format" className="space-y-3 pt-3">
                    <div>
                      <Label>Modelo de formato</Label>
                      <Select value={formData.formatPreset} onValueChange={handleFormatPreset}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FORMAT_PRESETS.map(p => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.formatPreset === "__custom__" && (
                      <div>
                        <Label>Padrão personalizado</Label>
                        <Input
                          value={formData.formatPattern}
                          onChange={e => setFormData({ ...formData, formatPattern: e.target.value })}
                          placeholder="{breederCode}-{year}-{seq}"
                          className="font-mono"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Tokens: {"{breederCode}"} {"{year}"} {"{month}"} {"{seq}"} {"{prefix}"} {"{suffix}"}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>Mês (opcional)</Label>
                        <Input
                          type="number"
                          value={formData.month}
                          onChange={e => setFormData({ ...formData, month: e.target.value })}
                          min={1} max={12}
                          placeholder="1-12"
                        />
                      </div>
                      <div>
                        <Label>Prefixo</Label>
                        <Input
                          value={formData.prefix}
                          onChange={e => setFormData({ ...formData, prefix: e.target.value })}
                          placeholder="Ex: BR"
                        />
                      </div>
                      <div>
                        <Label>Sufixo</Label>
                        <Input
                          value={formData.suffix}
                          onChange={e => setFormData({ ...formData, suffix: e.target.value })}
                          placeholder="Ex: -A"
                        />
                      </div>
                    </div>
                    {/* Preview */}
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                      <p className="text-xs text-amber-700 font-medium mb-1">Preview da primeira anilha:</p>
                      <p className="font-mono text-lg font-bold text-amber-900">{codePreview}</p>
                      <p className="text-xs text-amber-600 mt-1">
                        Total: {Math.max(0, (parseInt(formData.endNumber) || 200) - (parseInt(formData.startNumber) || 1) + 1)} anilhas
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    className="flex-1 bg-amber-600 hover:bg-amber-700"
                    disabled={createBatch.isPending}
                  >
                    {createBatch.isPending ? "Criando..." : "Criar Lote"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Estatísticas */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total de anilhas", value: stats.total,            icon: Tag,         color: "text-gray-700" },
              { label: "Disponíveis",      value: stats.available,        icon: Circle,      color: "text-green-600" },
              { label: "Em uso",           value: stats.inUse,            icon: CheckCircle2,color: "text-amber-600" },
              { label: "Lotes",            value: stats.batches,          icon: Layers,      color: "text-blue-600" },
              { label: "Lotes esgotados",  value: stats.exhaustedBatches, icon: AlertCircle, color: "text-red-500" },
            ].map(s => (
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

        {/* Lista de lotes */}
        <Card>
          <CardHeader>
            <CardTitle>Lotes de Anilhas</CardTitle>
            <CardDescription>Clique em um lote para ver as anilhas individuais</CardDescription>
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
                {batches.map(batch => {
                  const pct = batch.quantity_total > 0
                    ? Math.round((batch.quantity_used / batch.quantity_total) * 100)
                    : 0;
                  const isExpanded = expandedBatch === batch.id;

                  return (
                    <div key={batch.id} className="border rounded-lg overflow-hidden">
                      {/* Cabeçalho do lote */}
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => toggleExpand(batch.id)}
                      >
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                          : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                        }

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm">{batch.batch_number}</span>
                            <span className="text-gray-500 text-xs">{batch.year}</span>
                            {batch.color && (
                              <Badge variant="outline" className="text-xs">{batch.color}</Badge>
                            )}
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
                            {batch.breedName && (
                              <span className="text-xs text-gray-400">{batch.breedName}</span>
                            )}
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                          onClick={e => {
                            e.stopPropagation();
                            if (confirm(`Remover lote "${batch.batch_number}"? Esta ação é irreversível.`)) {
                              deleteBatch.mutate(batch.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Drill-down de anilhas */}
                      {isExpanded && (
                        <div className="border-t bg-gray-50 p-3">
                          <div className="flex items-center gap-2 mb-3">
                            <Select value={ringFilter} onValueChange={v => { setRingFilter(v); setRingPage(1); }}>
                              <SelectTrigger className="w-40 h-8 text-xs">
                                <SelectValue placeholder="Filtrar status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__all__">Todas</SelectItem>
                                <SelectItem value="available">Disponíveis</SelectItem>
                                <SelectItem value="in_use">Em uso</SelectItem>
                              </SelectContent>
                            </Select>
                            {batchRings && (
                              <span className="text-xs text-gray-500">
                                {batchRings.total} anilhas
                              </span>
                            )}
                          </div>

                          {batchRings?.items && batchRings.items.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
                              {batchRings.items.map(ring => (
                                <div
                                  key={ring.id}
                                  className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-mono border ${
                                    ring.status === "available"
                                      ? "bg-white border-green-200"
                                      : "bg-amber-50 border-amber-200"
                                  }`}
                                >
                                  {ringStatusIcon(ring.status)}
                                  <span className="truncate">{ring.fullCode ?? ring.number}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 text-center py-4">
                              Nenhuma anilha encontrada.
                            </p>
                          )}

                          {batchRings && batchRings.total > 100 && (
                            <div className="flex justify-center gap-2 mt-3">
                              <Button
                                variant="outline" size="sm"
                                disabled={ringPage === 1}
                                onClick={() => setRingPage(p => p - 1)}
                              >Anterior</Button>
                              <span className="text-xs self-center text-gray-500">
                                Pág. {ringPage} de {Math.ceil(batchRings.total / 100)}
                              </span>
                              <Button
                                variant="outline" size="sm"
                                disabled={ringPage >= Math.ceil(batchRings.total / 100)}
                                onClick={() => setRingPage(p => p + 1)}
                              >Próxima</Button>
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
