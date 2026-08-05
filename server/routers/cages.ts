import { z } from "zod";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { canarilManagerProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb, getPool } from "../db";
import { birds, cages, couples } from "../../drizzle/schema";
import { getCurrentTenantId, requireTenantId } from "../_core/tenant";
import { SPECIALTIES } from "../../shared/constants";

const cageStatusSchema = z.enum(["free", "occupied", "maintenance"]);
const specialtyCodes = new Set<string>(SPECIALTIES.map((item) => item.id));
const specialtyCodeSchema = z.string().trim().max(50).refine(
  (value) => specialtyCodes.has(value),
  "Especialidade inválida. Selecione uma especialidade cadastrada.",
);

const optionalText = (max: number) => z.string().trim().max(max).optional();
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();

function cageScope(id: number, tenantId: number | null) {
  return tenantId === null ? eq(cages.id, id) : and(eq(cages.id, id), eq(cages.tenantId, tenantId));
}

function cleanOptional(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function buildCageCode(prefix: string, number: number, padding: number) {
  return `${prefix.trim()}${String(number).padStart(padding, "0")}`;
}

async function ensureCodeAvailable(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  tenantId: number,
  code: string,
  ignoreId?: number,
) {
  const rows = await db.select({ id: cages.id }).from(cages).where(and(
    eq(cages.tenantId, tenantId),
    sql`lower(${cages.code}) = lower(${code.trim()})`,
    isNull(cages.deletedAt),
  )).limit(2);
  if (rows.some((row) => row.id !== ignoreId)) {
    throw new Error(`Já existe uma gaiola ativa com o código ${code.trim()} neste canaril.`);
  }
}

export const cagesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const tenantId = getCurrentTenantId(ctx);
    const cageConditions = [isNull(cages.deletedAt)];
    const coupleConditions = [eq(couples.status, "active"), isNull(couples.deletedAt)];
    const birdConditions = [eq(birds.status, "active"), isNull(birds.deletedAt)];
    if (tenantId !== null) {
      cageConditions.push(eq(cages.tenantId, tenantId));
      coupleConditions.push(eq(couples.tenantId, tenantId));
      birdConditions.push(eq(birds.tenantId, tenantId));
    }

    const [cageRows, activeCouples, activeBirds] = await Promise.all([
      db.select().from(cages).where(and(...cageConditions)).orderBy(asc(cages.code)),
      db.select({ cageId: couples.cageId }).from(couples).where(and(...coupleConditions)),
      db.select({ cageId: birds.cageId }).from(birds).where(and(...birdConditions)),
    ]);

    const coupleCounts = new Map<number, number>();
    for (const row of activeCouples) {
      if (row.cageId) coupleCounts.set(row.cageId, (coupleCounts.get(row.cageId) ?? 0) + 1);
    }
    const birdCounts = new Map<number, number>();
    for (const row of activeBirds) {
      if (row.cageId) birdCounts.set(row.cageId, (birdCounts.get(row.cageId) ?? 0) + 1);
    }

    return cageRows.map((cage) => {
      const activeCoupleCount = coupleCounts.get(cage.id) ?? 0;
      const activeBirdCount = birdCounts.get(cage.id) ?? 0;
      return {
        ...cage,
        activeCoupleCount,
        activeBirdCount,
        canDelete: activeCoupleCount === 0 && activeBirdCount === 0,
      };
    }).sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true }));
  }),

  getById: protectedProcedure
    .input(z.number().int().positive())
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const tenantId = getCurrentTenantId(ctx);
      const [result] = await db.select().from(cages).where(and(cageScope(input, tenantId), isNull(cages.deletedAt))).limit(1);
      return result ?? null;
    }),

  create: canarilManagerProcedure
    .input(z.object({
      code: z.string().trim().min(1, "Informe o código da gaiola").max(50),
      section: optionalText(100),
      batchName: optionalText(120),
      purpose: optionalText(150),
      specialtyCode: specialtyCodeSchema.optional(),
      breedName: optionalText(100),
      capacity: z.number().int().min(1).max(100).default(1),
      status: cageStatusSchema.optional(),
      notes: optionalText(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");
      const tenantId = requireTenantId(ctx);
      const code = input.code.trim();
      await ensureCodeAvailable(db, tenantId, code);

      const [created] = await db.insert(cages).values({
        code,
        section: cleanOptional(input.section),
        batchName: cleanOptional(input.batchName),
        purpose: cleanOptional(input.purpose),
        specialtyCode: cleanOptional(input.specialtyCode),
        breedName: cleanOptional(input.breedName),
        capacity: input.capacity,
        status: input.status ?? "free",
        notes: cleanOptional(input.notes),
        tenantId,
      }).returning();
      return created;
    }),

  createBatch: canarilManagerProcedure
    .input(z.object({
      startNumber: z.number().int().min(0).max(999999),
      endNumber: z.number().int().min(0).max(999999),
      prefix: z.string().trim().max(20).default(""),
      padding: z.number().int().min(1).max(6).default(3),
      section: optionalText(100),
      batchName: optionalText(120),
      purpose: optionalText(150),
      specialtyCode: specialtyCodeSchema.optional(),
      breedName: optionalText(100),
      capacity: z.number().int().min(1).max(100).default(1),
      notes: optionalText(2000),
    }).superRefine((input, ctx) => {
      if (input.endNumber < input.startNumber) {
        ctx.addIssue({ code: "custom", path: ["endNumber"], message: "O número final deve ser maior ou igual ao inicial." });
      }
      if (input.endNumber - input.startNumber + 1 > 500) {
        ctx.addIssue({ code: "custom", path: ["endNumber"], message: "Cada lote pode cadastrar no máximo 500 gaiolas." });
      }
    }))
    .mutation(async ({ ctx, input }) => {
      const pool = getPool();
      if (!pool) throw new Error("Banco de dados não disponível");
      const tenantId = requireTenantId(ctx);
      const codes = Array.from(
        { length: input.endNumber - input.startNumber + 1 },
        (_, index) => buildCageCode(input.prefix, input.startNumber + index, input.padding),
      );
      if (codes.some((code) => code.length > 50)) throw new Error("O prefixo e a numeração geraram códigos maiores que 50 caracteres.");

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const duplicate = await client.query<{ code: string }>(
          `SELECT code FROM cages
            WHERE "tenantId"=$1 AND "deletedAt" IS NULL AND lower(code)=ANY($2::text[])
            LIMIT 20 FOR UPDATE`,
          [tenantId, codes.map((code) => code.toLowerCase())],
        );
        if (duplicate.rows.length > 0) {
          const examples = duplicate.rows.map((row) => row.code).slice(0, 5).join(", ");
          throw new Error(`O lote não foi criado porque já existem gaiolas com estes códigos: ${examples}. Nenhum registro foi alterado.`);
        }

        const values: unknown[] = [];
        const placeholders = codes.map((code, index) => {
          const base = index * 10;
          values.push(
            code,
            cleanOptional(input.section),
            cleanOptional(input.batchName),
            cleanOptional(input.purpose),
            cleanOptional(input.specialtyCode),
            cleanOptional(input.breedName),
            input.capacity,
            cleanOptional(input.notes),
            tenantId,
            "free",
          );
          return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10})`;
        });

        const created = await client.query(
          `INSERT INTO cages
            (code, section, "batchName", purpose, "specialtyCode", "breedName", capacity, notes, "tenantId", status)
           VALUES ${placeholders.join(",")}
           RETURNING id, code`,
          values,
        );
        await client.query("COMMIT");
        return { success: true, count: created.rowCount ?? codes.length, codes };
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }),

  update: canarilManagerProcedure
    .input(z.object({
      id: z.number().int().positive(),
      code: z.string().trim().min(1).max(50).optional(),
      section: nullableText(100),
      batchName: nullableText(120),
      purpose: nullableText(150),
      specialtyCode: specialtyCodeSchema.nullable().optional(),
      breedName: nullableText(100),
      capacity: z.number().int().min(1).max(100).optional(),
      status: cageStatusSchema.optional(),
      notes: nullableText(2000),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");
      const tenantId = requireTenantId(ctx);
      const { id, ...patch } = input;
      if (patch.code) await ensureCodeAvailable(db, tenantId, patch.code, id);

      const normalizedPatch = {
        ...patch,
        ...(patch.code !== undefined ? { code: patch.code.trim() } : {}),
        ...(patch.section !== undefined ? { section: cleanOptional(patch.section) } : {}),
        ...(patch.batchName !== undefined ? { batchName: cleanOptional(patch.batchName) } : {}),
        ...(patch.purpose !== undefined ? { purpose: cleanOptional(patch.purpose) } : {}),
        ...(patch.specialtyCode !== undefined ? { specialtyCode: cleanOptional(patch.specialtyCode) } : {}),
        ...(patch.breedName !== undefined ? { breedName: cleanOptional(patch.breedName) } : {}),
        ...(patch.notes !== undefined ? { notes: cleanOptional(patch.notes) } : {}),
        updatedAt: new Date(),
      };

      const [updated] = await db.update(cages).set(normalizedPatch)
        .where(and(eq(cages.id, id), eq(cages.tenantId, tenantId), isNull(cages.deletedAt))).returning();
      if (!updated) throw new Error("Gaiola não encontrada ou sem acesso.");
      return updated;
    }),

  delete: canarilManagerProcedure
    .input(z.number().int().positive())
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");
      const tenantId = requireTenantId(ctx);
      const scope = and(eq(cages.id, input), eq(cages.tenantId, tenantId));
      const [cage] = await db.select({ id: cages.id, code: cages.code }).from(cages).where(and(scope, isNull(cages.deletedAt))).limit(1);
      if (!cage) throw new Error("Gaiola não encontrada ou sem acesso.");

      const activeCouple = await db.select({ id: couples.id }).from(couples).where(and(
        eq(couples.cageId, input), eq(couples.tenantId, tenantId), eq(couples.status, "active"), isNull(couples.deletedAt),
      )).limit(1);
      if (activeCouple.length > 0) throw new Error("A gaiola possui casal ativo. Desfaça o casal antes de apagar a gaiola.");

      const activeBird = await db.select({ id: birds.id }).from(birds).where(and(
        eq(birds.cageId, input), eq(birds.tenantId, tenantId), eq(birds.status, "active"), isNull(birds.deletedAt),
      )).limit(1);
      if (activeBird.length > 0) throw new Error("A gaiola possui pássaros ativos. Transfira-os antes de apagar a gaiola.");

      await db.update(cages).set({ deletedAt: new Date(), deletedBy: ctx.user.id, updatedAt: new Date() }).where(scope);
      return { success: true, code: cage.code } as const;
    }),
});
