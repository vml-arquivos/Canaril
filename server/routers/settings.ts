import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { breeder_settings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const FALLBACK_SETTINGS = {
  id: 1,
  name: "Meu Criadouro",
  city: null,
  state: null,
  address: null,
  phone: null,
  email: null,
  website: null,
  description: null,
  logoUrl: null,
  updatedAt: new Date(),
};

export const settingsRouter = router({
  // Leitura pública: a Home institucional e a Ficha de Gaiola impressa
  // precisam exibir nome/contato do criadouro sem exigir login.
  get: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return FALLBACK_SETTINGS;
    try {
      const [settings] = await db.select().from(breeder_settings).where(eq(breeder_settings.id, 1));
      return settings ?? FALLBACK_SETTINGS;
    } catch (error) {
      console.error("Error reading breeder settings:", error);
      return FALLBACK_SETTINGS;
    }
  }),

  update: protectedProcedure
    .input(z.object({
      name: z.string().trim().min(1, "Informe o nome do criadouro"),
      city: z.string().trim().optional(),
      state: z.string().trim().max(2).optional(),
      address: z.string().trim().optional(),
      phone: z.string().trim().optional(),
      email: z.string().trim().optional(),
      website: z.string().trim().optional(),
      description: z.string().trim().optional(),
      logoUrl: z.string().trim().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");

      const existing = await db.select().from(breeder_settings).where(eq(breeder_settings.id, 1));

      if (existing.length === 0) {
        await db.insert(breeder_settings).values({ id: 1, ...input });
      } else {
        await db.update(breeder_settings).set({ ...input, updatedAt: new Date() }).where(eq(breeder_settings.id, 1));
      }

      return { success: true };
    }),
});
