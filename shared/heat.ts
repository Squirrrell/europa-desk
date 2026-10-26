import type { Story } from "./types";

/** 0-100. Blends the top story with the depth of the rest of the day's news. */
export function heatOf(stories: Pick<Story, "importance">[]): number {
  if (stories.length === 0) return 0;
  const sorted = stories.map((s) => s.importance).sort((a, b) => b - a);
  const top3 = sorted.slice(0, 3);
  return Math.round(sorted[0] * 0.7 + (top3.reduce((a, b) => a + b, 0) / top3.length) * 0.3);
}
