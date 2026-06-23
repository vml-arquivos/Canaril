/**
 * adminReset.ts — Router para Zona de Segurança / Reset do Canaril (Missão 7)
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getPool } from "../db";
import {
  scanOperationalCounts,
  scanOrphans,
  getRingBatchDependencies,
} from "../_core/adminReset/dependencyScanner";
import {
  executeOperationalReset,
  executeTestCleanup,
  forceDeleteRingBatch,
  reconcileRings,
  deleteAnalyses,
  fixOrphans,
} from "../_core/adminReset/resetExecutor";
import { ring_batches, rings, birds } from "../../drizzle/schema";
import { eq, ilike, desc } from "drizzle-orm";
import { audit_logs } from "../../drizzle/schema";

function getUserId(ctx: any): number {
  return (ctx as any)?.userId ?? 0;
}

export const adminResetRouter = router({

  // ─── Preview reset total operacional ─────────────────────────────────────
  previewOperationalReset: protectedProcedure.query(async () => {
    const pool = getPool();
    if (!pool) return null;
    return scanOperationalCounts(pool);
  }),

  // ─── Executar reset total operacional ────────────────────────────────────
  executeOperationalReset: protectedProcedure
    .input(z.object({
      confirm: z.literal("RESETAR CANARIL"),
      agreedToTerms: z.boolean().refine((v) => v === true, "Você deve marcar a confirmação."),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      if (!pool) throw new Error("Pool não disponível.");
      return executeOperationalReset(pool, getUserId(ctx), input.reason ?? "Reset total operacional");
    }),

  // ─── Preview limpeza por prefixo ─────────────────────────────────────────
  previewTestCleanup: protectedProcedure
    .input(z.object({ prefix: z.string().min(2).max(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      const pool = getPool();
      if (!db || !pool) return null;

      const pat = `${input.prefix}%`;
      const [birdRows, ringRows, batchRows, cageRows, champRows] = await Promise.all([
        db.select({ id: birds.id }).from(birds).where(ilike(birds.ring, pat)),
        db.select({ id: rings.id }).from(rings).where(ilike(rings.number, pat)),
        db.select({ id: ring_batches.id }).from(ring_batches).where(ilike(ring_batches.batch_number, pat)),
        pool.query(`SELECT id FROM cages WHERE code ILIKE $1`, [pat]).then((r) => r.rows).catch(() => []),
        pool.query(`SELECT id FROM championships WHERE name ILIKE $1`, [pat]).then((r) => r.rows).catch(() => []),
      ]);

      // Count couples derived from test birds
      const birdIds = birdRows.map((b) => b.id);
      let couples = 0, clutches = 0, analyses = 0;
      if (birdIds.length > 0) {
        const idList = birdIds.join(",");
        const [cR, clR, aR] = await Promise.all([
          pool.query(`SELECT COUNT(*) FROM couples WHERE "maleId" IN (${idList}) OR "femaleId" IN (${idList})`).catch(() => ({ rows: [{ count: "0" }] })),
          pool.query(`SELECT COUNT(*) FROM clutches cl JOIN couples cp ON cl."coupleId"=cp.id WHERE cp."maleId" IN (${idList}) OR cp."femaleId" IN (${idList})`).catch(() => ({ rows: [{ count: "0" }] })),
          pool.query(`SELECT COUNT(*) FROM ai_judge_analyses WHERE "birdId" IN (${idList})`).catch(() => ({ rows: [{ count: "0" }] })),
        ]);
        couples = parseInt(cR.rows[0].count, 10);
        clutches = parseInt(clR.rows[0].count, 10);
        analyses = parseInt(aR.rows[0].count, 10);
      }

      return {
        prefix: input.prefix,
        birds: birdRows.length,
        rings: ringRows.length,
        ringBatches: batchRows.length,
        cages: cageRows.length,
        championships: champRows.length,
        couples,
        clutches,
        analyses,
        total: birdRows.length + ringRows.length + batchRows.length + cageRows.length + champRows.length + couples + clutches,
      };
    }),

  // ─── Executar limpeza de testes ───────────────────────────────────────────
  executeTestCleanup: protectedProcedure
    .input(z.object({
      prefix: z.string().min(2).max(50),
      confirm: z.literal("LIMPAR TESTES"),
      hardDelete: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      if (!pool) throw new Error("Pool não disponível.");
      return executeTestCleanup(pool, input.prefix, getUserId(ctx), input.hardDelete);
    }),

  // ─── Dependências de um lote de anilhas ──────────────────────────────────
  scanRingBatchDependencies: protectedProcedure
    .input(z.object({ batchId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const pool = getPool();
      if (!pool) return null;
      return getRingBatchDependencies(pool, input.batchId);
    }),

  // ─── Forçar exclusão de lote com anilhas em uso ───────────────────────────
  forceDeleteRingBatch: protectedProcedure
    .input(z.object({
      batchId: z.number().int().positive(),
      mode: z.enum(["archive", "free_rings", "delete_all"]),
      confirm: z.literal("EXCLUIR LOTE"),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      if (!pool) throw new Error("Pool não disponível.");
      return forceDeleteRingBatch(pool, input.batchId, getUserId(ctx), input.mode);
    }),

  // ─── Reconciliar anilhas órfãs ────────────────────────────────────────────
  reconcileRings: protectedProcedure
    .mutation(async ({ ctx }) => {
      const pool = getPool();
      if (!pool) throw new Error("Pool não disponível.");
      return reconcileRings(pool, getUserId(ctx));
    }),

  // ─── Listar contagens de análises ─────────────────────────────────────────
  listAnalyses: protectedProcedure.query(async () => {
    const pool = getPool();
    if (!pool) return null;
    const tables = ["ai_judge_analyses", "bird_photo_analyses", "bird_genetic_inference_logs"];
    const counts: Record<string, number> = {};
    for (const t of tables) {
      try {
        const { rows } = await pool.query<{ count: string }>(`SELECT COUNT(*) FROM "${t}"`);
        counts[t] = parseInt(rows[0]?.count ?? "0", 10);
      } catch { counts[t] = 0; }
    }
    return counts;
  }),

  // ─── Deletar análises ─────────────────────────────────────────────────────
  deleteAnalyses: protectedProcedure
    .input(z.object({
      types: z.array(z.enum(["ai_judge", "photo", "genetic_inference", "all"])),
      confirm: z.literal("EXCLUIR ANÁLISES"),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      if (!pool) throw new Error("Pool não disponível.");
      return deleteAnalyses(pool, input.types, getUserId(ctx));
    }),

  // ─── Escanear órfãos ──────────────────────────────────────────────────────
  scanOrphans: protectedProcedure.query(async () => {
    const pool = getPool();
    if (!pool) return [];
    return scanOrphans(pool);
  }),

  // ─── Corrigir órfãos ──────────────────────────────────────────────────────
  fixOrphans: protectedProcedure
    .input(z.object({
      tables: z.array(z.string()),
      confirm: z.literal("CORRIGIR ORPHANS"),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      if (!pool) throw new Error("Pool não disponível.");
      return fixOrphans(pool, input.tables, getUserId(ctx));
    }),

  // ─── Logs de auditoria de reset ───────────────────────────────────────────
  getResetAuditLogs: protectedProcedure
    .input(z.object({ limit: z.number().int().max(100).default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(audit_logs)
        .where(eq(audit_logs.action, "execute_reset"))
        .orderBy(desc(audit_logs.createdAt))
        .limit(input.limit);
    }),
});
