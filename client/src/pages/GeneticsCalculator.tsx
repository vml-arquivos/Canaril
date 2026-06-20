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
  CheckCircle,
  Info,
  Dna,
  Bird,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// Tipos de zigosidade para exibição
const ZYGOSITY_LABELS: Record<string, string> = {
  homozygous_mutant: "Mutante Homozigoto (visual)",
  heterozygous_carrier: "Portador (heterozigoto)",
  homozygous_normal: "Normal (sem mutação)",
};

const ZYGOSITY_COLORS: Record<string, string> = {
  homozygous_mutant: "bg-amber-100 text-amber-800 border-amber-200",
  heterozygous_carrier: "bg-blue-100 text-blue-800 border-blue-200",
  homozygous_normal: "bg-gray-100 text-gray-700 border-gray-200",
};

// Mutações disponíveis para seleção
const MUTATIONS = [
  { id: "agata", label: "Ágata", inheritance: "sex_linked" },
  { id: "canela", label: "Canela", inheritance: "sex_linked" },
  { id: "ino", label: "Ino (Lutino/Albino/Rubino)", inheritance: "sex_linked" },
  { id: "pastel", label: "Pastel", inheritance: "autosomal_recessive" },
  { id: "opala", label: "Opalino", inheritance: "autosomal_recessive" },
  { id: "crista", label: "Crista/Topete", inheritance: "autosomal_dominant" },
  { id: "brancoDominante", label: "Branco Dominante", inheritance: "autosomal_dominant" },
  { id: "plumagem", label: "Plumagem (Nevado/Intenso)", inheritance: "autosomal_dominant" },
];

const BACKGROUND_COLORS = [
  { id: "amarelo", label: "Amarelo" },
  { id: "vermelho", label: "Vermelho (Fator Vermelho)" },
  { id: "branco_recessivo", label: "Branco Recessivo" },
  { id: "branco_dominante", label: "Branco Dominante" },
];

