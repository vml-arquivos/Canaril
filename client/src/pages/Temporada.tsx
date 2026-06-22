/**
 * Temporada.tsx — Painel de Temporada
 *
 * Visão imediata da criação atual: casais ativos, posturas, ovos
 * próximos de eclosão, filhotes aguardando anilha, alertas da semana.
 */
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Bird, Egg, Heart, Feather, AlertTriangle, CheckCircle2,
  Calendar, Clock, Bell, TrendingUp,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

function SeverityBadge({ s }: { s: "high" | "medium" | "low" }) {
  if (s === "high") return <Badge className="bg-red-100 text-red-800 text-xs">Urgente</Badge>;
  if (s === "medium") return <Badge className="bg-amber-100 text-amber-800 text-xs">Atenção</Badge>;
  return <Badge className="bg-blue-100 text-blue-800 text-xs">Info</Badge>;
}

export default function Temporada() {
  const { data, isLoading } = trpc.reports.temporada.useQuery();
  const now = new Date();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Painel de Temporada</h1>
            <p className="text-gray-500 mt-1">Visão imediata da criação — o que está acontecendo agora</p>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        {isLoading && <p className="text-gray-400">Carregando temporada...</p>}

        {data && (
          <>
            {/* Cards de resumo */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { icon: Heart, label: "Casais ativos", value: data.activeCouplesCount, color: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
                { icon: Egg, label: "Posturas ativas", value: data.activeClutchesCount, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
                { icon: Clock, label: "Próximas eclosões", value: data.nearHatchCount, color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
                { icon: Bell, label: "Anilhar agora", value: data.chicksDueRingCount, color: data.chicksDueRingCount > 0 ? "text-red-700" : "text-gray-500", bg: data.chicksDueRingCount > 0 ? "bg-red-50" : "bg-gray-50", border: data.chicksDueRingCount > 0 ? "border-red-200" : "border-gray-200" },
                { icon: Feather, label: "Anilhas livres", value: data.ringsAvailable, color: data.ringsAvailable < 10 ? "text-amber-700" : "text-purple-700", bg: data.ringsAvailable < 10 ? "bg-amber-50" : "bg-purple-50", border: data.ringsAvailable < 10 ? "border-amber-200" : "border-purple-200" },
              ].map(({ icon: Icon, label, value, color, bg, border }) => (
                <Card key={label} className={`border ${border} ${bg}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-gray-500">{label}</p>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <p className={`text-3xl font-bold ${color}`}>{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Alertas */}
            {data.alerts.length > 0 && (
              <Card className="border-amber-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Alertas da Temporada
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.alerts.map((alert, i) => (
                    <div key={i} className={`flex items-center justify-between gap-3 rounded-lg p-3 text-sm border ${alert.severity === "high" ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        {alert.message}
                      </div>
                      <SeverityBadge s={alert.severity} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {data.alerts.length === 0 && (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
                <CheckCircle2 className="w-5 h-5" />
                Tudo em ordem! Nenhum alerta crítico para a temporada atual.
              </div>
            )}

            {/* Tabela de casais ativos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-600" />
                  Casais Ativos — Resumo da Temporada
                </CardTitle>
                <CardDescription>Últimas posturas e previsão de eclosão</CardDescription>
              </CardHeader>
              <CardContent>
                {data.casaisResumo.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Heart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum casal ativo cadastrado.</p>
                    <Link href="/couples" className="mt-2 inline-block">
                      <Button variant="outline" size="sm" className="mt-2">Cadastrar casal</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.casaisResumo.map((c) => {
                      const daysToHatch = c.expectedHatchDate ? daysBetween(now, new Date(c.expectedHatchDate)) : null;
                      return (
                        <div key={c.coupleId} className={`rounded-lg border p-4 ${c.nearHatchSoon ? "border-blue-200 bg-blue-50" : "border-gray-100"}`}>
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <Heart className="w-4 h-4 text-rose-500 shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium text-sm text-gray-900">
                                  <span className="font-mono">{c.maleRing}</span>
                                  <span className="text-gray-400 mx-1.5">×</span>
                                  <span className="font-mono">{c.femaleRing}</span>
                                </p>
                                <p className="text-xs text-gray-400">Gaiola {c.cageNumber} · {c.clutchesCount} postura{c.clutchesCount !== 1 ? "s" : ""} · {c.totalHatched} eclosões</p>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              {daysToHatch !== null && daysToHatch >= 0 ? (
                                <div>
                                  <p className="text-xs text-gray-400">Previsão eclosão</p>
                                  <p className={`text-sm font-semibold ${daysToHatch <= 3 ? "text-blue-700" : "text-gray-600"}`}>
                                    {daysToHatch === 0 ? "Hoje!" : daysToHatch === 1 ? "Amanhã" : `em ${daysToHatch} dias`}
                                  </p>
                                </div>
                              ) : c.latestClutchDate ? (
                                <div>
                                  <p className="text-xs text-gray-400">Última postura</p>
                                  <p className="text-sm text-gray-600">{new Date(c.latestClutchDate).toLocaleDateString("pt-BR")}</p>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-300">Sem posturas</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ações rápidas */}
            <div className="flex flex-wrap gap-3">
              <Link href="/clutches"><Button variant="outline" size="sm"><Egg className="w-4 h-4 mr-1.5" />Registrar postura</Button></Link>
              <Link href="/couples"><Button variant="outline" size="sm"><Heart className="w-4 h-4 mr-1.5" />Gerenciar casais</Button></Link>
              <Link href="/rings"><Button variant="outline" size="sm"><Feather className="w-4 h-4 mr-1.5" />Anilhas</Button></Link>
              <Link href="/reports"><Button variant="outline" size="sm"><Calendar className="w-4 h-4 mr-1.5" />Relatórios</Button></Link>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
