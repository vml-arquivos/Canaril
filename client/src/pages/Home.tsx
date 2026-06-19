import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { Bird, Egg, Heart, Trophy, Wheat, Bone, Leaf, Droplets, AlertTriangle, ImageOff } from "lucide-react";
import { SPECIALTIES, COLORS_BY_SPECIALTY, BREEDER_INFO } from "@shared/constants";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { data: featuredBirds } = trpc.showroom.featuredBirds.useQuery();

  return (
    <div className="min-h-screen bg-[#FBF8F3]">
      {/* Header */}
      <header className="border-b border-amber-100 bg-white/90 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Bird className="w-7 h-7 text-amber-600" />
            <h1 className="text-xl font-bold text-amber-900 tracking-tight">{BREEDER_INFO.name}</h1>
          </div>
          <nav className="flex gap-6 items-center text-sm">
            <a href="#vitrine" className="text-amber-800/80 hover:text-amber-900 font-medium hidden sm:inline">
              Plantel
            </a>
            <a href="#especialidades" className="text-amber-800/80 hover:text-amber-900 font-medium hidden sm:inline">
              Especialidades
            </a>
            <a href="#nutricao" className="text-amber-800/80 hover:text-amber-900 font-medium hidden sm:inline">
              Nutrição
            </a>
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700">Dashboard</Button>
              </Link>
            ) : (
              <a href={getLoginUrl()}>
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700">Entrar</Button>
              </a>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 sm:py-28 text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-amber-600 font-medium tracking-wide uppercase text-sm mb-4">
            {BREEDER_INFO.city}, {BREEDER_INFO.state}
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold text-amber-950 mb-6 tracking-tight leading-tight">
            {BREEDER_INFO.name}
          </h2>
          <p className="text-lg text-amber-900/70 leading-relaxed">
            {BREEDER_INFO.description}
          </p>
        </div>
      </section>

      {/* Vitrine do plantel — fotos reais */}
      <section id="vitrine" className="container mx-auto px-4 py-16 border-t border-amber-100">
        <div className="max-w-2xl mb-10">
          <h3 className="text-2xl font-bold text-amber-950 mb-2">Nosso Plantel</h3>
          <p className="text-amber-900/60">Uma amostra dos pássaros do criadouro, selecionados para exibição.</p>
        </div>

        {featuredBirds && featuredBirds.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredBirds.map((bird) => (
              <div key={bird.id} className="group rounded-xl overflow-hidden bg-white border border-amber-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="aspect-square bg-amber-50 overflow-hidden">
                  {bird.photoUrl ? (
                    <img
                      src={bird.photoUrl}
                      alt={`Canário ${bird.ring}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-amber-300">
                      <Bird className="w-10 h-10" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-mono text-xs text-amber-600">{bird.ring}</p>
                  <p className="text-sm font-medium text-amber-950 truncate">
                    {SPECIALTIES.find((s) => s.id === bird.specialty_code)?.name ?? bird.specialty_code}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-amber-200 py-16 text-center text-amber-400">
            <ImageOff className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>A vitrine ainda não tem pássaros em destaque.</p>
            <p className="text-sm mt-1">Em breve, fotos do plantel aparecem aqui.</p>
          </div>
        )}
      </section>

      {/* Especialidades */}
      <section id="especialidades" className="container mx-auto px-4 py-16 border-t border-amber-100">
        <div className="max-w-2xl mb-10">
          <h3 className="text-2xl font-bold text-amber-950 mb-2">Especialidades</h3>
          <p className="text-amber-900/60">Raças trabalhadas no criadouro, com padrão de julgamento oficial.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {SPECIALTIES.map((specialty) => (
            <Card key={specialty.id} className="border-amber-100 hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-amber-950 text-lg">{specialty.name}</CardTitle>
                <CardDescription>{specialty.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm text-gray-600 mb-3">
                  <span><strong className="text-amber-900">Tamanho:</strong> {specialty.size}</span>
                  <span><strong className="text-amber-900">Peso:</strong> {specialty.weight}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {COLORS_BY_SPECIALTY[specialty.id as keyof typeof COLORS_BY_SPECIALTY]?.slice(0, 4).map((colorId) => (
                    <span key={colorId} className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs border border-amber-100">
                      {colorId.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Nutrição */}
      <section id="nutricao" className="container mx-auto px-4 py-16 border-t border-amber-100">
        <div className="max-w-2xl mb-10">
          <h3 className="text-2xl font-bold text-amber-950 mb-2">Nutrição do Canário</h3>
          <p className="text-amber-900/60">
            Orientação geral de manejo alimentar. Cada plantel tem particularidades — em caso de dúvida
            sobre algum pássaro específico, o ideal é consultar um médico-veterinário especializado em aves.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <NutritionCard
            icon={Wheat}
            title="Sementes (base)"
            description="Mistura de alpiste, painço e nabo/colza forma a base diária — em torno de uma a duas colheres de chá por ave."
          />
          <NutritionCard
            icon={Egg}
            title="Proteína"
            description="Papa de ovo ou ovo cozido picado, reforçada na muda de penas e durante a reprodução (postura e cria dos filhotes)."
          />
          <NutritionCard
            icon={Bone}
            title="Cálcio e minerais"
            description="Osso de siba e grit calcário sempre disponíveis — essenciais para a casca dos ovos e a saúde óssea."
          />
          <NutritionCard
            icon={Leaf}
            title="Verduras e frutas"
            description="Couve, brócolis e dente-de-leão frescos, com fruta em pequena quantidade, oferecem vitaminas e fibras."
          />
          <NutritionCard
            icon={Droplets}
            title="Água"
            description="Troca diária, sempre limpa e fresca — fundamental e frequentemente subestimado."
          />
          <NutritionCard
            icon={AlertTriangle}
            title="Nunca ofereça"
            description="Abacate, chocolate, cafeína, álcool e excesso de sal são tóxicos para canários."
            tone="warning"
          />
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white border-y border-amber-100 py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <Bird className="w-9 h-9 text-amber-500 mx-auto mb-3" />
              <h4 className="text-2xl font-bold text-amber-950">{SPECIALTIES.length}</h4>
              <p className="text-amber-700/70 text-sm">Especialidades</p>
            </div>
            <div>
              <Trophy className="w-9 h-9 text-amber-500 mx-auto mb-3" />
              <h4 className="text-2xl font-bold text-amber-950">FOB</h4>
              <p className="text-amber-700/70 text-sm">Padrão de Julgamento</p>
            </div>
            <div>
              <Egg className="w-9 h-9 text-amber-500 mx-auto mb-3" />
              <h4 className="text-2xl font-bold text-amber-950">100%</h4>
              <p className="text-amber-700/70 text-sm">Controle Genealógico</p>
            </div>
            <div>
              <Heart className="w-9 h-9 text-amber-500 mx-auto mb-3" />
              <h4 className="text-2xl font-bold text-amber-950">∞</h4>
              <p className="text-amber-700/70 text-sm">Bem-estar Animal</p>
            </div>
          </div>
        </div>
      </section>

      {/* Sobre */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h3 className="text-2xl font-bold text-amber-950 mb-4">Sobre o Criadouro</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            {BREEDER_INFO.description}
          </p>
          <p className="text-gray-700 leading-relaxed">
            Um sistema de gestão próprio mantém controle total sobre genealogia, cruzamentos, posturas e
            filhotes — garantindo rastreabilidade completa em cada geração.
          </p>
          {!isAuthenticated && (
            <a href={getLoginUrl()} className="inline-block mt-8">
              <Button size="lg" className="bg-amber-600 hover:bg-amber-700 text-white">
                Acessar Sistema de Gestão
              </Button>
            </a>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-amber-100 bg-white py-8">
        <div className="container mx-auto px-4 text-center text-amber-800/70 text-sm">
          <p>&copy; {new Date().getFullYear()} {BREEDER_INFO.name}. Todos os direitos reservados.</p>
          <p className="mt-2">
            {BREEDER_INFO.city}, {BREEDER_INFO.state} · {BREEDER_INFO.phone} · {BREEDER_INFO.email}
          </p>
        </div>
      </footer>
    </div>
  );
}

function NutritionCard({
  icon: Icon,
  title,
  description,
  tone = "default",
}: {
  icon: typeof Wheat;
  title: string;
  description: string;
  tone?: "default" | "warning";
}) {
  const isWarning = tone === "warning";
  return (
    <Card className={isWarning ? "border-red-200 bg-red-50/50" : "border-amber-100"}>
      <CardHeader className="pb-2">
        <Icon className={`w-6 h-6 mb-1 ${isWarning ? "text-red-500" : "text-amber-600"}`} />
        <CardTitle className={`text-base ${isWarning ? "text-red-900" : "text-amber-950"}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-sm leading-relaxed ${isWarning ? "text-red-700/80" : "text-gray-600"}`}>{description}</p>
      </CardContent>
    </Card>
  );
}
