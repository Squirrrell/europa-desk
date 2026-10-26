import OpenAI from "openai";
import { CATEGORIES, SCOPES, type FrontPageItem, type Story } from "../../shared/types";
import type { Country } from "../../shared/countries";
import type { Cluster } from "../cluster";
import { heuristicScore } from "./heuristic";

const MAX_CANDIDATES = 30;
const MAX_STORIES = 6;
const FRONT_PAGE_SIZE = 12;

export const AI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";
const client = process.env.OPENAI_API_KEY ? new OpenAI() : null;

export const aiEnabled = () => client !== null;

/** Reasoning models reject sampling params but accept an effort hint. */
const modelOptions = /^(gpt-5|o\d)/.test(AI_MODEL) ? { reasoning_effort: "low" as const } : { temperature: 0.2 };

async function completeJson<T>(name: string, schema: object, system: string, user: string): Promise<T> {
  if (!client) throw new Error("OpenAI client not configured");
  const res = await client.chat.completions.create({
    model: AI_MODEL,
    ...modelOptions,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_schema", json_schema: { name, strict: true, schema: schema as Record<string, unknown> } },
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error(`Empty response for ${name}`);
  return JSON.parse(content) as T;
}

const COUNTRY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["stories"],
  properties: {
    stories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["candidateIds", "headline", "summary", "category", "importance", "scope"],
        properties: {
          candidateIds: { type: "array", items: { type: "integer" } },
          headline: { type: "string" },
          summary: { type: "string" },
          category: { type: "string", enum: [...CATEGORIES] },
          importance: { type: "integer" },
          scope: { type: "string", enum: [...SCOPES] },
        },
      },
    },
  },
};

const COUNTRY_SYSTEM = `You are the night editor of a pan-European news desk. For one country you receive a numbered list of recent headlines (English coverage plus the country's own top stories, possibly in the local language).

Your job:
1. Group candidates that describe the same story (list every matching id in candidateIds).
2. Keep only stories that are actually about this country or in which it is directly involved.
3. Pick at most ${MAX_STORIES} stories, ordered from most to least important.
4. Write a neutral English headline (max 90 characters, no clickbait, no em dashes) and a factual one or two sentence summary (max 40 words) using only what the headlines state. Do not invent details.
5. Score importance 0-100:
   90-100 historic or continent-wide impact (war escalation, government collapse, major disaster)
   70-89 major national story (law passed, mass protests, election result, large economic shock)
   40-69 notable national news
   20-39 minor or local news
   0-19 trivia
6. If a cultural moment or viral story is widely shared (for example crowds singing or dancing at a protest), include it with an honest score; readers like one human story per country.

Skip sport results, horoscopes, live blogs and opinion columns unless they are genuinely major national news.`;

interface CountryResult {
  stories: {
    candidateIds: number[];
    headline: string;
    summary: string;
    category: Story["category"];
    importance: number;
    scope: Story["scope"];
  }[];
}

/** Short-lived memo so unchanged candidate lists don't cost another call. */
const memo = new Map<string, Story[]>();

export async function rankCountryWithAI(country: Country, clusters: Cluster[]): Promise<Story[]> {
  const candidates = [...clusters]
    .sort((a, b) => heuristicScore(b) - heuristicScore(a))
    .slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) return [];

  const key = `${country.code}:${candidates.map((c) => c.lead.id).sort().join(",")}`;
  const cached = memo.get(key);
  if (cached) return cached;

  const lines = candidates.map((c, i) => {
    const ageH = Math.round((Date.now() - c.latest) / 3_600_000);
    const lang = c.lead.lang.slice(0, 2);
    return `[${i}] (${lang}, ${ageH}h ago, ${c.sources.size} outlets) ${c.lead.title} | ${c.lead.source}`;
  });

  const result = await completeJson<CountryResult>(
    "country_briefing",
    COUNTRY_SCHEMA,
    COUNTRY_SYSTEM,
    `Country: ${country.name} (${country.code})\nNow: ${new Date().toISOString()}\n\nCandidates:\n${lines.join("\n")}`,
  );

  const stories = result.stories.slice(0, MAX_STORIES).flatMap((s, n): Story[] => {
    const picked = s.candidateIds.map((id) => candidates[id]).filter((c): c is Cluster => !!c);
    if (picked.length === 0) return [];
    const articles = picked
      .flatMap((c) => c.articles)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    const seen = new Set<string>();
    const sources = articles
      .filter((a) => (seen.has(a.source) ? false : (seen.add(a.source), true)))
      .slice(0, 5)
      .map((a) => ({ name: a.source, url: a.url, publishedAt: a.publishedAt }));
    return [
      {
        id: `${country.code}-${n}`,
        country: country.code,
        headline: s.headline.trim(),
        summary: s.summary.trim(),
        category: s.category,
        importance: Math.round(Math.min(100, Math.max(0, s.importance))),
        scope: s.scope,
        publishedAt: new Date(Math.max(...picked.map((c) => c.latest))).toISOString(),
        sources,
      },
    ];
  });
  stories.sort((a, b) => b.importance - a.importance);

  if (memo.size > 500) memo.clear();
  memo.set(key, stories);
  return stories;
}

const FRONT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["storyId", "why"],
        properties: {
          storyId: { type: "string" },
          why: { type: "string" },
        },
      },
    },
  },
};

const FRONT_SYSTEM = `You are the editor-in-chief of a pan-European news desk choosing today's front page.
From the country briefings below pick the ${FRONT_PAGE_SIZE} most important stories for a European reader, ordered from most to least important.
Weigh real-world consequences, how many people are affected, cross-border relevance and novelty. Country editors score on their own scale, so recalibrate.
Avoid more than two stories from one country. Include at most one lighter human-interest or viral story.
For each, write "why": one plain sentence (max 22 words) on why it matters beyond its own country. No em dashes.`;

export async function rankFrontPageWithAI(stories: Story[]): Promise<FrontPageItem[]> {
  const byId = new Map(stories.map((s) => [s.id, s]));
  const lines = stories.map(
    (s) => `${s.id} | ${s.category} | country score ${s.importance} | ${s.headline}${s.summary ? ` | ${s.summary}` : ""}`,
  );
  const result = await completeJson<{ items: { storyId: string; why: string }[] }>(
    "front_page",
    FRONT_SCHEMA,
    FRONT_SYSTEM,
    lines.join("\n"),
  );
  const seen = new Set<string>();
  return result.items
    .filter((i) => byId.has(i.storyId) && !seen.has(i.storyId) && seen.add(i.storyId))
    .slice(0, FRONT_PAGE_SIZE)
    .map((i) => ({ storyId: i.storyId, country: byId.get(i.storyId)!.country, why: i.why.trim() }));
}
