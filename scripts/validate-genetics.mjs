import assert from "node:assert/strict";
import { calculateColorCross, MUTATION_CONFIG } from "../server/_core/colorGenetics.ts";

assert.equal(MUTATION_CONFIG.pastel.inheritance, "sex_linked");
assert.equal(MUTATION_CONFIG.opalino.inheritance, "autosomal_recessive");
assert.equal(MUTATION_CONFIG.topazio.selectable, false);

const sexLinked = calculateColorCross({
  male: { sex: "macho", pastel: "Z+Z-" },
  female: { sex: "fêmea", pastel: "Z-W" },
});
const pastel = sexLinked.byMutation.pastel;
assert.deepEqual(pastel.sons, { "Z+Z-": 0.25, "Z-Z-": 0.25 });
assert.deepEqual(pastel.daughters, { "Z+W": 0.25, "Z-W": 0.25 });
const carrier = sexLinked.phenotypeSummary.expectedPhenotypes.find((item) => item.description.includes("macho portador"));
assert.ok(carrier, "macho portador deve aparecer no resumo");
assert.equal(carrier.isCarrier, true);
assert.equal(carrier.isVisual, false);
assert.equal(carrier.probability, 0.25);

const recessive = calculateColorCross({
  male: { sex: "macho", opalino: "Nm" },
  female: { sex: "fêmea", opalino: "Nm" },
});
assert.deepEqual(recessive.byMutation.opalino.offspring, { NN: 0.25, Nm: 0.5, mm: 0.25 });

const dominant = calculateColorCross({
  male: { sex: "macho", crista: "Nn" },
  female: { sex: "fêmea", crista: "Nn" },
});
assert.equal(dominant.byMutation.crista.offspring.NN, 0.25);
assert.equal(dominant.phenotypeSummary.lethalFraction, 0.25);
assert.ok(dominant.warnings.some((warning) => warning.includes("CRISTA")));

console.log("PASS  herança sexo-ligada e portador não visual");
console.log("PASS  herança autossômica recessiva 25/50/25");
console.log("PASS  dominante letal 25%");
console.log("PASS  catálogo Pastel/Opalino/Topázio");
