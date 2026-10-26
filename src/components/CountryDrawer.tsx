import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, X } from "@phosphor-icons/react";
import type { CountryBrief, Story } from "../../shared/types";
import { CATEGORY_LABEL, heatLabel, timeAgo } from "../lib/format";
import { CategoryIcon } from "./CategoryIcon";

interface Props {
  brief: CountryBrief | null;
  stories: Story[];
  heat: number;
  onClose: () => void;
}

export function CountryDrawer({ brief, stories, heat, onClose }: Props) {
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!brief) return;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [brief, onClose]);

  return (
    <AnimatePresence>
      {brief && (
        <motion.aside
          key="drawer"
          aria-label={`${brief.name} briefing`}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: 40, y: 0 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40 }}
          transition={{ type: "spring", stiffness: 260, damping: 32 }}
          className="panel-shell panel-glass fixed inset-x-2 bottom-2 z-20 flex max-h-[78dvh] flex-col rounded-[30px] p-1.5 md:inset-x-auto md:top-6 md:right-6 md:bottom-6 md:max-h-none md:w-[420px]"
        >
          <div className="panel-core flex min-h-0 flex-1 flex-col rounded-[24px]">
            <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
              <div>
                <motion.h2
                  key={brief.code}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="text-[34px] leading-[1.05] font-semibold tracking-tight"
                >
                  {brief.name}
                </motion.h2>
                <p className="mt-2 text-[13px] text-ink-muted">
                  {heatLabel(heat)}
                  {heat > 0 && (
                    <>
                      , heat <span className="font-mono text-ink">{heat}</span>
                    </>
                  )}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close briefing"
                className="grid size-10 shrink-0 place-items-center rounded-full ring-1 ring-line transition duration-300 ease-fluid hover:bg-shell active:scale-[0.94]"
              >
                <X size={16} weight="light" />
              </button>
            </header>

            <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-6 pb-6">
              {stories.length === 0 ? (
                <p className="py-6 text-[14px] leading-relaxed text-ink-muted">
                  No significant stories from {brief.name} in the last two days for this topic.
                </p>
              ) : (
                <ol className="divide-y divide-line">
                  {stories.map((s, i) => (
                    <motion.li
                      key={s.id}
                      initial={reduce ? false : { opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.08 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                      className="py-5 first:pt-1"
                    >
                      <p className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                        <CategoryIcon category={s.category} size={12} />
                        {CATEGORY_LABEL[s.category]}
                        <span aria-hidden>·</span>
                        {timeAgo(s.publishedAt)}
                        <span className="ml-auto font-mono text-ink-faint" title="Importance score">
                          {s.importance}
                        </span>
                      </p>
                      <h3 className={`mt-2 font-serif leading-snug ${i === 0 ? "text-[23px]" : "text-[18px]"}`}>{s.headline}</h3>
                      {s.summary && <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{s.summary}</p>}
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {s.sources.map((src) => (
                          <li key={src.url}>
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="group flex items-center gap-1 rounded-full py-1 pr-1.5 pl-2.5 text-[11.5px] text-ink-muted ring-1 ring-line transition duration-300 ease-fluid hover:text-ink hover:ring-ink-faint"
                            >
                              {src.name}
                              <ArrowUpRight
                                size={11}
                                weight="light"
                                className="transition-transform duration-300 ease-fluid group-hover:translate-x-px group-hover:-translate-y-px"
                              />
                            </a>
                          </li>
                        ))}
                      </ul>
                    </motion.li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
