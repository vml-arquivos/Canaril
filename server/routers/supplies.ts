/**
 * supplies.ts — Controle de insumos e alimentação
 *
 * Categorias: racao | semente | folhagem | fruta | suplemento |
 *             medicamento | material_ninho | equipamento | outro
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { supply_records } from "../../drizzle/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

const CATEGORIES = [
  "racao", "semente", "folhagem", "fruta", "suplemento",
  "medicamento", "material_ninho", "equipamento", "outro",
] as const;

export const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  racao:          { label: "Ração",           icon: "🌾", color: "bg-amber-100 text-amber-800" },
  semente:        { label: "Sementes",        icon: "🫘", color: "bg-yellow-100 text-yellow-800" },
  folhagem:       { label: "Folhagem",        icon: "🥬", color: "bg-green-100 text-green-800" },
  fruta:          { label: "Frutas",          icon: "🍎", color: "bg-red-100 text-red-800" },
  suplemento:     { label: "Suplemento",      icon: "💊", color: "bg-purple-100 text-purple-800" },
  medicamento:    { label: "Medicamento",     icon: "💉", color: "bg-blue-100 text-blue-800" },
  material_ninho: { label: "Material p/Ninho",icon: "🪹", color: "bg-orange-100 text-orange-800" },
  equipamento:    { label: "Equipamentos",    icon: "🔧", color: "bg-gray-100 text-gray-800" },
  outro:          { label: "Outros",          icon: "📦", color: "bg-slate-100 text-slate-800" },
};

const UNITS = ["kg", "g", "L", "ml", "un", "sc", "cx"] as const;

export const suppliesRouter = router({

  // ── Listar registros ──────────────────────────────────────────────────────
  list: protectedProcedure
    .input(z.object({
      category: z.enum([...CATEGORIES, "all"]).default("all"),
      dateFrom: z.string().optional(),
      dateTo:   z.string().optional(),
      limit:    z.number().int().max(300).default(100),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const tenantId = (ctx.user as any)?.tenantId ?? null;

      const conditions: any[] = [];
      if (tenantId !== null) conditions.push(eq(supply_records.tenantId, tenantId));
      if (input?.category && input.category !== "all") conditions.push(eq(supply_records.category, input.category));
      if (input?.dateFrom) conditions.push(gte(supply_records.date, new Date(input.dateFrom)));
      if (input?.dateTo)   conditions.push(lte(supply_records.date, new Date(input.dateTo)));

      let q: any = db.select().from(supply_records).orderBy(desc(supply_records.date));
      if (conditions.length > 0) q = q.where(and(...conditions));
      return q.limit(input?.limit ?? 100);
    }),

  // ── Criar registro ────────────────────────────────────────────────────────
  create: protectedProcedure
    .input(z.object({
      category:  z.enum(CATEGORIES),
      name:      z.string().min(1).max(200),
      quantity:  z.number().positive(),
      unit:      z.enum(UNITS),
      unitCost:  z.number().min(0).optional(),
      totalCost: z.number().min(0).optional(),
      supplier:  z.string().max(200).optional(),
      date:      z.string().optional(),
      notes:     z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível");
      const tenantId = (ctx.user as any)?.tenantId ?? null;
      const uid = (ctx.user as any)?.id ?? null;

      // Calcular totalCost se não informado diretamente
      const totalCost = input.totalCost ?? (input.unitCost ? input.unitCost * input.quantity : undefined);

      const [rec] = await db.insert(supply_records).values({
        category:  input.category,
        name:      input.name,
        quantity:  String(input.quantity),
        unit:      input.unit,
        unitCost:  input.unitCost ? String(input.unitCost) : null,
        totalCost: totalCost ? String(totalCost) : null,
        supplier:  input.supplier ?? null,
        date:      input.date ? new Date(input.date) : new Date(),
        notes:     input.notes ?? null,
        tenantId,
        createdBy: uid,
      } as any).returning();

      return rec;
    }),

  // ── Deletar registro ──────────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.number().int().positive())
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco não disponível");
      await db.delete(supply_records).where(eq(supply_records.id, input));
      return { success: true };
    }),

  // ── Sumário financeiro de insumos ─────────────────────────────────────────
  summary: protectedProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo:   z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { total: 0, byCategory: [] };
      const tenantId = (ctx.user as any)?.tenantId ?? null;

      const conditions: any[] = [];
      if (tenantId !== null) conditions.push(eq(supply_records.tenantId, tenantId));
      if (input?.dateFrom) conditions.push(gte(supply_records.date, new Date(input.dateFrom)));
      if (input?.dateTo)   conditions.push(lte(supply_records.date, new Date(input.dateTo)));

      const rows = await db.select({
        category: supply_records.category,
        total:    sql<number>`COALESCE(SUM(CAST(${supply_records.totalCost} AS NUMERIC)), 0)`.as("total"),
        count:    sql<number>`COUNT(*)::int`.as("count"),
      })
        .from(supply_records)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(supply_records.category)
        .orderBy(sql`total DESC`);

      const grandTotal = rows.reduce((s, r) => s + Number(r.total), 0);

      return {
        total: grandTotal,
        byCategory: rows.map((r) => ({
          category:  r.category,
          label:     CATEGORY_LABELS[r.category]?.label ?? r.category,
          icon:      CATEGORY_LABELS[r.category]?.icon ?? "📦",
          color:     CATEGORY_LABELS[r.category]?.color ?? "bg-gray-100 text-gray-700",
          total:     Number(r.total),
          count:     Number(r.count),
          pct:       grandTotal > 0 ? Math.round((Number(r.total) / grandTotal) * 100) : 0,
        })),
      };
    }),
});
