// ATENÇÃO: este arquivo só deve ser importado dinamicamente
// (await import("./viteDevServer")) e somente dentro do branch
// `NODE_ENV === "development"` em server/_core/index.ts.
//
// Ele é marcado como --external no comando de build do esbuild
// (ver package.json -> scripts.build), ou seja, NUNCA é incluído
// no bundle de produção (dist/index.js). Isso é essencial porque
// "vite" e "../../vite.config" (que por sua vez importa
// @vitejs/plugin-react, @tailwindcss/vite,
// @builder.io/vite-plugin-jsx-loc e vite-plugin-manus-runtime) são
// todas devDependencies, que NÃO existem no node_modules da imagem
// de produção (instalada só com `pnpm install --frozen-lockfile --prod`).
//
// Se este código fosse inlinado no bundle de produção, o Node.js
// tentaria resolver essas imports estáticas no boot do container e
// quebraria com ERR_MODULE_NOT_FOUND, mesmo que setupVite() nunca
// seja chamado em produção.
import { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";

export async function setupVite(app: Express, server: Server) {
  const { createServer: createViteServer } = await import("vite");
  const { default: viteConfig } = await import("../../vite.config");

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
