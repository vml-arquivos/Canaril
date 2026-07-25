/**
 * GeneticsCalculator.tsx — Calculadora Genética Profissional
 *
 * 6 modos:
 *   Par Ideal          — encontra o melhor parceiro no plantel
 *   Casal do Plantel   — analisa dois pássaros reais (Relatório completo)
 *   Modo Guiado        — passo a passo sem termos técnicos
 *   Modo Técnico       — Punnett quadrado com todas as 18 mutações
 *   Comparar Cenários  — compara até 4 cruzamentos lado a lado
 *   Referência         — catálogo genético completo
 */
import { useState, useMemo, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  Calculator, AlertTriangle, Dna, Zap, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle, BookOpen, Users, Sparkles, XCircle, ArrowRight, Printer,
  Star, TrendingUp, Shield, Info, Heart, FlaskConical, GitCompare, Layers,
} from "lucide-react";
import { InlineAlert, HelpTooltip, ScoreBar, CoiRiskBadge } from "@/components/ui-premium";
import { Link, useLocation } from "wouter";

// ─── Constants ─────────────────────────────────────────────────────────────

const NONE = "__none__";

const ZYGOSITY_SL_M = [
  { value: "Z+Z+", label: "Z⁺Z⁺ — Visual homozigoto" },
  { value: "Z+Z-", label: "Z⁺Z⁻ — Portador (heterozigoto)" },
  { value: "Z-Z-", label: "Z⁻Z⁻ — Normal" },
];
const ZYGOSITY_SL_F = [
  { value: "Z+W", label: "Z⁺W — Visual (fêmea manifesta)" },
  { value: "Z-W", label: "Z⁻W — Normal" },
];
const ZYGOSITY_AR = [
  { value: "mm", label: "mm — Visual (homozigoto)" },
  { value: "Nm", label: "Nm — Portador" },
  { value: "NN", label: "NN — Normal" },
];
const ZYGOSITY_DOM = [
  { value: "nn", label: "nn — Não visual" },
  { value: "Nn", label: "Nn — Visual dose simples" },
  { value: "NN", label: "NN — Visual dose dupla (⚠️ letal em crista/BD)" },
];

const STATUS_CONFIG = {
  IDEAL:              { label: "Ideal",                  color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle },
  APROVADO:           { label: "Aprovado",               color: "bg-blue-100 text-blue-800 border-blue-300",     icon: CheckCircle },
  ATENCAO:            { label: "Aprovado com atenção",   color: "bg-amber-100 text-amber-800 border-amber-300",  icon: AlertTriangle },
  NAO_RECOMENDADO:    { label: "Não recomendado",        color: "bg-red-100 text-red-800 border-red-300",        icon: XCircle },
  DADOS_INSUFICIENTES:{ label: "Dados insuficientes",    color: "bg-gray-100 text-gray-600 border-gray-300",     icon: Info },
  RISCO_LETAL:        { label: "Risco letal",            color: "bg-red-200 text-red-900 border-red-400",        icon: XCircle },
  SEM_DADOS:          { label: "Sem dados",              color: "bg-gray-100 text-gray-500 border-gray-200",     icon: Info },
} as const;

const CONFIDENCE_CONFIG = {
  Alta:   { color: "text-green-700 bg-green-50 border-green-200" },
  Média:  { color: "text-amber-700 bg-amber-50 border-amber-200" },
  Baixa:  { color: "text-red-700 bg-red-50 border-red-200" },
} as const;

// ─── Shared components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DADOS_INSUFICIENTES;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${cfg.color}`}>
      <Icon className="w-4 h-4" />{cfg.label}
    </span>
  );
}

function ConfidenceBadge({ level }: { level: string }) {
  const cfg = CONFIDENCE_CONFIG[level as keyof typeof CONFIDENCE_CONFIG]
    ?? { color: "text-gray-600 bg-gray-50 border-gray-200" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
      Confiança {level}
    </span>
  );
}

function ProbBar({ value, label, sublabel, color }: {
  value: number; label: string; sublabel?: string; color: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-3">
        <div className="w-44 text-sm text-gray-700 shrink-0">{label}</div>
        <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-12 text-sm font-bold text-right font-mono">{pct}%</span>
      </div>
      {sublabel && <p className="text-xs text-gray-400 ml-44 pl-3 font-mono">{sublabel}</p>}
    </div>
  );
}

