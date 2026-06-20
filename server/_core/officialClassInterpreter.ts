/**
 * Interpretador de Nomenclatura Oficial (FOB/OBJO)
 * ============================================================================
 * Converte o NOME oficial de uma classe (ex.: "ÁGATA VERMELHO INTENSO",
 * "PADOVANO COM TOPETE BRANCO 100% LIPOCRÔMICO") em traços genéticos
 * estruturados, prontos para alimentar o genótipo do pássaro
 * (server/_core/mendelian.ts e lipochrome.ts).
 *
 * REGRA DE OURO (do manual de referência): a nomenclatura oficial
 * classifica o FENÓTIPO — o que se vê. Ela não confirma genes ocultos.
 * Por isso, tudo que este interpretador deduz vem com um nível de
 * confiança e uma lista de "reasoning" (por que chegou a essa conclusão),
 * nunca apresentado como certeza absoluta sobre o genótipo completo.
 * ============================================================================
 */

export type Modality = "COR" | "PORTE";

export type LipochromeBaseGuess =
  | "amarelo"
  | "amarelo_marfim"
  | "vermelho"
  | "vermelho_marfim"
  | "laranja_intermediario"
  | "branco_dominante"
  | "branco_recessivo"
  | "desconhecido";

export type StatusSimples = "nenhum" | "visual" | "desconhecido";
export type StatusComPortador = "nenhum" | "portador" | "possivel_portador" | "visual" | "desconhecido";
export type StatusVermelho = StatusComPortador | "intermediario";
export type CrestTypeGuess = "com_topete" | "sem_topete" | "corona" | "consort" | "nao_aplicavel" | "desconhecido";

export type InterpretedTraits = {
  modality: Modality;
  breedName?: string;
  lipochromeBase: LipochromeBaseGuess;
  melaninSeries?: string;
  featherCategory?: "intenso" | "nevado" | "mosaico_macho" | "mosaico_femea" | "mosaico_desconhecido";
  crestType?: CrestTypeGuess;
  dominantWhiteStatus: StatusSimples;
  recessiveWhiteStatus: StatusComPortador;
  ivoryStatus: StatusComPortador;
  redFactorStatus: StatusVermelho;
  visibleMutations: string[];
  geneticWarnings: string[];
  nutritionRecommendations: string[];
  confidenceScore: number; // 0 a 1
  reasoning: string[];
};

function blank(modality: Modality): InterpretedTraits {
  return {
    modality,
    lipochromeBase: "desconhecido",
    dominantWhiteStatus: "desconhecido",
    recessiveWhiteStatus: "desconhecido",
    ivoryStatus: "desconhecido",
    redFactorStatus: "desconhecido",
    visibleMutations: [],
    geneticWarnings: [],
    nutritionRecommendations: [],
    confidenceScore: 0.2,
    reasoning: [],
  };
}

const MELANIN_TERMS: Array<[string, string]> = [
  ["ÁGATA", "agata"],
  ["AGATA", "agata"],
  ["CANELA", "canela"],
  ["ISABELINO", "isabelino"],
  ["PASTEL", "pastel"],
  ["OPALINO", "opalino"],
  ["TOPÁZIO", "topazio"],
  ["TOPAZIO", "topazio"],
  ["ÔNIX", "onix"],
  ["ONIX", "onix"],
  ["COBALTO", "cobalto"],
  ["JASPE", "jaspe"],
  ["FEO", "feo"],
  ["MOGNO", "mogno"],
  ["EUMO", "eumo"],
  ["MULATO", "mulato"],
];

const STOP_WORDS_BREED = new Set([
  "COM", "SEM", "TOPETE", "BRANCO", "AMARELO", "VERMELHO", "INTENSO", "NEVADO",
  "100%", "LIPOCRÔMICO", "LIPOCROMICO", "MELÂNICO", "MELANICO", "PINTADO",
  "CANELA", "E", "MUTAÇÕES", "MUTACOES", "(TODOS)", "MOSAICO", "MACHO", "FÊMEA",
  "FEMEA", "MARFIM",
]);

