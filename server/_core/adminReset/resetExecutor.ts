/**
 * resetExecutor.ts — Executa reset/limpeza em transação
 *
 * Todas as operações são transacionais.
 * Erro no meio = rollback total.
 * Cada execução registra audit log.
 */
import type { Pool } from "pg";

export interface ResetSummary {
  tablesAffected: string[];
  rowsDeleted: Record<string, number>;
  totalRows: number;
  durationMs: number;
}

// Safe delete — returns 0 if table doesn't exist, never throws
async function safeDelete(client: any, table: string, where = "1=1"): Promise<number> {
  try {
    const { rowCount } = await client.query(`DELETE FROM "${table}" WHERE ${where}`);
    return rowCount ?? 0;
  } catch {
    return 0;
  }
}

// Soft delete — sets deletedAt
async function softDelete(client: any, table: string, where = "1=1"): Promise<number> {
  try {
    const { rowCount } = await client.query(
      `UPDATE "${table}" SET "deletedAt" = NOW() WHERE ${where} AND ("deletedAt" IS NULL)`
    );
    return rowCount ?? 0;
  } catch {
    return 0;
  }
}

/**
 * executeOperationalReset — Remove todos os dados operacionais
 * Preserva: users, tenants, breeder_settings, official_bird_classes,
 *            seeds de conhecimento, regras genéticas, audit_logs
 */
