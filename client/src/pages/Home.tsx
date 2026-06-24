import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import {
  Bird,
  Star,
  Heart,
  Dna,
  Phone,
  Mail,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

/*
 * Página pública institucional do Canaril Lima.
 *
 * Esta home não expõe o plantel interno nem recursos de SaaS.  Em vez disso,
 * apresenta a história e os pilares do canaril, mostra fotos de premiações,
 * oferece acesso aos guias educativos e fornece canais de contato.
 */

export default function Home() {
  const { isAuthenticated } = useAuth();
  // Consultamos apenas as configurações públicas para obter informações básicas.
  const { data: settings } = trpc.settings.get.useQuery();

  // Definições do canaril com fallback para valores padrão.
  const breederName = settings?.publicName || "Canaril Lima";
  const breederDescription =
    settings?.publicDescription ||
    "Um canaril dedicado à evolução do plantel, à organização da criação e à participação responsável em exposições e campeonatos.";
  const breederCity = settings?.city || "";
  const breederState = settings?.state || "";
  const breederPhone = settings?.phone || "";
  const breederEmail = settings?.email || "";

  return (
    <div className="min-h-screen bg-[#F9F5EF] text-amber-900">
      {/* Cabeçalho com menu simplificado */}
      <header className="border-b border-amber-200 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Bird className="w-7 h-7 text-amber-600" />
            <span className="text-xl font-bold tracking-tight">{breederName}</span>
          </div>
          <nav className="hidden sm:flex gap-6 items-center text-sm font-medium">
            <a href="#inicio" className="text-amber-800/90 hover:text-amber-900">Início</a>
            <a href="#sobre" className="text-amber-800/90 hover:text-amber-900">Sobre</a>
            <a href="#premiacoes" className="text-amber-800/90 hover:text-amber-900">Premiações</a>
            <Link href="/guias" className="text-amber-800/90 hover:text-amber-900">Guias</Link>
            <a href="#contato" className="text-amber-800/90 hover:text-amber-900">Contato</a>
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700">Área restrita</Button>
              </Link>
            ) : (
              <a href={getLoginUrl()}>
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700">Área restrita</Button>
              </a>
            )}
          </nav>
        </div>
      </header>

      {/* Hero section */}
      <section id="inicio" className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/assets/canaril/hero-plantel-colorido.webp')" }}
        />
        {/* Gradient overlay for legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-amber-900/70 via-amber-900/60 to-amber-950/80" />
        <div className="relative z-10 container mx-auto px-4 py-24 sm:py-32 text-center text-white">
          {(breederCity || breederState) && (
            <p className="text-amber-200 tracking-widest uppercase text-xs mb-5">
              {[breederCity, breederState].filter(Boolean).join(", ")}
            </p>
          )}
          <h1 className="text-4xl sm:text-6xl font-extrabold mb-4">Canaril Lima</h1>
          <p className="max-w-2xl mx-auto text-lg sm:text-xl mb-8">
            Criação e seleção de canários com dedicação, manejo responsável e valorização genética.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#sobre">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold px-8 shadow-lg">
                Conheça o Canaril
              </Button>
            </a>
            <a href="#premiacoes">
              <Button size="lg" variant="outline" className="border-white/50 text-white hover:bg-white/10 px-8">
                Premiações e Exposições
              </Button>
            </a>
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="lg" variant="outline" className="border-white/50 text-white hover:bg-white/10 px-8">
                  Área restrita
                </Button>
              </Link>
            ) : (
              <a href={getLoginUrl()}>
                <Button size="lg" variant="outline" className="border-white/50 text-white hover:bg-white/10 px-8">
                  Área restrita
                </Button>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* About section */}
      <section id="sobre" className="container mx-auto px-4 py-16 border-b border-amber-100">
        <div className="max-w-3xl mx-auto text-center mb-8">
          <h2 className="text-3xl font-bold mb-4">Sobre o Canaril Lima</h2>
          <p className="text-lg leading-relaxed text-amber-800/90">
            {breederDescription}
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-8 max-w-5xl mx-auto text-center">
          <div className="flex flex-col items-center gap-3">
            <Star className="w-10 h-10 text-amber-600" />
            <h3 className="text-xl font-semibold">Seleção</h3>
            <p className="text-amber-700/80 text-sm">
              Focamos na escolha criteriosa de matrizes e reprodutores para evolução contínua do plantel.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <Heart className="w-10 h-10 text-amber-600" />
            <h3 className="text-xl font-semibold">Manejo</h3>
            <p className="text-amber-700/80 text-sm">
              Garantimos bem‑estar e nutrição balanceada, com cuidados diários e instalações adequadas.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <Dna className="w-10 h-10 text-amber-600" />
            <h3 className="text-xl font-semibold">Genética</h3>
            <p className="text-amber-700/80 text-sm">
              Utilizamos ferramentas de genealogia e calculadora genética para planejar cruzamentos ideais.
            </p>
          </div>
        </div>
      </section>

      {/* Awards section */}
      <section id="premiacoes" className="container mx-auto px-4 py-16 border-b border-amber-100">
        <div className="max-w-3xl mx-auto text-center mb-8">
          <h2 className="text-3xl font-bold mb-4">Premiações e Exposições</h2>
          <p className="text-lg text-amber-800/90">
            Participamos ativamente de exposições e campeonatos, conquistando reconhecimentos que reforçam a qualidade do nosso trabalho.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              src: "/images/canaril-lima/premiacoes/canaril-lima-premiacao-01-960.webp",
              alt: "Premiação do Canaril Lima 1",
            },
            {
              src: "/images/canaril-lima/premiacoes/canaril-lima-premiacao-02-960.webp",
              alt: "Premiação do Canaril Lima 2",
            },
            {
              src: "/images/canaril-lima/premiacoes/canaril-lima-premiacao-03-960.webp",
              alt: "Premiação do Canaril Lima 3",
            },
            {
              src: "/images/canaril-lima/premiacoes/canaril-lima-premiacao-04-960.webp",
              alt: "Premiação do Canaril Lima 4",
            },
            {
              src: "/images/canaril-lima/premiacoes/canaril-lima-premiacao-05-960.webp",
              alt: "Premiação do Canaril Lima 5",
            },
            {
              src: "/images/canaril-lima/premiacoes/canaril-lima-premiacao-06-960.webp",
              alt: "Premiação do Canaril Lima 6",
            },
          ].map((photo) => (
            <div key={photo.src} className="overflow-hidden rounded-lg shadow-sm border border-amber-200">
              <img
                src={photo.src}
                alt={photo.alt}
                loading="lazy"
                className="w-full h-60 object-cover object-center"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Guides section */}
      <section id="guias" className="container mx-auto px-4 py-16 border-b border-amber-100">
        <div className="max-w-3xl mx-auto text-center mb-8">
          <h2 className="text-3xl font-bold mb-4">Guias e Conhecimento</h2>
          <p className="text-lg text-amber-800/90">
            Explore nossos artigos e materiais educativos sobre criação, manejo, genética, nutrição e saúde dos canários.
          </p>
        </div>
        <div className="flex justify-center">
          <Link href="/guias">
            <Button size="lg" className="bg-amber-600 hover:bg-amber-700 text-white font-medium px-8 shadow-md">
              Acessar Guias
            </Button>
          </Link>
        </div>
      </section>

      {/* FAQ section */}
      <section id="faq" className="container mx-auto px-4 py-16 border-b border-amber-100">
        <div className="max-w-3xl mx-auto text-center mb-8">
          <h2 className="text-3xl font-bold mb-4">Perguntas Frequentes</h2>
          <p className="text-lg text-amber-800/90">
            Dúvidas comuns sobre a criação de canários, participação em campeonatos e como funcionam nossas ferramentas estão respondidas abaixo.
          </p>
        </div>
        <div className="max-w-4xl mx-auto space-y-4">
          <details className="bg-white border border-amber-200 rounded-lg p-4">
            <summary className="font-semibold cursor-pointer">Como posso iniciar a criação de canários?</summary>
            <p className="mt-2 text-sm text-amber-700/90">
              Recomendamos iniciar com um casal saudável de linha confiável, acompanhar guias de manejo e contar com orientações de criadores experientes.
            </p>
          </details>
          <details className="bg-white border border-amber-200 rounded-lg p-4">
            <summary className="font-semibold cursor-pointer">O sistema Canário Gestão Pro é obrigatório?</summary>
            <p className="mt-2 text-sm text-amber-700/90">
              Não. Ele é uma ferramenta opcional que facilita o controle do plantel, genealogia e relatórios. A home pública é apenas institucional.
            </p>
          </details>
          <details className="bg-white border border-amber-200 rounded-lg p-4">
            <summary className="font-semibold cursor-pointer">Posso visitar o Canaril Lima pessoalmente?</summary>
            <p className="mt-2 text-sm text-amber-700/90">
              Visitas são possíveis mediante agendamento prévio. Entre em contato pelos canais informados para combinar uma visita.
            </p>
          </details>
        </div>
      </section>

      {/* Contact section */}
      <section id="contato" className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center mb-8">
          <h2 className="text-3xl font-bold mb-4">Contato</h2>
          <p className="text-lg text-amber-800/90">
            Fale conosco para esclarecer dúvidas, agendar visitas ou saber mais sobre nosso trabalho.
          </p>
        </div>
        <div className="max-w-md mx-auto space-y-6 text-center">
          {breederPhone && (
            <div className="flex items-center justify-center gap-3 text-amber-800">
              <Phone className="w-5 h-5 text-amber-700" />
              <a href={`tel:${breederPhone}`} className="underline hover:no-underline">{breederPhone}</a>
            </div>
          )}
          {breederEmail && (
            <div className="flex items-center justify-center gap-3 text-amber-800">
              <Mail className="w-5 h-5 text-amber-700" />
              <a href={`mailto:${breederEmail}`} className="underline hover:no-underline">{breederEmail}</a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}