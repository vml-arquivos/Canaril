/**
 * Dashboard.tsx — Dashboard premium do Canaril
 * Mobile-first com métricas, alertas de temporada, atalhos e lembretes.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import {
  Bird, Egg, Heart, Feather, Calendar, CheckCircle2,
  ClipboardList, TrendingUp, AlertTriangle, ChevronRight,
  Dna, Map, Plus, Zap,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MetricCard, EmptyState, LoadingSkeleton, InlineAlert, CardSkeleton,
} from "@/components/ui-premium";

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const { data: stats, isLoading: statsLoading } = trpc.management.dashboard.stats.useQuery();
  const { data: reminders, refetch: refetchReminders } = trpc.reminders.upcoming.useQuery({ daysAhead: 14 });
  const { data: season } = trpc.reports.temporada.useQuery();
  const { data: dailySummary } = trpc.dailyCare.getDailySummary.useQuery();
  const markCompleted = trpc.reminders.markCompleted.useMutation({ onSuccess: () => refetchReminders() });

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8">
          <Bird className="w-12 h-12 text-amber-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Acesso Restrito</h1>
          <p className="text-gray-500 text-sm">Você precisa estar autenticado para acessar o sistema.</p>
        </div>
      </div>
    );
  }

  const firstName = user?.name?.split(" ")[0] ?? "Criador";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">

        {/* Greeting */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{greeting}, {firstName}!</h1>
            <p className="text-gray-400 text-sm mt-0.5">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          <Link href="/rotina">
            <Button className="bg-amber-600 hover:bg-amber-700 gap-2 hidden sm:flex">
              <ClipboardList className="w-4 h-4" />
              Rotina de hoje
            </Button>
          </Link>
        </div>

        {/* Alertas de temporada */}
        {season?.alerts && season.alerts.length > 0 && (
          <div className="space-y-2">
            {season.alerts.map((alert, i) => (
              <InlineAlert key={i} variant={alert.severity === "high" ? "error" : "warning"}>
                {alert.message}
              </InlineAlert>
            ))}
          </div>
        )}

        {/* Métricas principais */}
        {statsLoading ? <CardSkeleton count={4} /> : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <MetricCard
              label="Pássaros"
              value={stats?.birds ?? 0}
              icon={Bird}
              color="text-amber-700"
              borderColor="border-l-amber-500"
              href="/birds"
            />
            <MetricCard
              label="Casais ativos"
              value={season?.activeCouplesCount ?? stats?.couples ?? 0}
              icon={Heart}
              color="text-rose-600"
              borderColor="border-l-rose-500"
              sublabel={season?.activeClutchesCount ? `${season.activeClutchesCount} posturas` : undefined}
              href="/couples"
            />
            <MetricCard
              label="Anilhas livres"
              value={season?.ringsAvailable ?? stats?.rings ?? 0}
              icon={Feather}
              color="text-purple-600"
              borderColor="border-l-purple-500"
              href="/rings"
            />
            <MetricCard
              label="Filhotes"
              value={stats?.chicks ?? 0}
              icon={Egg}
              color="text-green-600"
              borderColor="border-l-green-500"
              href="/clutches"
            />
          </div>
        )}

        {/* Rotina + Lembretes */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* Rotina do dia */}
          <Card className="border-amber-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-amber-600" />
                  Rotina de Hoje
                </div>
                {dailySummary && (
                  <span className="text-xs text-gray-400 font-normal">
                    {dailySummary.couplesWithLogs.length}/{dailySummary.totalActive} registrados
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailySummary ? (
                dailySummary.totalActive === 0 ? (
                  <EmptyState
                    icon={Heart}
                    title="Nenhum casal ativo"
                    description="Cadastre casais para começar a rotina diária."
                    action={<Link href="/couples"><Button size="sm" variant="outline" className="mt-2">Cadastrar casal</Button></Link>}
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ width: `${dailySummary.totalActive > 0 ? Math.round(dailySummary.couplesWithLogs.length / dailySummary.totalActive * 100) : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {Math.round(dailySummary.couplesWithLogs.length / Math.max(dailySummary.totalActive, 1) * 100)}%
                      </span>
                    </div>
                    {dailySummary.couplesWithoutLogs.length > 0 && (
                      <p className="text-sm text-amber-700">
                        {dailySummary.couplesWithoutLogs.length} casal(is) sem registro hoje.
                      </p>
                    )}
                    <Link href="/rotina">
                      <Button variant="outline" size="sm" className="w-full border-amber-200 text-amber-700 hover:bg-amber-50">
                        <ClipboardList className="w-4 h-4 mr-2" />
                        Abrir Rotina Diária
                      </Button>
                    </Link>
                  </div>
                )
              ) : <LoadingSkeleton rows={2} />}
            </CardContent>
          </Card>

          {/* Lembretes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                Próximos 14 dias
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!reminders ? <LoadingSkeleton rows={3} /> : reminders.length === 0 ? (
                <div className="text-center py-4 text-gray-400">
                  <CheckCircle2 className="w-7 h-7 mx-auto mb-2 text-green-300" />
                  <p className="text-sm">Nada pendente por enquanto.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {reminders.slice(0, 6).map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{r.eventLabel}</p>
                        <p className="text-xs text-gray-400">{new Date(r.expectedDate).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <button
                        type="button"
                        aria-label="Marcar como concluído"
                        className="text-gray-300 hover:text-green-500 transition-colors shrink-0"
                        onClick={() => markCompleted.mutate({ id: r.id, completed: true })}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Atalhos rápidos */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Acesso rápido</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { icon: Plus,         label: "Novo pássaro",     href: "/birds",              color: "text-amber-600 bg-amber-50 hover:bg-amber-100" },
              { icon: Heart,        label: "Novo casal",       href: "/couples",            color: "text-rose-600 bg-rose-50 hover:bg-rose-100" },
              { icon: Dna,          label: "Calculadora",      href: "/genetics-calculator", color: "text-blue-600 bg-blue-50 hover:bg-blue-100" },
              { icon: TrendingUp,   label: "Linhagem",         href: "/linhagem",           color: "text-purple-600 bg-purple-50 hover:bg-purple-100" },
              { icon: Map,          label: "Mapa",             href: "/criadouro-mapa",     color: "text-slate-600 bg-slate-50 hover:bg-slate-100" },
              { icon: Calendar,     label: "Temporada",        href: "/temporada",          color: "text-green-600 bg-green-50 hover:bg-green-100" },
              { icon: Feather,      label: "Relatórios",       href: "/reports",            color: "text-indigo-600 bg-indigo-50 hover:bg-indigo-100" },
              { icon: Zap,          label: "IA Interna",       href: "/linhagem",           color: "text-teal-600 bg-teal-50 hover:bg-teal-100" },
            ].map(({ icon: Icon, label, href, color }) => (
              <Link key={href + label} href={href}>
                <button
                  type="button"
                  className={`w-full flex items-center gap-3 rounded-xl p-3.5 border border-transparent transition-all active:scale-95 ${color}`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium text-gray-800">{label}</span>
                  <ChevronRight className="w-4 h-4 ml-auto text-gray-400" />
                </button>
              </Link>
            ))}
          </div>
        </div>

        {/* Temporada resumo se houver casais */}
        {season && season.casaisResumo.length > 0 && (
          <Card className="border-green-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Egg className="w-4 h-4 text-green-600" />
                  Temporada Atual
                </div>
                <Link href="/temporada">
                  <button type="button" className="text-xs text-amber-600 hover:underline flex items-center gap-1">
                    Ver tudo <ChevronRight className="w-3 h-3" />
                  </button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {[
                  { label: "Casais ativos",     value: season.activeCouplesCount,   color: "text-green-700" },
                  { label: "Posturas",          value: season.activeClutchesCount,  color: "text-amber-700" },
                  { label: "Eclosões previstas", value: season.nearHatchCount,       color: "text-blue-700" },
                  { label: "Anilhar agora",     value: season.chicksDueRingCount,   color: season.chicksDueRingCount > 0 ? "text-red-700" : "text-gray-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-gray-50 rounded-xl py-3">
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
