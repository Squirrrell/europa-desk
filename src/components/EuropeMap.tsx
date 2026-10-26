import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { geoArea, geoAzimuthalEqualArea, geoCentroid, geoGraticule10, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Feature, FeatureCollection, MultiPoint, MultiPolygon, Polygon } from "geojson";
import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import "d3-transition";
import { useReducedMotion } from "motion/react";
import { ArrowsIn, Minus, Plus } from "@phosphor-icons/react";
// Loaded as a separate, cacheable JSON file rather than bundled into the JS.
import worldUrl from "world-atlas/countries-50m.json?url";
import { COUNTRIES } from "../../shared/countries";
import { heatFill } from "../lib/format";

type CountryFeature = Feature<Polygon | MultiPolygon, { name: string }>;

interface World {
  tracked: { code: string; feature: CountryFeature }[];
  background: CountryFeature[];
}

let worldPromise: Promise<World> | null = null;

function loadWorld(): Promise<World> {
  worldPromise ??= fetch(worldUrl)
    .then((r) => r.json() as Promise<Topology<{ countries: GeometryCollection<{ name: string }> }>>)
    .then((topology) => {
      const all = (feature(topology, topology.objects.countries) as FeatureCollection<Polygon | MultiPolygon, { name: string }>)
        .features as CountryFeature[];
      return {
        tracked: all.flatMap((f) => {
          const code = codeOf(f);
          return code ? [{ code, feature: f }] : [];
        }),
        background: all.filter((f) => !codeOf(f)),
      };
    })
    .catch((err) => {
      worldPromise = null;
      throw err;
    });
  return worldPromise;
}

const codeByNumeric = new Map(COUNTRIES.flatMap((c) => (c.numeric ? [[c.numeric, c.code] as const] : [])));

function codeOf(f: CountryFeature): string | undefined {
  if (f.id != null) {
    const code = codeByNumeric.get(String(f.id).padStart(3, "0"));
    if (code) return code;
  }
  return f.properties?.name === "Kosovo" ? "XK" : undefined;
}

/** Largest polygon of a country, so France isn't framed together with French Guiana. */
function mainland(f: CountryFeature): Feature<Polygon> {
  if (f.geometry.type === "Polygon") return f as Feature<Polygon>;
  let best: Feature<Polygon> | null = null;
  let bestArea = -1;
  for (const coordinates of f.geometry.coordinates) {
    const poly: Feature<Polygon> = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates } };
    const area = geoArea(poly);
    if (area > bestArea) [best, bestArea] = [poly, area];
  }
  return best!;
}

/** Points that frame the region: Iceland, Iberia, Cyprus, the Caucasus, the North Cape. */
const EUROPE_FRAME: MultiPoint = {
  type: "MultiPoint",
  coordinates: [[-24, 64], [-10, 36], [35, 34], [46, 41], [30, 71], [5, 62]],
};
/** Countries too small to hover comfortably get a marker dot as well. */
const SMALL = new Set(["MT", "LU"]);
const MARKER_R = 5;

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface Props {
  /** 0-100 shading level per country. */
  shade: Record<string, number>;
  names: Record<string, string>;
  /** Country outlined because it is selected or highlighted from the feed. */
  activeCode: string | null;
  /** Country to fly to. */
  focusCode: string | null;
  insets: Insets;
  /** Extra space to keep clear when flying to a country (e.g. an open drawer). */
  focusInsets: Insets;
  onHoverChange: (code: string | null) => void;
  onPointerMove: (x: number, y: number) => void;
  onSelect: (code: string) => void;
}

