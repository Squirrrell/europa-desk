// Types shared by the API server and the web client.

export const CATEGORIES = [
  "politics",
  "protest",
  "economy",
  "society",
  "security",
  "environment",
  "culture",
  "sport",
  "viral",
  "tech",
  "health",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const SCOPES = ["local", "national", "european", "global"] as const;
export type Scope = (typeof SCOPES)[number];

export interface StorySource {
  name: string;
  url: string;
  publishedAt: string;
}

export interface Story {
  id: string;
  country: string;
  headline: string;
  summary: string;
  category: Category;
  /** 0-100, how much this story matters. */
  importance: number;
  scope: Scope;
  publishedAt: string;
  sources: StorySource[];
}

export interface CountryBrief {
  code: string;
  name: string;
  /** 0-100, drives the map shading. */
  heat: number;
  stories: Story[];
}

export interface FrontPageItem {
  storyId: string;
  country: string;
  /** One line on why the story made the front page (AI mode only). */
  why: string;
}

export interface NewsSnapshot {
  generatedAt: string;
  mode: "ai" | "heuristic";
  model?: string;
  countries: Record<string, CountryBrief>;
  frontPage: FrontPageItem[];
}

export interface PipelineStatus {
  refreshing: boolean;
  generatedAt: string | null;
  mode: NewsSnapshot["mode"] | null;
  lastError: string | null;
}
