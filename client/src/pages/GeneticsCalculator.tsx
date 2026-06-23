/**
 * GeneticsCalculator.tsx — Calculadora Genética Completa de Canários
 *
 * Modo Simples:
 *   Selecione mutações + genótipos → resultado Punnett automático
 *
 * Modo Casal do Plantel:
 *   Selecione pássaros cadastrados → puxa genótipos automaticamente
 *
 * Modo Avançado (Lipocromo):
 *   Calcula cruzamento de cor de base (amarelo, vermelho, branco, marfim)
 *
 * Relatório gerado dinamicamente com:
 *   - Distribuição por mutação (Punnett quadrado)
 *   - Fenótipos esperados por sexo
 *   - Alertas de risco letal
 *   - Explicação para leigo
 *   - Recomendações de manejo
 */
import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  Calculator, AlertTriangle, Info, Dna, Bird, Zap,
  RefreshCw, ChevronDown, ChevronUp, CheckCircle,
  FlaskConical, Users, Sparkles, BookOpen, Heart,
  XCircle, ClipboardList, ArrowRight,
} from "lucide-react";
import { InlineAlert, HelpTooltip, SexBadge } from "@/components/ui-premium";

// ─── Constants ─────────────────────────────────────────────────────────────

const NONE_VALUE = "__none__";

const ZYGOSITY_LABELS_SL_MALE: Record<string, string> = {
  "Z+Z+": "Z⁺Z⁺ — Visual homozigoto (macho)",
  "Z+Z-": "Z⁺Z⁻ — Portador heterozigoto (macho)",
  "Z-Z-": "Z⁻Z⁻ — Normal sem mutação (macho)",
};
const ZYGOSITY_LABELS_SL_FEMALE: Record<string, string> = {
  "Z+W": "Z⁺W — Visual (fêmea sempre manifesta)",
  "Z-W": "Z⁻W — Normal sem mutação (fêmea)",
};
const ZYGOSITY_LABELS_AR: Record<string, string> = {
  "mm": "mm — Visual (homozigoto mutante)",
  "Nm": "Nm — Portador heterozigoto",
  "NN": "NN — Normal (sem mutação)",
};
const ZYGOSITY_LABELS_DOM: Record<string, string> = {
  "nn": "nn — Não visual",
  "Nn": "Nn — Visual dose simples",
  "NN": "NN — Visual dose dupla (risco letal em crista/BD)",
};

const ZYGOSITY_COLORS: Record<string, string> = {
  "Z+Z+": "bg-amber-100 text-amber-800 border-amber-200",
  "Z+Z-": "bg-blue-100 text-blue-800 border-blue-200",
  "Z-Z-": "bg-gray-100 text-gray-600 border-gray-200",
  "Z+W":  "bg-amber-100 text-amber-800 border-amber-200",
  "Z-W":  "bg-gray-100 text-gray-600 border-gray-200",
  "mm":   "bg-amber-100 text-amber-800 border-amber-200",
  "Nm":   "bg-blue-100 text-blue-800 border-blue-200",
  "NN":   "bg-gray-100 text-gray-600 border-gray-200",
  "Nn":   "bg-purple-100 text-purple-800 border-purple-200",
  "nn":   "bg-gray-100 text-gray-600 border-gray-200",
};

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function ProbabilityBar({
  value, label, color, sublabel,
}: {
  value: number; label: string; color: string; sublabel?: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-3">
        <div className="w-48 text-sm text-gray-700 shrink-0 leading-tight">{label}</div>
        <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden min-w-[80px]">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="w-14 text-sm font-bold text-right text-gray-800 font-mono">{pct}%</div>
      </div>
      {sublabel && <p className="text-xs text-gray-400 ml-48 pl-3">{sublabel}</p>}
    </div>
  );
}

function ZygosityBadge({ genotype }: { genotype: string }) {
  const color = ZYGOSITY_COLORS[genotype] ?? "bg-gray-50 text-gray-500";
  return <Badge className={`text-xs border ${color} font-mono`}>{genotype}</Badge>;
}

