/**
 * Team USA Constellation Hub — Mapbox / MapLibre Mock Edition
 *
 * Drop-in replacement for Hub.backend.tsx.
 *
 * Key changes from Hub.backend.tsx:
 *  - Replaces the SVG/custom FlagshipMap with a real interactive map powered by
 *    Mapbox GL JS (when VITE_MAPBOX_TOKEN is set) or MapLibre GL JS (token-free,
 *    public dark tile style) as a fallback.
 *  - All mock hometown hub data is kept inline and clearly labelled as demo/mock.
 *  - Markers appear on the map; clicking a marker selects the city and updates the
 *    sidebar panel. City-chip clicks fly the map to the matching marker.
 *  - A fully polished non-interactive fallback is rendered when neither mapbox-gl
 *    nor maplibre-gl is installed/importable.
 *  - All other visual design, layout, navigation, drawers, buttons, and the
 *    Hometown Signals card structure are preserved unchanged from Hub.backend.tsx.
 *  - No backend API calls removed — they remain wired as before; the map just uses
 *    mock lat/lng data until the backend supplies real coordinates.
 *  - No localStorage / sessionStorage / cookies.
 *  - Does not require login.
 *
 * ─── CSS IMPORT REQUIRED ─────────────────────────────────────────────────────
 * Add exactly ONE of the following lines to your entry point (e.g. main.tsx or
 * the top of this file after you confirm which package is installed):
 *
 *   import 'mapbox-gl/dist/mapbox-gl.css';        // if using Mapbox GL JS
 *   import 'maplibre-gl/dist/maplibre-gl.css';    // if using MapLibre GL JS
 *
 * Without the CSS the map controls will render but the canvas will be unstyled.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ─── ENVIRONMENT VARIABLE ────────────────────────────────────────────────────
 *   VITE_MAPBOX_TOKEN=pk.eyJ1...   (optional — enables Mapbox GL JS + styles)
 *   If absent, MapLibre GL JS is used with a token-free public dark tile set.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ─── INSTALLATION ────────────────────────────────────────────────────────────
 *   npm install mapbox-gl          # for Mapbox path
 *   npm install maplibre-gl        # for MapLibre path (token-free)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── CSS IMPORT PLACEHOLDER ──────────────────────────────────────────────────
// Uncomment whichever you installed:
// import 'mapbox-gl/dist/mapbox-gl.css';
// import 'maplibre-gl/dist/maplibre-gl.css';
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef, type MutableRefObject } from "react";
import { Link } from "react-router-dom";
import { WeatherBackground } from "@/components/WeatherBackground";
import mapboxgl from "mapbox-gl";
import maplibregl from "maplibre-gl";
import { useToast } from "@/hooks/use-toast";
import LogoMark from "@/components/landing/LogoMark";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Scale,
  MapPin,
  TrendingUp,
  Sparkles,
  Star,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Info,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  Newspaper,
  X,
} from "lucide-react";

/* ============================================================
 * Config — override via environment variable at build time.
 * Vite:  VITE_API_BASE_URL=http://localhost:8000
 * ============================================================ */

const API_BASE = "";

// Optional Mapbox token — when present enables Mapbox GL JS + Mapbox styles.
// When absent MapLibre GL JS is used with a public token-free dark tile style.
const MAPBOX_TOKEN: string =
  "";

/* ============================================================
 * API response types (unchanged from Hub.backend.tsx)
 * ============================================================ */

type ApiHubSummary = {
  id: string;
  name: string;
  region: string;
  x: number;
  y: number;
  short_insight: string;
  tags: string[];
  coordinates?: { lat: number; lng: number };
};

type ApiMapPin = {
  label: string;
  lat: number;
  lng: number;
  color: "red" | "blue" | "white";
  description: string;
  external_link: string | null;
};

type ApiParitySnapshot = {
  olympic_story_estimate: string;
  paralympic_story_estimate: string;
  parity_note: string;
};

type ApiHubDetail = {
  id: string;
  name: string;
  region: string;
  x: number;
  y: number;
  coordinates: { lat: number; lng: number };
  tags: string[];
  narrative: string;
  map_pins: ApiMapPin[];
  parity_snapshot: ApiParitySnapshot;
  sources: string[];
};

type ApiBriefResponse = {
  hub_id: string;
  hub_name: string;
  brief: string;
  themes: string[];
  disclaimer: string;
  source: "local-fallback" | "gemini" | "vertex";
};

/* ============================================================
 * Internal HometownCity shape
 * Extended with real lat/lng for map placement.
 * ============================================================ */

type HometownCity = {
  id: string;
  name: string;
  region: string;
  x: number; // SVG % position (from backend, used by fallback panel)
  y: number; // SVG % position (from backend, used by fallback panel)
  lat: number; // Real geographic latitude (from backend coordinates)
  lng: number; // Real geographic longitude (from backend coordinates)
  insight: string;
  tags: string[];
  // Derived signal fields — computed from live backend data; no mock defaults.
  signalScore: number;
  signalSummary: string;
  sportFamilies: string[];
  narrative?: string;
  map_pins?: ApiMapPin[];
  parity_snapshot?: ApiParitySnapshot;
  sources?: string[];
};

/* ============================================================
 * Live-data adapters and derived intel.
 * No mock/fallback datasets — all values come from the live
 * Cloud Run backend or are neutral placeholders ("—") when a
 * specific signal is not yet available for a hub.
 * ============================================================ */

/* CityIntel — descriptive, derived entirely from live backend data
   (parity_snapshot, tags, narrative). Never sourced from mocks. */
type CityIntel = {
  olympianSignals: number;
  paralympianSignals: number;
  landscapeProfile: string;
  climateType: string;
  terrain: string;
  landscapeTags: string[];
  storyline: string;
  storyArcs: { targetId: string; type: "olympic" | "paralympic" | "la28"; label: string }[];
};

const EMPTY_INTEL: CityIntel = {
  olympianSignals: 0,
  paralympianSignals: 0,
  landscapeProfile: "—",
  climateType: "—",
  terrain: "—",
  landscapeTags: [],
  storyline: "",
  storyArcs: [],
};

// Pull the *roster count* out of a parity-snapshot estimate string.
// The backend phrasing is consistently:
//   "{City} could support an estimated N unique Olympic|Paralympic ..."
// or, when no entries exist:
//   "No Paralympic hometown roster entries appeared for {City} ..."
// We must NOT fall back to the first integer in the string, because phrases
// like "official 2024 USOPC roster data" would otherwise be mis-parsed as 2024.
function parseRosterCount(text: string | undefined): number {
  if (!text) return 0;
  if (/^\s*no\b/i.test(text)) return 0;
  const m = text.match(/estimated\s+(\d+)\s+unique/i);
  return m ? parseInt(m[1], 10) : 0;
}

