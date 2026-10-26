import "dotenv/config";
import { existsSync } from "node:fs";
import path from "node:path";
import express from "express";
import { getSnapshot, getStatus, loadSnapshot, refresh } from "./pipeline";
import { aiEnabled, AI_MODEL } from "./rank/ai";

// In dev, PORT usually belongs to the Vite server (which proxies /api here), so it is ignored.
const DEV = process.argv.includes("--dev");
const PORT = Number(process.env.API_PORT) || (DEV ? 0 : Number(process.env.PORT)) || 8787;
const REFRESH_MINUTES = Math.max(5, Number(process.env.REFRESH_MINUTES) || 30);
const MANUAL_REFRESH_COOLDOWN_MS = 5 * 60_000;
const DIST_DIR = path.resolve(import.meta.dirname, "../dist");

const app = express();
app.disable("x-powered-by");

app.get("/api/news", (_req, res) => {
  const snapshot = getSnapshot();
  if (!snapshot) {
    res.status(503).json({ error: "warming_up", status: getStatus() });
    return;
  }
  res.set("Cache-Control", "public, max-age=60").json(snapshot);
});

app.get("/api/status", (_req, res) => {
  res.set("Cache-Control", "no-store").json(getStatus());
});

app.post("/api/refresh", (_req, res) => {
  const status = getStatus();
  const age = status.generatedAt ? Date.now() - Date.parse(status.generatedAt) : Infinity;
  if (!status.refreshing && age < MANUAL_REFRESH_COOLDOWN_MS) {
    res.status(429).json({ error: "too_soon", retryInSeconds: Math.ceil((MANUAL_REFRESH_COOLDOWN_MS - age) / 1000) });
    return;
  }
  refresh().catch(() => {});
  res.status(202).json(getStatus());
});

if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { maxAge: "1h", index: false }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(DIST_DIR, "index.html")));
}

await loadSnapshot();
app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}  (${aiEnabled() ? `AI ranking with ${AI_MODEL}` : "no OPENAI_API_KEY, heuristic ranking"})`);
});

const snapshot = getSnapshot();
const stale = !snapshot || Date.now() - Date.parse(snapshot.generatedAt) > REFRESH_MINUTES * 60_000;
if (stale) refresh().catch(() => {});
setInterval(() => refresh().catch(() => {}), REFRESH_MINUTES * 60_000).unref?.();
