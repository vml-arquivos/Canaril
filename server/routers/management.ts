import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { birds, ring_batches, couples, clutches, chicks } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

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
          await db.insert(ring_batches).values({
            batch_number: input.batch_number,
            year: input.year,
            color: input.color || "Padrão",
            quantity_total: input.quantity_total,
            quantity_used: 0,
            status: "available",
          });
          return { success: true };
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
          await db.insert(chicks).values({
            clutchId: input.clutchId,
            ring: input.ring,
            sex: input.sex,
            color_code: input.color_code,
            birthDate: input.birthDate,
            ringDate: input.ringDate,
            weanDate: input.weanDate,
            status: "active",
          });
          return { success: true };
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
        const ringsList = await db.select().from(ring_batches);

        return {
          birds: birdsList.length,
          couples: couplesList.filter((c) => c.status === "active").length,
          chicks: chicksList.length,
          rings: ringsList.reduce((sum, r) => sum + (r.quantity_total - r.quantity_used), 0),
        };
      } catch (error) {
        console.error("Error getting dashboard stats:", error);
        return { birds: 0, couples: 0, chicks: 0, rings: 0 };
      }
    }),
  }),
});
