/**
 * qrcode.ts — Router de QR Code / Código Público
 *
 * Gera e gerencia publicCode para pássaros e gaiolas.
 * O QR Code aponta para /p/:code — uma página pública controlada.
 *
 * Fluxo:
 *   generate(birdId) → cria publicCode único se não existir → retorna URL
 *   getPublicBird(code) → endpoint público (sem auth) para exibir ficha resumida
 *   generateCage(cageId) → mesmo para gaiolas
 */
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { birds, cages, bird_genetic_profiles, bird_genotype } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

const BASE_URL = process.env.APP_URL || "https://canarillima.casadf.com.br";

function makePublicCode(): string {
  // 8 chars alfanumérico — suficiente para criadouros (<100k pássaros)
  return nanoid(8).toUpperCase();
}

export const qrcodeRouter = router({
  /**
   * Gera (ou retorna existente) publicCode para um pássaro.
   * Retorna URL pública e um SVG simples do QR Code via API pública.
   */
  generateForBird: protectedProcedure
    .input(z.object({ birdId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível.");

      const [bird] = await db.select().from(birds).where(eq(birds.id, input.birdId)).limit(1);
      if (!bird) throw new Error(`Pássaro #${input.birdId} não encontrado.`);

      // Reutiliza código existente se já houver
      if (bird.publicCode) {
        const url = `${BASE_URL}/p/${bird.publicCode}`;
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
        return { publicCode: bird.publicCode, url, qrApiUrl };
      }

      // Gera novo código único
      let publicCode = makePublicCode();
      let attempts = 0;
      while (attempts < 10) {
        const existing = await db.select({ id: birds.id }).from(birds)
          .where(eq(birds.publicCode, publicCode)).limit(1);
        if (existing.length === 0) break;
        publicCode = makePublicCode();
        attempts++;
      }

      await db.update(birds).set({ publicCode }).where(eq(birds.id, input.birdId));

      const url = `${BASE_URL}/p/${publicCode}`;
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
      return { publicCode, url, qrApiUrl };
    }),

  /**
   * Gera (ou retorna existente) publicCode para uma gaiola.
   */
  generateForCage: protectedProcedure
    .input(z.object({ cageId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível.");

      const [cage] = await db.select().from(cages).where(eq(cages.id, input.cageId)).limit(1);
      if (!cage) throw new Error(`Gaiola #${input.cageId} não encontrada.`);

      if (cage.publicCode) {
        const url = `${BASE_URL}/g/${cage.publicCode}`;
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
        return { publicCode: cage.publicCode, url, qrApiUrl };
      }

      let publicCode = makePublicCode();
      let attempts = 0;
      while (attempts < 10) {
        const existing = await db.select({ id: cages.id }).from(cages)
          .where(eq(cages.publicCode, publicCode)).limit(1);
        if (existing.length === 0) break;
        publicCode = makePublicCode();
        attempts++;
      }

      await db.update(cages).set({ publicCode }).where(eq(cages.id, input.cageId));

      const url = `${BASE_URL}/g/${publicCode}`;
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
      return { publicCode, url, qrApiUrl };
    }),

  /**
   * Endpoint PÚBLICO — retorna ficha resumida de um pássaro pelo publicCode.
   * Responde somente se o pássaro estiver com isPublic=true.
   */
  getPublicBird: publicProcedure
    .input(z.object({ code: z.string().min(1).max(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [bird] = await db.select().from(birds)
        .where(eq(birds.publicCode, input.code.toUpperCase()))
        .limit(1);

      if (!bird || !bird.isPublic) return null;

      const [profile] = await db.select().from(bird_genetic_profiles)
        .where(eq(bird_genetic_profiles.birdId, bird.id)).limit(1);
      const [genotype] = await db.select().from(bird_genotype)
        .where(eq(bird_genotype.birdId, bird.id)).limit(1);

      return {
        ring: bird.ring,
        displayTitle: bird.displayTitle,
        nickname: bird.nickname,
        sex: bird.sex,
        speciesName: bird.speciesName,
        breedName: bird.breedName,
        modality: bird.modality,
        birthDate: bird.birthDate,
        officialCode: profile?.officialCode ?? null,
        officialName: profile?.officialName ?? null,
        featherType: genotype?.featherType ?? null,
        hasCrest: genotype?.hasCrest ?? false,
        backgroundColor: genotype?.backgroundColor ?? null,
      };
    }),

  /**
   * Remove o publicCode de um pássaro (torna o QR inacessível).
   */
  revokeForBird: protectedProcedure
    .input(z.object({ birdId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível.");
      await db.update(birds).set({ publicCode: null }).where(eq(birds.id, input.birdId));
      return { success: true };
    }),
});
