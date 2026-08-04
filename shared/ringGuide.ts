export type RingGuideSubject = {
  speciesName?: string | null;
  breedName?: string | null;
  modality?: string | null;
};

export type OfficialRingGuideGroup = {
  gaugeMm: number;
  title: string;
  birds: string[];
  notes?: string;
};

export type OfficialRingGuideSuggestion = {
  recommendedGaugeMm: number;
  minGaugeMm: number;
  maxGaugeMm: number;
  source: "official";
  title: string;
  appliesTo: string[];
  notes?: string;
};

export function normalizeRingGuideLabel(value?: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export const OFFICIAL_CANARY_PORTE_GAUGES: Array<{ gaugeMm: number; names: string[]; notes?: string }> = [
  { gaugeMm: 2.5, names: ["Raça Espanhola"] },
  { gaugeMm: 2.7, names: ["Fife Fancy", "Gibber Italicus", "Giraldillo", "Hoso Japonês", "Irish Fancy", "Rheinländer", "Salentino"] },
  { gaugeMm: 3.0, names: [
    "Benacus", "Bernois", "Bossu Belga", "Brasileirinho", "Fiorino", "Frisado do Norte", "Frisado do Sul",
    "Frisado Suíço", "Giboso Espanhol", "Gloster", "Gloster Corona", "Gloster Consort",
    "Lizard", "Lizard (Canário Lagarto)", "Llarguet Espanhol", "Mehringer", "Melado Tenerifenho",
    "Münchener", "Munchener", "Rogetto", "Scotch Fancy", "Topete Alemão",
  ] },
  { gaugeMm: 3.2, names: ["Arlequim Português", "London Fancy", "London Fancy Adulto", "Pívaro", "Rasmi Persa"] },
  { gaugeMm: 3.4, names: ["Border Fancy", "Crest-Bred", "Crested", "Frill (Frisé Parisiense)", "Frisado Brasileiro", "Frisado Gigante Italiano", "Lancashire", "Norwich", "Padovano", "Yorkshire"] },
];

const aliasLookup = new Map<string, { gaugeMm: number; canonical: string }>();
for (const group of OFFICIAL_CANARY_PORTE_GAUGES) {
  for (const name of group.names) {
    aliasLookup.set(normalizeRingGuideLabel(name), { gaugeMm: group.gaugeMm, canonical: name });
  }
}

export const OFFICIAL_RING_GUIDE_GROUPS: OfficialRingGuideGroup[] = [
  {
    gaugeMm: 2.5,
    title: "Canários de porte",
    birds: ["Raça Espanhola"],
  },
  {
    gaugeMm: 2.7,
    title: "Canários de porte",
    birds: ["Fife Fancy", "Gibber Italicus", "Giraldillo Sevillano", "Hoso Japonês", "Irish Fancy", "Rheinländer", "Salentino"],
  },
  {
    gaugeMm: 3.0,
    title: "Canário de Cor, Canto e raças de porte",
    birds: [
      "Canário de Cor", "Canário de Canto", "Benacus", "Bernois", "Bossu Belga",
      "Cores demonstração — Brasileirinho", "Cores demonstração — Frisado Brasileiro",
      "Cores demonstração — Lizard Canela", "Fiorino", "Frisado do Norte", "Frisado do Sul",
      "Frisado Suíço", "Giboso Espanhol", "Gloster", "Lizard", "Llarguet Espanhol",
      "Mehringer", "Melado", "Münchener", "Rogetto", "Scotch Fancy", "Topete Alemão",
    ],
    notes: "Canário de Cor e Canário de Canto usam 3,0 mm na tabela FOB/OBJO 2026.",
  },
  {
    gaugeMm: 3.2,
    title: "Canários de porte",
    birds: ["Arlequim Português", "London Fancy", "Pívaro", "Rasmi Persa"],
  },
  {
    gaugeMm: 3.4,
    title: "Canários de porte",
    birds: [
      "Border", "Crest-Bred e Crested", "Frisado Brasileiro", "Frisado Gigante Italiano",
      "Frisado Parisiense", "Lancashire", "Norwich", "Padovano", "Yorkshire",
    ],
  },
];

export const OFFICIAL_PORTE_BREEDS = [...new Set(OFFICIAL_CANARY_PORTE_GAUGES.flatMap((group) => group.names))].sort((a, b) => a.localeCompare(b, "pt-BR"));

function normalizedModality(value?: string | null): string {
  return normalizeRingGuideLabel(value).replace(/\s+/g, "_").toUpperCase();
}

function isCanary(value?: string | null): boolean {
  const n = normalizeRingGuideLabel(value);
  return n === "canario" || n.startsWith("canario ");
}

export function resolveOfficialRingGuide(subject: RingGuideSubject): OfficialRingGuideSuggestion | null {
  const modality = normalizedModality(subject.modality);
  const breedKey = normalizeRingGuideLabel(subject.breedName);

  if (breedKey) {
    const exact = aliasLookup.get(breedKey);
    if (exact) {
      return {
        recommendedGaugeMm: exact.gaugeMm,
        minGaugeMm: exact.gaugeMm,
        maxGaugeMm: exact.gaugeMm,
        source: "official",
        title: `${exact.canonical} — bitola oficial ${exact.gaugeMm.toFixed(1)} mm`,
        appliesTo: [exact.canonical],
      };
    }

    for (const [key, value] of aliasLookup.entries()) {
      if (key.includes(breedKey) || breedKey.includes(key)) {
        return {
          recommendedGaugeMm: value.gaugeMm,
          minGaugeMm: value.gaugeMm,
          maxGaugeMm: value.gaugeMm,
          source: "official",
          title: `${value.canonical} — bitola oficial ${value.gaugeMm.toFixed(1)} mm`,
          appliesTo: [value.canonical],
        };
      }
    }
  }

  if (modality === "COR" && (!subject.speciesName || isCanary(subject.speciesName))) {
    return {
      recommendedGaugeMm: 3.0,
      minGaugeMm: 3.0,
      maxGaugeMm: 3.0,
      source: "official",
      title: "Canário de Cor — bitola oficial 3,0 mm",
      appliesTo: ["Todos os canários de cor"],
      notes: "No cadastro simples, basta selecionar Canário de Cor; o sistema define 3,0 mm automaticamente.",
    };
  }

  if (modality === "CANTO" && (!subject.speciesName || isCanary(subject.speciesName))) {
    return {
      recommendedGaugeMm: 3.0,
      minGaugeMm: 3.0,
      maxGaugeMm: 3.0,
      source: "official",
      title: "Canário de Canto — bitola oficial 3,0 mm",
      appliesTo: ["Todos os canários de canto"],
      notes: "No cadastro simples, basta selecionar Canário de Canto; o sistema define 3,0 mm automaticamente.",
    };
  }

  if ((!subject.modality || modality === "") && (!subject.breedName || subject.breedName === "") && (!subject.speciesName || isCanary(subject.speciesName))) {
    return {
      recommendedGaugeMm: 3.0,
      minGaugeMm: 3.0,
      maxGaugeMm: 3.0,
      source: "official",
      title: "Canário (padrão) — bitola 3,0 mm",
      appliesTo: ["Canário de Cor", "Canário de Canto"],
      notes: "Se for Canário de Porte, informe a raça para o sistema buscar a bitola oficial correta.",
    };
  }

  return null;
}
