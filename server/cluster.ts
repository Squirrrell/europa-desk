import type { RawArticle } from "./sources";

export interface Cluster {
  /** Stable within one pipeline run; used as the candidate id sent to the model. */
  index: number;
  lead: RawArticle;
  articles: RawArticle[];
  sources: Set<string>;
  latest: number;
}

const STOPWORDS = new Set(
  (
    "a an the and or but of to in on at for from by with as is are was were be been has have had " +
    "it its this that these those after before over under into amid says said say new news live " +
    "update updates why how what who will would could can may not no than more most first last " +
    "year years day days week weeks his her their our your they them he she we you"
  ).split(" "),
);

function tokens(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    // Crude prefix stemming: "protests", "protesters" and "protesting" all become "prote".
    .map((w) => w.slice(0, 5));
  return new Set(words);
}

function isSameStory(a: Set<string>, b: Set<string>) {
  if (a.size < 3 || b.size < 3) return false;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  // Overlap relative to the shorter title catches "X passes law" vs "X passes controversial law on Y".
  return shared >= 3 && shared / Math.min(a.size, b.size) >= 0.5;
}

/** Greedy single-pass clustering of near-duplicate headlines. */
export function clusterArticles(articles: RawArticle[]): Cluster[] {
  const sorted = [...articles].sort((a, b) => b.related - a.related);
  const clusters: (Cluster & { tokens: Set<string> })[] = [];

  for (const article of sorted) {
    const t = tokens(article.title);
    const match = clusters.find((c) => isSameStory(c.tokens, t));
    const time = Date.parse(article.publishedAt);
    if (match) {
      match.articles.push(article);
      match.sources.add(article.source);
      match.latest = Math.max(match.latest, time);
    } else {
      clusters.push({
        index: clusters.length,
        lead: article,
        articles: [article],
        sources: new Set([article.source]),
        latest: time,
        tokens: t,
      });
    }
  }

  return clusters.map(({ tokens: _t, ...c }) => c);
}