function InheritanceBadge({ type }: { type: string }) {
  const cfg: Record<string, { label: string; color: string }> = {
    "sex_linked":            { label: "Ligada ao sexo", color: "bg-rose-100 text-rose-800 border-rose-200" },
    "autosomal_recessive":   { label: "Aut. recessiva", color: "bg-blue-100 text-blue-800 border-blue-200" },
    "autosomal_dominant":    { label: "Aut. dominante", color: "bg-purple-100 text-purple-800 border-purple-200" },
  };
  const { label, color } = cfg[type] ?? { label: type, color: "bg-gray-100 text-gray-600" };
  return <Badge className={`text-xs border ${color}`}>{label}</Badge>;
}

// ─── MutationResultCard ──────────────────────────────────────────────────────

function MutationResultCard({ result }: { result: any }) {
  const [showExplanation, setShowExplanation] = useState(false);

  const warningColor = result.warnings?.length > 0
    ? result.warnings.some((w: string) => w.includes("LETAL") || w.includes("⚠️"))
      ? "border-red-300 bg-red-50"
      : "border-amber-200 bg-amber-50"
    : "border-gray-100 bg-white";

  return (
    <Card className={`border-2 ${warningColor}`}>
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-sm">{result.label}</CardTitle>
          <InheritanceBadge type={result.inheritance} />
          {result.warnings?.length > 0 && (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Warnings */}
        {result.warnings?.map((w: string, i: number) => (
          <div key={i} className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-600" />
            <span>{w}</span>
          </div>
        ))}

        {/* Sex-linked: sons and daughters */}
        {result.sons && result.daughters && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-blue-600 font-semibold mb-2 flex items-center gap-1"><Bird className="w-3.5 h-3.5" />♂ Filhos machos</p>
              <div className="space-y-2">
                {Object.entries(result.sons as Record<string, number>)
                  .filter(([, p]) => p > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([geno, prob]) => (
                    <ProbabilityBar
                      key={geno}
                      value={prob}
                      label={
                        geno === "Z+Z+" ? "Visual homozigoto"
                        : geno === "Z+Z-" ? "Portador"
                        : "Normal"
                      }
                      sublabel={geno}
                      color={
                        geno === "Z+Z+" ? "bg-amber-500"
                        : geno === "Z+Z-" ? "bg-blue-400"
                        : "bg-gray-300"
                      }
                    />
                  ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-rose-600 font-semibold mb-2 flex items-center gap-1"><Bird className="w-3.5 h-3.5" />♀ Filhas fêmeas</p>
              <div className="space-y-2">
                {Object.entries(result.daughters as Record<string, number>)
                  .filter(([, p]) => p > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([geno, prob]) => (
                    <ProbabilityBar
                      key={geno}
                      value={prob}
                      label={geno === "Z+W" ? "Visual" : "Normal"}
                      sublabel={geno}
                      color={geno === "Z+W" ? "bg-amber-500" : "bg-gray-300"}
                    />
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Autosomal */}
        {result.offspring && (
          <div className="space-y-2">
            {Object.entries(result.offspring as Record<string, number>)
              .filter(([, p]) => p > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([geno, prob]) => {
                const isVisual = result.inheritance === "autosomal_recessive"
                  ? geno === "mm" : geno === "Nn" || geno === "NN";
                const isCarrier = result.inheritance === "autosomal_recessive" && geno === "Nm";
                const isLethal = geno === "NN" && result.inheritance === "autosomal_dominant";
                const label = result.inheritance === "autosomal_recessive"
                  ? geno === "mm" ? "Visual (homozigoto)" : geno === "Nm" ? "Portador" : "Normal"
                  : geno === "NN" ? "Visual dose dupla (⚠️ letal)" : geno === "Nn" ? "Visual dose simples" : "Não visual";
                const color = isLethal ? "bg-red-400"
                  : isVisual && !isCarrier ? "bg-amber-500"
                  : isCarrier ? "bg-blue-400"
                  : "bg-gray-300";
                return (
                  <ProbabilityBar key={geno} value={prob} label={label} sublabel={geno} color={color} />
                );
              })}
          </div>
        )}

        {/* Explanation toggle */}
        {result.explanation && (
          <div>
            <button
              type="button"
              onClick={() => setShowExplanation(!showExplanation)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              {showExplanation ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showExplanation ? "Ocultar explicação" : "Ver explicação detalhada"}
            </button>
            {showExplanation && (
              <pre className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap font-sans border border-gray-100">
                {result.explanation}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── MutationSelector ────────────────────────────────────────────────────────

function MutationSelector({
  mutations,
  parentSex,
  selectedMutations,
  genotypes,
  onToggle,
  onGenotypeChange,
}: {
  mutations: any[];
  parentSex: "macho" | "fêmea";
  selectedMutations: Set<string>;
  genotypes: Record<string, string>;
  onToggle: (id: string) => void;
  onGenotypeChange: (id: string, value: string) => void;
}) {
  const groups = [
    { key: "sex_linked",          label: "Ligadas ao sexo (cromossomo Z)", color: "text-rose-700" },
    { key: "autosomal_recessive", label: "Autossômicas recessivas",          color: "text-blue-700" },
    { key: "autosomal_dominant",  label: "Autossômicas dominantes",          color: "text-purple-700" },
  ];

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const groupMuts = mutations.filter((m) => m.inheritance === group.key);
        if (groupMuts.length === 0) return null;
        return (
          <div key={group.key}>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${group.color}`}>
              {group.label}
            </p>
            <div className="space-y-2">
              {groupMuts.map((mut) => {
                const isSelected = selectedMutations.has(mut.id);
                let options: { value: string; label: string }[] = [];

                if (mut.inheritance === "sex_linked") {
                  options = parentSex === "macho"
                    ? Object.entries(ZYGOSITY_LABELS_SL_MALE).map(([v, l]) => ({ value: v, label: l }))
                    : Object.entries(ZYGOSITY_LABELS_SL_FEMALE).map(([v, l]) => ({ value: v, label: l }));
                } else if (mut.inheritance === "autosomal_recessive") {
                  options = Object.entries(ZYGOSITY_LABELS_AR).map(([v, l]) => ({ value: v, label: l }));
                } else {
                  options = Object.entries(ZYGOSITY_LABELS_DOM).map(([v, l]) => ({ value: v, label: l }));
                }

                return (
                  <div key={mut.id} className={`rounded-lg border transition-all ${isSelected ? "border-amber-300 bg-amber-50" : "border-gray-100 hover:border-gray-200"}`}>
                    <div className="flex items-center gap-2 p-2">
                      <input
                        type="checkbox"
                        id={`${parentSex}-${mut.id}`}
                        checked={isSelected}
                        onChange={() => onToggle(mut.id)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor={`${parentSex}-${mut.id}`} className="text-sm font-medium text-gray-800 cursor-pointer flex-1">
                        {mut.label}
                      </label>
                      <HelpTooltip text={mut.description} technical={`Efeito: ${mut.phenotypeEffect}`} />
                      {mut.isLethalHomozygous && (
                        <span className="text-xs text-red-600 border border-red-200 rounded px-1.5 py-0.5 bg-red-50">⚠️ Letal</span>
                      )}
                    </div>
                    {isSelected && (
                      <div className="px-2 pb-2">
                        <Select
                          value={genotypes[mut.id] ?? NONE_VALUE}
                          onValueChange={(v) => onGenotypeChange(mut.id, v === NONE_VALUE ? "" : v)}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione o genótipo" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_VALUE}>— Selecione o genótipo —</SelectItem>
                            {options.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                <span className="font-mono font-semibold mr-2">{o.value}</span>
                                <span className="text-gray-500">{o.label.split(" — ")[1]}</span>
                              </SelectItem>
                            ))}
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

// ─── Modo Simples ─────────────────────────────────────────────────────────────

function ModoSimples() {
  const { data: mutations = [], isLoading: mutLoading } = trpc.genetics.listMutations.useQuery();
  const [maleSelected, setMaleSelected] = useState<Set<string>>(new Set());
  const [femaleSelected, setFemaleSelected] = useState<Set<string>>(new Set());
  const [maleGenos, setMaleGenos] = useState<Record<string, string>>({});
  const [femaleGenos, setFemaleGenos] = useState<Record<string, string>>({});
  const [calculated, setCalculated] = useState(false);

  const maleInput = useMemo(() => ({
    sex: "macho" as const,
    ...Object.fromEntries(Array.from(maleSelected).map((id) => [id, maleGenos[id]]).filter(([, v]) => v)),
  }), [maleSelected, maleGenos]);

  const femaleInput = useMemo(() => ({
    sex: "fêmea" as const,
    ...Object.fromEntries(Array.from(femaleSelected).map((id) => [id, femaleGenos[id]]).filter(([, v]) => v)),
  }), [femaleSelected, femaleGenos]);

  const { data: result, isLoading: calcLoading, refetch } = trpc.genetics.calculateColorCross.useQuery(
    { male: maleInput as any, female: femaleInput as any },
    { enabled: calculated, retry: false }
  );

  const hasAnyMutation = maleSelected.size > 0 || femaleSelected.size > 0;
  const hasGenotypes = Array.from(maleSelected).some((id) => maleGenos[id]) || Array.from(femaleSelected).some((id) => femaleGenos[id]);

  function toggleMale(id: string) {
    setMaleSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
    setCalculated(false);
  }
  function toggleFemale(id: string) {
    setFemaleSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
    setCalculated(false);
  }

  function handleReset() {
    setMaleSelected(new Set()); setFemaleSelected(new Set());
    setMaleGenos({}); setFemaleGenos({});
    setCalculated(false);
  }

  return (
    <div className="space-y-5">
      <InlineAlert variant="info">
        Selecione as mutações conhecidas de cada pássaro e informe o genótipo. A calculadora usa Punnett quadrado para cada gene separadamente.
      </InlineAlert>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Macho */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 text-xs font-bold">♂ Macho</span>
              Genótipo do pai
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mutLoading ? <p className="text-gray-400 text-sm">Carregando mutações...</p> : (
              <MutationSelector
                mutations={mutations}
                parentSex="macho"
                selectedMutations={maleSelected}
                genotypes={maleGenos}
                onToggle={toggleMale}
                onGenotypeChange={(id, v) => { setMaleGenos((p) => ({ ...p, [id]: v })); setCalculated(false); }}
              />
            )}
          </CardContent>
        </Card>

        {/* Fêmea */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="bg-rose-100 text-rose-800 rounded-full px-2 py-0.5 text-xs font-bold">♀ Fêmea</span>
              Genótipo da mãe
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mutLoading ? <p className="text-gray-400 text-sm">Carregando mutações...</p> : (
              <MutationSelector
                mutations={mutations}
                parentSex="fêmea"
                selectedMutations={femaleSelected}
                genotypes={femaleGenos}
                onToggle={toggleFemale}
                onGenotypeChange={(id, v) => { setFemaleGenos((p) => ({ ...p, [id]: v })); setCalculated(false); }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action bar */}
      <div className="flex gap-3 flex-wrap">
        <Button
          className="bg-amber-600 hover:bg-amber-700 gap-2"
          disabled={!hasAnyMutation || calcLoading}
          onClick={() => { setCalculated(true); refetch(); }}
        >
          <Calculator className="w-4 h-4" />
          {calcLoading ? "Calculando..." : "Calcular cruzamento"}
        </Button>
        <Button variant="outline" onClick={handleReset} className="gap-2">
          <RefreshCw className="w-4 h-4" />Limpar
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Global warnings */}
          {result.warnings?.length > 0 && (
            <div className="space-y-2">
              {result.warnings.map((w: string, i: number) => (
                <InlineAlert key={i} variant={w.includes("⚠️") || w.includes("LETAL") ? "error" : "warning"}>
                  {w}
                </InlineAlert>
              ))}
            </div>
          )}

          {/* Summary */}
          {result.summary && (
            <Card className="border-green-100 bg-green-50">
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-green-800">{result.summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Per-mutation results */}
          {Object.keys(result.byMutation ?? {}).length > 0 ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-amber-600" />
                Resultados por mutação
              </h3>
              {Object.values(result.byMutation as Record<string, any>).map((mutResult: any) => (
                <MutationResultCard key={mutResult.mutationId} result={mutResult} />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-gray-400">
                <Dna className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma mutação configurada. Selecione mutações acima e informe os genótipos.</p>
              </CardContent>
            </Card>
          )}

          {/* Phenotype summary */}
          {result.phenotypeSummary && result.phenotypeSummary.expectedPhenotypes?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Fenótipos esperados nos filhotes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {result.phenotypeSummary.expectedPhenotypes
                    .sort((a: any, b: any) => b.probability - a.probability)
                    .map((ph: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-2">
                          {ph.isVisual && !ph.isCarrier && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
                          {ph.isCarrier && <Info className="w-3.5 h-3.5 text-blue-500" />}
                          {!ph.isVisual && !ph.isCarrier && <XCircle className="w-3.5 h-3.5 text-gray-300" />}
                          <span className="text-gray-700">{ph.description}</span>
                          {ph.sex && ph.sex !== "ambos" && (
                            <span className={`text-xs ${ph.sex === "macho" ? "text-blue-600" : "text-rose-600"}`}>
                              {ph.sex === "macho" ? "♂" : "♀"}
                            </span>
                          )}
                        </div>
                        <span className="font-semibold font-mono text-gray-800">{Math.round(ph.probability * 100)}%</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {result.recommendations?.length > 0 && (
            <Card className="border-blue-100">
              <CardContent className="pt-4 space-y-1">
                {result.recommendations.map((r: string, i: number) => (
                  <p key={i} className="text-sm text-blue-800 flex items-start gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
                    {r}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Modo Casal do Plantel ────────────────────────────────────────────────────

function ModoCasalPlantel() {
  const [maleId, setMaleId] = useState("");
  const [femaleId, setFemaleId] = useState("");
  const [calculated, setCalculated] = useState(false);

  const { data: allBirds } = trpc.birds.list.useQuery({});
  const { data: mutations = [] } = trpc.genetics.listMutations.useQuery();

  const males = (allBirds ?? []).filter((b) => b.sex === "macho");
  const females = (allBirds ?? []).filter((b) => b.sex === "fêmea");

  const { data: maleGeno } = trpc.mendelian.getGenotype.useQuery(
    Number(maleId), { enabled: !!maleId }
  );
  const { data: femaleGeno } = trpc.mendelian.getGenotype.useQuery(
    Number(femaleId), { enabled: !!femaleId }
  );

  // Build genotype input from saved data
  const maleInput = useMemo(() => {
    if (!maleGeno) return { sex: "macho" as const };
    const geno: Record<string, string> = { sex: "macho" };
    const muts = (maleGeno.mutations as any[]) ?? [];
    for (const m of muts) {
      if (m.mutation && m.zygosity) {
        const mut = mutations.find((x) => x.id === m.mutation);
        if (!mut) continue;
        if (mut.inheritance === "sex_linked") {
          geno[m.mutation] = m.zygosity === "homozygous_mutant" ? "Z+Z+"
            : m.zygosity === "heterozygous_carrier" ? "Z+Z-"
            : "Z-Z-";
        } else if (mut.inheritance === "autosomal_recessive") {
          geno[m.mutation] = m.zygosity === "homozygous_mutant" ? "mm"
            : m.zygosity === "heterozygous_carrier" ? "Nm"
            : "NN";
        } else {
          geno[m.mutation] = m.zygosity === "homozygous_mutant" ? "NN"
            : m.zygosity === "heterozygous_carrier" ? "Nn"
            : "nn";
        }
      }
    }
    return geno;
  }, [maleGeno, mutations]);

  const femaleInput = useMemo(() => {
    if (!femaleGeno) return { sex: "fêmea" as const };
    const geno: Record<string, string> = { sex: "fêmea" };
    const muts = (femaleGeno.mutations as any[]) ?? [];
    for (const m of muts) {
      if (m.mutation && m.zygosity) {
        const mut = mutations.find((x) => x.id === m.mutation);
        if (!mut) continue;
        if (mut.inheritance === "sex_linked") {
          geno[m.mutation] = m.zygosity === "homozygous_mutant" ? "Z+W" : "Z-W";
        } else if (mut.inheritance === "autosomal_recessive") {
          geno[m.mutation] = m.zygosity === "homozygous_mutant" ? "mm"
            : m.zygosity === "heterozygous_carrier" ? "Nm"
            : "NN";
        } else {
          geno[m.mutation] = m.zygosity === "homozygous_mutant" ? "NN"
            : m.zygosity === "heterozygous_carrier" ? "Nn"
            : "nn";
        }
      }
    }
    return geno;
  }, [femaleGeno, mutations]);

  const { data: result, isLoading, refetch } = trpc.genetics.calculateColorCross.useQuery(
    { male: maleInput as any, female: femaleInput as any },
    { enabled: calculated && !!maleId && !!femaleId }
  );

  const selectedMale = males.find((b) => b.id === Number(maleId));
  const selectedFemale = females.find((b) => b.id === Number(femaleId));

  return (
    <div className="space-y-5">
      <InlineAlert variant="info">
        Selecione pássaros do seu plantel. O sistema puxa o genótipo cadastrado automaticamente.
        Se não houver genótipo cadastrado, vá na ficha do pássaro e preencha primeiro.
      </InlineAlert>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">♂ Macho</p>
          <Select value={maleId} onValueChange={(v) => { setMaleId(v); setCalculated(false); }}>
            <SelectTrigger><SelectValue placeholder="Selecione o macho" /></SelectTrigger>
            <SelectContent className="max-h-64">
              {males.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  <span className="font-mono">{b.ring}</span>
                  {b.displayTitle && <span className="text-gray-400 ml-2">— {b.displayTitle}</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {maleGeno && (
            <p className="text-xs text-gray-400 mt-1">
              Mutações: {(maleGeno.mutations as any[])?.length > 0
                ? (maleGeno.mutations as any[]).map((m: any) => m.mutation).join(", ")
                : "nenhuma cadastrada"}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">♀ Fêmea</p>
          <Select value={femaleId} onValueChange={(v) => { setFemaleId(v); setCalculated(false); }}>
            <SelectTrigger><SelectValue placeholder="Selecione a fêmea" /></SelectTrigger>
            <SelectContent className="max-h-64">
              {females.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  <span className="font-mono">{b.ring}</span>
                  {b.displayTitle && <span className="text-gray-400 ml-2">— {b.displayTitle}</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        className="bg-amber-600 hover:bg-amber-700 gap-2"
        disabled={!maleId || !femaleId || isLoading}
        onClick={() => { setCalculated(true); refetch(); }}
      >
        <Calculator className="w-4 h-4" />
        {isLoading ? "Calculando..." : "Calcular cruzamento"}
      </Button>

      {/* Nota sem genótipo */}
      {maleId && !maleGeno?.mutations?.length && (
        <InlineAlert variant="warning">
          Macho {selectedMale?.ring} sem mutações cadastradas. Cadastre o genótipo na ficha do pássaro para resultados precisos.
        </InlineAlert>
      )}
      {femaleId && !femaleGeno?.mutations?.length && (
        <InlineAlert variant="warning">
          Fêmea {selectedFemale?.ring} sem mutações cadastradas. Cadastre o genótipo na ficha do pássaro para resultados precisos.
        </InlineAlert>
      )}

      {result && (
        <div className="space-y-4">
          {result.warnings?.map((w: string, i: number) => (
            <InlineAlert key={i} variant={w.includes("⚠️") ? "error" : "warning"}>{w}</InlineAlert>
          ))}
          {result.summary && (
            <Card className="border-green-100 bg-green-50">
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-green-800">{result.summary}</p>
              </CardContent>
            </Card>
          )}
          {Object.values(result.byMutation as Record<string, any>).map((mutResult: any) => (
            <MutationResultCard key={mutResult.mutationId} result={mutResult} />
          ))}
          {result.recommendations?.map((r: string, i: number) => (
            <p key={i} className="text-sm text-blue-700 flex items-start gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 mt-0.5 shrink-0" />{r}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modo Lipocromo ───────────────────────────────────────────────────────────

const LIPO_BASE_OPTIONS = [
  { value: "amarelo",           label: "Amarelo" },
  { value: "vermelho",          label: "Vermelho (fator vermelho)" },
  { value: "branco_dominante",  label: "Branco Dominante" },
  { value: "branco_recessivo",  label: "Branco Recessivo" },
  { value: "desconhecido",      label: "Desconhecido" },
];
const IVORY_OPTIONS = [
  { value: "nenhum",   label: "Sem marfim" },
  { value: "portador", label: "Portador (macho Z+Z-)" },
  { value: "visual",   label: "Visual (manifesta)" },
];
const FEATHER_OPTIONS = [
  { value: "intenso", label: "Intenso" },
  { value: "nevado",  label: "Nevado" },
];

function ModoLipocromo() {
  const [father, setFather] = useState({ base: "amarelo" as any, ivoryStatus: "nenhum" as any, featherType: "intenso" as any });
  const [mother, setMother] = useState({ base: "amarelo" as any, ivoryStatus: "nenhum" as any, featherType: "nevado" as any });
  const [calculated, setCalculated] = useState(false);

  const { data: result, isLoading, refetch } = trpc.genetics.calculateLipochromeCross.useQuery(
    { father, mother },
    { enabled: calculated }
  );

  return (
    <div className="space-y-5">
      <InlineAlert variant="info">
        Calcula a distribuição de lipocromo (cor de fundo) e alerta sobre plumagem double buffing, marfim e branco dominante.
      </InlineAlert>

      <div className="grid sm:grid-cols-2 gap-5">
        {[
          { label: "♂ Pai", data: father, set: setFather },
          { label: "♀ Mãe", data: mother, set: setMother },
        ].map(({ label, data, set }) => (
          <Card key={label}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Lipocromo base</p>
                <Select value={data.base} onValueChange={(v) => { set((p: any) => ({ ...p, base: v })); setCalculated(false); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LIPO_BASE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                  Marfim (ivory) <HelpTooltip text="Marfim é ligado ao sexo e dilui o lipocromo: amarelo→marfim claro, vermelho→salmão." />
                </p>
                <Select value={data.ivoryStatus} onValueChange={(v) => { set((p: any) => ({ ...p, ivoryStatus: v })); setCalculated(false); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{IVORY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                  Tipo de pluma <HelpTooltip text="Nevado × nevado = 25% double buffing (plumas moles excessivas). Prefira intenso × nevado." />
                </p>
                <Select value={data.featherType} onValueChange={(v) => { set((p: any) => ({ ...p, featherType: v })); setCalculated(false); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FEATHER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button className="bg-amber-600 hover:bg-amber-700 gap-2" onClick={() => { setCalculated(true); refetch(); }} disabled={isLoading}>
        <Calculator className="w-4 h-4" />{isLoading ? "Calculando..." : "Calcular lipocromo"}
      </Button>

      {result && (
        <div className="space-y-3">
          {result.warnings?.map((w: string, i: number) => (
            <InlineAlert key={i} variant={w.includes("⚠️") || w.includes("DOMINANTE") ? "error" : "warning"}>{w}</InlineAlert>
          ))}
          {result.expected?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Fenótipos esperados</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.expected.map((e: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-gray-800 font-medium">{e.phenotype}</span>
                        {e.notes && <span className="text-xs text-gray-400 ml-2">({e.notes})</span>}
                      </div>
                      <span className="font-semibold font-mono">{Math.round(e.probability * 100)}%</span>
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

// ─── Referência genética ──────────────────────────────────────────────────────

function ModoReferencia() {
  const { data: mutations = [] } = trpc.genetics.listMutations.useQuery();

  const groups = [
    { key: "sex_linked",          label: "Ligadas ao sexo (cromossomo Z)", icon: "🔗", color: "bg-rose-50 border-rose-200" },
    { key: "autosomal_recessive", label: "Autossômicas recessivas",          icon: "🔄", color: "bg-blue-50 border-blue-200" },
    { key: "autosomal_dominant",  label: "Autossômicas dominantes",          icon: "⬆️",  color: "bg-purple-50 border-purple-200" },
  ];

  return (
    <div className="space-y-5">
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-4">
          <p className="text-sm text-amber-800">
            <strong>Sistema ZZ/ZW dos canários:</strong> Machos têm dois cromossomos Z (ZZ). Fêmeas têm um Z e um W (ZW).
            Genes no cromossomo Z seguem regras especiais: <strong>fêmeas nunca são portadoras silenciosas</strong> — ou manifestam o gene ou não o possuem.
            Machos ZZ podem ser portadores (Z⁺Z⁻) sem manifestar.
          </p>
        </CardContent>
      </Card>

      {groups.map((group) => (
        <div key={group.key}>
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span>{group.icon}</span>{group.label}
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {mutations.filter((m) => m.inheritance === group.key).map((mut) => (
              <Card key={mut.id} className={`border ${group.color}`}>
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm text-gray-900">{mut.label}</p>
                    {mut.isLethalHomozygous && (
                      <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 shrink-0">⚠️ Letal</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mb-1">{mut.description}</p>
                  <p className="text-xs text-amber-700 italic">Efeito visual: {mut.phenotypeEffect}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function GeneticsCalculator() {
  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-5xl">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Dna className="w-8 h-8 text-amber-600" />
            Calculadora Genética
          </h1>
          <p className="text-gray-500 mt-1">
            Punnett quadrado completo · 18 mutações · Sistema ZZ/ZW · Alertas de risco letal
          </p>
        </div>

        <Tabs defaultValue="simples">
          <TabsList className="flex-wrap">
            <TabsTrigger value="simples"><Calculator className="w-4 h-4 mr-1.5" />Calculadora</TabsTrigger>
            <TabsTrigger value="plantel"><Users className="w-4 h-4 mr-1.5" />Casal do Plantel</TabsTrigger>
            <TabsTrigger value="lipocromo"><Sparkles className="w-4 h-4 mr-1.5" />Lipocromo & Pluma</TabsTrigger>
            <TabsTrigger value="referencia"><BookOpen className="w-4 h-4 mr-1.5" />Referência</TabsTrigger>
          </TabsList>

          <TabsContent value="simples"    className="mt-5"><ModoSimples /></TabsContent>
          <TabsContent value="plantel"    className="mt-5"><ModoCasalPlantel /></TabsContent>
          <TabsContent value="lipocromo"  className="mt-5"><ModoLipocromo /></TabsContent>
          <TabsContent value="referencia" className="mt-5"><ModoReferencia /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
