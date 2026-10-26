import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import type { Country, Edition } from "../shared/countries";

export interface RawArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  /** Language of the feed the article came from ("en" for English search). */
  lang: string;
  origin: "search" | "edition";
  /** How many related articles Google News grouped under this one. */
  related: number;
}

const MAX_AGE_HOURS = 72;
const FETCH_TIMEOUT_MS = 12_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function searchUrl(query: string) {
  const q = encodeURIComponent(`(${query}) when:2d`);
  return `https://news.google.com/rss/search?q=${q}&hl=en-GB&gl=GB&ceid=GB:en`;
}

function editionUrl(e: Edition) {
  return `https://news.google.com/rss?hl=${e.hl}&gl=${e.gl}&ceid=${e.ceid}`;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in v) return String((v as { "#text": unknown })["#text"]);
  return "";
}

/** Google News titles end in " - Source Name"; strip it when it matches the source. */
function cleanTitle(title: string, source: string) {
  const suffix = ` - ${source}`;
  const t = source && title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
  return t.replace(/\s+/g, " ").trim();
}

function parseFeed(xml: string, lang: string, origin: RawArticle["origin"]): RawArticle[] {
  const doc = parser.parse(xml);
  const items = doc?.rss?.channel?.item;
  const list: unknown[] = Array.isArray(items) ? items : items ? [items] : [];
  const cutoff = Date.now() - MAX_AGE_HOURS * 3_600_000;

  return list.flatMap((raw) => {
    const item = raw as Record<string, unknown>;
    const url = text(item.link);
    const source = text(item.source);
    const published = new Date(text(item.pubDate));
    if (!url || Number.isNaN(published.getTime()) || published.getTime() < cutoff) return [];
    const description = text(item.description);
    return [
      {
        id: createHash("sha1").update(url).digest("hex").slice(0, 12),
        title: cleanTitle(text(item.title), source),
        url,
        source: source || "Unknown",
        publishedAt: published.toISOString(),
        lang,
        origin,
        related: Math.max(0, (description.match(/<li>/g)?.length ?? 1) - 1),
      },
    ];
  });
}

/**
 * Collects recent articles about a country: English-language coverage from a
 * Google News search, plus (optionally) the country's local top stories.
 */
export async function fetchCountryArticles(country: Country, includeEdition: boolean): Promise<RawArticle[]> {
  const jobs: Promise<RawArticle[]>[] = [
    fetchText(searchUrl(country.query)).then((xml) => parseFeed(xml, "en", "search")),
  ];
  const edition = country.edition;
  if (edition && (includeEdition || edition.hl.startsWith("en"))) {
    jobs.push(fetchText(editionUrl(edition)).then((xml) => parseFeed(xml, edition.hl, "edition")));
  }

  const results = await Promise.allSettled(jobs);
  const seen = new Set<string>();
  const articles: RawArticle[] = [];
  for (const r of results) {
    if (r.status === "rejected") {
      console.warn(`[sources] ${country.code}: ${r.reason instanceof Error ? r.reason.message : r.reason}`);
      continue;
    }
    for (const a of r.value) {
      const key = a.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      articles.push(a);
    }
  }
  if (articles.length === 0 && results.every((r) => r.status === "rejected")) {
    throw new Error(`All feeds failed for ${country.code}`);
  }
  return articles;
}
