/**
 * dependencyScanner.ts — Escaneia dependências antes de reset/exclusão
 *
 * Lê o banco diretamente para contar registros por tabela,
 * identificar órfãos e mapear o que será afetado.
 */
import type { Pool } from "pg";

export interface ModuleCounts {
  birds: number;
  rings: number;
  ringBatches: number;
  couples: number;
  clutches: number;
  chicks: number;
  cages: number;
  championships: number;
  championshipEntries: number;
  scores: number;
  photos: number;
  birdGenotype: number;
  birdGeneticProfiles: number;
  birdPhotoAnalyses: number;
  aiJudgeAnalyses: number;
  birdGeneticInferenceLogs: number;
  healthRecords: number;
  breedingDailyLogs: number;
  breedingReminders: number;
  // Preserved (not in reset)
  users: number;
  tenants: number;
  officialBirdClasses: number;
}

export interface OrphanRecord {
  table: string;
  id: number;
  description: string;
  issue: string;
  canAutoFix: boolean;
}

// Safe count — returns 0 if table doesn't exist
async function safeCount(pool: Pool, table: string, where = ""): Promise<number> {
  try {
    const q = `SELECT COUNT(*) FROM "${table}"${where ? ` WHERE ${where}` : ""}`;
    const { rows } = await pool.query<{ count: string }>(q);
    return parseInt(rows[0]?.count ?? "0", 10);
  } catch {
    return 0;
  }
}

export async function scanOperationalCounts(pool: Pool): Promise<ModuleCounts> {
  const [
    birds, rings, ringBatches, couples, clutches, chicks,
    cages, championships, championshipEntries, scores, photos,
    birdGenotype, birdGeneticProfiles, birdPhotoAnalyses,
    aiJudgeAnalyses, birdGeneticInferenceLogs, healthRecords,
    breedingDailyLogs, breedingReminders,
    users, tenants, officialBirdClasses,
  ] = await Promise.all([
    safeCount(pool, "birds"),
    safeCount(pool, "rings"),
    safeCount(pool, "ring_batches"),
    safeCount(pool, "couples"),
    safeCount(pool, "clutches"),
    safeCount(pool, "chicks"),
    safeCount(pool, "cages"),
    safeCount(pool, "championships"),
    safeCount(pool, "championship_entries"),
    safeCount(pool, "scores"),
    safeCount(pool, "photos"),
    safeCount(pool, "bird_genotype"),
    safeCount(pool, "bird_genetic_profiles"),
    safeCount(pool, "bird_photo_analyses"),
    safeCount(pool, "ai_judge_analyses"),
    safeCount(pool, "bird_genetic_inference_logs"),
    safeCount(pool, "health_records"),
    safeCount(pool, "breeding_daily_logs"),
    safeCount(pool, "breeding_reminders"),
    safeCount(pool, "users"),
    safeCount(pool, "tenants"),
    safeCount(pool, "official_bird_classes"),
  ]);

  return {
    birds, rings, ringBatches, couples, clutches, chicks,
    cages, championships, championshipEntries, scores, photos,
    birdGenotype, birdGeneticProfiles, birdPhotoAnalyses,
    aiJudgeAnalyses, birdGeneticInferenceLogs, healthRecords,
    breedingDailyLogs, breedingReminders,
    users, tenants, officialBirdClasses,
  };
}

