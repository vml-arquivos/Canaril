/**
 * ringGaugeSeed.ts — Bitolas oficiais de anilhamento (FOB/OBJO 2026)
 * ============================================================================
 * Popula `ring_gauge_rules` com os valores REAIS da "Tabela para Anilhamento
 * de Aves — FOB/OBJO 2026" (Anuário Informativo Oficial, Federação
 * Ornitológica do Brasil, data efetiva 02/02/2026), fornecida pelo criador.
 *
 * Só as classes de Canário (Cor, Canto, Porte) são semeadas — é o escopo
 * do sistema. Raças de Porte SEM correspondência clara e seura na tabela
 * oficial (ex.: nomes que não aparecem lá, ou que o catálogo interno já
 * separa em variações que a tabela trata como uma só linha) foram
 * deliberadamente DEIXADAS DE FORA em vez de receber um valor adivinhado —
 * errar uma bitola tem custo real pro criador (anilha que não serve, ou
 * que aperta o pássaro).
 *
 * Idempotente: roda em todo boot, só insere o que ainda não existe (nunca
 * sobrescreve um valor que o próprio criador já tenha ajustado manualmente
 * depois — reconhecido pela flag `notes` começando com "FOB/OBJO 2026").
 * ============================================================================
 */
import { getDb } from "../db";
import { ring_gauge_rules } from "../../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";

const SOURCE_TAG = "FOB/OBJO 2026 (Federação Ornitológica do Brasil, oficial)";

// Nome da raça EXATAMENTE como está em shared/constants.ts (SPECIALTIES),
// pra bater 1:1 com birds.breedName / ring_batches.breedName sem precisar
// de nenhuma normalização/fuzzy-match em tempo de execução.
const PORTE_GAUGES: Array<{ breedName: string; gaugeMm: number }> = [
  { breedName: "Arlequim Português", gaugeMm: 3.2 },
  { breedName: "Benacus", gaugeMm: 3.0 },
  { breedName: "Bernois", gaugeMm: 3.0 },
  { breedName: "Border Fancy", gaugeMm: 3.4 },
  { breedName: "Bossu Belga", gaugeMm: 3.0 },
  { breedName: "Frisado Brasileiro", gaugeMm: 3.4 },
  { breedName: "Crest-Bred", gaugeMm: 3.4 },
  { breedName: "Crested", gaugeMm: 3.4 },
  { breedName: "Fife Fancy", gaugeMm: 2.7 },
  { breedName: "Fiorino", gaugeMm: 3.0 },
  { breedName: "Frisado do Norte", gaugeMm: 3.0 },
  { breedName: "Frisado do Sul", gaugeMm: 3.0 },
  { breedName: "Frisado Gigante Italiano", gaugeMm: 3.4 },
  { breedName: "Frill (Frisé Parisiense)", gaugeMm: 3.4 },
  { breedName: "Frisado Suíço", gaugeMm: 3.0 },
  { breedName: "Gibber Italicus", gaugeMm: 2.7 },
  { breedName: "Giboso Espanhol", gaugeMm: 3.0 },
  { breedName: "Giraldillo", gaugeMm: 2.7 },
  { breedName: "Gloster Corona", gaugeMm: 3.0 },
  { breedName: "Gloster Consort", gaugeMm: 3.0 },
  { breedName: "Hoso Japonês", gaugeMm: 2.7 },
  { breedName: "Irish Fancy", gaugeMm: 2.7 },
  { breedName: "Lancashire", gaugeMm: 3.4 },
  { breedName: "Lizard (Canário Lagarto)", gaugeMm: 3.0 },
  { breedName: "Llarguet Espanhol", gaugeMm: 3.0 },
  { breedName: "London Fancy", gaugeMm: 3.2 },
  { breedName: "London Fancy Adulto", gaugeMm: 3.2 },
  { breedName: "Mehringer", gaugeMm: 3.0 },
  { breedName: "Melado Tenerifenho", gaugeMm: 3.0 },
  { breedName: "Münchener", gaugeMm: 3.0 },
  { breedName: "Norwich", gaugeMm: 3.4 },
  { breedName: "Padovano", gaugeMm: 3.4 },
  { breedName: "Pívaro", gaugeMm: 3.2 },
  { breedName: "Raça Espanhola", gaugeMm: 2.5 },
  { breedName: "Rasmi Persa", gaugeMm: 3.2 },
  { breedName: "Rheinländer", gaugeMm: 2.7 },
  { breedName: "Rogetto", gaugeMm: 3.0 },
  { breedName: "Salentino", gaugeMm: 2.7 },
  { breedName: "Scotch Fancy", gaugeMm: 3.0 },
  { breedName: "Topete Alemão", gaugeMm: 3.0 },
  { breedName: "Yorkshire", gaugeMm: 3.4 },
  { breedName: "Brasileirinho", gaugeMm: 3.0 }, // "Cores Demonstração - Brasileirinho" na tabela
];

export async function seedOfficialRingGauges(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Canário de Cor e Canário de Canto — bitola única (3,0mm), sem quebra por raça
  const generalRules = [
    { speciesName: "Canário", breedName: null, modality: "COR", gaugeMm: 3.0 },
    { speciesName: "Canário", breedName: null, modality: "CANTO", gaugeMm: 3.0 },
  ];

  for (const rule of generalRules) {
    const existing = await db
      .select({ id: ring_gauge_rules.id })
      .from(ring_gauge_rules)
      .where(and(
        eq(ring_gauge_rules.speciesName, rule.speciesName),
        eq(ring_gauge_rules.modality, rule.modality),
        isNull(ring_gauge_rules.breedName),
      ))
      .limit(1);
    if (existing.length > 0) continue;

    await db.insert(ring_gauge_rules).values({
      speciesName: rule.speciesName,
      breedName: null,
      modality: rule.modality,
      recommendedGaugeMm: rule.gaugeMm,
      notes: SOURCE_TAG,
      active: true,
    });
  }

  // Canário de Porte — bitola específica por raça
  for (const { breedName, gaugeMm } of PORTE_GAUGES) {
    const existing = await db
      .select({ id: ring_gauge_rules.id })
      .from(ring_gauge_rules)
      .where(and(
        eq(ring_gauge_rules.speciesName, "Canário"),
        eq(ring_gauge_rules.breedName, breedName),
      ))
      .limit(1);
    if (existing.length > 0) continue;

    await db.insert(ring_gauge_rules).values({
      speciesName: "Canário",
      breedName,
      modality: "PORTE",
      recommendedGaugeMm: gaugeMm,
      notes: SOURCE_TAG,
      active: true,
    });
  }
}
