import { useEffect, useState } from "react";
import { ArrowClockwise, Moon, Sun } from "@phosphor-icons/react";
import type { NewsState } from "../lib/useNews";
import { timeAgo } from "../lib/format";

interface Props {
  state: NewsState;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  /** Absent on the static site, where the news only updates on the publishing schedule. */
  onRefresh?: () => Promise<"too_soon" | "started">;
}

function modelLabel(model?: string) {
  return model ? model.replace(/^gpt-/i, "GPT-").replace(/-mini$/, " mini") : "AI";
}

export function StatusIsland({ state, theme, onToggleTheme, onRefresh }: Props) {
  const [note, setNote] = useState<string | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!note) return;
    const id = window.setTimeout(() => setNote(null), 3500);
    return () => window.clearTimeout(id);
  }, [note]);

  const ready = state.status === "ready" ? state : null;
  const refreshing = ready?.refreshing ?? false;

  let status = "Connecting";
  if (state.status === "warming") status = "Compiling first briefing";
  if (state.status === "error") status = "Offline";
  if (ready) status = refreshing ? "Refreshing" : `Updated ${timeAgo(ready.data.generatedAt)}`;

  const ranking = ready
    ? ready.data.mode === "ai"
      ? `Ranked by ${modelLabel(ready.data.model)}`
      : "Keyword ranking"
    : null;

  return (
    <div className="panel-shell panel-glass flex w-max max-w-full items-center rounded-full p-1">
      <div className="panel-core flex items-center gap-1 rounded-full py-1 pr-1 pl-4">
        <span className="mr-2 text-[14px] font-semibold tracking-tight whitespace-nowrap">Europa Desk</span>
        <span className="hidden h-4 w-px bg-line sm:block" />
        <span className="hidden px-2 text-[12px] whitespace-nowrap text-ink-muted sm:block" aria-live="polite">
          {note ?? status}
        </span>
        {ranking && (
          <span
            className="hidden rounded-full px-2.5 py-1 text-[11px] whitespace-nowrap text-ink-muted ring-1 ring-line lg:block"
            title={
              ready?.data.mode === "heuristic"
                ? "Ranked by keywords, outlet coverage and recency. Run the server with OPENAI_API_KEY for AI ranking."
                : undefined
            }
          >
            {ranking}
          </span>
        )}
        {onRefresh && (
          <button
            type="button"
            aria-label="Refresh news"
            title="Refresh news"
            disabled={!ready || refreshing}
            onClick={async () => {
              if ((await onRefresh()) === "too_soon") setNote("Just updated, try again in a few minutes");
            }}
            className="ml-1 grid size-9 place-items-center rounded-full text-ink-muted transition duration-300 ease-fluid hover:bg-shell hover:text-ink active:scale-[0.94] disabled:opacity-40"
          >
            <ArrowClockwise size={16} weight="light" className={refreshing ? "animate-spin" : ""} />
          </button>
        )}
        <button
          type="button"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          title="Toggle theme"
          onClick={onToggleTheme}
          className="grid size-9 place-items-center rounded-full text-ink-muted transition duration-300 ease-fluid hover:bg-shell hover:text-ink active:scale-[0.94]"
        >
          {theme === "dark" ? <Sun size={16} weight="light" /> : <Moon size={16} weight="light" />}
        </button>
      </div>
    </div>
  );
}
