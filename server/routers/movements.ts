/**
 * movements.ts — Movimentação auditável do plantel.
 *
 * Cada entrada/saída e a atualização correspondente do pássaro são gravadas
 * na mesma transação para impedir histórico parcial.
 */
import { z } from "zod";
import { canarilManagerProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb, getPool } from "../db";
import { bird_movements, birds } from "../../drizzle/schema";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { getCurrentTenantId, requireTenantId } from "../_core/tenant";

const ENTRY_TYPES = ["bought", "bred", "donated_in", "transferred_in"] as const;
const EXIT_TYPES = ["sold", "died", "escaped", "donated_out", "transferred_out", "culled"] as const;
const ALL_TYPES = [...ENTRY_TYPES, ...EXIT_TYPES] as const;

const EXIT_STATUS: Record<(typeof EXIT_TYPES)[number], string> = {
  sold: "sold",
  died: "dead",
  escaped: "escaped",
  donated_out: "donated",
  transferred_out: "transferred",
  culled: "inactive",
};

export const TYPE_LABELS: Record<string, string> = {
  bought: "Compra",
  bred: "Nascimento/Plantel",
  donated_in: "Doação (entrada)",
  transferred_in: "Transferência (entrada)",
  sold: "Venda",
  died: "Óbito",
  escaped: "Fuga",
  donated_out: "Doação (saída)",
  transferred_out: "Transferência (saída)",
  culled: "Descarte",
};

function startOfDate(value: string): Date {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Data inicial inválida.");
  return date;
}

function dayAfter(value: string): Date {
  const date = startOfDate(value);
  date.setDate(date.getDate() + 1);
  return date;
}

