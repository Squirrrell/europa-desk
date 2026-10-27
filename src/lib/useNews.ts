import { useCallback, useEffect, useRef, useState } from "react";
import type { NewsSnapshot, PipelineStatus } from "../../shared/types";

export type NewsState =
  | { status: "loading" }
  | { status: "warming"; pipeline?: PipelineStatus }
  | { status: "ready"; data: NewsSnapshot; refreshing: boolean }
  | { status: "error"; message: string };

const POLL_WARMING_MS = 5_000;
const POLL_READY_MS = 5 * 60_000;

/** The GitHub Pages build has no API: a scheduled workflow publishes news.json beside the page. */
export const STATIC_SITE = import.meta.env.MODE === "pages";
const NEWS_URL = STATIC_SITE ? `${import.meta.env.BASE_URL}news.json` : "/api/news";

export function useNews() {
  const [state, setState] = useState<NewsState>({ status: "loading" });
  const timer = useRef<number | undefined>(undefined);

  const load = useCallback(async () => {
    window.clearTimeout(timer.current);
    try {
      const res = await fetch(NEWS_URL, { cache: "no-cache" });
      if (res.status === 503) {
        const body = (await res.json().catch(() => ({}))) as { status?: PipelineStatus };
        if (body.status?.lastError && !body.status.refreshing) {
          setState({ status: "error", message: body.status.lastError });
        } else {
          setState({ status: "warming", pipeline: body.status });
        }
        timer.current = window.setTimeout(load, POLL_WARMING_MS);
        return;
      }
      if (!res.ok) throw new Error(`The news service answered ${res.status}.`);
      const data = (await res.json()) as NewsSnapshot;
      setState({ status: "ready", data, refreshing: false });
      timer.current = window.setTimeout(load, POLL_READY_MS);
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Could not reach the news service." });
      timer.current = window.setTimeout(load, POLL_WARMING_MS * 3);
    }
  }, []);

  useEffect(() => {
    load();
    return () => window.clearTimeout(timer.current);
  }, [load]);

  /** Asks the server to re-scrape and re-rank, then waits for the new snapshot. */
  const refresh = useCallback(async () => {
    const res = await fetch("/api/refresh", { method: "POST" });
    if (res.status === 429) return "too_soon" as const;
    setState((s) => (s.status === "ready" ? { ...s, refreshing: true } : s));
    const wait = async () => {
      const status = (await fetch("/api/status").then((r) => r.json())) as PipelineStatus;
      if (status.refreshing) {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(wait, 3_000);
      } else {
        load();
      }
    };
    wait();
    return "started" as const;
  }, [load]);

  return { state, refresh: STATIC_SITE ? undefined : refresh, retry: load };
}
