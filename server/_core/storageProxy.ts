import type { Express } from "express";
import express from "express";
import { ENV } from "./env";

/**
 * Serve os arquivos gravados por storagePut (server/storage.ts) direto do
 * disco local, a partir do mesmo diretório usado pra gravação
 * (ENV.uploadsDir — deve apontar pro volume persistente montado no
 * Coolify). Usa express.static, que já cuida de cache headers, range
 * requests (importante pra fotos grandes/preview) e mime type por
 * extensão — sem precisar reimplementar nada disso na mão.
 */
export function registerStorageProxy(app: Express) {
  app.use("/uploads", express.static(ENV.uploadsDir, {
    maxAge: "30d",
    fallthrough: true,
  }));

  // Mantém a rota antiga (/manus-storage/*) respondendo 404 claro, em vez
  // de erro genérico, caso algum link antigo (de uma tentativa anterior
  // com Forge) ainda esteja em cache em algum lugar.
  app.get("/manus-storage/*", (_req, res) => {
    res.status(404).send("Este caminho de armazenamento não é mais usado. Os arquivos agora ficam em /uploads.");
  });
}
