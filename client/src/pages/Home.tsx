import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { Bird, Egg, Heart, Trophy } from "lucide-react";
import { SPECIALTIES, COLORS_BY_SPECIALTY } from "@shared/constants";

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      {/* Header */}
      <header className="border-b border-amber-200 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Bird className="w-8 h-8 text-amber-600" />
            <h1 className="text-2xl font-bold text-amber-900">Canário Lima</h1>
          </div>
          <nav className="flex gap-6 items-center">
            <a href="#especialidades" className="text-amber-700 hover:text-amber-900 font-medium">
              Especialidades
            </a>
            <a href="#sobre" className="text-amber-700 hover:text-amber-900 font-medium">
              Sobre
            </a>
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button className="bg-amber-600 hover:bg-amber-700">Dashboard</Button>
              </Link>
            ) : (
              <a href={getLoginUrl()}>
                <Button className="bg-amber-600 hover:bg-amber-700">Entrar</Button>
              </a>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-5xl font-bold text-amber-900 mb-6">
            Criadouro Canário Lima
          </h2>
          <p className="text-xl text-amber-700 mb-8">
            Especializado em Canários Belga com foco em qualidade genética e bem-estar animal
          </p>
          <p className="text-lg text-amber-600 mb-12">
            Brasília, Distrito Federal
          </p>
          {!isAuthenticated && (
            <a href={getLoginUrl()}>
              <Button size="lg" className="bg-amber-600 hover:bg-amber-700 text-white">
                Acessar Sistema de Gestão
              </Button>
            </a>
          )}
        </div>
      </section>

      {/* Especialidades Section */}
      <section id="especialidades" className="container mx-auto px-4 py-20">
        <h3 className="text-3xl font-bold text-amber-900 mb-12 text-center">
          Nossas Especialidades
        </h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SPECIALTIES.map((specialty) => (
            <Card key={specialty.id} className="border-amber-200 hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-amber-900">{specialty.name}</CardTitle>
                <CardDescription>{specialty.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-600">
                  <p><strong>Tamanho:</strong> {specialty.size}</p>
                  <p><strong>Peso:</strong> {specialty.weight}</p>
                  <div className="mt-4">
                    <p className="font-semibold text-amber-900 mb-2">Cores disponíveis:</p>
                    <div className="flex flex-wrap gap-2">
                      {COLORS_BY_SPECIALTY[specialty.id as keyof typeof COLORS_BY_SPECIALTY]?.slice(0, 3).map((colorId) => (
                        <span key={colorId} className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">
                          {colorId.replace(/_/g, " ")}
                        </span>
                      ))}
                      {(COLORS_BY_SPECIALTY[specialty.id as keyof typeof COLORS_BY_SPECIALTY]?.length || 0) > 3 && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">
                          +{(COLORS_BY_SPECIALTY[specialty.id as keyof typeof COLORS_BY_SPECIALTY]?.length || 0) - 3} mais
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-white/50 backdrop-blur py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <Bird className="w-12 h-12 text-amber-600 mx-auto mb-4" />
              <h4 className="text-2xl font-bold text-amber-900">6</h4>
              <p className="text-amber-700">Especialidades</p>
            </div>
            <div className="text-center">
              <Trophy className="w-12 h-12 text-amber-600 mx-auto mb-4" />
              <h4 className="text-2xl font-bold text-amber-900">13+</h4>
              <p className="text-amber-700">Cores/Mutações</p>
            </div>
            <div className="text-center">
              <Egg className="w-12 h-12 text-amber-600 mx-auto mb-4" />
              <h4 className="text-2xl font-bold text-amber-900">100%</h4>
              <p className="text-amber-700">Controle Genético</p>
            </div>
            <div className="text-center">
              <Heart className="w-12 h-12 text-amber-600 mx-auto mb-4" />
              <h4 className="text-2xl font-bold text-amber-900">∞</h4>
              <p className="text-amber-700">Bem-estar Animal</p>
            </div>
          </div>
        </div>
      </section>

      {/* Sobre Section */}
      <section id="sobre" className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto">
          <h3 className="text-3xl font-bold text-amber-900 mb-6">Sobre o Criadouro</h3>
          <p className="text-lg text-gray-700 mb-4">
            O Criadouro Canário Lima é uma instituição dedicada à criação profissional de Canários Belga, 
            com foco em qualidade genética, padrão de julgamento FOB e bem-estar animal.
          </p>
          <p className="text-lg text-gray-700 mb-4">
            Com um sistema de gestão completo e sofisticado, mantemos controle total sobre genealogia, 
            cruzamentos, posturas e filhotes, garantindo a excelência em cada geração.
          </p>
          <p className="text-lg text-gray-700">
            Localizado em Brasília, Distrito Federal, o criadouro oferece pássaros de qualidade superior 
            para criadores profissionais e entusiastas.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-amber-200 bg-white/80 backdrop-blur py-8">
        <div className="container mx-auto px-4 text-center text-amber-700">
          <p>&copy; 2026 Criadouro Canário Lima. Todos os direitos reservados.</p>
          <p className="text-sm mt-2">Brasília, DF | (61) 9999-9999 | contato@canarioslima.com.br</p>
        </div>
      </footer>
    </div>
  );
}
