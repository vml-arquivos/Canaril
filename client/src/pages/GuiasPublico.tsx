/**
 * GuiasPublico.tsx — Portal educativo público
 *
 * Rotas: /guias, /guias/:slug, /faq, /glossario
 *
 * Conteúdo estático inicial com arquitetura pronta para CMS futuro.
 * SEO-first: cada guia tem H1 único, meta description própria,
 * URLs amigáveis e texto estruturado com H2.
 */
import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bird, BookOpen, ChevronRight, Home, List, MessageCircle } from "lucide-react";

// ─── Dados dos guias ──────────────────────────────────────────────────────────

const GUIAS = [
  {
    slug: "como-criar-canarios",
    title: "Como começar a criar canários",
    description: "Guia completo para iniciantes: ambiente, equipamentos, alimentação básica e primeiros passos na canaricultura.",
    category: "Iniciantes",
    readTime: "8 min",
    content: `
## Por que criar canários?

Os canários são aves pequenas, relativamente silenciosas e de fácil manejo. Para criadores iniciantes, eles representam um excelente ponto de entrada na canaricultura. Ao contrário de aves maiores, não exigem espaço muito amplo e têm custos de alimentação acessíveis.

## O ambiente ideal

Antes de adquirir seu primeiro pássaro, prepare o espaço. Canários toleram bem temperaturas entre 15°C e 28°C, mas não suportam correntes de ar. Um cômodo ventilado sem exposição direta ao vento já é suficiente para começar.

As gaiolas devem ter espaço suficiente para o pássaro bater as asas: no mínimo 45 cm de comprimento por 30 cm de largura e 40 cm de altura para cada pássaro. Para casais em reprodução, use gaiolas maiores (60×40×40 cm) ou volieiras.

## Alimentação básica

A base da alimentação de canários é a mistura de sementes. As mais usadas são:

- **Alpiste** (50 a 60% da mistura) — fonte principal de energia
- **Colza** — rica em gordura e proteínas
- **Painço** — bem aceito pelos filhotes
- **Niger** — aumentar na muda e no inverno

Verduras como alface, agrião, couve e cenoura ralada devem ser oferecidas frescas e retiradas após algumas horas para evitar fermentação. Gema de ovo cozida é essencial na reprodução.

## O que não oferecer

Nunca ofereça abacate, cebola, alho, chocolate, café, leite nem alimentos condimentados. Esses itens podem ser tóxicos ou causar problemas digestivos sérios.

## Primeiros pássaros

Adquira machos e fêmeas de um criador registrado. Verifique se os pássaros têm anilha oficial com o código do criador — isso garante a rastreabilidade da linhagem. Pássaros sem anilha têm procedência desconhecida e não podem competir em campeonatos oficiais.

## Acompanhamento

Observe seus pássaros diariamente. Penas eriçadas fora do horário de descanso, secreção nasal, fezes amolecidas ou postura curvada são sinais de alerta. Em caso de dúvida, consulte um veterinário especializado em aves.
    `,
  },
  {
    slug: "alimentacao-de-canarios",
    title: "Alimentação de canários por fase",
    description: "O que dar para canários em cada fase: reprodução, muda, inverno e desenvolvimento de filhotes.",
    category: "Manejo",
    readTime: "6 min",
    content: `
## A alimentação muda ao longo do ano

A necessidade nutricional do canário varia bastante conforme a estação e a fase reprodutiva. Adaptar a dieta a cada momento é um dos pilares de um criadouro saudável.

## Fora da reprodução (entressafra)

Neste período, a dieta pode ser mais simples: mistura de sementes com alpiste como base, água fresca trocada diariamente e verduras três vezes por semana. Evite excesso de sementes oleaginosas (colza, niger) para não engordar os pássaros antes da reprodução.

## Pré-reprodução (agosto a setembro)

Nas semanas que antecedem o acasalamento, introduza gradualmente:

- Gema de ovo cozida (2 a 3 vezes por semana)
- Aumento de colza na mistura
- Beterraba ralada — rica em betacaroteno, estimula a pigmentação de canários de cor
- Suplementos vitamínicos na água (conforme orientação de veterinário)

A ingestão aumentada de proteína estimula a ovulação nas fêmeas e a produção de espermatozoides nos machos.

## Durante a reprodução

Com ovos ou filhotes, o casal precisa de:

- Pasta de criação ou farinha de ovo todos os dias
- Verduras frescas diárias (alface, couve, cenoura)
- Água limpa no máximo duas vezes ao dia (filhotes são sensíveis a bactérias)
- Cálcio: lula, casca de ovo triturada ou calcário

Retire alimentos não consumidos em até 4 horas para evitar fermentação.

## Muda (dezembro a fevereiro)

A muda é um período de alto gasto energético. Ofereça:

- Aumento de 30 a 40% na quantidade de sementes oleaginosas
- Niger em maior quantidade
- Aminoácidos sulfurados (metionina e cisteína) — encontrados em ovos e suplementos específicos
- Redução ou suspensão da reprodução

## Filhotes desmamados

Filhotes recém-desmamados preferem alpiste e painço, que são menores e mais fáceis de descascar. Introduza gradualmente os outros grãos. Ofereça pasta de criação úmida até os 45 dias para garantir o desenvolvimento correto das penas.
    `,
  },
  {
    slug: "reproducao-de-canarios",
    title: "Reprodução e ninhadas de canários",
    description: "Como preparar casais, montar gaiola de reprodução, cuidar dos ovos e dos filhotes.",
    category: "Reprodução",
    readTime: "7 min",
    content: `
## Quando começar a reprodução

No Brasil, a estação reprodutiva natural vai de agosto a janeiro. O fotoperíodo (horas de luz por dia) é o principal gatilho hormonal. Em criadouros com iluminação artificial, é possível antecipar a reprodução, mas isso exige experiência e manejo cuidadoso.

## Seleção de casais

Nunca forme casais apenas por conveniência. Considere:

- **Saúde**: pássaros com histórico de doenças não devem reproduzir
- **Genética**: conheça o pedigree dos dois para evitar consanguinidade elevada
- **Objetivo**: cor, porte ou performance em exposição

Um sistema de gestão como o Canaril ajuda a calcular o COI (Coeficiente de Consanguinidade) e identificar combinações com menor risco genético.

## Montagem da gaiola

Instale ninho de plástico ou madeira na parte superior da gaiola com algodão ou fibra vegetal para a fêmea montar. A fêmea escolhe o material — ofereça pedaços pequenos e deixe ela organizar.

## Postura e incubação

A fêmea põe um ovo por dia, normalmente cedo pela manhã. A maioria das ninhadas tem 3 a 5 ovos. A incubação dura aproximadamente 13 a 14 dias.

Para sincronizar a eclosão e melhorar a taxa de filhotes, muitos criadores retiram os ovos diariamente e os substituem por ovos falsos de plástico, devolvendo todos juntos no dia que seria o quarto ou quinto ovo.

## Cuidado com os filhotes

Os filhotes nascem cegos e sem penas. Nos primeiros 5 a 7 dias, o casal os alimenta com papa produzida a partir de sementes e pasta de criação. A intervenção humana deve ser mínima nesse período.

A partir dos 21 dias, os filhotes começam a se alimentar sozinhos. O desmame completo ocorre entre 30 e 35 dias. Após o desmame, separe-os do casal para evitar agressividade.

## Anilhamento

Anilhe os filhotes entre o 7º e o 9º dia, quando os dedos são pequenos o suficiente para passar pela anilha e grandes o suficiente para não perdi-la. Use o tamanho correto de acordo com a raça.

Registre a anilha, o casal de origem e a data de nascimento no sistema para manter o pedigree organizado.
    `,
  },
  {
    slug: "anilhas-para-canarios",
    title: "Anilhas para canários: como funcionam",
    description: "O que são anilhas, para que servem, como colocar e como registrar no sistema de gestão.",
    category: "Rastreabilidade",
    readTime: "5 min",
    content: `
## O que é uma anilha

A anilha é um anel metálico ou plástico colocado na pata do filhote. Ela funciona como a identidade do pássaro: contém o ano de nascimento, o código do criador, o número de série e, muitas vezes, a sigla da associação.

Uma anilha oficial garante que:
- O pássaro tem procedência rastreável
- O criador pode participar de campeonatos organizados pela FOB, OBJO ou outras entidades
- A linhagem pode ser registrada em pedigrees oficiais

## Tipos de anilha

**Anilhas fechadas (de pata)**: colocadas nos primeiros dias de vida, quando os dedos ainda são pequenos. São permanentes — não podem ser removidas sem cortar. São as únicas aceitas em campeonatos.

**Anilhas abertas (de identificação)**: usadas para adultos, identificação temporária ou marcação visual. Não substituem as anilhas fechadas para fins oficiais.

## Como colocar uma anilha fechada

O procedimento é feito entre o 7º e o 9º dia de vida:

1. Passe os três dedos anteriores pela anilha
2. Segure os dedos juntos e empurre a anilha até o calcanhar
3. Com um palito, solte o dedo posterior que ficou preso
4. Confirme que a anilha gira livremente sem apertar

Se a anilha não passar ou ficar muito apertada, aguarde mais um dia ou use o tamanho maior.

## Tamanhos de anilha

Cada raça tem um tamanho de anilha recomendado. Para canários de cor, o tamanho padrão mais comum é 2,7 mm. Para raças de porte (Padovano, Gloster, Yorkshire), consulte o padrão da raça.

## Registro no sistema

Após anilhar, registre imediatamente no sistema:
- Número da anilha
- Data de nascimento
- Casal de origem (pai e mãe)
- Cor e sexo (se já for possível determinar)

O Canaril organiza lotes de anilhas por ano e código de criador, gerando automaticamente a sequência e alertando quando um lote está acabando.
    `,
  },
  {
    slug: "genetica-basica-de-canarios",
    title: "Genética básica de canários: intenso, nevado e lipocromos",
    description: "Entenda os conceitos de lipocromo, melanina, intenso, nevado e mosaico. Como os genes se transmitem.",
    category: "Genética",
    readTime: "10 min",
    content: `
## Por que estudar genética?

Compreender a genética dos canários não é só para criadores avançados. Mesmo quem está começando pode evitar combinações arriscadas e produzir filhotes com maior previsibilidade simplesmente entendendo alguns conceitos básicos.

## Lipocromo e melanina

A cor do canário é determinada por dois sistemas independentes:

**Lipocromo** é o pigmento de fundo — a cor base da pena. Pode ser amarelo, vermelho (fator vermelho), branco ou marfim. É determinado por pigmentos solúveis em gordura (carotenoides).

**Melanina** é o pigmento escuro que forma listras, marcações e a cor geral do dorso. Os principais tipos são eumelanina (preta/marrom) e feomelanina (marrom/ocre). Canários sem melanina são chamados de lipocrômicos (ou "claros").

## Intenso e nevado

Esta é uma das distinções mais importantes na classificação de canários de cor:

**Intenso** (IT): o pigmento lipocrômico está distribuído de forma concentrada e uniforme nas penas. O pássaro parece mais "cheio" de cor, com penas menores e mais próximas.

**Nevado** (NV): o pigmento lipocrômico se concentra no centro da pena, deixando as bordas brancas ou mais claras. O pássaro parece mais "lavado" mas tem contornos suaves e penas maiores.

**ATENÇÃO**: intenso × intenso não é recomendado. Existe evidência de que a combinação de dois intensos reduz a fertilidade e a viabilidade dos filhotes. O cruzamento clássico e seguro é intenso × nevado.

## Mosaico

O canário mosaico tem a distribuição do pigmento limitada a certas regiões do corpo (frente, topo da cabeça, ombros, coxa). A intensidade dessas manchas é o que os juízes avaliam em campeonatos.

## Branco dominante

O branco dominante é causado por um gene que inibe a expressão do lipocromo. Um único gene (heterozigoto) já causa o fenômeno visual. Dois genes (homozigoto) são letais — o embrião não se desenvolve.

Por isso: nunca cruzar dois brancos dominantes. O sistema Canaril alerta automaticamente para esse risco quando você seleciona um casal com dois portadores.

## Crista (topete)

O gene da crista também é dominante. Um pássaro com crista tem um gene de crista e um gene sem crista. Dois genes de crista resultam em embriões inviáveis.

A regra é simples: **crista × liso** (sem crista). Nunca crista × crista.

## Como o Canaril usa esses dados

Ao preencher o Genótipo Avançado de cada pássaro (lipocromo, plumagem, mutações e zigosidade), a calculadora genética usa esses dados para prever os filhotes esperados e emitir alertas de risco. Quanto mais completos forem os dados, mais precisa será a previsão.
    `,
  },
];