const movementInput = z.object({
  birdId: z.number().int().positive(),
  date: z.string().optional(),
  price: z.number().finite().min(0).max(99999999.99).optional(),
  counterpart: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

async function registerMovement(params: {
  tenantId: number;
  userId: number;
  birdId: number;
  type: string;
  date?: string;
  price?: number;
  counterpart?: string;
  notes?: string;
  direction: "entry" | "exit";
}) {
  const pool = getPool();
  if (!pool) throw new Error("Banco não disponível");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const birdResult = await client.query(
      `SELECT id, status FROM birds
        WHERE id = $1 AND "tenantId" = $2 AND "deletedAt" IS NULL
        FOR UPDATE`,
      [params.birdId, params.tenantId],
    );
    if (birdResult.rowCount !== 1) throw new Error("Pássaro não encontrado neste canaril.");

    const movementDate = params.date ? new Date(params.date) : new Date();
    if (Number.isNaN(movementDate.getTime())) throw new Error("Data da movimentação inválida.");
    const price = params.price === undefined ? null : params.price.toFixed(2);

    const movementResult = await client.query(
      `INSERT INTO bird_movements
        ("birdId", type, date, price, counterpart, notes, "tenantId", "createdBy")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        params.birdId,
        params.type,
        movementDate,
        price,
        params.counterpart?.trim() || null,
        params.notes?.trim() || null,
        params.tenantId,
        params.userId,
      ],
    );

    if (params.direction === "entry") {
      await client.query(
        `UPDATE birds SET
          "acquisitionType" = $1,
          "acquisitionDate" = $2,
          "purchasePrice" = $3,
          "supplierName" = $4,
          status = 'active',
          "exitDate" = NULL,
          "exitReason" = NULL,
          "salePrice" = NULL,
          "buyerName" = NULL,
          "updatedAt" = NOW()
         WHERE id = $5 AND "tenantId" = $6`,
        [params.type, movementDate, price, params.counterpart?.trim() || null, params.birdId, params.tenantId],
      );
    } else {
      const status = EXIT_STATUS[params.type as keyof typeof EXIT_STATUS] ?? "inactive";
      await client.query(
        `UPDATE birds SET
          status = $1,
          "exitDate" = $2,
          "exitReason" = $3,
          "salePrice" = $4,
          "buyerName" = $5,
          "updatedAt" = NOW()
         WHERE id = $6 AND "tenantId" = $7`,
        [status, movementDate, params.type, price, params.counterpart?.trim() || null, params.birdId, params.tenantId],
      );
    }

    await client.query("COMMIT");
    return movementResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export const movementsRouter = router({
  list: protectedProcedure
    .input(z.object({
      type: z.enum([...ALL_TYPES, "all"]).default("all"),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.number().int().min(1).max(200).default(100),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const tenantId = getCurrentTenantId(ctx);
      const conditions = [];
      if (tenantId !== null) conditions.push(eq(bird_movements.tenantId, tenantId));
      if (input?.type && input.type !== "all") conditions.push(eq(bird_movements.type, input.type));
      if (input?.dateFrom) conditions.push(gte(bird_movements.date, startOfDate(input.dateFrom)));
      if (input?.dateTo) conditions.push(lt(bird_movements.date, dayAfter(input.dateTo)));

      return db.select({
        id: bird_movements.id,
        birdId: bird_movements.birdId,
        ring: birds.ring,
        displayTitle: birds.displayTitle,
        type: bird_movements.type,
        date: bird_movements.date,
        price: bird_movements.price,
        counterpart: bird_movements.counterpart,
        notes: bird_movements.notes,
        createdAt: bird_movements.createdAt,
      })
        .from(bird_movements)
        .innerJoin(birds, and(
          eq(birds.id, bird_movements.birdId),
          ...(tenantId === null ? [] : [eq(birds.tenantId, tenantId)]),
        ))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(bird_movements.date))
        .limit(input?.limit ?? 100);
    }),

  registerEntry: canarilManagerProcedure
    .input(movementInput.extend({ type: z.enum(ENTRY_TYPES) }))
    .mutation(async ({ ctx, input }) => registerMovement({
      ...input,
      tenantId: requireTenantId(ctx),
      userId: ctx.user.id,
      direction: "entry",
    })),

  registerExit: canarilManagerProcedure
    .input(movementInput.extend({ type: z.enum(EXIT_TYPES) }))
    .mutation(async ({ ctx, input }) => registerMovement({
      ...input,
      tenantId: requireTenantId(ctx),
      userId: ctx.user.id,
      direction: "exit",
    })),

  financialSummary: protectedProcedure
    .input(z.object({ dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { totalSales: 0, totalPurchases: 0, salesCount: 0, purchasesCount: 0 };
      const tenantId = getCurrentTenantId(ctx);
      const conditions = [];
      if (tenantId !== null) conditions.push(eq(bird_movements.tenantId, tenantId));
      if (input?.dateFrom) conditions.push(gte(bird_movements.date, startOfDate(input.dateFrom)));
      if (input?.dateTo) conditions.push(lt(bird_movements.date, dayAfter(input.dateTo)));

      const rows = await db.select({
        type: bird_movements.type,
        price: sql<number>`COALESCE(SUM(CAST(${bird_movements.price} AS NUMERIC)), 0)`.as("total"),
        count: sql<number>`COUNT(*)::int`.as("count"),
      })
        .from(bird_movements)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(bird_movements.type);

      const sales = rows.find((row) => row.type === "sold");
      const purchases = rows.find((row) => row.type === "bought");
      return {
        totalSales: Number(sales?.price ?? 0),
        salesCount: Number(sales?.count ?? 0),
        totalPurchases: Number(purchases?.price ?? 0),
        purchasesCount: Number(purchases?.count ?? 0),
      };
    }),

  byBird: protectedProcedure
    .input(z.number().int().positive())
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const tenantId = getCurrentTenantId(ctx);
      const [bird] = await db.select({ id: birds.id }).from(birds).where(and(
        eq(birds.id, input),
        ...(tenantId === null ? [] : [eq(birds.tenantId, tenantId)]),
      )).limit(1);
      if (!bird) throw new Error("Pássaro não encontrado ou sem acesso.");
      return db.select().from(bird_movements).where(and(
        eq(bird_movements.birdId, input),
        ...(tenantId === null ? [] : [eq(bird_movements.tenantId, tenantId)]),
      )).orderBy(desc(bird_movements.date));
    }),
});
