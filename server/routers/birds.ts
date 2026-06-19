import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { birds, rings } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

export const birdsRouter = router({
  // Listar todos os pássaros
  list: protectedProcedure
    .input(z.object({
      specialty_code: z.string().optional(),
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
      specialty_code: z.string(),
      sex: z.string(),
      color_code: z.string(),
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
        const [createdBird] = await db.insert(birds).values({
          ring: input.ring,
          specialty_code: input.specialty_code,
          sex: input.sex,
          color_code: input.color_code,
          birthDate: input.birthDate,
          procedence: input.procedence,
          fatherId: input.fatherId,
          motherId: input.motherId,
          notes: input.notes,
          status: "active",
        }).returning();

        if (createdBird) {
          await db
            .update(rings)
            .set({
              status: "in_use",
              birdId: createdBird.id,
              usedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(and(eq(rings.number, createdBird.ring), eq(rings.status, "available")));
        }

        return { success: true, bird: createdBird };
      } catch (error) {
        console.error("Error creating bird:", error);
        throw error;
      }
    }),

  // Editar pássaro
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      ring: z.string().optional(),
      specialty_code: z.string().optional(),
      sex: z.string().optional(),
      color_code: z.string().optional(),
      birthDate: z.date().optional(),
      procedence: z.string().optional(),
      fatherId: z.number().nullable().optional(),
      motherId: z.number().nullable().optional(),
      cageId: z.number().nullable().optional(),
      status: z.string().optional(),
      isPublic: z.boolean().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...fields } = input;
      try {
        await db.update(birds).set({ ...fields, updatedAt: new Date() }).where(eq(birds.id, id));
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
    .query(async ({ input: birdId }) => {
      const db = await getDb();
      if (!db) return null;

      try {
        const bird = await db.select().from(birds).where(eq(birds.id, birdId)).limit(1);
        if (!bird.length) return null;

        const currentBird = bird[0];
        let father = null;
        let mother = null;
        let paternal_grandfather = null;
        let paternal_grandmother = null;
        let maternal_grandfather = null;
        let maternal_grandmother = null;

        // Pais
        if (currentBird.fatherId) {
          const fatherResult = await db.select().from(birds).where(eq(birds.id, currentBird.fatherId)).limit(1);
          father = fatherResult[0] || null;

          // Avós paternos
          if (father && father.fatherId) {
            const pgResult = await db.select().from(birds).where(eq(birds.id, father.fatherId)).limit(1);
            paternal_grandfather = pgResult[0] || null;
          }
          if (father && father.motherId) {
            const pgmResult = await db.select().from(birds).where(eq(birds.id, father.motherId)).limit(1);
            paternal_grandmother = pgmResult[0] || null;
          }
        }

        if (currentBird.motherId) {
          const motherResult = await db.select().from(birds).where(eq(birds.id, currentBird.motherId)).limit(1);
          mother = motherResult[0] || null;

          // Avós maternos
          if (mother && mother.fatherId) {
            const mgResult = await db.select().from(birds).where(eq(birds.id, mother.fatherId)).limit(1);
            maternal_grandfather = mgResult[0] || null;
          }
          if (mother && mother.motherId) {
            const mgmResult = await db.select().from(birds).where(eq(birds.id, mother.motherId)).limit(1);
            maternal_grandmother = mgmResult[0] || null;
          }
        }

        return {
          current: currentBird,
          father,
          mother,
          paternal_grandfather,
          paternal_grandmother,
          maternal_grandfather,
          maternal_grandmother,
        };
      } catch (error) {
        console.error("Error getting genealogy:", error);
        return null;
      }
    }),
});
