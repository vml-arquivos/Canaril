import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { birds, rings } from "../../drizzle/schema";
import { eq, desc, and, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Schema reutilizável para birthDate: aceita Date (superjson) ou string 'YYYY-MM-DD'
const birthDateSchema = z
  .union([z.date(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
  .optional()
  .nullable();

/** Normaliza birthDate para Date ou undefined, nunca Invalid Date */
function normalizeBirthDate(raw: Date | string | null | undefined): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  // string 'YYYY-MM-DD' — usa T12:00:00Z para evitar off-by-one de fuso
  const d = new Date(raw + "T12:00:00Z");
  return isNaN(d.getTime()) ? null : d;
}

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

  // Verificar se uma anilha já está em uso
  checkRingAvailable: protectedProcedure
    .input(z.object({ ring: z.string(), excludeBirdId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { available: true };
      const existing = await db
        .select({ id: birds.id })
        .from(birds)
        .where(eq(birds.ring, input.ring))
        .limit(1);
      const inUse = existing.length > 0 && existing[0].id !== input.excludeBirdId;
      return { available: !inUse };
    }),

  // Criar novo pássaro
  create: protectedProcedure
    .input(z.object({
      ring: z.string().min(1, "Anilha é obrigatória"),
      specialty_code: z.string().min(1, "Especialidade é obrigatória"),
      sex: z.string().min(1, "Sexo é obrigatório"),
      color_code: z.string().min(1, "Cor é obrigatória"),
      birthDate: birthDateSchema,
      procedence: z.string().optional().nullable(),
      fatherId: z.number().optional().nullable(),
      motherId: z.number().optional().nullable(),
      notes: z.string().optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });

      // Verifica unicidade da anilha na tabela birds
      const existing = await db
        .select({ id: birds.id })
        .from(birds)
        .where(eq(birds.ring, input.ring))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Anilha "${input.ring}" já está em uso por outro pássaro. Escolha outra anilha ou verifique o lote.`,
        });
      }

      const birthDate = normalizeBirthDate(input.birthDate);

      try {
        const [createdBird] = await db.insert(birds).values({
          ring: input.ring,
          specialty_code: input.specialty_code,
          sex: input.sex,
          color_code: input.color_code,
          birthDate: birthDate,
          procedence: input.procedence || null,
          fatherId: input.fatherId ?? null,
          motherId: input.motherId ?? null,
          notes: input.notes || null,
          status: "active",
        }).returning();

        if (createdBird) {
          // Marca a anilha como em uso na tabela rings (se existir lá)
          // Verifica tanto por number quanto por fullCode para compatibilidade
          await db
            .update(rings)
            .set({
              status: "in_use",
              birdId: createdBird.id,
              usedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(
              and(
                or(
                  eq(rings.number, createdBird.ring),
                  eq(rings.fullCode, createdBird.ring)
                ),
                eq(rings.status, "available")
              )
            );
        }

        return { success: true, bird: createdBird };
      } catch (error: any) {
        console.error("Error creating bird:", error);
        // Trata constraint de unicidade do banco (PostgreSQL code 23505)
        if (error?.code === "23505" || error?.message?.includes("unique")) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Anilha "${input.ring}" já está em uso. Escolha outra anilha.`,
          });
        }
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message ?? "Erro ao cadastrar pássaro. Tente novamente.",
        });
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
      birthDate: birthDateSchema,
      procedence: z.string().optional().nullable(),
      fatherId: z.number().nullable().optional(),
      motherId: z.number().nullable().optional(),
      cageId: z.number().nullable().optional(),
      status: z.string().optional(),
      isPublic: z.boolean().optional(),
      notes: z.string().optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });

      const { id, birthDate: rawBirthDate, ...fields } = input;

      // Normaliza birthDate se vier como string
      const birthDate = rawBirthDate !== undefined ? normalizeBirthDate(rawBirthDate) : undefined;

      try {
        const updateFields: Record<string, unknown> = { ...fields, updatedAt: new Date() };
        if (birthDate !== undefined) updateFields.birthDate = birthDate;

        await db.update(birds).set(updateFields as any).where(eq(birds.id, id));
        return { success: true };
      } catch (error: any) {
        console.error("Error updating bird:", error);
        if (error?.code === "23505" || error?.message?.includes("unique")) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Anilha já está em uso por outro pássaro.`,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message ?? "Erro ao atualizar pássaro.",
        });
      }
    }),

  // Deletar pássaro
  delete: protectedProcedure
    .input(z.number())
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });

      try {
        await db.delete(birds).where(eq(birds.id, input));
        return { success: true };
      } catch (error: any) {
        console.error("Error deleting bird:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message ?? "Erro ao deletar pássaro.",
        });
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
