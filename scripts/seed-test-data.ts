/**
 * SEED DE DADOS DE TESTE — Canário Gestão Pro
 * ============================================================================
 * Popula o banco com dados fictícios para testes e simulações: ~50
 * pássaros, gaiolas, casais (com lembretes de reprodução automáticos),
 * posturas, filhotes, campeonatos, juízes, pontuações e registros de
 * saúde — cobrindo todos os módulos do sistema.
 *
 * SEGURANÇA — leia antes de rodar:
 * - TODO registro criado por este script é marcado de forma identificável:
 *   anilhas com prefixo "TESTE-", gaiolas com prefixo "T-", campeonatos
 *   com prefixo "[TESTE]", e a observação "[DADOS DE TESTE]" em todo
 *   registro que tiver campo de notas. Isso permite apagar tudo depois
 *   com segurança usando scripts/cleanup-test-data.ts, sem tocar em
 *   nenhum dado real.
 * - Por padrão SÓ RODA se a variável de ambiente SEED_CONFIRM=yes for
 *   passada explicitamente — isso evita rodar sem querer contra o banco
 *   de produção. Use um banco de teste/homologação sempre que possível.
 * - Não apaga nada — só insere.
 *
 * Como rodar:
 *   python3 scripts/generate-test-images.py   # gera as imagens primeiro
 *   SEED_CONFIRM=yes DATABASE_URL="postgres://..." npx tsx scripts/seed-test-data.ts
 * ============================================================================
 */

import fs from "node:fs";
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
import { storagePut } from "../server/storage";
import { generateBreedingReminders } from "../server/_core/breeding";
import { SPECIALTIES, COLORS } from "../shared/constants";
import { eq } from "drizzle-orm";

const TEST_TAG = "[DADOS DE TESTE]";
const IMAGES_DIR = "/tmp/canaril_test_images";

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgoMin: number, daysAgoMax: number): Date {
  const daysAgo = daysAgoMin + Math.random() * (daysAgoMax - daysAgoMin);
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
}

