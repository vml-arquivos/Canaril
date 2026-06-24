import { z } from "zod";
import { protectedProcedure, router, requireTenantAccess } from "../_core/trpc";
import { getDb, getPool } from "../db";
import { birds, ring_batches, rings, couples, clutches, chicks, breeding_reminders } from "../../drizzle/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import { generateBreedingReminders } from "../_core/breeding";

async function generateRingsForBatch(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, batchId: number, year: number, startNumber: number, endNumber: number) {
  const now = new Date();

  for (let chunkStart = startNumber; chunkStart <= endNumber; chunkStart += 500) {
    const chunkEnd = Math.min(chunkStart + 499, endNumber);
    const values = [];
    for (let sequence = chunkStart; sequence <= chunkEnd; sequence++) {
      values.push({
        batchId,
        number: `${year}-${String(sequence).padStart(3, "0")}`,
        sequence,
        status: "available",
        createdAt: now,
        updatedAt: now,
      });
    }
    if (values.length > 0) {
      await db.insert(rings).values(values).onConflictDoNothing();
    }
  }
}

async function markRingAsUsed(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, ringNumber: string, patch: { birdId?: number; chickId?: number }) {
  await db
    .update(rings)
    .set({
      ...patch,
      status: "in_use",
      usedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(rings.number, ringNumber), eq(rings.status, "available")));
}

