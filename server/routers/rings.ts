/**
 * rings.ts — Router dedicado ao sistema profissional de anilhas
 *
 * Endpoints:
 *   batches.list          — lista todos os lotes
 *   batches.create        — cria lote e gera anilhas individuais
 *   batches.update        — atualiza metadados do lote
 *   batches.delete        — remove lote (só se não houver anilhas em uso)
 *   batches.getById       — detalhe de um lote
 *   rings.listByBatch     — lista anilhas de um lote
 *   rings.getNext         — próxima anilha disponível (sugestão)
 *   rings.assign          — aloca anilha para pássaro (transacional)
 *   rings.release         — libera anilha de um pássaro
 *   rings.createManual    — cria anilha manual (sem lote automático)
 *   gaugeRules.list       — lista regras de bitola
 *   gaugeRules.suggest    — sugere bitola para espécie/raça
 *   stats                 — estatísticas gerais de anilhas
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getPool } from "../db";
import {
  ring_batches,
  rings,
  ring_gauge_rules,
} from "../../drizzle/schema";
import { and, eq, desc, asc, isNull, or, ilike, sql } from "drizzle-orm";
import {
  getNextAvailableRing,
  assignRingToBird,
  releaseRingFromBird,
  generateRingsForBatch,
  createManualRing,
} from "../_core/ringAllocator";
import { generateRingCode, parseRingCode } from "../_core/ringParser";
import { TRPCError } from "@trpc/server";

// ─── Schema Zod para criação de lote ────────────────────────────────────────
const createBatchSchema = z.object({
  batch_number:    z.string().min(1).max(50),
  year:            z.number().int().min(2000).max(2100),
  color:           z.string().min(1).max(50),
  startNumber:     z.number().int().min(1).default(1),
  endNumber:       z.number().int().min(1).max(10000).default(200),
  breederCode:     z.string().max(50).optional(),
  associationName: z.string().max(100).optional(),
  speciesName:     z.string().max(50).optional(),
  breedName:       z.string().max(100).optional(),
  modality:        z.enum(["COR", "PORTE", "CANTO", "OUTRA"]).optional(),
  ringGaugeMm:     z.number().min(1).max(10).optional(),
  month:           z.number().int().min(1).max(12).optional(),
  prefix:          z.string().max(20).optional(),
  suffix:          z.string().max(20).optional(),
  formatPattern:   z.string().max(100).default("{breederCode}-{year}-{seq}"),
  notes:           z.string().max(500).optional(),
});

// ─── Router ─────────────────────────────────────────────────────────────────
export const ringsRouter = router({

  // ── Lotes ─────────────────────────────────────────────────────────────────
  batches: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      try {
        return await db
          .select()
          .from(ring_batches)
          .orderBy(desc(ring_batches.year), desc(ring_batches.createdAt));
      } catch (e) {
        console.error("[rings.batches.list]", e);
        return [];
      }
    }),

    getById: protectedProcedure
      .input(z.number().int().positive())
      .query(async ({ input: id }) => {
        const db = await getDb();
        if (!db) return null;
        const rows = await db
          .select()
          .from(ring_batches)
          .where(eq(ring_batches.id, id))
          .limit(1);
        return rows[0] ?? null;
      }),

    create: protectedProcedure
      .input(createBatchSchema)
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

        const quantity_total = input.endNumber - input.startNumber + 1;
        if (quantity_total <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "endNumber deve ser maior que startNumber." });
        }

        const [batch] = await db
          .insert(ring_batches)
          .values({
            batch_number:    input.batch_number,
            year:            input.year,
            color:           input.color,
            quantity_total,
            quantity_used:   0,
            status:          "available",
            breederCode:     input.breederCode,
            associationName: input.associationName,
            speciesName:     input.speciesName,
            breedName:       input.breedName,
            modality:        input.modality,
            ringGaugeMm:     input.ringGaugeMm,
            month:           input.month,
            prefix:          input.prefix,
            suffix:          input.suffix,
            startNumber:     input.startNumber,
            endNumber:       input.endNumber,
            currentNumber:   input.startNumber,
            formatPattern:   input.formatPattern,
            notes:           input.notes,
          })
          .returning();

        // Gera anilhas individuais
        const generated = await generateRingsForBatch(db, batch.id, {
          year:          batch.year,
          month:         batch.month,
          breederCode:   batch.breederCode,
          prefix:        batch.prefix,
          suffix:        batch.suffix,
          formatPattern: batch.formatPattern,
          startNumber:   batch.startNumber,
          endNumber:     batch.endNumber,
        });

        return { success: true, batch, generated };
      }),

    update: protectedProcedure
      .input(z.object({
        id:              z.number().int().positive(),
        color:           z.string().max(50).optional(),
        status:          z.string().max(20).optional(),
        associationName: z.string().max(100).optional(),
        notes:           z.string().max(500).optional(),
        ringGaugeMm:     z.number().min(1).max(10).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

        const { id, ...fields } = input;
        const filtered = Object.fromEntries(
          Object.entries(fields).filter(([, v]) => v !== undefined)
        );

        await db
          .update(ring_batches)
          .set({ ...filtered, updatedAt: new Date() })
          .where(eq(ring_batches.id, id));

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.number().int().positive())
      .mutation(async ({ input: id }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

        // Verifica se há anilhas em uso
        const inUse = await db
          .select({ id: rings.id })
          .from(rings)
          .where(and(eq(rings.batchId, id), eq(rings.status, "in_use")))
          .limit(1);

        if (inUse.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Não é possível excluir um lote com anilhas em uso.",
          });
        }

        await db.delete(rings).where(eq(rings.batchId, id));
        await db.delete(ring_batches).where(eq(ring_batches.id, id));

        return { success: true };
      }),
  }),

  // ── Anilhas individuais ────────────────────────────────────────────────────
  rings: router({
    listByBatch: protectedProcedure
      .input(z.object({
        batchId:  z.number().int().positive(),
        status:   z.string().optional(),
        page:     z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(500).default(50),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { items: [], total: 0 };

        const conditions = [eq(rings.batchId, input.batchId)];
        if (input.status) conditions.push(eq(rings.status, input.status));

        const offset = (input.page - 1) * input.pageSize;

        const [items, countResult] = await Promise.all([
          db.select()
            .from(rings)
            .where(and(...conditions))
            .orderBy(asc(rings.sequence))
            .limit(input.pageSize)
            .offset(offset),
          db.select({ count: sql<number>`count(*)::int` })
            .from(rings)
            .where(and(...conditions)),
        ]);

        return { items, total: countResult[0]?.count ?? 0 };
      }),

    getNext: protectedProcedure
      .input(z.object({
        speciesName: z.string().optional(),
        breedName:   z.string().optional(),
        modality:    z.enum(["COR", "PORTE", "CANTO", "OUTRA"]).optional(),
        ringGaugeMm: z.number().optional(),
        year:        z.number().int().optional(),
        batchId:     z.number().int().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        return getNextAvailableRing(db, input ?? {});
      }),

    assign: protectedProcedure
      .input(z.object({
        ringId: z.number().int().positive(),
        birdId: z.number().int().positive(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        const pool = getPool();
        if (!db || !pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

        const fullCode = await assignRingToBird(db, pool, input.ringId, input.birdId);
        return { success: true, fullCode };
      }),

    release: protectedProcedure
      .input(z.number().int().positive())
      .mutation(async ({ input: birdId }) => {
        const db = await getDb();
        const pool = getPool();
        if (!db || !pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

        await releaseRingFromBird(db, pool, birdId);
        return { success: true };
      }),

    createManual: protectedProcedure
      .input(z.object({
        fullCode: z.string().min(1).max(100),
        batchId:  z.number().int().positive(),
        notes:    z.string().max(500).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

        const ring = await createManualRing(db, input);
        return { success: true, ring };
      }),

    parse: protectedProcedure
      .input(z.object({
        fullCode:      z.string(),
        formatPattern: z.string(),
      }))
      .query(async ({ input }) => {
        return parseRingCode(input.fullCode, input.formatPattern);
      }),
  }),

  // ── Regras de bitola ───────────────────────────────────────────────────────
  gaugeRules: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(ring_gauge_rules)
        .where(eq(ring_gauge_rules.active, true))
        .orderBy(asc(ring_gauge_rules.speciesName), asc(ring_gauge_rules.breedName));
    }),

    suggest: protectedProcedure
      .input(z.object({
        speciesName: z.string(),
        breedName:   z.string().optional(),
        modality:    z.string().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        // Tenta match exato espécie+raça primeiro, depois só espécie
        const conditions = [
          eq(ring_gauge_rules.active, true),
          eq(ring_gauge_rules.speciesName, input.speciesName),
        ];

        if (input.breedName) {
          conditions.push(eq(ring_gauge_rules.breedName, input.breedName));
        }
        if (input.modality) {
          conditions.push(eq(ring_gauge_rules.modality, input.modality));
        }

        const exact = await db
          .select()
          .from(ring_gauge_rules)
          .where(and(...conditions))
          .limit(1);

        if (exact.length > 0) return exact[0];

        // Fallback: só espécie
        const fallback = await db
          .select()
          .from(ring_gauge_rules)
          .where(and(
            eq(ring_gauge_rules.active, true),
            eq(ring_gauge_rules.speciesName, input.speciesName),
            isNull(ring_gauge_rules.breedName),
          ))
          .limit(1);

        return fallback[0] ?? null;
      }),
  }),

  // ── Estatísticas ───────────────────────────────────────────────────────────
  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, available: 0, inUse: 0, batches: 0, exhaustedBatches: 0 };

    try {
      const [totalRows, availableRows, inUseRows, batchRows, exhaustedRows] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(rings),
        db.select({ count: sql<number>`count(*)::int` }).from(rings).where(eq(rings.status, "available")),
        db.select({ count: sql<number>`count(*)::int` }).from(rings).where(eq(rings.status, "in_use")),
        db.select({ count: sql<number>`count(*)::int` }).from(ring_batches),
        db.select({ count: sql<number>`count(*)::int` }).from(ring_batches).where(eq(ring_batches.status, "exhausted")),
      ]);

      return {
        total:            totalRows[0]?.count ?? 0,
        available:        availableRows[0]?.count ?? 0,
        inUse:            inUseRows[0]?.count ?? 0,
        batches:          batchRows[0]?.count ?? 0,
        exhaustedBatches: exhaustedRows[0]?.count ?? 0,
      };
    } catch (e) {
      console.error("[rings.stats]", e);
      return { total: 0, available: 0, inUse: 0, batches: 0, exhaustedBatches: 0 };
    }
  }),
});
