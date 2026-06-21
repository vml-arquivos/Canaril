import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import {
  Calculator,
  AlertTriangle,
  Info,
  Dna,
  Bird,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle,
} from "lucide-react";

// ============================================================================
// Constantes e tipos
// ============================================================================

/** Sentinela para "não informado" — o Radix UI proíbe value="" em SelectItem */
const NONE_VALUE = "__none__";

const ZYGOSITY_LABELS: Record<string, string> = {
  // Sexo-ligadas — machos (ZZ)
  "Z+Z+": "Z⁺Z⁺ — Visual homozigoto",
  "Z+Z-": "Z⁺Z⁻ — Portador (heterozigoto)",
  "Z-Z-": "Z⁻Z⁻ — Normal (sem mutação)",
  // Sexo-ligadas — fêmeas (ZW)
  "Z+W": "Z⁺W — Visual (fêmea manifesta)",
  "Z-W": "Z⁻W — Normal (sem mutação)",
  // Autossômicas recessivas
  mm: "mm — Visual (homozigoto mutante)",
  Nm: "Nm — Portador (heterozigoto)",
  NN: "NN — Normal (sem mutação)",
  // Autossômicas dominantes
  Nn: "Nn — Visual dose simples",
  // NN e nn reaproveitam as entradas acima quando aplicável
  nn: "nn — Não visual",
};

const ZYGOSITY_COLORS: Record<string, string> = {
  "Z+Z+": "bg-amber-100 text-amber-800 border-amber-200",
  "Z+Z-": "bg-blue-100 text-blue-800 border-blue-200",
  "Z-Z-": "bg-gray-100 text-gray-700 border-gray-200",
  "Z+W": "bg-amber-100 text-amber-800 border-amber-200",
  "Z-W": "bg-gray-100 text-gray-700 border-gray-200",
  mm: "bg-amber-100 text-amber-800 border-amber-200",
  Nm: "bg-blue-100 text-blue-800 border-blue-200",
  NN: "bg-gray-100 text-gray-700 border-gray-200",
  Nn: "bg-purple-100 text-purple-800 border-purple-200",
  nn: "bg-gray-100 text-gray-700 border-gray-200",
};

const MUTATIONS = [
  { id: "agata",           label: "Ágata",                      inheritance: "sex_linked"          as const },
  { id: "canela",          label: "Canela",                     inheritance: "sex_linked"          as const },
  { id: "ino",             label: "Ino (Lutino / Albino / Rubino)", inheritance: "sex_linked"      as const },
  { id: "pastel",          label: "Pastel",                     inheritance: "autosomal_recessive" as const },
  { id: "opala",           label: "Opalino",                    inheritance: "autosomal_recessive" as const },
  { id: "crista",          label: "Crista / Topete",            inheritance: "autosomal_dominant"  as const },
  { id: "brancoDominante", label: "Branco Dominante",           inheritance: "autosomal_dominant"  as const },
  { id: "plumagem",        label: "Plumagem (Nevado / Intenso)", inheritance: "autosomal_dominant" as const },
];

type ZygosityAR = "NN" | "Nm" | "mm";
type ZygosityMaleSL = "Z+Z+" | "Z+Z-" | "Z-Z-";
type ZygosityFemaleSL = "Z+W" | "Z-W";
type ZygosityDom = "nn" | "Nn" | "NN";

interface ParentGenotype {
  sex: "macho" | "fêmea";
  agata?: ZygosityMaleSL | ZygosityFemaleSL;
  canela?: ZygosityMaleSL | ZygosityFemaleSL;
  ino?: ZygosityMaleSL | ZygosityFemaleSL;
  pastel?: ZygosityAR;
  opala?: ZygosityAR;
  crista?: ZygosityDom;
  brancoDominante?: ZygosityDom;
  plumagem?: ZygosityDom;
}

// ============================================================================
// Helpers
// ============================================================================

function getZygosityOptions(mutationId: string, sex: "macho" | "fêmea") {
  const mutation = MUTATIONS.find((m) => m.id === mutationId);
  if (!mutation) return [];

  if (mutation.inheritance === "sex_linked") {
    if (sex === "macho") {
      return [
        { value: "Z+Z+", label: "Z⁺Z⁺ — Visual homozigoto" },
        { value: "Z+Z-", label: "Z⁺Z⁻ — Portador (heterozigoto)" },
        { value: "Z-Z-", label: "Z⁻Z⁻ — Normal (sem mutação)" },
      ];
    } else {
      return [
        { value: "Z+W", label: "Z⁺W — Visual (fêmea sempre manifesta)" },
        { value: "Z-W", label: "Z⁻W — Normal (sem mutação)" },
      ];
    }
  } else if (mutation.inheritance === "autosomal_recessive") {
    return [
      { value: "mm", label: "mm — Visual (homozigoto mutante)" },
      { value: "Nm", label: "Nm — Portador (heterozigoto)" },
      { value: "NN", label: "NN — Normal (sem mutação)" },
    ];
  } else {
    return [
      { value: "NN", label: "NN — Visual dose dupla (risco letal em crista/branco dom.)" },
      { value: "Nn", label: "Nn — Visual dose simples" },
      { value: "nn", label: "nn — Não visual" },
    ];
  }
}

