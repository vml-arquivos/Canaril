import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import {
  Bird, Egg, Heart, Trophy, Wheat, Bone, Leaf, Droplets, AlertTriangle,
  Zap, Calculator, ChevronDown, ChevronUp, Dna, Shield, Star, BarChart2,
  BookOpen, CheckCircle, Camera, FlaskConical, Tag, Users
} from "lucide-react";
import { trpc } from "@/lib/trpc";

// ─── Marca pública fixa ────────────────────────────────────────────────────────
const BRAND_NAME = "Canaril Lima";
const BRAND_TAGLINE = "Criação e seleção de canários com dedicação, manejo responsável e valorização genética.";
const BRAND_DESCRIPTION = "Um canaril dedicado à evolução do plantel, à organização da criação e à participação responsável em exposições e campeonatos.";
const BRAND_ABOUT = "O Canaril Lima trabalha com criação, seleção e acompanhamento de canários, valorizando organização, manejo diário, genética e bem-estar das aves.";

// ─── Fotos reais de premiação ──────────────────────────────────────────────────
const AWARD_PHOTOS = [
  {
    src: "/images/canaril-lima/premiacoes/0e9eb1d9-e577-4f8e-b50a-95e9a644a5cf-960.webp",
    srcSet: "/images/canaril-lima/premiacoes/0e9eb1d9-e577-4f8e-b50a-95e9a644a5cf-480.webp 480w, /images/canaril-lima/premiacoes/0e9eb1d9-e577-4f8e-b50a-95e9a644a5cf-960.webp 960w",
    alt: "Premiação do Canaril Lima — canário campeão em exposição",
    caption: "Premiação do Canaril Lima",
  },
  {
    src: "/images/canaril-lima/premiacoes/1c724b58-d89b-466e-b054-e0cf7e51c04b-960.webp",
    srcSet: "/images/canaril-lima/premiacoes/1c724b58-d89b-466e-b054-e0cf7e51c04b-480.webp 480w, /images/canaril-lima/premiacoes/1c724b58-d89b-466e-b054-e0cf7e51c04b-960.webp 960w",
    alt: "Canário em exposição — Canaril Lima",
    caption: "Canário em exposição",
  },
  {
    src: "/images/canaril-lima/premiacoes/34406379-6cd1-4cdc-a26d-2b547322a88f-960.webp",
    srcSet: "/images/canaril-lima/premiacoes/34406379-6cd1-4cdc-a26d-2b547322a88f-480.webp 480w, /images/canaril-lima/premiacoes/34406379-6cd1-4cdc-a26d-2b547322a88f-960.webp 960w",
    alt: "Registro de exposição do Canaril Lima",
    caption: "Registro de exposição",
  },
  {
    src: "/images/canaril-lima/premiacoes/3c76d8d2-106d-4da2-ae2a-52d7eb0ef62f-960.webp",
    srcSet: "/images/canaril-lima/premiacoes/3c76d8d2-106d-4da2-ae2a-52d7eb0ef62f-480.webp 480w, /images/canaril-lima/premiacoes/3c76d8d2-106d-4da2-ae2a-52d7eb0ef62f-960.webp 960w",
    alt: "Participação em campeonato — Canaril Lima",
    caption: "Participação em campeonato",
  },
  {
    src: "/images/canaril-lima/premiacoes/3d75ec4a-e287-4662-8cfa-1c1f0fcb670c-960.webp",
    srcSet: "/images/canaril-lima/premiacoes/3d75ec4a-e287-4662-8cfa-1c1f0fcb670c-480.webp 480w, /images/canaril-lima/premiacoes/3d75ec4a-e287-4662-8cfa-1c1f0fcb670c-960.webp 960w",
    alt: "Canário premiado — Canaril Lima",
    caption: "Campeão individual",
  },
  {
    src: "/images/canaril-lima/premiacoes/f6653950-7fc9-4c6a-b390-f7b3488f5db9-960.webp",
    srcSet: "/images/canaril-lima/premiacoes/f6653950-7fc9-4c6a-b390-f7b3488f5db9-480.webp 480w, /images/canaril-lima/premiacoes/f6653950-7fc9-4c6a-b390-f7b3488f5db9-960.webp 960w",
    alt: "Registro de exposição do Canaril Lima",
    caption: "Registro de exposição",
  },
];

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { data: settings } = trpc.settings.get.useQuery();

  // Dados de contato dinâmicos (do banco) — nome da marca é sempre fixo
  const contact = {
    city:  settings?.city  || "",
    state: settings?.state || "",
    phone: settings?.phone || "",
    email: settings?.email || "",
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8]">

      {/* ── Header institucional ──────────────────────────────────────────────── */}
      <header className="border-b border-stone-200 bg-white/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Bird className="w-6 h-6 text-amber-700" />
            <span className="text-lg font-bold text-stone-900 tracking-tight">{BRAND_NAME}</span>
          </div>
          <nav className="flex gap-5 items-center text-sm">
            <a href="#sobre"      className="text-stone-600 hover:text-stone-900 font-medium hidden sm:inline transition-colors">Sobre</a>
            <a href="#premiacoes" className="text-stone-600 hover:text-stone-900 font-medium hidden sm:inline transition-colors">Premiações</a>
            <a href="/guias"      className="text-stone-600 hover:text-stone-900 font-medium hidden sm:inline transition-colors">Guias</a>
            <a href="#contato"    className="text-stone-600 hover:text-stone-900 font-medium hidden sm:inline transition-colors">Contato</a>
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="sm" variant="outline" className="border-stone-300 text-stone-700 hover:bg-stone-50">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <a href={getLoginUrl()}>
                <Button size="sm" variant="outline" className="border-stone-300 text-stone-700 hover:bg-stone-50">
                  Área restrita
                </Button>
              </a>
            )}
          </nav>
        </div>
      </header>

      {/* ── Hero institucional ────────────────────────────────────────────────── */}
      <section className="relative bg-stone-900 overflow-hidden">
        {/* Foto de fundo com overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
          style={{ backgroundImage: "url('/images/canaril-lima/premiacoes/campeao-branco-horizontal.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-stone-950/80 via-amber-950/60 to-stone-900/80" />

        <div className="relative z-10 container mx-auto px-4 py-28 sm:py-36">
          <div className="max-w-3xl">
            {(contact.city || contact.state) && (
              <p className="text-amber-400 text-xs font-semibold tracking-widest uppercase mb-4">
                {[contact.city, contact.state].filter(Boolean).join(", ")}
              </p>
            )}
            <h1 className="text-5xl sm:text-7xl font-bold text-white mb-6 leading-tight tracking-tight">
              {BRAND_NAME}
            </h1>
            <p className="text-xl sm:text-2xl text-stone-300 mb-4 leading-relaxed max-w-2xl">
              {BRAND_TAGLINE}
            </p>
            <p className="text-stone-400 mb-10 max-w-xl leading-relaxed">
              {BRAND_DESCRIPTION}
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#sobre">
                <Button size="lg" className="bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-lg px-8">
                  Conheça o Canaril
                </Button>
              </a>
              <a href="#premiacoes">
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 backdrop-blur-sm px-8">
                  <Trophy className="w-4 h-4 mr-2" />
                  Premiações e Exposições
                </Button>
              </a>
              {!isAuthenticated && (
                <a href={getLoginUrl()}>
                  <Button size="lg" variant="ghost" className="text-stone-400 hover:text-white hover:bg-white/5 px-6">
                    Área restrita
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <a href="#sobre"><ChevronDown className="w-7 h-7 text-white/40" /></a>
        </div>
      </section>

      {/* ── Sobre o Canaril Lima ──────────────────────────────────────────────── */}
      <section id="sobre" className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-amber-700 text-xs font-semibold tracking-widest uppercase mb-3">Sobre o Canaril</p>
              <h2 className="text-3xl font-bold text-stone-900 mb-5 leading-tight">
                Criação com dedicação e responsabilidade
              </h2>
              <p className="text-stone-600 leading-relaxed mb-4">{BRAND_ABOUT}</p>
              <p className="text-stone-500 leading-relaxed text-sm">
                O trabalho é conduzido com atenção ao bem-estar das aves, ao controle genealógico e
                à participação em exposições e campeonatos, sempre com foco na qualidade do plantel.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {FOCUS_CARDS.map((card) => (
                <div key={card.title} className="bg-white border border-stone-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
                  <card.icon className="w-6 h-6 text-amber-600 mb-3" />
                  <h3 className="font-semibold text-stone-900 text-sm mb-1">{card.title}</h3>
                  <p className="text-stone-500 text-xs leading-relaxed">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Premiações e exposições ───────────────────────────────────────────── */}
      <section id="premiacoes" className="bg-stone-950 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mb-10">
            <p className="text-amber-500 text-xs font-semibold tracking-widest uppercase mb-3">Registros reais</p>
            <h2 className="text-3xl font-bold text-white mb-4">Premiações e exposições</h2>
            <p className="text-stone-400 leading-relaxed">
              Registros reais de participação e premiação do Canaril Lima, representando o trabalho de
              manejo, preparação e seleção do plantel.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {AWARD_PHOTOS.map((photo, i) => (
              <figure key={i} className="group rounded-xl overflow-hidden bg-stone-900 border border-stone-800">
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={photo.src}
                    srcSet={photo.srcSet}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    alt={photo.alt}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <figcaption className="px-3 py-2 text-xs text-stone-500">{photo.caption}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Seleção, manejo e genética ────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-20 border-t border-stone-100">
        <div className="max-w-2xl mb-10">
          <p className="text-amber-700 text-xs font-semibold tracking-widest uppercase mb-3">Como trabalhamos</p>
          <h2 className="text-3xl font-bold text-stone-900 mb-4">Seleção, manejo e genética</h2>
          <p className="text-stone-500 leading-relaxed">
            O cuidado com cada ave começa no planejamento do casal e se estende ao acompanhamento diário,
            à organização das anilhas e à preparação para exposições.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {PRACTICE_CARDS.map((card) => (
            <div key={card.title} className="flex gap-4 p-5 rounded-xl bg-white border border-stone-200 hover:shadow-sm transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                <card.icon className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-stone-900 text-sm mb-1">{card.title}</h3>
                <p className="text-stone-500 text-xs leading-relaxed">{card.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Guias e conhecimento ──────────────────────────────────────────────── */}
      <section className="bg-amber-50 border-y border-amber-100 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mb-10">
            <p className="text-amber-700 text-xs font-semibold tracking-widest uppercase mb-3">Conteúdo educativo</p>
            <h2 className="text-3xl font-bold text-stone-900 mb-4">Guias e conhecimento</h2>
            <p className="text-stone-600 leading-relaxed">
              Material de referência sobre criação, genética, manejo e bem-estar de canários.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {GUIDE_CARDS.map((card) => (
              <div key={card.title} className="bg-white rounded-xl border border-amber-100 p-5 hover:shadow-sm transition-shadow">
                <card.icon className="w-6 h-6 text-amber-600 mb-3" />
                <h3 className="font-semibold text-stone-900 text-sm mb-1">{card.title}</h3>
                <p className="text-stone-500 text-xs leading-relaxed">{card.description}</p>
              </div>
            ))}
          </div>
          <div>
            <a href="/guias">
              <Button variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100">
                Ver todos os guias →
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ── Calculadora genética (só para autenticados) ───────────────────────── */}
      {isAuthenticated && (
        <section className="bg-stone-900 py-16">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-2xl mx-auto">
              <Dna className="w-10 h-10 text-amber-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-3">Calculadora Genética</h2>
              <p className="text-stone-400 mb-6 leading-relaxed">
                Simule cruzamentos, calcule probabilidades de filhotes e verifique consanguinidade
                antes de formar um casal.
              </p>
              <Link href="/genetics-calculator">
                <Button size="lg" className="bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-lg px-8">
                  <Zap className="w-4 h-4 mr-2" />
                  Abrir Calculadora
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Perguntas frequentes ──────────────────────────────────────────────── */}
      <section id="faq" className="container mx-auto px-4 py-20 border-t border-stone-100">
        <div className="max-w-2xl mb-10">
          <BookOpen className="w-7 h-7 text-amber-600 mb-3" />
          <h2 className="text-3xl font-bold text-stone-900 mb-4">Perguntas frequentes</h2>
          <p className="text-stone-500 leading-relaxed">Dúvidas comuns sobre criação de canários.</p>
        </div>
        <div className="max-w-3xl space-y-2">
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem key={i} question={item.question} answer={item.answer} />
          ))}
        </div>
      </section>

      {/* ── Contato ───────────────────────────────────────────────────────────── */}
      <section id="contato" className="bg-stone-50 border-t border-stone-200 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-stone-900 mb-3">Contato</h2>
            {(contact.city || contact.phone || contact.email) ? (
              <div className="space-y-2 text-stone-600">
                {(contact.city || contact.state) && (
                  <p>{[contact.city, contact.state].filter(Boolean).join(", ")}</p>
                )}
                {contact.phone && <p>{contact.phone}</p>}
                {contact.email && (
                  <p><a href={`mailto:${contact.email}`} className="text-amber-700 hover:underline">{contact.email}</a></p>
                )}
              </div>
            ) : (
              <p className="text-stone-400 text-sm">
                Informações de contato serão exibidas quando configuradas pelo criador.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-stone-200 bg-white py-8">
        <div className="container mx-auto px-4 text-center text-stone-500 text-sm">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Bird className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-stone-700">{BRAND_NAME}</span>
          </div>
          <p>&copy; {new Date().getFullYear()} {BRAND_NAME}. Todos os direitos reservados.</p>
          {(contact.city || contact.phone || contact.email) && (
            <p className="mt-1 text-xs text-stone-400">
              {[contact.city && contact.state ? `${contact.city}, ${contact.state}` : null, contact.phone, contact.email].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </footer>

    </div>
  );
}

// ─── Dados estáticos ──────────────────────────────────────────────────────────

const FOCUS_CARDS = [
  { icon: Bird,         title: "Seleção responsável",        description: "Escolha de casais com base em genética, padrão e histórico de linhagem." },
  { icon: Heart,        title: "Manejo diário",              description: "Cuidado constante com alimentação, saúde e bem-estar das aves." },
  { icon: Dna,          title: "Genética e planejamento",    description: "Controle de mutações, pedigree e cálculo de consanguinidade." },
  { icon: Tag,          title: "Anilhas e organização",      description: "Rastreabilidade completa de cada ave desde o nascimento." },
];

const PRACTICE_CARDS = [
  { icon: Bird,         title: "Seleção responsável",        description: "Casais formados com critério genético, padrão de raça e histórico de linhagem — sem improviso." },
  { icon: Heart,        title: "Manejo diário",              description: "Rotina de alimentação, higiene e observação das aves, com atenção ao bem-estar individual." },
  { icon: Dna,          title: "Genética e planejamento",    description: "Controle de mutações, cálculo de consanguinidade e planejamento de cruzamentos antes de fechar o casal." },
  { icon: Tag,          title: "Anilhas e organização",      description: "Cada ave identificada desde o nascimento, com rastreabilidade completa de linhagem." },
  { icon: Trophy,       title: "Preparação para exposições", description: "Seleção, condicionamento e acompanhamento das aves para participação em campeonatos." },
  { icon: Shield,       title: "Saúde e prevenção",          description: "Monitoramento de saúde, registros de tratamentos e boas práticas de biosseguridade." },
];

const GUIDE_CARDS = [
  { icon: Dna,          title: "Genética de canários",       description: "Mutações, herança ligada ao sexo, lipocromos, melaninas e como planejar cruzamentos." },
  { icon: Tag,          title: "Guia de anilhas",            description: "Como funcionam as anilhas, bitolas por raça e controle de lotes." },
  { icon: Heart,        title: "Preparação de casais",       description: "Critérios para formação de casais, compatibilidade genética e cuidados no acasalamento." },
  { icon: Egg,          title: "Cuidados com filhotes",      description: "Anilhamento, alimentação de filhotes e acompanhamento do desenvolvimento." },
  { icon: Wheat,        title: "Manejo e rotina",            description: "Rotina diária, limpeza, iluminação e organização do criadouro." },
  { icon: Leaf,         title: "Alimentação e bem-estar",    description: "Sementes, proteína, vitaminas, minerais e o que nunca oferecer a um canário." },
];

const FAQ_ITEMS = [
  {
    question: "Como escolher um casal de canários?",
    answer: "Verifique a compatibilidade genética, evite cruzamentos consanguíneos e observe o padrão da raça. O ideal é cruzar aves com histórico de linhagem conhecido e genótipos complementares.",
  },
  {
    question: "Por que evitar branco dominante com branco dominante?",
    answer: "Quando dois canários brancos dominantes cruzam, 25% dos filhotes recebem duas cópias do gene (dose dupla), o que é letal — esses ovos não se desenvolvem. O resultado prático é uma ninhada menor.",
  },
  {
    question: "Por que evitar topetado com topetado?",
    answer: "O gene do topete (crista) em dose dupla também é letal. Cruzar dois topetados gera 25% de filhotes não viáveis. O recomendado é sempre cruzar topetado com sem topete.",
  },
  {
    question: "O que é intenso e nevado?",
    answer: "São categorias de pena. O intenso tem plumagem mais compacta e cor mais concentrada. O nevado tem penas mais largas com bordas claras, dando aparência aveludada. Intenso × nevado é o cruzamento recomendado.",
  },
  {
    question: "Por que vermelho precisa de alimentação pigmentante?",
    answer: "O canário de fator vermelho tem o gene para expressar pigmento avermelhado, mas precisa ingerir carotenoides (como cantaxantina ou beta-caroteno) para que a cor apareça. Sem alimentação adequada, a cor fica laranja fraca ou amarelada.",
  },
  {
    question: "O que é marfim?",
    answer: "Marfim é uma mutação ligada ao sexo que dilui o amarelo para amarelo-marfim e o vermelho para vermelho-marfim. Machos podem ser portadores silenciosos; fêmeas não são portadoras — se receberam o gene, manifestam visualmente.",
  },
  {
    question: "O que é portador?",
    answer: "Portador é o pássaro que carrega uma cópia de um gene recessivo sem manifestá-lo visualmente. Para mutações ligadas ao sexo, apenas machos podem ser portadores.",
  },
  {
    question: "Como funciona pedigree?",
    answer: "Pedigree é o registro da linhagem do pássaro: pai, mãe, avós, bisavós e assim por diante. A árvore é montada automaticamente conforme os casais e filhotes são cadastrados.",
  },
  {
    question: "O que é consanguinidade?",
    answer: "Consanguinidade é o grau de parentesco entre dois pássaros. O Índice de Consanguinidade (COI) mede a probabilidade de um filhote herdar genes idênticos por descendência. Alto COI aumenta o risco de doenças genéticas.",
  },
  {
    question: "Quando anilhar filhotes?",
    answer: "O momento ideal varia por raça, mas geralmente é entre o 7º e o 10º dia de vida, quando o pé ainda cabe pela anilha mas já não sai facilmente.",
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden bg-white">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-stone-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="font-medium text-stone-900 text-sm pr-4">{question}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-amber-600 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-amber-600 shrink-0" />
        }
      </button>
      {open && (
        <div className="px-5 pb-4 pt-0">
          <p className="text-stone-600 text-sm leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}