const FAQ_PUBLICA = [
  {
    q: "O Canaril é gratuito?",
    a: "O sistema é gerenciado por Canaril Lima. Entre em contato para saber sobre acesso e planos.",
  },
  {
    q: "Preciso saber genética para usar?",
    a: "Não. O sistema funciona mesmo sem preencher dados genéticos. A genética é opcional e se torna mais útil conforme você avança no manejo do plantel.",
  },
  {
    q: "As classes FOB e OBJO estão todas no sistema?",
    a: "Sim. O catálogo oficial contém 138 classes reais de canários de cor e de porte, usadas diretamente na ficha genética e na calculadora.",
  },
  {
    q: "Posso registrar pássaros sem anilha?",
    a: "Sim. A anilha é recomendada para rastreabilidade, mas você pode cadastrar pássaros usando qualquer código de identificação que preferir.",
  },
  {
    q: "O que é COI?",
    a: "COI significa Coeficiente de Consanguinidade. É um número que indica o grau de parentesco entre dois pássaros. Quanto maior, mais risco de problemas genéticos nos filhotes. O sistema calcula automaticamente ao cadastrar um casal.",
  },
  {
    q: "Posso acessar pelo celular?",
    a: "Sim. O sistema é responsivo e funciona bem em dispositivos móveis.",
  },
  {
    q: "O que é intenso e nevado?",
    a: "São os dois tipos de plumagem do canário de cor. Intenso tem pigmento concentrado e uniforme; nevado tem pigmento concentrado no centro das penas, com bordas mais claras. O cruzamento recomendado é sempre intenso × nevado.",
  },
  {
    q: "Posso usar a calculadora sem preencher a genética?",
    a: "Parcialmente. O modo Simples funciona com qualquer dado. O modo Casal do Plantel exige que os dois pássaros tenham o Genótipo Avançado preenchido na ficha. O modo Par Ideal funciona e melhora conforme mais dados são cadastrados.",
  },
];

