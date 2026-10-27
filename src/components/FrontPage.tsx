import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowClockwise, CaretLeft, CaretRight } from "@phosphor-icons/react";
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

const EDGE_FADE = "56px";
const PEEK_PX = 64;
const PEEK_KEY = "europa-desk:chips-peeked";

/**
 * Topic chips in a scrolling row. The selected chip is scrolled into full view, clipped edges fade
 * behind an arrow button, and on the first visit the row nudges sideways once to show it scrolls.
 */
function FilterChips({ filter, onFilter }: Pick<Props, "filter" | "onFilter">) {
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const reduce = useReducedMotion();

  const measure = useCallback(() => {
    const el = row.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => {
    const el = row.current;
    const chip = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !chip) return;
    const target = chip.offsetLeft - (el.clientWidth - chip.offsetWidth) / 2;
    el.scrollTo({ left: target, behavior: reduce ? "auto" : "smooth" });
  }, [filter, reduce]);

  // One sideways nudge per browser session, cancelled as soon as the reader touches the row.
  useEffect(() => {
    const el = row.current;
    if (!el || !edges.right || reduce) return;
    try {
      if (sessionStorage.getItem(PEEK_KEY)) return;
    } catch {
      // Storage can be blocked; nudging again on the next load is harmless.
    }
    const timers: number[] = [];
    const cancel = () => timers.forEach((t) => window.clearTimeout(t));
    timers.push(
      window.setTimeout(() => {
        if (el.scrollLeft > 1) return;
        try {
          sessionStorage.setItem(PEEK_KEY, "1");
        } catch {
          // See above.
        }
        el.scrollTo({ left: PEEK_PX, behavior: "smooth" });
        timers.push(window.setTimeout(() => el.scrollTo({ left: 0, behavior: "smooth" }), 650));
      }, 1100),
    );
    el.addEventListener("pointerdown", cancel);
    el.addEventListener("wheel", cancel, { passive: true });
    return () => {
      cancel();
      el.removeEventListener("pointerdown", cancel);
      el.removeEventListener("wheel", cancel);
    };
  }, [edges.right, reduce]);

  const page = (dir: 1 | -1) => {
    const el = row.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.6, behavior: reduce ? "auto" : "smooth" });
  };

  const mask = `linear-gradient(to right, ${edges.left ? "transparent" : "#000"}, #000 ${EDGE_FADE}, #000 calc(100% - ${EDGE_FADE}), ${
    edges.right ? "transparent" : "#000"
  })`;

  return (
    <div className="relative">
      <div
        ref={row}
        onScroll={measure}
        onWheel={(e) => {
          // A plain mouse wheel only scrolls vertically, which would leave the later chips unreachable.
          if (row.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) row.current.scrollLeft += e.deltaY;
        }}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
        className="no-scrollbar relative flex gap-1.5 overflow-x-auto px-5 pb-3 md:px-6"
        role="tablist"
        aria-label="Filter by topic"
      >
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

      {/* Chips stay keyboard-reachable on their own, so the arrows are a pointer convenience only. */}
      <AnimatePresence initial={false}>
        {edges.left && <EdgeArrow key="left" side="left" onClick={() => page(-1)} />}
        {edges.right && <EdgeArrow key="right" side="right" onClick={() => page(1)} />}
      </AnimatePresence>
    </div>
  );
}

function EdgeArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? CaretLeft : CaretRight;
  return (
    <motion.button
      type="button"
      tabIndex={-1}
      aria-hidden
      onClick={onClick}
      initial={{ opacity: 0, x: side === "left" ? 6 : -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: side === "left" ? 6 : -6 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`absolute top-0 grid size-[30px] place-items-center rounded-full bg-surface-solid text-ink-muted shadow-[0_2px_10px_-4px_rgb(0_0_0/0.25)] ring-1 ring-line transition-colors duration-300 hover:text-ink active:scale-[0.94] ${
        side === "left" ? "left-3 md:left-4" : "right-3 md:right-4"
      }`}
    >
      <Icon size={15} weight="light" />
    </motion.button>
  );
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

        <FilterChips filter={filter} onFilter={onFilter} />

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
