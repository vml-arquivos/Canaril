import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { rings, couples, clutches, chicks } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const managementRouter = router({
  // ===== ANILHAS =====
  rings: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      try {
        return await db.select().from(rings).orderBy(desc(rings.createdAt));
      } catch (error) {
        console.error("Error listing rings:", error);
        return [];
      }
    }),

    create: protectedProcedure
      .input(z.object({
        number: z.string(),
        year: z.number(),
        color: z.string().optional(),
        quantity: z.number().default(1),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        try {
          await db.insert(rings).values({
            number: input.number,
            year: input.year,
            color: input.color,
            quantity: input.quantity,
            usedQuantity: 0,
            status: "disponível",
          });
          return { success: true };
        } catch (error) {
          console.error("Error creating ring:", error);
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

    create: protectedProcedure
      .input(z.object({
        maleId: z.number(),
        femaleId: z.number(),
        cageNumber: z.string().optional(),
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
            status: "ativo",
          });
          return { success: true };
        } catch (error) {
          console.error("Error creating couple:", error);
          throw error;
        }
      }),

    getById: protectedProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        try {
          const result = await db.select().from(couples).where(eq(couples.id, input));
          return result[0] || null;
        } catch (error) {
          console.error("Error getting couple:", error);
          return null;
        }
      }),
  }),

  // ===== POSTURAS =====
  clutches: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      try {
        return await db.select().from(clutches).orderBy(desc(clutches.clutchDate));
      } catch (error) {
        console.error("Error listing clutches:", error);
        return [];
      }
    }),

    create: protectedProcedure
      .input(z.object({
        coupleId: z.number(),
        clutchDate: z.date(),
        totalEggs: z.number().default(0),
        fertilizedEggs: z.number().default(0),
        infertileEggs: z.number().default(0),
        lostEggs: z.number().default(0),
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
            infertileEggs: input.infertileEggs,
            lostEggs: input.lostEggs,
            hatchedChicks: 0,
          });
          return { success: true };
        } catch (error) {
          console.error("Error creating clutch:", error);
          throw error;
        }
      }),

    getByCoupleId: protectedProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        try {
          return await db.select().from(clutches).where(eq(clutches.coupleId, input));
        } catch (error) {
          console.error("Error getting clutches:", error);
          return [];
        }
      }),
  }),

  // ===== FILHOTES =====
  chicks: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      try {
        return await db.select().from(chicks).orderBy(desc(chicks.birthDate));
      } catch (error) {
        console.error("Error listing chicks:", error);
        return [];
      }
    }),

    create: protectedProcedure
      .input(z.object({
        clutchId: z.number(),
        ring: z.string().optional(),
        sex: z.string().optional(),
        color: z.string().optional(),
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
            color: input.color,
            birthDate: input.birthDate,
            ringDate: input.ringDate,
            weanDate: input.weanDate,
            status: "ativo",
          });
          return { success: true };
        } catch (error) {
          console.error("Error creating chick:", error);
          throw error;
        }
      }),

    getByClutchId: protectedProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        try {
          return await db.select().from(chicks).where(eq(chicks.clutchId, input));
        } catch (error) {
          console.error("Error getting chicks:", error);
          return [];
        }
      }),
  }),

  // ===== DASHBOARD =====
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { birds: 0, couples: 0, chicks: 0, rings: 0 };

      try {
        const birdsList = await db.select().from(rings);
        const couplesList = await db.select().from(couples);
        const chicksList = await db.select().from(chicks);
        const ringsList = await db.select().from(rings);

        return {
          birds: birdsList.length,
          couples: couplesList.length,
          chicks: chicksList.length,
          rings: ringsList.reduce((sum, r) => sum + (r.quantity - r.usedQuantity), 0),
        };
      } catch (error) {
        console.error("Error getting stats:", error);
        return { birds: 0, couples: 0, chicks: 0, rings: 0 };
      }
    }),
  }),
});