/**
 * Função principal — interpreta o NOME oficial de uma classe (não precisa
 * do código), retornando os traços genéticos estruturados.
 */
export function interpretOfficialClass(officialName: string, modality: Modality = "COR"): InterpretedTraits {
  const upper = officialName.toUpperCase();
  const result = blank(modality);

  // ---------------------------------------------------------------------
  // Lipocromo (cor de fundo)
  // ---------------------------------------------------------------------
  if (upper.includes("BRANCO DOMINANTE")) {
    result.lipochromeBase = "branco_dominante";
    result.dominantWhiteStatus = "visual";
    result.geneticWarnings.push(
      "Branco Dominante: não cruzar com outro Branco Dominante — risco de ~25% de embriões não viáveis (homozigose letal)."
    );
    result.reasoning.push('Nome contém "BRANCO DOMINANTE" → branco dominante visual (autossômico dominante).');
  } else if (upper.includes("BRANCO")) {
    if (modality === "COR") {
      // Em Canário de Cor, "BRANCO" desacompanhado de "DOMINANTE" é o
      // branco recessivo (CC0101 BRANCO, distinto de CC0102 BRANCO
      // DOMINANTE).
      result.lipochromeBase = "branco_recessivo";
      result.recessiveWhiteStatus = "visual";
      result.reasoning.push('Nome contém "BRANCO" sem "DOMINANTE" → branco recessivo visual (CC0101), autossômico recessivo.');
    } else {
      // Em Canário de Porte, "BRANCO" sozinho não distingue dominante de
      // recessivo sem mais contexto — fica honestamente desconhecido.
      result.lipochromeBase = "desconhecido";
      result.dominantWhiteStatus = "desconhecido";
      result.recessiveWhiteStatus = "desconhecido";
      result.confidenceScore -= 0.1;
      result.reasoning.push('Em Canário de Porte, "BRANCO" sozinho não distingue dominante de recessivo — marcado como desconhecido, precisa de confirmação manual.');
    }
  }

  if (upper.includes("AMARELO MARFIM") || (upper.includes("AMARELO") && upper.includes("MARFIM"))) {
    result.lipochromeBase = "amarelo_marfim";
    result.ivoryStatus = "visual";
    result.reasoning.push('"AMARELO" + "MARFIM" → lipocromo amarelo diluído por marfim visual (marfim é ligado ao sexo).');
  } else if (upper.includes("AMARELO")) {
    if (result.lipochromeBase === "desconhecido") result.lipochromeBase = "amarelo";
    result.reasoning.push('"AMARELO" → lipocromo amarelo.');
  }

  if (upper.includes("VERMELHO MARFIM") || (upper.includes("VERMELHO") && upper.includes("MARFIM"))) {
    result.lipochromeBase = "vermelho_marfim";
    result.ivoryStatus = "visual";
    result.redFactorStatus = "visual";
    result.nutritionRecommendations.push(
      "Ave com fator vermelho visual: alimentação pigmentante (carotenoides/cantaxantina) na muda/crescimento/pré-exposição é necessária para expressar a cor cheia — isso é manejo, não altera o genótipo."
    );
    result.reasoning.push('"VERMELHO" + "MARFIM" → vermelho diluído por marfim visual.');
  } else if (upper.includes("VERMELHO")) {
    if (result.lipochromeBase === "desconhecido" || result.lipochromeBase === "amarelo") {
      result.lipochromeBase = "vermelho";
    }
    result.redFactorStatus = "visual";
    result.nutritionRecommendations.push(
      "Ave com fator vermelho visual: alimentação pigmentante (carotenoides/cantaxantina) na muda/crescimento/pré-exposição é necessária para expressar a cor cheia — isso é manejo, não altera o genótipo."
    );
    result.reasoning.push('"VERMELHO" → fator vermelho visual.');
  }

  if (upper.includes("RUBINO")) {
    result.melaninSeries = "ino";
    if (result.lipochromeBase === "desconhecido") result.lipochromeBase = "vermelho";
    result.redFactorStatus = "visual";
    result.visibleMutations.push("ino");
    result.nutritionRecommendations.push("Rubino (ino + fator vermelho): recomendar alimentação pigmentante.");
    result.reasoning.push('"RUBINO" → mutação ino combinada com fator vermelho.');
  }
  if (upper.includes("LUTINO")) {
    result.melaninSeries = "ino";
    if (result.lipochromeBase === "desconhecido") result.lipochromeBase = "amarelo";
    result.visibleMutations.push("ino");
    result.reasoning.push('"LUTINO" → mutação ino com base amarela.');
  }
  if (upper.includes("ALBINO")) {
    result.melaninSeries = "ino";
    result.lipochromeBase = "branco_recessivo";
    result.recessiveWhiteStatus = "visual";
    result.visibleMutations.push("ino");
    result.reasoning.push('"ALBINO" → ino branco (ino + ausência de lipocromo).');
  }
  if (upper.includes("URUCUM")) {
    result.melaninSeries = result.melaninSeries ?? "urucum";
    result.visibleMutations.push("urucum");
    result.nutritionRecommendations.push("Urucum: recomendar alimentação pigmentante adequada (traço configurável, sem regra mendeliana fixa validada).");
    result.reasoning.push('"URUCUM" → traço urucum visual (categórico/configurável).');
  }

  // ---------------------------------------------------------------------
  // Categoria de pena
  // ---------------------------------------------------------------------
  if (upper.includes("MOSAICO MACHO")) {
    result.featherCategory = "mosaico_macho";
    result.reasoning.push('"MOSAICO MACHO" → categoria mosaico macho.');
  } else if (upper.includes("MOSAICO FÊMEA") || upper.includes("MOSAICO FEMEA")) {
    result.featherCategory = "mosaico_femea";
    result.reasoning.push('"MOSAICO FÊMEA" → categoria mosaico fêmea.');
  } else if (upper.includes("MOSAICO")) {
    result.featherCategory = "mosaico_desconhecido";
    result.reasoning.push('"MOSAICO" sem sexo especificado → categoria mosaico (sexo não determinado pelo nome).');
  } else if (upper.includes("INTENSO")) {
    result.featherCategory = "intenso";
    result.reasoning.push('"INTENSO" → categoria de pena intenso.');
  } else if (upper.includes("NEVADO")) {
    result.featherCategory = "nevado";
    result.reasoning.push('"NEVADO" → categoria de pena nevado.');
  }

  // ---------------------------------------------------------------------
  // Melanina (série negra e mutações)
  // ---------------------------------------------------------------------
  for (const [term, id] of MELANIN_TERMS) {
    if (upper.includes(term)) {
      result.melaninSeries = id;
      result.visibleMutations.push(id);
      result.reasoning.push(`"${term}" → mutação melânica ${id} (sexo-ligada recessiva, salvo configuração diferente).`);
    }
  }
  if (upper.includes("VERDE")) {
    result.melaninSeries = result.melaninSeries ?? "negro";
    result.reasoning.push('"VERDE" → série negra com fundo amarelo.');
  }
  if (upper.includes("AZUL")) {
    result.melaninSeries = result.melaninSeries ?? "negro";
    result.reasoning.push('"AZUL" → série negra com fundo branco.');
  }
  if (upper.includes("COBRE")) {
    result.melaninSeries = result.melaninSeries ?? "negro";
    result.redFactorStatus = result.redFactorStatus === "desconhecido" ? "visual" : result.redFactorStatus;
    result.reasoning.push('"COBRE" → série negra com fator vermelho.');
  }
  if (upper.includes("ASAS BRANCAS") || upper.includes("ASA BRANCA")) {
    result.visibleMutations.push("asas_brancas");
    result.reasoning.push('"ASAS BRANCAS" → traço asas brancas (categórico/configurável).');
  }
  if (upper.includes("ASAS CINZA") || upper.includes("ASA CINZA")) {
    result.melaninSeries = result.melaninSeries ?? "asas_cinza";
    result.visibleMutations.push("asas_cinza");
    result.reasoning.push('"ASAS CINZA" → mutação asas cinza (sexo-ligada).');
  }
  if (upper.includes("ACETINADO")) {
    result.visibleMutations.push("acetinado");
    result.reasoning.push('"ACETINADO" → mutação acetinado (sexo-ligada).');
  }
  if (upper.includes("BICO AMARELO")) {
    result.visibleMutations.push("bico_amarelo");
    result.reasoning.push('"BICO AMARELO" → traço bico amarelo (categórico/configurável).');
  }

  // ---------------------------------------------------------------------
  // Topete/crista (Canário de Porte)
  // ---------------------------------------------------------------------
  if (upper.includes("COM TOPETE") || upper.includes("CORONA") || upper.includes("C/TOP")) {
    result.crestType = upper.includes("CORONA") ? "corona" : "com_topete";
    result.geneticWarnings.push(
      "Com topete/crista: cruzar apenas com ave sem topete — topetado × topetado gera ~25% de embriões não viáveis ou fortemente indesejáveis."
    );
    result.reasoning.push('Nome indica topete/corona presente → crista visual (autossômica dominante, letal em dose dupla).');
  } else if (upper.includes("SEM TOPETE") || upper.includes("CONSORT") || upper.includes("S/TOP")) {
    result.crestType = "sem_topete";
    result.reasoning.push('Nome indica ausência de topete (sem topete/consort).');
  }

  // ---------------------------------------------------------------------
  // 100% lipocrômico / 100% melânico / pintado (Canário de Porte)
  // ---------------------------------------------------------------------
  if (upper.includes("100% LIPOCR")) {
    result.melaninSeries = "ausente_lipocromico";
    result.reasoning.push('"100% LIPOCRÔMICO" → ausência visual de melanina.');
  }
  if (upper.includes("100% MEL")) {
    if (result.melaninSeries !== "ausente_lipocromico") {
      result.melaninSeries = result.melaninSeries ?? "negro";
    }
    result.reasoning.push('"100% MELÂNICO" → presença visual de melanina.');
  }
  if (upper.includes("PINTADO")) {
    result.visibleMutations.push("pintado_variegado");
    result.reasoning.push('"PINTADO" → variegado/pintado (traço categórico).');
  }

  // ---------------------------------------------------------------------
  // Nome da raça (só faz sentido em Canário de Porte)
  // ---------------------------------------------------------------------
  if (modality === "PORTE") {
    const words = officialName.trim().split(/\s+/);
    const breedWords: string[] = [];
    for (const w of words) {
      if (STOP_WORDS_BREED.has(w.toUpperCase())) break;
      breedWords.push(w);
    }
    if (breedWords.length > 0) {
      result.breedName = breedWords.join(" ");
      result.reasoning.push(`Raça identificada pelo início do nome: "${result.breedName}".`);
    }
  }

  // ---------------------------------------------------------------------
  // Aviso de cor intermediária (laranja) quando aplicável
  // ---------------------------------------------------------------------
  if (result.lipochromeBase === "laranja_intermediario") {
    result.geneticWarnings.push(
      "Cor intermediária/laranja — resultado típico de cruzamento vermelho × amarelo, já que não há dominância comprovada entre os dois lipocromos."
    );
  }

  // ---------------------------------------------------------------------
  // Confiança final
  // ---------------------------------------------------------------------
  if (result.reasoning.length === 0) {
    result.confidenceScore = 0.15;
    result.reasoning.push("Nenhum termo conhecido foi reconhecido no nome — confiança baixa, revisão manual recomendada.");
  } else {
    result.confidenceScore = Math.max(0.15, Math.min(0.95, 0.45 + result.reasoning.length * 0.07));
  }

  return result;
}
