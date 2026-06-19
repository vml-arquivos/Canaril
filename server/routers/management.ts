import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { birds, ring_batches, rings, couples, clutches, chicks } from "../../drizzle/schema";
import { and, eq, desc } from "drizzle-orm";

async function generateRingsForBatch(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, batchId: number, batchNumber: string, quantityTotal: number) {
  const safeQuantity = Math.max(0, Math.min(quantityTotal, 5000));
  const pad = Math.max(3, String(safeQuantity).length);
  const now = new Date();

  for (let start = 1; start <= safeQuantity; start += 500) {
    const end = Math.min(start + 499, safeQuantity);
    const values = [];
    for (let sequence = start; sequence <= end; sequence++) {
      values.push({
        batchId,
        number: `${batchNumber}-${String(sequence).padStart(pad, "0")}`,
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
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      try {
        return await db.select().from(ring_batches).orderBy(desc(ring_batches.createdAt));
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
        quantity_total: z.number().default(100),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        try {
          const [createdBatch] = await db.insert(ring_batches).values({
            batch_number: input.batch_number,
            year: input.year,
            color: input.color || "Padrão",
            quantity_total: input.quantity_total,
            quantity_used: 0,
            status: "available",
          }).returning();

          if (createdBatch) {
            await generateRingsForBatch(db, createdBatch.id, createdBatch.batch_number, createdBatch.quantity_total);
          }

          return { success: true, batch: createdBatch };
        } catch (error) {
          console.error("Error creating ring batch:", error);
          throw error;
        }
      }),
  }),

  // ===== CRUZAMENTOS/CASAIS =====
  couples: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      try {
        return await db.select().from(couples).orderBy(desc(couples.createdAt));
      } catch (error) {
        console.error("Error listing couples:", error);
        return [];
      }
    }),

    getById: protectedProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        try {
          const result = await db.select().from(couples).where(eq(couples.id, input)).limit(1);
          return result.length > 0 ? result[0] : null;
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
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        try {
          await db.insert(couples).values({
            maleId: input.maleId,
            femaleId: input.femaleId,
            cageNumber: input.cageNumber,
            formationDate: input.formationDate,
            status: "active",
          });
          return { success: true };
        } catch (error) {
          console.error("Error creating couple:", error);
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
