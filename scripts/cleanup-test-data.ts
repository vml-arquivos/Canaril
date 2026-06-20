/**
 * LIMPEZA DE DADOS DE TESTE — Canário Gestão Pro
 * ============================================================================
 * Remove TODOS os registros criados por scripts/seed-test-data.ts,
 * identificados pelos mesmos marcadores usados na criação (anilha
 * "TESTE-%", gaiola "T-%", campeonato "[TESTE]%"). Não toca em nenhum
 * registro real — só apaga o que bate com esses padrões.
 *
 * Ordem de remoção respeita as dependências (filhas antes das pais) pra
 * não violar nada e deixar o banco consistente.
 *
 * Como rodar:
 *   SEED_CONFIRM=yes DATABASE_URL="postgres://..." npx tsx scripts/cleanup-test-data.ts
 * ============================================================================
 */

import { ensureDatabaseReady, getDb } from "../server/db";
import {
  birds,
  cages,
  couples,
  clutches,
  chicks,
  ring_batches,
  rings,
  championships,
  championship_entries,
  judges,
  scores,
  health_records,
  breeding_reminders,
  photos,
} from "../drizzle/schema";
import { like, eq, inArray, and } from "drizzle-orm";

async function main() {
  if (process.env.SEED_CONFIRM !== "yes") {
    console.error(
      "\n⚠️  Por segurança, este script só roda com SEED_CONFIRM=yes explicitamente definido.\n" +
        "   Confirme que está apontando para o banco certo antes de rodar.\n"
    );
    process.exit(1);
  }

  console.log(`Conectando em: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@")}`);
  await ensureDatabaseReady();
  const db = (await getDb())!;

  console.log("\nIdentificando dados de teste...");

  const testBirds = await db.select().from(birds).where(like(birds.ring, "TESTE-%"));
  const testBirdIds = testBirds.map((b) => b.id);

  const testChicks = await db.select().from(chicks).where(like(chicks.ring, "TESTE-%"));
  const testChickIds = testChicks.map((c) => c.id);

  const testCouples = await db.select().from(couples).where(like(couples.cageNumber, "T-%"));
  const testCoupleIds = testCouples.map((c) => c.id);

  const testCages = await db.select().from(cages).where(like(cages.code, "T-%"));
  const testCageIds = testCages.map((c) => c.id);

  const testChampionships = await db.select().from(championships).where(like(championships.name, "[TESTE]%"));
  const testChampionshipIds = testChampionships.map((c) => c.id);

  const testRingBatches = await db.select().from(ring_batches).where(eq(ring_batches.batch_number, "TESTE"));
  const testRingBatchIds = testRingBatches.map((b) => b.id);

  const testJudges = await db.select().from(judges).where(like(judges.association, "%(teste)%"));
  const testJudgeIds = testJudges.map((j) => j.id);

  console.log(
    `  ${testBirds.length} pássaros, ${testChicks.length} filhotes, ${testCouples.length} casais,\n` +
      `  ${testCages.length} gaiolas, ${testChampionships.length} campeonatos, ${testRingBatches.length} lote(s) de anilha,\n` +
      `  ${testJudges.length} juízes`
  );

  if (testBirds.length === 0 && testCouples.length === 0 && testCages.length === 0 && testChampionships.length === 0) {
    console.log("\nNenhum dado de teste encontrado. Nada a fazer.");
    process.exit(0);
  }

  console.log("\nApagando em ordem segura...");

  // entries/scores de campeonatos de teste (e entries de pássaros de teste em campeonatos reais)
  if (testChampionshipIds.length > 0) {
    const entries = await db
      .select()
      .from(championship_entries)
      .where(inArray(championship_entries.championshipId, testChampionshipIds));
    const entryIds = entries.map((e) => e.id);
    if (entryIds.length > 0) {
      await db.delete(scores).where(inArray(scores.entryId, entryIds));
      await db.delete(championship_entries).where(inArray(championship_entries.id, entryIds));
    }
  }
  if (testBirdIds.length > 0) {
    const entries = await db.select().from(championship_entries).where(inArray(championship_entries.birdId, testBirdIds));
    const entryIds = entries.map((e) => e.id);
    if (entryIds.length > 0) {
      await db.delete(scores).where(inArray(scores.entryId, entryIds));
      await db.delete(championship_entries).where(inArray(championship_entries.id, entryIds));
    }
  }
  await db.delete(championships).where(inArray(championships.id, testChampionshipIds));
  console.log("  ✓ campeonatos, inscrições, pontuações");

  if (testJudgeIds.length > 0) {
    await db.delete(judges).where(inArray(judges.id, testJudgeIds));
  }
  console.log("  ✓ juízes");

  if (testBirdIds.length > 0) {
    await db.delete(health_records).where(inArray(health_records.birdId, testBirdIds));
  }
  console.log("  ✓ registros de saúde");

  if (testCoupleIds.length > 0) {
    await db.delete(breeding_reminders).where(inArray(breeding_reminders.coupleId, testCoupleIds));
    const testClutches = await db.select().from(clutches).where(inArray(clutches.coupleId, testCoupleIds));
    const testClutchIds = testClutches.map((c) => c.id);
    if (testClutchIds.length > 0) {
      await db.delete(chicks).where(inArray(chicks.clutchId, testClutchIds));
    }
    await db.delete(clutches).where(inArray(clutches.coupleId, testCoupleIds));
  }
  // filhotes de teste remanescentes (anilha TESTE- que não caiu no bloco acima)
  if (testChickIds.length > 0) {
    await db.delete(chicks).where(inArray(chicks.id, testChickIds));
  }
  console.log("  ✓ lembretes, posturas, filhotes");

  await db.delete(couples).where(inArray(couples.id, testCoupleIds));
  console.log("  ✓ casais");

  if (testBirdIds.length > 0) {
    await db.delete(photos).where(and(eq(photos.entityType, "bird"), inArray(photos.entityId, testBirdIds)));
  }
  console.log("  ✓ fotos");

  await db.delete(birds).where(inArray(birds.id, testBirdIds));
  console.log("  ✓ pássaros");

  if (testRingBatchIds.length > 0) {
    await db.delete(rings).where(inArray(rings.batchId, testRingBatchIds));
  }
  await db.delete(ring_batches).where(inArray(ring_batches.id, testRingBatchIds));
  console.log("  ✓ anilhas e lote");

  await db.delete(cages).where(inArray(cages.id, testCageIds));
  console.log("  ✓ gaiolas");

  console.log("\n✅ Limpeza concluída. Dados reais não foram tocados.");
  process.exit(0);
}

main().catch((err) => {
  console.error("ERRO ao limpar dados de teste:", err);
  process.exit(1);
});
