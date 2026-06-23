/**
 * knowledgeExplainer.ts — Explicações em linguagem simples para criadores leigos
 */
export interface ExplanationRecord {
  term: string;
  simpleExplanation: string;
  technicalExplanation: string;
  examples: string[];
  warnings: string;
}

export const EXPLANATIONS: Record<string, ExplanationRecord> = {
  lipocromo: {
    term: "Lipocromo",
    simpleExplanation: "É a cor de fundo do canário — o que você enxerga quando olha para a plumagem. Pode ser amarelo, vermelho, branco ou marfim.",
    technicalExplanation: "Pigmento carotenoide solúvel em gordura que tinge as penas. Não é produzido pelo organismo da ave — vem da alimentação (para o vermelho) ou é genético (para o amarelo).",
    examples: ["Canário amarelo intenso", "Canário vermelho (lipochromo vermelho)", "Canário branco dominante"],
    warnings: "Canários de fator vermelho precisam de pigmentação na ração para expressar a cor. Sem manejo alimentar adequado, a cor sai desbotada.",
  },
  melanina: {
    term: "Melanina",
    simpleExplanation: "É o pigmento escuro que forma listras, marcas e a cor do dorso. Canários sem melanina são chamados de lipocrômicos (cor sólida, sem marcas).",
    technicalExplanation: "Dois tipos principais: eumelanina (preta/marrom) e feomelanina (marrom/ocre). A combinação e intensidade determinam a série melânica do pássaro.",
    examples: ["Canário verde = negro + amarelo", "Canário ágata = eumelanina com padrão específico", "Canário lipochrômico = sem melanina"],
    warnings: "",
  },
  intenso: {
    term: "Intenso (IT)",
    simpleExplanation: "Tipo de plumagem onde o pigmento lipocrômico cobre toda a pena de forma uniforme. O canário parece mais 'cheio' de cor.",
    technicalExplanation: "Fenotipo intenso: penas mais curtas, pigmento concentrado em toda a extensão da pena. Controlado por gene autosomal.",
    examples: ["Amarelo intenso: amarelo forte e uniforme"],
    warnings: "Intenso × intenso não é recomendado. Pode reduzir fertilidade e vitalidade dos filhotes.",
  },
  nevado: {
    term: "Nevado (NV)",
    simpleExplanation: "Tipo de plumagem onde o pigmento fica só no centro das penas, com as bordas claras. O canário parece mais 'suave' e tem penas maiores.",
    technicalExplanation: "Fenotipo nevado (fr. frostlé): penas mais longas com pigmento concentrado no centro, bordas sem pigmento. Complemento ideal do intenso.",
    examples: ["Amarelo nevado: amarelo com halo branco nas penas"],
    warnings: "O cruzamento clássico e mais seguro é sempre intenso × nevado.",
  },
  mosaico: {
    term: "Mosaico",
    simpleExplanation: "Tipo de canário de cor onde o pigmento está concentrado apenas em certas regiões do corpo (fronte, ombros, coxa). O restante da plumagem é branco ou claro.",
    technicalExplanation: "Distribuição restrita do lipocromo a zonas determinadas geneticamente. Julgado pela intensidade do pigmento nessas zonas e pela nitidez das bordas.",
    examples: ["Mosaico amarelo macho", "Mosaico vermelho fêmea"],
    warnings: "Machos e fêmeas mosaico têm padrões de julgamento diferentes. Respeitar classe FOB/OBJO.",
  },
  coi: {
    term: "COI (Coeficiente de Consanguinidade)",
    simpleExplanation: "Um número que mostra o grau de parentesco entre dois pássaros. Quanto maior, maior o risco de os filhotes herdarem genes idênticos dos dois lados da família.",
    technicalExplanation: "Calculado pela Fórmula de Wright: F = Σ [(0,5)^(n₁+n₂+1) × (1 + Fₐ)], onde n₁ e n₂ são as distâncias de cada ancestral comum.",
    examples: ["COI 0% = sem parentesco", "COI 25% = irmãos completos", "COI 6,25% ≈ primos de primeiro grau"],
    warnings: "COI acima de 12,5% requer avaliação cuidadosa. Acima de 25%, cruzamento não recomendado.",
  },
  portador: {
    term: "Portador",
    simpleExplanation: "Um pássaro que carrega um gene sem mostrá-lo visualmente. Ele parece normal, mas pode transmitir o gene para os filhotes.",
    technicalExplanation: "Heterozigoto para gene recessivo ou recessivo ligado ao sexo (macho ZZ). O fenótipo não se altera, mas o genótipo contém o alelo recessivo.",
    examples: ["Macho amarelo portador de ino: parece amarelo, mas produz filhas lutinicas"],
    warnings: "Em genes ligados ao sexo, fêmeas (ZW) NÃO são portadoras silenciosas. Ou manifestam ou não têm o gene.",
  },
  dominante: {
    term: "Dominante",
    simpleExplanation: "Um gene que aparece mesmo quando o pássaro tem apenas uma cópia. Com uma cópia = visual. Com duas cópias = pode ser letal (branco dominante) ou ter dose dupla.",
    technicalExplanation: "Alelo dominante (A) se expressa mesmo na condição heterozigota (Aa). Na condição homozigota (AA), pode ter efeito aumentado ou letal.",
    examples: ["Branco dominante: uma cópia = branco", "Topete: uma cópia = topetado, duas = letal"],
    warnings: "Genes dominantes com fator letal em dose dupla (branco dominante, crista) nunca devem ser cruzados entre si.",
  },
  recessivo: {
    term: "Recessivo",
    simpleExplanation: "Um gene que só aparece quando o pássaro tem duas cópias. Com uma cópia = portador invisível. Com duas cópias = visual.",
    technicalExplanation: "Alelo recessivo (a) só se expressa na condição homozigota (aa). Portadores (Aa) não mostram o fenótipo mas transmitem.",
    examples: ["Branco recessivo: duas cópias = branco", "Pastel: duas cópias = pastel"],
    warnings: "Portador × portador = 25% visual, 50% portadores, 25% normais (proporção Mendeliana 1:2:1).",
  },
  ligado_sexo: {
    term: "Ligado ao sexo",
    simpleExplanation: "Um gene que fica no cromossomo Z. Nos canários, machos têm ZZ e fêmeas têm ZW. Por isso fêmeas não podem ser portadoras silenciosas de genes ligados ao sexo.",
    technicalExplanation: "Genes no cromossomo Z seguem padrão hemizigoto nas fêmeas (ZW). Fêmea expressa qualquer alelo Z que recebeu. Macho ZZ pode ser portador (Zz).",
    examples: ["Marfim: macho pode ser portador, fêmea nunca", "Ágata, canela, ino: mesma lógica"],
    warnings: "Nunca marcar fêmea como portadora de gene ligado ao sexo no sistema.",
  },
  pedigree: {
    term: "Pedigree",
    simpleExplanation: "A árvore genealógica do pássaro. Mostra quem são os pais, avós e bisavós.",
    technicalExplanation: "Registro de ancestralidade usado para calcular COI, inferir genótipo provável e rastrear linhagens de campeões.",
    examples: ["Pássaro com pai e mãe conhecidos: COI pode ser calculado"],
    warnings: "Quanto mais gerações cadastradas, mais preciso é o cálculo de COI e as recomendações de cruzamento.",
  },
  branco_dominante: {
    term: "Branco Dominante",
    simpleExplanation: "Gene que 'apaga' a cor de fundo do canário. Com uma cópia o pássaro fica branco. Com duas cópias o embrião não sobrevive.",
    technicalExplanation: "Mutação dominante que inibe a deposição de lipocromo. Heterozigoto: plumagem branca ou levemente amarelada. Homozigoto: letal durante o desenvolvimento.",
    examples: ["Canário branco dominante: uma cópia do gene BD"],
    warnings: "RISCO LETAL: nunca cruzar dois portadores de branco dominante. 25% dos ovos serão inviáveis.",
  },
  branco_recessivo: {
    term: "Branco Recessivo",
    simpleExplanation: "Gene recessivo que deixa o pássaro branco. Portadores parecem normais (amarelos ou de outra cor) mas carregam o gene.",
    technicalExplanation: "Alelo recessivo (br) inibe o lipocromo. Portadores (Br/br) são fenotipicamente normais. Homozigoto (br/br): plumagem branca ou quase.",
    examples: ["Portador de branco recessivo: parece amarelo normal"],
    warnings: "Portador × portador = 25% dos filhotes serão brancos recessivos visuais.",
  },
};

export function explainTerm(term: string): ExplanationRecord | undefined {
  // Busca por chave exata primeiro
  const key = term.toLowerCase().replace(/\s+/g, "_");
  if (EXPLANATIONS[key]) return EXPLANATIONS[key];

  // Busca por substring
  for (const [k, v] of Object.entries(EXPLANATIONS)) {
    if (k.includes(key) || v.term.toLowerCase().includes(term.toLowerCase())) return v;
  }

  return undefined;
}

export function getAllTerms(): string[] {
  return Object.keys(EXPLANATIONS);
}
