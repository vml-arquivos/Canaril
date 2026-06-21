import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { Bird, Egg, Heart, Trophy, Wheat, Bone, Leaf, Droplets, AlertTriangle, ImageOff, Zap, Calculator, ChevronDown, ChevronUp, Dna, Shield, Star, Users, BarChart2, BookOpen, CheckCircle } from "lucide-react";
import { SPECIALTIES, COLORS_BY_SPECIALTY } from "@shared/constants";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { data: featuredBirds } = trpc.showroom.featuredBirds.useQuery();
  const { data: settings } = trpc.settings.get.useQuery();

  const breeder = {
    name: settings?.name || "Meu Criadouro",
    city: settings?.city || "",
    state: settings?.state || "",
    phone: settings?.phone || "",
    email: settings?.email || "",
    description: settings?.description || "Criadouro dedicado à criação responsável de canários, com controle genealógico completo.",
  };

  return (
    <div className="min-h-screen bg-[#FBF8F3]">
      {/* Header */}
      <header className="border-b border-amber-100 bg-white/90 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Bird className="w-7 h-7 text-amber-600" />
            <h1 className="text-xl font-bold text-amber-900 tracking-tight">{breeder.name}</h1>
          </div>
          <nav className="flex gap-6 items-center text-sm">
            <a href="#vitrine" className="text-amber-800/80 hover:text-amber-900 font-medium hidden sm:inline">
              Plantel
            </a>
            <a href="#recursos" className="text-amber-800/80 hover:text-amber-900 font-medium hidden sm:inline">
              Recursos
            </a>
            <a href="#genetica" className="text-amber-800/80 hover:text-amber-900 font-medium hidden sm:inline">
              Genética
            </a>
            <a href="#faq" className="text-amber-800/80 hover:text-amber-900 font-medium hidden sm:inline">
              Dúvidas
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

      {/* Hero Premium — imagem de fundo com overlay */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        {/* Imagem de fundo */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/assets/canaril/hero-plantel-colorido.webp')" }}
        />
        {/* Overlay gradiente âmbar escuro */}
        <div className="absolute inset-0 bg-gradient-to-b from-amber-950/70 via-amber-900/60 to-amber-950/80" />

        {/* Conteúdo do hero */}
        <div className="relative z-10 container mx-auto px-4 py-24 sm:py-32 text-center">
          <div className="max-w-3xl mx-auto">
            {(breeder.city || breeder.state) && (
              <p className="text-amber-300 font-medium tracking-widest uppercase text-xs mb-5 drop-shadow">
                {[breeder.city, breeder.state].filter(Boolean).join(", ")}
              </p>
            )}
            <h2 className="text-4xl sm:text-6xl font-bold text-white mb-6 tracking-tight leading-tight drop-shadow-lg">
              {breeder.name}
            </h2>
            <p className="text-lg sm:text-xl text-amber-100/90 leading-relaxed mb-10 max-w-2xl mx-auto drop-shadow">
              {breeder.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isAuthenticated ? (
                <Link href="/dashboard">
                  <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold shadow-lg px-8">
                    Acessar Dashboard
                  </Button>
                </Link>
              ) : (
                <a href={getLoginUrl()}>
                  <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold shadow-lg px-8">
                    Entrar no Sistema
                  </Button>
                </a>
              )}
              <a href="#vitrine">
                <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 backdrop-blur-sm px-8">
                  Ver Plantel
                </Button>
              </a>
              <a href="#recursos">
                <Button size="lg" variant="outline" className="border-white/30 text-white/80 hover:bg-white/10 backdrop-blur-sm px-8">
                  Conhecer Recursos
                </Button>
              </a>
            </div>
          </div>
        </div>

        {/* Seta de scroll */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <a href="#vitrine">
            <ChevronDown className="w-8 h-8 text-white/60" />
          </a>
        </div>
      </section>

      {/* Destaques do sistema */}
      <section className="bg-white border-y border-amber-100 py-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                <Bird className="w-6 h-6 text-amber-600" />
              </div>
              <h4 className="text-2xl font-bold text-amber-950">{SPECIALTIES.length}</h4>
              <p className="text-amber-700/70 text-sm">Especialidades</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-amber-600" />
              </div>
              <h4 className="text-2xl font-bold text-amber-950">FOB</h4>
              <p className="text-amber-700/70 text-sm">Padrão de Julgamento</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                <Egg className="w-6 h-6 text-amber-600" />
              </div>
              <h4 className="text-2xl font-bold text-amber-950">100%</h4>
              <p className="text-amber-700/70 text-sm">Controle Genealógico</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                <Calculator className="w-6 h-6 text-amber-600" />
              </div>
              <h4 className="text-2xl font-bold text-amber-950">IA</h4>
              <p className="text-amber-700/70 text-sm">Calculadora Genética</p>
            </div>
          </div>
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

      {/* Calculadora Genética — chamada de ação */}
      {isAuthenticated && (
        <section className="bg-gradient-to-r from-amber-700 to-amber-600 py-16">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-2xl mx-auto">
              <Calculator className="w-12 h-12 text-amber-200 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-3">Calculadora Genética</h3>
              <p className="text-amber-100/90 mb-6 leading-relaxed">
                Simule cruzamentos, calcule probabilidades de filhotes, verifique consanguinidade e
                obtenha recomendações genéticas antes de formar um casal.
              </p>
              <Link href="/genetics-calculator">
                <Button size="lg" className="bg-white text-amber-800 hover:bg-amber-50 font-semibold shadow-lg px-8">
                  <Zap className="w-4 h-4 mr-2" />
                  Abrir Calculadora
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

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

        {/* Tabela detalhada de nutrientes */}
        <div className="mt-10 bg-white rounded-xl border border-amber-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-100 bg-amber-50/50">
            <h4 className="font-semibold text-amber-950">Necessidades por Nutriente</h4>
            <p className="text-xs text-amber-700/60 mt-0.5">Orientação geral — não substitui acompanhamento veterinário</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-amber-900/60 border-b border-amber-50">
                  <th className="px-5 py-2 font-medium">Nutriente</th>
                  <th className="px-5 py-2 font-medium">Para que serve</th>
                  <th className="px-5 py-2 font-medium">Boas fontes</th>
                  <th className="px-5 py-2 font-medium">Atenção</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {NUTRIENT_TABLE.map((row) => (
                  <tr key={row.nutrient}>
                    <td className="px-5 py-3 font-medium text-amber-950">{row.nutrient}</td>
                    <td className="px-5 py-3 text-gray-600">{row.function}</td>
                    <td className="px-5 py-3 text-gray-600">{row.sources}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{row.caution}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Seção de Recursos */}
      <section id="recursos" className="container mx-auto px-4 py-16 border-t border-amber-100">
        <div className="max-w-2xl mb-10">
          <h3 className="text-2xl font-bold text-amber-950 mb-2">O que o sistema resolve</h3>
          <p className="text-amber-900/60">Tudo o que um criador srio precisa, em um único lugar.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SYSTEM_FEATURES.map((feat) => (
            <div key={feat.title} className="flex gap-4 p-4 rounded-xl bg-white border border-amber-100 hover:shadow-sm transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                <feat.icon className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-semibold text-amber-950 text-sm mb-1">{feat.title}</h4>
                <p className="text-gray-500 text-xs leading-relaxed">{feat.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Seção Genética */}
      <section id="genetica" className="bg-amber-950 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <Dna className="w-10 h-10 text-amber-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-3">Genética real para criadores</h3>
            <p className="text-amber-200/80 leading-relaxed">
              O sistema interpreta as nomenclaturas oficiais FOB/OBJO e calcula cruzamentos com base
              nas leis de Mendel — sem invenções, sem certezas falsas.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {GENETICS_FEATURES.map((feat) => (
              <div key={feat.title} className="bg-amber-900/40 border border-amber-800 rounded-xl p-5">
                <h4 className="font-semibold text-amber-300 mb-2 text-sm">{feat.title}</h4>
                <p className="text-amber-100/70 text-xs leading-relaxed">{feat.description}</p>
              </div>
            ))}
          </div>
          {isAuthenticated && (
            <div className="text-center mt-10">
              <Link href="/genetics-calculator">
                <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold shadow-lg px-8">
                  <Zap className="w-4 h-4 mr-2" />
                  Abrir Calculadora Genética
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Seção de Confiança */}
      <section className="bg-white border-y border-amber-100 py-14">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <h3 className="text-2xl font-bold text-amber-950 mb-2">Feito para criadores sérios</h3>
            <p className="text-amber-900/60">Organização profissional, genética real, decisões melhores.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {TRUST_ITEMS.map((item) => (
              <div key={item.title} className="flex gap-3 items-start">
                <CheckCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-950 text-sm">{item.title}</h4>
                  <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container mx-auto px-4 py-16 border-t border-amber-100">
        <div className="max-w-2xl mb-10">
          <BookOpen className="w-8 h-8 text-amber-600 mb-3" />
          <h3 className="text-2xl font-bold text-amber-950 mb-2">Perguntas frequentes</h3>
          <p className="text-amber-900/60">Dúvidas comuns sobre criação de canários e uso do sistema.</p>
        </div>
        <div className="max-w-3xl space-y-2">
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem key={i} question={item.question} answer={item.answer} />
          ))}
        </div>
      </section>

      {/* Sobre */}
      <section className="container mx-auto px-4 py-16 border-t border-amber-100">
        <div className="max-w-2xl mx-auto text-center">
          <h3 className="text-2xl font-bold text-amber-950 mb-4">Sobre o Criadouro</h3>
          <p className="text-gray-700 leading-relaxed mb-4">{breeder.description}</p>
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
          <p>&copy; {new Date().getFullYear()} {breeder.name}. Todos os direitos reservados.</p>
          {(breeder.city || breeder.phone || breeder.email) && (
            <p className="mt-2">
              {[breeder.city && breeder.state ? `${breeder.city}, ${breeder.state}` : null, breeder.phone, breeder.email].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}

const NUTRIENT_TABLE = [
  {
    nutrient: "Proteína",
    function: "Crescimento, muda de penas e desenvolvimento dos filhotes",
    sources: "Ovo cozido, papa de ovo",
    caution: "Reforçar na reprodução e na muda; sem exagerar fora dessas fases",
  },
  {
    nutrient: "Cálcio",
    function: "Casca do ovo e saúde óssea",
    sources: "Osso de siba, grit calcário, casca de ovo triturada",
    caution: "Fêmeas em postura precisam de oferta constante e visível na gaiola",
  },
  {
    nutrient: "Ferro",
    function: "Produção de glóbulos vermelhos e energia",
    sources: "Sementes integrais, verduras de folha escura",
    caution: "Raramente falta numa dieta variada — não suplementar sem orientação veterinária",
  },
  {
    nutrient: "Sódio",
    function: "Equilíbrio de líquidos no organismo",
    sources: "Já presente naturalmente na ração e nas sementes",
    caution: "Excesso é tóxico — nunca ofereça alimento salgado de consumo humano",
  },
  {
    nutrient: "Vitamina A",
    function: "Pele, penas e visão",
    sources: "Cenoura e vegetais verde-escuros ou alaranjados",
    caution: "Fácil de suprir oferecendo verduras frescas com regularidade",
  },
  {
    nutrient: "Fibras",
    function: "Boa digestão",
    sources: "Verduras frescas e fruta em pequena quantidade",
    caution: "Introduzir aos poucos para evitar desconforto intestinal",
  },
];

// ============================================================================
// Dados estáticos
// ============================================================================

const SYSTEM_FEATURES = [
  { icon: Bird,     title: "Controle de aves",           description: "Cadastro completo de cada pássaro: anilha, raça, cor, sexo, fotos, ficha genética e histórico." },
  { icon: Heart,    title: "Casais e reprodução",        description: "Forme casais, registre posturas, acompanhe chocas e filhotes com datas e alertas automáticos." },
  { icon: Egg,      title: "Anilhas e rastreabilidade",  description: "Controle de lotes de anilhas, atribuição por filhote e histórico completo de cada ave." },
  { icon: Dna,      title: "Genética e pedigree",        description: "Ficha genética individual, árvore de linhagem até 5 gerações e cálculo de consanguinidade (COI)." },
  { icon: Calculator, title: "Calculadora genética",   description: "Simule cruzamentos antes de formar o casal. Probabilidades de filhotes, portadores e alertas de risco." },
  { icon: Trophy,   title: "Campeonatos",                description: "Inscrições, juízes, pontuações e histórico de participações em exposições e campeonatos." },
  { icon: Shield,   title: "Saúde e manejo",             description: "Registros de saúde, vacinas, tratamentos e alertas de manejo por ave ou por gaiola." },
  { icon: BarChart2, title: "Relatórios",               description: "Relatórios genéticos, de plantel, de cruzamento e de linhagem para decisões fundamentadas." },
  { icon: Users,    title: "Planejamento de reprodução", description: "Identifique os melhores casais, evite cruzamentos proibidos e planeje a próxima temporada." },
];

const GENETICS_FEATURES = [
  { title: "Ficha genética completa",     description: "Lipocromo, melanina, categoria de pena, topete, branco dominante/recessivo, marfim, fator vermelho, mutações visíveis e portadas." },
  { title: "Nomenclatura oficial FOB/OBJO", description: "Interpretação automática das classes oficiais de Canário de Cor e Porte — sem precisar decorar códigos." },
  { title: "Calculadora de cruzamentos",  description: "Quadrado de Punnett para mutações ligadas ao sexo, autossômicas recessivas e dominantes." },
  { title: "Alertas de risco genético",   description: "Aviso automático para cruzamentos perigosos: topetado × topetado, branco dominante × branco dominante, nevado × nevado." },
  { title: "Pedigree e consanguinidade",  description: "Visualize a árvore de linhagem e o Índice de Consanguinidade (COI) antes de fechar um casal." },
  { title: "Relatório antes de acasalar", description: "Gere um relatório completo com genótipos, fenótipos prováveis, portadores e recomendação final." },
];

const TRUST_ITEMS = [
  { title: "Organização profissional do plantel",        description: "Cada ave com sua ficha completa, histórico e linhagem rastreada." },
  { title: "Relatórios para decisão antes da reprodução", description: "Saiba o que esperar dos filhotes antes de fechar o casal." },
  { title: "Genética e manejo em uma única plataforma",   description: "Sem planilhas soltas, sem cadernos perdidos." },
  { title: "Pronto para criadouros pequenos e grandes",   description: "Funciona para 10 aves ou para 500 — a mesma qualidade." },
  { title: "Sem certezas genéticas inventadas",           description: "O sistema separa o que é confirmado, inferido, possível ou desconhecido." },
  { title: "Linguagem clara, em português",               description: "Sem termos soltos em inglês. Tudo explicado para o criador brasileiro." },
];

const FAQ_ITEMS = [
  {
    question: "Como escolher um casal de canários?",
    answer: "Verifique a compatibilidade genética, evite cruzamentos consanguíneos e observe o padrão da raça. O sistema calcula o COI e alerta sobre cruzamentos de risco antes de você fechar o casal.",
  },
  {
    question: "Por que evitar branco dominante com branco dominante?",
    answer: "Quando dois canários brancos dominantes cruzam, 25% dos filhotes recebem duas cópias do gene (dose dupla), o que é letal — esses ovos não se desenvolvem. O resultado prático é uma ninhada menor. O sistema alerta automaticamente esse risco.",
  },
  {
    question: "Por que evitar topetado com topetado?",
    answer: "O gene do topete (crista) em dose dupla também é letal. Cruzar dois topetados gera 25% de filhotes não viáveis. O recomendado é sempre cruzar topetado com sem topete.",
  },
  {
    question: "O que é intenso e nevado?",
    answer: "São categorias de pena. O intenso tem plumagem mais compacta e cor mais concentrada. O nevado tem penas mais largas com bordas claras, dando aparência aveludada. Intenso × nevado é o cruzamento recomendado; nevado × nevado pode gerar filhotes com penas excessivamente largas.",
  },
  {
    question: "Por que vermelho precisa de alimentação pigmentante?",
    answer: "O canário de fator vermelho tem o gene para expressar pigmento avermelhado, mas não produz o pigmento sozinho — precisa ingerir carotenoides (como cántaxantina ou beta-caroteno) para que a cor aparecer. Sem alimentação adequada, a cor fica laranja fraca ou amarelada.",
  },
  {
    question: "O que é marfim?",
    answer: "Marfim é uma mutação ligada ao sexo que dilui o amarelo para amarelo-marfim e o vermelho para vermelho-marfim. Machos podem ser portadores silenciosos; fêmeas não são portadoras — se receberam o gene, manifestam visualmente.",
  },
  {
    question: "O que é portador?",
    answer: "Portador é o pássaro que carrega uma cópia de um gene recessivo sem manifestá-lo visualmente. Ele parece normal, mas pode transmitir o gene para os filhotes. Para mutações ligadas ao sexo, apenas machos podem ser portadores.",
  },
  {
    question: "Como funciona pedigree?",
    answer: "Pedigree é o registro da linhagem do pássaro: pai, mãe, avós, bisavós e assim por diante. O sistema monta a árvore automaticamente conforme você cadastra os casais e filhotes.",
  },
  {
    question: "O que é consanguinidade?",
    answer: "Consanguinidade é o grau de parentesco entre dois pássaros. O Índice de Consanguinidade (COI) mede a probabilidade de um filhote herdar genes idênticos por descendência. Alto COI aumenta o risco de doenças genéticas e redução de vitalidade.",
  },
  {
    question: "Como controlar anilhas?",
    answer: "Cadastre o lote de anilhas com o ano e a entidade. Ao registrar um filhote, atribua a anilha diretamente na ficha. O sistema impede duplicatas e mantém o histórico de cada anilha.",
  },
  {
    question: "Quando fazer ovoscopia?",
    answer: "A ovoscopia é feita entre o 5º e o 7º dia de incubação para verificar se o ovo está fecundado. O sistema pode registrar o resultado e alertar sobre ovos inferteis ou claros.",
  },
  {
    question: "Quando anilhar filhotes?",
    answer: "O momento ideal para anilhar varia por raça, mas geralmente é entre o 7º e o 10º dia de vida, quando o pé ainda cabe pela anilha mas já não sai facilmente. O sistema pode registrar a data de nascimento e calcular a janela ideal.",
  },
  {
    question: "Como organizar chocas?",
    answer: "Registre a data de postura, o número de ovos e a data prevista de eclosão. O sistema calcula automaticamente e pode enviar alertas para ovoscopia e para o momento de anilhar.",
  },
  {
    question: "Como acompanhar saúde e alimentação?",
    answer: "Cada ave tem uma ficha de saúde onde você registra tratamentos, vacinas e observações. O sistema também oferece orientações de nutrição específicas para cada cor e raça.",
  },
  {
    question: "Como preparar aves para campeonato?",
    answer: "Registre as inscrições, acompanhe as pontuações e o histórico de participações. O sistema permite filtrar as aves com melhor desempenho e gerar relatórios para planejamento.",
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-amber-100 rounded-xl overflow-hidden bg-white">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-amber-50/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="font-medium text-amber-950 text-sm pr-4">{question}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-amber-600 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-amber-600 shrink-0" />
        }
      </button>
      {open && (
        <div className="px-5 pb-4 pt-0">
          <p className="text-gray-600 text-sm leading-relaxed">{answer}</p>
        </div>
      )}
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
