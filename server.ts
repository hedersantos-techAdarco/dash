import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import app from "./api/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    // Carregamento dinâmico do Vite para evitar problemas em produção
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    
    app.use(vite.middlewares);
    
    // Fallback para o index.html no desenvolvimento (necessário para SPA logic em alguns setups)
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Servir arquivos estáticos em produção
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Adarco] Server running at http://0.0.0.0:${PORT} (ENV: ${process.env.NODE_ENV || 'development'})`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