/** Converte o valor do Select para o genótipo real (undefined se NONE_VALUE) */
function selectValueToGenotype(v: string): string | undefined {
  return v === NONE_VALUE ? undefined : v;
}

/** Converte o genótipo para o valor do Select (NONE_VALUE se undefined/null) */
function genotypeToSelectValue(v: string | undefined): string {
  return v ?? NONE_VALUE;
}

function inheritanceLabel(inh: string) {
  if (inh === "sex_linked") return "ligada ao sexo";
  if (inh === "autosomal_recessive") return "autossômica recessiva";
  return "autossômica dominante";
}

// ============================================================================
// Sub-componentes
// ============================================================================

function ProbabilityBar({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="w-40 text-sm text-gray-600 shrink-0 leading-tight">{label}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-12 text-sm font-semibold text-right text-gray-700">{pct}%</div>
    </div>
  );
}

// ============================================================================
// Componente principal
// ============================================================================

export default function GeneticsCalculator() {
  const [male, setMale] = useState<ParentGenotype>({ sex: "macho" });
  const [female, setFemale] = useState<ParentGenotype>({ sex: "fêmea" });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [calculated, setCalculated] = useState(false);

  const { data: result, isLoading, refetch, error } = trpc.genetics.calculateColorCross.useQuery(
    { male, female },
    {
      enabled: calculated,
      retry: false,
    }
  );

  function handleCalculate() {
    setCalculated(true);
    refetch();
  }

  function handleReset() {
    setMale({ sex: "macho" });
    setFemale({ sex: "fêmea" });
    setCalculated(false);
  }

  function setMutation(parent: "male" | "female", mutationId: string, rawValue: string) {
    const value = selectValueToGenotype(rawValue);
    if (parent === "male") {
      setMale((prev) => {
        const next = { ...prev };
        if (value === undefined) {
          delete (next as any)[mutationId];
        } else {
          (next as any)[mutationId] = value;
        }
        return next;
      });
    } else {
      setFemale((prev) => {
        const next = { ...prev };
        if (value === undefined) {
          delete (next as any)[mutationId];
        } else {
          (next as any)[mutationId] = value;
        }
        return next;
      });
    }
    setCalculated(false);
  }

  const hasAnyMutation =
    Object.keys(male).filter((k) => k !== "sex").length > 0 ||
    Object.keys(female).filter((k) => k !== "sex").length > 0;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Cabeçalho */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Calculator className="w-6 h-6 text-amber-600" />
              Calculadora Genética
            </h1>
            <p className="text-gray-500 mt-1 text-sm max-w-xl">
              Simule cruzamentos e calcule probabilidades de filhotes com base nas leis de Mendel.
              Selecione os genótipos do macho e da fêmea para começar.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Limpar tudo
          </Button>
        </div>

        {/* Aviso informativo */}
        <Alert className="border-amber-200 bg-amber-50">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            Esta calculadora usa as leis de Mendel para calcular probabilidades teóricas.
            Os resultados são estimativas — a natureza sempre tem variação.
            <strong className="block mt-1">
              Regra importante: fêmeas com mutações ligadas ao sexo nunca são portadoras silenciosas —
              se receberam o gene, manifestam visualmente (sistema ZW dos canários).
            </strong>
          </AlertDescription>
        </Alert>

        {/* Seleção de genótipos */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Macho */}
          <Card className="border-blue-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bird className="w-4 h-4 text-blue-600" />
                Macho (ZZ)
              </CardTitle>
              <CardDescription>Configure o genótipo do macho</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {MUTATIONS.map((mutation) => (
                <div key={mutation.id} className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    {mutation.label}
                    <span className="ml-1 text-xs text-gray-400 font-normal">
                      ({inheritanceLabel(mutation.inheritance)})
                    </span>
                  </label>
                  <Select
                    value={genotypeToSelectValue((male as any)[mutation.id])}
                    onValueChange={(v) => setMutation("male", mutation.id, v)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Não informado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>— Não informado —</SelectItem>
                      {getZygosityOptions(mutation.id, "macho").map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Fêmea */}
          <Card className="border-pink-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bird className="w-4 h-4 text-pink-600" />
                Fêmea (ZW)
              </CardTitle>
              <CardDescription>Configure o genótipo da fêmea</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {MUTATIONS.map((mutation) => (
                <div key={mutation.id} className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    {mutation.label}
                    <span className="ml-1 text-xs text-gray-400 font-normal">
                      ({inheritanceLabel(mutation.inheritance)})
                    </span>
                  </label>
                  <Select
                    value={genotypeToSelectValue((female as any)[mutation.id])}
                    onValueChange={(v) => setMutation("female", mutation.id, v)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Não informado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>— Não informado —</SelectItem>
                      {getZygosityOptions(mutation.id, "fêmea").map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Botão calcular */}
        <div className="flex flex-col items-center gap-3">
          {!hasAnyMutation && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              Selecione ao menos uma mutação para o macho ou para a fêmea antes de calcular.
            </p>
          )}
          <Button
            size="lg"
            onClick={handleCalculate}
            disabled={isLoading || !hasAnyMutation}
            className="bg-amber-600 hover:bg-amber-700 text-white px-10 text-base"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Calculando...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Calcular Cruzamento
              </>
            )}
          </Button>
        </div>

        {/* Erro da API */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 text-sm">
              Erro ao calcular: {error.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Resultados */}
        {result && calculated && (
          <div className="space-y-6">
            <Separator />

            {/* Confirmação de sucesso */}
            <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              Cálculo concluído com base nas leis de Mendel
            </div>

            {/* Alertas de risco */}
            {result.warnings && result.warnings.length > 0 && (
              <div className="space-y-2">
                {result.warnings.map((warning: string, i: number) => (
                  <Alert key={i} className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800 text-sm font-medium">{warning}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {/* Resumo geral */}
            {result.summary && (
              <Card className="border-amber-100 bg-amber-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Dna className="w-4 h-4 text-amber-600" />
                    Resumo do Cruzamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 leading-relaxed">{result.summary}</p>
                </CardContent>
              </Card>
            )}

            {/* Distribuição dos filhotes — primeira mutação configurada */}
            {result.byMutation && Object.keys(result.byMutation).length > 0 && (() => {
              // Mostra o resumo visual da primeira mutação com dados
              const firstMut = Object.values(result.byMutation).find(
                (m: any) => m.sons || m.daughters || m.offspring
              ) as any;
              if (!firstMut) return null;

              if (firstMut.sons && firstMut.daughters) {
                return (
                  <div className="grid md:grid-cols-2 gap-6">
                    <Card className="border-blue-100">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base text-blue-800">
                          Filhos Machos — Probabilidades
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {Object.entries(firstMut.sons as Record<string, number>).map(([genotype, prob]) => (
                          <ProbabilityBar
                            key={genotype}
                            label={ZYGOSITY_LABELS[genotype] ?? genotype}
                            value={prob}
                            color="bg-blue-400"
                          />
                        ))}
                      </CardContent>
                    </Card>
                    <Card className="border-pink-100">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base text-pink-800">
                          Filhas Fêmeas — Probabilidades
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {Object.entries(firstMut.daughters as Record<string, number>).map(([genotype, prob]) => (
                          <ProbabilityBar
                            key={genotype}
                            label={ZYGOSITY_LABELS[genotype] ?? genotype}
                            value={prob}
                            color="bg-pink-400"
                          />
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                );
              } else if (firstMut.offspring) {
                return (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Distribuição dos Filhotes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {Object.entries(firstMut.offspring as Record<string, number>).map(([genotype, prob]) => (
                        <ProbabilityBar
                          key={genotype}
                          label={ZYGOSITY_LABELS[genotype] ?? genotype}
                          value={prob}
                          color="bg-amber-400"
                        />
                      ))}
                    </CardContent>
                  </Card>
                );
              }
              return null;
            })()}

            {/* Detalhes por mutação (expansível) */}
            {result.byMutation && Object.keys(result.byMutation).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <button
                    className="flex items-center justify-between w-full text-left"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    type="button"
                  >
                    <CardTitle className="text-base">Detalhes por Mutação</CardTitle>
                    {showAdvanced
                      ? <ChevronUp className="w-4 h-4 text-gray-500" />
                      : <ChevronDown className="w-4 h-4 text-gray-500" />
                    }
                  </button>
                </CardHeader>
                {showAdvanced && (
                  <CardContent>
                    <div className="space-y-6">
                      {Object.entries(result.byMutation as Record<string, any>).map(([mutId, mutResult]) => {
                        const mutation = MUTATIONS.find((m) => m.id === mutId);
                        return (
                          <div key={mutId}>
                            <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                              <Dna className="w-3.5 h-3.5 text-amber-600" />
                              {mutation?.label ?? mutId}
                              <Badge variant="outline" className="text-xs">
                                {mutation ? inheritanceLabel(mutation.inheritance) : mutId}
                              </Badge>
                            </h4>

                            {mutResult.sons && (
                              <div className="mb-3">
                                <p className="text-xs text-gray-500 mb-1.5 font-medium">Filhos machos:</p>
                                <div className="space-y-2">
                                  {Object.entries(mutResult.sons as Record<string, number>).map(([g, p]) => (
                                    <ProbabilityBar key={g} label={ZYGOSITY_LABELS[g] ?? g} value={p} color="bg-blue-300" />
                                  ))}
                                </div>
                              </div>
                            )}

                            {mutResult.daughters && (
                              <div className="mb-3">
                                <p className="text-xs text-gray-500 mb-1.5 font-medium">Filhas fêmeas:</p>
                                <div className="space-y-2">
                                  {Object.entries(mutResult.daughters as Record<string, number>).map(([g, p]) => (
                                    <ProbabilityBar key={g} label={ZYGOSITY_LABELS[g] ?? g} value={p} color="bg-pink-300" />
                                  ))}
                                </div>
                              </div>
                            )}

                            {mutResult.offspring && !mutResult.sons && (
                              <div className="space-y-2">
                                {Object.entries(mutResult.offspring as Record<string, number>).map(([g, p]) => (
                                  <ProbabilityBar key={g} label={ZYGOSITY_LABELS[g] ?? g} value={p} color="bg-amber-300" />
                                ))}
                              </div>
                            )}

                            {mutResult.warnings && mutResult.warnings.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {mutResult.warnings.map((w: string, i: number) => (
                                  <p key={i} className="text-xs text-red-600 flex items-start gap-1">
                                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                    {w}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Legenda */}
            <Card className="border-gray-100 bg-gray-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">Legenda Genética</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { key: "Z+Z+", label: "Visual homozigoto (macho)" },
                    { key: "Z+Z-", label: "Portador (macho heterozigoto)" },
                    { key: "Z-Z-", label: "Normal sem mutação (macho)" },
                    { key: "Z+W",  label: "Visual (fêmea manifesta)" },
                    { key: "Z-W",  label: "Normal sem mutação (fêmea)" },
                    { key: "mm",   label: "Visual homozigoto (autossômico)" },
                    { key: "Nm",   label: "Portador (autossômico recessivo)" },
                    { key: "NN",   label: "Normal (autossômico)" },
                    { key: "Nn",   label: "Visual dose simples (dominante)" },
                    { key: "nn",   label: "Não visual (dominante)" },
                  ].map(({ key, label }) => (
                    <div key={key} className={`rounded-lg border px-3 py-2 text-xs ${ZYGOSITY_COLORS[key] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
                      <strong className="block font-mono">{key}</strong>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  <strong>Regra fundamental:</strong> Fêmeas com mutações ligadas ao sexo nunca são portadoras
                  silenciosas — se receberam o gene, manifestam visualmente (sistema ZW dos canários).
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Estado vazio — antes de calcular */}
        {!calculated && (
          <Card className="border-dashed border-amber-200 bg-amber-50/30">
            <CardContent className="py-12 text-center">
              <Calculator className="w-12 h-12 text-amber-300 mx-auto mb-4" />
              <p className="text-amber-700 font-semibold text-lg">Configure os genótipos e clique em Calcular</p>
              <p className="text-amber-600/70 text-sm mt-2 max-w-md mx-auto">
                Selecione ao menos uma mutação para o macho ou para a fêmea.
                Os resultados mostrarão as probabilidades de cada genótipo nos filhotes.
              </p>
              <div className="mt-6 grid sm:grid-cols-3 gap-3 text-left max-w-lg mx-auto">
                <div className="bg-white rounded-lg border border-amber-100 p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Ligadas ao sexo</p>
                  <p className="text-xs text-gray-500">Ágata, Canela, Ino — machos portam, fêmeas manifestam</p>
                </div>
                <div className="bg-white rounded-lg border border-amber-100 p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Autossômicas recessivas</p>
                  <p className="text-xs text-gray-500">Pastel, Opalino — dois portadores para manifestar</p>
                </div>
                <div className="bg-white rounded-lg border border-amber-100 p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Autossômicas dominantes</p>
                  <p className="text-xs text-gray-500">Crista, Branco Dom. — uma cópia já manifesta</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
