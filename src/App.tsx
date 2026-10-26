import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMotionValue } from "motion/react";
import type { Category, CountryBrief, Story } from "../shared/types";
import { COUNTRIES } from "../shared/countries";
import { heatOf } from "../shared/heat";
import { useNews } from "./lib/useNews";
import { useTheme } from "./lib/useTheme";
import { EuropeMap, type Insets } from "./components/EuropeMap";
import { HoverCard, HOVER_CARD_WIDTH } from "./components/HoverCard";
import { FrontPage, type FeedEntry } from "./components/FrontPage";
import { CountryDrawer } from "./components/CountryDrawer";
import { StatusIsland } from "./components/StatusIsland";

const NAMES = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.name]));
const PANEL_W = 400;
const DRAWER_W = 420;
const GUTTER = 24;

function useIsDesktop() {
  const query = "(min-width: 768px)";
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return desktop;
}

export default function App() {
  const { state, refresh, retry } = useNews();
  const { theme, toggle } = useTheme();
  const desktop = useIsDesktop();

  const [filter, setFilter] = useState<"all" | Category>("all");
  const [hovered, setHovered] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const snapshot = state.status === "ready" ? state.data : null;

  const storiesFor = useCallback(
    (brief: CountryBrief | undefined): Story[] => {
      if (!brief) return [];
      return filter === "all" ? brief.stories : brief.stories.filter((s) => s.category === filter);
    },
    [filter],
  );

  const heat = useMemo(() => {
    if (!snapshot) return {};
    return Object.fromEntries(
      Object.values(snapshot.countries).map((b) => [b.code, filter === "all" ? b.heat : heatOf(storiesFor(b))]),
    );
  }, [snapshot, filter, storiesFor]);

  // Map shading uses each country's rank rather than its raw score, so the map keeps contrast
  // whether the scores bunch up (keyword ranking) or spread out (AI ranking).
  const shade = useMemo(() => {
    const ranked = Object.entries(heat)
      .filter(([, h]) => h > 0)
      .sort((a, b) => a[1] - b[1]);
    const n = ranked.length;
    return Object.fromEntries(ranked.map(([code], i) => [code, n > 1 ? 4 + (i / (n - 1)) * 96 : 60]));
  }, [heat]);

  const entries = useMemo<FeedEntry[]>(() => {
    if (!snapshot) return [];
    const name = (code: string) => snapshot.countries[code]?.name ?? NAMES[code] ?? code;
    if (filter === "all") {
      return snapshot.frontPage.flatMap((item) => {
        const story = snapshot.countries[item.country]?.stories.find((s) => s.id === item.storyId);
        return story ? [{ story, countryName: name(story.country), why: item.why }] : [];
      });
    }
    const perCountry = new Map<string, number>();
    return Object.values(snapshot.countries)
      .flatMap((b) => storiesFor(b))
      .sort((a, b) => b.importance - a.importance)
      .filter((s) => {
        const n = perCountry.get(s.country) ?? 0;
        perCountry.set(s.country, n + 1);
        return n < 2;
      })
      .slice(0, 12)
      .map((story) => ({ story, countryName: name(story.country), why: "" }));
  }, [snapshot, filter, storiesFor]);

  // Hover card follows the pointer through motion values, outside React's render cycle.
  const cardX = useMotionValue(0);
  const cardY = useMotionValue(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const onPointerMove = useCallback(
    (x: number, y: number) => {
      const gap = 18;
      const h = cardRef.current?.offsetHeight || 220;
      const left = x + gap + HOVER_CARD_WIDTH > window.innerWidth - 12 ? x - gap - HOVER_CARD_WIDTH : x + gap;
      cardX.set(left);
      cardY.set(Math.min(Math.max(12, y - 28), window.innerHeight - h - 12));
    },
    [cardX, cardY],
  );

  const insets = useMemo<Insets>(
    () =>
      desktop
        ? { top: GUTTER + 56, right: GUTTER, bottom: 72, left: GUTTER * 2 + PANEL_W }
        : { top: 16, right: 12, bottom: 64, left: 12 },
    [desktop],
  );
  const focusInsets = useMemo<Insets>(
    () => (desktop ? { ...insets, top: GUTTER, right: GUTTER * 2 + DRAWER_W } : { ...insets }),
    [desktop, insets],
  );

  const closeDrawer = useCallback(() => setSelected(null), []);
  const openStory = useCallback((story: Story) => setSelected(story.country), []);

  const hoveredBrief = hovered ? (snapshot?.countries[hovered] ?? { code: hovered, name: NAMES[hovered], heat: 0, stories: [] }) : null;
  const selectedBrief = selected ? (snapshot?.countries[selected] ?? { code: selected, name: NAMES[selected], heat: 0, stories: [] }) : null;

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-bg text-ink">
      <div className="px-4 pt-3 md:hidden">
        <StatusIsland state={state} theme={theme} onToggleTheme={toggle} onRefresh={refresh} />
      </div>

      <div className="relative h-[58dvh] md:fixed md:inset-0 md:h-auto">
        <EuropeMap
          shade={shade}
          names={NAMES}
          activeCode={selected ?? highlighted}
          focusCode={selected}
          insets={insets}
          focusInsets={focusInsets}
          onHoverChange={setHovered}
          onPointerMove={onPointerMove}
          onSelect={setSelected}
        />
      </div>

      <div
        className="relative flex flex-col gap-3 px-3 pb-4 md:pointer-events-none md:fixed md:top-6 md:bottom-6 md:left-6 md:px-0 md:pb-0"
        style={desktop ? { width: PANEL_W } : undefined}
      >
        <div className="pointer-events-auto hidden w-max md:block">
          <StatusIsland state={state} theme={theme} onToggleTheme={toggle} onRefresh={refresh} />
        </div>
        <div className="pointer-events-auto flex min-h-0 flex-1 flex-col">
          <FrontPage
            state={state}
            entries={entries}
            filter={filter}
            onFilter={setFilter}
            onOpen={openStory}
            onHighlight={setHighlighted}
            onRetry={retry}
          />
        </div>
      </div>

      <HoverCard
        brief={hoveredBrief && hovered !== selected ? hoveredBrief : null}
        stories={storiesFor(hoveredBrief ?? undefined)}
        heat={hovered ? (heat[hovered] ?? 0) : 0}
        x={cardX}
        y={cardY}
        cardRef={cardRef}
      />

      <CountryDrawer
        brief={selectedBrief}
        stories={storiesFor(selectedBrief ?? undefined)}
        heat={selected ? (heat[selected] ?? 0) : 0}
        onClose={closeDrawer}
      />
    </div>
  );
}
