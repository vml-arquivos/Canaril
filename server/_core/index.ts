import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./staticServe";
import { ensureDatabaseReady } from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Garante conexão com o banco e aplica migrations pendentes ANTES de
  // aceitar qualquer requisição. Se falhar, o processo encerra com código
  // de saída != 0 — isso faz o Coolify mostrar o deploy como falho de forma
  // clara, em vez de subir um servidor "no ar" mas com login/banco quebrado.
  try {
    await ensureDatabaseReady();
  } catch (error) {
    console.error("[Startup] Falha crítica ao preparar o banco de dados. Encerrando processo.");
    console.error(error);
    process.exit(1);
  }

  // Popula o catálogo oficial de classes (FOB/OBJO) se ainda não estiver
  // populado. Idempotente (ON CONFLICT DO NOTHING) — seguro rodar em todo
  // boot. Não-crítico: se falhar, registra aviso mas não derruba o servidor
  // (diferente das migrations de schema, que são bloqueantes).
  try {
    const { seedOfficialClasses } = await import("./officialClassesSeed");
    const result = await seedOfficialClasses();
    console.log(`[Startup] Catálogo oficial: ${result.inserted} classes novas, ${result.skipped} já existiam.`);
  } catch (error) {
    console.warn("[Startup] Aviso: não foi possível popular o catálogo oficial de classes (sistema continua funcionando normalmente).");
    console.warn(error);
  }

  const app = express();
  const server = createServer(app);
  // Health check endpoint
  app.get('/health', (_req, res) => res.json({ ok: true }));
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode usa o middleware do Vite (HMR); production usa os
  // arquivos estáticos já buildados. O import de "./viteDevServer" é
  // dinâmico e marcado --external no esbuild (ver package.json), então
  // nunca entra no bundle de produção nem é resolvido em runtime de
  // produção, onde "vite" e seus plugins (devDependencies) nem existem.
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./viteDevServer");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
