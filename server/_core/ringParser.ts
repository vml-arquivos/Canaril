/**
 * ringParser.ts
 *
 * Utilitários para gerar e interpretar códigos de anilha baseados em
 * formatPattern configurável.
 *
 * Tokens suportados:
 *   {breederCode}  — código do criador (ex: GF-003)
 *   {year}         — ano com 4 dígitos (ex: 2026)
 *   {month}        — mês com 2 dígitos (ex: 06) — omitido se não informado
 *   {seq}          — número sequencial com padding (ex: 001)
 *   {prefix}       — prefixo opcional
 *   {suffix}       — sufixo opcional
 *
 * Exemplos de formatPattern:
 *   "{breederCode}-{year}-{seq}"           → GF-003-2026-001
 *   "{breederCode}-{month}-{year}-{seq}"   → GF-003-06-2026-001
 *   "{prefix}{year}{seq}"                  → ABC2026001
 */

export interface RingCodeParams {
  breederCode?: string;
  year: number;
  month?: number;
  sequence: number;
  prefix?: string;
  suffix?: string;
  formatPattern: string;
  /** Número de dígitos para padding da sequência (default: 3) */
  seqPadding?: number;
}

export interface ParsedRingCode {
  breederCode?: string;
  year?: number;
  month?: number;
  sequence?: number;
  prefix?: string;
  suffix?: string;
  raw: string;
}

/**
 * Gera o fullCode de uma anilha a partir dos parâmetros e do formatPattern.
 */
export function generateRingCode(params: RingCodeParams): string {
  const {
    breederCode = "",
    year,
    month,
    sequence,
    prefix = "",
    suffix = "",
    formatPattern,
    seqPadding = 3,
  } = params;

  const seqStr = String(sequence).padStart(seqPadding, "0");
  const monthStr = month ? String(month).padStart(2, "0") : "";
  const yearStr = String(year);

  let code = formatPattern
    .replace("{breederCode}", breederCode)
    .replace("{year}", yearStr)
    .replace("{seq}", seqStr)
    .replace("{prefix}", prefix)
    .replace("{suffix}", suffix);

  // Se o formato inclui {month} mas month não foi fornecido, remove o token e
  // o separador adjacente para não gerar "--" no código.
  if (monthStr) {
    code = code.replace("{month}", monthStr);
  } else {
    // Remove "{month}" e qualquer separador imediatamente antes/depois
    code = code.replace(/[-_.]?\{month\}[-_.]?/, "");
  }

  return code.trim();
}

/**
 * Gera todos os fullCodes de um lote a partir do startNumber até endNumber.
 */
export function generateBatchCodes(params: Omit<RingCodeParams, "sequence"> & {
  startNumber: number;
  endNumber: number;
}): Array<{ sequence: number; fullCode: string }> {
  const { startNumber, endNumber, ...rest } = params;
  const results: Array<{ sequence: number; fullCode: string }> = [];

  for (let seq = startNumber; seq <= endNumber; seq++) {
    results.push({
      sequence: seq,
      fullCode: generateRingCode({ ...rest, sequence: seq }),
    });
  }

  return results;
}

/**
 * Tenta extrair os componentes de um código de anilha baseado no formatPattern.
 *
 * Estratégia: converte o formatPattern em uma regex substituindo os tokens
 * por grupos de captura nomeados.
 */
export function parseRingCode(fullCode: string, formatPattern: string): ParsedRingCode {
  const result: ParsedRingCode = { raw: fullCode };

  try {
    // Escapa caracteres especiais de regex no pattern, exceto os tokens
    const escaped = formatPattern
      .replace(/[.*+?^${}()|[\]\\]/g, (char) => {
        // Preserva os tokens {breederCode}, {year}, etc.
        if (char === "{" || char === "}") return char;
        return "\\" + char;
      });

    // Substitui tokens por grupos de captura nomeados
    const tokenMap: Record<string, string> = {
      "{breederCode}": "(?<breederCode>[A-Z0-9][A-Z0-9-]*)",
      "{year}":        "(?<year>\\d{4})",
      "{month}":       "(?<month>\\d{2})",
      "{seq}":         "(?<seq>\\d+)",
      "{prefix}":      "(?<prefix>[A-Z0-9]*)",
      "{suffix}":      "(?<suffix>[A-Z0-9]*)",
    };

    let regexStr = escaped;
    for (const [token, capture] of Object.entries(tokenMap)) {
      regexStr = regexStr.replace(token, capture);
    }

    const regex = new RegExp("^" + regexStr + "$", "i");
    const match = fullCode.match(regex);

    if (match?.groups) {
      const g = match.groups;
      if (g.breederCode) result.breederCode = g.breederCode;
      if (g.year)        result.year = parseInt(g.year, 10);
      if (g.month)       result.month = parseInt(g.month, 10);
      if (g.seq)         result.sequence = parseInt(g.seq, 10);
      if (g.prefix)      result.prefix = g.prefix;
      if (g.suffix)      result.suffix = g.suffix;
    }
  } catch {
    // Se o parse falhar, retorna apenas o raw
  }

  return result;
}

/**
 * Gera o displayTitle do pássaro no formato padrão:
 * "[Anilha] — [Raça/Modalidade] — [Classe/Cor resumida] — [Sexo]"
 */
export function generateDisplayTitle(params: {
  ring: string;
  breedOrSpecialty?: string;
  colorOrClass?: string;
  sex?: string;
  nickname?: string;
}): string {
  const { ring, breedOrSpecialty, colorOrClass, sex, nickname } = params;

  const parts: string[] = [ring];

  if (breedOrSpecialty) parts.push(breedOrSpecialty);
  if (colorOrClass)     parts.push(colorOrClass);
  if (sex) {
    const sexLabel = sex.toLowerCase() === "macho" || sex.toLowerCase() === "m"
      ? "Macho"
      : sex.toLowerCase() === "fêmea" || sex.toLowerCase() === "femea" || sex.toLowerCase() === "f"
        ? "Fêmea"
        : sex;
    parts.push(sexLabel);
  }

  const title = parts.join(" — ");
  return nickname ? `${title} (${nickname})` : title;
}
