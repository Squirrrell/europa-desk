import { AnimatePresence, motion, type MotionValue } from "motion/react";
import type { CountryBrief, Story } from "../../shared/types";
import { CATEGORY_LABEL, heatLabel, timeAgo } from "../lib/format";
import { CategoryIcon } from "./CategoryIcon";

export const HOVER_CARD_WIDTH = 340;

interface Props {
  brief: CountryBrief | null;
  stories: Story[];
  heat: number;
  x: MotionValue<number>;
  y: MotionValue<number>;
  cardRef: React.RefObject<HTMLDivElement | null>;
}

/** Follows the cursor over the map; positions are motion values so moving never re-renders React. */
export function HoverCard({ brief, stories, heat, x, y, cardRef }: Props) {
  return (
    <motion.div
      ref={cardRef}
      className="pointer-events-none fixed top-0 left-0 z-30 hidden md:block"
      style={{ x, y, width: HOVER_CARD_WIDTH }}
      aria-hidden
    >
      <AnimatePresence mode="wait">
        {brief && (
          <motion.div
            key={brief.code}
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="panel-shell panel-glass origin-top-left rounded-[22px] p-1.5"
          >
            <div className="panel-core rounded-[17px] px-4 pt-3.5 pb-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[17px] font-medium tracking-tight">{brief.name}</h3>
                <span className="flex items-baseline gap-1.5 text-[11px] text-ink-muted">
                  {heatLabel(heat)}
                  <span className="font-mono text-ink">{heat || ""}</span>
                </span>
              </div>

              {stories.length === 0 ? (
                <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                  Nothing significant reported in the last two days.
                </p>
              ) : (
                <ol className="mt-2.5 space-y-2.5">
                  {stories.slice(0, 3).map((s, i) => (
                    <li key={s.id} className={i > 0 ? "border-t border-line pt-2.5" : ""}>
                      <p className="font-serif text-[15.5px] leading-snug text-ink">{s.headline}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-faint">
                        <CategoryIcon category={s.category} size={12} />
                        {CATEGORY_LABEL[s.category]}
                        <span aria-hidden>·</span>
                        {timeAgo(s.publishedAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-3 text-[11px] text-ink-faint">Click the country for the full briefing</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
