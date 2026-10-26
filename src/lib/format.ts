import type { Category } from "../../shared/types";

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });

export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 48) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}

export const CATEGORY_LABEL: Record<Category, string> = {
  politics: "Politics",
  protest: "Protest",
  economy: "Economy",
  society: "Society",
  security: "Security",
  environment: "Environment",
  culture: "Culture",
  sport: "Sport",
  viral: "Viral",
  tech: "Tech",
  health: "Health",
};

/** Filters shown in the UI. Smaller categories are folded into "All". */
export const FILTERS: ("all" | Category)[] = ["all", "politics", "protest", "security", "economy", "society", "environment", "viral", "culture"];

export function heatLabel(heat: number): string {
  if (heat >= 80) return "Major news day";
  if (heat >= 60) return "Busy";
  if (heat >= 35) return "Steady";
  if (heat > 0) return "Quiet";
  return "No recent stories";
}

/** Map fill for a heat value: a mix of the accent into the land colour. */
export function heatFill(heat: number): string {
  if (heat <= 0) return "var(--land)";
  const t = Math.round(7 + (Math.min(100, heat) / 100) ** 1.6 * 73);
  return `color-mix(in oklab, var(--accent) ${t}%, var(--land))`;
}
