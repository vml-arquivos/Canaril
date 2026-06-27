/**
 * movements.ts — Movimentação do plantel (entradas e saídas de pássaros)
 *
 * Tipos ENTRADA: bought | bred | donated_in | transferred_in
 * Tipos SAÍDA:   sold | died | escaped | donated_out | transferred_out | culled
 *
 * Ao registrar uma SAÍDA, o status do pássaro é atualizado automaticamente.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { bird_movements, birds } from "../../drizzle/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

const ENTRY_TYPES = ["bought", "bred", "donated_in", "transferred_in"] as const;
const EXIT_TYPES  = ["sold", "died", "escaped", "donated_out", "transferred_out", "culled"] as const;
const ALL_TYPES   = [...ENTRY_TYPES, ...EXIT_TYPES] as const;

const EXIT_STATUS: Record<string, string> = {
  sold:           "sold",
  died:           "dead",
  escaped:        "escaped",
  donated_out:    "donated",
  transferred_out:"transferred",
  culled:         "inactive",
};

export const TYPE_LABELS: Record<string, string> = {
  bought:          "Compra",
  bred:            "Nascimento/Plantel",
  donated_in:      "Doação (entrada)",
  transferred_in:  "Transferência (entrada)",
  sold:            "Venda",
  died:            "Óbito",
  escaped:         "Fuga",
  donated_out:     "Doação (saída)",
  transferred_out: "Transferência (saída)",
  culled:          "Descarte",
};

export const movementsRouter = router({

  // ── Listar movimentações ──────────────────────────────────────────────────
  list: protectedProcedure
    .input(z.object({
      type:      z.enum([...ALL_TYPES, "all"]).default("all"),
      dateFrom:  z.string().optional(),
      dateTo:    z.string().optional(),
      limit:     z.number().int().max(200).default(100),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const tenantId = (ctx.user as any)?.tenantId ?? null;

      let q: any = db.select({
        id:          bird_movements.id,
        birdId:      bird_movements.birdId,
        ring:        birds.ring,
        displayTitle: birds.displayTitle,
        type:        bird_movements.type,
        date:        bird_movements.date,
        price:       bird_movements.price,
        counterpart: bird_movements.counterpart,
        notes:       bird_movements.notes,
        createdAt:   bird_movements.createdAt,
      })
        .from(bird_movements)
        .innerJoin(birds, eq(birds.id, bird_movements.birdId))
        .orderBy(desc(bird_movements.date));

      const conditions: any[] = [];
      if (tenantId !== null) conditions.push(eq(bird_movements.tenantId, tenantId));
      if (input?.type && input.type !== "all") conditions.push(eq(bird_movements.type, input.type));
      if (input?.dateFrom) conditions.push(gte(bird_movements.date, new Date(input.dateFrom)));
      if (input?.dateTo)   conditions.push(lte(bird_movements.date, new Date(input.dateTo)));

      if (conditions.length > 0) q = q.where(and(...conditions));

      return q.limit(input?.limit ?? 100);
    }),

  // ── Registrar entrada ─────────────────────────────────────────────────────
  registerEntry: protectedProcedure
    .input(z.object({
      birdId:      z.number().int().positive(),
      type:        z.enum(ENTRY_TYPES),
      date:        z.string().optional(),
      price:       z.number().min(0).optional(),
      counterpart: z.string().max(200).optional(),
      notes:       z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível");
      const tenantId = (ctx.user as any)?.tenantId ?? null;
      const uid = (ctx.user as any)?.id ?? null;

      const [mov] = await db.insert(bird_movements).values({
        birdId:      input.birdId,
        type:        input.type,
        date:        input.date ? new Date(input.date) : new Date(),
        price:       input.price ? String(input.price) : null,
        counterpart: input.counterpart ?? null,
        notes:       input.notes ?? null,
        tenantId,
        createdBy:   uid,
      }).returning();

      // Atualizar campos de aquisição no pássaro
      await db.update(birds).set({
        acquisitionType: input.type,
        acquisitionDate: mov.date,
        purchasePrice:   input.price ? String(input.price) : undefined,
        supplierName:    input.counterpart ?? undefined,
        status:          "active",
      } as any).where(eq(birds.id, input.birdId));

      return mov;
    }),

  // ── Registrar saída ───────────────────────────────────────────────────────
  registerExit: protectedProcedure
    .input(z.object({
      birdId:      z.number().int().positive(),
      type:        z.enum(EXIT_TYPES),
      date:        z.string().optional(),
      price:       z.number().min(0).optional(),   // apenas para venda
      counterpart: z.string().max(200).optional(),  // comprador, destino
      notes:       z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível");
      const tenantId = (ctx.user as any)?.tenantId ?? null;
      const uid = (ctx.user as any)?.id ?? null;

      const exitDate = input.date ? new Date(input.date) : new Date();

      const [mov] = await db.insert(bird_movements).values({
        birdId:      input.birdId,
        type:        input.type,
        date:        exitDate,
        price:       input.price ? String(input.price) : null,
        counterpart: input.counterpart ?? null,
        notes:       input.notes ?? null,
        tenantId,
        createdBy:   uid,
      }).returning();

      // Atualizar status e campos de saída no pássaro
      const newStatus = EXIT_STATUS[input.type] ?? "inactive";
      await db.update(birds).set({
        status:      newStatus,
        exitDate,
        exitReason:  input.type,
        salePrice:   input.price ? String(input.price) : undefined,
        buyerName:   input.counterpart ?? undefined,
      } as any).where(eq(birds.id, input.birdId));

      return mov;
    }),

  // ── Sumário financeiro das movimentações ─────────────────────────────────
  financialSummary: protectedProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo:   z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { totalSales: 0, totalPurchases: 0, salesCount: 0, purchasesCount: 0 };
      const tenantId = (ctx.user as any)?.tenantId ?? null;

      const conditions: any[] = [];
      if (tenantId !== null) conditions.push(eq(bird_movements.tenantId, tenantId));
      if (input?.dateFrom) conditions.push(gte(bird_movements.date, new Date(input.dateFrom)));
      if (input?.dateTo)   conditions.push(lte(bird_movements.date, new Date(input.dateTo)));

      const rows = await db.select({
        type:  bird_movements.type,
        price: sql<number>`COALESCE(SUM(CAST(${bird_movements.price} AS NUMERIC)), 0)`.as("total"),
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
        .from(bird_movements)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(bird_movements.type);

      const sales     = rows.filter((r) => r.type === "sold");
      const purchases = rows.filter((r) => r.type === "bought");

      return {
        totalSales:     Number(sales[0]?.price ?? 0),
        salesCount:     Number(sales[0]?.count ?? 0),
        totalPurchases: Number(purchases[0]?.price ?? 0),
        purchasesCount: Number(purchases[0]?.count ?? 0),
      };
    }),

  // ── Histórico de um pássaro ───────────────────────────────────────────────
  byBird: protectedProcedure
    .input(z.number().int().positive())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(bird_movements)
        .where(eq(bird_movements.birdId, input))
        .orderBy(desc(bird_movements.date));
    }),
});