const GLOSSARIO = [
  { term: "Alpiste", def: "Principal semente da dieta de canários. Fonte de energia e carboidratos." },
  { term: "Anilha", def: "Anel de identificação colocado na pata do filhote. Registra criador, ano e número de série." },
  { term: "Branco dominante", def: "Gene que suprime o lipocromo. Homozigoto é letal — nunca cruze dois brancos dominantes." },
  { term: "COI", def: "Coeficiente de Consanguinidade. Indica o grau de parentesco entre dois pássaros." },
  { term: "Crista / Topete", def: "Gene dominante que forma o topete. Também letal em dose dupla — nunca crista × crista." },
  { term: "Eumelanina", def: "Pigmento escuro (preto/marrom) que forma listras e marcações nos canários melânicos." },
  { term: "Feomelanina", def: "Pigmento marrom/ocre presente em algumas mutações melânicas." },
  { term: "FOB", def: "Federação Ornitológica Brasileira. Organiza os padrões de raças e campeonatos nacionais." },
  { term: "Genótipo", def: "A composição genética real de um pássaro, incluindo genes que não aparecem visualmente." },
  { term: "Heterozigoto", def: "Pássaro que tem duas versões diferentes de um gene (ex: portador de ino)." },
  { term: "Homozigoto", def: "Pássaro que tem duas cópias iguais de um gene (manifesta ou normal)." },
  { term: "Intenso (IT)", def: "Plumagem com pigmento lipocrômico concentrado e uniforme, penas mais curtas." },
  { term: "Ino", def: "Mutação ligada ao sexo que elimina a eumelanina. Produz lutinos (amarelos) e albinos." },
  { term: "Lipocromo", def: "Pigmento solúvel em gordura que determina a cor de fundo do canário (amarelo, vermelho, branco)." },
  { term: "Melanina", def: "Pigmento que forma listras e marcações. Canários sem melanina são chamados lipocrômicos." },
  { term: "Mosaico", def: "Distribuição restrita do pigmento em regiões específicas do corpo (fronte, ombros, coxa)." },
  { term: "Muda", def: "Troca anual das penas, geralmente em dezembro-fevereiro. Período de alto gasto energético." },
  { term: "Nevado (NV)", def: "Plumagem com pigmento concentrado no centro das penas, bordas mais claras. Par ideal com intenso." },
  { term: "OBJO", def: "Organização Brasileira de Juízes Ornitológicos. Classifica raças e treina juízes." },
  { term: "Pedigree", def: "Registro genealógico de um pássaro, mostrando ancestrais por gerações." },
  { term: "Portador", def: "Pássaro que carrega um gene recessivo sem manifestá-lo visualmente." },
  { term: "Postura", def: "Conjunto de ovos colocados por uma fêmea em uma estação reprodutiva." },
  { term: "Punnett", def: "Tabela usada para calcular a probabilidade genética dos filhotes de um cruzamento." },
  { term: "Sex-linked (ligado ao sexo)", def: "Gene localizado no cromossomo sexual Z. Machos podem ser portadores; fêmeas sempre manifestam ou não." },
  { term: "Zigosidade", def: "Se o pássaro tem um (heterozigoto) ou dois (homozigoto) genes de uma mutação." },
];

