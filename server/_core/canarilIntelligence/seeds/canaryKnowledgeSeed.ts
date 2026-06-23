/**
 * canaryKnowledgeSeed.ts — Seed idempotente da base de conhecimento de canários
 * Uso: pnpm run seed:knowledge
 */
import { getDb } from "../../../db";
import {
  species_knowledge, breed_knowledge, color_knowledge,
  mutation_knowledge, genetic_rule_knowledge, knowledge_explanations,
} from "../../../../drizzle/schema";
import { SPECIES_KNOWLEDGE } from "../speciesKnowledge";
import { BREED_KNOWLEDGE } from "../breedKnowledge";
import { LIPOCHROMES, MELANIN_SERIES, FEATHER_CATEGORIES } from "../colorKnowledge";
import { MUTATIONS } from "../geneticKnowledge";
import { EXPLANATIONS } from "../knowledgeExplainer";
import { sql } from "drizzle-orm";

async function seed() {
  const db = await getDb();
  if (!db) { console.error("DB not available"); process.exit(1); }

  console.log("[seed] Seeding Canaril Intelligence Core knowledge base...");

  // ─── Species ────────────────────────────────────────────────────────────
  for (const s of SPECIES_KNOWLEDGE) {
    await db.execute(sql`
      INSERT INTO species_knowledge ("code","commonName","scientificName","groupName","defaultSexSystem","notes","active")
      VALUES (${s.code},${s.commonName},${s.scientificName},${s.groupName},${s.defaultSexSystem},${s.notes},${s.active})
      ON CONFLICT ("code") DO UPDATE SET
        "commonName" = EXCLUDED."commonName",
        "scientificName" = EXCLUDED."scientificName",
        "updatedAt" = NOW()
    `);
  }
  console.log(`[seed] species: ${SPECIES_KNOWLEDGE.length} records`);

  // ─── Breeds ──────────────────────────────────────────────────────────────
  for (const b of BREED_KNOWLEDGE) {
    await db.execute(sql`
      INSERT INTO breed_knowledge ("code","speciesCode","modality","name","aliases","hasCrest","hasPorteStandard","hasColorStandard","defaultRingGaugeMm","description","active")
      VALUES (${b.code},${b.speciesCode},${b.modality},${b.name},${JSON.stringify(b.aliases)},${b.hasCrest},${b.hasPorteStandard},${b.hasColorStandard},${b.defaultRingGaugeMm},${b.description},${b.active})
      ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "updatedAt" = NOW()
    `);
  }
  console.log(`[seed] breeds: ${BREED_KNOWLEDGE.length} records`);

  // ─── Colors ──────────────────────────────────────────────────────────────
  const colorRecords = [
    ...LIPOCHROMES.map((l) => ({ code: `lipochrome_${l.code}`, speciesCode: "canario", modality: "COR", name: l.name, type: "LIPOCHROME", description: l.description })),
    ...MELANIN_SERIES.map((m) => ({ code: `melanin_${m.code}`, speciesCode: "canario", modality: "COR", name: m.name, type: "MELANIC", description: m.description })),
    ...FEATHER_CATEGORIES.map((f) => ({ code: `feather_${f.code}`, speciesCode: "canario", modality: "COR", name: f.name, type: "MIXED", description: f.description })),
  ];
  for (const c of colorRecords) {
    await db.execute(sql`
      INSERT INTO color_knowledge ("code","speciesCode","modality","name","type","description","active")
      VALUES (${c.code},${c.speciesCode},${c.modality},${c.name},${c.type},${c.description},true)
      ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name"
    `);
  }
  console.log(`[seed] colors: ${colorRecords.length} records`);

  // ─── Mutations ───────────────────────────────────────────────────────────
  for (const m of MUTATIONS) {
    await db.execute(sql`
      INSERT INTO mutation_knowledge ("code","speciesCode","name","aliases","inheritanceType","allowsCarrierMale","allowsCarrierFemale","hasLethalDoubleFactor","visibleStates","carrierStates","description","warnings","active")
      VALUES (${m.code},${m.speciesCode},${m.name},${JSON.stringify(m.aliases)},${m.inheritanceType},${m.allowsCarrierMale},${m.allowsCarrierFemale},${m.hasLethalDoubleFactor},${JSON.stringify(m.visibleStates)},${JSON.stringify(m.carrierStates)},${m.description},${m.warnings},true)
      ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "warnings" = EXCLUDED."warnings"
    `);
  }
  console.log(`[seed] mutations: ${MUTATIONS.length} records`);

  // ─── Explanations ────────────────────────────────────────────────────────
  for (const [termKey, exp] of Object.entries(EXPLANATIONS)) {
    await db.execute(sql`
      INSERT INTO knowledge_explanations ("term","simpleExplanation","technicalExplanation","examples","warnings","active")
      VALUES (${termKey},${exp.simpleExplanation},${exp.technicalExplanation},${JSON.stringify(exp.examples)},${exp.warnings},true)
      ON CONFLICT ("term") DO UPDATE SET "simpleExplanation" = EXCLUDED."simpleExplanation"
    `);
  }
  console.log(`[seed] explanations: ${Object.keys(EXPLANATIONS).length} records`);

  console.log("[seed] Done. Canaril Intelligence Core knowledge base ready.");
}

seed().catch((e) => { console.error("[seed] Error:", e); process.exit(1); });
