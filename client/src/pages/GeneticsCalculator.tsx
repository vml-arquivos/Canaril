import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  BookOpen,
  FlaskConical,
  Users,
} from "lucide-react";

// ============================================================================
// Constantes e tipos
// ============================================================================

/** Sentinela para "não informado" — o Radix UI proíbe value="" em SelectItem */
const NONE_VALUE = "__none__";

const ZYGOSITY_LABELS: Record<string, string> = {
  "Z+Z+": "Z⁺Z⁺ — Visual homozigoto",
  "Z+Z-": "Z⁺Z⁻ — Portador (heterozigoto)",
  "Z-Z-": "Z⁻Z⁻ — Normal (sem mutação)",
  "Z+W": "Z⁺W — Visual (fêmea manifesta)",
  "Z-W": "Z⁻W — Normal (sem mutação)",
  mm: "mm — Visual (homozigoto mutante)",
  Nm: "Nm — Portador (heterozigoto)",
  NN: "NN — Normal (sem mutação)",
  Nn: "Nn — Visual dose simples",
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
  { id: "agata",           label: "Ágata",                          inheritance: "sex_linked"          as const },
  { id: "canela",          label: "Canela",                         inheritance: "sex_linked"          as const },
  { id: "ino",             label: "Ino (Lutino / Albino / Rubino)", inheritance: "sex_linked"          as const },
  { id: "pastel",          label: "Pastel",                         inheritance: "autosomal_recessive" as const },
  { id: "opala",           label: "Opalino",                        inheritance: "autosomal_recessive" as const },
  { id: "crista",          label: "Crista / Topete",                inheritance: "autosomal_dominant"  as const },
  { id: "brancoDominante", label: "Branco Dominante",               inheritance: "autosomal_dominant"  as const },
  { id: "plumagem",        label: "Plumagem (Nevado / Intenso)",    inheritance: "autosomal_dominant"  as const },
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
  [key: string]: string | undefined;
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

function selectValueToGenotype(v: string): string | undefined {
  return v === NONE_VALUE ? undefined : v;
}

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
// Modo Simples — Calculadora Punnett (motor existente via tRPC)
// ============================================================================

function ModoSimples() {
  const [male, setMale] = useState<ParentGenotype>({ sex: "macho" });
  const [female, setFemale] = useState<ParentGenotype>({ sex: "fêmea" });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [calculated, setCalculated] = useState(false);

  const { data: result, isLoading, refetch, error } = trpc.genetics.calculateColorCross.useQuery(
    { male, female },
    { enabled: calculated, retry: false }
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
        if (value === undefined) delete (next as Record<string, unknown>)[mutationId];
        else (next as Record<string, unknown>)[mutationId] = value;
        return next;
      });
    } else {
      setFemale((prev) => {
        const next = { ...prev };
        if (value === undefined) delete (next as Record<string, unknown>)[mutationId];
        else (next as Record<string, unknown>)[mutationId] = value;
        return next;
      });
    }
    setCalculated(false);
  }

  const hasAnyMutation =
    Object.keys(male).filter((k) => k !== "sex").length > 0 ||
    Object.keys(female).filter((k) => k !== "sex").length > 0;

  return (
    <div className="space-y-6">
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

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Limpar tudo
        </Button>
      </div>

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
                  value={genotypeToSelectValue((male as unknown as Record<string, string | undefined>)[mutation.id])}
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
                  value={genotypeToSelectValue((female as unknown as Record<string, string | undefined>)[mutation.id])}
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
            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Calculando...</>
          ) : (
            <><Zap className="w-4 h-4 mr-2" />Calcular Cruzamento</>
          )}
        </Button>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 text-sm">
            Erro ao calcular: {error.message}
          </AlertDescription>
        </Alert>
      )}

      {result && calculated && (
        <div className="space-y-6">
          <Separator />
          <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Cálculo concluído com base nas leis de Mendel
          </div>

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

          {result.byMutation && Object.keys(result.byMutation).length > 0 && (() => {
            const firstMut = Object.values(result.byMutation).find(
              (m: unknown) => (m as Record<string, unknown>).sons || (m as Record<string, unknown>).daughters || (m as Record<string, unknown>).offspring
            ) as Record<string, unknown> | undefined;
            if (!firstMut) return null;

            if (firstMut.sons && firstMut.daughters) {
              return (
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="border-blue-100">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base text-blue-800">Filhos Machos — Probabilidades</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {Object.entries(firstMut.sons as Record<string, number>).map(([genotype, prob]) => (
                        <ProbabilityBar key={genotype} label={ZYGOSITY_LABELS[genotype] ?? genotype} value={prob} color="bg-blue-400" />
                      ))}
                    </CardContent>
                  </Card>
                  <Card className="border-pink-100">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base text-pink-800">Filhas Fêmeas — Probabilidades</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {Object.entries(firstMut.daughters as Record<string, number>).map(([genotype, prob]) => (
                        <ProbabilityBar key={genotype} label={ZYGOSITY_LABELS[genotype] ?? genotype} value={prob} color="bg-pink-400" />
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
                      <ProbabilityBar key={genotype} label={ZYGOSITY_LABELS[genotype] ?? genotype} value={prob} color="bg-amber-400" />
                    ))}
                  </CardContent>
                </Card>
              );
            }
            return null;
          })()}

          {result.byMutation && Object.keys(result.byMutation).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <button
                  className="flex items-center justify-between w-full text-left"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  type="button"
                >
                  <CardTitle className="text-base">Detalhes por Mutação</CardTitle>
                  {showAdvanced ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>
              </CardHeader>
              {showAdvanced && (
                <CardContent>
                  <div className="space-y-6">
                    {Object.entries(result.byMutation as Record<string, {sons?: Record<string, number>; daughters?: Record<string, number>; offspring?: Record<string, number>; warnings?: string[]}>).map(([mutId, mutResult]) => {
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
                          {Array.isArray(mutResult.warnings) && mutResult.warnings.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {(mutResult.warnings as string[]).map((w, i) => (
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
  );
}

// ============================================================================
// Modo Assistido — Seleção por classe oficial FOB/OBJO
// ============================================================================

function ModoAssistido() {
  const [maleClass, setMaleClass] = useState(NONE_VALUE);
  const [femaleClass, setFemaleClass] = useState(NONE_VALUE);
  const [maleModality, setMaleModality] = useState<"COR" | "PORTE">("COR");
  const [femaleModality, setFemaleModality] = useState<"COR" | "PORTE">("COR");
  const [maleSearch, setMaleSearch] = useState("");
  const [femaleSearch, setFemaleSearch] = useState("");

  const maleClasses = trpc.catalog.searchOfficialClasses.useQuery(
    { query: maleSearch, modality: maleModality, limit: 80 },
    { enabled: true }
  );
  const femaleClasses = trpc.catalog.searchOfficialClasses.useQuery(
    { query: femaleSearch, modality: femaleModality, limit: 80 },
    { enabled: true }
  );

  const maleClassData = (maleClasses.data && 'items' in maleClasses.data ? maleClasses.data.items : (maleClasses.data as unknown as typeof maleClasses.data extends {items: infer I} ? I : never[]) ?? [])?.find((c: {officialCode: string}) => c.officialCode === maleClass);
  const femaleClassData = (femaleClasses.data && 'items' in femaleClasses.data ? femaleClasses.data.items : (femaleClasses.data as unknown as typeof femaleClasses.data extends {items: infer I} ? I : never[]) ?? [])?.find((c: {officialCode: string}) => c.officialCode === femaleClass);

  const maleInterp = trpc.geneticProfile.interpretClass.useQuery(
    {
      officialCode: maleClassData?.officialCode ?? "",
      officialName: maleClassData?.officialName ?? "",
      modality: maleModality,
    },
    { enabled: !!maleClassData }
  );

  const femaleInterp = trpc.geneticProfile.interpretClass.useQuery(
    {
      officialCode: femaleClassData?.officialCode ?? "",
      officialName: femaleClassData?.officialName ?? "",
      modality: femaleModality,
    },
    { enabled: !!femaleClassData }
  );

  return (
    <div className="space-y-6">
      <Alert className="border-blue-200 bg-blue-50">
        <BookOpen className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800">Nomenclatura Oficial FOB/OBJO</AlertTitle>
        <AlertDescription className="text-blue-700 text-sm">
          Selecione a classe oficial de cada progenitor. O sistema interpreta automaticamente os
          traços genéticos com base na nomenclatura FOB/OBJO e sugere as mutações presentes.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Macho */}
        <Card className="border-blue-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bird className="w-4 h-4 text-blue-600" />
              Progenitor Macho
              <Badge variant="outline">♂</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Select value={maleModality} onValueChange={(v) => { setMaleModality(v as "COR" | "PORTE"); setMaleClass(NONE_VALUE); }}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COR">Cor</SelectItem>
                  <SelectItem value="PORTE">Porte</SelectItem>
                </SelectContent>
              </Select>
              <input
                className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="Buscar (ex: ágata, gloster...)"
                value={maleSearch}
                onChange={(e) => setMaleSearch(e.target.value)}
              />
            </div>
            <Select value={maleClass} onValueChange={setMaleClass}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a classe oficial" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value={NONE_VALUE}>— Selecione a classe —</SelectItem>
                {((maleClasses.data && 'items' in maleClasses.data ? maleClasses.data.items : []) as Array<{officialCode: string; officialName: string}>).map((c) => (
                  <SelectItem key={c.officialCode} value={c.officialCode}>
                    <span className="font-mono text-xs text-gray-400 mr-2">{c.officialCode}</span>
                    {c.officialName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {maleInterp.data && !("error" in maleInterp.data) && (
              <div className="bg-blue-50 rounded-lg p-3 space-y-1 text-xs border border-blue-100">
                <p className="font-semibold text-blue-800 mb-1">Traços interpretados:</p>
                <p><strong>Lipocromo:</strong> {maleInterp.data.lipochromeBase ?? "—"}</p>
                <p><strong>Melanina:</strong> {maleInterp.data.melaninSeries ?? "—"}</p>
                <p><strong>Categoria:</strong> {maleInterp.data.featherCategory ?? "—"}</p>
                {(maleInterp.data.visibleMutations?.length ?? 0) > 0 && (
                  <p><strong>Mutações:</strong> {maleInterp.data.visibleMutations?.join(", ")}</p>
                )}
                {(maleInterp.data.geneticWarnings?.length ?? 0) > 0 && (
                  <div className="mt-2 space-y-1">
                    {maleInterp.data.geneticWarnings?.map((w, i) => (
                      <p key={i} className="text-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" /> {w}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fêmea */}
        <Card className="border-pink-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bird className="w-4 h-4 text-pink-600" />
              Progenitor Fêmea
              <Badge variant="outline">♀</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Select value={femaleModality} onValueChange={(v) => { setFemaleModality(v as "COR" | "PORTE"); setFemaleClass(NONE_VALUE); }}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COR">Cor</SelectItem>
                  <SelectItem value="PORTE">Porte</SelectItem>
                </SelectContent>
              </Select>
              <input
                className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="Buscar (ex: canela, yorkshire...)"
                value={femaleSearch}
                onChange={(e) => setFemaleSearch(e.target.value)}
              />
            </div>
            <Select value={femaleClass} onValueChange={setFemaleClass}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a classe oficial" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value={NONE_VALUE}>— Selecione a classe —</SelectItem>
                {((femaleClasses.data && 'items' in femaleClasses.data ? femaleClasses.data.items : []) as Array<{officialCode: string; officialName: string}>).map((c) => (
                  <SelectItem key={c.officialCode} value={c.officialCode}>
                    <span className="font-mono text-xs text-gray-400 mr-2">{c.officialCode}</span>
                    {c.officialName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {femaleInterp.data && !("error" in femaleInterp.data) && (
              <div className="bg-pink-50 rounded-lg p-3 space-y-1 text-xs border border-pink-100">
                <p className="font-semibold text-pink-800 mb-1">Traços interpretados:</p>
                <p><strong>Lipocromo:</strong> {femaleInterp.data.lipochromeBase ?? "—"}</p>
                <p><strong>Melanina:</strong> {femaleInterp.data.melaninSeries ?? "—"}</p>
                <p><strong>Categoria:</strong> {femaleInterp.data.featherCategory ?? "—"}</p>
                {(femaleInterp.data.visibleMutations?.length ?? 0) > 0 && (
                  <p><strong>Mutações:</strong> {femaleInterp.data.visibleMutations?.join(", ")}</p>
                )}
                {(femaleInterp.data.geneticWarnings?.length ?? 0) > 0 && (
                  <div className="mt-2 space-y-1">
                    {femaleInterp.data.geneticWarnings?.map((w, i) => (
                      <p key={i} className="text-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" /> {w}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {maleClass !== NONE_VALUE && femaleClass !== NONE_VALUE && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Classes selecionadas</AlertTitle>
          <AlertDescription className="text-green-700 text-sm">
            Para calcular os filhotes com base nas mutações interpretadas, use o{" "}
            <strong>Modo Simples</strong> com os genótipos sugeridos acima, ou o{" "}
            <strong>Modo Avançado</strong> para selecionar pássaros do plantel com perfil genético cadastrado.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ============================================================================
// Modo Avançado — Seleção de pássaros do plantel
// ============================================================================

function ModoAvancado() {
  const [maleId, setMaleId] = useState(NONE_VALUE);
  const [femaleId, setFemaleId] = useState(NONE_VALUE);
  const [calculated, setCalculated] = useState(false);

  const birdsQuery = trpc.birds.list.useQuery({ status: "active" });
  const males = (birdsQuery.data ?? []).filter((b) => b.sex === "macho" || b.sex === "M");
  const females = (birdsQuery.data ?? []).filter((b) => b.sex === "fêmea" || b.sex === "F");

  const maleProfile = trpc.geneticProfile.getByBird.useQuery(
    { birdId: Number(maleId) },
    { enabled: maleId !== NONE_VALUE }
  );
  const femaleProfile = trpc.geneticProfile.getByBird.useQuery(
    { birdId: Number(femaleId) },
    { enabled: femaleId !== NONE_VALUE }
  );

  const crossResult = trpc.genetics.calculateColorCross.useQuery(
    {
      male: {
        sex: "macho",
        ...(maleProfile.data?.genotypeJson as Record<string, string> ?? {}),
      },
      female: {
        sex: "fêmea",
        ...(femaleProfile.data?.genotypeJson as Record<string, string> ?? {}),
      },
    },
    { enabled: calculated && maleId !== NONE_VALUE && femaleId !== NONE_VALUE, retry: false }
  );

  const hasBothProfiles: boolean =
    maleId !== NONE_VALUE &&
    femaleId !== NONE_VALUE &&
    !!maleProfile.data?.genotypeJson &&
    !!femaleProfile.data?.genotypeJson;

  return (
    <div className="space-y-6">
      <Alert className="border-purple-200 bg-purple-50">
        <FlaskConical className="h-4 w-4 text-purple-600" />
        <AlertTitle className="text-purple-800">Plantel Real — Perfis Genéticos Cadastrados</AlertTitle>
        <AlertDescription className="text-purple-700 text-sm">
          Selecione dois pássaros do seu plantel. O sistema usa os perfis genéticos cadastrados
          para calcular os filhotes esperados com maior precisão. Acesse a ficha de cada pássaro
          para preencher o perfil genético.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Macho do plantel */}
        <Card className="border-purple-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              Macho do Plantel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={maleId} onValueChange={(v) => { setMaleId(v); setCalculated(false); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o macho" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value={NONE_VALUE}>— Selecione o macho —</SelectItem>
                {males.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.ring} — {b.color_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {maleProfile.data && (
              <div className="bg-purple-50 rounded-lg p-3 text-xs space-y-1 border border-purple-100">
                <p className="font-semibold text-purple-800">Perfil genético:</p>
                <p><strong>Lipocromo:</strong> {maleProfile.data.lipochromeBase ?? "Não cadastrado"}</p>
                <p><strong>Melanina:</strong> {maleProfile.data.melaninSeries ?? "Não cadastrado"}</p>
                <p><strong>Categoria:</strong> {maleProfile.data.featherCategory ?? "Não cadastrado"}</p>
                <p><strong>Confiança:</strong> {Math.round((maleProfile.data.confidenceScore ?? 0) * 100)}%</p>
                {maleProfile.data.manualOverride && (
                  <Badge className="bg-green-100 text-green-800 text-xs mt-1">✓ Verificado manualmente</Badge>
                )}
              </div>
            )}
            {maleId !== NONE_VALUE && !maleProfile.data && !maleProfile.isLoading && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded p-2 border border-amber-100">
                Este pássaro não tem perfil genético cadastrado. Acesse sua ficha para preencher.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Fêmea do plantel */}
        <Card className="border-rose-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-rose-600" />
              Fêmea do Plantel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={femaleId} onValueChange={(v) => { setFemaleId(v); setCalculated(false); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a fêmea" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value={NONE_VALUE}>— Selecione a fêmea —</SelectItem>
                {females.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.ring} — {b.color_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {femaleProfile.data && (
              <div className="bg-rose-50 rounded-lg p-3 text-xs space-y-1 border border-rose-100">
                <p className="font-semibold text-rose-800">Perfil genético:</p>
                <p><strong>Lipocromo:</strong> {femaleProfile.data.lipochromeBase ?? "Não cadastrado"}</p>
                <p><strong>Melanina:</strong> {femaleProfile.data.melaninSeries ?? "Não cadastrado"}</p>
                <p><strong>Categoria:</strong> {femaleProfile.data.featherCategory ?? "Não cadastrado"}</p>
                <p><strong>Confiança:</strong> {Math.round((femaleProfile.data.confidenceScore ?? 0) * 100)}%</p>
                {femaleProfile.data.manualOverride && (
                  <Badge className="bg-green-100 text-green-800 text-xs mt-1">✓ Verificado manualmente</Badge>
                )}
              </div>
            )}
            {femaleId !== NONE_VALUE && !femaleProfile.data && !femaleProfile.isLoading && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded p-2 border border-amber-100">
                Esta pássara não tem perfil genético cadastrado. Acesse sua ficha para preencher.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {!hasBothProfiles && maleId !== NONE_VALUE && femaleId !== NONE_VALUE && (
        <Alert className="border-amber-200 bg-amber-50">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            Um ou ambos os pássaros não têm perfil genético com genótipo cadastrado.
            Preencha as fichas genéticas para usar o Modo Avançado, ou use o{" "}
            <strong>Modo Simples</strong> para calcular manualmente.
          </AlertDescription>
        </Alert>
      )}

      {hasBothProfiles && (
        <div className="flex justify-center">
          <Button
            size="lg"
            className="bg-purple-600 hover:bg-purple-700 text-white px-10"
            onClick={() => setCalculated(true)}
            disabled={crossResult.isLoading}
          >
            {crossResult.isLoading ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Calculando...</>
            ) : (
              <><Zap className="w-4 h-4 mr-2" />Calcular com Perfis do Plantel</>
            )}
          </Button>
        </div>
      )}

      {crossResult.data && calculated && (
        <div className="space-y-4">
          <Separator />
          <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Cálculo concluído com base nos perfis genéticos cadastrados
          </div>
          {crossResult.data.warnings && crossResult.data.warnings.length > 0 && (
            <div className="space-y-2">
              {crossResult.data.warnings.map((w: string, i: number) => (
                <Alert key={i} className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800 text-sm font-medium">{w}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}
          {crossResult.data.summary && (
            <Card className="border-purple-100 bg-purple-50/30">
              <CardContent className="pt-4">
                <p className="text-sm text-gray-700">{crossResult.data.summary}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Componente principal
// ============================================================================

export default function GeneticsCalculator() {
  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-100 rounded-xl">
            <Dna className="w-7 h-7 text-amber-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Calculadora Genética</h1>
            <p className="text-gray-500 mt-1 text-sm max-w-xl">
              Simule cruzamentos e calcule probabilidades de filhotes com base nas leis de Mendel.
              Escolha o modo de acordo com o seu nível de conhecimento.
            </p>
          </div>
        </div>

        {/* Disclaimer de honestidade genética */}
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            <strong>Honestidade genética:</strong> Esta calculadora é uma ferramenta de apoio.
            Genes portados (não visíveis) nunca podem ser confirmados apenas pela aparência.
            Para aumentar a precisão, informe pais, avós e resultados de ninhadas anteriores
            na ficha genética de cada pássaro.
          </AlertDescription>
        </Alert>

        {/* Tabs dos 3 modos */}
        <Tabs defaultValue="simples">
          <TabsList className="grid grid-cols-3 w-full max-w-lg">
            <TabsTrigger value="simples" className="flex items-center gap-1.5 text-sm">
              <Calculator className="h-4 w-4" />
              Simples
            </TabsTrigger>
            <TabsTrigger value="assistido" className="flex items-center gap-1.5 text-sm">
              <BookOpen className="h-4 w-4" />
              Assistido
            </TabsTrigger>
            <TabsTrigger value="avancado" className="flex items-center gap-1.5 text-sm">
              <FlaskConical className="h-4 w-4" />
              Avançado
            </TabsTrigger>
          </TabsList>

          <div className="mt-2 mb-4 text-xs text-gray-500">
            <span className="font-medium text-gray-700">Simples:</span> selecione mutações manualmente •{" "}
            <span className="font-medium text-gray-700">Assistido:</span> busque por classe oficial FOB/OBJO •{" "}
            <span className="font-medium text-gray-700">Avançado:</span> use pássaros do plantel com perfil cadastrado
          </div>

          <TabsContent value="simples">
            <ModoSimples />
          </TabsContent>

          <TabsContent value="assistido">
            <ModoAssistido />
          </TabsContent>

          <TabsContent value="avancado">
            <ModoAvancado />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
