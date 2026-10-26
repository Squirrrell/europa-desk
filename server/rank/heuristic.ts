import type { Category, Story } from "../../shared/types";
import type { Cluster } from "../cluster";

/**
 * Keyword rules used when no OpenAI key is configured, and to pre-sort
 * candidates before they are sent to the model.
 */
const CATEGORY_RULES: [Category, RegExp][] = [
  ["protest", /\b(protest\w*|demonstrat\w*|rall(y|ies)|march(es|ed)?|strike[sr]?|riot\w*|unrest|clash\w*)\b/i],
  ["security", /\b(war|attack\w*|missile\w*|drone\w*|troops|military|army|nato|shelling|bomb\w*|terror\w*|shooting|killed|police)\b/i],
  ["politics", /\b(election\w*|vote[sd]?|voting|parliament\w*|government|minister\w*|president\w*|coalition|law|bill|referendum|senate|opposition|resign\w*|court)\b/i],
  ["economy", /\b(econom\w*|inflation|budget|tax\w*|bank\w*|gdp|market\w*|jobs|wage\w*|price\w*|tariff\w*|trade|energy|gas|debt)\b/i],
  ["environment", /\b(flood\w*|wildfire\w*|fire\w*|storm\w*|heatwave|drought|climate|earthquake|quake)\b/i],
  ["health", /\b(health|hospital\w*|virus|outbreak|vaccine\w*|doctors?|nurses?|disease)\b/i],
  ["tech", /\b(tech|ai|artificial intelligence|cyber\w*|startup\w*|software|internet)\b/i],
  ["viral", /\b(viral|dancing|danced|tiktok|internet sensation|goes viral|flash ?mob)\b/i],
  ["culture", /\b(festival|museum|film|music|concert|art|artist|eurovision|book|heritage)\b/i],
  ["sport", /\b(football|match|league|liga|serie a|bundesliga|cup|goal|coach|tennis|olympic\w*|champions|uefa|fifa|grand prix|derby|highlights)\b/i],
];

/** Scorelines like "Barcelona 1-2 Real Madrid" are sport regardless of other keywords. */
const SCORELINE = /\b\d{1,2}\s?[-–]\s?\d{1,2}\b/;

const WEIGHTS: Partial<Record<Category, number>> = {
  security: 22,
  protest: 20,
  politics: 18,
  economy: 12,
  environment: 14,
  health: 8,
  viral: 6,
  tech: 4,
  culture: 2,
  sport: -6,
};

const NOISE = /\b(live|as it happened|opinion|podcast|quiz|horoscope|recipe|review|watch:|photos?:|in pictures)\b/i;

export function categorize(title: string): Category {
  if (SCORELINE.test(title)) return "sport";
  for (const [category, re] of CATEGORY_RULES) if (re.test(title)) return category;
  return "society";
}

export function heuristicScore(cluster: Cluster): number {
  const title = cluster.lead.title;
  const coverage = cluster.sources.size + cluster.lead.related * 0.5;
  const ageHours = (Date.now() - cluster.latest) / 3_600_000;
  let score = 18;
  score += 11 * Math.log2(1 + coverage);
  score += Math.max(0, 14 - ageHours * 0.4);
  score += WEIGHTS[categorize(title)] ?? 0;
  if (NOISE.test(title)) score -= 10;
  return Math.round(Math.min(95, Math.max(4, score)));
}

export function clusterToStory(cluster: Cluster, countryCode: string, n: number): Story {
  const articles = [...cluster.articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return {
    id: `${countryCode}-${n}`,
    country: countryCode,
    headline: cluster.lead.title,
    summary: "",
    category: categorize(cluster.lead.title),
    importance: heuristicScore(cluster),
    scope: "national",
    publishedAt: new Date(cluster.latest).toISOString(),
    sources: articles.slice(0, 5).map((a) => ({ name: a.source, url: a.url, publishedAt: a.publishedAt })),
  };
}

export function rankHeuristically(clusters: Cluster[], countryCode: string, limit: number): Story[] {
  return clusters
    // Feeds occasionally carry bare section titles like "Moldova"; those aren't stories.
    .filter((c) => c.lead.lang.startsWith("en") && c.lead.title.split(/\s+/).length >= 4)
    .map((c) => ({ c, score: heuristicScore(c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ c }, i) => clusterToStory(c, countryCode, i));
}
