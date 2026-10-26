import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CountryBrief, FrontPageItem, NewsSnapshot, PipelineStatus, Story } from "../shared/types";
import { COUNTRIES, type Country } from "../shared/countries";
import { heatOf } from "../shared/heat";
import { fetchCountryArticles } from "./sources";
import { clusterArticles } from "./cluster";
import { rankHeuristically } from "./rank/heuristic";
import { AI_MODEL, aiEnabled, rankCountryWithAI, rankFrontPageWithAI } from "./rank/ai";

const DATA_DIR = path.resolve(import.meta.dirname, "data");
const SNAPSHOT_FILE = path.join(DATA_DIR, "snapshot.json");
const CONCURRENCY = 6;
const STORIES_PER_COUNTRY = 6;

let snapshot: NewsSnapshot | null = null;
let refreshing: Promise<NewsSnapshot> | null = null;
let lastError: string | null = null;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function briefCountry(country: Country, useAI: boolean): Promise<CountryBrief> {
  let stories: Story[] = [];
  try {
    const articles = await fetchCountryArticles(country, useAI);
    const clusters = clusterArticles(articles);
    if (useAI) {
      try {
        stories = await rankCountryWithAI(country, clusters);
      } catch (err) {
        console.warn(`[ai] ${country.code} failed, using heuristic ranking:`, (err as Error).message);
        stories = rankHeuristically(clusters, country.code, STORIES_PER_COUNTRY);
      }
    } else {
      stories = rankHeuristically(clusters, country.code, STORIES_PER_COUNTRY);
    }
  } catch (err) {
    console.warn(`[pipeline] ${country.code}:`, (err as Error).message);
  }
  return { code: country.code, name: country.name, heat: heatOf(stories), stories };
}

/** Without AI, one story per country keeps keyword-matched near-duplicates off the front page. */
function heuristicFrontPage(briefs: CountryBrief[]): FrontPageItem[] {
  return briefs
    .flatMap((b) => b.stories.slice(0, 1))
    .filter((s) => s.category !== "sport")
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 12)
    .map((s) => ({ storyId: s.id, country: s.country, why: "" }));
}

export async function buildSnapshot(): Promise<NewsSnapshot> {
  const useAI = aiEnabled();
  const started = Date.now();
  console.log(`[pipeline] building snapshot for ${COUNTRIES.length} countries (${useAI ? `AI: ${AI_MODEL}` : "heuristic"})`);

  const briefs = await mapLimit(COUNTRIES, CONCURRENCY, (c) => briefCountry(c, useAI));
  const total = briefs.reduce((n, b) => n + b.stories.length, 0);
  if (total === 0) throw new Error("No stories collected from any country; are the news feeds reachable?");

  let frontPage = heuristicFrontPage(briefs);
  if (useAI) {
    const candidates = briefs.flatMap((b) => b.stories.slice(0, 3));
    try {
      const ranked = await rankFrontPageWithAI(candidates);
      if (ranked.length >= 5) frontPage = ranked;
    } catch (err) {
      console.warn("[ai] front page failed, using heuristic ordering:", (err as Error).message);
    }
  }

  console.log(`[pipeline] ${total} stories in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return {
    generatedAt: new Date().toISOString(),
    mode: useAI ? "ai" : "heuristic",
    model: useAI ? AI_MODEL : undefined,
    countries: Object.fromEntries(briefs.map((b) => [b.code, b])),
    frontPage,
  };
}

async function persist(s: NewsSnapshot) {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${SNAPSHOT_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(s));
  await rename(tmp, SNAPSHOT_FILE);
}

export async function loadSnapshot() {
  try {
    snapshot = JSON.parse(await readFile(SNAPSHOT_FILE, "utf8")) as NewsSnapshot;
    console.log(`[pipeline] loaded cached snapshot from ${snapshot.generatedAt}`);
  } catch {
    snapshot = null;
  }
  return snapshot;
}

/** Runs the pipeline unless a run is already in flight, in which case it joins that run. */
export function refresh(): Promise<NewsSnapshot> {
  refreshing ??= buildSnapshot()
    .then(async (s) => {
      snapshot = s;
      lastError = null;
      await persist(s);
      return s;
    })
    .catch((err: Error) => {
      lastError = err.message;
      console.error("[pipeline] refresh failed:", err.message);
      throw err;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export const getSnapshot = () => snapshot;

export function getStatus(): PipelineStatus {
  return {
    refreshing: refreshing !== null,
    generatedAt: snapshot?.generatedAt ?? null,
    mode: snapshot?.mode ?? null,
    lastError,
  };
}
