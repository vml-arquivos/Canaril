import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  birds,
  couples,
  clutches,
  rings,
  ring_batches,
  championships,
  championship_entries,
  scores,
  bird_genotype,
  bird_genetic_profiles,
  chicks,
} from "../../drizzle/schema";
import { desc, eq, and } from "drizzle-orm";
import { calculateCOI, calculateCOIForPair, classifyCOIRisk, PedigreeBird } from "../_core/genetics";

function countBy<T extends Record<string, any>>(rows: T[], key: keyof T): Record<string, number> {
  return rows.reduce((acc, row) => {
    const k = String(row[key] ?? "—");
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

export const reportsRouter = router({
  // ─── Existente: Dashboard summary ──────────────────────────────────────────
  summary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return {
        birdsBySpecialty: {},
        birdsByColor: {},
        birdsBySex: {},
        birdsByStatus: {},
        couplesActive: 0,
        couplesInactive: 0,
        clutchesTotal: 0,
        totalEggs: 0,
        totalFertilized: 0,
        totalHatched: 0,
        hatchRate: 0,
        ringsAvailable: 0,
        ringsInUse: 0,
        championshipsByStatus: {},
        topScores: [] as Array<{ entryId: number; birdId: number; category: string; totalScore: number; placement: number | null; championshipName: string }>,
      };
    }

    const [birdsList, couplesList, clutchesList, ringsList, championshipsList, entriesList, scoresList] = await Promise.all([
      db.select().from(birds),
      db.select().from(couples),
      db.select().from(clutches),
      db.select().from(rings),
      db.select().from(championships),
      db.select().from(championship_entries),
      db.select().from(scores).orderBy(desc(scores.totalScore)),
    ]);

    const totalEggs = clutchesList.reduce((sum, c) => sum + c.totalEggs, 0);
    const totalFertilized = clutchesList.reduce((sum, c) => sum + c.fertilizedEggs, 0);
    const totalHatched = clutchesList.reduce((sum, c) => sum + c.hatchedChicks, 0);

    const championshipById = new Map(championshipsList.map((c) => [c.id, c]));
    const entryById = new Map(entriesList.map((e) => [e.id, e]));

    const topScores = scoresList.slice(0, 10).map((s) => {
      const entry = entryById.get(s.entryId);
      const championship = entry ? championshipById.get(entry.championshipId) : undefined;
      return {
        entryId: s.entryId,
        birdId: entry?.birdId ?? 0,
        category: entry?.category ?? "-",
        totalScore: s.totalScore,
        placement: s.placement,
        championshipName: championship?.name ?? "-",
      };
    });

    return {
      birdsBySpecialty: countBy(birdsList, "specialty_code"),
      birdsByColor: countBy(birdsList, "color_code"),
      birdsBySex: countBy(birdsList, "sex"),
      birdsByStatus: countBy(birdsList, "status"),
      couplesActive: couplesList.filter((c) => c.status === "active").length,
      couplesInactive: couplesList.filter((c) => c.status !== "active").length,
      clutchesTotal: clutchesList.length,
      totalEggs,
      totalFertilized,
      totalHatched,
      hatchRate: totalEggs > 0 ? Math.round((totalHatched / totalEggs) * 100) : 0,
      ringsAvailable: ringsList.filter((r) => r.status === "available").length,
      ringsInUse: ringsList.filter((r) => r.status === "in_use").length,
      championshipsByStatus: countBy(championshipsList, "status"),
      topScores,
    };
  }),

  // ─── NOVO: Relatório do Plantel Completo ────────────────────────────────────
  plantelCompleto: protectedProcedure
    .input(
      z.object({
        sexFilter: z.string().optional(),
        statusFilter: z.string().optional(),
        geneticFilter: z.enum(["all", "completa", "incompleta"]).default("all"),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { rows: [], generatedAt: new Date(), total: 0 };

      const [allBirds, allGenotypes, allProfiles, allCouples, allClutches] = await Promise.all([
        db.select().from(birds),
        db.select().from(bird_genotype),
        db.select().from(bird_genetic_profiles),
        db.select().from(couples),
        db.select().from(clutches),
      ]);

      const genotypeByBird = new Map(allGenotypes.map((g) => [g.birdId, g]));
      const profileByBird = new Map(allProfiles.map((p) => [p.birdId, p]));
      const birdMap = new Map<number, PedigreeBird>(
        allBirds.map((b) => [b.id, { id: b.id, ring: b.ring, specialty_code: b.specialty_code, color_code: b.color_code, sex: b.sex, fatherId: b.fatherId, motherId: b.motherId }])
      );
      const coiCache = new Map<number, number>();

      // Histórico reprodutivo por pássaro
      const reproByBird = new Map<number, { clutches: number; eggs: number; hatched: number }>();
      for (const bird of allBirds) {
        const birdCouples = allCouples.filter((c) => c.maleId === bird.id || c.femaleId === bird.id);
        const birdClutches = allClutches.filter((cl) => birdCouples.some((c) => c.id === cl.coupleId));
        reproByBird.set(bird.id, {
          clutches: birdClutches.length,
          eggs: birdClutches.reduce((sum, c) => sum + c.totalEggs, 0),
          hatched: birdClutches.reduce((sum, c) => sum + c.hatchedChicks, 0),
        });
      }

      let rows = allBirds.map((bird) => {
        const genotype = genotypeByBird.get(bird.id);
        const profile = profileByBird.get(bird.id);
        const hasOperationalGenotype = !!genotype && (!!genotype.backgroundColor || !!genotype.featherType || genotype.hasCrest || (Array.isArray(genotype.mutations) && genotype.mutations.length > 0));
        const hasOfficialProfile = !!profile;
        const geneticComplete = hasOperationalGenotype || hasOfficialProfile;
        const coi = bird.fatherId && bird.motherId ? calculateCOI(bird.id, birdMap, 5, coiCache) : null;
        const repro = reproByBird.get(bird.id) ?? { clutches: 0, eggs: 0, hatched: 0 };

        // Alertas
        const alerts: string[] = [];
        if (!geneticComplete) alerts.push("Sem ficha genética");
        if (!bird.fatherId) alerts.push("Pai desconhecido");
        if (!bird.motherId) alerts.push("Mãe desconhecida");
        if (!bird.birthDate) alerts.push("Data de nascimento desconhecida");
        if (coi !== null && classifyCOIRisk(coi) === "high") alerts.push("COI alto");

        return {
          birdId: bird.id,
          ring: bird.ring,
          displayTitle: bird.displayTitle,
          nickname: bird.nickname,
          sex: bird.sex,
          speciesName: bird.speciesName,
          breedName: bird.breedName,
          modality: bird.modality,
          specialtyCode: bird.specialty_code,
          colorCode: bird.color_code,
          birthDate: bird.birthDate,
          status: bird.status,
          fatherId: bird.fatherId,
          motherId: bird.motherId,
          hasOperationalGenotype,
          hasOfficialProfile,
          geneticComplete,
          officialCode: profile?.officialCode ?? null,
          officialName: profile?.officialName ?? null,
          featherType: genotype?.featherType ?? null,
          hasCrest: genotype?.hasCrest ?? false,
          backgroundColor: genotype?.backgroundColor ?? null,
          coi,
          coiRisk: coi !== null ? classifyCOIRisk(coi) : null,
          alerts,
          repro,
        };
      });

      // Filtros
      if (input?.sexFilter) rows = rows.filter((r) => r.sex === input.sexFilter);
      if (input?.statusFilter) rows = rows.filter((r) => r.status === input.statusFilter);
      if (input?.geneticFilter === "completa") rows = rows.filter((r) => r.geneticComplete);
      if (input?.geneticFilter === "incompleta") rows = rows.filter((r) => !r.geneticComplete);
      if (input?.search) {
        const q = input.search.toLowerCase();
        rows = rows.filter((r) =>
          r.ring.toLowerCase().includes(q) ||
          (r.displayTitle ?? "").toLowerCase().includes(q) ||
          (r.nickname ?? "").toLowerCase().includes(q)
        );
      }

      return { rows, generatedAt: new Date(), total: rows.length };
    }),

  // ─── NOVO: Relatório Individual de um Pássaro ──────────────────────────────
  birdIndividual: protectedProcedure
    .input(z.object({ birdId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [bird] = await db.select().from(birds).where(eq(birds.id, input.birdId)).limit(1);
      if (!bird) return null;

      const [genotype] = await db.select().from(bird_genotype).where(eq(bird_genotype.birdId, input.birdId)).limit(1);
      const [profile] = await db.select().from(bird_genetic_profiles).where(eq(bird_genetic_profiles.birdId, input.birdId)).limit(1);

      // Pedigree
      let father = null, mother = null, paternalGf = null, paternalGm = null, maternalGf = null, maternalGm = null;
      if (bird.fatherId) {
        const [f] = await db.select().from(birds).where(eq(birds.id, bird.fatherId)).limit(1);
        father = f ?? null;
        if (f?.fatherId) { const [gf] = await db.select().from(birds).where(eq(birds.id, f.fatherId)).limit(1); paternalGf = gf ?? null; }
        if (f?.motherId) { const [gm] = await db.select().from(birds).where(eq(birds.id, f.motherId)).limit(1); paternalGm = gm ?? null; }
      }
      if (bird.motherId) {
        const [m] = await db.select().from(birds).where(eq(birds.id, bird.motherId)).limit(1);
        mother = m ?? null;
        if (m?.fatherId) { const [gf] = await db.select().from(birds).where(eq(birds.id, m.fatherId)).limit(1); maternalGf = gf ?? null; }
        if (m?.motherId) { const [gm] = await db.select().from(birds).where(eq(birds.id, m.motherId)).limit(1); maternalGm = gm ?? null; }
      }

      // Casais e posturas
      const birdCouples = await db.select().from(couples).where(
        eq(bird.sex === "macho" ? couples.maleId : couples.femaleId, bird.id)
      );
      const coupleIds = birdCouples.map((c) => c.id);
      // Busca posturas de todos os casais do pássaro
      let birdClutches: (typeof clutches.$inferSelect)[] = [];
      if (coupleIds.length > 0) {
        const allClutchesForBird = await db.select().from(clutches);
        birdClutches = allClutchesForBird.filter((cl) => coupleIds.includes(cl.coupleId));
      }

      // COI
      const allBirds = await db.select().from(birds);
      const birdMap = new Map<number, PedigreeBird>(
        allBirds.map((b) => [b.id, { id: b.id, ring: b.ring, specialty_code: b.specialty_code, color_code: b.color_code, sex: b.sex, fatherId: b.fatherId, motherId: b.motherId }])
      );
      const coi = bird.fatherId && bird.motherId ? calculateCOI(bird.id, birdMap, 5, new Map()) : null;

      const mutations = (genotype?.mutations as Array<{ mutation: string; inheritance: string; zygosity: string }> | null) ?? [];

      return {
        bird,
        genotype: genotype ?? null,
        profile: profile ?? null,
        pedigree: { father, mother, paternalGf, paternalGm, maternalGf, maternalGm },
        couples: birdCouples,
        clutches: birdClutches,
        coi,
        coiRisk: coi !== null ? classifyCOIRisk(coi) : null,
        mutations,
        geneticComplete: !!genotype || !!profile,
        generatedAt: new Date(),
      };
    }),

  // ─── NOVO: Relatório de Lacunas de Dados ───────────────────────────────────
  lacunasDados: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { rows: [], generatedAt: new Date(), summary: null };

    const [allBirds, allGenotypes, allProfiles] = await Promise.all([
      db.select().from(birds).where(eq(birds.status, "active")),
      db.select().from(bird_genotype),
      db.select().from(bird_genetic_profiles),
    ]);

    const genotypeSet = new Set(allGenotypes.map((g) => g.birdId));
    const profileSet = new Set(allProfiles.map((p) => p.birdId));

    const rows = allBirds.map((bird) => {
      const lacunas: string[] = [];
      if (!bird.fatherId) lacunas.push("Pai");
      if (!bird.motherId) lacunas.push("Mãe");
      if (!bird.officialClassId) lacunas.push("Classe oficial");
      if (!genotypeSet.has(bird.id)) lacunas.push("Genótipo operacional");
      if (!profileSet.has(bird.id)) lacunas.push("Perfil genético oficial");
      if (!bird.birthDate) lacunas.push("Data de nascimento");
      if (!bird.sex || bird.sex === "indeterminado") lacunas.push("Sexo");

      return {
        birdId: bird.id,
        ring: bird.ring,
        displayTitle: bird.displayTitle,
        sex: bird.sex,
        lacunas,
        lacunasCount: lacunas.length,
      };
    });

    // Ordena por mais lacunas primeiro
    rows.sort((a, b) => b.lacunasCount - a.lacunasCount);

    const summary = {
      total: rows.length,
      semPai: rows.filter((r) => r.lacunas.includes("Pai")).length,
      semMae: rows.filter((r) => r.lacunas.includes("Mãe")).length,
      semClasseOficial: rows.filter((r) => r.lacunas.includes("Classe oficial")).length,
      semGenotipo: rows.filter((r) => r.lacunas.includes("Genótipo operacional")).length,
      semSexo: rows.filter((r) => r.lacunas.includes("Sexo")).length,
      compleatos: rows.filter((r) => r.lacunasCount === 0).length,
    };

    return { rows, generatedAt: new Date(), summary };
  }),

  // ─── NOVO: Relatório de Anilhas ─────────────────────────────────────────────
  anilhas: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { batches: [], rings: [], generatedAt: new Date(), summary: null };

    const [batches, allRings] = await Promise.all([
      db.select().from(ring_batches).orderBy(desc(ring_batches.year)),
      db.select().from(rings),
    ]);

    const ringsByBatch = new Map<number, typeof allRings>();
    for (const ring of allRings) {
      const list = ringsByBatch.get(ring.batchId) ?? [];
      list.push(ring);
      ringsByBatch.set(ring.batchId, list);
    }

    const batchRows = batches.map((batch) => {
      const batchRings = ringsByBatch.get(batch.id) ?? [];
      const available = batchRings.filter((r) => r.status === "available").length;
      const inUse = batchRings.filter((r) => r.status === "in_use").length;
      const lost = batchRings.filter((r) => r.status === "lost").length;
      const damaged = batchRings.filter((r) => r.status === "damaged").length;
      const nextAvailable = batchRings.find((r) => r.status === "available")?.number ?? null;

      return {
        batchId: batch.id,
        batchNumber: batch.batch_number,
        year: batch.year,
        color: batch.color,
        breederCode: batch.breederCode,
        quantityTotal: batch.quantity_total,
        available,
        inUse,
        lost,
        damaged,
        nextAvailable,
        utilizationPct: batch.quantity_total > 0
          ? Math.round((inUse / batch.quantity_total) * 100)
          : 0,
      };
    });

    const totalAvailable = allRings.filter((r) => r.status === "available").length;
    const totalInUse = allRings.filter((r) => r.status === "in_use").length;

    const summary = {
      totalBatches: batches.length,
      totalRings: allRings.length,
      totalAvailable,
      totalInUse,
      totalLost: allRings.filter((r) => r.status === "lost").length,
      totalDamaged: allRings.filter((r) => r.status === "damaged").length,
    };

    return { batches: batchRows, rings: allRings, generatedAt: new Date(), summary };
  }),

  // ─── NOVO: Confronto Genético de Casal ─────────────────────────────────────
  confrontoGenetico: protectedProcedure
    .input(z.object({ maleId: z.number().int().positive(), femaleId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [male] = await db.select().from(birds).where(eq(birds.id, input.maleId)).limit(1);
      const [female] = await db.select().from(birds).where(eq(birds.id, input.femaleId)).limit(1);

      if (!male || !female) return null;

      const [maleGenotype] = await db.select().from(bird_genotype).where(eq(bird_genotype.birdId, input.maleId)).limit(1);
      const [femaleGenotype] = await db.select().from(bird_genotype).where(eq(bird_genotype.birdId, input.femaleId)).limit(1);
      const [maleProfile] = await db.select().from(bird_genetic_profiles).where(eq(bird_genetic_profiles.birdId, input.maleId)).limit(1);
      const [femaleProfile] = await db.select().from(bird_genetic_profiles).where(eq(bird_genetic_profiles.birdId, input.femaleId)).limit(1);

      // COI
      const allBirds = await db.select().from(birds);
      const birdMap = new Map<number, PedigreeBird>(
        allBirds.map((b) => [b.id, { id: b.id, ring: b.ring, specialty_code: b.specialty_code, color_code: b.color_code, sex: b.sex, fatherId: b.fatherId, motherId: b.motherId }])
      );
      const coi = calculateCOIForPair(input.maleId, input.femaleId, birdMap, 5);
      const coiRisk = classifyCOIRisk(coi);

      // Alertas genéticos básicos
      const alerts: string[] = [];
      const maleMutations = (maleGenotype?.mutations as Array<{ mutation: string; zygosity: string }> | null) ?? [];
      const femaleMutations = (femaleGenotype?.mutations as Array<{ mutation: string; zygosity: string }> | null) ?? [];

      if (maleGenotype?.hasCrest && femaleGenotype?.hasCrest) {
        alerts.push("RISCO LETAL: crista × crista — 25% dos filhotes podem ser letais (NN+NN)");
      }
      const maleBD = maleMutations.find((m) => m.mutation === "branco_dominante" && m.zygosity !== "homozygous_normal");
      const femaleBD = femaleMutations.find((m) => m.mutation === "branco_dominante" && m.zygosity !== "homozygous_normal");
      if (maleBD && femaleBD) {
        alerts.push("RISCO LETAL: branco dominante × branco dominante — pode produzir filhotes inviáveis");
      }
      if (maleGenotype?.featherType === "nevado" && femaleGenotype?.featherType === "nevado") {
        alerts.push("Atenção: nevado × nevado — plumagem pode ser problemática em alguns filhotes");
      }
      if (coiRisk === "high") {
        alerts.push(`COI alto (${(coi * 100).toFixed(1)}%) — considere um casal menos consanguíneo`);
      } else if (coiRisk === "moderate") {
        alerts.push(`COI moderado (${(coi * 100).toFixed(1)}%) — aceitável com monitoramento`);
      }

      return {
        male: { bird: male, genotype: maleGenotype ?? null, profile: maleProfile ?? null },
        female: { bird: female, genotype: femaleGenotype ?? null, profile: femaleProfile ?? null },
        coi,
        coiRisk,
        alerts,
        hasBothGenotypes: !!maleGenotype && !!femaleGenotype,
        generatedAt: new Date(),
      };
    }),
});