function PunnettGrid({ sons, daughters, offspring, inheritance }: {
  sons?: Record<string, number>;
  daughters?: Record<string, number>;
  offspring?: Record<string, number>;
  inheritance: string;
}) {
  if (inheritance === "sex_linked" && sons && daughters) {
    const alleles = { male: ["Z+", "Z-"], female: ["Z+", "W"] };
    const grid = [
      [sons["Z+Z+"] ?? 0, sons["Z+Z-"] ?? 0],
      [daughters["Z+W"] ?? 0, daughters["Z-W"] ?? 0],
    ];
    const rowLabels = ["♂ (Z+)", "♂ (Z-)"];
    const colLabels = ["♀ (Z+)", "♀ (W)"];
    const cellLabel = (row: number, col: number) => {
      if (row === 0 && col === 0) return "Z+Z+ (visual ♂)";
      if (row === 0 && col === 1) return "Z+W (visual ♀)";
      if (row === 1 && col === 0) return "Z+Z- (portador ♂)";
      return "Z-W (normal ♀)";
    };
    const cellColor = (row: number, col: number) => {
      if (row === 0 && col === 0) return "bg-amber-100 border-amber-300";
      if (row === 0 && col === 1) return "bg-amber-100 border-amber-300";
      if (row === 1 && col === 0) return "bg-blue-50 border-blue-200";
      return "bg-gray-50 border-gray-200";
    };
    return (
      <div className="mt-2">
        <p className="text-xs text-gray-400 mb-1.5 font-medium">Quadro de Punnett</p>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse min-w-full">
            <thead>
              <tr>
                <th className="w-8 h-8"></th>
                {colLabels.map((l) => (
                  <th key={l} className="px-2 py-1 text-center text-rose-700 font-semibold border border-gray-200 bg-rose-50">{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowLabels.map((rl, ri) => (
                <tr key={rl}>
                  <td className="px-2 py-1 text-center text-blue-700 font-semibold border border-gray-200 bg-blue-50">{rl}</td>
                  {colLabels.map((_, ci) => (
                    <td key={ci} className={`px-2 py-1.5 text-center border ${cellColor(ri, ci)} leading-tight`}>
                      <div className="font-mono text-xs">{cellLabel(ri, ci).split(" ")[0]}</div>
                      <div className="text-gray-500">{Math.round(grid[ri][ci] * 100)}%</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (inheritance === "autosomal_recessive" && offspring) {
    const states = ["NN", "Nm", "mm"];
    const labels: Record<string, string> = { NN: "Normal", Nm: "Portador", mm: "Visual" };
    const colors: Record<string, string> = { NN: "bg-gray-50 border-gray-200", Nm: "bg-blue-50 border-blue-200", mm: "bg-amber-100 border-amber-300" };
    const rows = ["N", "m"];
    const grid = [
      [offspring["NN"] ?? 0, offspring["Nm"] ?? 0],
      [offspring["Nm"] ?? 0, offspring["mm"] ?? 0],
    ];
    return (
      <div className="mt-2">
        <p className="text-xs text-gray-400 mb-1.5 font-medium">Quadro de Punnett</p>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="w-8 h-8"></th>
                {rows.map((l) => <th key={l} className="px-3 py-1 text-center text-rose-700 font-semibold border border-gray-200 bg-rose-50">{l}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((rl, ri) => (
                <tr key={rl}>
                  <td className="px-3 py-1 text-center text-blue-700 font-semibold border border-gray-200 bg-blue-50">{rl}</td>
                  {rows.map((_, ci) => {
                    const geno = ri === 0 && ci === 0 ? "NN" : (ri === 1 && ci === 1) ? "mm" : "Nm";
                    return (
                      <td key={ci} className={`px-2 py-1.5 text-center border ${colors[geno]} leading-tight`}>
                        <div className="font-mono">{geno}</div>
                        <div className="text-gray-500 text-xs">{labels[geno]}</div>
                        <div className="text-gray-400 text-xs">{Math.round((grid[ri][ci]) * 100)}%</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (inheritance === "autosomal_dominant" && offspring) {
    const states = ["nn", "Nn", "NN"];
    const labels: Record<string, string> = { nn: "Normal", Nn: "Visual (het)", NN: "⚠️ Homozigoto" };
    const colors: Record<string, string> = { nn: "bg-gray-50 border-gray-200", Nn: "bg-amber-100 border-amber-300", NN: "bg-red-100 border-red-300" };
    return (
      <div className="mt-2">
        <p className="text-xs text-gray-400 mb-1.5 font-medium">Distribuição de Punnett (dominante)</p>
        <div className="flex gap-2 flex-wrap">
          {states.filter((s) => (offspring[s] ?? 0) > 0).map((s) => (
            <div key={s} className={`border rounded px-3 py-2 text-center ${colors[s]}`}>
              <div className="font-mono text-sm font-bold">{s}</div>
              <div className="text-xs text-gray-600">{labels[s]}</div>
              <div className="text-sm font-bold mt-0.5">{Math.round((offspring[s] ?? 0) * 100)}%</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

function MutResultCard({ result }: { result: any }) {
  const [open, setOpen] = useState(false);
  const [showPunnett, setShowPunnett] = useState(false);
  const hasWarn = (result.warnings?.length ?? 0) > 0;
  return (
    <Card className={`border-2 ${hasWarn ? "border-red-200 bg-red-50" : "border-gray-100"}`}>
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{result.label}</span>
          <Badge className="text-xs border bg-gray-50 text-gray-600 border-gray-200">
            {result.inheritanceLabel}
          </Badge>
          {hasWarn && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
          <button
            onClick={() => setShowPunnett((v) => !v)}
            className="ml-auto text-xs text-blue-600 underline"
          >
            {showPunnett ? "Ocultar Punnett" : "Ver Punnett"}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {result.warnings?.map((w: string, i: number) => (
          <div key={i} className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg p-2 flex gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-600" />{w}
          </div>
        ))}

        {showPunnett && (
          <PunnettGrid
            sons={result.sons}
            daughters={result.daughters}
            offspring={result.offspring}
            inheritance={result.inheritance}
          />
        )}

        {result.sons && result.daughters && (
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: "♂ Filhos machos", data: result.sons, isSons: true },
              { label: "♀ Filhas fêmeas", data: result.daughters, isSons: false },
            ].map(({ label, data, isSons }) => (
              <div key={label}>
                <p className={`text-xs font-semibold mb-1.5 ${isSons ? "text-blue-700" : "text-rose-700"}`}>{label}</p>
                <div className="space-y-1.5">
                  {Object.entries(data as Record<string, number>)
                    .filter(([, p]) => p > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([g, p]) => (
                      <ProbBar key={g} value={p} sublabel={g}
                        label={
                          isSons
                            ? g === "Z+Z+" ? "Visual homozigoto" : g === "Z+Z-" ? "Portador" : "Normal"
                            : g === "Z+W" ? "Visual" : "Normal"
                        }
                        color={
                          isSons
                            ? g === "Z+Z+" ? "bg-amber-500" : g === "Z+Z-" ? "bg-blue-400" : "bg-gray-300"
                            : g === "Z+W" ? "bg-amber-500" : "bg-gray-300"
                        }
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {result.offspring && (
          <div className="space-y-1.5">
            {Object.entries(result.offspring as Record<string, number>)
              .filter(([, p]) => p > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([g, p]) => {
                const isAR = result.inheritance === "autosomal_recessive";
                const visual = isAR ? g === "mm" : g === "Nn" || g === "NN";
                const lethal = g === "NN" && !isAR;
                const label = isAR
                  ? g === "mm" ? "Visual" : g === "Nm" ? "Portador" : "Normal"
                  : g === "NN" ? "⚠️ Dose dupla (letal)" : g === "Nn" ? "Visual" : "Não visual";
                return (
                  <ProbBar key={g} value={p} sublabel={g} label={label}
                    color={lethal ? "bg-red-500" : visual && !isAR ? "bg-amber-500"
                      : g === "mm" ? "bg-amber-500" : g === "Nm" ? "bg-blue-400" : "bg-gray-300"}
                  />
                );
              })}
          </div>
        )}
        {result.explanation && (
          <>
            <button type="button" onClick={() => setOpen(!open)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {open ? "Ocultar" : "Ver"} explicação técnica
            </button>
            {open && (
              <pre className="text-xs text-gray-600 bg-white rounded-lg p-3 border border-gray-100 whitespace-pre-wrap font-sans">
                {result.explanation}
              </pre>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── MutationSelector (shared) ───────────────────────────────────────────────

function MutSelector({ mutations, sex, selected, genotypes, onToggle, onGeno }: {
  mutations: any[]; sex: "macho" | "fêmea";
  selected: Set<string>; genotypes: Record<string, string>;
  onToggle: (id: string) => void; onGeno: (id: string, v: string) => void;
}) {
  const groups = [
    { key: "sex_linked",          label: "Ligadas ao sexo (Z)",   color: "text-rose-700" },
    { key: "autosomal_recessive", label: "Autossômicas recessivas", color: "text-blue-700" },
    { key: "autosomal_dominant",  label: "Autossômicas dominantes", color: "text-purple-700" },
  ];
  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const muts = mutations.filter((m) => m.inheritance === g.key);
        if (!muts.length) return null;
        return (
          <div key={g.key}>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${g.color}`}>{g.label}</p>
            <div className="space-y-1.5">
              {muts.map((m) => {
                const isSel = selected.has(m.id);
                const opts = g.key === "sex_linked"
                  ? (sex === "macho" ? ZYGOSITY_SL_M : ZYGOSITY_SL_F)
                  : g.key === "autosomal_recessive" ? ZYGOSITY_AR : ZYGOSITY_DOM;
                return (
                  <div key={m.id} className={`rounded-lg border transition-all ${isSel ? "border-amber-300 bg-amber-50" : "border-gray-100"}`}>
                    <label className="flex items-center gap-2 p-2 cursor-pointer">
                      <input type="checkbox" checked={isSel} onChange={() => onToggle(m.id)} className="rounded border-gray-300" />
                      <span className="text-sm font-medium text-gray-800 flex-1">{m.label}</span>
                      <HelpTooltip text={m.description} technical={m.phenotypeEffect} />
                      {m.isLethalHomozygous && <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 shrink-0">Letal</span>}
                    </label>
                    {isSel && (
                      <div className="px-2 pb-2">
                        <Select value={genotypes[m.id] ?? NONE} onValueChange={(v) => onGeno(m.id, v === NONE ? "" : v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Genótipo..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>— Selecione —</SelectItem>
                            {opts.map((o) => <SelectItem key={o.value} value={o.value}><span className="font-mono mr-2">{o.value}</span> {o.label.split("—")[1]?.trim()}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 1. PAR IDEAL ────────────────────────────────────────────────────────────

function ParIdeal() {
  const [birdId, setBirdId]       = useState("");
  const [objective, setObjective] = useState<string>("linhagem");
  const { data: allBirds } = trpc.birds.list.useQuery({});
  const { data, isLoading } = trpc.genetics.recommendPairing.useQuery(
    { birdId: Number(birdId), objective: objective as any },
    { enabled: !!birdId }
  );

  const OBJECTIVES = [
    { value: "linhagem",    label: "Preservar linhagem" },
    { value: "cor",         label: "Melhorar cor" },
    { value: "porte",       label: "Melhorar porte" },
    { value: "show",        label: "Preparar para exposição" },
    { value: "diversidade", label: "Aumentar diversidade genética" },
    { value: "portadores",  label: "Produzir portadores" },
  ];

  return (
    <div className="space-y-5">
      <InlineAlert variant="info">
        O sistema avalia <strong>genética (Punnett), COI, histórico reprodutivo e objetivo</strong> — retornando os melhores pares ranqueados por pontuação (0–100).
      </InlineAlert>

      <div className="space-y-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 mb-1.5">Pássaro base</p>
          <Select value={birdId} onValueChange={setBirdId}>
            <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Selecione o pássaro" /></SelectTrigger>
            <SelectContent className="max-h-64 w-[min(480px,90vw)]">
              {(allBirds ?? []).map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-semibold shrink-0">{b.ring}</span>
                    <span className="text-gray-400 text-xs truncate max-w-[280px]">
                      {b.sex === "macho" ? "♂" : "♀"}{b.displayTitle ? ` · ${b.displayTitle}` : ""}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 mb-1.5">Objetivo do cruzamento</p>
          <Select value={objective} onValueChange={setObjective}>
            <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {OBJECTIVES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-8 text-gray-400 text-sm animate-pulse">
          Analisando plantel com 6 critérios…
        </div>
      )}

      {data && (
        <div className="space-y-3">
          {data.totalEvaluated > 0 && (
            <p className="text-xs text-gray-400">
              {data.candidates.length} melhores de {data.totalEvaluated} avaliados ·{" "}
              objetivo: <span className="font-medium">{OBJECTIVES.find(o => o.value === data.objective)?.label}</span>
            </p>
          )}
          {data.candidates.length === 0 ? (
            <InlineAlert variant="warning">
              Nenhum candidato disponível. Verifique se há pássaros do sexo oposto com status ativo.
            </InlineAlert>
          ) : (
            data.candidates.map((c: any, i: number) => (
              <Card key={c.id} className={`border-2 transition-colors ${
                i === 0 ? "border-emerald-300 bg-emerald-50/60"
                : (c.coiRisk === "high" ? "border-red-200" : "border-gray-100 hover:border-gray-200")
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {i === 0 && <Star className="w-4 h-4 text-amber-500 shrink-0" />}
                        <Link href={`/birds/${c.id}/ficha`}>
                          <span className="font-mono font-bold text-amber-700 hover:underline">{c.ring}</span>
                        </Link>
                        <CoiRiskBadge risk={c.coiRisk} pct={c.coiPct} />
                        {!c.hasGenotype && (
                          <span className="text-xs text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">Sem genótipo</span>
                        )}
                      </div>
                      {c.displayTitle && (
                        <p className="text-xs text-gray-500 mb-1.5 truncate">{c.displayTitle}</p>
                      )}

                      {/* Score breakdown */}
                      <div className="flex gap-1.5 flex-wrap mt-1 mb-1.5">
                        <span className="text-xs text-purple-700 bg-purple-50 border border-purple-100 rounded px-1.5 py-0.5">
                          Genética {c.geneticScore}/35
                        </span>
                        <span className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">
                          COI {c.coiScore}/20
                        </span>
                      </div>

                      {c.reasons?.length > 0 && (
                        <div className="space-y-0.5">
                          {c.reasons.slice(0, 2).map((r: string, j: number) => (
                            <p key={j} className="text-xs text-emerald-700 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 shrink-0" />{r}
                            </p>
                          ))}
                        </div>
                      )}
                      {c.warnings?.length > 0 && (
                        <div className="space-y-0.5 mt-0.5">
                          {c.warnings.slice(0, 2).map((w: string, j: number) => (
                            <p key={j} className="text-xs text-amber-700 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />{w}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold text-gray-900">{c.finalScore}</p>
                      <p className="text-xs text-gray-400">/ 100</p>
                      <ScoreBar value={c.finalScore} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}


// ─── 2. CASAL DO PLANTEL + RELATÓRIO ─────────────────────────────────────────

function CasalPlantel() {
  const [maleId, setMaleId] = useState("");
  const [femaleId, setFemaleId] = useState("");
  const [showTech, setShowTech] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const { data: allBirds } = trpc.birds.list.useQuery({});
  const males   = (allBirds ?? []).filter((b) => b.sex === "macho");
  const females = (allBirds ?? []).filter((b) => b.sex === "fêmea");

  const { data: report, isLoading } = trpc.genetics.buildCrossReport.useQuery(
    { maleId: Number(maleId), femaleId: Number(femaleId) },
    { enabled: !!maleId && !!femaleId }
  );

  const handlePrint = () => window.print();

  return (
    <div className="space-y-5">
      {/* Selects empilhados sempre — evita sobreposição de texto longo */}
      <div className="space-y-3">
        {[
          { label: "♂ Macho", list: males, val: maleId, set: setMaleId },
          { label: "♀ Fêmea", list: females, val: femaleId, set: setFemaleId },
        ].map(({ label, list, val, set }) => (
          <div key={label} className="min-w-0">
            <p className="text-xs text-gray-500 mb-1.5">{label}</p>
            <Select value={val} onValueChange={set}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {list.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    <span className="font-mono font-semibold">{b.ring}</span>
                    {b.displayTitle && (
                      <span className="text-gray-400 ml-2 text-xs">
                        {/* Truncar displayTitle longo para evitar overflow */}
                        {b.displayTitle.length > 60
                          ? b.displayTitle.slice(0, 60) + "…"
                          : b.displayTitle}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {val && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {list.find((b) => String(b.id) === val)?.displayTitle ?? ""}
              </p>
            )}
          </div>
        ))}
      </div>

      {isLoading && <div className="text-center py-8 text-gray-400 text-sm">Analisando cruzamento...</div>}

      {report && (
        <div className="space-y-4" ref={printRef}>
          {/* Header do relatório */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge status={report.status as any} />
              <ConfidenceBadge level={report.confidenceLabel} />
            </div>
            <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden gap-2">
              <Printer className="w-4 h-4" />Imprimir relatório
            </Button>
          </div>

          {/* Pais */}
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { data: report.male, label: "♂ Macho", color: "border-blue-100" },
              { data: report.female, label: "♀ Fêmea", color: "border-rose-100" },
            ].map(({ data, label, color }) => (
              <Card key={label} className={`border-2 ${color}`}>
                <CardContent className="p-3">
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className="font-mono font-bold text-gray-900 text-lg">{data.ring}</p>
                  {data.displayTitle && <p className="text-sm text-gray-600">{data.displayTitle}</p>}
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    {data.modality && <Badge className="text-xs bg-gray-50 text-gray-600 border-gray-200 border">{data.modality}</Badge>}
                    {data.breedName && <Badge className="text-xs bg-gray-50 text-gray-600 border-gray-200 border">{data.breedName}</Badge>}
                    <Badge className={`text-xs border ${data.hasGenotype ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                      {data.hasGenotype ? "✓ Com genótipo" : "Sem genótipo"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* COI */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">COI — Coeficiente de Consanguinidade</span>
                <HelpTooltip text="Mede o grau de parentesco. Quanto maior, maior o risco genético para os filhotes." technical="Fórmula de Wright aplicada sobre 6 gerações de pedigree." />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-3xl font-bold font-mono">{report.coiPct}</span>
                <CoiRiskBadge risk={report.coiRisk} />
              </div>
            </CardContent>
          </Card>

          {/* Alertas */}
          {report.warnings.length > 0 && (
            <div className="space-y-2">
              {report.warnings.map((w, i) => (
                <InlineAlert key={i} variant={w.includes("⚠️") || w.includes("LETAL") ? "error" : "warning"}>{w}</InlineAlert>
              ))}
            </div>
          )}

          {/* Lacunas */}
          {report.missingData.length > 0 && (
            <Card className="border-amber-200">
              <CardContent className="pt-3 pb-3">
                <p className="text-xs font-semibold text-amber-700 mb-1.5">Dados faltando para maior precisão:</p>
                <div className="space-y-0.5">
                  {report.missingData.map((m, i) => (
                    <p key={i} className="text-xs text-amber-700 flex items-center gap-1.5">
                      <Info className="w-3 h-3 shrink-0" />{m}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recomendações */}
          {report.recommendations.length > 0 && (
            <div className="space-y-1">
              {report.recommendations.map((r, i) => (
                <p key={i} className="text-sm text-blue-800 flex items-start gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />{r}
                </p>
              ))}
            </div>
          )}

          {/* Detalhamento técnico (recolhível) */}
          {report.colorResult && (
            <div>
              <button type="button" onClick={() => setShowTech(!showTech)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-3">
                <FlaskConical className="w-4 h-4" />
                {showTech ? "Ocultar" : "Ver"} detalhamento genético técnico
                {showTech ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showTech && (
                <div className="space-y-3">
                  {Object.values(report.colorResult.byMutation as Record<string, any>).map((m: any) => (
                    <MutResultCard key={m.mutationId} result={m} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 3. MODO GUIADO ──────────────────────────────────────────────────────────

const GUIADO_STEPS = [
  { id: "birds", label: "1. Escolher pássaros" },
  { id: "objetivo", label: "2. Definir objetivo" },
  { id: "resultado", label: "3. Ver resultado" },
];
const OBJETIVOS = [
  { value: "REDUCAO_COI",   icon: "🔬", label: "Reduzir parentesco",    desc: "Prioriza pares sem parentes em comum" },
  { value: "REPRODUCAO",    icon: "🥚", label: "Reprodução segura",      desc: "Foca em evitar riscos letais e problemas" },
  { value: "MELHORAR_COR",  icon: "🎨", label: "Melhorar cor",           desc: "Busca pares que favoreçam cor desejada" },
  { value: "MELHORAR_PORTE",icon: "📏", label: "Melhorar porte",         desc: "Foca em conformação e tamanho" },
  { value: "EXPOSICAO",     icon: "🏆", label: "Preparar exposição",     desc: "Maximiza porte e classe oficial" },
  { value: "LIVRE",         icon: "⚖️",  label: "Melhor geral",           desc: "Equilibra todos os critérios" },
];

function ModoGuiado() {
  const [step, setStep] = useState(0);
  const [, setLocation] = useLocation();
  const [maleId, setMaleId] = useState("");
  const [femaleId, setFemaleId] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [showTech, setShowTech] = useState(false);
  const { data: allBirds } = trpc.birds.list.useQuery({});
  const males   = (allBirds ?? []).filter((b) => b.sex === "macho");
  const females = (allBirds ?? []).filter((b) => b.sex === "fêmea");

  const { data: report, isLoading } = trpc.genetics.buildCrossReport.useQuery(
    { maleId: Number(maleId), femaleId: Number(femaleId) },
    { enabled: step === 2 && !!maleId && !!femaleId }
  );

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {GUIADO_STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className={`rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold border-2 ${step >= i ? "bg-amber-600 text-white border-amber-600" : "bg-white text-gray-400 border-gray-200"}`}>{i+1}</div>
            <span className={`text-xs ${step >= i ? "text-gray-800 font-medium" : "text-gray-400"} hidden sm:block`}>{s.label.split(". ")[1]}</span>
            {i < GUIADO_STEPS.length - 1 && <div className={`h-0.5 w-6 ${step > i ? "bg-amber-400" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Pássaros */}
      {step === 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Escolha o macho e a fêmea</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1.5">♂ Macho</p>
              <Select value={maleId} onValueChange={setMaleId}>
                <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Selecione o macho" /></SelectTrigger>
                <SelectContent className="max-h-56 w-[min(440px,90vw)]">
                  {males.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      <span className="font-mono font-semibold">{b.ring}</span>
                      {b.displayTitle && <span className="text-gray-400 text-xs ml-2 truncate max-w-[280px] inline-block">{b.displayTitle}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1.5">♀ Fêmea</p>
              <Select value={femaleId} onValueChange={setFemaleId}>
                <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Selecione a fêmea" /></SelectTrigger>
                <SelectContent className="max-h-56 w-[min(440px,90vw)]">
                  {females.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      <span className="font-mono font-semibold">{b.ring}</span>
                      {b.displayTitle && <span className="text-gray-400 text-xs ml-2 truncate max-w-[280px] inline-block">{b.displayTitle}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="bg-amber-600 hover:bg-amber-700 w-full" disabled={!maleId || !femaleId} onClick={() => setStep(1)}>
              Próximo <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Objetivo */}
      {step === 1 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Qual é o seu objetivo com este casal?</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {OBJETIVOS.map((o) => (
              <button key={o.value} type="button"
                className={`w-full flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${objetivo === o.value ? "border-amber-400 bg-amber-50" : "border-gray-100 hover:border-gray-200"}`}
                onClick={() => setObjetivo(o.value)}
              >
                <span className="text-2xl">{o.icon}</span>
                <div>
                  <p className="font-semibold text-sm text-gray-900">{o.label}</p>
                  <p className="text-xs text-gray-500">{o.desc}</p>
                </div>
                {objetivo === o.value && <CheckCircle className="w-4 h-4 text-amber-600 ml-auto shrink-0" />}
              </button>
            ))}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setStep(0)}>Voltar</Button>
              <Button className="flex-1 bg-amber-600 hover:bg-amber-700" disabled={!objetivo} onClick={() => setStep(2)}>
                Calcular <Zap className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Resultado */}
      {step === 2 && (
        <div className="space-y-4">
          {isLoading && <div className="text-center py-8 text-gray-400">Analisando cruzamento...</div>}
          {report && (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <StatusBadge status={report.status as any} />
                <ConfidenceBadge level={report.confidenceLabel} />
              </div>

              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Parentesco (COI)</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold">{report.coiPct}</span>
                      <CoiRiskBadge risk={report.coiRisk} />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Macho</span>
                    <span className="font-mono text-sm font-semibold">{report.male.ring}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Fêmea</span>
                    <span className="font-mono text-sm font-semibold">{report.female.ring}</span>
                  </div>
                </CardContent>
              </Card>

              {report.warnings.map((w, i) => (
                <InlineAlert key={i} variant={w.includes("⚠️") || w.includes("LETAL") ? "error" : "warning"}>{w}</InlineAlert>
              ))}

              {report.missingData.length > 0 && (
                <InlineAlert variant="warning" title="Para resultados mais precisos:">
                  {report.missingData.join(" · ")}
                </InlineAlert>
              )}

              {report.recommendations.map((r, i) => (
                <p key={i} className="text-sm text-blue-700 flex items-start gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 mt-0.5 shrink-0" />{r}
                </p>
              ))}

              {/* Detalhamento técnico completo por mutação — antes só existia
                  no modo "Casal do Plantel"; o Modo Guiado calculava os mesmos
                  dados (Punnett, probabilidades por filho macho/fêmea) mas
                  nunca exibia, então o criador via só avisos genéricos sem a
                  tabela de probabilidades real por trás da recomendação. */}
              {report.colorResult && Object.keys(report.colorResult.byMutation ?? {}).length > 0 && (
                <div>
                  <button type="button" onClick={() => setShowTech(!showTech)}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-3">
                    <FlaskConical className="w-4 h-4" />
                    {showTech ? "Ocultar" : "Ver"} detalhamento genético completo (Punnett e probabilidades)
                    {showTech ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showTech && (
                    <div className="space-y-3">
                      {Object.values(report.colorResult.byMutation as Record<string, any>).map((m: any) => (
                        <MutResultCard key={m.mutationId} result={m} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)} className="flex-1">Novo cálculo</Button>
                <Button variant="outline" onClick={() => window.print()} className="gap-2 print:hidden">
                  <Printer className="w-4 h-4" />Imprimir
                </Button>
                {report.status !== "NAO_RECOMENDADO" && (
                  <Button
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setLocation(`/couples?maleId=${maleId}&femaleId=${femaleId}`)}
                  >
                    <Heart className="w-4 h-4" />Criar casal
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 4. MODO TÉCNICO ─────────────────────────────────────────────────────────

function ModoTecnico() {
  const { data: mutations = [] } = trpc.genetics.listMutations.useQuery();
  const [mSel, setMSel] = useState(new Set<string>());
  const [fSel, setFSel] = useState(new Set<string>());
  const [mGenos, setMGenos] = useState<Record<string, string>>({});
  const [fGenos, setFGenos] = useState<Record<string, string>>({});
  const [calc, setCalc] = useState(false);

  const mInput = useMemo(() => ({
    sex: "macho" as const,
    ...Object.fromEntries(Array.from(mSel).map((id) => [id, mGenos[id]]).filter(([, v]) => v)),
  }), [mSel, mGenos]);
  const fInput = useMemo(() => ({
    sex: "fêmea" as const,
    ...Object.fromEntries(Array.from(fSel).map((id) => [id, fGenos[id]]).filter(([, v]) => v)),
  }), [fSel, fGenos]);

  const { data: result, isLoading, refetch } = trpc.genetics.calculateColorCross.useQuery(
    { male: mInput as any, female: fInput as any },
    { enabled: calc, retry: false }
  );

  const toggleM = (id: string) => { setMSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); setCalc(false); };
  const toggleF = (id: string) => { setFSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); setCalc(false); };

  return (
    <div className="space-y-5">
      <InlineAlert variant="info">
        Configure manualmente os genótipos de macho e fêmea. O motor aplica Punnett quadrado para cada mutação com base nas regras de herança de canários.
      </InlineAlert>

      <div className="grid md:grid-cols-2 gap-5">
        {[
          { label: "♂ Macho", sel: mSel, genos: mGenos, toggle: toggleM, onGeno: (id: string, v: string) => { setMGenos((p) => ({ ...p, [id]: v })); setCalc(false); }, sex: "macho" as const },
          { label: "♀ Fêmea", sel: fSel, genos: fGenos, toggle: toggleF, onGeno: (id: string, v: string) => { setFGenos((p) => ({ ...p, [id]: v })); setCalc(false); }, sex: "fêmea" as const },
        ].map(({ label, sel, genos, toggle, onGeno, sex }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{label}</CardTitle>
              <CardDescription>{sel.size === 0 ? "Nenhuma mutação selecionada" : `${sel.size} mutação(ões)`}</CardDescription>
            </CardHeader>
            <CardContent>
              <MutSelector mutations={mutations} sex={sex} selected={sel} genotypes={genos} onToggle={toggle} onGeno={onGeno} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Button className="bg-amber-600 hover:bg-amber-700 gap-2" disabled={(mSel.size === 0 && fSel.size === 0) || isLoading}
          onClick={() => { setCalc(true); refetch(); }}>
          <Calculator className="w-4 h-4" />{isLoading ? "Calculando..." : "Calcular Punnett"}
        </Button>
        <Button variant="outline" className="gap-2" onClick={() => { setMSel(new Set()); setFSel(new Set()); setMGenos({}); setFGenos({}); setCalc(false); }}>
          <RefreshCw className="w-4 h-4" />Limpar
        </Button>
      </div>

      {result && (
        <div className="space-y-4">
          {result.warnings?.map((w, i) => (
            <InlineAlert key={i} variant={w.includes("⚠️") ? "error" : "warning"}>{w}</InlineAlert>
          ))}
          {result.summary && (
            <Card className="border-emerald-100 bg-emerald-50">
              <CardContent className="pt-3"><p className="text-sm font-medium text-emerald-800">{result.summary}</p></CardContent>
            </Card>
          )}
          {Object.keys(result.byMutation ?? {}).length === 0 ? (
            <InlineAlert variant="info">Configure os genótipos acima para ver os resultados de Punnett.</InlineAlert>
          ) : (
            <div className="space-y-3">
              {Object.values(result.byMutation as Record<string, any>).map((m: any) => (
                <MutResultCard key={m.mutationId} result={m} />
              ))}
            </div>
          )}
          {result.phenotypeSummary?.expectedPhenotypes?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-600" />Fenótipos esperados</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {(result.phenotypeSummary.expectedPhenotypes as any[])
                    .sort((a, b) => b.probability - a.probability)
                    .map((ph: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-2">
                          {ph.isVisual && !ph.isCarrier ? <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                            : ph.isCarrier ? <Info className="w-3.5 h-3.5 text-blue-500" />
                            : <XCircle className="w-3.5 h-3.5 text-gray-300" />}
                          <span className="text-gray-700">{ph.description}</span>
                          {ph.sex && ph.sex !== "ambos" && (
                            <span className={`text-xs ${ph.sex === "macho" ? "text-blue-500" : "text-rose-500"}`}>{ph.sex === "macho" ? "♂" : "♀"}</span>
                          )}
                        </div>
                        <span className="font-mono font-bold">{Math.round(ph.probability * 100)}%</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 5. COMPARAR CENÁRIOS ─────────────────────────────────────────────────────

function CompararCenarios() {
  const { data: mutations = [] } = trpc.genetics.listMutations.useQuery();
  const [scenarios, setScenarios] = useState([
    { label: "Cenário A", male: { sex: "macho" as const } as any, female: { sex: "fêmea" as const } as any },
    { label: "Cenário B", male: { sex: "macho" as const } as any, female: { sex: "fêmea" as const } as any },
  ]);
  const [calcDone, setCalcDone] = useState(false);

  const { data: comparison, isLoading, refetch } = trpc.genetics.compareCrossings.useQuery(
    { scenarios },
    { enabled: calcDone, retry: false }
  );

  function addScenario() {
    if (scenarios.length >= 4) return;
    const label = `Cenário ${"ABCD"[scenarios.length]}`;
    setScenarios([...scenarios, { label, male: { sex: "macho" } as any, female: { sex: "fêmea" } as any }]);
    setCalcDone(false);
  }

  const RISK_RANK: Record<string, number> = { APROVADO: 0, ATENCAO: 1, SEM_DADOS: 2, RISCO_LETAL: 3 };

  return (
    <div className="space-y-5">
      <InlineAlert variant="info">
        Configure até 4 cenários de cruzamento. O sistema compara os resultados e identifica o mais seguro geneticamente.
      </InlineAlert>

      <div className="space-y-4">
        {scenarios.map((sc, idx) => (
          <Card key={idx} className="border-2 border-gray-100">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{sc.label}</CardTitle>
                {scenarios.length > 2 && (
                  <button type="button" className="text-xs text-gray-400 hover:text-red-500"
                    onClick={() => { setScenarios(scenarios.filter((_, i) => i !== idx)); setCalcDone(false); }}>
                    Remover
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { label: "♂ Macho", key: "male", opts: mutations.filter((m) => m.inheritance === "sex_linked").slice(0, 3) },
                  { label: "♀ Fêmea", key: "female", opts: mutations.filter((m) => m.inheritance === "sex_linked").slice(0, 3) },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                    <div className="space-y-1.5">
                      {mutations.slice(0, 4).map((m) => {
                        const isM = key === "male";
                        const parent = isM ? sc.male : sc.female;
                        const opts = m.inheritance === "sex_linked"
                          ? (isM ? ZYGOSITY_SL_M : ZYGOSITY_SL_F)
                          : m.inheritance === "autosomal_recessive" ? ZYGOSITY_AR : ZYGOSITY_DOM;
                        return (
                          <div key={m.id} className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 w-24 truncate">{m.label}</span>
                            <Select
                              value={parent[m.id] ?? NONE}
                              onValueChange={(v) => {
                                const val = v === NONE ? undefined : v;
                                setScenarios(scenarios.map((s, i) => i !== idx ? s : {
                                  ...s,
                                  [key]: val ? { ...s[key as "male" | "female"], [m.id]: val } : (() => { const cp = { ...s[key as "male" | "female"] }; delete cp[m.id]; return cp; })(),
                                }));
                                setCalcDone(false);
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE}>—</SelectItem>
                                {opts.map((o) => <SelectItem key={o.value} value={o.value}><span className="font-mono">{o.value}</span></SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        {scenarios.length < 4 && (
          <Button variant="outline" onClick={addScenario} className="gap-2">
            <Zap className="w-4 h-4" />Adicionar cenário
          </Button>
        )}
        <Button className="bg-amber-600 hover:bg-amber-700 gap-2" onClick={() => { setCalcDone(true); refetch(); }} disabled={isLoading}>
          <GitCompare className="w-4 h-4" />{isLoading ? "Comparando..." : "Comparar cenários"}
        </Button>
      </div>

      {comparison && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-800 text-sm">Resultado — ranqueado do melhor para o pior:</h3>
          {[...comparison].map((sc: any, i: number) => (
            <Card key={sc.label} className={`border-2 ${i === 0 ? "border-emerald-300 bg-emerald-50/40" : "border-gray-100"}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {i === 0 && <Star className="w-4 h-4 text-amber-500 shrink-0" />}
                      <span className="font-semibold text-gray-900">{sc.label}</span>
                      <StatusBadge status={sc.riskScore as any} />
                      {sc.coiPct && (
                        <CoiRiskBadge risk={sc.coiRisk} pct={sc.coiPct} />
                      )}
                    </div>
                    {sc.result.warnings?.slice(0, 2).map((w: string, j: number) => (
                      <p key={j} className="text-xs text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />{w.slice(0, 80)}{w.length > 80 ? "..." : ""}
                      </p>
                    ))}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">{sc.mutationCount} mutação(ões)</p>
                    <p className="text-xs text-gray-400">{sc.warningCount} alerta(s)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 6. REFERÊNCIA ────────────────────────────────────────────────────────────

function Referencia() {
  const { data: mutations = [] } = trpc.genetics.listMutations.useQuery();
  const groups = [
    { key: "sex_linked",          label: "Ligadas ao sexo (cromossomo Z)", icon: "🔗", note: "Fêmeas ZW nunca são portadoras silenciosas" },
    { key: "autosomal_recessive", label: "Autossômicas recessivas",          icon: "🔄", note: "Ambos os sexos podem ser portadores" },
    { key: "autosomal_dominant",  label: "Autossômicas dominantes",          icon: "⬆️",  note: "Uma cópia já manifesta o fenótipo" },
  ];
  return (
    <div className="space-y-5">
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-4">
          <p className="text-sm font-semibold text-amber-800 mb-1">Sistema ZZ/ZW dos canários</p>
          <p className="text-sm text-amber-700">
            Machos têm dois cromossomos Z (<strong>ZZ</strong>). Fêmeas têm um Z e um W (<strong>ZW</strong>).
            Genes no cromossomo Z seguem regras especiais: <strong>fêmeas nunca são portadoras silenciosas</strong> de genes ligados ao sexo —
            ou manifestam ou não têm o gene. Machos (ZZ) podem ser portadores sem manifestar.
          </p>
        </CardContent>
      </Card>
      {groups.map((g) => (
        <div key={g.key}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{g.icon}</span>
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">{g.label}</h3>
              <p className="text-xs text-gray-400">{g.note}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {mutations.filter((m) => m.inheritance === g.key).map((m) => (
              <Card key={m.id} className="border border-gray-100">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <p className="font-semibold text-sm text-gray-900">{m.label}</p>
                    {m.isLethalHomozygous && <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-1 shrink-0">⚠️</span>}
                  </div>
                  <p className="text-xs text-gray-500 mb-1">{m.description}</p>
                  <p className="text-xs text-amber-700 italic">{m.phenotypeEffect}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Tab: Simulação F1 → F2 (duas gerações adiante)
// ────────────────────────────────────────────────────────────
function GenotypeSelect({ label, sex, options, value, onChange }: {
  label: string; sex: "macho" | "fêmea"; options: { value: string; label: string }[];
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label} <span className="text-gray-400">({sex === "macho" ? "♂" : "♀"})</span></p>
      <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Genótipo..." /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>— Selecione —</SelectItem>
          {options.map((o) => <SelectItem key={o.value} value={o.value}><span className="font-mono mr-2">{o.value}</span>{o.label.split("—")[1]?.trim()}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function SimulacaoF1F2() {
  const { data: mutations = [] } = trpc.genetics.listMutations.useQuery();
  const [mutationId, setMutationId] = useState("");
  const [genoA, setGenoA] = useState("");
  const [genoB, setGenoB] = useState("");
  const [genoC, setGenoC] = useState("");
  const [cSex, setCSex] = useState<"macho" | "fêmea">("macho");
  const [run, setRun] = useState(false);

  const selectedMutation = mutations.find((m: any) => m.id === mutationId);
  const inheritance = selectedMutation?.inheritance as "sex_linked" | "autosomal_recessive" | "autosomal_dominant" | undefined;

  const optsFor = (sex: "macho" | "fêmea") =>
    inheritance === "sex_linked" ? (sex === "macho" ? ZYGOSITY_SL_M : ZYGOSITY_SL_F)
    : inheritance === "autosomal_recessive" ? ZYGOSITY_AR
    : inheritance === "autosomal_dominant" ? ZYGOSITY_DOM
    : [];

  const f1Sex: "macho" | "fêmea" = cSex === "macho" ? "fêmea" : "macho";

  const { data: result, isLoading, refetch } = trpc.genetics.simulateF2.useQuery(
    {
      grandparentA: { sex: "macho", [mutationId]: genoA } as any,
      grandparentB: { sex: "fêmea", [mutationId]: genoB } as any,
      mateC: { sex: cSex, [mutationId]: genoC } as any,
      mutationId,
    },
    { enabled: run && !!mutationId && !!genoA && !!genoB && !!genoC, retry: false }
  );

  // Converte a lista de F2Outcome (agregada, com sexo opcional por item)
  // no mesmo formato Record<genotype, probability> que o PunnettGrid já
  // existente espera — reaproveita o componente visual sem duplicá-lo.
  const f2Sons: Record<string, number> = {};
  const f2Daughters: Record<string, number> = {};
  const f2Offspring: Record<string, number> = {};
  for (const o of result?.f2Outcomes ?? []) {
    if (o.sex === "macho") f2Sons[o.genotype] = (f2Sons[o.genotype] ?? 0) + o.probability;
    else if (o.sex === "fêmea") f2Daughters[o.genotype] = (f2Daughters[o.genotype] ?? 0) + o.probability;
    else f2Offspring[o.genotype] = (f2Offspring[o.genotype] ?? 0) + o.probability;
  }

  return (
    <div className="space-y-5">
      <InlineAlert variant="info">
        Simule duas gerações adiante: cruze A×B, e um dos filhotes (F1) com C. Funciona para uma mutação por vez —
        a mesma simplificação de "genes independentes" já usada no resto da calculadora.
      </InlineAlert>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">1. Escolha a mutação</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={mutationId} onValueChange={(v) => { setMutationId(v); setGenoA(""); setGenoB(""); setGenoC(""); setRun(false); }}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a mutação..." /></SelectTrigger>
            <SelectContent>
              {mutations.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {inheritance && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">2. Avô/avó A</CardTitle></CardHeader>
            <CardContent><GenotypeSelect label="Genótipo" sex="macho" options={optsFor("macho")} value={genoA} onChange={(v) => { setGenoA(v); setRun(false); }} /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">2. Avô/avó B</CardTitle></CardHeader>
            <CardContent><GenotypeSelect label="Genótipo" sex="fêmea" options={optsFor("fêmea")} value={genoB} onChange={(v) => { setGenoB(v); setRun(false); }} /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">3. Par C (cruza com o F1)</CardTitle>
              <CardDescription className="text-xs">O F1 usado será {f1Sex === "macho" ? "macho" : "fêmea"} (sexo oposto a C)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Select value={cSex} onValueChange={(v: any) => { setCSex(v); setGenoC(""); setRun(false); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="macho">♂ Macho</SelectItem>
                  <SelectItem value="fêmea">♀ Fêmea</SelectItem>
                </SelectContent>
              </Select>
              <GenotypeSelect label="Genótipo" sex={cSex} options={optsFor(cSex)} value={genoC} onChange={(v) => { setGenoC(v); setRun(false); }} />
            </CardContent>
          </Card>
        </div>
      )}

      <Button className="bg-amber-600 hover:bg-amber-700 gap-2" disabled={!mutationId || !genoA || !genoB || !genoC || isLoading}
        onClick={() => { setRun(true); refetch(); }}>
        <Layers className="w-4 h-4" />{isLoading ? "Simulando..." : "Simular F1 → F2"}
      </Button>

      {result && (
        <div className="space-y-5">
          {result.warnings.map((w, i) => <InlineAlert key={i} variant="warning">{w}</InlineAlert>)}

          <Card className="border-blue-100 bg-blue-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Geração F1 ({result.f1SexUsed === "macho" ? "♂ machos" : "♀ fêmeas"}) — resultado de A × B</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {result.f1Distribution.map((o, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  <span className="font-mono mr-1.5">{o.genotype}</span>{(o.probability * 100).toFixed(1)}%
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card className="border-emerald-100 bg-emerald-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Geração F2 — resultado ponderado de F1 × C</CardTitle>
              <CardDescription className="text-xs">Já considera todas as possibilidades de F1, ponderadas pela probabilidade de cada uma.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(result.f2Outcomes ?? []).map((o, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-white rounded-lg border px-3 py-2">
                  <span className="font-mono font-semibold">{o.genotype}{o.sex ? ` (${o.sex === "macho" ? "♂" : "♀"})` : ""}</span>
                  <span className="text-xs text-gray-400">via F1: {o.viaF1Genotypes.join(", ")}</span>
                  <Badge className="bg-emerald-100 text-emerald-800">{(o.probability * 100).toFixed(1)}%</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {(Object.keys(f2Sons).length > 0 || Object.keys(f2Daughters).length > 0 || Object.keys(f2Offspring).length > 0) && (
            <PunnettGrid
              sons={Object.keys(f2Sons).length ? f2Sons : undefined}
              daughters={Object.keys(f2Daughters).length ? f2Daughters : undefined}
              offspring={Object.keys(f2Offspring).length ? f2Offspring : undefined}
              inheritance={inheritance ?? ""}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Tab: Plano de Temporada (otimização do plantel inteiro)
// ────────────────────────────────────────────────────────────
function PlanoTemporada() {
  const [objective, setObjective] = useState("PLANEJAMENTO_LIVRE");
  const [run, setRun] = useState(false);
  const { data, isLoading, refetch } = trpc.pairingOptimizer.planSeason.useQuery(
    { objective: objective as any },
    { enabled: run, retry: false }
  );

  const OBJECTIVES = [
    { value: "PLANEJAMENTO_LIVRE", label: "Sem prioridade específica" },
    { value: "MANTER_LINHAGEM", label: "Preservar linhagem" },
    { value: "MELHORAR_COR", label: "Melhorar cor" },
    { value: "MELHORAR_PORTE", label: "Melhorar porte" },
    { value: "REDUZIR_COI", label: "Reduzir parentesco (diversidade)" },
    { value: "PRODUZIR_PORTADORES", label: "Produzir portadores" },
    { value: "EXPOSICAO", label: "Preparar para exposição" },
    { value: "REPRODUCAO_SEGURA", label: "Priorizar segurança reprodutiva" },
  ];

  const statusColor: Record<string, string> = {
    IDEAL: "bg-green-100 text-green-800", APROVADO: "bg-blue-100 text-blue-800",
    ATENCAO: "bg-amber-100 text-amber-800", NAO_RECOMENDADO: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-5">
      <InlineAlert variant="info">
        Em vez de escolher um pássaro por vez, o sistema varre <strong>todos os machos × todas as fêmeas ativos</strong> do
        plantel e monta o melhor conjunto de casais simultâneos pra temporada. Usa um algoritmo guloso (pega sempre a
        melhor combinação disponível a cada passo) — é rápido e bom, mas não é uma garantia matemática absoluta do
        melhor conjunto possível entre todas as combinações existentes.
      </InlineAlert>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Objetivo da temporada</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div className="w-64">
            <Select value={objective} onValueChange={(v) => { setObjective(v); setRun(false); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OBJECTIVES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button className="bg-amber-600 hover:bg-amber-700 gap-2" disabled={isLoading} onClick={() => { setRun(true); refetch(); }}>
            <Users className="w-4 h-4" />{isLoading ? "Calculando..." : "Gerar plano de temporada"}
          </Button>
        </CardContent>
      </Card>

      {data?.tooLarge && (
        <InlineAlert variant="warning">
          Seu plantel tem {data.totalActive} pássaros ativos, acima do limite de {data.maxActive} que processamos de
          uma vez. Fale com o suporte se precisar disso para o plantel inteiro.
        </InlineAlert>
      )}

      {data && !data.tooLarge && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Casais sugeridos</p><p className="text-2xl font-bold">{data.assignedPairs.length}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Pontuação média</p><p className="text-2xl font-bold">{data.averageScore.toFixed(0)}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Machos sem par</p><p className="text-2xl font-bold text-amber-600">{data.unmatchedMales.length}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Fêmeas sem par</p><p className="text-2xl font-bold text-amber-600">{data.unmatchedFemales.length}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Casais sugeridos</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.assignedPairs.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum casal recomendado com os dados atuais do plantel.</p>
              ) : data.assignedPairs.map((p, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-mono font-semibold text-sm">{p.male.ring} × {p.female.ring}</span>
                    <Badge className={statusColor[p.status] ?? ""}>{p.status}</Badge>
                    <Badge variant="outline">{p.finalScore.toFixed(0)} pts</Badge>
                  </div>
                  {p.reasons.length > 0 && (
                    <ul className="text-xs text-gray-600 mt-2 space-y-0.5">
                      {p.reasons.slice(0, 3).map((r, j) => <li key={j}>• {r}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {(data.unmatchedMales.length > 0 || data.unmatchedFemales.length > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Sem par nesta rodada</CardTitle>
                <CardDescription className="text-xs">Sem parceiro disponível, ou todas as combinações restantes ficaram com risco genético alto demais.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {[...data.unmatchedMales, ...data.unmatchedFemales].map((b) => (
                  <Badge key={b.id} variant="outline" className="text-xs">{b.ring}</Badge>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function GeneticsCalculator() {
  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl flex items-center gap-3">
            <Dna className="w-8 h-8 text-amber-600" />
            Calculadora Genética Profissional
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            18 mutações · Sistema ZZ/ZW · Punnett quadrado · COI · Relatório de cruzamento
          </p>
        </div>

        <Tabs defaultValue="par-ideal">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="par-ideal">    <Star className="w-3.5 h-3.5 mr-1.5" />Par Ideal</TabsTrigger>
            <TabsTrigger value="plantel">      <Heart className="w-3.5 h-3.5 mr-1.5" />Casal do Plantel</TabsTrigger>
            <TabsTrigger value="guiado">       <Zap className="w-3.5 h-3.5 mr-1.5" />Modo Guiado</TabsTrigger>
            <TabsTrigger value="tecnico">      <FlaskConical className="w-3.5 h-3.5 mr-1.5" />Modo Técnico</TabsTrigger>
            <TabsTrigger value="comparar">     <GitCompare className="w-3.5 h-3.5 mr-1.5" />Comparar Cenários</TabsTrigger>
            <TabsTrigger value="f1f2">         <Layers className="w-3.5 h-3.5 mr-1.5" />Simulação F1→F2</TabsTrigger>
            <TabsTrigger value="temporada">   <Users className="w-3.5 h-3.5 mr-1.5" />Plano de Temporada</TabsTrigger>
            <TabsTrigger value="referencia">   <BookOpen className="w-3.5 h-3.5 mr-1.5" />Referência</TabsTrigger>
          </TabsList>

          <TabsContent value="par-ideal"  className="mt-5"><ParIdeal /></TabsContent>
          <TabsContent value="plantel"    className="mt-5"><CasalPlantel /></TabsContent>
          <TabsContent value="guiado"     className="mt-5"><ModoGuiado /></TabsContent>
          <TabsContent value="tecnico"    className="mt-5"><ModoTecnico /></TabsContent>
          <TabsContent value="comparar"   className="mt-5"><CompararCenarios /></TabsContent>
          <TabsContent value="f1f2"       className="mt-5"><SimulacaoF1F2 /></TabsContent>
          <TabsContent value="temporada"  className="mt-5"><PlanoTemporada /></TabsContent>
          <TabsContent value="referencia" className="mt-5"><Referencia /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
