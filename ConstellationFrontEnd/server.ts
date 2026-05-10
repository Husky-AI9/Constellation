import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_TARGET = process.env.VITE_API_BASE_URL || "https://google-backend-655371403841.us-west1.run.app";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // We have to dynamically import http-proxy-middleware because it's ESM/CJS mixed sometimes, but let's just make a simple proxy
  // Wait, let's install http-proxy-middleware.
  
  // Or just forward fetch requests if we don't want to install extra stuff.
  // Actually, http-proxy-middleware is perfect for this. I'll add it via tool.
  // But for now let's just write the server.ts that uses it.
  const { createProxyMiddleware } = await import('http-proxy-middleware');

  app.use('/api', createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
  }));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
