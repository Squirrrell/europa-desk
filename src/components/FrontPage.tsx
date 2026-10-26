import { motion, useReducedMotion } from "motion/react";
import { ArrowClockwise } from "@phosphor-icons/react";
import type { Category, Story } from "../../shared/types";
import { CATEGORY_LABEL, FILTERS, timeAgo } from "../lib/format";
import type { NewsState } from "../lib/useNews";
import { CategoryIcon } from "./CategoryIcon";

export interface FeedEntry {
  story: Story;
  countryName: string;
  why: string;
}

interface Props {
  state: NewsState;
  entries: FeedEntry[];
  filter: "all" | Category;
  onFilter: (f: "all" | Category) => void;
  onOpen: (story: Story) => void;
  onHighlight: (code: string | null) => void;
  onRetry: () => void;
}

export function FrontPage({ state, entries, filter, onFilter, onOpen, onHighlight, onRetry }: Props) {
  const reduce = useReducedMotion();

  return (
    <section
      aria-label="Front page"
      className="panel-shell panel-glass flex min-h-0 flex-col rounded-[30px] p-1.5 md:max-h-full"
    >
      <div className="panel-core flex min-h-0 flex-1 flex-col rounded-[24px]">
        <header className="px-5 pt-5 pb-3 md:px-6 md:pt-6">
          <h1 className="text-[26px] leading-none font-semibold tracking-tight">
            {filter === "all" ? "Front page" : CATEGORY_LABEL[filter]}
          </h1>
          <p className="mt-2 max-w-[34ch] text-[13px] leading-relaxed text-ink-muted">
            {filter === "all"
              ? "The stories that matter most across Europe right now."
              : `The biggest ${CATEGORY_LABEL[filter].toLowerCase()} stories across Europe.`}
          </p>
        </header>

        <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-5 pb-3 md:px-6" role="tablist" aria-label="Filter by topic">
          {FILTERS.map((f) => {
            const active = f === filter;
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onFilter(f)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] transition duration-300 ease-fluid active:scale-[0.96] ${
                  active ? "bg-ink text-bg" : "text-ink-muted ring-1 ring-line hover:text-ink"
                }`}
              >
                {f === "all" ? "All" : CATEGORY_LABEL[f]}
              </button>
            );
          })}
        </div>

        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-2 pb-2 md:px-3">
          {state.status === "loading" && <Skeleton />}

          {state.status === "warming" && (
            <Notice title="Compiling the first briefing">
              The scraper is reading feeds for 45 countries and ranking them. This takes a minute or two on the first run.
            </Notice>
          )}

          {state.status === "error" && (
            <Notice title="The news service is unavailable">
              {state.message}
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 flex items-center gap-2 rounded-full bg-ink py-1.5 pr-1.5 pl-4 text-[12px] text-bg transition duration-300 ease-fluid active:scale-[0.97]"
              >
                Try again
                <span className="grid size-6 place-items-center rounded-full bg-bg/15">
                  <ArrowClockwise size={12} weight="light" />
                </span>
              </button>
            </Notice>
          )}

          {state.status === "ready" && entries.length === 0 && (
            <Notice title="Nothing in this topic yet">Try another filter, or check back after the next refresh.</Notice>
          )}

          {state.status === "ready" && entries.length > 0 && (
            <ol>
              {entries.map(({ story, countryName, why }, i) => (
                <motion.li
                  key={`${filter}-${story.id}`}
                  initial={reduce ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: Math.min(i, 10) * 0.045, ease: [0.16, 1, 0.3, 1] }}
                >
                  <button
                    type="button"
                    onClick={() => onOpen(story)}
                    onPointerEnter={() => onHighlight(story.country)}
                    onPointerLeave={() => onHighlight(null)}
                    onFocus={() => onHighlight(story.country)}
                    onBlur={() => onHighlight(null)}
                    className="group grid w-full grid-cols-[1.75rem_1fr] gap-x-2 rounded-[18px] px-3 py-3.5 text-left transition duration-300 ease-fluid hover:bg-shell active:scale-[0.99]"
                  >
                    <span className="pt-0.5 font-mono text-[11px] text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <span className="flex items-center gap-2 text-[11px] text-ink-muted">
                        <span className="font-medium text-accent">{countryName}</span>
                        <span className="flex items-center gap-1">
                          <CategoryIcon category={story.category} size={12} />
                          {CATEGORY_LABEL[story.category]}
                        </span>
                      </span>
                      <span
                        className={`mt-1.5 block font-serif leading-snug text-ink transition-colors duration-300 group-hover:text-accent ${
                          i === 0 ? "text-[22px]" : "text-[17px]"
                        }`}
                      >
                        {story.headline}
                      </span>
                      {(why || story.summary) && (
                        <span className="mt-1.5 line-clamp-2 block text-[13px] leading-relaxed text-ink-muted">
                          {why || story.summary}
                        </span>
                      )}
                      <span className="mt-2 block text-[11px] text-ink-faint">
                        {timeAgo(story.publishedAt)}, {story.sources.length} {story.sources.length === 1 ? "outlet" : "outlets"}
                      </span>
                    </span>
                  </button>
                </motion.li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-6">
      <p className="text-[15px] font-medium">{title}</p>
      <div className="mt-1.5 max-w-[42ch] text-[13px] leading-relaxed text-ink-muted">{children}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-1 px-3 py-2" aria-label="Loading stories">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="grid grid-cols-[1.75rem_1fr] gap-x-2 py-3">
          <span className="h-3 w-4 animate-pulse rounded bg-line" />
          <span className="space-y-2">
            <span className="block h-2.5 w-24 animate-pulse rounded bg-line" />
            <span className="block h-4 w-full animate-pulse rounded bg-line" />
            <span className="block h-4 w-3/4 animate-pulse rounded bg-line" />
          </span>
        </div>
      ))}
    </div>
  );
}