// ─── Componentes ──────────────────────────────────────────────────────────────

function NavPublica() {
  return (
    <header className="border-b border-amber-100 bg-white/90 backdrop-blur sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2">
          <Bird className="w-6 h-6 text-amber-600" />
          <span className="text-lg font-bold text-amber-900">Canaril Lima</span>
        </Link>
        <nav className="flex gap-4 items-center text-sm">
          <Link href="/guias" className="text-amber-800/80 hover:text-amber-900 font-medium hidden sm:inline">Guias</Link>
          <Link href="/faq" className="text-amber-800/80 hover:text-amber-900 font-medium hidden sm:inline">FAQ</Link>
          <Link href="/glossario" className="text-amber-800/80 hover:text-amber-900 font-medium hidden sm:inline">Glossário</Link>
          <Link href="/login">
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700">Entrar</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}

function BreadcrumbPublico({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-gray-400 mb-6">
      <Link href="/" className="hover:text-amber-700"><Home className="w-3.5 h-3.5" /></Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="w-3 h-3" />
          {item.href
            ? <Link href={item.href} className="hover:text-amber-700">{item.label}</Link>
            : <span className="text-gray-600">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

// ─── Página: Lista de Guias ───────────────────────────────────────────────────

export function GuiasIndex() {
  return (
    <div className="min-h-screen bg-[#FBF8F3]">
      <NavPublica />
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <BreadcrumbPublico items={[{ label: "Guias" }]} />
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Guias de Canaricultura</h1>
          <p className="text-gray-600 text-lg">
            Aprenda sobre criação, alimentação, genética e manejo de canários. Conteúdo prático
            para criadores iniciantes e avançados.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          {GUIAS.map((guia) => (
            <Link key={guia.slug} href={`/guias/${guia.slug}`}>
              <div className="bg-white rounded-xl border border-amber-100 p-6 hover:border-amber-300 hover:shadow-md transition-all cursor-pointer h-full">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">{guia.category}</Badge>
                  <span className="text-xs text-gray-400">{guia.readTime} de leitura</span>
                </div>
                <h2 className="text-base font-semibold text-gray-900 mb-2">{guia.title}</h2>
                <p className="text-sm text-gray-500 leading-relaxed">{guia.description}</p>
                <div className="flex items-center gap-1 mt-4 text-amber-700 text-sm font-medium">
                  <BookOpen className="w-4 h-4" />
                  Ler guia
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-amber-100 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div>
            <h2 className="font-semibold text-gray-800 mb-1">Ficou com dúvidas?</h2>
            <p className="text-sm text-gray-500">Veja o <Link href="/faq" className="text-amber-700 underline">FAQ</Link> ou o <Link href="/glossario" className="text-amber-700 underline">glossário de termos</Link>.</p>
          </div>
          <Link href="/login">
            <Button className="bg-amber-600 hover:bg-amber-700">Acessar o Sistema</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}

// ─── Página: Guia Individual ──────────────────────────────────────────────────

function renderContent(markdown: string) {
  // Renderização simples sem dependência extra
  const lines = markdown.trim().split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 text-gray-700 mb-4 pl-2">
          {listBuffer.map((li, i) => {
            const parts = li.replace(/^-\s*/, "").split(/\*\*(.+?)\*\*/g);
            return (
              <li key={i} className="text-sm leading-relaxed">
                {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
              </li>
            );
          })}
        </ul>
      );
      listBuffer = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      flushList();
      elements.push(<h2 key={elements.length} className="text-xl font-bold text-gray-900 mt-8 mb-3">{line.replace("## ", "")}</h2>);
    } else if (line.startsWith("- ")) {
      listBuffer.push(line);
    } else if (line.trim() === "") {
      flushList();
    } else if (line.trim()) {
      flushList();
      const parts = line.split(/\*\*(.+?)\*\*/g);
      elements.push(
        <p key={elements.length} className="text-gray-700 mb-4 leading-relaxed text-sm sm:text-base">
          {parts.map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p)}
        </p>
      );
    }
  }
  flushList();
  return elements;
}

export function GuiaIndividual() {
  const [, params] = useRoute("/guias/:slug");
  const slug = params?.slug;
  const guia = GUIAS.find((g) => g.slug === slug);

  if (!guia) {
    return (
      <div className="min-h-screen bg-[#FBF8F3]">
        <NavPublica />
        <main className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Guia não encontrado</h1>
          <Link href="/guias"><Button variant="outline">Ver todos os guias</Button></Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF8F3]">
      <NavPublica />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <BreadcrumbPublico items={[{ label: "Guias", href: "/guias" }, { label: guia.title }]} />
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">{guia.category}</Badge>
            <span className="text-xs text-gray-400">{guia.readTime} de leitura</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">{guia.title}</h1>
          <p className="text-gray-500 text-lg leading-relaxed">{guia.description}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-100 p-8">
          {renderContent(guia.content)}
        </div>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-between">
          <Link href="/guias">
            <Button variant="outline"><List className="w-4 h-4 mr-1.5" />Todos os guias</Button>
          </Link>
          <Link href="/login">
            <Button className="bg-amber-600 hover:bg-amber-700">Acessar o Sistema</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}

// ─── Página: FAQ ──────────────────────────────────────────────────────────────

export function FAQPublico() {
  return (
    <div className="min-h-screen bg-[#FBF8F3]">
      <NavPublica />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <BreadcrumbPublico items={[{ label: "FAQ" }]} />
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Perguntas Frequentes</h1>
        <p className="text-gray-600 mb-8">Dúvidas sobre o sistema Canaril e sobre criação de canários.</p>
        <div className="space-y-4">
          {FAQ_PUBLICA.map((item, i) => (
            <div key={i} className="bg-white rounded-xl border border-amber-100 p-5">
              <div className="flex items-start gap-3">
                <MessageCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-semibold text-gray-900 mb-2">{item.q}</h2>
                  <p className="text-gray-600 text-sm leading-relaxed">{item.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <p className="text-sm text-gray-500 mb-4">Não encontrou o que precisava?</p>
          <Link href="/guias"><Button variant="outline" className="mr-3">Ver guias</Button></Link>
          <Link href="/login"><Button className="bg-amber-600 hover:bg-amber-700">Entrar no sistema</Button></Link>
        </div>
      </main>
    </div>
  );
}

// ─── Página: Glossário ────────────────────────────────────────────────────────

export function GlossarioPublico() {
  const lettersSet = new Set(GLOSSARIO.map((g) => g.term[0].toUpperCase()));
  const letters = Array.from(lettersSet).sort();

  return (
    <div className="min-h-screen bg-[#FBF8F3]">
      <NavPublica />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <BreadcrumbPublico items={[{ label: "Glossário" }]} />
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Glossário de Canaricultura</h1>
        <p className="text-gray-600 mb-8">Termos técnicos usados no Canaril e na criação de canários.</p>
        <div className="space-y-8">
          {letters.map((letter) => (
            <div key={letter}>
              <h2 className="text-lg font-bold text-amber-700 border-b border-amber-200 pb-1 mb-3">{letter}</h2>
              <dl className="space-y-3">
                {GLOSSARIO.filter((g) => g.term[0].toUpperCase() === letter).map((g, i) => (
                  <div key={i} className="bg-white rounded-lg border border-amber-50 p-4">
                    <dt className="font-semibold text-gray-900 text-sm">{g.term}</dt>
                    <dd className="text-gray-600 text-sm mt-1 leading-relaxed">{g.def}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
