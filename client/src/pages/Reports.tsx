import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { SPECIALTIES, COLORS } from "@shared/constants";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import {
  Egg, Feather, Heart, Trophy, Bird as BirdIcon, Dna, AlertTriangle,
  CheckCircle2, XCircle, Printer, Search, List, FlaskConical, Tag,
  Calendar, Clock, Activity, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { SexBadge, CoiRiskBadge } from "@/components/ui-premium";

function labelFor(list: readonly { id: string; name: string }[], code: string) {
  return list.find((i) => i.id === code)?.name ?? code;
}

// ────────────────────────────────────────────────────────────
// Tab 1: Dashboard (existente, preservado 100%)
// ────────────────────────────────────────────────────────────
function TabDashboard() {
  const { data, isLoading } = trpc.reports.summary.useQuery();
  const { data: birds } = trpc.birds.list.useQuery({});

  const specialtyData = Object.entries(data?.birdsBySpecialty ?? {}).map(([code, count]) => ({
    name: labelFor(SPECIALTIES, code),
    total: count,
  }));
  const colorData = Object.entries(data?.birdsByColor ?? {}).map(([code, count]) => ({
    name: labelFor(COLORS, code),
    total: count,
  }));
  const ringOf = (id: number) => birds?.find((b) => b.id === id)?.ring ?? `#${id}`;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-600">Total de Pássaros</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-bold text-gray-900">{birds?.length ?? 0}</div>
            <BirdIcon className="w-7 h-7 text-blue-500 opacity-50" />
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-600">Casais Ativos</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-bold text-gray-900">{data?.couplesActive ?? 0}</div>
            <Heart className="w-7 h-7 text-green-500 opacity-50" />
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-600">Taxa de Eclosão</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-bold text-gray-900">{data?.hatchRate ?? 0}%</div>
            <Egg className="w-7 h-7 text-yellow-500 opacity-50" />
          </CardContent>
          <CardContent className="pt-0 text-xs text-gray-500">
            {data?.totalHatched ?? 0} filhotes de {data?.totalEggs ?? 0} ovos ({data?.clutchesTotal ?? 0} posturas)
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-600">Anilhas Disponíveis</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-bold text-gray-900">{data?.ringsAvailable ?? 0}</div>
            <Feather className="w-7 h-7 text-purple-500 opacity-50" />
          </CardContent>
          <CardContent className="pt-0 text-xs text-gray-500">{data?.ringsInUse ?? 0} já em uso</CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Pássaros por Especialidade</CardTitle><CardDescription>Distribuição do plantel</CardDescription></CardHeader>
          <CardContent>
            {specialtyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={specialtyData} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-gray-400 py-12">Sem dados ainda</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Pássaros por Cor/Mutação</CardTitle><CardDescription>Distribuição do plantel</CardDescription></CardHeader>
          <CardContent>
            {colorData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={colorData} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#d97706" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-gray-400 py-12">Sem dados ainda</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-600" />Melhores Pontuados em Campeonatos</CardTitle>
          <CardDescription>Os pássaros com as maiores notas registradas</CardDescription>
        </CardHeader>
        <CardContent>
          {data?.topScores && data.topScores.length > 0 ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Pássaro</TableHead><TableHead>Campeonato</TableHead>
                <TableHead>Categoria</TableHead><TableHead>Nota</TableHead><TableHead>Colocação</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.topScores.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono font-semibold">{ringOf(s.birdId)}</TableCell>
                    <TableCell>{s.championshipName}</TableCell>
                    <TableCell>{s.category}</TableCell>
                    <TableCell className="font-semibold">{s.totalScore}</TableCell>
                    <TableCell>{s.placement ? `${s.placement}º lugar` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <p className="text-center text-gray-400 py-8">Nenhuma pontuação registrada ainda.</p>}
        </CardContent>
      </Card>
      {!isLoading && !data && <p className="text-center text-gray-400 text-sm">Carregando dados...</p>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Tab 2: Plantel Completo
// ────────────────────────────────────────────────────────────
function TabPlantel() {
  const [sexFilter, setSexFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [geneticFilter, setGeneticFilter] = useState<"all" | "completa" | "incompleta">("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = trpc.reports.plantelCompleto.useQuery({
    sexFilter: sexFilter || undefined,
    statusFilter: statusFilter || undefined,
    geneticFilter,
    search: search || undefined,
  });

  const handlePrint = () => window.print();

  const exportCSV = () => {
    if (!data?.rows.length) return;
    const header = ["Anilha", "Título", "Sexo", "Raça", "Classe Oficial", "Genética", "COI", "Pai", "Mãe", "Alertas"];
    const rows = data.rows.map((r) => [
      r.ring,
      r.displayTitle ?? "",
      r.sex,
      r.breedName ?? "",
      r.officialCode ?? "",
      r.geneticComplete ? "Completa" : "Incompleta",
      r.coi !== null ? `${(r.coi * 100).toFixed(1)}%` : "",
      r.fatherId ? "Sim" : "Não",
      r.motherId ? "Sim" : "Não",
      r.alerts.join("; "),
    ]);
    const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "plantel-canaril.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end print:hidden">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <Input placeholder="Buscar por anilha ou nome..." className="pl-8 w-52" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={sexFilter || "all"} onValueChange={(v) => setSexFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Sexo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os sexos</SelectItem>
            <SelectItem value="macho">Machos</SelectItem>
            <SelectItem value="fêmea">Fêmeas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={geneticFilter} onValueChange={(v) => setGeneticFilter(v as any)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Genética" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Genética: todos</SelectItem>
            <SelectItem value="completa">Com genética</SelectItem>
            <SelectItem value="incompleta">Sem genética</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Feather className="w-4 h-4 mr-1.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4 mr-1.5" />Imprimir</Button>
        </div>
      </div>

      {isLoading && <p className="text-gray-400 text-sm">Carregando plantel...</p>}

      {data && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <List className="w-4 h-4 text-amber-600" />
              Plantel — {data.total} pássaro{data.total !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anilha</TableHead>
                    <TableHead>Título / Apelido</TableHead>
                    <TableHead>Sexo</TableHead>
                    <TableHead>Classe oficial</TableHead>
                    <TableHead>Genética</TableHead>
                    <TableHead>COI</TableHead>
                    <TableHead>Alertas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">Nenhum pássaro encontrado com os filtros aplicados.</TableCell></TableRow>
                  )}
                  {data.rows.map((r) => (
                    <TableRow key={r.birdId}>
                      <TableCell className="font-mono font-semibold text-sm">{r.ring}</TableCell>
                      <TableCell>
                        <p className="text-sm font-medium truncate max-w-[180px]">{r.displayTitle ?? r.ring}</p>
                        {r.nickname && <p className="text-xs text-gray-400">"{r.nickname}"</p>}
                      </TableCell>
                      <TableCell><SexBadge sex={r.sex} /></TableCell>
                      <TableCell className="text-xs text-gray-600">{r.officialCode ? `${r.officialCode} — ${r.officialName ?? ""}` : <span className="text-gray-300">—</span>}</TableCell>
                      <TableCell>
                        {r.geneticComplete
                          ? <span className="flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="w-3.5 h-3.5" />Completa</span>
                          : <span className="flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="w-3.5 h-3.5" />Incompleta</span>}
                      </TableCell>
                      <TableCell>
                        {r.coi !== null
                          ? <div className="space-y-1"><CoiRiskBadge risk={r.coiRisk} /><p className="text-xs text-gray-400">{(r.coi * 100).toFixed(1)}%</p></div>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        {r.alerts.length === 0
                          ? <span className="text-gray-300 text-xs">—</span>
                          : <div className="flex flex-wrap gap-1">{r.alerts.slice(0, 2).map((a, i) => <Badge key={i} variant="outline" className="text-xs text-amber-700 border-amber-200">{a}</Badge>)}{r.alerts.length > 2 && <Badge variant="outline" className="text-xs">+{r.alerts.length - 2}</Badge>}</div>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Tab 3: Lacunas de Dados
// ────────────────────────────────────────────────────────────
function TabLacunas() {
  const { data, isLoading } = trpc.reports.lacunasDados.useQuery();

  return (
    <div className="space-y-4">
      {isLoading && <p className="text-gray-400 text-sm">Carregando...</p>}
      {data?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            ["Total ativo", data.summary.total, "text-gray-700"],
            ["Sem pai", data.summary.semPai, "text-amber-700"],
            ["Sem mãe", data.summary.semMae, "text-amber-700"],
            ["Sem classe", data.summary.semClasseOficial, "text-orange-700"],
            ["Sem genótipo", data.summary.semGenotipo, "text-red-700"],
            ["Completos", data.summary.compleatos, "text-green-700"],
          ].map(([label, value, color]) => (
            <Card key={String(label)}>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {data && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pássaros com dados faltando</CardTitle>
            <CardDescription>Ordenados por número de lacunas. Complete as fichas para melhorar os cálculos genéticos.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anilha</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Sexo</TableHead>
                    <TableHead>Lacunas</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.filter((r) => r.lacunasCount > 0).length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-green-600 py-8 flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" />Todos os pássaros ativos têm dados completos!</TableCell></TableRow>
                  )}
                  {data.rows.filter((r) => r.lacunasCount > 0).map((r) => (
                    <TableRow key={r.birdId}>
                      <TableCell className="font-mono font-semibold text-sm">{r.ring}</TableCell>
                      <TableCell className="text-sm truncate max-w-[160px]">{r.displayTitle ?? r.ring}</TableCell>
                      <TableCell><SexBadge sex={r.sex} /></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.lacunas.map((l, i) => (
                            <Badge key={i} variant="outline" className="text-xs text-red-700 border-red-200">{l}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={r.lacunasCount >= 4 ? "bg-red-100 text-red-800" : r.lacunasCount >= 2 ? "bg-amber-100 text-amber-800" : "bg-yellow-100 text-yellow-800"}>
                          {r.lacunasCount} lacuna{r.lacunasCount !== 1 ? "s" : ""}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Tab 4: Anilhas
// ────────────────────────────────────────────────────────────
function TabAnilhas() {
  const { data, isLoading } = trpc.reports.anilhas.useQuery();

  return (
    <div className="space-y-4">
      {isLoading && <p className="text-gray-400 text-sm">Carregando...</p>}
      {data?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            ["Lotes", data.summary.totalBatches, "text-gray-700"],
            ["Total anilhas", data.summary.totalRings, "text-gray-700"],
            ["Disponíveis", data.summary.totalAvailable, "text-green-700"],
            ["Em uso", data.summary.totalInUse, "text-blue-700"],
            ["Perdidas", data.summary.totalLost, "text-amber-700"],
            ["Danificadas", data.summary.totalDamaged, "text-red-700"],
          ].map(([label, value, color]) => (
            <Card key={String(label)}>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {data && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4 text-amber-600" />
              Lotes de Anilhas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lote</TableHead>
                    <TableHead>Ano</TableHead>
                    <TableHead>Código criador</TableHead>
                    <TableHead>Cor</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Disponíveis</TableHead>
                    <TableHead>Em uso</TableHead>
                    <TableHead>Perdidas/Danif.</TableHead>
                    <TableHead>Utilização</TableHead>
                    <TableHead>Próxima livre</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.batches.length === 0 && (
                    <TableRow><TableCell colSpan={10} className="text-center text-gray-400 py-8">Nenhum lote de anilhas cadastrado.</TableCell></TableRow>
                  )}
                  {data.batches.map((b) => (
                    <TableRow key={b.batchId}>
                      <TableCell className="font-mono font-semibold">{b.batchNumber}</TableCell>
                      <TableCell>{b.year}</TableCell>
                      <TableCell className="text-sm">{b.breederCode ?? "—"}</TableCell>
                      <TableCell className="text-sm">{b.color}</TableCell>
                      <TableCell className="font-semibold">{b.quantityTotal}</TableCell>
                      <TableCell><Badge className="bg-green-100 text-green-800">{b.available}</Badge></TableCell>
                      <TableCell><Badge className="bg-blue-100 text-blue-800">{b.inUse}</Badge></TableCell>
                      <TableCell>
                        {(b.lost + b.damaged) > 0
                          ? <Badge className="bg-amber-100 text-amber-800">{b.lost + b.damaged}</Badge>
                          : <span className="text-gray-300">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${b.utilizationPct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{b.utilizationPct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{b.nextAvailable ?? <span className="text-amber-600">Esgotado</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Tab 5: Confronto Genético
// ────────────────────────────────────────────────────────────
function TabConfronto() {
  const [maleId, setMaleId] = useState("");
  const [femaleId, setFemaleId] = useState("");
  const [doQuery, setDoQuery] = useState(false);

  const { data: allBirds } = trpc.birds.list.useQuery({});
  const males = (allBirds ?? []).filter((b) => b.sex === "macho" || b.sex === "M");
  const females = (allBirds ?? []).filter((b) => b.sex === "fêmea" || b.sex === "F");

  const { data, isLoading } = trpc.reports.confrontoGenetico.useQuery(
    { maleId: Number(maleId), femaleId: Number(femaleId) },
    { enabled: doQuery && !!maleId && !!femaleId }
  );

  const handleCalculate = () => {
    if (!maleId || !femaleId) return;
    setDoQuery(false);
    setTimeout(() => setDoQuery(true), 0);
  };

  const MUTATION_PT: Record<string, string> = {
    homozygous_mutant: "Visual (dose dupla)",
    heterozygous_carrier: "Portador",
    homozygous_normal: "Normal",
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-purple-600" />
            Confronto Genético de Casal
          </CardTitle>
          <CardDescription>Selecione um macho e uma fêmea para ver o confronto genético completo com alertas de risco.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Macho</p>
              <Select value={maleId} onValueChange={(v) => { setMaleId(v); setDoQuery(false); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o macho" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {males.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.ring}{b.displayTitle ? ` — ${b.displayTitle}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Fêmea</p>
              <Select value={femaleId} onValueChange={(v) => { setFemaleId(v); setDoQuery(false); }}>
                <SelectTrigger><SelectValue placeholder="Selecione a fêmea" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {females.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.ring}{b.displayTitle ? ` — ${b.displayTitle}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleCalculate} disabled={!maleId || !femaleId} className="bg-amber-600 hover:bg-amber-700">
            <FlaskConical className="w-4 h-4 mr-1.5" />
            Calcular Confronto
          </Button>
        </CardContent>
      </Card>

      {isLoading && <p className="text-gray-400 text-sm">Calculando...</p>}

      {data && (
        <div className="space-y-4">
          {/* Veredito */}
          <div className={`flex items-center gap-2 rounded-lg p-3 text-sm font-semibold border ${
            data.verdict === "IDEAL" ? "bg-green-50 border-green-200 text-green-800" :
            data.verdict === "ATENCAO" ? "bg-amber-50 border-amber-200 text-amber-800" :
            "bg-red-50 border-red-200 text-red-800"
          }`}>
            {data.verdict === "IDEAL" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {data.verdict === "IDEAL" ? "Casal ideal — nenhum problema genético identificado" :
             data.verdict === "ATENCAO" ? "Casal aceitável, com pontos de atenção" :
             "Casal não recomendado — risco genético relevante"}
          </div>

          {/* Alertas */}
          {data.alerts.length > 0 && (
            <div className="space-y-2">
              {data.alerts.map((alert, i) => (
                <div key={i} className={`flex items-start gap-2 rounded-lg p-3 text-sm border ${alert.includes("RISCO LETAL") ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {alert}
                </div>
              ))}
            </div>
          )}
          {data.alerts.length === 0 && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Nenhum alerta crítico para este casal.
            </div>
          )}

          {/* Orientação geral — sempre mostrada quando há problema, mesmo sem alternativa no próprio plantel */}
          {data.generalGuidance.length > 0 && (
            <Card className="border-purple-100 bg-purple-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">O que buscar para um cruzamento ideal</CardTitle>
                <CardDescription className="text-xs">
                  {data.betterAlternatives && (data.betterAlternatives.forMale.length > 0 || data.betterAlternatives.forFemale.length > 0)
                    ? "Além das alternativas do seu plantel acima, de forma geral:"
                    : "Não encontramos uma alternativa melhor no seu plantel atual — de forma geral, pra este tipo de problema:"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {data.generalGuidance.map((tip: string, i: number) => (
                  <p key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                    <span className="text-purple-500 shrink-0">•</span>{tip}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Alternativas — quando o casal escolhido não é ideal, mostra com quem seria */}
          {data.betterAlternatives && (data.betterAlternatives.forMale.length > 0 || data.betterAlternatives.forFemale.length > 0) && (
            <Card className="border-blue-100 bg-blue-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Este casal não é a combinação ideal — o que combinaria melhor</CardTitle>
                <CardDescription className="text-xs">Buscamos no seu plantel os pássaros que teriam a melhor combinação genética com cada um dos dois.</CardDescription>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                {data.betterAlternatives.forMale.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">Melhores fêmeas para {data.male.bird.ring}</p>
                    <div className="space-y-1.5">
                      {data.betterAlternatives.forMale.map((alt: any, i: number) => (
                        <div key={i} className="bg-white rounded-lg border p-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-semibold">{alt.ring}</span>
                            <Badge variant="outline">{alt.score.toFixed(0)} pts · COI {alt.coiPct}</Badge>
                          </div>
                          {alt.reasons[0] && <p className="text-gray-500 mt-1">{alt.reasons[0]}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.betterAlternatives.forFemale.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">Melhores machos para {data.female.bird.ring}</p>
                    <div className="space-y-1.5">
                      {data.betterAlternatives.forFemale.map((alt: any, i: number) => (
                        <div key={i} className="bg-white rounded-lg border p-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-semibold">{alt.ring}</span>
                            <Badge variant="outline">{alt.score.toFixed(0)} pts · COI {alt.coiPct}</Badge>
                          </div>
                          {alt.reasons[0] && <p className="text-gray-500 mt-1">{alt.reasons[0]}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* COI */}
          <Card>
            <CardContent className="p-4 flex items-center gap-6">
              <div>
                <p className="text-xs text-gray-500 mb-1">Coeficiente de Consanguinidade (COI)</p>
                <p className="text-3xl font-bold text-gray-900">{(data.coi * 100).toFixed(2)}%</p>
              </div>
              <div><CoiRiskBadge risk={data.coiRisk} /></div>
              {data.coi === 0 && <p className="text-sm text-green-600">Sem parentesco detectado nas gerações analisadas</p>}
            </CardContent>
          </Card>

          {/* Dados dos pássaros */}
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { label: "Macho", bird: data.male, color: "blue" },
              { label: "Fêmea", bird: data.female, color: "rose" },
            ].map(({ label, bird: birdData, color }) => (
              <Card key={label} className={`border-${color}-100`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{label}: {birdData.bird.ring}</CardTitle>
                  {birdData.bird.displayTitle && <CardDescription className="text-xs">{birdData.bird.displayTitle}</CardDescription>}
                </CardHeader>
                <CardContent className="text-xs space-y-1.5">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div><span className="text-gray-400">Classe:</span> {birdData.profile?.officialCode ?? <span className="text-gray-300">—</span>}</div>
                    <div><span className="text-gray-400">Lipocromo:</span> {birdData.genotype?.backgroundColor ?? <span className="text-gray-300">—</span>}</div>
                    <div><span className="text-gray-400">Plumagem:</span> {birdData.genotype?.featherType ?? <span className="text-gray-300">—</span>}</div>
                    <div><span className="text-gray-400">Crista:</span> {birdData.genotype ? (birdData.genotype.hasCrest ? "Sim" : "Não") : <span className="text-gray-300">—</span>}</div>
                  </div>
                  {birdData.genotype == null && (
                    <p className="text-amber-600 bg-amber-50 rounded p-1.5 border border-amber-100">
                      Sem genótipo avançado. Edite o pássaro para preencher.
                    </p>
                  )}
                  {Array.isArray((birdData.genotype?.mutations as any)) && (birdData.genotype!.mutations as any[]).length > 0 && (
                    <div>
                      <p className="text-gray-500 mb-1">Mutações:</p>
                      {(birdData.genotype!.mutations as Array<{ mutation: string; zygosity: string }>).map((m, i) => (
                        <p key={i} className="text-gray-600">• {m.mutation} — {MUTATION_PT[m.zygosity] ?? m.zygosity}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {!data.hasBothGenotypes && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded p-2">
              Para ver a predição completa de filhotes via motor Punnett, acesse a{" "}
              <Link href="/genetics-calculator" className="underline font-medium">Calculadora Genética → Casal do Plantel</Link>
              {" "}após preencher o Genótipo Avançado dos dois pássaros.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Tab 6: Casais e Reprodução
// ────────────────────────────────────────────────────────────
function TabCasais() {
  const { data, isLoading } = trpc.reports.casaisReproducao.useQuery();

  const exportCSV = () => {
    if (!data?.rows.length) return;
    const header = ["Casal", "Macho", "Fêmea", "Gaiola", "Status", "COI", "Posturas", "Ovos", "Fertilizados", "Eclosões", "Filhotes vingaram", "Filhotes perdidos", "Taxa Fert.", "Taxa Ecl.", "Taxa Sobrevivência", "Alertas", "Recomendações"];
    const rows = data.rows.map((r) => [
      r.coupleId,
      r.male?.ring ?? "",
      r.female?.ring ?? "",
      r.cageNumber,
      r.status,
      r.coi !== null ? `${(r.coi * 100).toFixed(1)}%` : "",
      r.clutchesCount,
      r.totalEggs,
      r.totalFertilized,
      r.totalHatched,
      r.chicksSurvived,
      r.chicksDied,
      r.fertilizationRate !== null ? `${r.fertilizationRate}%` : "",
      r.hatchRate !== null ? `${r.hatchRate}%` : "",
      r.survivalRate !== null ? `${r.survivalRate}%` : "",
      r.alerts.join("; "),
      r.recommendations.join("; "),
    ]);
    const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "casais-canaril.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const activePct = data ? Math.round((data.rows.filter(r => r.status === "active").length / Math.max(data.rows.length, 1)) * 100) : 0;

  return (
    <div className="space-y-4">
      {isLoading && <p className="text-gray-400 text-sm">Carregando...</p>}

      {data && (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["Total de casais", data.rows.length, "text-gray-700"],
              ["Ativos", data.rows.filter(r => r.status === "active").length, "text-green-700"],
              ["Total de posturas", data.rows.reduce((s, r) => s + r.clutchesCount, 0), "text-amber-700"],
              ["Total de eclosões", data.rows.reduce((s, r) => s + r.totalHatched, 0), "text-blue-700"],
            ].map(([label, value, color]) => (
              <Card key={String(label)}>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Resumo do plantel — porcentagens agregadas */}
          {data.summary && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Desempenho reprodutivo do plantel</CardTitle>
                <CardDescription>Consolidado de todas as posturas e filhotes registrados.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500">Taxa de fertilização</p>
                    <p className="text-2xl font-bold text-amber-700">{data.summary.fertilizationRatePct ?? "—"}{data.summary.fertilizationRatePct !== null ? "%" : ""}</p>
                    <p className="text-xs text-gray-400">{data.summary.totalFertilized} de {data.summary.totalEggs} ovos</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Taxa de eclosão</p>
                    <p className="text-2xl font-bold text-blue-700">{data.summary.hatchRatePct ?? "—"}{data.summary.hatchRatePct !== null ? "%" : ""}</p>
                    <p className="text-xs text-gray-400">{data.summary.totalHatched} de {data.summary.totalFertilized} galados</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Taxa de sobrevivência</p>
                    <p className="text-2xl font-bold text-green-700">{data.summary.survivalRatePct ?? "—"}{data.summary.survivalRatePct !== null ? "%" : ""}</p>
                    <p className="text-xs text-gray-400">{data.summary.totalSurvived} vingaram / {data.summary.totalDied} perdas de {data.summary.totalChicksRegistered} filhotes</p>
                  </div>
                </div>

                {data.summary.topPerformers.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Melhores casais (super-reprodutores)</p>
                    <div className="space-y-1.5">
                      {data.summary.topPerformers.map((p) => (
                        <div key={p.coupleId} className="flex items-center justify-between text-sm bg-green-50 rounded-lg px-3 py-2 border border-green-100">
                          <span className="font-mono">{p.male?.ring ?? "—"} × {p.female?.ring ?? "—"}</span>
                          <span className="text-xs text-gray-500">Fert. {p.fertilizationRate}% · Ecl. {p.hatchRate}% · Sobr. {p.survivalRate ?? "—"}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {data.summary.bottomPerformers.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Casais que precisam de atenção</p>
                    <div className="space-y-1.5">
                      {data.summary.bottomPerformers.map((p) => (
                        <div key={p.coupleId} className="flex items-center justify-between text-sm bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                          <span className="font-mono">{p.male?.ring ?? "—"} × {p.female?.ring ?? "—"}</span>
                          <span className="text-xs text-gray-500">Fert. {p.fertilizationRate}% · Ecl. {p.hatchRate}% · Sobr. {p.survivalRate ?? "—"}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tabela */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500" />
                  Todos os casais — {data.rows.length} registros
                </CardTitle>
                <Button variant="outline" size="sm" onClick={exportCSV}>
                  <Feather className="w-4 h-4 mr-1.5" />CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Macho</TableHead>
                      <TableHead>Fêmea</TableHead>
                      <TableHead>Gaiola</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>COI</TableHead>
                      <TableHead>Posturas</TableHead>
                      <TableHead>Ovos</TableHead>
                      <TableHead>Eclosões</TableHead>
                      <TableHead>Sobrevivência</TableHead>
                      <TableHead>Taxa Fert.</TableHead>
                      <TableHead>Alertas</TableHead>
                      <TableHead>O que fazer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.length === 0 && (
                      <TableRow><TableCell colSpan={12} className="text-center text-gray-400 py-8">Nenhum casal cadastrado.</TableCell></TableRow>
                    )}
                    {data.rows.map((r) => (
                      <TableRow key={r.coupleId}>
                        <TableCell className="font-mono text-sm font-semibold">{r.male?.ring ?? "—"}</TableCell>
                        <TableCell className="font-mono text-sm font-semibold">{r.female?.ring ?? "—"}</TableCell>
                        <TableCell className="text-sm">{r.cageNumber}</TableCell>
                        <TableCell>
                          <Badge className={r.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                            {r.status === "active" ? "Ativo" : r.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {r.coi !== null
                            ? <div className="space-y-0.5"><CoiRiskBadge risk={r.coiRisk} /><p className="text-xs text-gray-400">{(r.coi * 100).toFixed(1)}%</p></div>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-sm font-semibold">{r.clutchesCount}</TableCell>
                        <TableCell className="text-sm">{r.totalEggs}</TableCell>
                        <TableCell>
                          <span className={`text-sm font-semibold ${r.totalHatched > 0 ? "text-green-700" : "text-gray-400"}`}>{r.totalHatched}</span>
                        </TableCell>
                        <TableCell>
                          {r.survivalRate !== null
                            ? <div className="flex items-center gap-1.5"><div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${r.survivalRate >= 70 ? "bg-green-500" : "bg-red-400"}`} style={{ width: `${r.survivalRate}%` }} /></div><span className="text-xs text-gray-600">{r.survivalRate}%</span></div>
                            : <span className="text-gray-300 text-xs">—</span>}
                          <p className="text-xs text-gray-400 mt-0.5">{r.chicksSurvived} vingaram / {r.chicksDied} perdas</p>
                        </TableCell>
                        <TableCell>
                          {r.fertilizationRate !== null
                            ? <div className="flex items-center gap-1.5"><div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-amber-400 rounded-full" style={{ width: `${r.fertilizationRate}%` }} /></div><span className="text-xs text-gray-600">{r.fertilizationRate}%</span></div>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </TableCell>
                        <TableCell>
                          {r.alerts.length === 0
                            ? <span className="text-gray-300 text-xs">—</span>
                            : <div className="flex flex-wrap gap-1">{r.alerts.map((a, i) => <Badge key={i} variant="outline" className="text-xs text-amber-700 border-amber-200">{a}</Badge>)}</div>}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {r.recommendations.length === 0
                            ? <span className="text-gray-300 text-xs">—</span>
                            : <ul className="text-xs text-gray-600 space-y-0.5">{r.recommendations.map((rec, i) => <li key={i}>• {rec}</li>)}</ul>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Tab 7: Temporada — painel operacional da reprodução atual
// ────────────────────────────────────────────────────────────
function TabTemporada() {
  const { data, isLoading } = trpc.reports.temporada.useQuery();

  if (isLoading) return <div className="py-8 text-center text-gray-400 text-sm">Carregando painel da temporada...</div>;
  if (!data) return <div className="py-8 text-center text-gray-400 text-sm">Nenhum dado de temporada disponível.</div>;

  const severityColor = {
    high: "bg-red-50 border-red-200 text-red-800",
    medium: "bg-amber-50 border-amber-200 text-amber-800",
    low: "bg-blue-50 border-blue-200 text-blue-800",
  };

  return (
    <div className="space-y-5">
      {/* Métricas rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Casais ativos", value: data.activeCouplesCount, icon: Heart, color: "text-rose-600" },
          { label: "Posturas ativas", value: data.activeClutchesCount, icon: Egg, color: "text-amber-600" },
          { label: "Eclosões previstas (7d)", value: data.nearHatchCount, icon: Clock, color: "text-emerald-600" },
          { label: "Anilhas disponíveis", value: data.ringsAvailable, icon: Tag, color: "text-blue-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`w-6 h-6 ${color} shrink-0`} />
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alertas */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-500" />Alertas da temporada
          </h3>
          {data.alerts.map((a, i) => (
            <div key={i} className={`border rounded-lg px-4 py-2.5 text-sm ${severityColor[a.severity]}`}>
              {a.severity === "high" && <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />}
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Resumo por casal */}
      {(data.casaisResumo as any[]).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" />Situação por casal
          </h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gaiola</TableHead>
                  <TableHead>Macho</TableHead>
                  <TableHead>Fêmea</TableHead>
                  <TableHead>Posturas</TableHead>
                  <TableHead>Eclosão prevista</TableHead>
                  <TableHead>Filhotes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.casaisResumo as any[]).map((c) => (
                  <TableRow key={c.coupleId} className={c.nearHatchSoon ? "bg-emerald-50" : ""}>
                    <TableCell className="font-medium">{c.cageNumber}</TableCell>
                    <TableCell className="font-mono text-sm">{c.maleRing}</TableCell>
                    <TableCell className="font-mono text-sm">{c.femaleRing}</TableCell>
                    <TableCell>{c.clutchesCount}</TableCell>
                    <TableCell>
                      {c.expectedHatchDate
                        ? <span className={c.nearHatchSoon ? "text-emerald-700 font-semibold" : ""}>
                            {new Date(c.expectedHatchDate).toLocaleDateString("pt-BR")}
                            {c.nearHatchSoon && " ⚡"}
                          </span>
                        : "—"}
                    </TableCell>
                    <TableCell>{c.totalHatched}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Tab 8: Índice — ranking de desempenho por pássaro
// ────────────────────────────────────────────────────────────
function TabIndice() {
  const { data, isLoading } = trpc.reports.indice.useQuery();

  if (isLoading) return <div className="py-8 text-center text-gray-400 text-sm">Calculando índices...</div>;
  if (!data || !(data as any).rows?.length) return <div className="py-8 text-center text-gray-400 text-sm">Nenhum dado de índice disponível.</div>;

  const rows = (data as any).rows as Array<{
    birdId: number; ring: string; displayTitle: string | null;
    sex: string; modality: string | null;
    totalClutches: number; totalEggs: number; totalHatched: number;
    hatchRate: number; bestScore: number | null;
    coi: number; coiRisk: string; hasGenotype: boolean;
  }>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Ranking por desempenho reprodutivo + melhor pontuação em campeonato.</p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Anilha</TableHead>
              <TableHead>Sexo</TableHead>
              <TableHead>Posturas</TableHead>
              <TableHead>Ovos</TableHead>
              <TableHead>Filhotes</TableHead>
              <TableHead>% Eclosão</TableHead>
              <TableHead>Melhor nota</TableHead>
              <TableHead>COI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.birdId}>
                <TableCell className="text-gray-400 text-sm">{i + 1}</TableCell>
                <TableCell>
                  <Link href={`/birds/${r.birdId}/ficha`}>
                    <span className="font-mono font-bold text-amber-700 hover:underline">{r.ring}</span>
                  </Link>
                  {r.displayTitle && <p className="text-xs text-gray-400 truncate max-w-[160px]">{r.displayTitle}</p>}
                </TableCell>
                <TableCell><SexBadge sex={r.sex} /></TableCell>
                <TableCell>{r.totalClutches}</TableCell>
                <TableCell>{r.totalEggs}</TableCell>
                <TableCell className="font-semibold">{r.totalHatched}</TableCell>
                <TableCell>
                  <span className={r.hatchRate >= 70 ? "text-emerald-700 font-bold" : r.hatchRate >= 40 ? "text-amber-700" : "text-red-600"}>
                    {r.hatchRate.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell>{r.bestScore != null ? <span className="font-semibold">{r.bestScore}</span> : <span className="text-gray-300">—</span>}</TableCell>
                <TableCell><CoiRiskBadge risk={r.coiRisk as any} pct={`${(r.coi * 100).toFixed(1)}%`} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Tab: Mapa de Consanguinidade do Plantel
// ────────────────────────────────────────────────────────────
function TabConsanguinidade() {
  const { data, isLoading } = trpc.reports.mapaConsanguinidade.useQuery();

  if (isLoading) return <div className="text-center py-12 text-gray-400">Analisando o plantel...</div>;
  if (!data) return <div className="text-center py-12 text-gray-400">Sem dados disponíveis.</div>;

  if (data.tooLarge) {
    return (
      <Card>
        <CardContent className="pt-6 text-gray-600 text-sm">
          Seu plantel tem {data.totalActive} pássaros ativos, o que gera {data.totalPairs.toLocaleString("pt-BR")} combinações macho×fêmea —
          acima do limite de {data.maxPairs.toLocaleString("pt-BR")} que processamos de uma vez, pra não travar a tela.
          Fale com o suporte se precisar desse mapa para todo o plantel de uma vez.
        </CardContent>
      </Card>
    );
  }

  const riskColor: Record<string, string> = {
    low: "bg-green-100 text-green-800",
    moderate: "bg-amber-100 text-amber-800",
    high: "bg-orange-100 text-orange-800",
    very_high: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Pássaros ativos analisados</p><p className="text-2xl font-bold">{data.totalActive}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Combinações possíveis</p><p className="text-2xl font-bold">{data.totalPairs}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">COI médio do plantel</p><p className="text-2xl font-bold">{data.plantelAvgCOIPct}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Pares com parentesco relevante</p><p className="text-2xl font-bold text-amber-600">{data.totalRiskyPairs}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gargalos genéticos — ancestrais que mais se repetem</CardTitle>
          <CardDescription>
            Pássaros que aparecem como ancestral comum em muitas combinações do seu plantel. Concentram a base genética —
            considere buscar "sangue novo" sem parentesco com eles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.bottlenecks.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum ancestral comum relevante encontrado — boa diversidade genética no plantel.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anilha</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Aparece em</TableHead>
                  <TableHead>% das combinações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.bottlenecks.map((b) => (
                  <TableRow key={b.ancestorId}>
                    <TableCell className="font-mono font-semibold">{b.ring}</TableCell>
                    <TableCell className="text-sm text-gray-500">{b.displayTitle}</TableCell>
                    <TableCell>{b.pairsAffected} combinação(ões)</TableCell>
                    <TableCell><Badge className="bg-amber-100 text-amber-800">{b.pairsAffectedPct}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Combinações com parentesco a evitar</CardTitle>
          <CardDescription>Todas as combinações macho×fêmea disponíveis com COI acima de 3% — não são casais formados, é o universo de opções possíveis.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.riskyPairs.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma combinação com parentesco relevante — plantel com boa diversidade.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Macho</TableHead>
                  <TableHead>Fêmea</TableHead>
                  <TableHead>COI</TableHead>
                  <TableHead>Risco</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.riskyPairs.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono">{p.maleRing}</TableCell>
                    <TableCell className="font-mono">{p.femaleRing}</TableCell>
                    <TableCell className="font-semibold">{p.coiPct}</TableCell>
                    <TableCell><Badge className={riskColor[p.risk] ?? "bg-gray-100 text-gray-600"}>{p.riskLabel}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Tab: Diversidade Genética do Plantel (Mean Kinship, Ne, Fundadores)
// ────────────────────────────────────────────────────────────
function TabPopulacional() {
  const { data, isLoading } = trpc.reports.geneticaPopulacional.useQuery();

  if (isLoading) return <div className="text-center py-12 text-gray-400">Calculando diversidade genética do plantel...</div>;
  if (!data) return <div className="text-center py-12 text-gray-400">Sem dados disponíveis.</div>;

  if (data.tooLarge) {
    return (
      <Card>
        <CardContent className="pt-6 text-gray-600 text-sm">
          Seu plantel tem {data.totalActive} pássaros ativos, acima do limite de {data.maxActive} que processamos de
          uma vez, pra não travar a tela. Fale com o suporte se precisar desse relatório para todo o plantel de uma vez.
        </CardContent>
      </Card>
    );
  }

  const neColor: Record<string, string> = {
    critical: "bg-red-100 text-red-800 border-red-200",
    low: "bg-amber-100 text-amber-800 border-amber-200",
    healthy: "bg-green-100 text-green-800 border-green-200",
  };
  const neLabel: Record<string, string> = { critical: "Crítico", low: "Baixo", healthy: "Saudável" };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Pássaros ativos analisados</p><p className="text-2xl font-bold">{data.totalActive}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Machos / Fêmeas reprodutores</p><p className="text-2xl font-bold">{data.breedingMales} / {data.breedingFemales}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Tamanho Efetivo (Ne)</p><p className="text-2xl font-bold">{data.effectivePopulationSize}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Mean Kinship médio do plantel</p><p className="text-2xl font-bold">{(data.plantelAverageMeanKinship * 100).toFixed(2)}%</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Saúde genética do plantel
            <Badge className={neColor[data.neStatus] ?? ""}>{neLabel[data.neStatus] ?? data.neStatus}</Badge>
          </CardTitle>
          <CardDescription>{data.neReferenceNote}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500">
            Ne (Tamanho Efetivo da População) é uma estimativa da genética de conservação baseada na proporção de
            machos/fêmeas reprodutores (fórmula de Wright, 1938). Quanto menor o Ne, mais rápido o plantel perde
            variabilidade genética ao longo das gerações — mesmo que o número total de pássaros pareça grande.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fundadores do plantel</CardTitle>
          <CardDescription>
            Pássaros sem pai/mãe cadastrados no sistema — a raiz de cada linhagem conhecida — e o quanto cada um
            contribui geneticamente para o plantel ativo hoje.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.founders.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum fundador identificado (todos os pássaros ativos têm pai e mãe cadastrados).</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anilha</TableHead>
                  <TableHead>Sexo</TableHead>
                  <TableHead>Contribuição no plantel</TableHead>
                  <TableHead>Descendentes ativos</TableHead>
                  <TableHead>Alerta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.founders.map((f) => (
                  <TableRow key={f.founderId}>
                    <TableCell className="font-mono font-semibold">{f.ring}</TableCell>
                    <TableCell>{f.sex}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${f.flag === "dominant" ? "bg-red-500" : "bg-amber-400"}`} style={{ width: `${Math.min(f.averageContribution * 100, 100)}%` }} />
                        </div>
                        <span className="text-xs text-gray-600">{f.averageContributionPct}</span>
                      </div>
                    </TableCell>
                    <TableCell>{f.descendantsInPlantel}</TableCell>
                    <TableCell>
                      {f.flag === "dominant" && <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">Linhagem dominando demais</Badge>}
                      {f.flag === "vanishing" && <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">Linhagem sumindo</Badge>}
                      {!f.flag && <span className="text-gray-300 text-xs">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mean Kinship por pássaro</CardTitle>
          <CardDescription>Quão aparentado cada pássaro é, em média, com o restante do plantel ativo — não com um parceiro específico.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anilha</TableHead>
                <TableHead>Mean Kinship</TableHead>
                <TableHead>Comparado contra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.meanKinshipByBird.slice(0, 30).map((r) => (
                <TableRow key={r.birdId}>
                  <TableCell className="font-mono font-semibold">{r.ring}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${r.meanKinship >= 0.0625 ? "bg-red-400" : "bg-green-500"}`} style={{ width: `${Math.min(r.meanKinship * 100 * 4, 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-600">{r.meanKinshipPct}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-gray-400">{r.comparedAgainst} pássaro(s)</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data.meanKinshipByBird.length > 30 && (
            <p className="text-xs text-gray-400 mt-2">Mostrando os 30 pássaros com maior mean kinship, de {data.meanKinshipByBird.length} no total.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────────
export default function Reports() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Relatórios</h1>
            <p className="text-gray-600 mt-1">Plantel, genética, anilhas, lacunas e confrontos</p>
          </div>
          <Link href="/genetic-report">
            <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
              <Dna className="w-4 h-4 mr-2" />
              Relatório Genético
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="print:hidden flex-wrap">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="plantel">Plantel</TabsTrigger>
            <TabsTrigger value="lacunas">Lacunas</TabsTrigger>
            <TabsTrigger value="anilhas">Anilhas</TabsTrigger>
            <TabsTrigger value="casais">Casais</TabsTrigger>
            <TabsTrigger value="confronto">Confronto Genético</TabsTrigger>
            <TabsTrigger value="consanguinidade">Mapa de Consanguinidade</TabsTrigger>
            <TabsTrigger value="populacional">Diversidade Genética</TabsTrigger>
            <TabsTrigger value="temporada">Temporada</TabsTrigger>
            <TabsTrigger value="indice">Índice</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6"><TabDashboard /></TabsContent>
          <TabsContent value="plantel" className="mt-6"><TabPlantel /></TabsContent>
          <TabsContent value="lacunas" className="mt-6"><TabLacunas /></TabsContent>
          <TabsContent value="anilhas" className="mt-6"><TabAnilhas /></TabsContent>
          <TabsContent value="casais" className="mt-6"><TabCasais /></TabsContent>
          <TabsContent value="confronto" className="mt-6"><TabConfronto /></TabsContent>
          <TabsContent value="consanguinidade" className="mt-6"><TabConsanguinidade /></TabsContent>
          <TabsContent value="populacional" className="mt-6"><TabPopulacional /></TabsContent>
          <TabsContent value="temporada" className="mt-6"><TabTemporada /></TabsContent>
          <TabsContent value="indice" className="mt-6"><TabIndice /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