export const managementRouter = router({
  // ===== ANILHAS =====
  rings: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const tenantId = (ctx.user as any)?.tenantId ?? null;
        let query: any = db.select().from(ring_batches);
        if (tenantId !== null && tenantId !== undefined) {
          query = query.where(eq(ring_batches.tenantId, tenantId));
        }
        return await query.orderBy(desc(ring_batches.createdAt));
      } catch (error) {
        console.error("Error listing rings:", error);
        return [];
      }
    }),

    create: protectedProcedure
      .input(z.object({
        batch_number: z.string(),
        year: z.number(),
        color: z.string().optional(),
        startNumber: z.number().int().positive(),
        endNumber: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        if (input.endNumber < input.startNumber) {
          throw new Error("A numeração final deve ser maior ou igual à inicial");
        }
        const quantity_total = input.endNumber - input.startNumber + 1;
        if (quantity_total > 5000) {
          throw new Error("Lote muito grande (máximo 5000 anilhas por lote)");
        }

        try {
          const tenantId = (ctx.user as any)?.tenantId ?? null;
          const [createdBatch] = await db.insert(ring_batches).values({
            batch_number: input.batch_number,
            year: input.year,
            color: input.color || "Padrão",
            quantity_total,
            quantity_used: 0,
            status: "available",
            tenantId: tenantId,
          }).returning();

          if (createdBatch) {
            await generateRingsForBatch(db, createdBatch.id, createdBatch.year, input.startNumber, input.endNumber);
            // Após gerar as anilhas individuais, atualiza o tenantId delas
            if (tenantId !== null && tenantId !== undefined) {
              await db.update(rings).set({ tenantId: tenantId }).where(eq(rings.batchId, createdBatch.id));
            }
          }

          return { success: true, batch: createdBatch, generated: quantity_total };
        } catch (error) {
          console.error("Error creating ring batch:", error);
          throw error;
        }
      }),

    // Anilhas individuais disponíveis (para selects de cadastro de pássaro/filhote)
    listAvailable: protectedProcedure
      .input(z.object({ batchId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        try {
          const conditions = [eq(rings.status, "available")];
          if (input?.batchId) conditions.push(eq(rings.batchId, input.batchId));
          return await db.select().from(rings).where(and(...conditions)).orderBy(rings.sequence);
        } catch (error) {
          console.error("Error listing available rings:", error);
          return [];
        }
      }),

    // Todas as anilhas individuais de um lote (visão detalhada)
    listByBatch: protectedProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        try {
          return await db.select().from(rings).where(eq(rings.batchId, input)).orderBy(rings.sequence);
        } catch (error) {
          console.error("Error listing rings by batch:", error);
          return [];
        }
      }),

    // Edita cor/observações do lote. A faixa de numeração (início/fim) não
    // muda depois de gerada, pois isso já criou anilhas individuais reais.
    update: protectedProcedure
      .input(z.object({ id: z.number(), color: z.string().trim().optional(), status: z.string().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { id, ...fields } = input;
        await db.update(ring_batches).set({ ...fields, updatedAt: new Date() }).where(eq(ring_batches.id, id));
        return { success: true };
      }),

    // Remove o lote e as anilhas individuais ainda disponíveis dele. Anilhas
    // já em uso vinculadas a pássaros ATIVOS bloqueiam a remoção. Órfãs são ignoradas.
    delete: protectedProcedure
      .input(z.number())
      .mutation(async ({ input }) => {
        const db = await getDb();
        const pool = getPool();
        if (!db || !pool) throw new Error("Database not available");

        // Only block if rings are linked to an ACTIVE (non-deleted) bird
        const { rows: activeRows } = await pool.query<{ id: number }>(
          `SELECT r.id FROM rings r
           JOIN birds b ON b.id = r."birdId"
           WHERE r."batchId" = $1
             AND r.status = 'in_use'
             AND r."birdId" IS NOT NULL
             AND (b."deletedAt" IS NULL)
           LIMIT 1`,
          [input]
        );

        if (activeRows.length > 0) {
          throw new Error(`Este lote tem anilha(s) vinculada(s) a pássaro(s) ativo(s) e não pode ser removido. Use a opção "Reconciliar órfãs" se os pássaros já foram removidos.`);
        }

        await db.delete(rings).where(eq(rings.batchId, input));
        await db.delete(ring_batches).where(eq(ring_batches.id, input));
        return { success: true };
      }),
  }),

  // ===== CRUZAMENTOS/CASAIS =====
  couples: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const tenantId = (ctx.user as any)?.tenantId ?? null;
        let query: any = db.select().from(couples);
        if (tenantId !== null && tenantId !== undefined) {
          query = query.where(eq(couples.tenantId, tenantId));
        }
        return await query.orderBy(desc(couples.createdAt));
      } catch (error) {
        console.error("Error listing couples:", error);
        return [];
      }
    }),

    getById: protectedProcedure
      .input(z.number())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return null;
        try {
          const result = await db.select().from(couples).where(eq(couples.id, input)).limit(1);
          const couple = result.length > 0 ? result[0] : null;
          if (!couple) return null;
          const tenantId = (ctx.user as any)?.tenantId ?? null;
          if (tenantId !== null && tenantId !== undefined) {
            requireTenantAccess(ctx, couple.tenantId);
          }
          return couple;
        } catch (error) {
          console.error("Error getting couple:", error);
          return null;
        }
      }),

    create: protectedProcedure
      .input(z.object({
        maleId: z.number(),
        femaleId: z.number(),
        cageNumber: z.string(),
        formationDate: z.date(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        try {
          const tenantId = (ctx.user as any)?.tenantId ?? null;
          // Filtra casais ativos do mesmo tenant
          const activeCouples = await db.select().from(couples).where(
            and(eq(couples.status, "active"), tenantId !== null && tenantId !== undefined ? eq(couples.tenantId, tenantId) : sql`1=1`)
          );
          const maleTaken = activeCouples.find((c) => c.maleId === input.maleId || c.femaleId === input.maleId);
          const femaleTaken = activeCouples.find((c) => c.maleId === input.femaleId || c.femaleId === input.femaleId);
          if (maleTaken) {
            throw new Error("Este pássaro (macho) já está em outro casal ativo. Desfaça o casal anterior primeiro.");
          }
          if (femaleTaken) {
            throw new Error("Este pássaro (fêmea) já está em outro casal ativo. Desfaça o casal anterior primeiro.");
          }

          await db.insert(couples).values({
            maleId: input.maleId,
            femaleId: input.femaleId,
            cageNumber: input.cageNumber,
            formationDate: input.formationDate,
            status: "active",
            tenantId: tenantId,
          });

          const [createdCouple] = await db
            .select()
            .from(couples)
            .where(and(eq(couples.maleId, input.maleId), eq(couples.femaleId, input.femaleId)))
            .orderBy(desc(couples.id))
            .limit(1);

          if (createdCouple) {
            const seeds = generateBreedingReminders(input.formationDate);
            await db.insert(breeding_reminders).values(
              seeds.map((s) => ({
                coupleId: createdCouple.id,
                eventType: s.eventType,
                expectedDate: s.expectedDate,
                notes: s.notes,
              }))
            );
          }

          return { success: true };
        } catch (error) {
          console.error("Error creating couple:", error);
          throw error;
        }
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        maleId: z.number().optional(),
        femaleId: z.number().optional(),
        cageNumber: z.string().optional(),
        formationDate: z.date().optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { id, ...fields } = input;
        try {
          const [existing] = await db.select().from(couples).where(eq(couples.id, id));
          if (!existing) {
            throw new Error("Casal não encontrado.");
          }
          const tenantId = (ctx.user as any)?.tenantId ?? null;
          if (tenantId !== null && tenantId !== undefined) {
            requireTenantAccess(ctx, existing.tenantId);
          }
          // Mesma validação do create, mas ignorando o próprio casal sendo
          if (input.maleId !== undefined || input.femaleId !== undefined) {
            const checkMaleId = input.maleId ?? existing?.maleId;
            const checkFemaleId = input.femaleId ?? existing?.femaleId;
            const activeCouples = await db.select().from(couples).where(and(eq(couples.status, "active"), tenantId !== null && tenantId !== undefined ? eq(couples.tenantId, tenantId) : sql`1=1`));
            const maleTaken = activeCouples.find((c) => c.id !== id && (c.maleId === checkMaleId || c.femaleId === checkMaleId));
            const femaleTaken = activeCouples.find((c) => c.id !== id && (c.maleId === checkFemaleId || c.femaleId === checkFemaleId));
            if (maleTaken) {
              throw new Error("Este pássaro (macho) já está em outro casal ativo.");
            }
            if (femaleTaken) {
              throw new Error("Este pássaro (fêmea) já está em outro casal ativo.");
            }
          }
          await db.update(couples).set({ ...fields, updatedAt: new Date() }).where(eq(couples.id, id));
          return { success: true };
        } catch (error) {
          console.error("Error updating couple:", error);
          throw error;
        }
      }),

    delete: protectedProcedure
      .input(z.number())
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        try {
          const [existing] = await db.select().from(couples).where(eq(couples.id, input));
          if (!existing) {
            throw new Error("Casal não encontrado.");
          }
          const tenantId = (ctx.user as any)?.tenantId ?? null;
          if (tenantId !== null && tenantId !== undefined) {
            requireTenantAccess(ctx, existing.tenantId);
          }
          await db.delete(couples).where(eq(couples.id, input));
          return { success: true };
        } catch (error) {
          console.error("Error deleting couple:", error);
          throw error;
        }
      }),
  }),

  // ===== POSTURAS =====
  clutches: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      try {
        return await db.select().from(clutches).orderBy(desc(clutches.createdAt));
      } catch (error) {
        console.error("Error listing clutches:", error);
        return [];
      }
    }),

    getByCoupleId: protectedProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        try {
          return await db.select().from(clutches).where(eq(clutches.coupleId, input)).orderBy(desc(clutches.clutchDate));
        } catch (error) {
          console.error("Error getting clutches by couple:", error);
          return [];
        }
      }),

    create: protectedProcedure
      .input(z.object({
        coupleId: z.number(),
        clutchDate: z.date(),
        totalEggs: z.number(),
        fertilizedEggs: z.number(),
        infertileEggs: z.number().optional(),
        lostEggs: z.number().optional(),
        hatchedChicks: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        try {
          await db.insert(clutches).values({
            coupleId: input.coupleId,
            clutchDate: input.clutchDate,
            totalEggs: input.totalEggs,
            fertilizedEggs: input.fertilizedEggs,
            infertileEggs: input.infertileEggs || 0,
            lostEggs: input.lostEggs || 0,
            hatchedChicks: input.hatchedChicks || 0,
          });
          return { success: true };
        } catch (error) {
          console.error("Error creating clutch:", error);
          throw error;
        }
      }),
  }),

  // ===== FILHOTES =====
  chicks: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      try {
        return await db.select().from(chicks).orderBy(desc(chicks.createdAt));
      } catch (error) {
        console.error("Error listing chicks:", error);
        return [];
      }
    }),

    getByClutchId: protectedProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        try {
          return await db.select().from(chicks).where(eq(chicks.clutchId, input)).orderBy(desc(chicks.birthDate));
        } catch (error) {
          console.error("Error getting chicks by clutch:", error);
          return [];
        }
      }),

    create: protectedProcedure
      .input(z.object({
        clutchId: z.number(),
        ring: z.string(),
        sex: z.string(),
        color_code: z.string(),
        birthDate: z.date(),
        ringDate: z.date().optional(),
        weanDate: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        try {
          const [createdChick] = await db.insert(chicks).values({
            clutchId: input.clutchId,
            ring: input.ring,
            sex: input.sex,
            color_code: input.color_code,
            birthDate: input.birthDate,
            ringDate: input.ringDate,
            weanDate: input.weanDate,
            status: "active",
          }).returning();

          if (createdChick) {
            await markRingAsUsed(db, createdChick.ring, { chickId: createdChick.id });
          }

          return { success: true, chick: createdChick };
        } catch (error) {
          console.error("Error creating chick:", error);
          throw error;
        }
      }),
  }),

  // ===== ESTATÍSTICAS =====
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { birds: 0, couples: 0, chicks: 0, rings: 0 };

      try {
        const birdsList = await db.select().from(birds);
        const couplesList = await db.select().from(couples);
        const chicksList = await db.select().from(chicks);
        const individualRings = await db.select().from(rings);
        const ringBatches = await db.select().from(ring_batches);

        const availableIndividualRings = individualRings.filter((r) => r.status === "available").length;
        const legacyAvailableRings = ringBatches.reduce((sum, r) => sum + Math.max(0, r.quantity_total - r.quantity_used), 0);

        return {
          birds: birdsList.length,
          couples: couplesList.filter((c) => c.status === "active").length,
          chicks: chicksList.length,
          rings: availableIndividualRings || legacyAvailableRings,
        };
      } catch (error) {
        console.error("Error getting dashboard stats:", error);
        return { birds: 0, couples: 0, chicks: 0, rings: 0 };
      }
    }),
  }),
});
