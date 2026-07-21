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
import { birds, cages, bird_genetic_profiles, bird_genotype, championship_entries, championships, scores, tenants } from "../../drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { MUTATION_CONFIG } from "../_core/colorGenetics";

// Em produção, APP_URL deve estar configurado no ambiente com o domínio real
// da plataforma. Este fallback é só para desenvolvimento local — antes
// apontava para o domínio de um cliente específico (canarillima.casadf.com.br),
// o que geraria QR Codes com o link ERRADO para qualquer outro criadouro.
const BASE_URL = process.env.APP_URL || "http://localhost:5000";

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

      const tenantRow = bird.tenantId
        ? (await db.select({ name: tenants.name, publicSlug: tenants.publicSlug, slug: tenants.slug }).from(tenants).where(eq(tenants.id, bird.tenantId)).limit(1))[0]
        : null;

      const [profile] = await db.select().from(bird_genetic_profiles)
        .where(eq(bird_genetic_profiles.birdId, bird.id)).limit(1);
      const [genotype] = await db.select().from(bird_genotype)
        .where(eq(bird_genotype.birdId, bird.id)).limit(1);

      // Genealogia — só anilha/nome dos pais (dado genealógico, não sensível).
      const parentIds = [bird.fatherId, bird.motherId].filter((id): id is number => !!id);
      const parents = parentIds.length
        ? await db.select({ id: birds.id, ring: birds.ring, displayTitle: birds.displayTitle, sex: birds.sex }).from(birds).where(inArray(birds.id, parentIds))
        : [];
      const father = parents.find((p) => p.id === bird.fatherId) ?? null;
      const mother = parents.find((p) => p.id === bird.motherId) ?? null;

      // Premiações — só resultados já julgados (score existente), com nome
      // e data do concurso. Não expõe critérios detalhados de julgamento.
      const entries = await db.select().from(championship_entries).where(eq(championship_entries.birdId, bird.id));
      let awards: Array<{ championshipName: string; date: Date; category: string; placement: number | null; totalScore: number }> = [];
      if (entries.length > 0) {
        const entryIds = entries.map((e) => e.id);
        const [entryScores, champs] = await Promise.all([
          db.select().from(scores).where(inArray(scores.entryId, entryIds)),
          db.select().from(championships).where(inArray(championships.id, entries.map((e) => e.championshipId))),
        ]);
        const champById = new Map(champs.map((c) => [c.id, c]));
        awards = entryScores
          .map((s) => {
            const entry = entries.find((e) => e.id === s.entryId)!;
            const champ = champById.get(entry.championshipId);
            if (!champ) return null;
            return { championshipName: champ.name, date: champ.startDate, category: entry.category, placement: s.placement, totalScore: s.totalScore };
          })
          .filter((a): a is NonNullable<typeof a> => !!a)
          .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
      }

      // Mutações com rótulo legível em vez do código interno.
      const mutations = ((genotype?.mutations as Array<{ mutation: string; zygosity: string }> | null) ?? [])
        .map((m) => {
          const cfg = (MUTATION_CONFIG as any)[m.mutation];
          const zygosityLabel =
            m.zygosity === "homozygous_mutant" ? "Visual (manifesta)" :
            m.zygosity === "heterozygous_carrier" ? "Portador" : "Normal";
          return { id: m.mutation, label: cfg?.label ?? m.mutation, zygosity: m.zygosity, zygosityLabel };
        })
        .filter((m) => m.zygosity !== "homozygous_normal");

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
        pattern: (genotype as any)?.pattern ?? null,
        hasCrest: genotype?.hasCrest ?? false,
        backgroundColor: genotype?.backgroundColor ?? null,
        mutations,
        father: father ? { ring: father.ring, displayTitle: father.displayTitle } : null,
        mother: mother ? { ring: mother.ring, displayTitle: mother.displayTitle } : null,
        awards,
        breederName: tenantRow?.name ?? null,
        breederSlug: tenantRow?.publicSlug || tenantRow?.slug || null,
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
