import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { birdsRouter } from "./routers/birds";
import { managementRouter } from "./routers/management";
import { aiJudgeRouter } from "./routers/aiJudge";
import { cagesRouter } from "./routers/cages";
import { photosRouter } from "./routers/photos";
import { championshipsRouter } from "./routers/championships";
import { reportsRouter } from "./routers/reports";
import { showroomRouter } from "./routers/showroom";
import { settingsRouter } from "./routers/settings";
import { remindersRouter } from "./routers/reminders";
import { geneticsRouter } from "./routers/genetics";
import { healthRouter } from "./routers/health";
import { iotRouter } from "./routers/iot";
import { mendelianRouter } from "./routers/mendelian";
import { catalogRouter } from "./routers/catalog";
import { geneticProfileRouter } from "./routers/geneticProfile";
import { photoAnalysisRouter } from "./routers/photoAnalysis";
import { pairingOptimizerRouter } from "./routers/pairingOptimizer";
import { ringsRouter } from "./routers/rings";
import { qrcodeRouter } from "./routers/qrcode";
import { dailyCareRouter } from "./routers/dailyCare";
import { adminRouter } from "./routers/admin";
import { intelligenceRouter } from "./routers/intelligence";

const normalize = (value: string | undefined | null) => (value ?? "").trim();

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email("Informe um e-mail válido"),
          password: z.string().min(1, "Informe a senha"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const adminEmail = normalize(process.env.ADMIN_EMAIL).toLowerCase();
        const adminPassword = normalize(process.env.ADMIN_PASSWORD);
        const adminName = normalize(process.env.ADMIN_NAME) || normalize(process.env.OWNER_NAME) || "Administrador";
        const adminOpenId = normalize(ENV.ownerOpenId) || "local-admin";

        if (!adminEmail || !adminPassword) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "ADMIN_EMAIL e ADMIN_PASSWORD não foram configurados no ambiente.",
          });
        }

        if (input.email.trim().toLowerCase() !== adminEmail || input.password !== adminPassword) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "E-mail ou senha inválidos.",
          });
        }

        await db.upsertUser({
          openId: adminOpenId,
          name: adminName,
          email: adminEmail,
          loginMethod: "local-admin",
          role: "admin",
          lastSignedIn: new Date(),
        });

        const createdUser = await db.getUserByOpenId(adminOpenId);
        if (!createdUser) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Login validado, mas não foi possível criar/carregar o usuário no banco. Verifique DATABASE_URL e migrations.",
          });
        }

        const sessionToken = await sdk.createSessionToken(adminOpenId, {
          name: adminName,
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return {
          success: true,
          user: createdUser,
        } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  birds: birdsRouter,
  management: managementRouter,
  aiJudge: aiJudgeRouter,
  cages: cagesRouter,
  photos: photosRouter,
  championships: championshipsRouter,
  reports: reportsRouter,
  showroom: showroomRouter,
  settings: settingsRouter,
  reminders: remindersRouter,
  genetics: geneticsRouter,
  health: healthRouter,
  iot: iotRouter,
  mendelian: mendelianRouter,
  catalog: catalogRouter,
  geneticProfile: geneticProfileRouter,
  photoAnalysis: photoAnalysisRouter,
  pairingOptimizer: pairingOptimizerRouter,
  ringsV2: ringsRouter,
  qrcode: qrcodeRouter,
  dailyCare: dailyCareRouter,
  admin: adminRouter,
  intelligence: intelligenceRouter,
});

export type AppRouter = typeof appRouter;
