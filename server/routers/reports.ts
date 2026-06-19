import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { birds, couples, clutches, rings, championships, championship_entries, scores } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";

function countBy<T extends Record<string, any>>(rows: T[], key: keyof T): Record<string, number> {
  return rows.reduce((acc, row) => {
    const k = String(row[key] ?? "—");
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

export const reportsRouter = router({
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
});
