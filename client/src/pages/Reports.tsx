import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { SPECIALTIES, COLORS } from "@shared/constants";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { Egg, Feather, Heart, Trophy, Bird as BirdIcon } from "lucide-react";

function labelFor(list: readonly { id: string; name: string }[], code: string) {
  return list.find((i) => i.id === code)?.name ?? code;
}

export default function Reports() {
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
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-600 mt-2">Visão consolidada do plantel, reprodução e campeonatos</p>
        </div>

        {/* Cards resumo */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total de Pássaros</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-3xl font-bold text-gray-900">{birds?.length ?? 0}</div>
              <BirdIcon className="w-7 h-7 text-blue-500 opacity-50" />
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Casais Ativos</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-3xl font-bold text-gray-900">{data?.couplesActive ?? 0}</div>
              <Heart className="w-7 h-7 text-green-500 opacity-50" />
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-yellow-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Taxa de Eclosão</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-3xl font-bold text-gray-900">{data?.hatchRate ?? 0}%</div>
              <Egg className="w-7 h-7 text-yellow-500 opacity-50" />
            </CardContent>
            <CardContent className="pt-0 text-xs text-gray-500">
              {data?.totalHatched ?? 0} filhotes de {data?.totalEggs ?? 0} ovos ({data?.clutchesTotal ?? 0} posturas)
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Anilhas Disponíveis</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-3xl font-bold text-gray-900">{data?.ringsAvailable ?? 0}</div>
              <Feather className="w-7 h-7 text-purple-500 opacity-50" />
            </CardContent>
            <CardContent className="pt-0 text-xs text-gray-500">{data?.ringsInUse ?? 0} já em uso</CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Pássaros por Especialidade</CardTitle>
              <CardDescription>Distribuição do plantel</CardDescription>
            </CardHeader>
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
              ) : (
                <p className="text-center text-gray-400 py-12">Sem dados ainda</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pássaros por Cor/Mutação</CardTitle>
              <CardDescription>Distribuição do plantel</CardDescription>
            </CardHeader>
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
              ) : (
                <p className="text-center text-gray-400 py-12">Sem dados ainda</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Melhores pontuados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-600" />
              Melhores Pontuados em Campeonatos
            </CardTitle>
            <CardDescription>Os pássaros do plantel com as maiores notas registradas — bons candidatos a reforçar em futuras exposições</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.topScores && data.topScores.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pássaro</TableHead>
                    <TableHead>Campeonato</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead>Colocação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topScores.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono font-semibold">{ringOf(s.birdId)}</TableCell>
                      <TableCell>{s.championshipName}</TableCell>
                      <TableCell>{s.category}</TableCell>
                      <TableCell className="font-semibold">{s.totalScore}</TableCell>
                      <TableCell>{s.placement ? `${s.placement}º lugar` : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-gray-400 py-8">Nenhuma pontuação registrada ainda.</p>
            )}
          </CardContent>
        </Card>

        {!isLoading && !data && (
          <p className="text-center text-gray-400 text-sm">Carregando dados...</p>
        )}
      </div>
    </DashboardLayout>
  );
}
