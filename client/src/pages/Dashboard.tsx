import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Bird, Egg, Heart, Feather, Calendar, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const { data: stats, isLoading } = trpc.management.dashboard.stats.useQuery();
  const { data: reminders, refetch: refetchReminders } = trpc.reminders.upcoming.useQuery({ daysAhead: 30 });
  const markCompleted = trpc.reminders.markCompleted.useMutation({ onSuccess: () => refetchReminders() });

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Acesso Restrito</h1>
          <p className="text-gray-600 mb-6">Você precisa estar autenticado para acessar o dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Bem-vindo, {user?.name}!</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total de Pássaros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-gray-900">{stats?.birds || 0}</div>
                <Bird className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Casais Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-gray-900">{stats?.couples || 0}</div>
                <Heart className="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-yellow-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Filhotes da Temporada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-gray-900">{stats?.chicks || 0}</div>
                <Egg className="w-8 h-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Anilhas Disponíveis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-gray-900">{stats?.rings || 0}</div>
                <Feather className="w-8 h-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
              <CardDescription>Acesse as funcionalidades principais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/birds">
                <Button variant="outline" className="w-full justify-start">
                  <Bird className="w-4 h-4 mr-2" />
                  Gerenciar Pássaros
                </Button>
              </Link>
              <Link href="/couples">
                <Button variant="outline" className="w-full justify-start">
                  <Heart className="w-4 h-4 mr-2" />
                  Gerenciar Cruzamentos
                </Button>
              </Link>
              <Link href="/rings">
                <Button variant="outline" className="w-full justify-start">
                  <Feather className="w-4 h-4 mr-2" />
                  Gerenciar Anilhas
                </Button>
              </Link>
              <Link href="/clutches">
                <Button variant="outline" className="w-full justify-start">
                  <Egg className="w-4 h-4 mr-2" />
                  Registrar Posturas
                </Button>
              </Link>
              <Link href="/couples">
                <Button variant="outline" className="w-full justify-start">
                  <Feather className="w-4 h-4 mr-2" />
                  Ficha de Controle
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-600" />
                Próximos Lembretes
              </CardTitle>
              <CardDescription>Calendário automático de reprodução (próximos 30 dias)</CardDescription>
            </CardHeader>
            <CardContent>
              {reminders && reminders.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {reminders.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 border-b pb-2 text-sm">
                      <div>
                        <p className="font-medium text-gray-800">{r.eventLabel}</p>
                        <p className="text-gray-400 text-xs">{new Date(r.expectedDate).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-600 shrink-0"
                        onClick={() => markCompleted.mutate({ id: r.id, completed: true })}
                        title="Marcar como concluído"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Nenhum lembrete pendente nos próximos 30 dias.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Help Section */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">Bem-vindo ao Sistema de Gestão</CardTitle>
            <CardDescription className="text-blue-800">
              Use o menu lateral para acessar todas as funcionalidades do sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-blue-800">
            <ul className="list-disc list-inside space-y-1">
              <li>Cadastre e gerencie seus pássaros</li>
              <li>Controle anilhas e sua disponibilidade</li>
              <li>Registre cruzamentos e casais</li>
              <li>Acompanhe posturas e filhotes</li>
              <li>Visualize árvore genealógica</li>
              <li>Gere relatórios e fichas em PDF</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
