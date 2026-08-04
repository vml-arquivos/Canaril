/**
 * Compatibilidade física e cadastral de anilhas.
 *
 * A bitola (diâmetro interno) é a restrição de segurança principal. Metadados
 * de espécie/raça/modalidade são usados para localizar a regra oficial e para
 * desempatar lotes equivalentes, sem rejeitar um lote fisicamente correto só
 * porque foi catalogado em outra modalidade de canário.
 */

export type RingSubject = {
  speciesName?: string | null;
  breedName?: string | null;
  modality?: string | null;
  ringGaugeMm?: number | null;
};

export type RingGaugeRuleLike = {
  speciesName: string;
  breedName?: string | null;
  modality?: string | null;
  recommendedGaugeMm: number;
  active?: boolean | null;
};

export type RingCompatibilityResult = {
  compatible: boolean;
  score: number;
  targetGaugeMm: number | null;
  batchGaugeMm: number | null;
  reason: string;
};

const GAUGE_TOLERANCE_MM = 0.051;

export function normalizeRingLabel(value?: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function modalityKey(value?: string | null): string {
  return normalizeRingLabel(value).replace(/\s+/g, "_").toUpperCase();
}

function isCanaryFamily(value?: string | null): boolean {
  const normalized = normalizeRingLabel(value);
  return normalized === "canario" || normalized.startsWith("canario ");
}

function speciesCompatible(left?: string | null, right?: string | null): boolean {
  if (!left || !right) return true;
  const a = normalizeRingLabel(left);
  const b = normalizeRingLabel(right);
  return a === b || (isCanaryFamily(a) && isCanaryFamily(b));
}

export function breedLabelsCompatible(left?: string | null, right?: string | null): boolean {
  if (!left || !right) return true;
  const a = normalizeRingLabel(left);
  const b = normalizeRingLabel(right);
  if (a === b) return true;

  // Aceita variações de catálogo da mesma raça, por exemplo:
  // "Gloster" x "Gloster Corona" e "Lizard" x "Lizard (Canário Lagarto)".
  return a.includes(b) || b.includes(a);
}

function finiteGauge(value?: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** Localiza a regra oficial mais específica para a ave ou para o lote. */
export function findRecommendedRingGauge(
  subject: RingSubject,
  rules: readonly RingGaugeRuleLike[],
): number | null {
  const explicit = finiteGauge(subject.ringGaugeMm);
  if (explicit !== null) return explicit;

  let best: { score: number; gauge: number } | null = null;
  for (const rule of rules) {
    if (rule.active === false) continue;
    const gauge = finiteGauge(rule.recommendedGaugeMm);
    if (gauge === null || !speciesCompatible(subject.speciesName, rule.speciesName)) continue;

    let score = 0;
    const ruleBreed = normalizeRingLabel(rule.breedName);
    const subjectBreed = normalizeRingLabel(subject.breedName);
    const ruleModality = modalityKey(rule.modality);
    const subjectModality = modalityKey(subject.modality);

    if (ruleBreed) {
      if (!subjectBreed || !breedLabelsCompatible(subject.breedName, rule.breedName)) continue;
      score += subjectBreed === ruleBreed ? 300 : 260;
    } else {
      score += subjectBreed ? 40 : 80;
    }

    if (ruleModality) {
      if (subjectModality === ruleModality) score += 100;
      else if (ruleBreed) score += 10; // regra específica da raça prevalece
      else if (subjectModality) continue;
    }

    const ruleSpecies = normalizeRingLabel(rule.speciesName);
    const subjectSpecies = normalizeRingLabel(subject.speciesName);
    if (subjectSpecies && ruleSpecies === subjectSpecies) score += 30;
    else if (subjectSpecies && speciesCompatible(subject.speciesName, rule.speciesName)) score += 20;

    if (!best || score > best.score) best = { score, gauge };
  }

  return best?.gauge ?? null;
}

/**
 * Avalia um lote contra uma ave/filhote.
 *
 * - espécies incompatíveis nunca são misturadas;
 * - bitolas conhecidas e diferentes bloqueiam a utilização;
 * - bitolas iguais permitem reutilizar lote de outra modalidade da mesma
 *   família (ex.: lote COR 3,0 mm para Gloster PORTE 3,0 mm);
 * - na ausência de bitola conhecida, metadados conflitantes são bloqueados.
 */
export function assessRingCompatibility(
  target: RingSubject,
  batch: RingSubject,
  rules: readonly RingGaugeRuleLike[],
): RingCompatibilityResult {
  const targetGaugeMm = findRecommendedRingGauge(target, rules);
  const batchGaugeMm = findRecommendedRingGauge(batch, rules);

  if (modalityKey(target.modality) === "PORTE" && isCanaryFamily(target.speciesName) && !target.breedName && targetGaugeMm === null) {
    return {
      compatible: false,
      score: -950,
      targetGaugeMm,
      batchGaugeMm,
      reason: "Informe a raça do canário de porte para determinar a bitola oficial.",
    };
  }

  if (!speciesCompatible(target.speciesName, batch.speciesName)) {
    return {
      compatible: false,
      score: -1000,
      targetGaugeMm,
      batchGaugeMm,
      reason: "O lote pertence a outra espécie.",
    };
  }

  const gaugesKnown = targetGaugeMm !== null && batchGaugeMm !== null;
  if (gaugesKnown && Math.abs(targetGaugeMm - batchGaugeMm) > GAUGE_TOLERANCE_MM) {
    return {
      compatible: false,
      score: -900,
      targetGaugeMm,
      batchGaugeMm,
      reason: `Bitola incompatível: ave ${targetGaugeMm.toFixed(1)} mm, lote ${batchGaugeMm.toFixed(1)} mm.`,
    };
  }

  const breedExact = Boolean(target.breedName && batch.breedName)
    && normalizeRingLabel(target.breedName) === normalizeRingLabel(batch.breedName);
  const breedCompatible = breedLabelsCompatible(target.breedName, batch.breedName);
  const modalityExact = Boolean(target.modality && batch.modality)
    && modalityKey(target.modality) === modalityKey(batch.modality);

  if (!gaugesKnown) {
    if (target.breedName && batch.breedName && !breedCompatible) {
      return {
        compatible: false,
        score: -500,
        targetGaugeMm,
        batchGaugeMm,
        reason: "Não foi possível confirmar a bitola e as raças cadastradas são diferentes.",
      };
    }
    if (target.modality && batch.modality && !modalityExact && !breedCompatible) {
      return {
        compatible: false,
        score: -400,
        targetGaugeMm,
        batchGaugeMm,
        reason: "Não foi possível confirmar a bitola e as modalidades cadastradas são diferentes.",
      };
    }
  }

  let score = gaugesKnown ? 1000 : 100;
  if (breedExact) score += 120;
  else if (target.breedName && batch.breedName && breedCompatible) score += 80;
  else if (!batch.breedName) score += 20;
  if (modalityExact) score += 60;
  else if (!batch.modality) score += 10;
  if (target.speciesName && batch.speciesName
      && normalizeRingLabel(target.speciesName) === normalizeRingLabel(batch.speciesName)) score += 30;

  return {
    compatible: true,
    score,
    targetGaugeMm,
    batchGaugeMm,
    reason: gaugesKnown
      ? `Bitola física compatível (${targetGaugeMm.toFixed(1)} mm).`
      : "Compatibilidade confirmada pelos metadados disponíveis.",
  };
}
