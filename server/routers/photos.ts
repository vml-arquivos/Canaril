import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { photos } from "../../drizzle/schema";
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

export const photosRouter = router({
  listByEntity: protectedProcedure
    .input(
      z.object({
        entityType: entityTypeSchema,
        entityId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      return db
        .select()
        .from(photos)
        .where(and(eq(photos.entityType, input.entityType), eq(photos.entityId, input.entityId)))
        .orderBy(desc(photos.isPrimary), desc(photos.createdAt));
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
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");

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
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");

      await db
        .update(photos)
        .set({ isPrimary: false })
        .where(and(eq(photos.entityType, input.entityType), eq(photos.entityId, input.entityId)));

      const [updated] = await db.update(photos).set({ isPrimary: true }).where(eq(photos.id, input.id)).returning();
      return updated ?? null;
    }),

  delete: protectedProcedure
    .input(z.number())
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");

      await db.delete(photos).where(eq(photos.id, input));
      return { success: true } as const;
    }),
});
