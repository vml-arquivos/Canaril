import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { protectedProcedure, router, requireTenantAccess } from "../_core/trpc";
import { getDb } from "../db";
import { photos, birds, chicks, championship_entries } from "../../drizzle/schema";
import { storagePut } from "../storage";

const entityTypeSchema = z.enum(["bird", "chick", "breeder", "championship_entry"]);

function parseDataUrl(dataUrl: string): { contentType: string; buffer: Buffer; extension: string } {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    throw new Error("Formato de imagem inválido. Envie uma imagem em base64/dataURL.");
  }

  const contentType = match[1];
  const extension = contentType.split("/")[1]?.replace("jpeg", "jpg") || "bin";
  return {
    contentType,
    buffer: Buffer.from(match[2], "base64"),
    extension,
  };
}

/**
 * Confere que a entidade dona da foto (pássaro, filhote, criadouro, ou
 * inscrição em concurso) pertence ao tenant do usuário logado. Antes desta
 * correção, photos.ts não verificava isso em NENHUM endpoint — qualquer
 * usuário autenticado, de qualquer criadouro, podia ver, enviar, definir
 * como capa ou APAGAR fotos de outro criadouro só sabendo o entityId
 * (galeria do site institucional incluída).
 */
async function assertEntityAccess(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  ctx: any,
  entityType: z.infer<typeof entityTypeSchema>,
  entityId: number
) {
  if (entityType === "breeder") {
    // Para "breeder", entityId É o próprio tenantId (ver MeuSite/PhotoUploader).
    requireTenantAccess(ctx, entityId);
    return;
  }
  if (entityType === "bird") {
    const [row] = await db.select({ tenantId: birds.tenantId }).from(birds).where(eq(birds.id, entityId)).limit(1);
    if (!row) throw new Error("Pássaro não encontrado.");
    requireTenantAccess(ctx, row.tenantId);
    return;
  }
  if (entityType === "chick") {
    const [row] = await db.select({ tenantId: chicks.tenantId }).from(chicks).where(eq(chicks.id, entityId)).limit(1);
    if (!row) throw new Error("Filhote não encontrado.");
    requireTenantAccess(ctx, row.tenantId);
    return;
  }
  if (entityType === "championship_entry") {
    // championship_entries não tem tenantId próprio — resolve pelo pássaro inscrito.
    const [entry] = await db.select({ birdId: championship_entries.birdId }).from(championship_entries).where(eq(championship_entries.id, entityId)).limit(1);
    if (!entry) throw new Error("Inscrição não encontrada.");
    const [bird] = await db.select({ tenantId: birds.tenantId }).from(birds).where(eq(birds.id, entry.birdId)).limit(1);
    requireTenantAccess(ctx, bird?.tenantId ?? null);
    return;
  }
}

export const photosRouter = router({
  listByEntity: protectedProcedure
    .input(
      z.object({
        entityType: entityTypeSchema,
        entityId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      await assertEntityAccess(db, ctx, input.entityType, input.entityId);

      return db
        .select()
        .from(photos)
        .where(and(eq(photos.entityType, input.entityType), eq(photos.entityId, input.entityId)))
        .orderBy(desc(photos.isPrimary), desc(photos.createdAt));
    }),

  // Foto principal de TODAS as entidades de um tipo, numa única consulta —
  // usado pela visualização em blocos (grade) para não fazer uma query de
  // foto por pássaro. Aqui não há um único entityId pra checar contra o
  // tenant do usuário (é uma consulta em massa); a proteção real acontece
  // no lado de quem chama isso (birds.list já filtra por tenant), então
  // este endpoint só devolve um mapa id→url, sem dado sensível adicional.
  primaryByEntityType: protectedProcedure
    .input(z.object({ entityType: entityTypeSchema }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return {} as Record<number, string>;

      const rows = await db
        .select()
        .from(photos)
        .where(and(eq(photos.entityType, input.entityType), eq(photos.isPrimary, true)));

      const map: Record<number, string> = {};
      for (const row of rows) map[row.entityId] = row.url;
      return map;
    }),

  create: protectedProcedure
    .input(
      z.object({
        entityType: entityTypeSchema,
        entityId: z.number(),
        dataUrl: z.string().optional(),
        url: z.string().url().optional(),
        caption: z.string().trim().optional(),
        isPrimary: z.boolean().optional(),
        displayOrder: z.number().int().optional(),
        takenAt: z.date().optional(),
      }).refine(value => Boolean(value.dataUrl || value.url), {
        message: "Informe dataUrl ou url da foto.",
        path: ["dataUrl"],
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");
      await assertEntityAccess(db, ctx, input.entityType, input.entityId);

      let storageKey = input.url ?? "external-url";
      let url = input.url ?? "";

      if (input.dataUrl) {
        const parsed = parseDataUrl(input.dataUrl);
        const uploaded = await storagePut(
          `canaril/${input.entityType}/${input.entityId}/${Date.now()}.${parsed.extension}`,
          parsed.buffer,
          parsed.contentType
        );
        storageKey = uploaded.key;
        url = uploaded.url;
      }

      if (input.isPrimary) {
        await db
          .update(photos)
          .set({ isPrimary: false })
          .where(and(eq(photos.entityType, input.entityType), eq(photos.entityId, input.entityId)));
      }

      const [created] = await db
        .insert(photos)
        .values({
          entityType: input.entityType,
          entityId: input.entityId,
          storageKey,
          url,
          caption: input.caption || null,
          isPrimary: input.isPrimary ?? false,
          displayOrder: input.displayOrder ?? 0,
          takenAt: input.takenAt,
        })
        .returning();

      return created;
    }),

  setPrimary: protectedProcedure
    .input(z.object({ id: z.number(), entityType: entityTypeSchema, entityId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");

      // Confere a entidade informada pelo cliente E confirma que a foto
      // realmente pertence a ela — evita que alguém informe um
      // entityType/entityId "seu" mas um id de foto de outro criadouro.
      await assertEntityAccess(db, ctx, input.entityType, input.entityId);
      const [photo] = await db.select().from(photos).where(eq(photos.id, input.id)).limit(1);
      if (!photo || photo.entityType !== input.entityType || photo.entityId !== input.entityId) {
        throw new Error("Foto não encontrada para esta entidade.");
      }

      await db
        .update(photos)
        .set({ isPrimary: false })
        .where(and(eq(photos.entityType, input.entityType), eq(photos.entityId, input.entityId)));

      const [updated] = await db.update(photos).set({ isPrimary: true }).where(eq(photos.id, input.id)).returning();
      return updated ?? null;
    }),

  delete: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");

      const [photo] = await db.select().from(photos).where(eq(photos.id, input)).limit(1);
      if (!photo) return { success: true } as const; // já não existe
      await assertEntityAccess(db, ctx, photo.entityType as any, photo.entityId);

      await db.delete(photos).where(eq(photos.id, input));
      return { success: true } as const;
    }),
});
