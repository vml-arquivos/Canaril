import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { birdsRouter } from "./routers/birds";
import { managementRouter } from "./routers/management";
import * as db from "./db";

const localOpenIdForEmail = (email: string) => `local:${email.toLowerCase()}`;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ENV.databaseUrl || !ENV.cookieSecret) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Configuração incompleta. Defina DATABASE_URL e JWT_SECRET no ambiente.",
          });
        }

        if (!ENV.adminEmail || !ENV.adminPassword) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Login local não configurado. Defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente.",
          });
        }

        const normalizedEmail = input.email.trim().toLowerCase();
        const isValidLogin =
          normalizedEmail === ENV.adminEmail.trim().toLowerCase() &&
          input.password === ENV.adminPassword;

        if (!isValidLogin) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha inválidos" });
        }

        const openId = ENV.ownerOpenId || localOpenIdForEmail(normalizedEmail);
        const name = ENV.adminName || "Administrador";

        await db.upsertUser({
          openId,
          name,
          email: normalizedEmail,
          loginMethod: "local",
          role: "admin",
          lastSignedIn: new Date(),
        });

        const sessionToken = await sdk.createSessionToken(openId, {
          name,
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return { success: true } as const;
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
});

export type AppRouter = typeof appRouter;
