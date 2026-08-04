import assert from "node:assert/strict";
import {
  assessRingCompatibility,
  breedLabelsCompatible,
  findRecommendedRingGauge,
  type RingGaugeRuleLike,
} from "../server/_core/ringCompatibility.ts";
import { BREED_KNOWLEDGE } from "../server/_core/canarilIntelligence/breedKnowledge.ts";

const rules: RingGaugeRuleLike[] = [
  { speciesName: "Canário", breedName: null, modality: "COR", recommendedGaugeMm: 3.0, active: true },
  { speciesName: "Canário", breedName: null, modality: "CANTO", recommendedGaugeMm: 3.0, active: true },
  { speciesName: "Canário", breedName: "Gloster Corona", modality: "PORTE", recommendedGaugeMm: 3.0, active: true },
  { speciesName: "Canário", breedName: "Gloster Consort", modality: "PORTE", recommendedGaugeMm: 3.0, active: true },
  { speciesName: "Canário", breedName: "Border Fancy", modality: "PORTE", recommendedGaugeMm: 3.4, active: true },
  { speciesName: "Canário", breedName: "Fife Fancy", modality: "PORTE", recommendedGaugeMm: 2.7, active: true },
];

const glosterFromCorBatch = assessRingCompatibility(
  { speciesName: "Canário", breedName: "Gloster Corona", modality: "PORTE" },
  { speciesName: "Canário", modality: "COR", ringGaugeMm: 3.0 },
  rules,
);
assert.equal(glosterFromCorBatch.compatible, true, "Gloster 3,0 mm deve aceitar lote COR 3,0 mm");
assert.equal(glosterFromCorBatch.targetGaugeMm, 3.0);

const glosterFromBorderBatch = assessRingCompatibility(
  { speciesName: "Canário", breedName: "Gloster Consort", modality: "PORTE" },
  { speciesName: "Canário", breedName: "Border Fancy", modality: "PORTE", ringGaugeMm: 3.4 },
  rules,
);
assert.equal(glosterFromBorderBatch.compatible, false, "Gloster 3,0 mm não pode usar lote 3,4 mm");

assert.equal(breedLabelsCompatible("Gloster", "Gloster Corona"), true);
assert.equal(breedLabelsCompatible("Border Fancy", "Fife Fancy"), false);
assert.equal(
  findRecommendedRingGauge({ speciesName: "Canário", breedName: "Border Fancy", modality: "PORTE" }, rules),
  3.4,
);

const unknownExact = assessRingCompatibility(
  { speciesName: "Ave ornamental", breedName: "Raça X", modality: "OUTRA" },
  { speciesName: "Ave ornamental", breedName: "Raça X", modality: "OUTRA" },
  [],
);
assert.equal(unknownExact.compatible, true);

const expectedGauges: Record<string, number> = {
  canario_cor: 3.0,
  gloster_consort: 3.0,
  gloster_corona: 3.0,
  padovano: 3.4,
  fiorino: 3.0,
  crest: 3.4,
  fife_fancy: 2.7,
  yorkshire: 3.4,
  lizard: 3.0,
  border: 3.4,
  norwich: 3.4,
  scotch_fancy: 3.0,
  munchener: 3.0,
  roller: 3.0,
  timbrado: 3.0,
  waterslager: 3.0,
};
for (const [code, gauge] of Object.entries(expectedGauges)) {
  const breed = BREED_KNOWLEDGE.find((item) => item.code === code);
  assert.ok(breed, `Raça ausente no catálogo: ${code}`);
  assert.equal(breed.defaultRingGaugeMm, gauge, `Bitola incorreta para ${code}`);
}

console.log("PASS  compatibilidade física por bitola");
console.log("PASS  bloqueio de bitolas incompatíveis");
console.log("PASS  normalização segura de nomes de raça");
console.log("PASS  catálogo FOB/OBJO 2026 corrigido");
console.log("\n4 verificações de anilhamento aprovadas.");
