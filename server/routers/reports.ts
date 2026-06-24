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
import { analyzeCoiForPair } from "../_core/coiAnalyzer";


function countBy<T extends Record<string, any>>(rows: T[], key: keyof T): Record<string, number> {
  return rows.reduce((acc, row) => {
    const k = String(row[key] ?? "—");
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

export const reportsRouter = router({
  // ─── Existente: Dashboard summary ──────────────────────────────────────────
  summary: protectedProcedure.query(async ({ ctx }) => {
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
    const tenantId = (ctx.user as any)?.tenantId ?? null;
    const tf = tenantId !== null;

    const [birdsList, couplesList, clutchesList, ringsList, championshipsList, entriesList, scoresList] = await Promise.all([
      tf ? db.select().from(birds).where(eq(birds.tenantId, tenantId)) : db.select().from(birds),
      tf ? db.select().from(couples).where(eq(couples.tenantId, tenantId)) : db.select().from(couples),
      tf ? db.select().from(clutches).where(eq(clutches.tenantId, tenantId)) : db.select().from(clutches),
      tf ? db.select().from(rings).where(eq(rings.tenantId, tenantId)) : db.select().from(rings),
      tf ? db.select().from(championships).where(eq(championships.tenantId, tenantId)) : db.select().from(championships),
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
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { rows: [], generatedAt: new Date(), total: 0 };
      const tenantId = (ctx.user as any)?.tenantId ?? null;
      const tf = tenantId !== null;

      const [allBirds, allGenotypes, allProfiles, allCouples, allClutches] = await Promise.all([
        tf ? db.select().from(birds).where(eq(birds.tenantId, tenantId)) : db.select().from(birds),
        db.select().from(bird_genotype),
        db.select().from(bird_genetic_profiles),
        tf ? db.select().from(couples).where(eq(couples.tenantId, tenantId)) : db.select().from(couples),
        tf ? db.select().from(clutches).where(eq(clutches.tenantId, tenantId)) : db.select().from(clutches),
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
  lacunasDados: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { rows: [], generatedAt: new Date(), summary: null };
    const tenantId = (ctx.user as any)?.tenantId ?? null;
    const tf = tenantId !== null;

    const [allBirds, allGenotypes, allProfiles] = await Promise.all([
      tf ? db.select().from(birds).where(and(eq(birds.status, "active"), eq(birds.tenantId, tenantId))) : db.select().from(birds).where(eq(birds.status, "active")),
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
  anilhas: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { batches: [], rings: [], generatedAt: new Date(), summary: null };
    const tenantId = (ctx.user as any)?.tenantId ?? null;
    const tf = tenantId !== null;

    const [batches, allRings] = await Promise.all([
      tf
        ? db.select().from(ring_batches).where(eq(ring_batches.tenantId, tenantId)).orderBy(desc(ring_batches.year))
        : db.select().from(ring_batches).orderBy(desc(ring_batches.year)),
      tf ? db.select().from(rings).where(eq(rings.tenantId, tenantId)) : db.select().from(rings),
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

  // ─── NOVO: Relatório de Casais e Reprodução ──────────────────────────────
  casaisReproducao: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { rows: [], generatedAt: new Date() };
    const tenantId = (ctx.user as any)?.tenantId ?? null;
    const tf = tenantId !== null;

    const [allCouples, allBirds, allClutches] = await Promise.all([
      tf ? db.select().from(couples).where(eq(couples.tenantId, tenantId)) : db.select().from(couples),
      tf ? db.select().from(birds).where(eq(birds.tenantId, tenantId)) : db.select().from(birds),
      tf ? db.select().from(clutches).where(eq(clutches.tenantId, tenantId)) : db.select().from(clutches),
    ]);

    const birdMap = new Map(allBirds.map((b) => [b.id, b]));
    const birdMapPedigree = new Map<number, PedigreeBird>(
      allBirds.map((b) => [b.id, { id: b.id, ring: b.ring, specialty_code: b.specialty_code, color_code: b.color_code, sex: b.sex, fatherId: b.fatherId, motherId: b.motherId }])
    );
    const clutchesByCouple = new Map<number, typeof allClutches>();
    for (const cl of allClutches) {
      const list = clutchesByCouple.get(cl.coupleId) ?? [];
      list.push(cl);
      clutchesByCouple.set(cl.coupleId, list);
    }

    const rows = allCouples.map((couple) => {
      const male = birdMap.get(couple.maleId);
      const female = birdMap.get(couple.femaleId);
      const coupleClutches = clutchesByCouple.get(couple.id) ?? [];

      const totalEggs = coupleClutches.reduce((s, c) => s + c.totalEggs, 0);
      const totalFertilized = coupleClutches.reduce((s, c) => s + c.fertilizedEggs, 0);
      const totalHatched = coupleClutches.reduce((s, c) => s + c.hatchedChicks, 0);
      const totalLost = coupleClutches.reduce((s, c) => s + c.lostEggs, 0);

      const coi = calculateCOIForPair(couple.maleId, couple.femaleId, birdMapPedigree, 5);
      const coiRisk = classifyCOIRisk(coi);

      const alerts: string[] = [];
      if (coiRisk === "high") alerts.push(`COI alto (${(coi * 100).toFixed(1)}%)`);
      if (coupleClutches.length >= 3 && couple.status === "active") alerts.push("Muitas posturas — avaliar descanso");
      if (totalEggs > 0 && totalFertilized / totalEggs < 0.5) alerts.push("Taxa de fertilização baixa");

      return {
        coupleId: couple.id,
        status: couple.status,
        formationDate: couple.formationDate,
        cageNumber: couple.cageNumber,
        male: male ? { id: male.id, ring: male.ring, displayTitle: male.displayTitle } : null,
        female: female ? { id: female.id, ring: female.ring, displayTitle: female.displayTitle } : null,
        coi,
        coiRisk,
        clutchesCount: coupleClutches.length,
        totalEggs,
        totalFertilized,
        totalHatched,
        totalLost,
        fertilizationRate: totalEggs > 0 ? Math.round((totalFertilized / totalEggs) * 100) : null,
        hatchRate: totalFertilized > 0 ? Math.round((totalHatched / totalFertilized) * 100) : null,
        alerts,
      };
    });

    rows.sort((a, b) => (b.status === "active" ? 1 : 0) - (a.status === "active" ? 1 : 0));

    return { rows, generatedAt: new Date() };
  }),

  // ─── NOVO: Painel de Temporada ────────────────────────────────────────────
  temporada: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const tenantId = (ctx.user as any)?.tenantId ?? null;
    const tf = tenantId !== null;

    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    // Incubação do canário: ~14 dias após a postura
    const INCUBATION_DAYS = 14;
    // Anilhamento: 7-9 dias após eclosão
    const RINGING_DAYS_AFTER_HATCH = 8;

    const [allCouples, allClutches, allChicks, allRings, allBirds] = await Promise.all([
      tf ? db.select().from(couples).where(eq(couples.tenantId, tenantId)) : db.select().from(couples),
      tf ? db.select().from(clutches).where(eq(clutches.tenantId, tenantId)) : db.select().from(clutches),
      tf ? db.select().from(chicks).where(eq(chicks.tenantId, tenantId)) : db.select().from(chicks),
      tf ? db.select().from(rings).where(eq(rings.tenantId, tenantId)) : db.select().from(rings),
      tf ? db.select().from(birds).where(and(eq(birds.status, "active"), eq(birds.tenantId, tenantId))) : db.select().from(birds).where(eq(birds.status, "active")),
    ]);

    const activeCouples = allCouples.filter((c) => c.status === "active");
    const ringsAvailable = allRings.filter((r) => r.status === "available").length;

    // Posturas ativas (dos casais ativos)
    const activeCoupleIds = new Set(activeCouples.map((c) => c.id));
    const activeClutches = allClutches.filter((cl) => activeCoupleIds.has(cl.coupleId));

    // Posturas próximas de eclosão (nos próximos 7 dias)
    const nearHatch = activeClutches.filter((cl) => {
      const hatchDate = new Date(cl.clutchDate.getTime() + INCUBATION_DAYS * 24 * 60 * 60 * 1000);
      return hatchDate >= now && hatchDate <= nextWeek;
    });

    // Filhotes que precisam ser anilhados (nascidos há 7-10 dias sem anilha)
    const chicksDueRing = allChicks.filter((ch) => {
      if (ch.ring && ch.ring !== "") return false; // já anilhado
      const ageDays = (now.getTime() - new Date(ch.birthDate).getTime()) / (24 * 60 * 60 * 1000);
      return ageDays >= RINGING_DAYS_AFTER_HATCH - 1 && ageDays <= RINGING_DAYS_AFTER_HATCH + 3;
    });

    // Alertas
    const alerts: Array<{ type: string; message: string; severity: "high" | "medium" | "low" }> = [];

    if (nearHatch.length > 0) {
      alerts.push({ type: "hatch", message: `${nearHatch.length} postura(s) próximas de eclosão nos próximos 7 dias`, severity: "medium" });
    }
    if (chicksDueRing.length > 0) {
      alerts.push({ type: "ring", message: `${chicksDueRing.length} filhote(s) no prazo ideal para anilhamento`, severity: "high" });
    }
    if (ringsAvailable < 10) {
      alerts.push({ type: "rings_low", message: `Apenas ${ringsAvailable} anilha(s) disponível(s) — repor estoque`, severity: ringsAvailable === 0 ? "high" : "medium" });
    }

    // Resumo por casal ativo
    const birdMap = new Map(allBirds.map((b) => [b.id, b]));
    const clutchesByCouple = new Map<number, typeof allClutches>();
    for (const cl of allClutches) {
      const list = clutchesByCouple.get(cl.coupleId) ?? [];
      list.push(cl);
      clutchesByCouple.set(cl.coupleId, list);
    }

    const casaisResumo = activeCouples.map((c) => {
      const male = birdMap.get(c.maleId);
      const female = birdMap.get(c.femaleId);
      const coupleClutches = clutchesByCouple.get(c.id) ?? [];
      const latestClutch = coupleClutches.sort((a, b) => new Date(b.clutchDate).getTime() - new Date(a.clutchDate).getTime())[0];
      const expectedHatch = latestClutch
        ? new Date(new Date(latestClutch.clutchDate).getTime() + INCUBATION_DAYS * 24 * 60 * 60 * 1000)
        : null;
      const nearHatchSoon = expectedHatch ? expectedHatch >= now && expectedHatch <= nextWeek : false;

      return {
        coupleId: c.id,
        cageNumber: c.cageNumber,
        maleRing: male?.ring ?? `#${c.maleId}`,
        femaleRing: female?.ring ?? `#${c.femaleId}`,
        clutchesCount: coupleClutches.length,
        latestClutchDate: latestClutch?.clutchDate ?? null,
        expectedHatchDate: expectedHatch,
        nearHatchSoon,
        totalHatched: coupleClutches.reduce((s, cl) => s + cl.hatchedChicks, 0),
      };
    });

    return {
      generatedAt: now,
      activeCouplesCount: activeCouples.length,
      activeClutchesCount: activeClutches.length,
      nearHatchCount: nearHatch.length,
      chicksDueRingCount: chicksDueRing.length,
      ringsAvailable,
      totalActiveBirds: allBirds.length,
      alerts,
      casaisResumo,
    };
  }),

  // ─── M3: COI Avançado com ancestrais comuns ──────────────────────────────
  coiAvancado: protectedProcedure
    .input(z.object({ maleId: z.number().int().positive(), femaleId: z.number().int().positive(), maxGen: z.number().int().min(2).max(8).default(6) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const fullBirds = await db.select().from(birds);
      const fullBirdMap = new Map(fullBirds.map((b) => [b.id, b]));
      const birdMap = new Map<number, PedigreeBird>(
        fullBirds.map((b) => [b.id, { id: b.id, ring: b.ring, specialty_code: b.specialty_code, color_code: b.color_code, sex: b.sex, fatherId: b.fatherId, motherId: b.motherId }])
      );
      const analysis = analyzeCoiForPair(input.maleId, input.femaleId, birdMap, input.maxGen);
      const enriched = analysis.commonAncestors.map((a) => {
        const bird = fullBirdMap.get(a.ancestorId);
        return { ...a, displayTitle: bird?.displayTitle ?? null };
      });
      return { ...analysis, commonAncestors: enriched, generatedAt: new Date() };
    }),

indice: protectedProcedure.query(async ({ ctx }) => {
  const db = await getDb();
  if (!db) return { rows: [], generatedAt: new Date() };
  const tenantId = (ctx.user as any)?.tenantId ?? null;
  const tf = tenantId !== null;
  const [allBirds, allCouples, allClutches, allEntries, allScores] = await Promise.all([
    tf ? db.select().from(birds).where(eq(birds.tenantId, tenantId)) : db.select().from(birds),
    tf ? db.select().from(couples).where(eq(couples.tenantId, tenantId)) : db.select().from(couples),
    tf ? db.select().from(clutches).where(eq(clutches.tenantId, tenantId)) : db.select().from(clutches),
    db.select().from(championship_entries),
    db.select().from(scores),
  ]);
  const birdMap = new Map<number, PedigreeBird>(
    allBirds.map((b) => [b.id, { id: b.id, ring: b.ring, specialty_code: b.specialty_code, color_code: b.color_code, sex: b.sex, fatherId: b.fatherId, motherId: b.motherId }])
  );
  const entryById = new Map(allEntries.map((e) => [e.id, e]));
  const scoresByBird = new Map<number, number[]>();
  for (const s of allScores) {
    const entry = entryById.get(s.entryId);
    if (!entry) continue;
    const list = scoresByBird.get(entry.birdId) ?? [];
    list.push(s.totalScore);
    scoresByBird.set(entry.birdId, list);
  }
  const coiCache = new Map<number, number>();
  const rows = allBirds.map((bird) => {
    const asCouples = allCouples.filter((c) => c.maleId === bird.id || c.femaleId === bird.id);
    const birdClutches = allClutches.filter((cl) => asCouples.some((c) => c.id === cl.coupleId));
    const totalEggs = birdClutches.reduce((s, c) => s + c.totalEggs, 0);
    const totalHatched = birdClutches.reduce((s, c) => s + c.hatchedChicks, 0);
    const fertilized = birdClutches.reduce((s, c) => s + c.fertilizedEggs, 0);
    const birdScores = scoresByBird.get(bird.id) ?? [];
    const bestScore = birdScores.length > 0 ? Math.max(...birdScores) : null;
    const avgScore = birdScores.length > 0 ? birdScores.reduce((a, b) => a + b, 0) / birdScores.length : null;
    const champs = birdScores.length;
    const coi = bird.fatherId && bird.motherId ? calculateCOI(bird.id, birdMap, 5, coiCache) : null;
    const reproScore = totalEggs > 0 ? Math.round(((totalHatched / totalEggs) * 60) + Math.min(birdClutches.length * 5, 40)) : 0;
    const champScore = bestScore !== null ? Math.round((bestScore / 100) * 70 + Math.min(champs * 5, 30)) : 0;
    const lineageScore = Math.round((reproScore * 0.5) + (champScore * 0.5));
    return { birdId: bird.id, ring: bird.ring, displayTitle: bird.displayTitle, sex: bird.sex, modality: bird.modality, breedName: bird.breedName, status: bird.status, coi, coiRisk: coi !== null ? classifyCOIRisk(coi) : null, clutchesCount: birdClutches.length, totalEggs, totalHatched, hatchRate: fertilized > 0 ? Math.round((totalHatched / fertilized) * 100) : null, championships: champs, bestScore, avgScore: avgScore !== null ? Math.round(avgScore * 10) / 10 : null, reproScore, champScore, lineageScore };
  });
  rows.sort((a, b) => b.lineageScore - a.lineageScore);
  return { rows, generatedAt: new Date() };
}),

mapaGenetico: protectedProcedure.query(async ({ ctx }) => {
  const db = await getDb();
  if (!db) return null;
  const tenantId = (ctx.user as any)?.tenantId ?? null;
  const tf = tenantId !== null;
  const [allBirds, allGenotypes, allProfiles] = await Promise.all([
    tf ? db.select().from(birds).where(and(eq(birds.status, "active"), eq(birds.tenantId, tenantId))) : db.select().from(birds).where(eq(birds.status, "active")),
    db.select().from(bird_genotype),
    db.select().from(bird_genetic_profiles),
  ]);
  const genotypeByBird = new Map(allGenotypes.map((g) => [g.birdId, g]));
  const profileByBird = new Map(allProfiles.map((p) => [p.birdId, p]));
  const birdMap = new Map<number, PedigreeBird>(
    allBirds.map((b) => [b.id, { id: b.id, ring: b.ring, specialty_code: b.specialty_code, color_code: b.color_code, sex: b.sex, fatherId: b.fatherId, motherId: b.motherId }])
  );
  const geneCounts: Record<string, number> = {};
  const carrierCounts: Record<string, number> = {};
  let withGenotype = 0, withoutGenotype = 0, withParents = 0, withoutParents = 0, highCoiBirds = 0;
  const coiCache = new Map<number, number>();
  for (const bird of allBirds) {
    const genotype = genotypeByBird.get(bird.id);
    const profile = profileByBird.get(bird.id);
    if (!!genotype || !!profile) withGenotype++; else withoutGenotype++;
    if (bird.fatherId && bird.motherId) withParents++; else withoutParents++;
    const coi = bird.fatherId && bird.motherId ? calculateCOI(bird.id, birdMap, 5, coiCache) : 0;
    if (coi >= 0.125) highCoiBirds++;
    const mutations = (genotype?.mutations as Array<{ mutation: string; zygosity: string }> | null) ?? [];
    for (const m of mutations) {
      if (m.zygosity === "homozygous_mutant") geneCounts[m.mutation] = (geneCounts[m.mutation] ?? 0) + 1;
      else if (m.zygosity === "heterozygous_carrier") carrierCounts[m.mutation] = (carrierCounts[m.mutation] ?? 0) + 1;
    }
  }
  const alerts: string[] = [];
  if (withoutGenotype > allBirds.length * 0.5) alerts.push(`Mais de 50% sem genótipo (${withoutGenotype}/${allBirds.length})`);
  if (withoutParents > allBirds.length * 0.4) alerts.push(`${withoutParents} pássaros sem pai/mãe cadastrados`);
  if (highCoiBirds > 0) alerts.push(`${highCoiBirds} pássaro(s) com COI alto (≥ 12,5%)`);
  return { total: allBirds.length, withGenotype, withoutGenotype, withParents, withoutParents, highCoiBirds, byModality: countBy(allBirds, "modality"), bySpecialty: countBy(allBirds, "specialty_code"), bySex: countBy(allBirds, "sex"), topGenes: Object.entries(geneCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([gene, count]) => ({ gene, count })), topCarriers: Object.entries(carrierCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([gene, count]) => ({ gene, count })), alerts, generatedAt: new Date() };
}),

assistenteCruzamento: protectedProcedure
  .input(z.object({ birdId: z.number().int().positive(), objetivo: z.enum(["seguranca","cor","porte","reduzir_coi","linhagem","portadores","exposicao","livre"]), maxResults: z.number().int().min(3).max(20).default(8) }))
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const [bird] = await db.select().from(birds).where(eq(birds.id, input.birdId)).limit(1);
    if (!bird) return null;
    const oppositeSex = bird.sex === "macho" ? "fêmea" : "macho";
    const allBirdsActive = await db.select().from(birds).where(and(eq(birds.status, "active"), eq(birds.sex, oppositeSex)));
    const allBirdsAll = await db.select().from(birds);
    const birdMapFull = new Map<number, PedigreeBird>(allBirdsAll.map((b) => [b.id, { id: b.id, ring: b.ring, specialty_code: b.specialty_code, color_code: b.color_code, sex: b.sex, fatherId: b.fatherId, motherId: b.motherId }]));
    const allGenotypes = await db.select().from(bird_genotype);
    const genotypeMap = new Map(allGenotypes.map((g) => [g.birdId, g]));
    const baseGenotype = genotypeMap.get(input.birdId);
    const order: Record<string, number> = { ideal: 0, aprovado: 1, atencao: 2, nao_recomendado: 3 };
    const candidates = allBirdsActive.filter((c) => c.id !== input.birdId).map((candidate) => {
      const malId = bird.sex === "macho" ? input.birdId : candidate.id;
      const femId = bird.sex === "fêmea" ? input.birdId : candidate.id;
      const coi = analyzeCoiForPair(malId, femId, birdMapFull, 5);
      const candidateGenotype = genotypeMap.get(candidate.id);
      const alerts: string[] = [];
      if (baseGenotype?.hasCrest && candidateGenotype?.hasCrest) alerts.push("RISCO LETAL: crista × crista");
      const baseMuts = (baseGenotype?.mutations as Array<{mutation:string;zygosity:string}>|null) ?? [];
      const candMuts = (candidateGenotype?.mutations as Array<{mutation:string;zygosity:string}>|null) ?? [];
      const baseBD = baseMuts.find((m) => m.mutation === "branco_dominante" && m.zygosity !== "homozygous_normal");
      const candBD = candMuts.find((m) => m.mutation === "branco_dominante" && m.zygosity !== "homozygous_normal");
      if (baseBD && candBD) alerts.push("RISCO LETAL: branco dominante × branco dominante");
      let score = 60;
      const coiPctNum = coi.coi * 100;
      if (["reduzir_coi","seguranca"].includes(input.objetivo)) score += coiPctNum < 3 ? 40 : coiPctNum < 6.25 ? 25 : coiPctNum < 12.5 ? 10 : 0;
      else if (input.objetivo === "cor") { score += candidate.modality === bird.modality ? 30 : 10; score += coiPctNum < 6.25 ? 10 : 0; }
      else if (input.objetivo === "exposicao") { score += candidate.breedName === bird.breedName ? 25 : 5; score += coiPctNum < 6.25 ? 15 : 0; }
      else score += coiPctNum < 6.25 ? 20 : coiPctNum < 12.5 ? 10 : 0;
      if (alerts.some((a) => a.includes("RISCO LETAL"))) score = Math.max(score - 60, 0);
      const status = alerts.some((a) => a.includes("RISCO LETAL")) ? "nao_recomendado" : coi.risk === "very_high" || coi.risk === "high" ? "atencao" : score >= 80 ? "ideal" : score >= 60 ? "aprovado" : "atencao";
      const motivo = status === "nao_recomendado" ? alerts.join(". ") : status === "ideal" ? `Excelente para "${input.objetivo}". COI ${coi.coiPct}, sem riscos letais.` : status === "aprovado" ? `Combinação segura. ${coi.hasCommonAncestors ? `COI ${coi.coiPct}.` : "Sem ancestrais em comum."}` : `Possível com atenção ao COI ${coi.coiPct}.`;
      return { candidate, coi: coi.coi, coiPct: coi.coiPct, coiRisk: coi.risk, alerts, score, status, motivo };
    });
    candidates.sort((a, b) => (order[a.status] - order[b.status]) || (b.score - a.score));
    return { baseBird: { id: bird.id, ring: bird.ring, displayTitle: bird.displayTitle, sex: bird.sex }, objetivo: input.objetivo, candidates: candidates.slice(0, input.maxResults).map((c) => ({ birdId: c.candidate.id, ring: c.candidate.ring, displayTitle: c.candidate.displayTitle, breedName: c.candidate.breedName, modality: c.candidate.modality, coi: c.coi, coiPct: c.coiPct, coiRisk: c.coiRisk, score: c.score, status: c.status, motivo: c.motivo, alerts: c.alerts })), generatedAt: new Date() };
  }),


});
