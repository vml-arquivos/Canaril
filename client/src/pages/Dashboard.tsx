import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Bird, Egg, Heart, Feather } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const { data: stats, isLoading } = trpc.management.dashboard.stats.useQuery();

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
              <CardTitle>Informações do Criadouro</CardTitle>
              <CardDescription>Canário Lima - Brasília, DF</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-gray-700">Telefone</p>
                <p className="text-gray-600">(61) 9999-9999</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Email</p>
                <p className="text-gray-600">contato@canarioslima.com.br</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Localização</p>
                <p className="text-gray-600">Brasília, Distrito Federal</p>
              </div>
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