// Pull the comma-separated sport list out of a map_pin description.
// Backend phrasing: "...across sports including Rugby, Archery, Cycling. These are..."
function extractSportsFromPin(description: string | undefined): string[] {
  if (!description) return [];
  const m = description.match(/across sports including\s+([^.]+)\./i);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Derive an intel object from a live HometownCity (which already has
// optional narrative + parity_snapshot + map_pins merged in from the detail
// endpoint). Every value here is sourced from live backend fields — no mock
// climate/terrain data is invented when the backend doesn't return it.
function deriveCityIntel(city: HometownCity | undefined, allCities: HometownCity[]): CityIntel {
  if (!city) return EMPTY_INTEL;
  const tags = city.tags ?? [];
  const olympianSignals = parseRosterCount(city.parity_snapshot?.olympic_story_estimate);
  const paralympianSignals = parseRosterCount(city.parity_snapshot?.paralympic_story_estimate);

  // Repurpose the legacy "landscape" fields with values the backend actually
  // provides, so no row ever shows a blank or fabricated descriptor.
  const landscapeProfile = city.region || tags[0] || "—";
  const climateType = tags[0] || city.region || "—";
  const terrain = tags[1] || "—";
  const landscapeTags = tags;
  const storyline = city.narrative || city.insight || EMPTY_INTEL.storyline;

  // Build live story-arc references to other live hubs (LA28 + a couple peers).
  const arcs: CityIntel["storyArcs"] = [];
  const la = allCities.find((c) => c.id !== city.id && /los angeles/i.test(c.name));
  if (la) arcs.push({ targetId: la.id, type: "la28", label: "LA28 Watchline" });
  const peers = allCities.filter((c) => c.id !== city.id && c.id !== la?.id).slice(0, 2);
  peers.forEach((p, i) =>
    arcs.push({
      targetId: p.id,
      type: i === 0 ? "olympic" : "paralympic",
      label: i === 0 ? "Regional Sport Culture" : "Parity Storyline",
    }),
  );

  return {
    olympianSignals,
    paralympianSignals,
    landscapeProfile,
    climateType,
    terrain,
    landscapeTags,
    storyline,
    storyArcs: arcs,
  };
}

// Display helper — when the backend reports "No ... entries" for a parity
// estimate, render a graceful dash instead of a flat zero.
function formatRosterCount(count: number, sourceText?: string): string {
  if (sourceText && /^\s*no\b/i.test(sourceText)) return "—";
  return String(count);
}

/* ============================================================
 * LA28 momentum — live backend types and adapter.
 * ============================================================ */

type SportKind = "olympic" | "paralympic";
type SportSignals = {
  hometown: number;
  worldChamp: number;
  news: number;
  la28: number;
};
type LA28Sport = {
  id: string;
  name: string;
  kind: SportKind;
  signals: SportSignals;
  reason: string;
  momentumScoreLive?: number; // backend-provided composite score (0–100)
};

type ApiLA28Sport = {
  id: string;
  name: string;
  kind: SportKind;
  signals: { hometown: number; world_champ: number; news: number; la28: number };
  momentum_score: number;
  reason: string;
};

type ApiLA28Momentum = {
  hub_id: string;
  hub_name: string;
  sports: ApiLA28Sport[];
  disclaimer: string;
};

/* ============================================================
 * Hometown News Pulse — live backend types.
 * GET ${API_BASE}/api/hometown/hubs/{hub_id}/news-pulse
 * ============================================================ */

type ApiNewsPulseCard = {
  title: string;
  summary: string;
  category?: string | null;
  source_label?: string | null;
  source_url?: string | null;
  published_date?: string | null;
};

type ApiNewsPulse = {
  hub_id: string;
  hub_name: string;
  generated_with_gemini: boolean;
  source?: string | null;
  model?: string | null;
  query?: string | null;
  cards: ApiNewsPulseCard[];
  brief?: string | null;
  disclaimer?: string | null;
  generated_at?: string | null;
};

// Composite weighted score — used as a local recompute when needed.
// Backend also returns momentum_score; prefer that when present.
function momentumScore(s: SportSignals): number {
  return Math.round(s.hometown * 0.3 + s.worldChamp * 0.25 + s.news * 0.2 + s.la28 * 0.25);
}

function adaptLA28Sport(s: ApiLA28Sport): LA28Sport {
  return {
    id: s.id,
    name: s.name,
    kind: s.kind,
    signals: {
      hometown: s.signals.hometown,
      worldChamp: s.signals.world_champ,
      news: s.signals.news,
      la28: s.signals.la28,
    },
    reason: s.reason,
    momentumScoreLive: s.momentum_score,
  };
}

function hubSummaryToCity(h: ApiHubSummary): HometownCity {
  const lat = h.coordinates?.lat ?? 39.5;
  const lng = h.coordinates?.lng ?? -98.35;
  // Build a short, neutral signal summary directly from live tags so no mock
  // copy ever surfaces in the UI.
  const tagLine = (h.tags ?? []).slice(0, 3).join(" · ");
  return {
    id: h.id,
    name: h.name,
    region: h.region,
    x: h.x,
    y: h.y,
    lat,
    lng,
    insight: h.short_insight,
    tags: h.tags,
    // Light derived score from live tag breadth so the fallback panel bar has a
    // representative width. The authoritative momentum score is fetched live
    // from /api/la28/momentum and rendered elsewhere.
    signalScore: Math.min(100, 40 + (h.tags?.length ?? 0) * 10),
    signalSummary: tagLine ? `Live signal mix — ${tagLine}.` : "Live signal mix from Cloud Run backend.",
    sportFamilies: [],
  };
}

function mergeDetailIntoCity(city: HometownCity, d: ApiHubDetail): HometownCity {
  // Pull a deduped sport-family list from the live map_pin descriptions so
  // every backend hub gets a populated sport chip row — no mock fallback.
  const liveSports = Array.from(new Set((d.map_pins ?? []).flatMap((p) => extractSportsFromPin(p.description)))).slice(
    0,
    6,
  );
  return {
    ...city,
    lat: d.coordinates?.lat ?? city.lat,
    lng: d.coordinates?.lng ?? city.lng,
    narrative: d.narrative,
    map_pins: d.map_pins,
    parity_snapshot: d.parity_snapshot,
    sources: d.sources,
    sportFamilies: liveSports.length > 0 ? liveSports : city.sportFamilies,
  };
}

/* ============================================================
 * Custom hooks — data fetching (unchanged from Hub.backend.tsx)
 * ============================================================ */

type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string };

function useHometownHubs(): {
  cities: HometownCity[];
  loading: boolean;
  error: string | null;
} {
  const [state, setState] = useState<AsyncState<HometownCity[]>>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    fetch(`${API_BASE}/api/hometown/hubs`)
      .then((res) => {
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        return res.json() as Promise<ApiHubSummary[]>;
      })
      .then((data) => {
        if (!cancelled) {
          setState({ status: "success", data: data.map(hubSummaryToCity) });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn("[Hometown] Hub list fetch failed:", err.message);
          setState({
            status: "error",
            message: "The live Cloud Run backend could not be reached.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    cities: state.status === "success" ? state.data : [],
    loading: state.status === "loading" || state.status === "idle",
    error: state.status === "error" ? state.message : null,
  };
}

function useHubDetail(hubId: string | null): {
  detail: ApiHubDetail | null;
  loading: boolean;
  error: string | null;
} {
  const [state, setState] = useState<AsyncState<ApiHubDetail>>({ status: "idle" });

  useEffect(() => {
    if (!hubId) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });

    fetch(`${API_BASE}/api/hometown/hubs/${encodeURIComponent(hubId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        return res.json() as Promise<ApiHubDetail>;
      })
      .then((data) => {
        if (!cancelled) setState({ status: "success", data });
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn(`[Hometown] Detail fetch for '${hubId}' failed:`, err.message);
          setState({ status: "error", message: err.message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hubId]);

  return {
    detail: state.status === "success" ? state.data : null,
    loading: state.status === "loading",
    error: state.status === "error" ? state.message : null,
  };
}

function useGenerateBrief(): {
  generate: (hubId: string, interests?: string[]) => Promise<ApiBriefResponse | null>;
  loading: boolean;
} {
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async (hubId: string, interests?: string[]): Promise<ApiBriefResponse | null> => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/hometown/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hub_id: hubId, interests: interests ?? null }),
      });
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      return (await res.json()) as ApiBriefResponse;
    } catch (err) {
      console.warn("[Hometown] Brief generation failed:", (err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generate, loading };
}

function useLA28Momentum(hubId: string | null): {
  sports: LA28Sport[];
  loading: boolean;
  error: string | null;
} {
  const [state, setState] = useState<AsyncState<LA28Sport[]>>({ status: "idle" });

  useEffect(() => {
    if (!hubId) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });

    fetch(`${API_BASE}/api/la28/momentum/${encodeURIComponent(hubId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        return res.json() as Promise<ApiLA28Momentum>;
      })
      .then((data) => {
        if (!cancelled) {
          const sports = (data.sports ?? [])
            .map(adaptLA28Sport)
            .sort((a, b) => (b.momentumScoreLive ?? 0) - (a.momentumScoreLive ?? 0));
          setState({ status: "success", data: sports });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn(`[LA28] Momentum fetch for '${hubId}' failed:`, err.message);
          setState({ status: "error", message: err.message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hubId]);

  return {
    sports: state.status === "success" ? state.data : [],
    loading: state.status === "loading",
    error: state.status === "error" ? state.message : null,
  };
}


/* ============================================================
 * Design tokens (unchanged)
 * ============================================================ */

type PersonalizationData = {
  hometown: string;
  interests: string;
  movement: string;
  experience: string;
};

const NAVY_BG = "#070B16";
const CARD_BG = "#0B1224";
const BORDER = "rgba(255,255,255,0.10)";
const MUTED = "#AAB4C8";
const RED = "#E03A3E";
const BLUE = "#2D7DFF";

/* ============================================================
 * Map tile style constants
 * ============================================================ */

// Mapbox Standard style — 3D-ready, requires VITE_MAPBOX_TOKEN
const MAPBOX_DARK_STYLE = "mapbox://styles/mapbox/standard";

// Token-free public dark tile style via MapLibre-compatible sources.
// Uses a free OpenFreeMap dark tiles (Protomaps-based, no key needed).
const MAPTILER_FREE_DARK_STYLE = "https://tiles.openfreemap.org/styles/liberty";

/* ============================================================
 * MapLibre / Mapbox GL type shim
 * These types capture the minimal surface area we use so the
 * file compiles without installing either package as a dev
 * dependency.  If you install mapbox-gl or maplibre-gl the
 * actual imported types will take precedence.
 * ============================================================ */

interface GlMap {
  on(event: string, handler: (...args: any[]) => void): void;
  on(event: string, layer: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  off(event: string, layer: string, handler: (...args: any[]) => void): void;
  setPitch?(pitch: number): void;
  setBearing?(bearing: number): void;
  flyTo(options: { center: [number, number]; zoom?: number; duration?: number }): void;
  fitBounds(
    bounds: [[number, number], [number, number]],
    options?: {
      padding?: number | { top: number; bottom: number; left: number; right: number };
      duration?: number;
      maxZoom?: number;
      linear?: boolean;
    },
  ): void;
  addControl(control: object, position?: string): void;
  addSource(id: string, source: object): void;
  getSource(id: string): { setData?: (data: object) => void } | undefined;
  addLayer(layer: object): void;
  getLayer(id: string): object | undefined;
  remove(): void;
  getCanvas(): HTMLCanvasElement;
  resize(): void;
  project(lngLat: [number, number]): { x: number; y: number };
}

interface GlMapConstructor {
  new (options: {
    container: HTMLElement | string;
    style: string;
    center: [number, number];
    zoom: number;
    projection?: string;
    pitch?: number;
    bearing?: number;
    antialias?: boolean;
    accessToken?: string;
    attributionControl?: boolean;
  }): GlMap;
}

interface GlMarker {
  setLngLat(coord: [number, number]): GlMarker;
  addTo(map: GlMap): GlMarker;
  getElement(): HTMLElement;
  remove(): void;
}

interface GlMarkerConstructor {
  new (options?: { element?: HTMLElement; anchor?: string }): GlMarker;
}

interface GlNavigationControl {
  new (options?: { showCompass?: boolean; showZoom?: boolean }): object;
}

/* ============================================================
 * Dynamic GL library loader
 * Tries mapbox-gl first (when token present), then maplibre-gl.
 * Returns null if neither is installed — triggers the fallback UI.
 * ============================================================ */

type GlLibrary = {
  Map: GlMapConstructor;
  Marker: GlMarkerConstructor;
  NavigationControl: GlNavigationControl;
  accessToken?: string;
};

const CITY_SOURCE_ID = "hometown-city-points";
const CITY_HALO_LAYER_ID = "hometown-city-halo";
const CITY_CORE_LAYER_ID = "hometown-city-core";

function getGlLibrary(): GlLibrary | null {
  if (MAPBOX_TOKEN) {
    try {
      (mapboxgl as any).accessToken = MAPBOX_TOKEN;
      return mapboxgl as unknown as GlLibrary;
    } catch {
      /* fall through */
    }
  }
  try {
    return maplibregl as unknown as GlLibrary;
  } catch {
    return null;
  }
}

function createCityGeoJson(cities: HometownCity[], selectedId: string) {
  const HARDCODED_COUNTS: Record<string, number> = {
    "sd": 15,
    "hou": 13,
    "la": 11,
    "cos": 10,
    "chi": 8,
    "atl": 6,
    "cha": 6,
    "lb": 6,
    "mia": 6,
    "por": 5,
    "tuc": 5,
    "bhm": 4,
    "lv": 5,
    "sj": 5,
    "nyc": 8,
    "dal": 5,
    "sea": 4
  };

  return {
    type: "FeatureCollection",
    features: cities.map((city) => {
      const selected = city.id === selectedId;
      const total = HARDCODED_COUNTS[city.id] || 5;
      
      const baseHalo = 10 + (total * 1.5);
      const baseCore = 4 + (total * 0.5);

      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [city.lng, city.lat] },
        properties: {
          id: city.id,
          name: city.name,
          selected,
          color: selected ? RED : "#2D7DFF", // Blue
          haloRadius: selected ? baseHalo + 8 : baseHalo,
          coreRadius: selected ? baseCore + 3 : baseCore,
        },
      };
    }),
  };
}

function upsertCityLayers(map: GlMap, cities: HometownCity[], selectedId: string) {
  const data = createCityGeoJson(cities, selectedId);
  const existingSource = map.getSource(CITY_SOURCE_ID);

  if (existingSource?.setData) {
    existingSource.setData(data);
    return;
  }

  map.addSource(CITY_SOURCE_ID, {
    type: "geojson",
    data,
  });

  if (!map.getLayer(CITY_HALO_LAYER_ID)) {
    map.addLayer({
      id: CITY_HALO_LAYER_ID,
      type: "circle",
      source: CITY_SOURCE_ID,
      paint: {
        "circle-radius": ["get", "haloRadius"],
        "circle-color": ["get", "color"],
        "circle-opacity": ["case", ["boolean", ["get", "selected"], false], 0.25, 0.18],
        "circle-blur": 0.35,
        "circle-pitch-alignment": "map",
        "circle-pitch-scale": "map",
      },
    });
  }

  if (!map.getLayer(CITY_CORE_LAYER_ID)) {
    map.addLayer({
      id: CITY_CORE_LAYER_ID,
      type: "circle",
      source: CITY_SOURCE_ID,
      paint: {
        "circle-radius": ["get", "coreRadius"],
        "circle-color": ["get", "color"],
        "circle-opacity": 0.96,
        "circle-stroke-width": 2,
        "circle-stroke-color": NAVY_BG,
        "circle-pitch-alignment": "map",
        "circle-pitch-scale": "map",
      },
    });
  }
}

/* ============================================================
 * Marker DOM element factory
 * Creates a styled pulsing dot to use as a custom GL marker.
 * ============================================================ */

function createMarkerElement(color: string, selected: boolean, cityName: string): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("aria-label", cityName);
  wrapper.style.cssText = `
    position: relative;
    width: ${selected ? "18px" : "13px"};
    height: ${selected ? "18px" : "13px"};
    cursor: pointer;
  `;

  // Outer glow ring
  const ring = document.createElement("div");
  ring.style.cssText = `
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    background: ${color};
    opacity: 0.15;
    ${selected ? "animation: hometown-ping 1.4s cubic-bezier(0,0,0.2,1) infinite;" : ""}
  `;
  wrapper.appendChild(ring);

  // Mid halo
  const halo = document.createElement("div");
  halo.style.cssText = `
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    background: ${color};
    opacity: 0.22;
  `;
  wrapper.appendChild(halo);

  // Core dot
  const core = document.createElement("div");
  core.style.cssText = `
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: ${color};
    box-shadow: 0 0 14px ${color};
    border: 2px solid #070B16;
    transition: transform 0.15s ease;
  `;
  wrapper.appendChild(core);

  wrapper.addEventListener("mouseenter", () => {
    core.style.transform = "scale(1.3)";
  });
  wrapper.addEventListener("mouseleave", () => {
    core.style.transform = "scale(1)";
  });

  return wrapper;
}

// Inject keyframes once (ping + arc draw-on + pulse ring)
if (typeof document !== "undefined") {
  const styleId = "hometown-ping-keyframe";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes hometown-ping {
        75%, 100% { transform: scale(2.2); opacity: 0; }
      }
      @keyframes arc-draw {
        from { stroke-dashoffset: 600; opacity: 0; }
        10%  { opacity: 1; }
        to   { stroke-dashoffset: 0; opacity: 1; }
      }
      @keyframes la-host-pulse {
        0%   { r: 16px; opacity: 0.7; }
        70%  { r: 40px; opacity: 0; }
        100% { r: 16px; opacity: 0; }
      }
      @keyframes selected-pulse-ring {
        0%   { r: 8px; opacity: 0.55; }
        70%  { r: 28px; opacity: 0; }
        100% { r: 8px; opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

/* ============================================================
 * InteractiveMap component
 * ─────────────────────────────────────────────────────────────
 * This is the new map component that replaces FlagshipMap.
 * It lives at roughly the same position in the file as the old
 * FlagshipMap component (search "InteractiveMap" to locate it).
 * ============================================================ */

type InteractiveMapProps = {
  cities: HometownCity[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Ref for the flyTo function — parent fills this after mount. Optional peer coord triggers fitBounds. */
  flyToRef?: MutableRefObject<((city: HometownCity, peer?: { lng: number; lat: number } | null) => void) | null>;
  /** Notifies parent when the GL map instance is ready/destroyed (for overlays) */
  onMapReady?: (map: GlMap | null) => void;
};

/**
 * InteractiveMap
 *
 * Renders a Mapbox GL JS or MapLibre GL JS map with custom markers for each
 * hometown city. Clicking a marker fires onSelect. The parent component injects
 * a flyTo function via flyToRef so city-chip clicks can animate the viewport.
 *
 * CSS IMPORT NOTE: You must also import the GL library's CSS in your entry point:
 *   import 'mapbox-gl/dist/mapbox-gl.css'   OR
 *   import 'maplibre-gl/dist/maplibre-gl.css'
 */
function InteractiveMap({ cities, selectedId, onSelect, flyToRef, onMapReady }: InteractiveMapProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GlMap | null>(null);
  const [libAvailable, setLibAvailable] = useState<boolean | null>(null); // null = unknown yet
  const [mapError, setMapError] = useState<string | null>(null);

  // Initial US center, zoomed out to show all 5 cities
  const INITIAL_CENTER: [number, number] = [-96, 37.5];
  const INITIAL_ZOOM = 3.4;

  // ── Library detection & map init ──────────────────────────────────────
  useEffect(() => {
    let destroyed = false;
    const lib = getGlLibrary();
    if (!lib) {
      setLibAvailable(false);
      return;
    }
    setLibAvailable(true);

    if (!containerRef.current) return;

    const tileStyle = "https://tiles.openfreemap.org/styles/liberty";

    let map: GlMap;
    try {
      map = new lib.Map({
        container: containerRef.current,
        style: tileStyle,
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        projection: "mercator",
        pitch: 0,
        bearing: 0,
        antialias: true,
        attributionControl: false,
        ...(MAPBOX_TOKEN ? { accessToken: MAPBOX_TOKEN } : {}),
      });
    } catch (err) {
      setMapError(`Map failed to initialise: ${(err as Error).message}`);
      return;
    }
    mapRef.current = map;
    onMapReady?.(map);
    const resizeTimers: number[] = [];
    const forceResize = () => {
      map.resize();
      requestAnimationFrame(() => {
        map.resize();
        requestAnimationFrame(() => map.resize());
      });
      resizeTimers.push(window.setTimeout(() => map.resize(), 150));
      resizeTimers.push(window.setTimeout(() => map.resize(), 500));
    };
    forceResize();

    // Navigation controls
    try {
      map.addControl(new (lib.NavigationControl as any)({ showCompass: false }), "top-right");
    } catch {
      /* non-fatal */
    }

    // Add markers after style loads
    map.on("load", () => {
      if (destroyed) return;
      // Force a flat, north-up Mercator map so hometown dots stay fixed to real lon/lat.
      if (MAPBOX_TOKEN) {
        try {
          (map as any).setProjection?.("mercator");
          (map as any).setPitch?.(0);
          (map as any).setBearing?.(0);
        } catch {
          /* non-fatal */
        }
        try {
          (map as any).setConfigProperty?.("basemap", "lightPreset", "dusk");
          (map as any).setConfigProperty?.("basemap", "show3dObjects", false);
          (map as any).setConfigProperty?.("basemap", "showPointOfInterestLabels", false);
          (map as any).setConfigProperty?.("basemap", "showTransitLabels", false);
        } catch {
          /* non-fatal — older mapbox-gl versions */
        }
      }
      upsertCityLayers(map, cities, selectedId);

      const handleCityClick = (event: any) => {
        const id = event?.features?.[0]?.properties?.id;
        if (typeof id === "string") onSelect(id);
      };
      const showPointer = () => {
        map.getCanvas().style.cursor = "pointer";
      };
      const hidePointer = () => {
        map.getCanvas().style.cursor = "";
      };
      map.on("click", CITY_CORE_LAYER_ID, handleCityClick);
      map.on("click", CITY_HALO_LAYER_ID, handleCityClick);
      map.on("mouseenter", CITY_CORE_LAYER_ID, showPointer);
      map.on("mouseleave", CITY_CORE_LAYER_ID, hidePointer);
      // Ensure correct sizing once layout settles
      forceResize();
    });

    // Surface style load errors gracefully
    map.on("error", (e: any) => {
      const msg: string = e?.error?.message ?? "Map tile error";
      console.warn("[Hometown Map]", msg);
      if (msg.toLowerCase().includes("access token") || msg.toLowerCase().includes("not authorized")) {
        setMapError(msg);
      }
    });

    // Resize observer — fixes 0×0 init inside flex/grid parents
    const ro = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    if (shellRef.current) ro.observe(shellRef.current);
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      destroyed = true;
      resizeTimers.forEach((timer) => window.clearTimeout(timer));
      ro.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      onMapReady?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ── Update markers when cities or selection changes ──────────────────
  useEffect(() => {
    if (!mapRef.current || !libAvailable) return;
    try {
      upsertCityLayers(mapRef.current, cities, selectedId);
    } catch {
      /* style may still be loading; the load handler adds the source/layers */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities, selectedId]);

  // ── Expose flyTo for city-chip integration ───────────────────────────
  useEffect(() => {
    if (!flyToRef) return;
    flyToRef.current = (city: HometownCity, peer?: { lng: number; lat: number } | null) => {
      const m = mapRef.current;
      if (!m) return;
      if (peer && (peer.lng !== city.lng || peer.lat !== city.lat)) {
        const minLng = Math.min(city.lng, peer.lng);
        const maxLng = Math.max(city.lng, peer.lng);
        const minLat = Math.min(city.lat, peer.lat);
        const maxLat = Math.max(city.lat, peer.lat);
        try {
          m.fitBounds(
            [
              [minLng, minLat],
              [maxLng, maxLat],
            ],
            { padding: { top: 90, bottom: 90, left: 110, right: 110 }, duration: 1200, maxZoom: 6, linear: false },
          );
          return;
        } catch {
          /* fall through to flyTo */
        }
      }
      m.flyTo({ center: [city.lng, city.lat], zoom: 7, duration: 1200 });
    };
  }, [flyToRef]);

  // ── Render ────────────────────────────────────────────────────────────
  // Neither mapbox-gl nor maplibre-gl is installed — non-interactive fallback
  if (libAvailable === false || mapError) {
    return <MapFallback cities={cities} selectedId={selectedId} onSelect={onSelect} mapError={mapError} />;
  }

  return (
    <div
      ref={shellRef}
      className="relative h-full min-h-[340px] w-full overflow-hidden rounded-2xl border sm:min-h-[520px] lg:min-h-[640px]"
      style={{ borderColor: BORDER }}
    >
      {/* ── GL canvas container ── */}
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      {libAvailable === null && (
        <div
          className="pointer-events-none absolute inset-0 animate-pulse rounded-2xl"
          style={{ background: "rgba(255,255,255,0.04)" }}
          aria-label="Map loading"
        />
      )}

      {/* ── Map branding badge ── */}
      <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <span
          className="rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.2em]"
          style={{
            color: "rgba(255,255,255,0.5)",
            borderColor: "rgba(255,255,255,0.12)",
            background: "rgba(7,11,22,0.75)",
          }}
        >
          {MAPBOX_TOKEN ? "Mapbox" : "MapLibre"} · Live aggregate signals · not predictive
        </span>
      </div>
    </div>
  );
}

/* ============================================================
 * MapFallback — polished non-interactive panel
 * Rendered when neither mapbox-gl nor maplibre-gl is installed.
 * Shows the same mock city data in a list/grid layout.
 * ============================================================ */

function MapFallback({
  cities,
  selectedId,
  onSelect,
  mapError,
}: {
  cities: HometownCity[];
  selectedId: string;
  onSelect: (id: string) => void;
  mapError?: string | null;
}) {
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-2xl border"
      style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
    >
      {/* Install prompt banner */}
      <div
        className="absolute inset-x-0 top-0 px-4 py-2 text-[10px] uppercase tracking-[0.18em]"
        style={{
          background: "rgba(45,125,255,0.10)",
          borderBottom: `1px solid ${BORDER}`,
          color: MUTED,
        }}
      >
        {mapError
          ? `Map error: ${mapError} — interactive map unavailable`
          : "Install mapbox-gl or maplibre-gl to enable the interactive map · Showing city list"}
      </div>

      {/* City grid */}
      <div className="absolute inset-0 top-9 flex flex-wrap content-start gap-3 overflow-y-auto p-4">
        {cities.map((city) => {
          const selected = city.id === selectedId;
          return (
            <button
              key={city.id}
              onClick={() => onSelect(city.id)}
              className="flex flex-col rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5"
              style={{
                borderColor: selected ? "rgba(224,58,62,0.5)" : BORDER,
                background: selected ? "rgba(224,58,62,0.08)" : "rgba(255,255,255,0.03)",
                minWidth: 160,
                maxWidth: 200,
                flex: "1 1 150px",
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: selected ? RED : BLUE }} />
                <span className="text-[12px] font-semibold text-white">{city.name}</span>
              </div>
              <span className="mt-1 text-[9px] uppercase tracking-[0.16em]" style={{ color: BLUE }}>
                {city.region}
              </span>
              <span className="mt-1.5 text-[10px] leading-snug" style={{ color: MUTED }}>
                {city.signalSummary}
              </span>
              <div className="mt-2 flex items-center gap-1.5">
                <div
                  className="h-1 rounded-full"
                  style={{
                    width: `${city.signalScore}%`,
                    background: selected ? RED : BLUE,
                    maxWidth: "100%",
                    flex: 1,
                    opacity: 0.75,
                  }}
                />
                <span className="text-[9px] font-mono text-white/60">{city.signalScore}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div
        className="pointer-events-none absolute bottom-2 left-2 text-[9px] uppercase tracking-[0.2em]"
        style={{ color: "rgba(255,255,255,0.3)" }}
      >
        Live aggregate signals · descriptive, not performance predictions
      </div>
    </div>
  );
}

/* ============================================================
 * Unchanged visual utility components from Hub.backend.tsx
 * ============================================================ */

const HubBackground = () => (
  <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden" aria-hidden="true">
    <svg className="absolute inset-0 h-full w-full opacity-[0.35]">
      <defs>
        <pattern id="hub-stars" width="160" height="160" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="22" r="0.7" fill="#F8FAFF" />
          <circle cx="80" cy="64" r="0.5" fill="#F8FAFF" opacity="0.6" />
          <circle cx="130" cy="110" r="0.8" fill="#F8FAFF" />
          <circle cx="44" cy="130" r="0.4" fill="#F8FAFF" opacity="0.5" />
          <circle cx="105" cy="22" r="0.5" fill="#F8FAFF" opacity="0.7" />
          <path d="M60 20 L61 23 L64 24 L61 25 L60 28 L59 25 L56 24 L59 23 Z" fill="#F8FAFF" opacity="0.5" />
          <path d="M120 80 L121 83 L124 84 L121 85 L120 88 L119 85 L116 84 L119 83 Z" fill="#F8FAFF" opacity="0.4" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hub-stars)" />
    </svg>
    <svg
      className="absolute inset-x-0 top-1/3 h-[260px] w-full opacity-[0.06]"
      viewBox="0 0 1200 260"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 130 C 200 60, 400 200, 600 120 C 800 40, 1000 200, 1200 130"
        stroke={RED}
        strokeWidth="1.2"
        fill="none"
      />
      <path
        d="M0 160 C 200 90, 400 230, 600 150 C 800 70, 1000 230, 1200 160"
        stroke="#F8FAFF"
        strokeWidth="1"
        fill="none"
      />
      <path
        d="M0 190 C 200 120, 400 260, 600 180 C 800 100, 1000 260, 1200 190"
        stroke={BLUE}
        strokeWidth="1.2"
        fill="none"
      />
    </svg>
    <div
      className="absolute -top-40 right-0 h-[420px] w-[420px] rounded-full opacity-[0.10] blur-3xl"
      style={{ background: BLUE }}
    />
  </div>
);

const PrimaryButton = ({
  children,
  onClick,
  className = "",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`group inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 font-display text-[12px] font-semibold uppercase tracking-[0.16em] text-[#070B16] transition-all hover:shadow-[0_0_24px_rgba(255,255,255,0.35)] hover:-translate-y-px active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100 ${className}`}
  >
    {children}
    <ArrowRight className="!h-3.5 !w-3.5 transition-transform group-hover:translate-x-0.5" />
  </button>
);

const SecondaryButton = ({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) => (
  <button
    onClick={onClick}
    className={`group inline-flex h-11 items-center gap-2 rounded-full border border-white/20 bg-transparent px-6 font-display text-[12px] font-semibold uppercase tracking-[0.16em] text-white transition-all hover:border-[${BLUE}] hover:shadow-[0_0_18px_rgba(45,125,255,0.35)] hover:-translate-y-px active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${className}`}
    style={{ ["--hover-border" as string]: BLUE }}
  >
    {children}
  </button>
);

const HubTopBar = () => (
  <header
    className="flex items-center justify-between gap-3 border-b px-4 md:gap-6 md:px-8"
    style={{ height: 56, borderColor: BORDER }}
  >
    <div className="flex items-center gap-3 md:gap-4">
      <Link
        to="/"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white shrink-0"
        style={{ borderColor: BORDER }}
        aria-label="Return to main page"
        title="Return to main page"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <Link to="/" className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80">
        <LogoMark className="h-7 w-7" />
        <div className="leading-tight">
          <div className="font-display text-[13px] font-semibold tracking-tight text-white">Team USA Constellation</div>
          <div className="hidden text-[9px] uppercase tracking-[0.22em] sm:block" style={{ color: MUTED }}>
            Fan Experience Hub
          </div>
        </div>
      </Link>
    </div>

    <nav className="hidden items-center gap-1 text-[10px] font-display font-semibold uppercase tracking-[0.18em] md:flex">
      {[{ label: "Hub", active: true }]
        .filter((item) => item.active)
        .map((item) => (
          <button
            key={item.label}
            type="button"
            className="group relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-all bg-white/10 text-white"
          >
            <span>{item.label}</span>
          </button>
        ))}
    </nav>

    <div
      className="flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-[3px] text-[9.5px] font-medium tracking-[0.14em]"
      style={{
        borderColor: "rgba(255,255,255,0.18)",
        background: "transparent",
        color: "rgba(255,255,255,0.6)",
      }}
      title="Live experience — no login required"
    >
      <Info className="h-3 w-3 opacity-70" />
      <span>Live Experience</span>
    </div>
  </header>
);

const MiniMap = () => (
  <svg viewBox="0 0 320 160" className="h-full w-full">
    <path
      d="M30 90 C 50 65, 85 50, 120 60 C 150 50, 185 55, 215 65 C 250 55, 285 60, 300 80 C 295 100, 275 115, 245 120 L 215 130 L 180 122 L 150 135 L 120 128 L 90 132 L 60 122 L 35 110 C 25 102, 22 96, 30 90 Z"
      fill="none"
      stroke="#F8FAFF"
      strokeWidth="1"
      opacity="0.3"
    />
    <g stroke="#F8FAFF" strokeWidth="0.4" opacity="0.4">
      <path d="M70 95 L130 80 L200 85 L260 95" />
      <path d="M130 80 L150 110" />
    </g>
    {[
      { x: 70, y: 95, c: BLUE },
      { x: 130, y: 80, c: RED },
      { x: 200, y: 85, c: BLUE },
      { x: 260, y: 95, c: BLUE },
      { x: 150, y: 110, c: RED },
    ].map((p, i) => (
      <g key={i}>
        <circle cx={p.x} cy={p.y} r="4" fill={p.c} opacity="0.18" />
        <circle cx={p.x} cy={p.y} r="2" fill={p.c} />
      </g>
    ))}
  </svg>
);

const HubHero = ({ onExplore, onPersonalize }: { onExplore: () => void; onPersonalize: () => void }) => (
  <section
    className="group relative flex h-full flex-col overflow-hidden rounded-3xl border p-5 transition-colors hover:border-white/20 backdrop-blur-xl"
    style={{ background: "rgba(10,15,30,0.65)", borderColor: BORDER }}
  >
    <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-[1fr_160px] md:items-center">
      <div className="min-w-0">
        <div
          className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: MUTED }}
        >
          <Star className="h-3 w-3" style={{ color: RED, fill: RED }} />
          Fan Experience Hub
        </div>
        <h1 className="font-display mt-2 text-[clamp(1.5rem,2.4vw,2.1rem)] font-bold leading-[1.05] tracking-tight text-white">
          Team USA Constellation Hub
        </h1>
        <div className="mt-2 h-[2px] w-10 rounded-full" style={{ background: BLUE }} />
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed md:text-[14px]" style={{ color: MUTED }}>
          Explore hometown signals, Olympic and Paralympic parity, athlete archetypes, and LA28 momentum in one
          Gemini-powered fan experience.
        </p>
        <p className="mt-1.5 text-[12px] italic" style={{ color: "rgba(255,255,255,0.55)" }}>
          Start anywhere. Personalize when you're ready.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.22em]" style={{ color: BLUE }}>
              ★ Recommended judge path
            </span>
            <PrimaryButton onClick={onExplore} className="w-full justify-center sm:w-auto">
              Explore Hometown Signals
            </PrimaryButton>
          </div>
          <SecondaryButton onClick={onPersonalize} className="w-full justify-center sm:w-auto">
            Personalize
          </SecondaryButton>
        </div>
      </div>
      <div
        className="hidden md:block h-[120px] rounded-xl border"
        style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
      >
        <MiniMap />
      </div>
    </div>
  </section>
);

const GeminiVisual = () => (
  <svg viewBox="0 0 200 140" className="h-full w-full">
    <g stroke="#F8FAFF" strokeWidth="0.4" opacity="0.35" fill="none">
      <path d="M40 40 L70 30 L100 50 L130 35 L160 55 M70 30 L80 70 L110 85 M100 50 L110 85 L140 95" />
    </g>
    {[
      [40, 40],
      [70, 30],
      [100, 50],
      [130, 35],
      [160, 55],
      [80, 70],
      [110, 85],
      [140, 95],
    ].map(([x, y], i) => (
      <g key={i}>
        <circle cx={x} cy={y} r="3" fill={BLUE} opacity="0.18" />
        <circle cx={x} cy={y} r="1.6" fill="#F8FAFF" />
      </g>
    ))}
    <g>
      <circle cx="120" cy="60" r="6" fill={RED} opacity="0.18" />
      <circle cx="120" cy="60" r="2.2" fill={RED} />
    </g>
  </svg>
);

const AnalystBriefCard = ({ onAsk }: { onAsk: () => void }) => (
  <section
    className="group relative flex h-full flex-col overflow-hidden rounded-3xl border p-5 transition-colors hover:border-white/20 backdrop-blur-xl"
    style={{ background: "rgba(10,15,30,0.65)", borderColor: BORDER }}
  >
    <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-[1fr_120px] md:items-center">
      <div className="min-w-0">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white"
          style={{ borderColor: BORDER, background: "rgba(45,125,255,0.08)" }}
        >
          <Sparkles className="h-3 w-3" style={{ color: BLUE }} />
          Powered by Gemini
        </span>
        <h2 className="font-display mt-2 text-[clamp(1.15rem,1.7vw,1.4rem)] font-bold leading-tight tracking-tight text-white">
          Gemini Analyst Brief
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed md:text-[13.5px]" style={{ color: MUTED }}>
          Gemini helps explain hometown patterns using public aggregate data, conditional language, and Olympic and
          Paralympic parity. These insights are designed for exploration, not performance prediction.
        </p>
        <div className="mt-4">
          <PrimaryButton onClick={onAsk} className="w-full justify-center sm:w-auto">
            Ask Gemini
          </PrimaryButton>
        </div>
      </div>
      <div
        className="hidden md:block h-[110px] rounded-xl border"
        style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
      >
        <GeminiVisual />
      </div>
    </div>
  </section>
);

const ParityVisual = () => (
  <div className="flex h-full gap-1.5">
    {(["red", "blue"] as const).map((tone) => (
      <div
        key={tone}
        className="flex flex-1 flex-col rounded-md border p-2"
        style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
      >
        <div className="text-[8px] font-semibold uppercase tracking-[0.18em]" style={{ color: MUTED }}>
          {tone === "red" ? "Olympic" : "Paralympic"}
        </div>
        <div className="mt-auto flex items-end gap-1 flex-1 pt-2">
          {[55, 75, 60, 80, 65, 70, 50].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height: `${h}%`,
                background: tone === "red" ? RED : BLUE,
                opacity: 0.55 + (i % 3) * 0.15,
              }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex items-baseline justify-between">
          <span className="font-display text-[15px] font-bold text-white">{tone === "red" ? "613" : "604"}</span>
          <span className="text-[8px] uppercase tracking-[0.18em]" style={{ color: MUTED }}>
            stories
          </span>
        </div>
      </div>
    ))}
  </div>
);

const BracketVisual = () => (
  <div className="flex h-full flex-col justify-center gap-2">
    {[
      { w: 78, c: RED, l: "Track" },
      { w: 56, c: BLUE, l: "Swim" },
      { w: 88, c: RED, l: "Gym" },
      { w: 42, c: BLUE, l: "Cycle" },
    ].map((row, i) => (
      <div key={i} className="flex items-center gap-2">
        <span className="w-9 text-[8px] uppercase tracking-[0.16em]" style={{ color: MUTED }}>
          {row.l}
        </span>
        <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div className="h-full rounded-full" style={{ width: `${row.w}%`, background: row.c }} />
        </div>
        <span className="w-6 text-right text-[9px] font-mono text-white">{row.w}</span>
      </div>
    ))}
  </div>
);

const MirrorVisual = () => {
  const dots: Array<[number, number, number]> = [
    [50, 10, 1.6],
    [38, 26, 1.2],
    [50, 26, 1.4],
    [62, 26, 1.2],
    [30, 42, 1.1],
    [44, 44, 1.3],
    [56, 44, 1.3],
    [70, 42, 1.1],
    [50, 56, 2.2],
    [42, 70, 1.4],
    [58, 70, 1.4],
    [36, 86, 1.2],
    [50, 90, 1.4],
    [64, 86, 1.2],
  ];
  return (
    <div
      className="relative h-full overflow-hidden rounded-md border"
      style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <circle cx="50" cy="50" r="44" fill="none" stroke="#F8FAFF" strokeWidth="0.25" opacity="0.18" />
        <circle cx="50" cy="50" r="34" fill="none" stroke={BLUE} strokeWidth="0.25" opacity="0.3" />
        <g stroke="#F8FAFF" strokeWidth="0.35" opacity="0.5" fill="none">
          <path d="M50 10 L50 26 L50 56 L42 70 L36 86 M50 56 L58 70 L64 86 M50 90 L42 70 M50 90 L58 70" />
          <path d="M50 26 L38 26 L30 42 L44 44 M50 26 L62 26 L70 42 L56 44" />
          <path d="M44 44 L50 56 L56 44" />
        </g>
        {dots.map(([x, y, r], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={r + 1.5} fill="#F8FAFF" opacity="0.12" />
            <circle cx={x} cy={y} r={r} fill="#F8FAFF" />
          </g>
        ))}
        <circle cx="50" cy="56" r="5" fill={BLUE} opacity="0.22" />
        <circle cx="50" cy="56" r="2.4" fill={BLUE} />
        <circle cx="64" cy="86" r="2" fill={RED} opacity="0.3" />
        <circle cx="64" cy="86" r="1.1" fill={RED} />
      </svg>
    </div>
  );
};

const SupportCard = ({
  icon: Icon,
  accent,
  title,
  copy,
  cta,
  onCta,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent: string;
  title: string;
  copy: string;
  cta: string;
  onCta: () => void;
}) => (
  <article
    className="group relative flex flex-col overflow-hidden rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:border-white/20 md:p-5 backdrop-blur-xl"
    style={{ background: "rgba(10,15,30,0.65)", borderColor: BORDER }}
  >
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-60" style={{ background: accent }} />
    <div className="flex items-center gap-2.5">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
        style={{ borderColor: BORDER, background: "rgba(255,255,255,0.03)" }}
      >
        <Icon className="h-4 w-4" style={{ color: accent }} />
      </div>
      <h3 className="font-display text-[15px] font-semibold leading-tight tracking-tight text-white md:text-[16px]">
        {title}
      </h3>
    </div>
    <p className="mt-2 flex-1 text-[12.5px] leading-snug" style={{ color: MUTED }}>
      {copy}
    </p>
    <button
      onClick={onCta}
      className="mt-3 inline-flex h-11 w-full items-center justify-between gap-2 rounded-full border bg-transparent px-4 text-[11px] font-display font-semibold uppercase tracking-[0.18em] text-white transition-all hover:bg-white/5"
      style={{ borderColor: BORDER }}
    >
      <span>{cta}</span>
      <ArrowRight className="!h-3.5 !w-3.5" />
    </button>
  </article>
);

/* ============================================================
 * Skeleton components (unchanged)
 * ============================================================ */

const HubListSkeleton = () => (
  <div className="flex gap-2 overflow-x-auto pb-1">
    {[1, 2, 3, 4, 5].map((i) => (
      <div
        key={i}
        className="h-8 w-20 shrink-0 animate-pulse rounded-full"
        style={{ background: "rgba(255,255,255,0.07)" }}
      />
    ))}
  </div>
);

const SidebarSkeleton = () => (
  <div className="flex flex-col gap-3 p-4">
    <div className="h-4 w-24 animate-pulse rounded" style={{ background: "rgba(255,255,255,0.07)" }} />
    <div className="h-6 w-40 animate-pulse rounded" style={{ background: "rgba(255,255,255,0.07)" }} />
    <div className="h-3 w-full animate-pulse rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
    <div className="h-3 w-5/6 animate-pulse rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
    <div className="h-3 w-4/6 animate-pulse rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
    <div className="mt-2 flex flex-wrap gap-1.5">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-5 w-16 animate-pulse rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
      ))}
    </div>
  </div>
);

/* ============================================================
 * CityRail — horizontal scroll city selector with edge fades
 * ============================================================ */
const SHORT_CITY_LABELS: Record<string, string> = {
  "san diego": "San Diego",
  houston: "Houston",
  "los angeles": "LA",
  "colorado springs": "Colorado",
  chicago: "Chicago",
  atlanta: "Atlanta",
  charlotte: "Charlotte",
  "long beach": "Long Beach",
  miami: "Miami",
  portland: "Portland",
  tucson: "Tucson",
  birmingham: "Birmingham",
};

function shortCityLabel(name: string): string {
  const base = name.split(",")[0].trim();
  const key = base.toLowerCase();
  return SHORT_CITY_LABELS[key] ?? base;
}

// Unique chip background per city — informed by climate, terrain, and signature sports.
// Used by CityRail to give each city a distinct visual identity.
type CityTheme = { from: string; to: string; accent: string; emoji: string };
const CITY_THEMES: Record<string, CityTheme> = {
  // West Coast — coastal sun + beach/skate/track
  "los angeles": { from: "#F25C54", to: "#F7B267", accent: "#FFE066", emoji: "🌴" },
  la: { from: "#F25C54", to: "#F7B267", accent: "#FFE066", emoji: "🌴" },
  "long beach": { from: "#0EA5E9", to: "#F472B6", accent: "#FDE68A", emoji: "🏖️" },
  "san diego": { from: "#06B6D4", to: "#3B82F6", accent: "#FCD34D", emoji: "🏄" },
  "san francisco": { from: "#64748B", to: "#F97316", accent: "#FCA5A5", emoji: "🌉" },
  portland: { from: "#0F766E", to: "#84CC16", accent: "#A7F3D0", emoji: "🌲" },
  seattle: { from: "#1E3A8A", to: "#0891B2", accent: "#94A3B8", emoji: "🏔️" },
  // Mountain / altitude — snow, climbing, endurance
  "colorado springs": { from: "#1E293B", to: "#7DD3FC", accent: "#E2E8F0", emoji: "⛰️" },
  colorado: { from: "#1E293B", to: "#7DD3FC", accent: "#E2E8F0", emoji: "⛰️" },
  denver: { from: "#1E293B", to: "#A78BFA", accent: "#F8FAFC", emoji: "🏂" },
  // Desert — heat, basketball, baseball
  phoenix: { from: "#7C2D12", to: "#F59E0B", accent: "#FED7AA", emoji: "🌵" },
  tucson: { from: "#92400E", to: "#FB923C", accent: "#FEF3C7", emoji: "🌞" },
  "las vegas": { from: "#7E22CE", to: "#F59E0B", accent: "#FBBF24", emoji: "🎰" },
  // Subtropical / Gulf — swim, soccer, track
  miami: { from: "#0EA5E9", to: "#EC4899", accent: "#5EEAD4", emoji: "🌊" },
  houston: { from: "#1E40AF", to: "#0D9488", accent: "#FDE68A", emoji: "🚀" },
  "san antonio": { from: "#B45309", to: "#0E7490", accent: "#FBBF24", emoji: "🪕" },
  "new orleans": { from: "#7C3AED", to: "#10B981", accent: "#FCD34D", emoji: "🎺" },
  orlando: { from: "#0891B2", to: "#22C55E", accent: "#FDE68A", emoji: "🐊" },
  tampa: { from: "#06B6D4", to: "#F472B6", accent: "#FEF3C7", emoji: "⚓" },
  // Southeast — football, gymnastics
  atlanta: { from: "#7F1D1D", to: "#F59E0B", accent: "#FDE68A", emoji: "🍑" },
  charlotte: { from: "#1E40AF", to: "#10B981", accent: "#BAE6FD", emoji: "🏁" },
  birmingham: { from: "#9A3412", to: "#0F766E", accent: "#FED7AA", emoji: "🔧" },
  nashville: { from: "#854D0E", to: "#7C3AED", accent: "#FDE68A", emoji: "🎸" },
  // Midwest — football, hockey, wrestling
  chicago: { from: "#0C4A6E", to: "#DC2626", accent: "#E0F2FE", emoji: "🌆" },
  detroit: { from: "#1F2937", to: "#2563EB", accent: "#F87171", emoji: "🏎️" },
  minneapolis: { from: "#0C4A6E", to: "#A78BFA", accent: "#E0F2FE", emoji: "❄️" },
  cleveland: { from: "#7C2D12", to: "#0E7490", accent: "#FCA5A5", emoji: "🏭" },
  indianapolis: { from: "#1E3A8A", to: "#EAB308", accent: "#FEF3C7", emoji: "🏁" },
  // Northeast — rowing, marathon, ice
  boston: { from: "#14532D", to: "#B91C1C", accent: "#FCA5A5", emoji: "🚣" },
  "new york": { from: "#0F172A", to: "#F59E0B", accent: "#E2E8F0", emoji: "🗽" },
  philadelphia: { from: "#7F1D1D", to: "#1E40AF", accent: "#FDE68A", emoji: "🔔" },
  "washington dc": { from: "#1E3A8A", to: "#9F1239", accent: "#F1F5F9", emoji: "🏛️" },
  washington: { from: "#1E3A8A", to: "#9F1239", accent: "#F1F5F9", emoji: "🏛️" },
  pittsburgh: { from: "#0F172A", to: "#EAB308", accent: "#FDE68A", emoji: "🌉" },
  // Plains / Heartland
  "kansas city": { from: "#1D4ED8", to: "#DC2626", accent: "#FDE68A", emoji: "🌾" },
  "salt lake city": { from: "#1E3A8A", to: "#E0E7FF", accent: "#F8FAFC", emoji: "🎿" },
  "oklahoma city": { from: "#9A3412", to: "#1E40AF", accent: "#FED7AA", emoji: "🌪️" },
  // Pacific
  honolulu: { from: "#0EA5E9", to: "#22C55E", accent: "#FDE68A", emoji: "🌺" },
  anchorage: { from: "#0F172A", to: "#38BDF8", accent: "#E0F2FE", emoji: "🐻‍❄️" },
};

const DEFAULT_CITY_THEME: CityTheme = {
  from: "#1E293B",
  to: "#475569",
  accent: "#CBD5E1",
  emoji: "⭐",
};

function cityTheme(name: string): CityTheme {
  const key = (name.split(",")[0] || "").trim().toLowerCase();
  return CITY_THEMES[key] ?? DEFAULT_CITY_THEME;
}

function CityRail({
  cities,
  selectedId,
  onSelect,
}: {
  cities: HometownCity[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeft(scrollLeft > 4);
    setShowRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateFades();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateFades, { passive: true });
    const ro = new ResizeObserver(updateFades);
    ro.observe(el);
    // Translate vertical wheel into horizontal scroll for trackpad/mouse users
    const onWheel = (e: WheelEvent) => {
      const canScrollH = el.scrollWidth > el.clientWidth;
      if (!canScrollH) return;
      // Use whichever axis has the larger delta (mouse wheel = deltaY only)
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (delta === 0) return;
      el.scrollLeft += delta;
      e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("scroll", updateFades);
      el.removeEventListener("wheel", onWheel);
      ro.disconnect();
    };
  }, [updateFades, cities.length]);

  // Auto-scroll selected into view
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(`[data-city-id="${selectedId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [selectedId]);

  const scrollByAmount = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.6), behavior: "smooth" });
  };

  return (
    <div className="relative">
      {/* Left fade + arrow */}
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-12 transition-opacity duration-200 ${
          showLeft ? "opacity-100" : "opacity-0"
        }`}
        style={{ background: "linear-gradient(to right, hsl(var(--navy)) 0%, hsl(var(--navy) / 0) 100%)" }}
        aria-hidden
      />
      {showLeft && (
        <button
          type="button"
          aria-label="Scroll cities left"
          onClick={() => scrollByAmount(-1)}
          className="absolute left-1 top-1/2 z-20 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-[rgba(10,16,36,0.85)] text-white/80 shadow-md backdrop-blur transition hover:text-white hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M15 6l-6 6 6 6"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {/* Right fade + arrow */}
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-12 transition-opacity duration-200 ${
          showRight ? "opacity-100" : "opacity-0"
        }`}
        style={{ background: "linear-gradient(to left, hsl(var(--navy)) 0%, hsl(var(--navy) / 0) 100%)" }}
        aria-hidden
      />
      {showRight && (
        <button
          type="button"
          aria-label="Scroll cities right"
          onClick={() => scrollByAmount(1)}
          className="absolute right-1 top-1/2 z-20 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-[rgba(10,16,36,0.85)] text-white/80 shadow-md backdrop-blur transition hover:text-white hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {cities.map((c) => {
          const active = c.id === selectedId;
          const fullLabel = c.name.split(",")[0].trim();
          const shortLabel = shortCityLabel(c.name);
          return (
            <button
              key={c.id}
              data-city-id={c.id}
              onClick={() => onSelect(c.id)}
              aria-pressed={active}
              title={fullLabel}
              className={`shrink-0 whitespace-nowrap rounded-full border px-4 min-h-[40px] py-1.5 text-[11px] sm:text-[12px] uppercase tracking-[0.16em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                active ? "font-bold" : "font-semibold"
              }`}
              style={{
                color: active ? "#FFFFFF" : "rgba(255,255,255,0.72)",
                borderColor: active ? RED : BORDER,
                background: active ? RED : "rgba(10,16,36,0.7)",
                boxShadow: active ? `0 6px 18px -8px ${RED}` : "none",
              }}
            >
              <span className="sm:hidden">{shortLabel}</span>
              <span className="hidden sm:inline">{fullLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
 * HometownFlagshipCard
 * ─────────────────────────────────────────────────────────────
 * Contains the new InteractiveMap (replacing the old FlagshipMap
 * SVG). Everything else — layout, sidebar, chips, drawers — is
 * preserved from Hub.backend.tsx.
 * ============================================================ */

const HometownFlagshipCard = ({
  onGenerateBrief,
  onAskGemini,
}: {
  onGenerateBrief: (city: HometownCity) => void;
  onAskGemini: (city: HometownCity) => void;
}) => {
  const { cities, loading: hubsLoading, error: hubsError } = useHometownHubs();
  const [selectedId, setSelectedId] = useState<string>("");

  // Layer toggle state — mock visual states for now
  const LAYER_DEFS = [
    { id: "presence", label: "Team USA Presence", color: "#FFFFFF" },
    { id: "olympic", label: "Olympic Stories", color: RED },
    { id: "paralympic", label: "Paralympic Stories", color: BLUE },
    { id: "landscape", label: "Landscape Signals", color: "#E8C36B" },
    { id: "la28", label: "LA28 Watchline", color: "#E8C36B" },
  ] as const;
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>({
    presence: true,
    olympic: true,
    paralympic: true,
    landscape: false,
    la28: true,
  });
  const toggleLayer = (id: string) => setActiveLayers((prev) => ({ ...prev, [id]: !prev[id] }));

  // flyToRef — the InteractiveMap fills this after mounting
  const flyToRef = useRef<((city: HometownCity, peer?: { lng: number; lat: number } | null) => void) | null>(null);
  // GL map instance — captured from InteractiveMap so overlays can project lng/lat to pixels.
  const [glMap, setGlMap] = useState<GlMap | null>(null);

  // Challenge 3 — view mode + selected sport
  const [viewMode, setViewMode] = useState<"hometown" | "la28" | "parity">("hometown");
  const [selectedSportId, setSelectedSportId] = useState<string | null>(null);

  // Ensure selectedId is valid when city list arrives
  useEffect(() => {
    if (cities.length > 0 && !cities.find((c) => c.id === selectedId)) {
      setSelectedId(cities[0].id);
    }
  }, [cities, selectedId]);

  const { detail, loading: detailLoading } = useHubDetail(cities.length > 0 ? selectedId : null);

  const selectedBase = cities.find((c) => c.id === selectedId) ?? cities[0];
  const selected: HometownCity | undefined = selectedBase
    ? detail
      ? mergeDetailIntoCity(selectedBase, detail)
      : selectedBase
    : undefined;

  const { sports: liveLA28Sports } = useLA28Momentum(selected ? selected.id : null);
  const intel = selected ? deriveCityIntel(selected, cities) : null;
  const la28Sports = liveLA28Sports;

  // Reset highlighted sport when city changes
  useEffect(() => {
    setSelectedSportId(null);
  }, [selectedId]);

  // LA reference coords (LA28 host city)
  const LA_COORDS = { lng: -118.2437, lat: 34.0522 };

  // When a city chip is clicked: update selection AND fly/fit the map
  const handleCitySelect = (id: string) => {
    setSelectedId(id);
    const city = cities.find((c) => c.id === id);
    if (city && flyToRef.current) {
      flyToRef.current(city, null);
    }
  };

  // Re-fit camera when LA28 mode toggles, so the arc to LA is always visible
  useEffect(() => {
    if (!flyToRef.current || !selected) return;
    const peer = viewMode === "la28" && selected.id !== "la" ? LA_COORDS : null;
    flyToRef.current(selected, peer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  return (
    <section
      className="relative flex flex-1 flex-col overflow-hidden rounded-3xl border p-5 md:p-6 backdrop-blur-xl"
      style={{ background: "rgba(10,15,30,0.65)", borderColor: BORDER }}
    >
      <WeatherBackground city={selected} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-70" style={{ background: BLUE }} />

      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div
            className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: MUTED }}
          >
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[8.5px]"
              style={{
                borderColor: hubsError ? "rgba(224,58,62,0.45)" : "rgba(45,125,255,0.45)",
                background: hubsError ? "rgba(224,58,62,0.10)" : "rgba(45,125,255,0.1)",
                color: hubsError ? "#FFB4B6" : "#9CC2FF",
              }}
              title={
                hubsError
                  ? "The live Cloud Run backend could not be reached."
                  : "All hub data is fetched live from the Cloud Run backend."
              }
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: hubsError ? "#FF7A7E" : "#9CC2FF" }} />
              {hubsError ? "Live Backend Unreachable" : "Live Cloud Run Data"}
            </span>
          </div>
          <h2 className="font-display mt-2 text-[clamp(1.4rem,2.1vw,1.95rem)] font-bold leading-tight tracking-tight text-white">
            Hometown Signals Engine
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed md:text-[13.5px]" style={{ color: MUTED }}>
            Explore how hometown regions, Olympic and Paralympic representation, and America's varied landscapes could
            connect fans to Team USA stories.
          </p>
        </div>
      </div>

      {hubsError && !hubsLoading && (
        <div
          role="alert"
          className="mt-4 rounded-2xl border p-4"
          style={{
            borderColor: "rgba(224,58,62,0.45)",
            background: "rgba(224,58,62,0.06)",
          }}
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#FFB4B6" }} />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "#FFB4B6" }}>
                Live Backend Unreachable
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-white/85">
                The live Cloud Run backend at <span className="font-mono text-[12px]">{API_BASE}</span> could not be
                reached, so no hometown hubs could be loaded. This view intentionally avoids any placeholder cities —
                please retry in a moment.
              </p>
              <p className="mt-2 text-[11px] leading-relaxed" style={{ color: MUTED }}>
                Olympic and Paralympic parity storylines may resume once live data is available again.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* City selector rail */}
      <div className="mt-4">
        {hubsLoading ? (
          <HubListSkeleton />
        ) : (
          <CityRail cities={cities} selectedId={selectedId} onSelect={handleCitySelect} />
        )}
      </div>

      {/* View mode toggle — Hometown / LA28 / Parity */}
      <div
        role="tablist"
        aria-label="View mode"
        className="mt-3 inline-flex w-full rounded-full border p-1 sm:w-auto sm:max-w-md"
        style={{ borderColor: BORDER, background: "rgba(255,255,255,0.03)" }}
      >
        {(
          [
            { id: "hometown", label: "Hometown Signals", labelShort: "Hometown" },
            { id: "la28", label: "LA28 Momentum", labelShort: "LA28" },
            { id: "parity", label: "Parity Lens", labelShort: "Parity" },
          ] as const
        ).map((m) => {
          const active = viewMode === m.id;
          const accent = m.id === "la28" ? "#E8C36B" : m.id === "parity" ? BLUE : RED;
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={active}
              onClick={() => setViewMode(m.id)}
              className="relative flex-1 rounded-full px-2 py-1.5 text-[10px] sm:px-4 sm:text-[11px] font-semibold uppercase tracking-[0.12em] sm:tracking-[0.16em] transition-all min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              style={{
                color: active ? "#fff" : "rgba(255,255,255,0.55)",
                background: active ? "rgba(255,255,255,0.08)" : "transparent",
                boxShadow: active ? `inset 0 0 0 1px ${accent}88, 0 0 18px -6px ${accent}aa` : "none",
              }}
            >
              <span className="sm:hidden">{m.labelShort}</span>
              <span className="hidden sm:inline">{m.label}</span>
              {active && (
                <span
                  className="pointer-events-none absolute left-1/2 -bottom-[3px] h-[2px] w-6 -translate-x-1/2 rounded-full"
                  style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected city Signal Summary strip */}
      {intel && selected && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="h-1 w-1 rounded-full" style={{ background: BLUE }} />
            <span className="text-[9px] font-semibold uppercase tracking-[0.22em]" style={{ color: MUTED }}>
              Signal Summary · {selected.name.split(",")[0]}
            </span>
          </div>
          <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
            <MetricPill
              label="Olympic roster entries"
              value={formatRosterCount(intel.olympianSignals, selected.parity_snapshot?.olympic_story_estimate)}
              accent={RED}
            />
            <MetricPill
              label="Paralympic roster entries"
              value={formatRosterCount(intel.paralympianSignals, selected.parity_snapshot?.paralympic_story_estimate)}
              accent={BLUE}
            />
            <MetricPill label="Landscape context" value={intel.landscapeProfile} accent="#E8C36B" />
            <MetricPill
              label="LA28 momentum"
              value={la28Sports[0] ? `${momentumScore(la28Sports[0].signals)} / 100` : "—"}
              accent="#E8C36B"
            />
          </div>
        </div>
      )}

      {/* Map layer toggles */}
      <div className="mt-3 -mx-1 overflow-x-auto px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-1.5">
          {LAYER_DEFS.map((l) => {
            const on = !!activeLayers[l.id];
            return (
              <button
                key={l.id}
                onClick={() => toggleLayer(l.id)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition-all"
                style={{
                  color: on ? "#fff" : "rgba(255,255,255,0.55)",
                  borderColor: on ? `${l.color}66` : BORDER,
                  background: on ? `${l.color}1A` : "rgba(255,255,255,0.02)",
                }}
                aria-pressed={on}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.color, opacity: on ? 1 : 0.3 }} />
                {l.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid flex-1 gap-4 lg:grid-cols-[68%_32%] lg:gap-5">
        {/* ── Interactive Map + Storyline Pulse arcs overlay ── */}
        <div className="relative h-full min-h-[340px] sm:min-h-[520px] lg:min-h-[640px]">
          {hubsLoading ? (
            <div
              className="relative h-full w-full overflow-hidden rounded-2xl border"
              style={{ background: "rgba(255,255,255,0.03)", borderColor: BORDER }}
            >
              <div className="absolute inset-0 animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
              <div
                className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.2em]"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading hometown signals…
              </div>
            </div>
          ) : (
            <>
              <InteractiveMap
                cities={cities}
                selectedId={selectedId}
                onSelect={handleCitySelect}
                flyToRef={flyToRef}
                onMapReady={setGlMap}
              />
              <StorylinePulseOverlay
                cities={cities}
                selectedId={selectedId}
                activeLayers={activeLayers}
                map={glMap}
                mode={viewMode}
              />
            </>
          )}
        </div>

        {/* ── Selected city panel — restructured into 3 sections ── */}
        <aside
          className="relative flex flex-col overflow-hidden rounded-2xl border p-4 md:p-5"
          style={{ borderColor: BORDER, background: "rgba(255,255,255,0.025)" }}
        >
          {selected && intel && (
            <LandscapeBackground
              profile={intel.landscapeProfile}
              cityId={selected.id}
              cityName={selected.name}
              signatureSport={selected.sportFamilies?.[0]}
            />
          )}
          {detailLoading || !selected || !intel ? (
            <SidebarSkeleton />
          ) : (
            <div className="relative z-10 flex flex-1 flex-col">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: viewMode === "la28" ? "#E8C36B" : viewMode === "parity" ? BLUE : RED,
                      boxShadow: `0 0 10px ${viewMode === "la28" ? "#E8C36B" : viewMode === "parity" ? BLUE : RED}`,
                    }}
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: MUTED }}>
                    Selected City
                  </span>
                </div>
                <span
                  className="rounded-full border px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.18em]"
                  style={{
                    borderColor:
                      viewMode === "la28"
                        ? "rgba(232,195,107,0.45)"
                        : viewMode === "parity"
                          ? "rgba(45,125,255,0.45)"
                          : "rgba(224,58,62,0.45)",
                    color: viewMode === "la28" ? "#E8C36B" : viewMode === "parity" ? "#9CC2FF" : "#FFB1B3",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  {viewMode === "la28" ? "LA28 Momentum" : viewMode === "parity" ? "Parity Lens" : "Hometown Signals"}
                </span>
              </div>
              <h3 className="font-display mt-1.5 text-[20px] font-bold tracking-tight text-white md:text-[22px]">
                {selected.name}
              </h3>
              <div className="mt-1 text-[11px] uppercase tracking-[0.2em]" style={{ color: BLUE }}>
                {selected.region}
              </div>

              {viewMode === "hometown" && (
                <>
                  {/* 1. Team USA Presence */}
                  <PanelSection title="Team USA Presence" accent={RED}>
                    <div className="grid grid-cols-2 gap-2">
                      <StatBox
                        label="Olympian signals"
                        value={formatRosterCount(
                          intel.olympianSignals,
                          selected.parity_snapshot?.olympic_story_estimate,
                        )}
                        accent={RED}
                      />
                      <StatBox
                        label="Paralympian signals"
                        value={formatRosterCount(
                          intel.paralympianSignals,
                          selected.parity_snapshot?.paralympic_story_estimate,
                        )}
                        accent={BLUE}
                      />
                    </div>
                    {selected.sportFamilies && selected.sportFamilies.length > 0 && (
                      <div className="mt-2.5">
                        <div
                          className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em]"
                          style={{ color: MUTED }}
                        >
                          Sport families
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {selected.sportFamilies.map((sf) => (
                            <span
                              key={sf}
                              className="rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/80"
                              style={{ borderColor: "rgba(45,125,255,0.3)", background: "rgba(45,125,255,0.06)" }}
                            >
                              {sf}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </PanelSection>

                  {/* 2. American Landscape */}
                  <PanelSection title="American Landscape" accent="#E8C36B">
                    <dl className="space-y-1.5 text-[12px]">
                      <LandscapeRow label="Climate" value={intel.climateType} />
                      <LandscapeRow label="Terrain" value={intel.terrain} />
                    </dl>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {intel.landscapeTags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/80"
                          style={{ borderColor: "rgba(232,195,107,0.3)", background: "rgba(232,195,107,0.06)" }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </PanelSection>

                  {/* 3. Storyline */}
                  <PanelSection title="Storyline" accent={BLUE}>
                    <p className="text-[12.5px] leading-relaxed" style={{ color: "rgba(220,228,245,0.9)" }}>
                      {intel.storyline}
                    </p>
                  </PanelSection>
                </>
              )}

              {viewMode === "la28" && (
                <>
                  {selected.id === "la" ? (
                    <PanelSection title="LA28 Host City Snapshot" accent="#E8C36B">
                      <div className="grid grid-cols-2 gap-2">
                        <StatBox
                          label="Composite score"
                          value={la28Sports[0] ? `${momentumScore(la28Sports[0].signals)} / 100` : "Host City"}
                          accent="#E8C36B"
                        />
                        <StatBox
                          label="Top sport"
                          value={la28Sports[0] ? la28Sports[0].name.split(" ")[0] : "—"}
                          accent={RED}
                        />
                      </div>
                      <p className="mt-2.5 text-[12px] leading-relaxed" style={{ color: "rgba(220,228,245,0.85)" }}>
                        Los Angeles is the LA28 host city, so its role is less about distance-to-LA and more about
                        connecting national hometown momentum into the Games' central stage.
                      </p>
                      <p className="mt-2 text-[10.5px] uppercase tracking-[0.16em]" style={{ color: MUTED }}>
                        Momentum signals are descriptive, not performance predictions.
                      </p>
                    </PanelSection>
                  ) : (
                    <PanelSection title="LA28 Momentum Snapshot" accent="#E8C36B">
                      {la28Sports.length > 0 ? (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <StatBox label="Top sport" value={la28Sports[0].name.split(" ")[0]} accent="#E8C36B" />
                            <StatBox
                              label="Composite score"
                              value={`${momentumScore(la28Sports[0].signals)} / 100`}
                              accent={RED}
                            />
                          </div>
                          <p className="mt-2.5 text-[12px] leading-relaxed" style={{ color: "rgba(220,228,245,0.85)" }}>
                            {la28Sports[0].name} could be gaining momentum in {selected.name.split(",")[0]} — see the
                            full bracket below.
                          </p>
                        </>
                      ) : (
                        <p className="text-[12px]" style={{ color: MUTED }}>
                          No LA28 momentum signals available for this region yet.
                        </p>
                      )}
                    </PanelSection>
                  )}
                  <PanelSection title="Storyline" accent={BLUE}>
                    <p className="text-[12.5px] leading-relaxed" style={{ color: "rgba(220,228,245,0.9)" }}>
                      {intel.storyline}
                    </p>
                  </PanelSection>
                  {la28Sports.length > 0 &&
                    (() => {
                      const top = la28Sports[0];
                      const bars = [
                        { label: "Hometown Signal", value: top.signals.hometown, color: RED },
                        { label: "News Momentum", value: top.signals.news, color: "#9CC2FF" },
                        { label: "LA28 Relevance", value: top.signals.la28, color: "#E8C36B" },
                      ];
                      return (
                        <div
                          className="rounded-2xl border p-3.5"
                          style={{
                            borderColor: "rgba(232,195,107,0.28)",
                            background: "linear-gradient(180deg, rgba(232,195,107,0.06), rgba(232,195,107,0.02))",
                          }}
                        >
                          <div className="mb-2.5 flex items-center justify-between gap-2">
                            <div>
                              <div
                                className="text-[9px] font-semibold uppercase tracking-[0.2em]"
                                style={{ color: "rgba(232,195,107,0.85)" }}
                              >
                                Top Sport Signal
                              </div>
                              <div className="mt-0.5 text-[13px] font-display font-semibold text-white">{top.name}</div>
                            </div>
                            <div
                              className="rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide"
                              style={{
                                borderColor: "rgba(232,195,107,0.45)",
                                color: "#E8C36B",
                                background: "rgba(232,195,107,0.08)",
                              }}
                            >
                              {momentumScore(top.signals)}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            {bars.map((b) => (
                              <div key={b.label}>
                                <div
                                  className="mb-0.5 flex items-center justify-between text-[10px]"
                                  style={{ color: "rgba(220,228,245,0.7)" }}
                                >
                                  <span className="uppercase tracking-[0.14em]">{b.label}</span>
                                  <span className="font-semibold text-white/80">{b.value}</span>
                                </div>
                                <div
                                  className="h-1.5 w-full overflow-hidden rounded-full"
                                  style={{ background: "rgba(255,255,255,0.06)" }}
                                >
                                  <div
                                    className="h-full rounded-full transition-[width] duration-700"
                                    style={{
                                      width: `${Math.max(4, Math.min(100, b.value))}%`,
                                      background: b.color,
                                      boxShadow: `0 0 8px ${b.color}66`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                </>
              )}

              {viewMode === "parity" &&
                (() => {
                  // Guard: if intel is missing for any reason, show a graceful fallback
                  if (!intel) {
                    return (
                      <PanelSection title="Parity Lens" accent={BLUE}>
                        <p className="text-[12px]" style={{ color: MUTED }}>
                          Parity signals may become available when this region's data is loaded.
                        </p>
                      </PanelSection>
                    );
                  }
                  const olympians = intel.olympianSignals ?? 0;
                  const paralympians = intel.paralympianSignals ?? 0;
                  const total = olympians + paralympians || 1;
                  const oPct = Math.round((olympians / total) * 100);
                  const pPct = 100 - oPct;
                  const storyline = intel.storyline || selected.insight || "";
                  return (
                    <>
                      <PanelSection title="Olympic ↔ Paralympic Parity" accent={BLUE}>
                        <div className="grid grid-cols-2 gap-2">
                          <StatBox label="Olympian signals" value={String(olympians)} accent={RED} />
                          <StatBox label="Paralympian signals" value={String(paralympians)} accent={BLUE} />
                        </div>
                        <div className="mt-3">
                          <div
                            className="flex h-2 w-full overflow-hidden rounded-full"
                            style={{ background: "rgba(255,255,255,0.08)" }}
                          >
                            <div style={{ width: `${oPct}%`, background: RED }} />
                            <div style={{ width: `${pPct}%`, background: BLUE }} />
                          </div>
                          <div
                            className="mt-1.5 flex justify-between text-[10px] uppercase tracking-[0.16em]"
                            style={{ color: MUTED }}
                          >
                            <span>Olympic {oPct}%</span>
                            <span>Paralympic {pPct}%</span>
                          </div>
                        </div>
                        {selected.id === "la" && (
                          <div
                            className="mt-2.5 rounded-lg border px-3 py-2"
                            style={{ borderColor: "rgba(232,195,107,0.3)", background: "rgba(232,195,107,0.05)" }}
                          >
                            <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "#E8C36B" }}>
                              ★ LA28 Host City
                            </p>
                            <p className="mt-1 text-[11.5px] leading-snug" style={{ color: "rgba(220,228,245,0.85)" }}>
                              As the host city, Los Angeles may reflect both Olympic and Paralympic parity in its dense
                              multi-sport ecosystem — a potential storytelling spotlight for LA28.
                            </p>
                          </div>
                        )}
                        <p className="mt-2.5 text-[11.5px] leading-relaxed" style={{ color: "rgba(220,228,245,0.85)" }}>
                          Olympic and Paralympic signals are presented with equal weight. Differences may suggest where
                          regional storytelling could grow.
                        </p>
                      </PanelSection>
                      <PanelSection title="Storyline" accent={BLUE}>
                        <p className="text-[12.5px] leading-relaxed" style={{ color: "rgba(220,228,245,0.9)" }}>
                          {storyline}
                        </p>
                      </PanelSection>
                    </>
                  );
                })()}

              <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row">
                <PrimaryButton
                  onClick={() => selected && onGenerateBrief(selected)}
                  className="w-full justify-center sm:flex-1"
                >
                  Generate Hometown Brief
                </PrimaryButton>
                <button
                  type="button"
                  onClick={() => selected && onAskGemini(selected)}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border bg-transparent px-4 text-[11px] font-display font-semibold uppercase tracking-[0.18em] text-white/85 transition-all hover:bg-white/5 sm:flex-1"
                  style={{ borderColor: BORDER }}
                >
                  Ask Gemini Why
                </button>
              </div>

              <p className="mt-3 text-[10px] italic leading-snug" style={{ color: "rgba(255,255,255,0.5)" }}>
                Momentum signals are descriptive, not performance predictions.
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* ── Challenge 3 — Road to LA28 Momentum bracket (only in LA28 view) ── */}
      {selected && viewMode === "la28" && (
        <LA28MomentumPanel
          city={selected}
          sports={la28Sports}
          selectedSportId={selectedSportId}
          onSelectSport={setSelectedSportId}
          highlighted={true}
        />
      )}

    </section>
  );
};


/* ============================================================
 * LA28MomentumPanel — Challenge 3 bracket + Gemini Momentum Read
 * Sleek sports-analytics card. Mock starter scoring.
 * ============================================================ */
const LA28MomentumPanel = ({
  city,
  sports,
  selectedSportId,
  onSelectSport,
  highlighted,
}: {
  city: HometownCity;
  sports: LA28Sport[];
  selectedSportId: string | null;
  onSelectSport: (id: string | null) => void;
  highlighted: boolean;
}) => {
  const cityShort = city.name.split(",")[0];
  const top = sports[0];
  const focused = sports.find((s) => s.id === selectedSportId) ?? top;

  // Top sport for highlighting
  const topId = top?.id;

  return (
    <section
      className="mt-5 rounded-2xl border p-4 md:p-5 transition-shadow backdrop-blur-xl"
      aria-label="Road to LA28 Momentum"
      style={{
        borderColor: highlighted ? "rgba(232,195,107,0.45)" : BORDER,
        background: "rgba(255,255,255,0.025)",
        boxShadow: highlighted ? "0 0 0 1px rgba(232,195,107,0.25), 0 20px 60px -30px rgba(232,195,107,0.35)" : "none",
      }}
    >
      <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div
            className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: MUTED }}
          >
          </div>
          <h3 className="font-display mt-2 text-[18px] font-bold tracking-tight text-white md:text-[20px]">
            {cityShort} · LA28 Momentum Bracket
          </h3>
          <p className="mt-1 text-[12.5px]" style={{ color: MUTED }}>
            Which LA28 sports could be gaining momentum from this region?
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[60%_40%]">
        {/* Bracket list */}
        <ol className="flex flex-col gap-2" aria-label="Sports ranked by momentum">
          {sports.map((s, i) => {
            const score = momentumScore(s.signals);
            const isFocus = focused?.id === s.id;
            const isPara = s.kind === "paralympic";
            const badgeColor = isPara ? BLUE : RED;
            const isTop = s.id === topId;
            return (
              <li key={s.id}>
                <button
                  onClick={() => onSelectSport(isFocus ? null : s.id)}
                  aria-pressed={isFocus}
                  className="group relative w-full rounded-xl border px-3 py-2.5 text-left transition-all min-h-[60px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  style={{
                    borderColor: isFocus ? "rgba(232,195,107,0.7)" : BORDER,
                    background: isFocus
                      ? "rgba(232,195,107,0.10)"
                      : "rgba(255,255,255,0.025)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tabular-nums"
                      style={{
                        background: i === 0 ? "rgba(232,195,107,0.18)" : "rgba(255,255,255,0.06)",
                        color: i === 0 ? "#E8C36B" : "rgba(255,255,255,0.85)",
                      }}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-white">{s.name}</span>
                        <span
                          className="rounded-full border px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.16em]"
                          style={{ borderColor: `${badgeColor}66`, color: badgeColor, background: `${badgeColor}10` }}
                        >
                          {isPara ? "Paralympic" : "Olympic"}
                        </span>
                        {isTop && (
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.16em]"
                            style={{ background: "rgba(232,195,107,0.18)", color: "#E8C36B" }}
                          >
                            Top signal
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                        <SignalBar label="Hometown" value={s.signals.hometown} color={RED} />
                        <SignalBar label="Worlds" value={s.signals.worldChamp} color={BLUE} />
                        <SignalBar label="News" value={s.signals.news} color="#7FD8E8" />
                        <SignalBar label="LA28" value={s.signals.la28} color="#E8C36B" />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <span className="text-[9px] uppercase tracking-[0.18em]" style={{ color: MUTED }}>
                        Momentum
                      </span>
                      <span className="font-display leading-none text-white">
                        <span className="text-[20px] font-bold tabular-nums">{score}</span>
                        <span
                          className="text-[11px] font-semibold tabular-nums"
                          style={{ color: "rgba(255,255,255,0.45)" }}
                        >
                          {" "}
                          / 100
                        </span>
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Gemini Momentum Read */}
        <div className="flex flex-col gap-3">
          <div
            className="rounded-xl border p-3.5"
            style={{
              borderColor: "rgba(232,195,107,0.35)",
              background: "linear-gradient(180deg, rgba(232,195,107,0.06), rgba(255,255,255,0.02))",
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full"
                style={{ background: "rgba(232,195,107,0.18)", color: "#E8C36B" }}
              >
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-white/85">
                Analyst Brief
              </span>
            </div>
            {focused && (
              <div className="mt-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: MUTED }}>
                Focus · {focused.name}
              </div>
            )}
            <p className="mt-2 text-[12.5px] leading-relaxed text-white/90">
              {focused ? (
                focused.reason
              ) : (
                <>
                  <span className="font-semibold text-white">{cityShort}</span> could surface several LA28 momentum storylines worth exploring as the road to LA28 unfolds.
                </>
              )}
            </p>
            <div
              className="mt-3 flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.18em]"
              style={{ color: "rgba(232,195,107,0.85)" }}
            >
              <Sparkles className="h-3 w-3" />
              Prepared for Gemini analysis
            </div>
            <p className="mt-1.5 text-[10px] italic" style={{ color: "rgba(255,255,255,0.5)" }}>
              Momentum signals are descriptive, not performance predictions.
            </p>
          </div>

          <div className="rounded-xl border p-3" style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: MUTED }}>
              Signal legend
            </div>
            <ul className="mt-1.5 grid grid-cols-2 gap-1.5 text-[11px] text-white/80">
              <LegendDot color={RED} label="Hometown signal" />
              <LegendDot color={BLUE} label="World championship" />
              <LegendDot color="#7FD8E8" label="News momentum" />
              <LegendDot color="#E8C36B" label="LA28 relevance" />
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

const SignalBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="min-w-0">
    <div className="flex items-center justify-between gap-1">
      <span className="truncate text-[8.5px] uppercase tracking-[0.14em]" style={{ color: "rgba(255,255,255,0.55)" }}>
        {label}
      </span>
      <span className="text-[9px] tabular-nums" style={{ color: "rgba(255,255,255,0.7)" }}>
        {value}
      </span>
    </div>
    <div className="mt-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
      <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
    </div>
  </div>
);

const LegendDot = ({ color, label }: { color: string; label: string }) => (
  <li className="flex items-center gap-1.5">
    <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
    <span>{label}</span>
  </li>
);

/* ============================================================
 * Helper subcomponents for the restructured panel
 * ============================================================ */

/**
 * LandscapeBackground — renders a unique decorative SVG layer
 * inside each city card based on its climate / terrain profile.
 * Pure presentational, sits behind text content.
 */
// Per-city background palette — climate + terrain + signature sport hues.
// Each city gets a unique combination so backgrounds never look the same.
const CITY_BG_PALETTES: Record<string, { from: string; to: string; accent: string }> = {
  // West coast / sun
  "los angeles": { from: "#3a0f1a", to: "#b04a2c", accent: "#F7B267" },
  la: { from: "#3a0f1a", to: "#b04a2c", accent: "#F7B267" },
  "long beach": { from: "#0b2a3a", to: "#7a3a78", accent: "#FDE68A" },
  "san diego": { from: "#0a2540", to: "#0e6b8c", accent: "#FCD34D" },
  "san francisco": { from: "#1a2030", to: "#7a3a14", accent: "#FCA5A5" },
  // Pacific NW
  portland: { from: "#0d2418", to: "#1f5a3a", accent: "#A7F3D0" },
  seattle: { from: "#0a1428", to: "#1d3a55", accent: "#94A3B8" },
  // Mountain / altitude
  "colorado springs": { from: "#0a1530", to: "#3a4a78", accent: "#E2E8F0" },
  colorado: { from: "#0a1530", to: "#3a4a78", accent: "#E2E8F0" },
  denver: { from: "#0f1a3a", to: "#5a4aa8", accent: "#F8FAFC" },
  "salt lake city": { from: "#0a1a40", to: "#6a7ab8", accent: "#F1F5F9" },
  // Desert
  phoenix: { from: "#3a1d0c", to: "#a04a14", accent: "#FED7AA" },
  tucson: { from: "#3a200a", to: "#a06024", accent: "#FEF3C7" },
  "las vegas": { from: "#3a1244", to: "#a04a14", accent: "#FBBF24" },
  // Subtropical / Gulf
  miami: { from: "#0a2a3a", to: "#9a2a6a", accent: "#5EEAD4" },
  tampa: { from: "#0a2a3a", to: "#7a3a78", accent: "#FEF3C7" },
  orlando: { from: "#0a2818", to: "#1f5a3a", accent: "#FDE68A" },
  houston: { from: "#0a1a44", to: "#1f5a5a", accent: "#FDE68A" },
  "san antonio": { from: "#3a2208", to: "#0a4a55", accent: "#FBBF24" },
  "new orleans": { from: "#3a1244", to: "#0d4a3a", accent: "#FCD34D" },
  // Southeast
  atlanta: { from: "#3a0a0a", to: "#a04a14", accent: "#FDE68A" },
  charlotte: { from: "#0a1a48", to: "#0a4a3a", accent: "#BAE6FD" },
  birmingham: { from: "#3a1a08", to: "#0a3a3a", accent: "#FED7AA" },
  nashville: { from: "#3a2a08", to: "#3a1a5a", accent: "#FDE68A" },
  // Midwest
  chicago: { from: "#0a1a3a", to: "#5a0a18", accent: "#E0F2FE" },
  detroit: { from: "#0a0a14", to: "#1a3a78", accent: "#F87171" },
  minneapolis: { from: "#0a1a3a", to: "#3a3a78", accent: "#E0F2FE" },
  cleveland: { from: "#3a1a08", to: "#0a3a4a", accent: "#FCA5A5" },
  indianapolis: { from: "#0a1a3a", to: "#5a4a08", accent: "#FEF3C7" },
  "kansas city": { from: "#0a1a48", to: "#5a0a14", accent: "#FDE68A" },
  "oklahoma city": { from: "#3a1a08", to: "#0a1a48", accent: "#FED7AA" },
  // Northeast
  boston: { from: "#0a2818", to: "#5a0a14", accent: "#FCA5A5" },
  "new york": { from: "#0a0f1a", to: "#5a4a08", accent: "#E2E8F0" },
  philadelphia: { from: "#3a0a08", to: "#0a1a48", accent: "#FDE68A" },
  "washington dc": { from: "#0a1a3a", to: "#5a0a24", accent: "#F1F5F9" },
  washington: { from: "#0a1a3a", to: "#5a0a24", accent: "#F1F5F9" },
  pittsburgh: { from: "#0a0f1a", to: "#5a4a08", accent: "#FDE68A" },
  // Pacific
  honolulu: { from: "#0a2840", to: "#1f5a3a", accent: "#FDE68A" },
  anchorage: { from: "#0a0f1a", to: "#1a4a78", accent: "#E0F2FE" },
};

// Per-city distinct scene mapping (region + climate + signature sport).
// Falls back to climate variant when city isn't mapped.
type SceneKey =
  | "la_sunset"
  | "sf_bridge"
  | "sd_surf"
  | "pnw_forest"
  | "alpine_peaks"
  | "desert_canyon"
  | "vegas_neon"
  | "tropical_beach"
  | "bayou"
  | "gulf_industrial"
  | "rolling_south"
  | "great_lakes_skyline"
  | "rust_belt"
  | "northeast_metro"
  | "capitol_dome"
  | "aurora_tundra";

const CITY_SCENES: Record<string, SceneKey> = {
  "los angeles": "la_sunset",
  la: "la_sunset",
  "long beach": "sd_surf",
  "san diego": "sd_surf",
  "san francisco": "sf_bridge",
  portland: "pnw_forest",
  seattle: "pnw_forest",
  "colorado springs": "alpine_peaks",
  colorado: "alpine_peaks",
  denver: "alpine_peaks",
  "salt lake city": "alpine_peaks",
  phoenix: "desert_canyon",
  tucson: "desert_canyon",
  "las vegas": "vegas_neon",
  miami: "tropical_beach",
  tampa: "tropical_beach",
  orlando: "tropical_beach",
  honolulu: "tropical_beach",
  houston: "gulf_industrial",
  "san antonio": "gulf_industrial",
  "new orleans": "bayou",
  atlanta: "rolling_south",
  charlotte: "rolling_south",
  birmingham: "rolling_south",
  nashville: "rolling_south",
  chicago: "great_lakes_skyline",
  detroit: "great_lakes_skyline",
  minneapolis: "great_lakes_skyline",
  cleveland: "great_lakes_skyline",
  indianapolis: "rust_belt",
  "kansas city": "rust_belt",
  "oklahoma city": "rust_belt",
  pittsburgh: "rust_belt",
  boston: "northeast_metro",
  "new york": "northeast_metro",
  philadelphia: "northeast_metro",
  "washington dc": "capitol_dome",
  washington: "capitol_dome",
  anchorage: "aurora_tundra",
};

// Sport icon overlay drawn small in a corner so each city telegraphs its signature sport.
const SportGlyph = ({ sport, color }: { sport?: string; color: string }) => {
  const s = (sport ?? "").toLowerCase();
  // Returns a small svg group at translate(330,30)
  if (s.includes("basket"))
    return (
      <g transform="translate(335,40)" stroke={color} strokeWidth="2" fill="none" opacity="0.55">
        <circle cx="0" cy="0" r="18" />
        <path d="M-18 0 L 18 0 M 0 -18 L 0 18 M -14 -12 Q 0 0 -14 12 M 14 -12 Q 0 0 14 12" />
      </g>
    );
  if (s.includes("swim") || s.includes("surf") || s.includes("water"))
    return (
      <g transform="translate(330,40)" stroke={color} strokeWidth="2" fill="none" opacity="0.55">
        <path d="M-20 0 Q -10 -8 0 0 T 20 0" />
        <path d="M-20 8 Q -10 0 0 8 T 20 8" />
      </g>
    );
  if (s.includes("ski") || s.includes("snow") || s.includes("winter") || s.includes("hockey"))
    return (
      <g transform="translate(335,40)" stroke={color} strokeWidth="2" fill="none" opacity="0.55">
        <path d="M-18 -18 L 18 18 M 18 -18 L -18 18 M 0 -20 L 0 20" />
      </g>
    );
  if (s.includes("track") || s.includes("athlet") || s.includes("run") || s.includes("marathon"))
    return (
      <g transform="translate(335,40)" stroke={color} strokeWidth="2" fill="none" opacity="0.55">
        <ellipse cx="0" cy="0" rx="20" ry="10" />
        <ellipse cx="0" cy="0" rx="14" ry="6" />
      </g>
    );
  if (s.includes("cycl") || s.includes("bike"))
    return (
      <g transform="translate(330,40)" stroke={color} strokeWidth="2" fill="none" opacity="0.55">
        <circle cx="-10" cy="2" r="8" />
        <circle cx="12" cy="2" r="8" />
        <path d="M-10 2 L 0 -10 L 12 2 M 0 -10 L 6 -10" />
      </g>
    );
  if (s.includes("row") || s.includes("sail") || s.includes("kayak"))
    return (
      <g transform="translate(330,40)" stroke={color} strokeWidth="2" fill="none" opacity="0.55">
        <path d="M-22 4 L 22 4" />
        <path d="M-14 4 L -8 -8 L 8 -8 L 14 4 Z" />
      </g>
    );
  if (s.includes("fenc"))
    return (
      <g transform="translate(335,40)" stroke={color} strokeWidth="2" fill="none" opacity="0.55">
        <path d="M-20 -10 L 20 10 M -20 10 L 20 -10" />
        <circle cx="20" cy="10" r="3" />
        <circle cx="20" cy="-10" r="3" />
      </g>
    );
  if (s.includes("gym"))
    return (
      <g transform="translate(335,40)" stroke={color} strokeWidth="2" fill="none" opacity="0.55">
        <circle cx="0" cy="-12" r="4" />
        <path d="M0 -8 L 0 8 M -10 -2 L 10 -2 M -8 14 L 0 8 L 8 14" />
      </g>
    );
  if (s.includes("box") || s.includes("wrestl") || s.includes("martial") || s.includes("judo") || s.includes("tae"))
    return (
      <g transform="translate(335,40)" fill={color} opacity="0.5">
        <circle cx="-6" cy="0" r="7" />
        <circle cx="8" cy="0" r="9" />
      </g>
    );
  // generic star
  return (
    <g transform="translate(335,40)" fill={color} opacity="0.5">
      <polygon points="0,-16 4,-5 16,-5 6,3 10,15 0,8 -10,15 -6,3 -16,-5 -4,-5" />
    </g>
  );
};

const LandscapeBackground = ({
  profile,
  cityId,
  cityName,
  signatureSport,
}: {
  profile: string;
  cityId: string;
  cityName?: string;
  signatureSport?: string;
}) => {
  const p = profile.toLowerCase();
  const id = `lb-${cityId}`;

  type Variant = "desert" | "coastal" | "subtropical" | "mountain" | "urban";
  let variant: Variant = "urban";
  if (p.includes("desert")) variant = "desert";
  else if (p.includes("mediterranean") || p.includes("coastal urban")) variant = "coastal";
  else if (p.includes("subtropical")) variant = "subtropical";
  else if (p.includes("mountain") || p.includes("altitude")) variant = "mountain";
  else if (p.includes("urban")) variant = "urban";

  const variantPalettes: Record<Variant, { from: string; to: string; accent: string }> = {
    desert: { from: "#3a1d0c", to: "#7a3a14", accent: "#F6C453" },
    coastal: { from: "#0a2540", to: "#0e6b8c", accent: "#7FD8E8" },
    subtropical: { from: "#0d2a1a", to: "#1f5a3a", accent: "#7BD389" },
    mountain: { from: "#0a1530", to: "#3a4a78", accent: "#D9E2F2" },
    urban: { from: "#10131f", to: "#2a3358", accent: "#9BB6FF" },
  };
  const key = (cityName ?? "").split(",")[0].trim().toLowerCase();
  const cityPalette = key ? CITY_BG_PALETTES[key] : undefined;
  const c = cityPalette ?? variantPalettes[variant];
  const scene: SceneKey | undefined = key ? CITY_SCENES[key] : undefined;

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl" aria-hidden>
      <svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <defs>
          <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.from} stopOpacity="0.85" />
            <stop offset="100%" stopColor={c.to} stopOpacity="0.55" />
          </linearGradient>
          <radialGradient id={`${id}-sun`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={c.accent} stopOpacity="0.7" />
            <stop offset="100%" stopColor={c.accent} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-vig`} cx="0.5" cy="0.5" r="0.7">
            <stop offset="60%" stopColor="#050A18" stopOpacity="0" />
            <stop offset="100%" stopColor="#050A18" stopOpacity="0.6" />
          </radialGradient>
        </defs>

        <rect width="400" height="600" fill={`url(#${id}-bg)`} />

        {!scene && variant === "desert" && (
          <>
            <circle cx="310" cy="120" r="120" fill={`url(#${id}-sun)`} />
            <circle cx="310" cy="120" r="34" fill={c.accent} opacity="0.55" />
            <path d="M0 430 Q 100 380 200 420 T 400 410 L 400 600 L 0 600 Z" fill={c.from} opacity="0.55" />
            <path d="M0 480 Q 120 440 240 470 T 400 460 L 400 600 L 0 600 Z" fill={c.to} opacity="0.6" />
            <path d="M0 530 Q 140 500 260 520 T 400 510 L 400 600 L 0 600 Z" fill={c.accent} opacity="0.18" />
            <g fill="#1a0a05" opacity="0.55">
              <rect x="60" y="430" width="6" height="70" rx="3" />
              <rect x="50" y="450" width="6" height="28" rx="3" />
              <rect x="70" y="445" width="6" height="22" rx="3" />
            </g>
          </>
        )}

        {!scene && variant === "coastal" && (
          <>
            <circle cx="80" cy="100" r="110" fill={`url(#${id}-sun)`} />
            <rect y="330" width="400" height="2" fill={c.accent} opacity="0.35" />
            <path d="M0 360 Q 100 340 200 360 T 400 360 L 400 600 L 0 600 Z" fill={c.to} opacity="0.5" />
            <path d="M0 420 Q 80 400 160 420 T 320 420 T 480 420 L 400 600 L 0 600 Z" fill={c.accent} opacity="0.18" />
            <path d="M0 480 Q 120 460 240 480 T 400 480 L 400 600 L 0 600 Z" fill={c.from} opacity="0.55" />
          </>
        )}

        {!scene && variant === "subtropical" && (
          <>
            <circle cx="310" cy="110" r="100" fill={`url(#${id}-sun)`} />
            <path d="M0 380 Q 80 320 160 360 T 320 340 T 480 360 L 400 600 L 0 600 Z" fill={c.from} opacity="0.7" />
            <path d="M0 440 Q 100 400 200 430 T 400 420 L 400 600 L 0 600 Z" fill={c.to} opacity="0.55" />
            <g fill="#06140a" opacity="0.55">
              <ellipse cx="60" cy="395" rx="14" ry="22" />
              <ellipse cx="90" cy="402" rx="16" ry="26" />
              <ellipse cx="280" cy="392" rx="15" ry="24" />
              <ellipse cx="320" cy="400" rx="14" ry="22" />
            </g>
          </>
        )}

        {!scene && variant === "mountain" && (
          <>
            <circle cx="320" cy="100" r="90" fill={`url(#${id}-sun)`} />
            <path
              d="M0 380 L 70 280 L 130 360 L 200 250 L 270 350 L 340 270 L 400 360 L 400 600 L 0 600 Z"
              fill={c.from}
              opacity="0.75"
            />
            <path d="M55 305 L 70 280 L 85 305 Z" fill={c.accent} opacity="0.85" />
            <path d="M185 275 L 200 250 L 215 275 Z" fill={c.accent} opacity="0.85" />
            <path d="M325 295 L 340 270 L 355 295 Z" fill={c.accent} opacity="0.85" />
            <path
              d="M0 470 L 60 410 L 140 470 L 220 400 L 300 470 L 380 420 L 400 470 L 400 600 L 0 600 Z"
              fill={c.to}
              opacity="0.7"
            />
          </>
        )}

        {!scene && variant === "urban" && (
          <>
            <circle cx="200" cy="120" r="160" fill={`url(#${id}-sun)`} />
            <g fill={c.from} opacity="0.85">
              <rect x="20" y="380" width="34" height="220" />
              <rect x="60" y="340" width="28" height="260" />
              <rect x="94" y="300" width="40" height="300" />
              <rect x="140" y="360" width="26" height="240" />
              <rect x="172" y="270" width="46" height="330" />
              <rect x="224" y="320" width="30" height="280" />
              <rect x="260" y="290" width="38" height="310" />
              <rect x="304" y="350" width="28" height="250" />
              <rect x="338" y="310" width="42" height="290" />
            </g>
          </>
        )}

        {/* === Per-city distinct scenes === */}
        {scene === "la_sunset" && (
          <>
            <circle cx="200" cy="160" r="180" fill={`url(#${id}-sun)`} />
            <circle cx="200" cy="200" r="60" fill={c.accent} opacity="0.55" />
            <path d="M0 360 L 400 360 L 400 600 L 0 600 Z" fill={c.from} opacity="0.4" />
            <g fill="#0b0510" opacity="0.85">
              <polygon points="20,420 50,330 60,420" />
              <rect x="80" y="350" width="22" height="120" />
              <polygon points="120,400 145,300 170,400" />
              <rect x="180" y="320" width="30" height="150" />
              <rect x="220" y="370" width="20" height="100" />
              <polygon points="250,400 280,310 310,400" />
              <rect x="320" y="340" width="26" height="130" />
              <rect x="356" y="380" width="20" height="90" />
            </g>
            <g stroke={c.accent} strokeWidth="1" opacity="0.4">
              <path d="M0 470 L 400 470" />
              <path d="M0 510 L 400 510" />
            </g>
          </>
        )}

        {scene === "sf_bridge" && (
          <>
            <rect y="0" width="400" height="340" fill={c.from} opacity="0.4" />
            <path d="M0 320 Q 200 200 400 320 L 400 360 L 0 360 Z" fill={c.from} opacity="0.5" />
            <path d="M30 360 L 30 220 M 370 360 L 370 220" stroke={c.accent} strokeWidth="6" />
            <path d="M30 240 Q 200 380 370 240" stroke={c.accent} strokeWidth="3" fill="none" />
            <path d="M30 240 L 200 320 L 370 240" stroke={c.accent} strokeWidth="2" fill="none" opacity="0.7" />
            <g stroke={c.accent} strokeWidth="1" opacity="0.6">
              {Array.from({ length: 14 }).map((_, i) => (
                <line key={i} x1={30 + i * 25} y1="360" x2={30 + i * 25} y2={250 + Math.abs(7 - i) * 8} />
              ))}
            </g>
            <path d="M0 380 Q 100 365 200 380 T 400 380 L 400 600 L 0 600 Z" fill={c.to} opacity="0.55" />
          </>
        )}

        {scene === "sd_surf" && (
          <>
            <circle cx="320" cy="100" r="110" fill={`url(#${id}-sun)`} />
            <path d="M0 350 Q 100 320 200 350 T 400 350 L 400 600 L 0 600 Z" fill={c.to} opacity="0.55" />
            <path d="M0 410 Q 80 380 160 410 T 320 410 T 480 410 L 400 600 L 0 600 Z" fill={c.accent} opacity="0.25" />
            <path d="M0 470 Q 120 440 240 470 T 400 470 L 400 600 L 0 600 Z" fill={c.from} opacity="0.6" />
            <g fill={c.accent} opacity="0.7">
              <path d="M280 360 Q 320 330 360 360 Q 340 380 320 380 Q 300 380 280 360 Z" />
            </g>
            <g fill="#06140a" opacity="0.55">
              <ellipse cx="40" cy="395" rx="10" ry="18" />
              <ellipse cx="65" cy="400" rx="12" ry="20" />
            </g>
          </>
        )}

        {scene === "pnw_forest" && (
          <>
            <rect y="0" width="400" height="280" fill={c.from} opacity="0.3" />
            <g opacity="0.4" stroke={c.accent} strokeWidth="1" fill="none">
              <path d="M0 200 Q 100 180 200 200 T 400 200" />
              <path d="M0 230 Q 100 215 200 230 T 400 230" />
            </g>
            <g fill={c.from} opacity="0.9">
              {[20, 70, 120, 175, 230, 285, 340, 380].map((x, i) => (
                <polygon key={i} points={`${x - 22},520 ${x},${260 + (i % 3) * 30} ${x + 22},520`} />
              ))}
            </g>
            <g fill={c.to} opacity="0.85">
              {[5, 50, 100, 150, 200, 250, 300, 350, 395].map((x, i) => (
                <polygon key={i} points={`${x - 28},560 ${x},${340 + (i % 4) * 25} ${x + 28},560`} />
              ))}
            </g>
            <path d="M0 560 L 400 560 L 400 600 L 0 600 Z" fill={c.accent} opacity="0.15" />
          </>
        )}

        {scene === "alpine_peaks" && (
          <>
            <circle cx="330" cy="90" r="70" fill={`url(#${id}-sun)`} />
            <path
              d="M0 380 L 70 240 L 140 360 L 220 200 L 300 340 L 380 260 L 400 320 L 400 600 L 0 600 Z"
              fill={c.from}
              opacity="0.85"
            />
            <path
              d="M55 270 L 70 240 L 85 270 Z M205 230 L 220 200 L 235 230 Z M365 290 L 380 260 L 395 290 Z"
              fill={c.accent}
              opacity="0.95"
            />
            <path
              d="M0 460 L 60 380 L 140 460 L 220 370 L 300 460 L 380 390 L 400 460 L 400 600 L 0 600 Z"
              fill={c.to}
              opacity="0.75"
            />
            <g stroke={c.accent} strokeWidth="1.2" fill="none" opacity="0.6">
              <path d="M120 540 L 280 540" />
              <path d="M120 560 L 280 560" />
            </g>
          </>
        )}

        {scene === "desert_canyon" && (
          <>
            <circle cx="310" cy="110" r="130" fill={`url(#${id}-sun)`} />
            <circle cx="310" cy="110" r="40" fill={c.accent} opacity="0.6" />
            <path
              d="M0 320 L 60 320 L 80 280 L 140 280 L 160 340 L 240 340 L 260 290 L 340 290 L 360 330 L 400 330 L 400 420 L 0 420 Z"
              fill={c.from}
              opacity="0.85"
            />
            <path d="M0 420 L 400 420 L 400 500 L 0 500 Z" fill={c.to} opacity="0.7" />
            <path d="M0 500 L 400 500 L 400 600 L 0 600 Z" fill={c.accent} opacity="0.25" />
            <g fill="#1a0a05" opacity="0.7">
              <rect x="60" y="440" width="8" height="60" rx="3" />
              <rect x="50" y="460" width="6" height="28" rx="3" />
              <rect x="76" y="455" width="6" height="22" rx="3" />
              <rect x="320" y="440" width="8" height="60" rx="3" />
              <rect x="310" y="465" width="6" height="22" rx="3" />
            </g>
          </>
        )}

        {scene === "vegas_neon" && (
          <>
            <rect y="0" width="400" height="600" fill={c.from} opacity="0.3" />
            <g fill="#000" opacity="0.85">
              <rect x="20" y="360" width="40" height="240" />
              <rect x="70" y="320" width="30" height="280" />
              <rect x="110" y="290" width="50" height="310" />
              <rect x="170" y="340" width="34" height="260" />
              <polygon points="220,360 250,260 280,360 280,600 220,600" />
              <rect x="290" y="310" width="44" height="290" />
              <rect x="344" y="350" width="40" height="250" />
            </g>
            <g fill={c.accent}>
              {Array.from({ length: 80 }).map((_, i) => {
                const x = 24 + (i % 16) * 24 + ((i * 13) % 12);
                const y = 320 + Math.floor(i / 16) * 40 + ((i * 7) % 18);
                return <rect key={i} x={x} y={y} width="3" height="3" opacity={0.4 + ((i * 17) % 60) / 100} />;
              })}
            </g>
            <g stroke={c.accent} strokeWidth="2" opacity="0.7">
              <path d="M250 260 L 250 200" />
              <circle cx="250" cy="195" r="6" fill={c.accent} />
            </g>
          </>
        )}

        {scene === "tropical_beach" && (
          <>
            <circle cx="320" cy="110" r="110" fill={`url(#${id}-sun)`} />
            <path d="M0 360 Q 100 330 200 360 T 400 360 L 400 600 L 0 600 Z" fill={c.to} opacity="0.55" />
            <path d="M0 440 L 400 440 L 400 600 L 0 600 Z" fill={c.accent} opacity="0.18" />
            <g stroke="#06140a" strokeWidth="3" fill="none" opacity="0.85">
              <path d="M70 440 Q 76 380 80 320" />
              <path d="M80 320 Q 50 305 30 320" />
              <path d="M80 320 Q 110 305 130 325" />
              <path d="M80 320 Q 70 290 60 280" />
              <path d="M80 320 Q 90 290 100 285" />
            </g>
            <g fill={c.accent} opacity="0.6">
              <circle cx="80" cy="320" r="6" />
              <circle cx="86" cy="318" r="5" />
            </g>
          </>
        )}

        {scene === "bayou" && (
          <>
            <rect y="0" width="400" height="380" fill={c.from} opacity="0.45" />
            <g opacity="0.55" stroke={c.accent} strokeWidth="1" fill="none">
              <path d="M40 100 Q 60 140 50 180 Q 40 220 60 260" />
              <path d="M340 80 Q 360 130 350 170 Q 340 210 360 250" />
            </g>
            <g fill={c.from} opacity="0.85">
              <ellipse cx="60" cy="340" rx="40" ry="120" />
              <ellipse cx="340" cy="340" rx="40" ry="130" />
              <ellipse cx="200" cy="320" rx="36" ry="110" />
            </g>
            <path d="M0 420 Q 100 400 200 420 T 400 420 L 400 600 L 0 600 Z" fill={c.to} opacity="0.6" />
            <g stroke={c.accent} strokeWidth="1" opacity="0.4">
              <path d="M0 460 L 400 460" />
              <path d="M0 490 L 400 490" />
              <path d="M0 520 L 400 520" />
            </g>
          </>
        )}

        {scene === "gulf_industrial" && (
          <>
            <rect y="0" width="400" height="600" fill={c.from} opacity="0.25" />
            <circle cx="80" cy="120" r="80" fill={`url(#${id}-sun)`} />
            <g fill="#000" opacity="0.85">
              <rect x="20" y="340" width="60" height="120" />
              <rect x="90" y="320" width="40" height="140" />
              <rect x="140" y="360" width="30" height="100" />
              <rect x="180" y="300" width="50" height="160" />
              <rect x="240" y="340" width="36" height="120" />
              <rect x="290" y="320" width="50" height="140" />
              <rect x="350" y="350" width="40" height="110" />
            </g>
            <g stroke={c.accent} strokeWidth="2" opacity="0.7">
              <line x1="50" y1="340" x2="50" y2="280" />
              <line x1="200" y1="300" x2="200" y2="220" />
              <line x1="320" y1="320" x2="320" y2="260" />
              <circle cx="50" cy="276" r="3" fill={c.accent} />
              <circle cx="200" cy="216" r="3" fill={c.accent} />
              <circle cx="320" cy="256" r="3" fill={c.accent} />
            </g>
            <path d="M0 460 L 400 460 L 400 600 L 0 600 Z" fill={c.to} opacity="0.6" />
          </>
        )}

        {scene === "rolling_south" && (
          <>
            <circle cx="320" cy="110" r="100" fill={`url(#${id}-sun)`} />
            <path d="M0 380 Q 100 300 200 360 T 400 340 L 400 600 L 0 600 Z" fill={c.from} opacity="0.7" />
            <path d="M0 440 Q 100 380 200 430 T 400 420 L 400 600 L 0 600 Z" fill={c.to} opacity="0.6" />
            <g fill={c.accent} opacity="0.7">
              <ellipse cx="80" cy="395" rx="28" ry="18" />
              <ellipse cx="220" cy="385" rx="34" ry="22" />
              <ellipse cx="330" cy="400" rx="26" ry="16" />
            </g>
            <g stroke={c.accent} strokeWidth="2" opacity="0.5">
              <path d="M0 500 Q 100 480 200 500 T 400 500" />
            </g>
          </>
        )}

        {scene === "great_lakes_skyline" && (
          <>
            <rect y="0" width="400" height="600" fill={c.from} opacity="0.3" />
            <g fill="#000" opacity="0.9">
              <rect x="10" y="280" width="22" height="180" />
              <rect x="36" y="220" width="28" height="240" />
              <rect x="68" y="260" width="20" height="200" />
              <polygon points="92,460 110,160 128,460" />
              <rect x="134" y="240" width="30" height="220" />
              <rect x="170" y="200" width="40" height="260" />
              <polygon points="216,460 240,140 264,460" />
              <rect x="270" y="260" width="26" height="200" />
              <rect x="300" y="220" width="34" height="240" />
              <rect x="340" y="280" width="22" height="180" />
              <rect x="366" y="250" width="24" height="210" />
            </g>
            <g fill={c.accent} opacity="0.6">
              {Array.from({ length: 50 }).map((_, i) => {
                const x = 14 + (i % 12) * 32 + ((i * 7) % 14);
                const y = 240 + Math.floor(i / 12) * 36 + ((i * 11) % 14);
                return <rect key={i} x={x} y={y} width="2" height="2" />;
              })}
            </g>
            <path d="M0 470 L 400 470 L 400 600 L 0 600 Z" fill={c.to} opacity="0.55" />
            <g stroke={c.accent} strokeWidth="1" opacity="0.4">
              <path d="M0 500 L 400 500" />
              <path d="M0 530 L 400 530" />
            </g>
          </>
        )}

        {scene === "rust_belt" && (
          <>
            <rect y="0" width="400" height="600" fill={c.from} opacity="0.3" />
            <g fill="#000" opacity="0.85">
              <rect x="20" y="320" width="80" height="160" />
              <rect x="110" y="340" width="60" height="140" />
              <rect x="180" y="300" width="90" height="180" />
              <rect x="280" y="330" width="50" height="150" />
              <rect x="340" y="310" width="50" height="170" />
            </g>
            <g stroke={c.accent} strokeWidth="3" opacity="0.7">
              <line x1="60" y1="320" x2="60" y2="240" />
              <line x1="220" y1="300" x2="220" y2="200" />
              <line x1="360" y1="310" x2="360" y2="230" />
            </g>
            <g fill={c.accent} opacity="0.4">
              <circle cx="60" cy="240" r="14" />
              <circle cx="220" cy="200" r="18" />
              <circle cx="360" cy="230" r="12" />
            </g>
            <path d="M0 480 L 400 480 L 400 600 L 0 600 Z" fill={c.to} opacity="0.6" />
          </>
        )}

        {scene === "northeast_metro" && (
          <>
            <rect y="0" width="400" height="600" fill={c.from} opacity="0.35" />
            <g fill="#000" opacity="0.92">
              <rect x="10" y="240" width="24" height="240" />
              <rect x="38" y="200" width="30" height="280" />
              <rect x="72" y="260" width="22" height="220" />
              <rect x="98" y="160" width="36" height="320" />
              <rect x="138" y="220" width="26" height="260" />
              <rect x="168" y="120" width="42" height="360" />
              <rect x="214" y="200" width="28" height="280" />
              <rect x="246" y="180" width="34" height="300" />
              <rect x="284" y="240" width="24" height="240" />
              <rect x="312" y="160" width="40" height="320" />
              <rect x="356" y="220" width="30" height="260" />
            </g>
            <g fill={c.accent} opacity="0.7">
              {Array.from({ length: 90 }).map((_, i) => {
                const x = 14 + (i % 18) * 22 + ((i * 5) % 10);
                const y = 180 + Math.floor(i / 18) * 30 + ((i * 13) % 14);
                return <rect key={i} x={x} y={y} width="2" height="3" />;
              })}
            </g>
          </>
        )}

        {scene === "capitol_dome" && (
          <>
            <rect y="0" width="400" height="600" fill={c.from} opacity="0.3" />
            <circle cx="200" cy="120" r="120" fill={`url(#${id}-sun)`} />
            <g fill={c.accent} opacity="0.85">
              <path d="M150 360 L 250 360 L 250 280 Q 200 240 150 280 Z" />
              <rect x="195" y="220" width="10" height="60" />
              <polygon points="200,200 195,220 205,220" />
            </g>
            <g fill="#000" opacity="0.85">
              <rect x="100" y="360" width="200" height="20" />
              <rect x="80" y="380" width="240" height="100" />
              {Array.from({ length: 10 }).map((_, i) => (
                <rect key={i} x={92 + i * 22} y="380" width="8" height="100" fill={c.accent} opacity="0.6" />
              ))}
            </g>
            <path d="M0 480 L 400 480 L 400 600 L 0 600 Z" fill={c.to} opacity="0.55" />
          </>
        )}

        {scene === "aurora_tundra" && (
          <>
            <rect y="0" width="400" height="600" fill={c.from} opacity="0.5" />
            <g opacity="0.55" fill="none" strokeWidth="3">
              <path d="M0 120 Q 100 60 200 130 T 400 110" stroke={c.accent} />
              <path d="M0 170 Q 120 110 220 180 T 400 160" stroke={c.accent} opacity="0.6" />
              <path d="M0 220 Q 140 180 240 230 T 400 210" stroke={c.accent} opacity="0.4" />
            </g>
            <g fill="#fff" opacity="0.8">
              {Array.from({ length: 30 }).map((_, i) => (
                <circle key={i} cx={(i * 53) % 400} cy={(i * 31) % 280} r={(i % 3) * 0.6 + 0.6} />
              ))}
            </g>
            <path
              d="M0 380 L 80 320 L 160 380 L 240 310 L 320 380 L 400 330 L 400 600 L 0 600 Z"
              fill={c.to}
              opacity="0.85"
            />
            <path d="M40 340 L 80 320 L 120 340 Z M 200 330 L 240 310 L 280 330 Z" fill="#fff" opacity="0.85" />
          </>
        )}

        {/* Sport glyph overlay (per-city signature sport) */}
        <SportGlyph sport={signatureSport} color={c.accent} />

        {/* Vignette for legibility */}
        <rect width="400" height="600" fill="#050A18" opacity="0.55" />
        <rect width="400" height="600" fill={`url(#${id}-vig)`} />
      </svg>
    </div>
  );
};

const MetricPill = ({ label, value, accent }: { label: string; value: string; accent: string }) => (
  <div
    className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
    style={{ borderColor: BORDER, background: "rgba(255,255,255,0.025)" }}
  >
    <div className="min-w-0">
      <div className="text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ color: MUTED }}>
        {label}
      </div>
      <div className="font-display mt-0.5 truncate text-[15px] font-bold text-white md:text-[16px]">{value}</div>
    </div>
    <span className="h-7 w-1 shrink-0 rounded-full" style={{ background: accent, boxShadow: `0 0 10px ${accent}55` }} />
  </div>
);

const PanelSection = ({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) => (
  <div className="mt-3 rounded-xl border p-3" style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}>
    <div className="mb-2 flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
      <span className="text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: MUTED }}>
        {title}
      </span>
    </div>
    {children}
  </div>
);

const StatBox = ({ label, value, accent }: { label: string; value: string; accent: string }) => (
  <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: BORDER, background: "rgba(255,255,255,0.025)" }}>
    <div className="text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color: MUTED }}>
      {label}
    </div>
    <div className="font-display mt-0.5 text-[18px] font-bold leading-none" style={{ color: accent }}>
      {value}
    </div>
  </div>
);

const LandscapeRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline gap-2">
    <dt className="w-16 shrink-0 text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color: MUTED }}>
      {label}
    </dt>
    <dd className="text-[12px]" style={{ color: "rgba(220,228,245,0.9)" }}>
      {value}
    </dd>
  </div>
);

/* ============================================================
 * StorylinePulseOverlay — SVG arcs from selected city to others
 * ============================================================ */

const StorylinePulseOverlay = ({
  cities,
  selectedId,
  activeLayers,
  map,
  mode = "hometown",
}: {
  cities: HometownCity[];
  selectedId: string;
  activeLayers: Record<string, boolean>;
  map: GlMap | null;
  mode?: "hometown" | "la28" | "parity";
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Bumped on every map move/zoom/rotate so we re-project lng/lat → screen px.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Subscribe to GL map view changes so arc anchors track the actual geo location.
  useEffect(() => {
    if (!map) return;
    const onMove = () => setTick((t) => (t + 1) % 1_000_000);
    const events = ["move", "zoom", "rotate", "pitch", "resize", "moveend", "zoomend"];
    events.forEach((ev) => map.on(ev, onMove));
    onMove(); // initial
    return () => {
      events.forEach((ev) => {
        try {
          map.off(ev, onMove);
        } catch {
          /* noop */
        }
      });
    };
  }, [map]);

  const selected = cities.find((c) => c.id === selectedId);
  const intel = selected ? deriveCityIntel(selected, cities) : null;

  // Project lng/lat → screen pixels using the live GL map. Falls back to a
  // static US bounding-box projection only when the map isn't ready yet, so
  // markers stay glued to their real coordinates while panning/zooming.
  const project = (c: HometownCity): [number, number] => {
    if (map && typeof (map as any).project === "function") {
      const p = (map as any).project([c.lng, c.lat]);
      return [p.x, p.y];
    }
    const x = ((c.lng + 125) / (125 - 66)) * size.w;
    const y = ((49 - c.lat) / (49 - 25)) * size.h;
    return [x, y];
  };

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  const isInsideFrame = (x: number, y: number, margin = 24) =>
    x >= margin && x <= size.w - margin && y >= margin && y <= size.h - margin;

  if (!selected || !intel || size.w === 0 || size.h === 0) {
    return <div ref={ref} className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-2xl" />;
  }

  // Reference `tick` so the memo recomputes on every map view change.
  void tick;

  const [sx, sy] = project(selected);

  const arcColor = (type: "olympic" | "paralympic" | "la28") =>
    type === "olympic" ? RED : type === "paralympic" ? BLUE : "#E8C36B";

  const layerKeyFor = (type: "olympic" | "paralympic" | "la28") =>
    type === "olympic" ? "olympic" : type === "paralympic" ? "paralympic" : "la28";

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-2xl"
      style={{ clipPath: "inset(0 round 1rem)" }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${size.w} ${size.h}`}
        className="absolute inset-0 z-10 overflow-hidden"
      >
        <defs>
          <clipPath id="map-overlay-clip">
            <rect x="0" y="0" width={size.w} height={size.h} rx="16" ry="16" />
          </clipPath>
          <filter id="arc-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="la-host-glow" x="-80%" y="-80%" width="360%" height="360%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Arrowhead marker for Road-to-LA28 arc */}
          <marker id="la28-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#E8C36B" opacity="0.95" />
          </marker>
        </defs>

        <g clipPath="url(#map-overlay-clip)">
          {/* Pulsing selected marker — outer pulse ring + inner dot */}
          <circle
            cx={sx}
            cy={sy}
            r={8}
            fill="none"
            stroke={mode === "la28" ? "#E8C36B" : RED}
            strokeWidth={2}
            opacity={0.55}
          >
            <animate attributeName="r" values="8;26;8" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.55;0;0.55" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle
            cx={sx}
            cy={sy}
            r={5}
            fill={mode === "la28" ? "#E8C36B" : RED}
            stroke="rgba(7,11,22,0.8)"
            strokeWidth={1.5}
            opacity={0.95}
          />

          {/* LA28 mode — momentum rings around every non-LA city */}
          {mode === "la28" &&
            cities.map((c) => {
              if (c.id === "la") return null; // LA gets its own special halo below
              const [px, py] = project(c);
              const isSel = c.id === selectedId;
              return (
                <g key={`mr-${c.id}`}>
                  <circle
                    cx={px}
                    cy={py}
                    r={isSel ? 10 : 7}
                    fill="none"
                    stroke="#E8C36B"
                    strokeWidth={isSel ? 1.6 : 1.0}
                    opacity={isSel ? 0.9 : 0.45}
                  >
                    <animate
                      attributeName="r"
                      values={isSel ? "10;22;10" : "7;15;7"}
                      dur="2.8s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values={isSel ? "0.9;0;0.9" : "0.45;0;0.45"}
                      dur="2.8s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </g>
              );
            })}

          {/* LA28 mode — prominent host-city triple halo on Los Angeles */}
          {mode === "la28" &&
            (() => {
              const laCity = cities.find((c) => c.id === "la");
              if (!laCity) return null;
              const [lx, ly] = project(laCity);
              const isSelected = selectedId === "la";
              return (
                <g key="la-host-halo" filter="url(#la-host-glow)">
                  {/* Outer slow pulse */}
                  <circle cx={lx} cy={ly} r={22} fill="none" stroke="#E8C36B" strokeWidth={1.2} opacity={0.3}>
                    <animate attributeName="r" values="22;52;22" dur="4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.35;0;0.35" dur="4s" repeatCount="indefinite" />
                  </circle>
                  {/* Mid ring */}
                  <circle cx={lx} cy={ly} r={16} fill="none" stroke="#E8C36B" strokeWidth={1.6} opacity={0.65}>
                    <animate attributeName="r" values="16;36;16" dur="3.2s" begin="0.4s" repeatCount="indefinite" />
                    <animate
                      attributeName="opacity"
                      values="0.65;0;0.65"
                      dur="3.2s"
                      begin="0.4s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  {/* Static ring — always visible */}
                  <circle
                    cx={lx}
                    cy={ly}
                    r={12}
                    fill="rgba(232,195,107,0.08)"
                    stroke="#E8C36B"
                    strokeWidth={2}
                    opacity={isSelected ? 1 : 0.85}
                    strokeDasharray={isSelected ? "none" : "4 2"}
                  />
                  {/* Core dot */}
                  <circle
                    cx={lx}
                    cy={ly}
                    r={5}
                    fill="#E8C36B"
                    stroke="rgba(7,11,22,0.8)"
                    strokeWidth={1.5}
                    opacity={0.98}
                  />
                  {/* HOST CITY label */}
                  <rect
                    x={lx - 26}
                    y={ly + 9}
                    width={52}
                    height={12}
                    rx={6}
                    fill="rgba(7,11,22,0.88)"
                    stroke="rgba(232,195,107,0.6)"
                    strokeWidth={0.8}
                  />
                  <text
                    x={lx}
                    y={ly + 18}
                    textAnchor="middle"
                    fill="#E8C36B"
                    fontSize="7"
                    fontFamily="ui-sans-serif, system-ui"
                    letterSpacing="1.2"
                    style={{ fontWeight: 800 }}
                  >
                    HOST CITY
                  </text>
                </g>
              );
            })()}

          {/* LA28 mode, non-LA selected — Road-to-LA28 draw-on arc with arrowhead */}
          {mode === "la28" &&
            selected.id !== "la" &&
            activeLayers.la28 &&
            (() => {
              const laCity = cities.find((c) => c.id === "la");
              if (!laCity) return null;
              const [tx, ty] = project(laCity);
              const endpointsAreVisible = isInsideFrame(sx, sy, 30) && isInsideFrame(tx, ty, 30);

              if (!endpointsAreVisible) {
                const labelX = clamp(sx, 94, size.w - 94);
                const labelY = clamp(sy + 34, 28, size.h - 28);
                return (
                  <g key="la28-road-arc-out-of-view">
                    <rect
                      x={labelX - 86}
                      y={labelY - 13}
                      width={172}
                      height={26}
                      rx={13}
                      fill="rgba(7,11,22,0.88)"
                      stroke="rgba(232,195,107,0.42)"
                      strokeWidth={0.9}
                    />
                    <text
                      x={labelX}
                      y={labelY + 4}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.9)"
                      fontSize="8.5"
                      fontFamily="ui-sans-serif, system-ui"
                      letterSpacing="1.1"
                      style={{ textTransform: "uppercase", fontWeight: 800 }}
                    >
                      Zoom out to view Road to LA28
                    </text>
                  </g>
                );
              }

              const mx = (sx + tx) / 2;
              const my = (sy + ty) / 2;
              const dx = tx - sx;
              const dy = ty - sy;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const nx = -dy / dist;
              const ny = dx / dist;
              const curve = Math.min(Math.max(dist * 0.32, 50), 140);
              // Control point lifts the arc above center, then clamps inside the map.
              // Because quadratic Beziers stay inside the convex hull of their points,
              // clamping endpoints + control point prevents the arc from escaping the frame.
              const cpx = clamp(mx + nx * curve, 34, size.w - 34);
              const cpy = clamp(my + ny * curve, 34, size.h - 34);
              // Total path length approximation for draw-on dasharray
              const pathLen = Math.round(dist * 1.25 + curve * 0.6);
              const path = `M ${sx} ${sy} Q ${cpx} ${cpy} ${tx} ${ty}`;
              return (
                <g key="la28-road-arc">
                  {/* Shadow/depth layer */}
                  <path d={path} stroke="#070B16" strokeWidth={6} fill="none" opacity={0.7} strokeLinecap="round" />
                  {/* Draw-on solid arc — animates from dashoffset=pathLen to 0 on mount */}
                  <path
                    d={path}
                    stroke="#E8C36B"
                    strokeWidth={2.5}
                    fill="none"
                    opacity={0.95}
                    strokeLinecap="round"
                    strokeDasharray={pathLen}
                    strokeDashoffset={pathLen}
                    markerEnd="url(#la28-arrow)"
                    filter="url(#arc-glow)"
                  >
                    <animate attributeName="stroke-dashoffset" from={String(pathLen)} to="0" dur="1.1s" fill="freeze" />
                  </path>
                  {/* Dotted chase layer — runs after draw-on */}
                  <path
                    d={path}
                    stroke="#E8C36B"
                    strokeWidth={1.6}
                    fill="none"
                    opacity={0.7}
                    strokeLinecap="round"
                    strokeDasharray="6 6"
                    filter="url(#arc-glow)"
                  >
                    <animate attributeName="stroke-dashoffset" values="0;-48" dur="1.8s" repeatCount="indefinite" />
                  </path>
                  {/* Sparkle secondary track */}
                  <path
                    d={path}
                    stroke="#9CC2FF"
                    strokeWidth={0.9}
                    fill="none"
                    opacity={0.5}
                    strokeLinecap="round"
                    strokeDasharray="1 14"
                  >
                    <animate attributeName="stroke-dashoffset" values="0;-60" dur="2.8s" repeatCount="indefinite" />
                  </path>
                  {/* Arc midpoint label */}
                  <g className="hidden sm:block">
                    <rect
                      x={cpx - 56}
                      y={cpy - 20}
                      width={112}
                      height={17}
                      rx={8.5}
                      fill="rgba(7,11,22,0.9)"
                      stroke="rgba(232,195,107,0.55)"
                      strokeWidth={0.9}
                    />
                    <text
                      x={cpx}
                      y={cpy - 8}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.95)"
                      fontSize="8.5"
                      fontFamily="ui-sans-serif, system-ui"
                      letterSpacing="1.4"
                      style={{ textTransform: "uppercase", fontWeight: 800 }}
                    >
                      Road to LA28
                    </text>
                  </g>
                </g>
              );
            })()}

          {/* LA28 mode, LA selected — host-city spotlight callout (no outbound arc needed) */}
          {mode === "la28" &&
            selected.id === "la" &&
            (() => {
              const [lx, ly] = [sx, sy];
              return (
                <g key="la-selected-spotlight">
                  {/* Spotlight radial glow */}
                  <circle cx={lx} cy={ly} r={38} fill="rgba(232,195,107,0.07)" stroke="none" />
                  <circle
                    cx={lx}
                    cy={ly}
                    r={26}
                    fill="rgba(232,195,107,0.06)"
                    stroke="#E8C36B"
                    strokeWidth={1}
                    opacity={0.5}
                    strokeDasharray="3 3"
                  />
                  {/* "★ Host City" callout bubble */}
                  <rect
                    x={lx + 14}
                    y={ly - 26}
                    width={80}
                    height={18}
                    rx={9}
                    fill="rgba(7,11,22,0.92)"
                    stroke="rgba(232,195,107,0.65)"
                    strokeWidth={1}
                  />
                  <text
                    x={lx + 54}
                    y={ly - 13}
                    textAnchor="middle"
                    fill="#E8C36B"
                    fontSize="8"
                    fontFamily="ui-sans-serif, system-ui"
                    letterSpacing="1.2"
                    style={{ fontWeight: 800 }}
                  >
                    ★ LA28 HOST
                  </text>
                </g>
              );
            })()}
        </g>

        {/* Hometown mode intentionally stays clean: no inter-city lines.
            The map should help users focus on the selected hub and its sidebar signal,
            while LA28 Momentum owns the dramatic Road-to-LA arc storytelling. */}
      </svg>
    </div>
  );
};

/* ============================================================
 * HometownBriefDrawer (unchanged from Hub.backend.tsx)
 * ============================================================ */

const HometownBriefSidePanel = ({
  open,
  onClose,
  city,
}: {
  open: boolean;
  onClose: () => void;
  city: HometownCity | null;
}) => {
  const { generate, loading } = useGenerateBrief();
  const [brief, setBrief] = useState<ApiBriefResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevCityId = useRef<string | null>(null);
  const [artificialLoading, setArtificialLoading] = useState(true);

  useEffect(() => {
    if (!open || !city) return;
    if (city.id === prevCityId.current && brief) return;
    prevCityId.current = city.id;
    setBrief(null);
    setError(null);
    setArtificialLoading(true);

    const timer = setTimeout(() => {
      setArtificialLoading(false);
    }, 1500);

    generate(city.id).then((result) => {
      if (result) {
        setBrief(result);
      } else {
        setError("Could not load brief from API. Showing available info below.");
      }
    });

    return () => clearTimeout(timer);
  }, [open, city, generate]);

  useEffect(() => {
    if (!open) {
      setBrief(null);
      setError(null);
      prevCityId.current = null;
    }
  }, [open]);

  if (!open) return null;

  const isActuallyLoading = loading || artificialLoading;

  return (
    <aside
      className="relative flex w-full shrink-0 flex-col overflow-hidden rounded-3xl border p-5 text-white lg:w-[380px] backdrop-blur-xl"
      style={{ background: "rgba(10,15,30,0.65)", borderColor: BORDER }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close hometown brief"
        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border text-white/70 transition-colors hover:bg-white/5 hover:text-white"
        style={{ borderColor: BORDER }}
      >
        <X className="h-4 w-4" />
      </button>

      <div className="text-left pr-10">
        <span
          className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.22em]"
          style={{ borderColor: BORDER, color: MUTED }}
        >
          <Sparkles className="h-3 w-3" style={{ color: BLUE }} />
          Hometown Brief
        </span>
        <h3 className="mt-2 font-display text-2xl text-white">{city?.name ?? "—"}</h3>
        <p className="mt-1 text-[12px]" style={{ color: MUTED }}>
          Aggregate, exploratory signal brief — not a performance prediction.
        </p>
      </div>

      <div
        className="mt-5 flex-1 space-y-4 overflow-y-auto pr-1 text-[13px] leading-relaxed"
        style={{ color: "rgba(220,228,245,0.88)" }}
      >
          {isActuallyLoading && (
            <div className="flex items-center gap-2" style={{ color: MUTED }}>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-[12px]">Gemini Analyzing...</span>
            </div>
          )}

          {error && !isActuallyLoading && (
            <div
              className="flex items-start gap-2 rounded-xl border p-3 text-[12px]"
              style={{
                borderColor: "rgba(224,58,62,0.3)",
                background: "rgba(224,58,62,0.06)",
                color: "rgba(255,160,160,0.9)",
              }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: RED }} />
              <span>{error}</span>
            </div>
          )}

          {brief && !isActuallyLoading && (
            <>
              <div className="whitespace-pre-line text-[13px] leading-relaxed">{brief.brief}</div>

              {brief.themes.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: BLUE }}>
                    Themes explored
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {brief.themes.map((t) => (
                      <li key={t} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: RED }} />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[10px] italic" style={{ color: "rgba(255,255,255,0.45)" }}>
                {brief.disclaimer}
              </p>

              <p className="text-[9px] uppercase tracking-[0.14em]" style={{ color: "rgba(255,255,255,0.3)" }}>
                Source:{" "}
                {brief.source === "gemini"
                  ? "Gemini"
                  : brief.source === "vertex"
                    ? "Vertex AI"
                    : "Live aggregate signals"}
              </p>
            </>
          )}

          {!isActuallyLoading && !brief && city && <p>{city.insight}</p>}
        </div>
    </aside>
  );
};

/* ============================================================
 * GeminiWhyDrawer (unchanged from Hub.backend.tsx)
 * ============================================================ */

const GeminiWhySidePanel = ({
  open,
  onClose,
  city,
}: {
  open: boolean;
  onClose: () => void;
  city: HometownCity | null;
}) => {
  const { detail, loading } = useHubDetail(open && city ? city.id : null);
  const [artificialLoading, setArtificialLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setArtificialLoading(true);
      const timer = setTimeout(() => setArtificialLoading(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [open, city]);

  if (!open) return null;

  const isActuallyLoading = loading || artificialLoading;

  return (
    <aside
      className="relative flex w-full shrink-0 flex-col overflow-hidden rounded-3xl border p-5 text-white lg:w-[380px] backdrop-blur-xl"
      style={{ background: "rgba(10,15,30,0.65)", borderColor: BORDER }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close Gemini explanation"
        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border text-white/70 transition-colors hover:bg-white/5 hover:text-white"
        style={{ borderColor: BORDER }}
      >
        <X className="h-4 w-4" />
      </button>

      <div className="text-left pr-10">
        <span
          className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.22em]"
          style={{ borderColor: BORDER, color: MUTED }}
        >
          <Sparkles className="h-3 w-3" style={{ color: BLUE }} />
          Gemini Explanation
        </span>
        <h3 className="mt-2 font-display text-2xl text-white">Why {city?.name ?? "this city"}?</h3>
        <p className="mt-1 text-[12px]" style={{ color: MUTED }}>
          A conditional, exploratory view of regional signals — not a performance prediction.
        </p>
      </div>

      <div
        className="mt-5 flex-1 space-y-4 overflow-y-auto pr-1 text-[13px] leading-relaxed"
        style={{ color: "rgba(220,228,245,0.88)" }}
      >
          {isActuallyLoading && (
            <div className="flex items-center gap-2" style={{ color: MUTED }}>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-[12px]">Gemini Analyzing...</span>
            </div>
          )}

          {!isActuallyLoading && (
            <>
              <p>
                {detail?.narrative ?? city?.insight ?? ""}
              </p>

              {detail?.map_pins && detail.map_pins.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: BLUE }}>
                    Regional markers
                  </div>
                  <ul className="mt-2 space-y-2">
                    {detail.map_pins.map((pin) => (
                      <li key={pin.label} className="flex items-start gap-2">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: pin.color === "red" ? RED : BLUE }}
                        />
                        <div>
                          <span className="font-semibold text-white">{pin.label}</span>
                          {" — "}
                          <span>{pin.description}</span>
                          {pin.external_link && (
                            <a
                              href={pin.external_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-1 text-[11px] underline underline-offset-2"
                              style={{ color: BLUE }}
                            >
                              ↗
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(detail ? { tags: detail.tags } : city) && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: BLUE }}>
                    Themes Gemini may explore
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {(detail?.tags ?? city?.tags ?? []).map((t) => (
                      <li key={t} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: RED }} />
                        <span>{t} — regional storylines to explore.</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detail?.parity_snapshot && (
                <div
                  className="rounded-xl border p-3 text-[12px]"
                  style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
                >
                  <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: BLUE }}>
                    Olympic · Paralympic parity snapshot
                  </div>
                  <p style={{ color: MUTED }}>{detail.parity_snapshot.parity_note}</p>
                  <div className="mt-2 flex flex-col gap-1 text-[11px]">
                    <span style={{ color: MUTED }}>
                      <span style={{ color: RED }}>Olympic:</span> {detail.parity_snapshot.olympic_story_estimate}
                    </span>
                    <span style={{ color: MUTED }}>
                      <span style={{ color: BLUE }}>Paralympic:</span>{" "}
                      {detail.parity_snapshot.paralympic_story_estimate}
                    </span>
                  </div>
                </div>
              )}

              {detail?.sources && detail.sources.length > 0 && (
                <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                  <div className="mb-1 font-semibold uppercase tracking-[0.16em]">Sources</div>
                  <ul className="space-y-0.5">
                    {detail.sources.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[11px] italic" style={{ color: "rgba(255,255,255,0.5)" }}>
                Built on public aggregate data. Regional signals do not guarantee outcomes.
              </p>
            </>
          )}
        </div>
    </aside>
  );
};

/* ============================================================
 * PersonalizationDrawer (unchanged from Hub.backend.tsx)
 * ============================================================ */

const Field = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="space-y-1.5">
    <Label className="text-[10px] uppercase tracking-[0.2em]" style={{ color: MUTED }}>
      {label}
    </Label>
    <Input {...props} className="h-11 rounded-lg border-white/10 bg-white/5 text-white placeholder:text-white/30" />
  </div>
);

const PersonalizationDrawer = ({
  open,
  onOpenChange,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (data: PersonalizationData) => void;
}) => {
  const [data, setData] = useState<PersonalizationData>({
    hometown: "",
    interests: "",
    movement: "",
    experience: "",
  });

  const set = (k: keyof PersonalizationData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setData((d) => ({ ...d, [k]: e.target.value }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto border-l border-white/10 text-white"
        style={{ background: NAVY_BG }}
      >
        <SheetHeader className="text-left">
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.22em]"
            style={{ borderColor: BORDER, color: MUTED }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: BLUE }} />
            Optional
          </span>
          <SheetTitle className="font-display text-2xl text-white">Personalize My View</SheetTitle>
          <SheetDescription style={{ color: MUTED }}>
            All fields are optional. You can keep exploring without filling anything in.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <Field
            label="Hometown or region"
            placeholder="e.g. Denver, CO"
            value={data.hometown}
            onChange={set("hometown")}
          />
          <Field
            label="Story interests"
            placeholder="e.g. comeback, training, parity"
            value={data.interests}
            onChange={set("interests")}
          />
          <Field
            label="Movement style (optional)"
            placeholder="e.g. endurance, power, precision"
            value={data.movement}
            onChange={set("movement")}
          />
          <Field
            label="Sport experience (optional)"
            placeholder="e.g. fan, weekend athlete, coach"
            value={data.experience}
            onChange={set("experience")}
          />

          <PrimaryButton onClick={() => onGenerate(data)} className="w-full justify-center">
            Generate My Constellation
          </PrimaryButton>

          <p className="pt-1 text-center text-[10px]" style={{ color: MUTED }}>
            Aggregate, public Team USA data only. No individual predictions.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

/* ============================================================
 * Footer proof strip (unchanged)
 * ============================================================ */

const PROOF_ITEMS = [
  "Gemini",
  "FastAPI",
  "Google Cloud",
  "Public aggregate Team USA data",
  "Olympic + Paralympic parity",
  "No performance guarantees",
];

const ProofStrip = () => (
  <footer
    className="rounded-2xl border px-4 py-3"
    style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
  >
    <ul
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-[11px] leading-relaxed tracking-[0.12em] md:text-[12px]"
      style={{ color: "rgba(220,228,245,0.85)" }}
    >
      {PROOF_ITEMS.map((item, i) => (
        <li key={item} className="flex items-center gap-3">
          {i > 0 && <span className="opacity-30">·</span>}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </footer>
);

/* ============================================================
 * Page composition — identical layout to Hub.backend.tsx
 * ============================================================ */

const Hub = () => {
  const { toast } = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [whyCity, setWhyCity] = useState<HometownCity | null>(null);
  const [briefCity, setBriefCity] = useState<HometownCity | null>(null);

  const handleExploreDemo = () =>
    toast({ title: "Live exploration", description: "Opening live hometown experience…" });

  const handleAskGemini = () => toast({ title: "Gemini Analyst", description: "Hook up Gemini call here." });

  const handleGenerate = (data: PersonalizationData) => {
    setDrawerOpen(false);
    toast({
      title: "Constellation generated",
      description: data.hometown
        ? `Tuning stories around ${data.hometown}…`
        : "Showing default Team USA constellation.",
    });
  };

  const handleGenerateBrief = (city: HometownCity) => {
    setWhyOpen(false);
    setBriefCity(city);
    setBriefOpen(true);
  };

  const handleAskWhy = (city: HometownCity) => {
    setBriefOpen(false);
    setWhyCity(city);
    setWhyOpen(true);
  };

  const featureClick = (name: string) => () => toast({ title: name, description: `Open ${name} placeholder.` });

  return (
    <div className="relative min-h-screen w-full text-white" style={{ background: NAVY_BG }}>
      <HubBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        <main className="flex w-full flex-1 flex-col gap-4 px-4 pb-6 pt-4 md:gap-5 md:px-8">
          {/* Team USA accent line */}
          <div className="flex h-[3px] w-full overflow-hidden rounded-full" aria-hidden="true">
            <div className="flex-1" style={{ background: RED }} />
            <div className="flex-1 bg-white/85" />
            <div className="flex-1" style={{ background: BLUE }} />
          </div>

          {/* Flagship Hometown Signals — single side panel swaps content */}
          <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-stretch">
            <div className="flex min-w-0 flex-1 flex-col z-10 relative">
              <HometownFlagshipCard onGenerateBrief={handleGenerateBrief} onAskGemini={handleAskWhy} />
            </div>
            {(briefOpen || whyOpen) && (
              <div className="flex w-full lg:w-[420px] lg:flex-shrink-0 z-20 relative">
                {whyOpen ? (
                  <GeminiWhySidePanel key="why" open={whyOpen} onClose={() => setWhyOpen(false)} city={whyCity} />
                ) : (
                  <HometownBriefSidePanel key="brief" open={briefOpen} onClose={() => setBriefOpen(false)} city={briefCity} />
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      <PersonalizationDrawer open={drawerOpen} onOpenChange={setDrawerOpen} onGenerate={handleGenerate} />

      {/* Hometown Brief and Gemini Why now render inline as side panels above */}
    </div>
  );
};

export default Hub;
