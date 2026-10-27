// Builds one keyword-ranked snapshot and writes it next to the static site: `npm run build:pages`.
// Never calls OpenAI, so it can run for free on a schedule (see .github/workflows/pages.yml).
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

delete process.env.OPENAI_API_KEY;
const { buildSnapshot } = await import("./pipeline");

const out = path.resolve(process.argv[2] ?? "dist/news.json");
const snapshot = await buildSnapshot();
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(snapshot));
console.log(`[static] wrote ${out}`);