async function main() {
  if (process.env.SEED_CONFIRM !== "yes") {
    console.error(
      "\n⚠️  Por segurança, este script só roda com SEED_CONFIRM=yes explicitamente definido.\n" +
        "   Confirme que está apontando para o banco CERTO (de preferência um banco de teste,\n" +
        "   não produção) antes de rodar:\n\n" +
        '   SEED_CONFIRM=yes DATABASE_URL="postgres://..." npx tsx scripts/seed-test-data.ts\n'
    );
    process.exit(1);
  }

  console.log(`Conectando em: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@")}`);
  await ensureDatabaseReady();
  const db = (await getDb())!;

  const report: Record<string, number> = {};

  // --------------------------------------------------------------------
  // 1) Gaiolas (15)
  // --------------------------------------------------------------------
  console.log("\n[1/9] Criando gaiolas...");
  const cageRows = [];
  for (let i = 1; i <= 15; i++) {
    cageRows.push({
      code: `T-${String(i).padStart(2, "0")}`,
      section: `Galpão Teste ${Math.ceil(i / 5)} - Fileira ${((i - 1) % 5) + 1}`,
      capacity: i % 4 === 0 ? 2 : 1,
      status: "free" as const,
      notes: TEST_TAG,
    });
  }
  const insertedCages = await db.insert(cages).values(cageRows).returning();
  report.gaiolas = insertedCages.length;
  console.log(`  ${insertedCages.length} gaiolas criadas`);

  // --------------------------------------------------------------------
  // 2) Lote de anilhas de teste (gera anilhas individuais reais, mesmo
  //    fluxo usado pela tela de Anilhas)
  // --------------------------------------------------------------------
  console.log("\n[2/9] Criando lote de anilhas de teste...");
  const year = new Date().getFullYear();
  const [batch] = await db
    .insert(ring_batches)
    .values({
      batch_number: "TESTE",
      year,
      color: "Verde (teste)",
      quantity_total: 80,
      quantity_used: 0,
      status: "available",
    })
    .returning();

  const ringRows = Array.from({ length: 80 }, (_, i) => ({
    batchId: batch.id,
    number: `TESTE-${year}-${String(i + 1).padStart(3, "0")}`,
    sequence: i + 1,
    status: "available" as const,
  }));
  await db.insert(rings).values(ringRows);
  const allTestRings = await db.select().from(rings).where(eq(rings.batchId, batch.id));
  console.log(`  80 anilhas individuais geradas (lote TESTE-${year})`);

  // --------------------------------------------------------------------
  // 3) Pássaros (50) — variando espécie, cor, sexo, idade. Os primeiros
  //    35 são "fundadores" (sem pais); os últimos 15 recebem fatherId/
  //    motherId de pássaros já criados, pra ter profundidade de pedigree
  //    suficiente pra testar COI e árvore genealógica de verdade.
  // --------------------------------------------------------------------
  console.log("\n[3/9] Criando 50 pássaros...");
  const createdBirds: (typeof birds.$inferSelect)[] = [];
  let ringCursor = 0;

  function nextRing(): string {
    const r = allTestRings[ringCursor];
    ringCursor++;
    return r ? r.number : `TESTE-${year}-AVULSA-${ringCursor}`;
  }

  // 35 fundadores
  for (let i = 0; i < 35; i++) {
    const specialty = randomItem(SPECIALTIES);
    const color = randomItem(COLORS);
    const sex = i % 2 === 0 ? "macho" : "fêmea";
    const [bird] = await db
      .insert(birds)
      .values({
        ring: nextRing(),
        specialty_code: specialty.id,
        sex,
        color_code: color.id,
        birthDate: randomDate(180, 900),
        procedence: i % 7 === 0 ? "Criadouro Parceiro Teste" : undefined,
        status: "active",
        cageId: insertedCages[i % insertedCages.length].id,
        isPublic: i % 6 === 0,
        notes: TEST_TAG,
      })
      .returning();
    createdBirds.push(bird);
  }

  // 15 com pais (filhos de fundadores), pra testar pedigree/COI
  for (let i = 0; i < 15; i++) {
    const father = randomItem(createdBirds.filter((b) => b.sex === "macho"));
    const mother = randomItem(createdBirds.filter((b) => b.sex === "fêmea"));
    const specialty = SPECIALTIES.find((s) => s.id === father.specialty_code) ?? randomItem(SPECIALTIES);
    const color = randomItem(COLORS);
    const sex = i % 2 === 0 ? "macho" : "fêmea";
    const [bird] = await db
      .insert(birds)
      .values({
        ring: nextRing(),
        specialty_code: specialty.id,
        sex,
        color_code: color.id,
        birthDate: randomDate(30, 200),
        fatherId: father.id,
        motherId: mother.id,
        status: "active",
        cageId: insertedCages[(i + 35) % insertedCages.length].id,
        isPublic: false,
        notes: TEST_TAG,
      })
      .returning();
    createdBirds.push(bird);
  }
  report.passaros = createdBirds.length;
  console.log(`  ${createdBirds.length} pássaros criados (35 fundadores + 15 com pedigree)`);

  // --------------------------------------------------------------------
  // 4) Fotos — anexa a ilustração placeholder correspondente à cor em
  //    ~20 pássaros (pra também testar a vitrine/blocos com foto real
  //    em disco, não só o estado vazio)
  // --------------------------------------------------------------------
  console.log("\n[4/9] Enviando fotos de teste...");
  let photosCreated = 0;
  if (fs.existsSync(IMAGES_DIR)) {
    const birdsToPhotograph = createdBirds.slice(0, 20);
    for (const bird of birdsToPhotograph) {
      const imagePath = `${IMAGES_DIR}/${bird.color_code}.jpg`;
      if (!fs.existsSync(imagePath)) continue;
      const buffer = fs.readFileSync(imagePath);
      const { key, url } = await storagePut(`canaril/bird/${bird.id}/teste.jpg`, buffer, "image/jpeg");
      await db.insert(photos).values({
        entityType: "bird",
        entityId: bird.id,
        storageKey: key,
        url,
        caption: TEST_TAG,
        isPrimary: true,
        takenAt: new Date(),
      });
      photosCreated++;
    }
  } else {
    console.log(`  Aviso: pasta ${IMAGES_DIR} não encontrada — rode generate-test-images.py antes. Pulando fotos.`);
  }
  report.fotos = photosCreated;
  console.log(`  ${photosCreated} fotos anexadas`);

  // --------------------------------------------------------------------
  // 5) Casais (15) — respeitando a regra de não-duplicação (cada pássaro
  //    só entra em um casal ativo por vez), com lembretes automáticos
  // --------------------------------------------------------------------
  console.log("\n[5/9] Formando 15 casais...");
  const availableMales = createdBirds.filter((b) => b.sex === "macho");
  const availableFemales = createdBirds.filter((b) => b.sex === "fêmea");
  const usedMales = new Set<number>();
  const usedFemales = new Set<number>();
  const createdCouples: (typeof couples.$inferSelect)[] = [];

  let coupleCount = 0;
  for (const male of availableMales) {
    if (coupleCount >= 15) break;
    if (usedMales.has(male.id)) continue;
    const female = availableFemales.find((f) => !usedFemales.has(f.id) && f.id !== male.motherId && f.id !== male.fatherId);
    if (!female) continue;

    usedMales.add(male.id);
    usedFemales.add(female.id);

    const formationDate = randomDate(10, 300);
    const status = coupleCount % 4 === 0 ? "finalized" : coupleCount % 5 === 0 ? "inactive" : "active";
    const [couple] = await db
      .insert(couples)
      .values({
        maleId: male.id,
        femaleId: female.id,
        cageNumber: `T-${String((coupleCount % 15) + 1).padStart(2, "0")}`,
        formationDate,
        status,
        notes: TEST_TAG,
      })
      .returning();
    createdCouples.push(couple);

    // lembretes automáticos, mesmo fluxo da tela de Casais
    const seeds = generateBreedingReminders(formationDate);
    await db.insert(breeding_reminders).values(
      seeds.map((s) => ({ coupleId: couple.id, eventType: s.eventType, expectedDate: s.expectedDate, notes: s.notes }))
    );

    coupleCount++;
  }
  report.casais = createdCouples.length;
  report.lembretes = createdCouples.length * 6;
  console.log(`  ${createdCouples.length} casais formados (${createdCouples.length * 6} lembretes gerados automaticamente)`);

  // --------------------------------------------------------------------
  // 6) Posturas e filhotes
  // --------------------------------------------------------------------
  console.log("\n[6/9] Criando posturas e filhotes...");
  let clutchCount = 0;
  let chickCount = 0;
  for (const couple of createdCouples) {
    const numClutches = 1 + Math.floor(Math.random() * 2);
    for (let c = 0; c < numClutches; c++) {
      const totalEggs = 3 + Math.floor(Math.random() * 3);
      const fertilized = Math.max(0, totalEggs - Math.floor(Math.random() * 2));
      const hatched = Math.max(0, fertilized - Math.floor(Math.random() * 2));
      const clutchDate = randomDate(5, 280);

      const [clutch] = await db
        .insert(clutches)
        .values({
          coupleId: couple.id,
          clutchDate,
          totalEggs,
          fertilizedEggs: fertilized,
          infertileEggs: totalEggs - fertilized,
          lostEggs: Math.max(0, fertilized - hatched),
          hatchedChicks: hatched,
          notes: TEST_TAG,
        })
        .returning();
      clutchCount++;

      for (let h = 0; h < hatched; h++) {
        const color = randomItem(COLORS);
        await db.insert(chicks).values({
          clutchId: clutch.id,
          ring: nextRing(),
          sex: randomItem(["macho", "fêmea", "indeterminado"] as const),
          color_code: color.id,
          birthDate: new Date(clutchDate.getTime() + 14 * 24 * 60 * 60 * 1000),
          status: "active",
          notes: TEST_TAG,
        });
        chickCount++;
      }
    }
  }
  report.posturas = clutchCount;
  report.filhotes = chickCount;
  console.log(`  ${clutchCount} posturas, ${chickCount} filhotes`);

  // --------------------------------------------------------------------
  // 7) Juízes (5)
  // --------------------------------------------------------------------
  console.log("\n[7/9] Criando juízes...");
  const judgeNames = ["Carlos Mendes", "Ana Paula Souza", "Roberto Lima", "Fernanda Costa", "Paulo Henrique"];
  const createdJudges = await db
    .insert(judges)
    .values(judgeNames.map((name) => ({ name, association: "FOB (teste)" })))
    .returning();
  report.juizes = createdJudges.length;
  console.log(`  ${createdJudges.length} juízes criados`);

  // --------------------------------------------------------------------
  // 8) Campeonatos, inscrições e pontuações
  // --------------------------------------------------------------------
  console.log("\n[8/9] Criando campeonatos, inscrições e pontuações...");
  const champData = [
    { name: "[TESTE] Campeonato Regional", status: "finished" as const, daysAgo: 60 },
    { name: "[TESTE] Open de Verão", status: "ongoing" as const, daysAgo: -5 },
    { name: "[TESTE] Copa Nacional", status: "upcoming" as const, daysAgo: -45 },
  ];
  let entryCount = 0;
  let scoreCount = 0;
  for (const c of champData) {
    const [championship] = await db
      .insert(championships)
      .values({
        name: c.name,
        association: "FOB",
        location: "Brasília - DF (teste)",
        startDate: new Date(Date.now() - c.daysAgo * 24 * 60 * 60 * 1000),
        status: c.status,
        notes: TEST_TAG,
      })
      .returning();

    const entryBirds = createdBirds.slice(0, 7).sort(() => Math.random() - 0.5).slice(0, 5 + Math.floor(Math.random() * 3));
    for (const bird of entryBirds) {
      const specialtyName = SPECIALTIES.find((s) => s.id === bird.specialty_code)?.name ?? bird.specialty_code;
      const colorName = COLORS.find((c2) => c2.id === bird.color_code)?.name ?? bird.color_code;
      const [entry] = await db
        .insert(championship_entries)
        .values({
          championshipId: championship.id,
          birdId: bird.id,
          category: `${specialtyName} ${colorName}`,
          cageNumberAtShow: String(100 + entryCount),
          status: c.status === "finished" ? "judged" : "registered",
        })
        .returning();
      entryCount++;

      if (c.status === "finished") {
        const totalScore = 70 + Math.random() * 25;
        await db.insert(scores).values({
          entryId: entry.id,
          judgeId: randomItem(createdJudges).id,
          totalScore: Math.round(totalScore * 10) / 10,
          placement: scoreCount % 5 === 0 ? Math.ceil(Math.random() * 3) : undefined,
          notes: TEST_TAG,
        });
        scoreCount++;
      }
    }
  }
  report.campeonatos = champData.length;
  report.inscricoes = entryCount;
  report.pontuacoes = scoreCount;
  console.log(`  ${champData.length} campeonatos, ${entryCount} inscrições, ${scoreCount} pontuações`);

  // --------------------------------------------------------------------
  // 9) Registros de saúde (vacina/peso/tratamento/alimentação)
  // --------------------------------------------------------------------
  console.log("\n[9/9] Criando registros de saúde...");
  const healthTypes = ["vaccine", "weight", "treatment", "diet"] as const;
  const healthBirds = createdBirds.slice(0, 25);
  let healthCount = 0;
  for (const bird of healthBirds) {
    const type = randomItem(healthTypes);
    await db.insert(health_records).values({
      birdId: bird.id,
      type,
      description:
        type === "vaccine" ? "Vacina anual (teste)" :
        type === "weight" ? "Pesagem de rotina (teste)" :
        type === "treatment" ? "Vermifugação (teste)" :
        "Ajuste de dieta na muda (teste)",
      date: randomDate(5, 200),
      weightGrams: type === "weight" ? 14 + Math.random() * 12 : undefined,
      dietPhase: type === "diet" ? randomItem(["muda", "reproducao", "descanso"] as const) : undefined,
      notes: TEST_TAG,
    });
    healthCount++;
  }
  report.saude = healthCount;
  console.log(`  ${healthCount} registros de saúde`);

  // --------------------------------------------------------------------
  console.log("\n============================================================");
  console.log("RESUMO DO SEED:");
  for (const [key, value] of Object.entries(report)) {
    console.log(`  ${key.padEnd(14)} ${value}`);
  }
  console.log("============================================================");
  console.log(
    "\nTodos os registros estão marcados como dados de teste (anilha começando\n" +
      'com "TESTE-", gaiolas "T-XX", campeonatos "[TESTE]", e a observação\n' +
      `"${TEST_TAG}"). Pra limpar tudo antes de ir pra produção:\n\n` +
      "  SEED_CONFIRM=yes DATABASE_URL=\"...\" npx tsx scripts/cleanup-test-data.ts\n"
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("ERRO ao popular dados de teste:", err);
  process.exit(1);
});