const FEATHER_TYPES = [
  { id: "intenso", label: "Intenso" },
  { id: "nevado", label: "Nevado" },
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

// Opções de zigosidade por tipo de herança e sexo
function getZygosityOptions(mutationId: string, sex: "macho" | "fêmea") {
  const mutation = MUTATIONS.find((m) => m.id === mutationId);
  if (!mutation) return [];

  if (mutation.inheritance === "sex_linked") {
    if (sex === "macho") {
      return [
        { value: "Z+Z+", label: "Z⁺Z⁺ — Visual homozigoto" },
        { value: "Z+Z-", label: "Z⁺Z⁻ — Portador (visual em ágata/canela)" },
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
    // dominant
    return [
      { value: "NN", label: "NN — Visual dose dupla (risco letal)" },
      { value: "Nn", label: "Nn — Visual dose simples" },
      { value: "nn", label: "nn — Não visual" },
    ];
  }
}

function RiskBadge({ risk }: { risk: "low" | "moderate" | "high" | "critical" }) {
  const map = {
    low: { label: "Baixo risco", className: "bg-green-100 text-green-800 border-green-200" },
    moderate: { label: "Risco moderado", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    high: { label: "Alto risco", className: "bg-red-100 text-red-800 border-red-200" },
    critical: { label: "Risco crítico", className: "bg-red-200 text-red-900 border-red-300" },
  };
  const { label, className } = map[risk];
  return <Badge variant="outline" className={className}>{label}</Badge>;
}

function ProbabilityBar({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 text-sm text-gray-600 shrink-0">{label}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-12 text-sm font-medium text-right text-gray-700">{pct}%</div>
    </div>
  );
}

export default function GeneticsCalculator() {
  const [male, setMale] = useState<ParentGenotype>({ sex: "macho" });
  const [female, setFemale] = useState<ParentGenotype>({ sex: "fêmea" });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [calculated, setCalculated] = useState(false);

  const { data: result, isLoading, refetch } = trpc.genetics.calculateColorCross.useQuery(
    { male, female },
    { enabled: calculated }
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

  function setMutation(
    parent: "male" | "female",
    mutationId: string,
    value: string | undefined
  ) {
    if (parent === "male") {
      setMale((prev) => ({ ...prev, [mutationId]: value }));
    } else {
      setFemale((prev) => ({ ...prev, [mutationId]: value }));
    }
    setCalculated(false);
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Calculator className="w-6 h-6 text-amber-600" />
              Calculadora Genética
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Simule cruzamentos e calcule probabilidades de filhotes com base nas leis de Mendel.
              Selecione os genótipos do macho e da fêmea para começar.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Limpar
          </Button>
        </div>

        {/* Aviso informativo */}
        <Alert className="border-amber-200 bg-amber-50">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            Esta calculadora usa as leis de Mendel para calcular probabilidades teóricas.
            Os resultados são estimativas — a natureza sempre tem variação.
            Para mutações ligadas ao sexo, fêmeas nunca são portadoras silenciosas.
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
            <CardContent className="space-y-3">
              {MUTATIONS.map((mutation) => (
                <div key={mutation.id} className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">
                    {mutation.label}
                    <span className="ml-1 text-gray-400 font-normal">
                      ({mutation.inheritance === "sex_linked"
                        ? "ligada ao sexo"
                        : mutation.inheritance === "autosomal_recessive"
                        ? "autossômica recessiva"
                        : "autossômica dominante"})
                    </span>
                  </label>
                  <Select
                    value={(male as any)[mutation.id] ?? ""}
                    onValueChange={(v) => setMutation("male", mutation.id, v || undefined)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Não informado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Não informado</SelectItem>
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
            <CardContent className="space-y-3">
              {MUTATIONS.map((mutation) => (
                <div key={mutation.id} className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">
                    {mutation.label}
                    <span className="ml-1 text-gray-400 font-normal">
                      ({mutation.inheritance === "sex_linked"
                        ? "ligada ao sexo"
                        : mutation.inheritance === "autosomal_recessive"
                        ? "autossômica recessiva"
                        : "autossômica dominante"})
                    </span>
                  </label>
                  <Select
                    value={(female as any)[mutation.id] ?? ""}
                    onValueChange={(v) => setMutation("female", mutation.id, v || undefined)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Não informado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Não informado</SelectItem>
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
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleCalculate}
            disabled={isLoading}
            className="bg-amber-600 hover:bg-amber-700 text-white px-10"
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

        {/* Resultados */}
        {result && calculated && (
          <div className="space-y-6">
            <Separator />

            {/* Alertas */}
            {result.warnings && result.warnings.length > 0 && (
              <div className="space-y-2">
                {result.warnings.map((warning: string, i: number) => (
                  <Alert key={i} className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800 text-sm">{warning}</AlertDescription>
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

                        {/* Resumo por mutação — filhotes machos e fêmeas (sex-linked) ou geral */}
            {result.byMutation && Object.keys(result.byMutation).length > 0 && (() => {
              // Agrega sons/daughters/offspring de todas as mutações para exibição rápida
              const firstMut = Object.values(result.byMutation)[0] as any;
              const hasSexLinked = firstMut?.sons && firstMut?.daughters;
              if (hasSexLinked) {
                // Exibe a primeira mutação sex-linked como resumo visual
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
              } else if (firstMut?.offspring) {
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

            {/* Detalhes por mutação */}
            {result.byMutation && Object.keys(result.byMutation).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <button
                    className="flex items-center justify-between w-full text-left"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    <CardTitle className="text-base">Detalhes por Mutação</CardTitle>
                    {showAdvanced ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </CardHeader>
                {showAdvanced && (
                  <CardContent>
                    <div className="space-y-6">
                      {Object.entries(result.byMutation as Record<string, any>).map(([mutId, mutResult]) => {
                        const mutation = MUTATIONS.find((m) => m.id === mutId);
                        return (
                          <div key={mutId}>
                            <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                              <Dna className="w-3.5 h-3.5 text-amber-600" />
                              {mutation?.label ?? mutId}
                              <Badge variant="outline" className="text-xs">
                                {mutation?.inheritance === "sex_linked"
                                  ? "ligada ao sexo"
                                  : mutation?.inheritance === "autosomal_recessive"
                                  ? "autossômica recessiva"
                                  : "autossômica dominante"}
                              </Badge>
                            </h4>

                            {mutResult.sons && (
                              <div className="mb-3">
                                <p className="text-xs text-gray-500 mb-1">Filhos machos:</p>
                                <div className="space-y-1.5">
                                  {Object.entries(mutResult.sons as Record<string, number>).map(([g, p]) => (
                                    <ProbabilityBar
                                      key={g}
                                      label={ZYGOSITY_LABELS[g] ?? g}
                                      value={p}
                                      color="bg-blue-300"
                                    />
                                  ))}
                                </div>
                              </div>
                            )}

                            {mutResult.daughters && (
                              <div className="mb-3">
                                <p className="text-xs text-gray-500 mb-1">Filhas fêmeas:</p>
                                <div className="space-y-1.5">
                                  {Object.entries(mutResult.daughters as Record<string, number>).map(([g, p]) => (
                                    <ProbabilityBar
                                      key={g}
                                      label={ZYGOSITY_LABELS[g] ?? g}
                                      value={p}
                                      color="bg-pink-300"
                                    />
                                  ))}
                                </div>
                              </div>
                            )}

                            {mutResult.offspring && !mutResult.sons && (
                              <div className="space-y-1.5">
                                {Object.entries(mutResult.offspring as Record<string, number>).map(([g, p]) => (
                                  <ProbabilityBar
                                    key={g}
                                    label={ZYGOSITY_LABELS[g] ?? g}
                                    value={p}
                                    color="bg-amber-300"
                                  />
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
                <div className="grid sm:grid-cols-3 gap-3">
                  {Object.entries(ZYGOSITY_LABELS).map(([key, label]) => (
                    <div key={key} className={`rounded-lg border px-3 py-2 text-xs ${ZYGOSITY_COLORS[key]}`}>
                      <strong className="block">{label}</strong>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  <strong>Nota:</strong> Fêmeas com mutações ligadas ao sexo nunca são portadoras silenciosas —
                  se receberam o gene, manifestam visualmente (sistema ZW dos canários).
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Estado vazio */}
        {!calculated && (
          <Card className="border-dashed border-amber-200 bg-amber-50/30">
            <CardContent className="py-12 text-center">
              <Calculator className="w-12 h-12 text-amber-300 mx-auto mb-4" />
              <p className="text-amber-700 font-medium">Configure os genótipos e clique em Calcular</p>
              <p className="text-amber-600/70 text-sm mt-1">
                Os resultados mostrarão as probabilidades de cada genótipo nos filhotes.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
