/**
 * Linhagem.tsx — Índice de Linhagem + Mapa Genético + Assistente de Cruzamento
 * Rota: /linhagem
 */
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  Trophy, Dna, Heart, AlertTriangle, CheckCircle2, TrendingUp,
  Star, Egg, BarChart3, Zap,
} from "lucide-react";
import { Link } from "wouter";
import { CoiRiskBadge, ScoreBar, PairingStatusBadge } from "@/components/ui-premium";

// ── StatusBadge local (specific to pairing statuses shown here) ─────────────

function StatusBadge({ status }: { status: string }) {
  // Use PairingStatusBadge from premium if it's a pairing status
  if (["ideal","aprovado","atencao","nao_recomendado"].includes(status)) {
    const map: Record<string, any> = { ideal: "ideal", aprovado: "approved", atencao: "caution", nao_recomendado: "not_recommended" };
    return <PairingStatusBadge status={map[status] ?? "caution"} />;
  }
  return <span className="text-xs text-gray-500">{status}</span>;
}

// ── Tab: Índice de Linhagem ──────────────────────────────────────────────────

function TabIndice() {
  const { data, isLoading } = trpc.reports.indice.useQuery();
  const [filter, setFilter] = useState<"todos" | "machos" | "femeas">("todos");

  const rows = (data?.rows ?? []).filter((r) => {
    if (filter === "machos") return r.sex === "macho";
    if (filter === "femeas") return r.sex === "fêmea";
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="machos">Machos</SelectItem>
            <SelectItem value="femeas">Fêmeas</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-400">Indicador estatístico baseado nos dados cadastrados. Não garante resultados futuros.</p>
      </div>
      {isLoading && <p className="text-gray-400 text-sm">Calculando índices...</p>}
      {data && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Anilha</TableHead>
                    <TableHead>Sexo</TableHead>
                    <TableHead>Raça</TableHead>
                    <TableHead>Índice Geral</TableHead>
                    <TableHead>Reprodução</TableHead>
                    <TableHead>Campeão</TableHead>
                    <TableHead>Posturas</TableHead>
                    <TableHead>Eclosões</TableHead>
                    <TableHead>Melhor Nota</TableHead>
                    <TableHead>COI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && <TableRow><TableCell colSpan={11} className="text-center text-gray-400 py-8">Nenhum dado disponível.</TableCell></TableRow>}
                  {rows.slice(0, 50).map((r, i) => (
                    <TableRow key={r.birdId} className={i < 3 ? "bg-amber-50/50" : ""}>
                      <TableCell className="text-xs font-bold text-gray-400">
                        {i < 3 ? <Star className="w-3.5 h-3.5 text-amber-500" /> : i + 1}
                      </TableCell>
                      <TableCell>
                        <Link href={`/birds/${r.birdId}/ficha`} className="text-amber-700 hover:underline font-mono text-sm">{r.ring}</Link>
                        {r.displayTitle && <p className="text-xs text-gray-400 truncate max-w-[120px]">{r.displayTitle}</p>}
                      </TableCell>
                      <TableCell><Badge className={r.sex === "macho" ? "bg-blue-100 text-blue-800 text-xs" : "bg-rose-100 text-rose-800 text-xs"}>{r.sex === "macho" ? "♂" : "♀"}</Badge></TableCell>
                      <TableCell className="text-xs text-gray-500">{r.breedName ?? "—"}</TableCell>
                      <TableCell><ScoreBar value={r.lineageScore} color={r.lineageScore >= 70 ? "bg-green-500" : r.lineageScore >= 40 ? "bg-amber-500" : "bg-gray-400"} /></TableCell>
                      <TableCell><ScoreBar value={r.reproScore} color="bg-blue-400" /></TableCell>
                      <TableCell><ScoreBar value={r.champScore} color="bg-yellow-500" /></TableCell>
                      <TableCell className="text-sm font-semibold">{r.clutchesCount}</TableCell>
                      <TableCell className="text-sm">{r.totalHatched}</TableCell>
                      <TableCell className="text-sm">{r.bestScore !== null ? <span className="font-semibold">{r.bestScore}</span> : <span className="text-gray-300">—</span>}</TableCell>
                      <TableCell><CoiRiskBadge risk={r.coiRisk} /></TableCell>
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

// ── Tab: Mapa Genético ───────────────────────────────────────────────────────

function TabMapaGenetico() {
  const { data, isLoading } = trpc.reports.mapaGenetico.useQuery();
  return (
    <div className="space-y-4">
      {isLoading && <p className="text-gray-400 text-sm">Analisando plantel...</p>}
      {data && (
        <>
          {data.alerts.length > 0 && (
            <div className="space-y-2">
              {data.alerts.map((a, i) => (
                <div key={i} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0" />{a}
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              ["Total ativo", data.total, "text-gray-700"],
              ["Com genótipo", data.withGenotype, "text-green-700"],
              ["Sem genótipo", data.withoutGenotype, "text-amber-700"],
              ["Com pais", data.withParents, "text-blue-700"],
              ["Sem pais", data.withoutParents, "text-orange-700"],
              ["COI alto", data.highCoiBirds, data.highCoiBirds > 0 ? "text-red-700" : "text-gray-400"],
            ].map(([l, v, c]) => (
              <Card key={String(l)}>
                <CardContent className="p-4"><p className="text-xs text-gray-400 mb-1">{l}</p><p className={`text-2xl font-bold ${c}`}>{v}</p></CardContent>
              </Card>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Genes visuais mais frequentes</CardTitle></CardHeader>
              <CardContent>
                {data.topGenes.length === 0
                  ? <p className="text-gray-400 text-xs">Nenhum gene registrado</p>
                  : data.topGenes.map((g) => (
                    <div key={g.gene} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-700">{g.gene}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${(g.count / data.total) * 100}%` }} /></div>
                        <span className="text-xs text-gray-500 font-mono w-6 text-right">{g.count}</span>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Portadores mais frequentes</CardTitle></CardHeader>
              <CardContent>
                {data.topCarriers.length === 0
                  ? <p className="text-gray-400 text-xs">Nenhum portador registrado</p>
                  : data.topCarriers.map((g) => (
                    <div key={g.gene} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-700">{g.gene}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-400 rounded-full" style={{ width: `${(g.count / data.total) * 100}%` }} /></div>
                        <span className="text-xs text-gray-500 font-mono w-6 text-right">{g.count}</span>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Por Modalidade</CardTitle></CardHeader>
              <CardContent>
                {Object.entries(data.byModality).map(([mod, count]) => (
                  <div key={mod} className="flex justify-between py-1 border-b border-gray-50 last:border-0 text-sm">
                    <span className="text-gray-600">{mod || "—"}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Por Sexo</CardTitle></CardHeader>
              <CardContent>
                {Object.entries(data.bySex).map(([sex, count]) => (
                  <div key={sex} className="flex justify-between py-1 border-b border-gray-50 last:border-0 text-sm">
                    <span className={sex === "macho" ? "text-blue-700" : sex === "fêmea" ? "text-rose-700" : "text-gray-500"}>{sex === "macho" ? "♂ Machos" : sex === "fêmea" ? "♀ Fêmeas" : sex}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab: Assistente de Cruzamento ────────────────────────────────────────────

const OBJETIVOS = [
  { value: "seguranca", label: "Reprodução segura" },
  { value: "reduzir_coi", label: "Reduzir consanguinidade" },
  { value: "cor", label: "Melhorar cor" },
  { value: "porte", label: "Melhorar porte" },
  { value: "linhagem", label: "Manter linhagem" },
  { value: "portadores", label: "Produzir portadores" },
  { value: "exposicao", label: "Preparar exposição" },
  { value: "livre", label: "Planejamento livre" },
] as const;

function TabAssistente() {
  const [birdId, setBirdId] = useState("");
  const [objetivo, setObjetivo] = useState<string>("seguranca");
  const [run, setRun] = useState(false);

  const { data: allBirds } = trpc.birds.list.useQuery({});
  const { data, isLoading } = trpc.reports.assistenteCruzamento.useQuery(
    { birdId: Number(birdId), objetivo: objetivo as any, maxResults: 10 },
    { enabled: run && !!birdId }
  );

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-amber-600" />Assistente de Cruzamento</CardTitle>
          <CardDescription>O sistema sugere pares ideais com base no objetivo escolhido, COI, genética e alertas de risco.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Pássaro base</p>
              <Select value={birdId} onValueChange={(v) => { setBirdId(v); setRun(false); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o pássaro" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {(allBirds ?? []).map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.ring}{b.displayTitle ? ` — ${b.displayTitle}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Objetivo</p>
              <Select value={objetivo} onValueChange={(v) => { setObjetivo(v); setRun(false); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OBJETIVOS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={() => { setRun(false); setTimeout(() => setRun(true), 0); }} disabled={!birdId || isLoading} className="bg-amber-600 hover:bg-amber-700">
            <Zap className="w-4 h-4 mr-1.5" />
            {isLoading ? "Analisando..." : "Buscar pares ideais"}
          </Button>
        </CardContent>
      </Card>

      {data && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">Resultado para <span className="font-semibold text-gray-700">{data.baseBird.ring}</span> · Objetivo: {OBJETIVOS.find((o) => o.value === data.objetivo)?.label}</p>
          {data.candidates.map((c, i) => (
            <div key={c.birdId} className={`border rounded-xl p-4 ${c.status === "nao_recomendado" ? "border-red-200 bg-red-50" : c.status === "ideal" ? "border-green-200 bg-green-50" : "border-gray-100 bg-white"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs text-gray-400 font-mono">{i + 1}.</span>
                    <Link href={`/birds/${c.birdId}/ficha`} className="font-mono font-semibold text-sm text-amber-700 hover:underline">{c.ring}</Link>
                    <StatusBadge status={c.status} />
                    <CoiRiskBadge risk={c.coiRisk === "very_high" ? "high" : (c.coiRisk as any)} />
                    <span className="text-xs text-gray-400">COI {c.coiPct}</span>
                  </div>
                  {c.displayTitle && <p className="text-xs text-gray-500 mb-1">{c.displayTitle}</p>}
                  <p className="text-sm text-gray-700">{c.motivo}</p>
                  {c.alerts.length > 0 && c.alerts.map((a, j) => (
                    <p key={j} className="text-xs text-red-700 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{a}</p>
                  ))}
                </div>
                <div className="shrink-0 text-right">
                  <ScoreBar value={c.score} color={c.score >= 80 ? "bg-green-500" : c.score >= 60 ? "bg-amber-500" : "bg-gray-400"} />
                  {c.status !== "nao_recomendado" && (
                    <Link href="/couples">
                      <Button variant="outline" size="sm" className="mt-2 text-xs h-7">Criar casal</Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: COI Avançado ────────────────────────────────────────────────────────

function TabCoiAvancado() {
  const [maleId, setMaleId] = useState("");
  const [femaleId, setFemaleId] = useState("");
  const [maxGen, setMaxGen] = useState("5");
  const [run, setRun] = useState(false);
  const [showTech, setShowTech] = useState(false);

  const { data: allBirds } = trpc.birds.list.useQuery({});
  const males = (allBirds ?? []).filter((b) => b.sex === "macho");
  const females = (allBirds ?? []).filter((b) => b.sex === "fêmea");

  const { data, isLoading } = trpc.reports.coiAvancado.useQuery(
    { maleId: Number(maleId), femaleId: Number(femaleId), maxGen: Number(maxGen) },
    { enabled: run && !!maleId && !!femaleId }
  );

  const riskColor: Record<string, string> = {
    low: "text-green-700 bg-green-50 border-green-200",
    moderate: "text-amber-700 bg-amber-50 border-amber-200",
    high: "text-red-700 bg-red-50 border-red-200",
    very_high: "text-red-900 bg-red-100 border-red-300",
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Dna className="w-4 h-4 text-purple-600" />COI Avançado com Ancestrais Comuns</CardTitle>
          <CardDescription>Identifica ancestrais repetidos, calcula contribuição de cada um e explica o risco.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Macho</p>
              <Select value={maleId} onValueChange={(v) => { setMaleId(v); setRun(false); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="max-h-64">{males.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.ring}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Fêmea</p>
              <Select value={femaleId} onValueChange={(v) => { setFemaleId(v); setRun(false); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="max-h-64">{females.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.ring}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Gerações</p>
              <Select value={maxGen} onValueChange={(v) => { setMaxGen(v); setRun(false); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[3,4,5,6].map((n) => <SelectItem key={n} value={String(n)}>{n} gerações</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={() => { setRun(false); setTimeout(() => setRun(true), 0); }} disabled={!maleId || !femaleId || isLoading} className="bg-purple-600 hover:bg-purple-700">
            <Dna className="w-4 h-4 mr-1.5" />{isLoading ? "Calculando..." : "Calcular COI"}
          </Button>
        </CardContent>
      </Card>

      {data && (
        <div className="space-y-4">
          <div className={`rounded-xl border-2 p-5 ${riskColor[data.risk]}`}>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-4xl font-bold font-mono">{data.coiPct}</p>
                <p className="text-sm font-semibold mt-1">{data.riskLabel}</p>
              </div>
              {data.risk === "low" ? <CheckCircle2 className="w-8 h-8 opacity-60" /> : <AlertTriangle className="w-8 h-8 opacity-60" />}
            </div>
          </div>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-700 leading-relaxed">{data.explanationSimple}</p>
            </CardContent>
          </Card>

          {data.commonAncestors.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Ancestrais Comuns ({data.commonAncestors.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(data.commonAncestors as any[]).map((a) => (
                    <div key={a.ancestorId} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                      <div>
                        <span className="font-mono font-semibold text-gray-800">{a.ancestorRing}</span>
                        {a.displayTitle && <span className="text-xs text-gray-400 ml-2">{a.displayTitle}</span>}
                        <p className="text-xs text-gray-400 mt-0.5">Linha paterna: gen. {a.sireDistances.join(",")} · Linha materna: gen. {a.damDistances.join(",")}</p>
                      </div>
                      <Badge className="bg-purple-100 text-purple-800 text-xs shrink-0 ml-2">{a.contributionPct}%</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <button onClick={() => setShowTech(!showTech)} className="text-xs text-gray-400 hover:text-gray-600 underline">
            {showTech ? "Ocultar" : "Ver"} explicação técnica (Fórmula de Wright)
          </button>
          {showTech && (
            <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 border border-gray-100 overflow-x-auto whitespace-pre-wrap font-mono">{data.explanationTechnical}</pre>
          )}
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Linhagem() {
  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Linhagem & Genética</h1>
          <p className="text-gray-500 mt-1">Índice de linhagem, mapa genético, COI avançado e assistente de cruzamento</p>
        </div>
        <Tabs defaultValue="indice">
          <TabsList className="flex-wrap">
            <TabsTrigger value="indice"><Trophy className="w-4 h-4 mr-1.5" />Índice de Linhagem</TabsTrigger>
            <TabsTrigger value="mapa"><Dna className="w-4 h-4 mr-1.5" />Mapa Genético</TabsTrigger>
            <TabsTrigger value="coi"><BarChart3 className="w-4 h-4 mr-1.5" />COI Avançado</TabsTrigger>
            <TabsTrigger value="assistente"><Zap className="w-4 h-4 mr-1.5" />Assistente de Cruzamento</TabsTrigger>
          </TabsList>
          <TabsContent value="indice" className="mt-5"><TabIndice /></TabsContent>
          <TabsContent value="mapa" className="mt-5"><TabMapaGenetico /></TabsContent>
          <TabsContent value="coi" className="mt-5"><TabCoiAvancado /></TabsContent>
          <TabsContent value="assistente" className="mt-5"><TabAssistente /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
