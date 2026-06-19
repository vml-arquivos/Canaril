import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { birds } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

export const birdsRouter = router({
  // Listar todos os pássaros
  list: protectedProcedure
    .input(z.object({
      specialty: z.string().optional(),
      status: z.string().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      try {
        const results = await db.select().from(birds).orderBy(desc(birds.createdAt));
        return results;
      } catch (error) {
        console.error("Error listing birds:", error);
        return [];
      }
    }),

  // Obter pássaro por ID
  getById: protectedProcedure
    .input(z.number())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      try {
        const result = await db.select().from(birds).where(eq(birds.id, input));
        return result[0] || null;
      } catch (error) {
        console.error("Error getting bird:", error);
        return null;
      }
    }),

  // Criar novo pássaro
  create: protectedProcedure
    .input(z.object({
      ring: z.string(),
      specialty: z.string(),
      sex: z.string(),
      color: z.string(),
      birthDate: z.date().optional(),
      procedence: z.string().optional(),
      fatherId: z.number().optional(),
      motherId: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        const result = await db.insert(birds).values({
          ring: input.ring,
          specialty: input.specialty,
          sex: input.sex,
          color: input.color,
          birthDate: input.birthDate,
          procedence: input.procedence,
          fatherId: input.fatherId,
          motherId: input.motherId,
          notes: input.notes,
          status: "ativo",
        });

        return { success: true };
      } catch (error) {
        console.error("Error creating bird:", error);
        throw error;
      }
    }),

  // Atualizar pássaro
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      ring: z.string().optional(),
      specialty: z.string().optional(),
      sex: z.string().optional(),
      color: z.string().optional(),
      birthDate: z.date().optional(),
      procedence: z.string().optional(),
      status: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        const { id, ...updates } = input;
        await db.update(birds).set(updates).where(eq(birds.id, id));
        return { success: true };
      } catch (error) {
        console.error("Error updating bird:", error);
        throw error;
      }
    }),

  // Deletar pássaro
  delete: protectedProcedure
    .input(z.number())
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      try {
        await db.delete(birds).where(eq(birds.id, input));
        return { success: true };
      } catch (error) {
        console.error("Error deleting bird:", error);
        throw error;
      }
    }),

  // Obter genealogia (pais, avós, bisavós)
  getGenealogy: protectedProcedure
    .input(z.number())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      try {
        const bird = await db.select().from(birds).where(eq(birds.id, input));
        if (!bird[0]) return null;

        const genealogy: any = {
          current: bird[0],
          father: null,
          mother: null,
          paternal_grandfather: null,
          paternal_grandmother: null,
          maternal_grandfather: null,
          maternal_grandmother: null,
        };

        if (bird[0].fatherId) {
          const father = await db.select().from(birds).where(eq(birds.id, bird[0].fatherId));
          genealogy.father = father[0];

          if (father[0]?.fatherId) {
            const pgf = await db.select().from(birds).where(eq(birds.id, father[0].fatherId));
            genealogy.paternal_grandfather = pgf[0];
          }
          if (father[0]?.motherId) {
            const pgm = await db.select().from(birds).where(eq(birds.id, father[0].motherId));
            genealogy.paternal_grandmother = pgm[0];
          }
        }

        if (bird[0].motherId) {
          const mother = await db.select().from(birds).where(eq(birds.id, bird[0].motherId));
          genealogy.mother = mother[0];

          if (mother[0]?.fatherId) {
            const mgf = await db.select().from(birds).where(eq(birds.id, mother[0].fatherId));
            genealogy.maternal_grandfather = mgf[0];
          }
          if (mother[0]?.motherId) {
            const mgm = await db.select().from(birds).where(eq(birds.id, mother[0].motherId));
            genealogy.maternal_grandmother = mgm[0];
          }
        }

        return genealogy;
      } catch (error) {
        console.error("Error getting genealogy:", error);
        return null;
      }
    }),

  // Listar pássaros disponíveis para cruzamento (por sexo)
  getAvailableBySex: protectedProcedure
    .input(z.string())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      try {
        const result = await db
          .select()
          .from(birds)
          .where(and(eq(birds.sex, input), eq(birds.status, "ativo")))
          .orderBy(desc(birds.createdAt));

        return result;
      } catch (error) {
        console.error("Error getting available birds:", error);
        return [];
      }
    }),
});