export async function scanOrphans(pool: Pool): Promise<OrphanRecord[]> {
  const orphans: OrphanRecord[] = [];

  // Rings marked as in_use but bird was deleted
  const { rows: orphanRings } = await pool.query<{ id: number; number: string; birdId: number }>(`
    SELECT r.id, r."number", r."birdId"
    FROM rings r
    WHERE r.status = 'in_use'
      AND r."birdId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM birds b WHERE b.id = r."birdId")
  `).catch(() => ({ rows: [] }));

  for (const r of orphanRings) {
    orphans.push({
      table: "rings",
      id: r.id,
      description: `Anilha ${r.number} marcada como "em uso" mas pássaro #${r.birdId} não existe`,
      issue: "ring_no_bird",
      canAutoFix: true,
    });
  }

  // Clutches with no couple
  const { rows: orphanClutches } = await pool.query<{ id: number; coupleId: number }>(`
    SELECT cl.id, cl."coupleId"
    FROM clutches cl
    WHERE NOT EXISTS (SELECT 1 FROM couples c WHERE c.id = cl."coupleId")
  `).catch(() => ({ rows: [] }));
  for (const c of orphanClutches) {
    orphans.push({ table: "clutches", id: c.id, description: `Postura #${c.id} sem casal correspondente (#${c.coupleId})`, issue: "clutch_no_couple", canAutoFix: false });
  }

  // Chicks with no clutch
  const { rows: orphanChicks } = await pool.query<{ id: number; clutchId: number }>(`
    SELECT ch.id, ch."clutchId"
    FROM chicks ch
    WHERE NOT EXISTS (SELECT 1 FROM clutches cl WHERE cl.id = ch."clutchId")
  `).catch(() => ({ rows: [] }));
  for (const c of orphanChicks) {
    orphans.push({ table: "chicks", id: c.id, description: `Filhote #${c.id} sem postura correspondente (#${c.clutchId})`, issue: "chick_no_clutch", canAutoFix: false });
  }

  // Photos with no bird
  const { rows: orphanPhotos } = await pool.query<{ id: number; entityId: number }>(`
    SELECT p.id, p."entityId"
    FROM photos p
    WHERE p."entityType" = 'bird'
      AND NOT EXISTS (SELECT 1 FROM birds b WHERE b.id = p."entityId")
  `).catch(() => ({ rows: [] }));
  for (const p of orphanPhotos) {
    orphans.push({ table: "photos", id: p.id, description: `Foto #${p.id} sem pássaro correspondente (#${p.entityId})`, issue: "photo_no_bird", canAutoFix: true });
  }

  // bird_genotype with no bird
  const { rows: orphanGeno } = await pool.query<{ id: number; birdId: number }>(`
    SELECT g.id, g."birdId"
    FROM bird_genotype g
    WHERE NOT EXISTS (SELECT 1 FROM birds b WHERE b.id = g."birdId")
  `).catch(() => ({ rows: [] }));
  for (const g of orphanGeno) {
    orphans.push({ table: "bird_genotype", id: g.id, description: `Genótipo #${g.id} sem pássaro correspondente (#${g.birdId})`, issue: "genotype_no_bird", canAutoFix: true });
  }

  // bird_genetic_profiles with no bird
  const { rows: orphanProfiles } = await pool.query<{ id: number; birdId: number }>(`
    SELECT p.id, p."birdId"
    FROM bird_genetic_profiles p
    WHERE NOT EXISTS (SELECT 1 FROM birds b WHERE b.id = p."birdId")
  `).catch(() => ({ rows: [] }));
  for (const p of orphanProfiles) {
    orphans.push({ table: "bird_genetic_profiles", id: p.id, description: `Perfil genético #${p.id} sem pássaro correspondente (#${p.birdId})`, issue: "profile_no_bird", canAutoFix: true });
  }

  // ai_judge_analyses with no bird
  const { rows: orphanJudge } = await pool.query<{ id: number; birdId: number }>(`
    SELECT a.id, a."birdId"
    FROM ai_judge_analyses a
    WHERE a."birdId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM birds b WHERE b.id = a."birdId")
  `).catch(() => ({ rows: [] }));
  for (const a of orphanJudge) {
    orphans.push({ table: "ai_judge_analyses", id: a.id, description: `Análise de juiz #${a.id} sem pássaro correspondente (#${a.birdId})`, issue: "analysis_no_bird", canAutoFix: true });
  }

  return orphans;
}

export async function getRingBatchDependencies(pool: Pool, batchId: number): Promise<{
  total: number;
  available: number;
  inUse: number;
  inUseNumbers: string[];
  birdIds: number[];
}> {
  const { rows } = await pool.query<{ id: number; number: string; status: string; birdId: number | null }>(`
    SELECT id, "number", status, "birdId"
    FROM rings
    WHERE "batchId" = $1
  `, [batchId]).catch(() => ({ rows: [] }));

  const total = rows.length;
  const inUseRows = rows.filter((r) => r.status === "in_use" || r.status === "USED");
  const available = rows.filter((r) => r.status === "available" || r.status === "AVAILABLE").length;
  const inUse = inUseRows.length;
  const inUseNumbers = inUseRows.map((r) => r.number);
  const birdIds = inUseRows.map((r) => r.birdId).filter((id): id is number => id !== null);

  return { total, available, inUse, inUseNumbers, birdIds };
}
