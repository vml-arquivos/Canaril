import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { SPECIALTIES, COLORS } from "@shared/constants";
import { Dna, Printer, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

function labelFor(list: readonly { id: string; name: string }[], code: string) {
  return list.find((i) => i.id === code)?.name ?? code;
}

const COI_RISK_CONFIG: Record<string, { label: string; className: string }> = {
  low: { label: "COI baixo", className: "bg-green-100 text-green-800" },
  moderate: { label: "COI moderado", className: "bg-amber-100 text-amber-800" },
  high: { label: "COI alto", className: "bg-red-100 text-red-800" },
};

export default function GeneticReport() {
  const { data, isLoading } = trpc.geneticProfile.plantelReport.useQuery();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 print:hidden">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-amber-100 rounded-xl">
              <Dna className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Relatório Genético do Plantel</h1>
              <p className="text-gray-500 text-sm mt-1">
                Genótipo operacional e ficha oficial de todos os pássaros ativos, lado a lado.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir / PDF
          </Button>
        </div>

        {isLoading && <p className="text-gray-400">Carregando...</p>}

        {data?.summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              ["Total", data.summary.total, "text-gray-700"],
              ["Genótipo operacional", data.summary.withOperationalGenotype, "text-blue-700"],
              ["Ficha oficial", data.summary.withOfficialProfile, "text-purple-700"],
              ["Com dado genético", data.summary.withAnyGeneticData, "text-emerald-700"],
              ["Sem dado genético", data.summary.withNoGeneticData, "text-red-700"],
              ["Com crista", data.summary.withCrest, "text-amber-700"],
              ["COI alto", data.summary.highCoiRisk, "text-red-700"],
            ].map(([label, value, color]) => (
              <Card key={label as string}>
                <CardContent className="pt-4 pb-3 text-center">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Genética por pássaro</CardTitle>
            <CardDescription>
              "Sem dado genético" significa que nem o Genótipo Avançado nem a Classe Oficial foram preenchidos ainda.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anilha</TableHead>
                  <TableHead>Espécie/Cor</TableHead>
                  <TableHead>Classe Oficial</TableHead>
                  <TableHead>Lipocromo/Pena</TableHead>
                  <TableHead>Mutações</TableHead>
                  <TableHead>COI</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.rows.map((r) => (
                  <TableRow key={r.birdId}>
                    <TableCell className="font-mono font-semibold">{r.ring}</TableCell>
                    <TableCell className="text-sm">
                      {labelFor(SPECIALTIES, r.specialtyCode)}
                      <br />
                      <span className="text-gray-400">{labelFor(COLORS, r.colorCode)}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.officialCode ? (
                        <>
                          <span className="font-mono">{r.officialCode}</span>
                          {r.manualOverride && <Badge className="ml-1 bg-emerald-100 text-emerald-800 text-xs">verificado</Badge>}
                        </>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {r.backgroundColor || r.featherType || r.hasCrest ? (
                        <>
                          {[r.backgroundColor, r.featherType, r.hasCrest ? "com crista" : null].filter(Boolean).join(" · ")}
                        </>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.manifestingMutations.length > 0 && (
                        <p className="text-gray-700">{r.manifestingMutations.join(", ")} (visual)</p>
                      )}
                      {r.carrierMutations.length > 0 && (
                        <p className="text-gray-400">{r.carrierMutations.join(", ")} (portador)</p>
                      )}
                      {r.manifestingMutations.length === 0 && r.carrierMutations.length === 0 && (
                        <span className="text-gray-300">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.coiRisk ? (
                        <Badge className={COI_RISK_CONFIG[r.coiRisk].className}>
                          {(r.coi! * 100).toFixed(1)}%
                        </Badge>
                      ) : (
                        <span className="text-gray-300 text-xs">sem pedigree</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.geneticDataComplete ? (
                        <span className="flex items-center gap-1 text-emerald-600 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Completo
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-500 text-xs">
                          <XCircle className="w-3.5 h-3.5" /> Pendente
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data?.rows.length === 0 && (
              <p className="text-center text-gray-400 py-8">Nenhum pássaro ativo cadastrado ainda.</p>
            )}
          </CardContent>
        </Card>

        {data?.summary && data.summary.withNoGeneticData > 0 && (
          <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 print:hidden">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>
              {data.summary.withNoGeneticData} pássaro(s) sem nenhum dado genético — preencha o Genótipo Avançado
              ou selecione a Classe Oficial na ficha de cada um pra entrarem no ranking de "Par Ideal" da
              calculadora.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