export async function executeOperationalReset(
  pool: Pool,
  userId: number,
  reason = "Operational Reset"
): Promise<ResetSummary> {
  const start = Date.now();
  const client = await pool.connect();
  const rowsDeleted: Record<string, number> = {};

  try {
    await client.query("BEGIN");

    // 1. Análises e logs de IA (sem dependências externas)
    rowsDeleted["scores"] = await safeDelete(client, "scores");
    rowsDeleted["ai_judge_analyses"] = await safeDelete(client, "ai_judge_analyses");
    rowsDeleted["bird_photo_analyses"] = await safeDelete(client, "bird_photo_analyses");
    rowsDeleted["bird_genetic_inference_logs"] = await safeDelete(client, "bird_genetic_inference_logs");

    // 2. Rotina diária e lembretes
    rowsDeleted["breeding_daily_logs"] = await safeDelete(client, "breeding_daily_logs");
    rowsDeleted["breeding_reminders"] = await safeDelete(client, "breeding_reminders");

    // 3. Saúde e nutrição
    rowsDeleted["health_records"] = await safeDelete(client, "health_records");

    // 4. Campeonatos
    rowsDeleted["championship_entries"] = await safeDelete(client, "championship_entries");
    rowsDeleted["championships"] = await safeDelete(client, "championships");

    // 5. Genética dos pássaros
    rowsDeleted["bird_genotype"] = await safeDelete(client, "bird_genotype");
    rowsDeleted["bird_genetic_profiles"] = await safeDelete(client, "bird_genetic_profiles");

    // 6. Fotos
    rowsDeleted["photos"] = await safeDelete(client, "photos");

    // 7. Filhotes → posturas → casais
    rowsDeleted["chicks"] = await safeDelete(client, "chicks");
    rowsDeleted["clutches"] = await safeDelete(client, "clutches");
    rowsDeleted["couples"] = await safeDelete(client, "couples");

    // 8. Pássaros
    rowsDeleted["birds"] = await safeDelete(client, "birds");

    // 9. Anilhas → lotes
    rowsDeleted["rings"] = await safeDelete(client, "rings");
    rowsDeleted["ring_batches"] = await safeDelete(client, "ring_batches");

    // 10. Gaiolas e sensores
    rowsDeleted["cage_sensor_readings"] = await safeDelete(client, "cage_sensor_readings");
    rowsDeleted["cages"] = await safeDelete(client, "cages");

    // 11. Audit log da própria ação (registrar ANTES do commit)
    await client.query(
      `INSERT INTO audit_logs ("userId","action","entityType","reason","newValueJson")
       VALUES ($1, 'execute_reset', 'operational', $2, $3)`,
      [userId, reason, JSON.stringify({ rowsDeleted, totalRows: Object.values(rowsDeleted).reduce((a, b) => a + b, 0) })]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const totalRows = Object.values(rowsDeleted).reduce((a, b) => a + b, 0);
  return {
    tablesAffected: Object.keys(rowsDeleted).filter((k) => rowsDeleted[k] > 0),
    rowsDeleted,
    totalRows,
    durationMs: Date.now() - start,
  };
}

/**
 * executeTestCleanup — Remove dados cujo nome/anilha começa com prefixo
 */
export async function executeTestCleanup(
  pool: Pool,
  prefix: string,
  userId: number,
  hardDelete = false
): Promise<ResetSummary> {
  const start = Date.now();
  const client = await pool.connect();
  const rowsDeleted: Record<string, number> = {};
  const pat = `${prefix}%`;

  try {
    await client.query("BEGIN");

    if (hardDelete) {
      // Get bird IDs with matching ring
      const { rows: testBirds } = await client.query<{ id: number }>(
        `SELECT id FROM birds WHERE ring ILIKE $1`, [pat]
      );
      const birdIds = testBirds.map((b) => b.id);

      if (birdIds.length > 0) {
        const idList = birdIds.join(",");
        rowsDeleted["ai_judge_analyses"]          = await safeDelete(client, "ai_judge_analyses",          `"birdId" IN (${idList})`);
        rowsDeleted["bird_photo_analyses"]         = await safeDelete(client, "bird_photo_analyses",        `"birdId" IN (${idList})`);
        rowsDeleted["bird_genetic_inference_logs"] = await safeDelete(client, "bird_genetic_inference_logs",`"birdId" IN (${idList})`);
        rowsDeleted["bird_genotype"]               = await safeDelete(client, "bird_genotype",              `"birdId" IN (${idList})`);
        rowsDeleted["bird_genetic_profiles"]        = await safeDelete(client, "bird_genetic_profiles",     `"birdId" IN (${idList})`);
        rowsDeleted["health_records"]               = await safeDelete(client, "health_records",            `"birdId" IN (${idList})`);
        rowsDeleted["photos"]                       = await safeDelete(client, "photos",                    `"entityType"='bird' AND "entityId" IN (${idList})`);

        // couples and their descendants
        const { rows: testCouples } = await client.query<{ id: number }>(
          `SELECT id FROM couples WHERE "maleId" IN (${idList}) OR "femaleId" IN (${idList})`
        );
        if (testCouples.length > 0) {
          const coupleIds = testCouples.map((c) => c.id).join(",");
          const { rows: testClutches } = await client.query<{ id: number }>(
            `SELECT id FROM clutches WHERE "coupleId" IN (${coupleIds})`
          );
          if (testClutches.length > 0) {
            const clutchIds = testClutches.map((c) => c.id).join(",");
            rowsDeleted["breeding_daily_logs"] = await safeDelete(client, "breeding_daily_logs", `"clutchId" IN (${clutchIds})`);
            rowsDeleted["chicks"]              = await safeDelete(client, "chicks",              `"clutchId" IN (${clutchIds})`);
            rowsDeleted["clutches"]            = await safeDelete(client, "clutches",            `id IN (${clutchIds})`);
          }
          rowsDeleted["breeding_daily_logs"] = (rowsDeleted["breeding_daily_logs"] ?? 0) +
            await safeDelete(client, "breeding_daily_logs", `"coupleId" IN (${coupleIds})`);
          rowsDeleted["couples"] = await safeDelete(client, "couples", `id IN (${coupleIds})`);
        }

        rowsDeleted["birds"] = await safeDelete(client, "birds", `id IN (${idList})`);
      }

      // Rings and batches with prefix
      rowsDeleted["rings"]        = await safeDelete(client, "rings",       `"number" ILIKE $1`, );
      rowsDeleted["ring_batches"] = await safeDelete(client, "ring_batches",`batch_number ILIKE $1`);
      // Cages with prefix
      rowsDeleted["cages"]        = await safeDelete(client, "cages",       `code ILIKE $1`);

      // championships with prefix
      rowsDeleted["championships"] = await safeDelete(client, "championships", `name ILIKE $1`);

    } else {
      // Soft delete: just set deletedAt
      rowsDeleted["birds"]         = await softDelete(client, "birds",        `ring ILIKE '${pat}'`);
      rowsDeleted["ring_batches"]  = await softDelete(client, "ring_batches", `batch_number ILIKE '${pat}'`);
      rowsDeleted["cages"]         = await softDelete(client, "cages",        `code ILIKE '${pat}'`);
      rowsDeleted["championships"] = await softDelete(client, "championships",`name ILIKE '${pat}'`);
    }

    await client.query(
      `INSERT INTO audit_logs ("userId","action","entityType","reason","newValueJson")
       VALUES ($1, 'cleanup_test_data', 'test_data', $2, $3)`,
      [userId, `Prefix: ${prefix}, hard: ${hardDelete}`, JSON.stringify(rowsDeleted)]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const totalRows = Object.values(rowsDeleted).reduce((a, b) => a + b, 0);
  return { tablesAffected: Object.keys(rowsDeleted).filter((k) => rowsDeleted[k] > 0), rowsDeleted, totalRows, durationMs: Date.now() - start };
}

/**
 * forceDeleteRingBatch — Exclui lote mesmo com anilhas em uso
 * Opções: liberar (set status=available), ou deletar tudo em cascata
 */
export async function forceDeleteRingBatch(
  pool: Pool,
  batchId: number,
  userId: number,
  mode: "archive" | "free_rings" | "delete_all"
): Promise<ResetSummary> {
  const start = Date.now();
  const client = await pool.connect();
  const rowsDeleted: Record<string, number> = {};

  try {
    await client.query("BEGIN");

    if (mode === "archive") {
      // Just soft-delete the batch
      await client.query(`UPDATE ring_batches SET "deletedAt" = NOW() WHERE id = $1`, [batchId]);
      rowsDeleted["ring_batches"] = 1;
    } else if (mode === "free_rings") {
      // Set all rings to available, clear birdId link
      const { rowCount } = await client.query(
        `UPDATE rings SET status = 'available', "birdId" = NULL, "chickId" = NULL, "usedAt" = NULL WHERE "batchId" = $1`,
        [batchId]
      );
      rowsDeleted["rings_freed"] = rowCount ?? 0;
      // Now delete the batch
      await client.query(`DELETE FROM ring_batches WHERE id = $1`, [batchId]);
      rowsDeleted["ring_batches"] = 1;
      await client.query(`DELETE FROM rings WHERE "batchId" = $1`, [batchId]);
      rowsDeleted["rings"] = rowsDeleted["rings_freed"];
    } else {
      // delete_all: delete genotype/profiles for birds using these rings, then birds, then rings, then batch
      const { rows: batchRings } = await client.query<{ birdId: number | null }>(
        `SELECT "birdId" FROM rings WHERE "batchId" = $1 AND "birdId" IS NOT NULL`, [batchId]
      );
      const birdIds = batchRings.map((r) => r.birdId).filter((id): id is number => id !== null);

      if (birdIds.length > 0) {
        const idList = birdIds.join(",");
        await safeDelete(client, "bird_genotype",               `"birdId" IN (${idList})`);
        await safeDelete(client, "bird_genetic_profiles",       `"birdId" IN (${idList})`);
        await safeDelete(client, "bird_photo_analyses",         `"birdId" IN (${idList})`);
        await safeDelete(client, "ai_judge_analyses",           `"birdId" IN (${idList})`);
        await safeDelete(client, "bird_genetic_inference_logs", `"birdId" IN (${idList})`);
        await safeDelete(client, "health_records",              `"birdId" IN (${idList})`);
        rowsDeleted["birds"] = await safeDelete(client, "birds", `id IN (${idList})`);
      }
      rowsDeleted["rings"]        = await safeDelete(client, "rings",        `"batchId" = ${batchId}`);
      rowsDeleted["ring_batches"] = await safeDelete(client, "ring_batches", `id = ${batchId}`);
    }

    await client.query(
      `INSERT INTO audit_logs ("userId","action","entityType","entityId","reason")
       VALUES ($1,'delete_ring_batch','ring_batch',$2,$3)`,
      [userId, batchId, `mode=${mode}`]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const totalRows = Object.values(rowsDeleted).reduce((a, b) => a + b, 0);
  return { tablesAffected: Object.keys(rowsDeleted), rowsDeleted, totalRows, durationMs: Date.now() - start };
}

/**
 * reconcileRings — Corrige anilhas "em uso" sem pássaro ativo
 */
export async function reconcileRings(pool: Pool, userId: number): Promise<{ fixed: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rowCount } = await client.query(`
      UPDATE rings
      SET status = 'available', "birdId" = NULL, "chickId" = NULL, "usedAt" = NULL
      WHERE status = 'in_use'
        AND "birdId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM birds b WHERE b.id = rings."birdId")
    `);

    await client.query(
      `INSERT INTO audit_logs ("userId","action","entityType","reason")
       VALUES ($1,'fix_orphan_data','rings','reconcile_orphan_rings')`,
      [userId]
    );

    await client.query("COMMIT");
    return { fixed: rowCount ?? 0 };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * deleteAnalyses — Remove análises de IA/foto/genética
 */
export async function deleteAnalyses(
  pool: Pool,
  types: Array<"ai_judge" | "photo" | "genetic_inference" | "all">,
  userId: number
): Promise<ResetSummary> {
  const start = Date.now();
  const client = await pool.connect();
  const rowsDeleted: Record<string, number> = {};
  const doAll = types.includes("all");

  try {
    await client.query("BEGIN");

    if (doAll || types.includes("ai_judge")) {
      rowsDeleted["ai_judge_analyses"] = await safeDelete(client, "ai_judge_analyses");
    }
    if (doAll || types.includes("photo")) {
      rowsDeleted["bird_photo_analyses"] = await safeDelete(client, "bird_photo_analyses");
    }
    if (doAll || types.includes("genetic_inference")) {
      rowsDeleted["bird_genetic_inference_logs"] = await safeDelete(client, "bird_genetic_inference_logs");
    }

    await client.query(
      `INSERT INTO audit_logs ("userId","action","entityType","reason")
       VALUES ($1,'delete_analysis','analyses',$2)`,
      [userId, `types: ${types.join(",")}`]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const totalRows = Object.values(rowsDeleted).reduce((a, b) => a + b, 0);
  return { tablesAffected: Object.keys(rowsDeleted), rowsDeleted, totalRows, durationMs: Date.now() - start };
}

/**
 * fixOrphans — Corrige registros órfãos automaticamente
 */
export async function fixOrphans(
  pool: Pool,
  tables: string[],
  userId: number
): Promise<{ fixed: number; details: Record<string, number> }> {
  const client = await pool.connect();
  const details: Record<string, number> = {};
  let total = 0;

  try {
    await client.query("BEGIN");

    // Fix orphan rings
    if (tables.includes("rings")) {
      const { rowCount } = await client.query(`
        UPDATE rings SET status='available',"birdId"=NULL,"chickId"=NULL,"usedAt"=NULL
        WHERE status='in_use' AND "birdId" IS NOT NULL
          AND NOT EXISTS(SELECT 1 FROM birds b WHERE b.id=rings."birdId")
      `);
      details["rings"] = rowCount ?? 0;
      total += details["rings"];
    }

    // Delete orphan photos
    if (tables.includes("photos")) {
      const { rowCount } = await client.query(`
        DELETE FROM photos WHERE "entityType"='bird'
          AND NOT EXISTS(SELECT 1 FROM birds b WHERE b.id=photos."entityId")
      `);
      details["photos"] = rowCount ?? 0;
      total += details["photos"];
    }

    // Delete orphan bird_genotype
    if (tables.includes("bird_genotype")) {
      const { rowCount } = await client.query(`
        DELETE FROM bird_genotype WHERE NOT EXISTS(SELECT 1 FROM birds b WHERE b.id=bird_genotype."birdId")
      `);
      details["bird_genotype"] = rowCount ?? 0;
      total += details["bird_genotype"];
    }

    // Delete orphan bird_genetic_profiles
    if (tables.includes("bird_genetic_profiles")) {
      const { rowCount } = await client.query(`
        DELETE FROM bird_genetic_profiles WHERE NOT EXISTS(SELECT 1 FROM birds b WHERE b.id=bird_genetic_profiles."birdId")
      `);
      details["bird_genetic_profiles"] = rowCount ?? 0;
      total += details["bird_genetic_profiles"];
    }

    // Delete orphan ai_judge_analyses
    if (tables.includes("ai_judge_analyses")) {
      const { rowCount } = await client.query(`
        DELETE FROM ai_judge_analyses WHERE "birdId" IS NOT NULL
          AND NOT EXISTS(SELECT 1 FROM birds b WHERE b.id=ai_judge_analyses."birdId")
      `);
      details["ai_judge_analyses"] = rowCount ?? 0;
      total += details["ai_judge_analyses"];
    }

    await client.query(
      `INSERT INTO audit_logs ("userId","action","entityType","reason","newValueJson")
       VALUES ($1,'fix_orphan_data','multiple',$2,$3)`,
      [userId, `tables: ${tables.join(",")}`, JSON.stringify(details)]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { fixed: total, details };
}