function EuropeMapImpl({ shade, names, activeCode, focusCode, insets, focusInsets, onHoverChange, onPointerMove, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const markersRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [world, setWorld] = useState<World | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    let alive = true;
    loadWorld().then(
      (w) => alive && setWorld(w),
      (err) => console.error("Could not load map data", err),
    );
    return () => {
      alive = false;
    };
  }, []);

  useLayoutEffect(() => {
    const el = wrapRef.current!;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;
  const geo = useMemo(() => {
    if (!w || !h || !world) return null;
    const projection = geoAzimuthalEqualArea()
      .rotate([-12, -53])
      .fitExtent(
        [
          [insets.left, insets.top],
          [Math.max(insets.left + 50, w - insets.right), Math.max(insets.top + 50, h - insets.bottom)],
        ],
        EUROPE_FRAME,
      )
      .clipExtent([
        [-20, -20],
        [w + 20, h + 20],
      ]);
    const path = geoPath(projection);
    return {
      path,
      graticule: path(geoGraticule10()) ?? "",
      background: world.background.map((f) => path(f) ?? ""),
      countries: world.tracked.map(({ code, feature: f }) => ({
        code,
        d: path(f) ?? "",
        bounds: path.bounds(mainland(f)),
        centroid: SMALL.has(code) ? projection(geoCentroid(f)) : null,
      })),
    };
  }, [world, w, h, insets.left, insets.top, insets.right, insets.bottom]);

  const dByCode = useMemo(() => new Map(geo?.countries.map((c) => [c.code, c.d]) ?? []), [geo]);

  // Pan and zoom. The transform is written straight to the DOM so React never re-renders per frame.
  useEffect(() => {
    if (!svgRef.current || !w || !h) return;
    const svg = select(svgRef.current);
    const zoom = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .extent([
        [0, 0],
        [w, h],
      ])
      .translateExtent([
        [0, 0],
        [w, h],
      ])
      .on("zoom", (event) => {
        layerRef.current?.setAttribute("transform", event.transform.toString());
        const r = MARKER_R / Math.sqrt(event.transform.k);
        markersRef.current?.querySelectorAll("circle").forEach((c) => c.setAttribute("r", String(r)));
      });
    svg.call(zoom).on("dblclick.zoom", null);
    svg.call(zoom.transform, zoomIdentity);
    zoomRef.current = zoom;
    return () => {
      svg.on(".zoom", null);
    };
  }, [w, h]);

  const duration = reduce ? 0 : 900;
  const ease = (t: number) => 1 - (1 - t) ** 4;

  useEffect(() => {
    const zoom = zoomRef.current;
    if (!zoom || !geo || !svgRef.current) return;
    const svg = select(svgRef.current);
    const target = focusCode ? geo.countries.find((c) => c.code === focusCode) : null;
    if (!target) {
      svg.transition().duration(duration).ease(ease).call(zoom.transform, zoomIdentity);
      return;
    }
    const [[x0, y0], [x1, y1]] = target.bounds;
    const availW = Math.max(80, w - focusInsets.left - focusInsets.right);
    const availH = Math.max(80, h - focusInsets.top - focusInsets.bottom);
    const k = Math.min(4, Math.max(1, 0.42 / Math.max((x1 - x0) / availW, (y1 - y0) / availH)));
    const transform = zoomIdentity
      .translate(focusInsets.left + availW / 2, focusInsets.top + availH / 2)
      .scale(k)
      .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    svg.transition().duration(duration).ease(ease).call(zoom.transform, transform);
    // focusInsets is read at fly time only; re-flying when the drawer opens would fight the user's panning.
  }, [focusCode, geo]);

  const zoomBy = (factor: number) => {
    if (zoomRef.current && svgRef.current)
      select(svgRef.current).transition().duration(reduce ? 0 : 450).ease(ease).call(zoomRef.current.scaleBy, factor);
  };
  const resetZoom = () => {
    if (zoomRef.current && svgRef.current)
      select(svgRef.current).transition().duration(duration).ease(ease).call(zoomRef.current.transform, zoomIdentity);
  };

  const enter = (code: string) => (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    setHovered(code);
    onHoverChange(code);
  };
  const leave = (code: string) => () => {
    setHovered((h) => (h === code ? null : h));
  };

  const outlined = [...new Set([activeCode, hovered].filter((c): c is string => !!c))];

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
      <svg
        ref={svgRef}
        width={w}
        height={h}
        className="block touch-none select-none cursor-grab active:cursor-grabbing"
        role="group"
        aria-label="Map of Europe. Select a country to read its briefing."
        onPointerMove={(e) => e.pointerType === "mouse" && onPointerMove(e.clientX, e.clientY)}
        onPointerLeave={() => {
          setHovered(null);
          onHoverChange(null);
        }}
      >
        {geo && (
          <g ref={layerRef}>
            <path d={geo.graticule} fill="none" stroke="var(--graticule)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <g fill="var(--land-muted)" stroke="var(--border)" strokeWidth={0.5}>
              {geo.background.map((d, i) => (
                <path key={i} d={d} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
            <g stroke="var(--border)" strokeWidth={0.7}>
              {geo.countries.map(({ code, d }) => (
                <path
                  key={code}
                  d={d}
                  className="country cursor-pointer"
                  style={{ fill: heatFill(shade[code] ?? 0) }}
                  vectorEffect="non-scaling-stroke"
                  tabIndex={0}
                  role="button"
                  aria-label={names[code] ?? code}
                  onPointerEnter={enter(code)}
                  onPointerLeave={leave(code)}
                  onClick={() => onSelect(code)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(code);
                    }
                  }}
                />
              ))}
            </g>
            <g fill="none" stroke="var(--accent)" strokeWidth={1.6} pointerEvents="none">
              {outlined.map((code) => (
                <path key={code} d={dByCode.get(code)} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
            <g ref={markersRef}>
              {geo.countries
                .filter((c) => c.centroid)
                .map(({ code, centroid }) => (
                  <circle
                    key={code}
                    cx={centroid![0]}
                    cy={centroid![1]}
                    r={MARKER_R}
                    className="cursor-pointer"
                    style={{ fill: heatFill(shade[code] ?? 0) }}
                    stroke={outlined.includes(code) ? "var(--accent)" : "var(--ink-faint)"}
                    strokeWidth={1.2}
                    vectorEffect="non-scaling-stroke"
                    onPointerEnter={enter(code)}
                    onPointerLeave={leave(code)}
                    onClick={() => onSelect(code)}
                  />
                ))}
            </g>
          </g>
        )}
      </svg>

      <div
        className="absolute bottom-4 flex items-center gap-3 md:bottom-6"
        style={{ left: Math.max(16, insets.left - 8) }}
      >
        <div className="panel-shell panel-glass flex items-center rounded-full p-1">
          <div className="panel-core flex items-center rounded-full">
            {[
              { label: "Zoom in", icon: <Plus weight="light" size={16} />, run: () => zoomBy(1.6) },
              { label: "Zoom out", icon: <Minus weight="light" size={16} />, run: () => zoomBy(1 / 1.6) },
              { label: "Reset view", icon: <ArrowsIn weight="light" size={16} />, run: resetZoom },
            ].map((b) => (
              <button
                key={b.label}
                type="button"
                aria-label={b.label}
                title={b.label}
                onClick={b.run}
                className="grid size-9 place-items-center rounded-full text-ink-muted transition duration-300 ease-fluid hover:text-ink active:scale-[0.94]"
              >
                {b.icon}
              </button>
            ))}
          </div>
        </div>
        <div className="panel-shell panel-glass hidden items-center rounded-full p-1 sm:flex">
          <div className="panel-core flex items-center gap-2.5 rounded-full px-3.5 py-2 text-[11px] text-ink-muted">
            <span>Quiet</span>
            <span
              className="h-1.5 w-20 rounded-full"
              style={{ background: `linear-gradient(90deg, ${heatFill(5)}, ${heatFill(50)}, ${heatFill(100)})` }}
            />
            <span>Major</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const EuropeMap = memo(EuropeMapImpl);
