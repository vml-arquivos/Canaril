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
// Drizzle helper for equality
// Import equality helper and users table definition for login queries
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { managementRouter } from "./routers/management";
import { aiJudgeRouter } from "./routers/aiJudge";
import { cagesRouter } from "./routers/cages";
import { photosRouter } from "./routers/photos";
import { championshipsRouter } from "./routers/championships";
import { reportsRouter } from "./routers/reports";
import { showroomRouter } from "./routers/showroom";
import { movementsRouter } from "./routers/movements";
import { suppliesRouter }  from "./routers/supplies";
import { settingsRouter }  from "./routers/settings";
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
import { adminResetRouter } from "./routers/adminReset";

// Sanitiza o objeto de usuário antes de enviar ao cliente
// NUNCA expor: passwordHash, internalNote, disabledReason, disabledBy, disabledAt, accessExpiresAt
function sanitizeUser(u: any) {
  if (!u) return null;
  return {
    id: u.id,
    openId: u.openId,
    name: u.name,
    email: u.email,
    loginMethod: u.loginMethod,
    role: u.role,
    tenantId: u.tenantId ?? null,
    isActive: u.isActive ?? true,
    mustChangePassword: u.mustChangePassword ?? false,
    lastLoginAt: u.lastLoginAt ?? null,
    createdAt: u.createdAt ?? null,
  };
}



const normalize = (value: string | undefined | null) => (value ?? "").trim();

export const appRouter = router({
  system: systemRouter,
  auth: router({
    // auth.me retorna somente campos seguros — NUNCA passwordHash, disabledReason, internalNote
    me: publicProcedure.query(opts => {
      const u = opts.ctx.user as any;
      if (!u) return null;
      return {
        id:               u.id,
        openId:           u.openId,
        name:             u.name,
        email:            u.email,
        loginMethod:      u.loginMethod,
        role:             u.role,
        tenantId:         u.tenantId ?? null,
        isActive:         u.isActive ?? true,
        mustChangePassword: u.mustChangePassword ?? false,
        lastLoginAt:      u.lastLoginAt ?? null,
        createdAt:        u.createdAt ?? null,
      };
    }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email("Informe um e-mail válido"),
          password: z.string().min(1, "Informe a senha"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Normaliza variáveis de ambiente do administrador principal
        const adminEmail = normalize(process.env.ADMIN_EMAIL).toLowerCase();
        const adminPassword = normalize(process.env.ADMIN_PASSWORD);
        const adminName = normalize(process.env.ADMIN_NAME) || normalize(process.env.OWNER_NAME) || "Administrador";
        const adminOpenId = normalize(ENV.ownerOpenId) || "local-admin";

        // Se credenciais de admin não estiverem configuradas, falha
        if (!adminEmail || !adminPassword) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "ADMIN_EMAIL e ADMIN_PASSWORD não foram configurados no ambiente.",
          });
        }

        // Fluxo legacy: se email e senha batem com admin principal, efetua login como PLATFORM_ADMIN
        if (input.email.trim().toLowerCase() === adminEmail && input.password === adminPassword) {
          await db.upsertUser({
            openId: adminOpenId,
            name: adminName,
            email: adminEmail,
            loginMethod: "local-admin",
            role: "PLATFORM_ADMIN",
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
          return { success: true, user: sanitizeUser(createdUser) } as const;
        }

        // Novo fluxo: buscar usuário no banco
        const dbConn = await db.getDb?.();
        if (!dbConn) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco não disponível." });
        }
        const found = await dbConn.select().from(users).where(eq(users.email, input.email)).limit(1);
        const user = found?.[0];
        if (!user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
        }
        // Verificar se possui senha cadastrada
        if (!user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
        }
        // Verificar se está ativo
        if (user.isActive === false) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Seu acesso está suspenso. Entre em contato com o administrador." });
        }
        // Verificar expiração
        if (user.accessExpiresAt && new Date(user.accessExpiresAt) < new Date()) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Seu acesso expirou. Entre em contato com o administrador." });
        }
        // Verificar senha: scrypt com o mesmo sal
        const crypto = await import("crypto");
        const derived: string = await new Promise((resolve, reject) => {
          crypto.scrypt(input.password, "canaril-salt", 64, (err: any, derivedKey: Buffer) => {
            if (err) return reject(err);
            resolve(derivedKey.toString("hex"));
          });
        });
        if (derived !== user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
        }
        // Atualizar lastLoginAt
        await dbConn.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
        // Criar token de sessão
        const sessionToken = await sdk.createSessionToken(user.openId ?? "", {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true, user: sanitizeUser(user) } as const;
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
  settings:  settingsRouter,
  movements: movementsRouter,
  supplies:  suppliesRouter,
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
  adminReset: adminResetRouter,
});

export type AppRouter = typeof appRouter;
