import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download, FileText, History, Search } from "lucide-react";
import { Link } from "wouter";

function dateLabel(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR");
}

function statusLabel(status: unknown) {
  if (status === "finalized") return "Finalizado";
  return "Desfeito";
}

export default function CouplesHistory() {
  const [search, setSearch] = useState("");
  const { data = [], isLoading } = trpc.management.couples.history.useQuery();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter((row: any) => [
      row.cageNumber,
      row.maleRing,
      row.maleTitle,
      row.femaleRing,
      row.femaleTitle,
      row.endReason,
    ].some((value) => String(value ?? "").toLowerCase().includes(term)));
  }, [data, search]);

  const exportCsv = () => {
    if (filtered.length === 0) return;
    const header = ["Casal", "Gaiola", "Macho", "Fêmea", "Formação", "Encerramento", "Método", "Posturas", "Ovos", "Fertilizados", "Eclosões", "Motivo"];
    const rows = filtered.map((row: any) => [
      row.id,
      row.cageNumber,
      row.maleRing,
      row.femaleRing,
      dateLabel(row.formationDate),
      dateLabel(row.endedAt ?? row.deletedAt),
      row.pairingMethod === "bigamy" ? "Bigamia" : "Monogamia",
      row.clutchCount,
      row.totalEggs,
      row.fertilizedEggs,
      row.hatchedChicks,
      row.endReason ?? "",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "historico-de-casais.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <History className="h-6 w-6 text-slate-600" />
              <h1 className="text-3xl font-bold text-gray-900">Histórico de Casais</h1>
            </div>
            <p className="mt-2 text-gray-600">Registros encerrados para consulta, comprovação reprodutiva e análise de linhagem.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/couples">
              <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Casais ativos</Button>
            </Link>
            <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="mr-2 h-4 w-4" />Exportar CSV
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Casais desfeitos e finalizados</CardTitle>
            <CardDescription>
              {data.length} registro{data.length === 1 ? "" : "s"}. Nenhum item desta página pode ser editado ou apagado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por gaiola, anilha, pássaro ou motivo..."
                className="pl-9"
              />
            </div>

            {isLoading ? (
              <p className="py-8 text-center text-sm text-gray-400">Carregando histórico...</p>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed py-12 text-center text-gray-400">
                <History className="mx-auto mb-2 h-9 w-9 opacity-30" />
                <p>{search ? "Nenhum registro encontrado para a busca." : "Nenhum casal foi desfeito até o momento."}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gaiola</TableHead>
                      <TableHead>Macho</TableHead>
                      <TableHead>Fêmea</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Posturas</TableHead>
                      <TableHead>Resultados</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Consulta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row: any) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono font-semibold">{row.cageNumber || "—"}</TableCell>
                        <TableCell>
                          <p className="font-mono text-sm font-semibold">{row.maleRing || `#${row.maleId}`}</p>
                          <p className="max-w-48 truncate text-xs text-gray-400">{row.maleTitle || "—"}</p>
                        </TableCell>
                        <TableCell>
                          <p className="font-mono text-sm font-semibold">{row.femaleRing || `#${row.femaleId}`}</p>
                          <p className="max-w-48 truncate text-xs text-gray-400">{row.femaleTitle || "—"}</p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          <p>{dateLabel(row.formationDate)}</p>
                          <p className="text-xs text-gray-400">até {dateLabel(row.endedAt ?? row.deletedAt)}</p>
                        </TableCell>
                        <TableCell>
                          <Badge className={row.pairingMethod === "bigamy" ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-700"}>
                            {row.pairingMethod === "bigamy" ? "Bigamia" : "Monogamia"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">{row.clutchCount ?? 0}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-gray-600">
                          <p>{row.totalEggs ?? 0} ovos</p>
                          <p>{row.fertilizedEggs ?? 0} fertilizados · {row.hatchedChicks ?? 0} eclosões</p>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-gray-100 text-gray-700">{statusLabel(row.status)}</Badge>
                          {row.endReason && <p className="mt-1 max-w-52 text-xs text-gray-400">{row.endReason}</p>}
                        </TableCell>
                        <TableCell>
                          <Link href={`/ficha-gaiola/${row.id}`}>
                            <Button size="sm" variant="ghost" title="Abrir ficha histórica do casal">
                              <FileText className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
