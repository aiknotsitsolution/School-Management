// Design tokens shared by every student-facing chart so the whole portal reads
// as one system. Colours are taken from `src/index.css` so charts can never
// drift away from the rest of the UI.

import { useSyncExternalStore } from "react";

/* Chart colours resolve from the live CSS custom properties rather than hard
   hex values, so every chart re-themes with the rest of the app. Recharts
   needs real colour strings though, so we read the computed value off
   :root and re-read whenever the theme flips. */
const readToken = (name, fallback) => {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

const buildPalette = () => ({
  ink: readToken("--color-ink", "#172033"),
  inkLight: readToken("--color-ink-light", "#222D42"),
  slate: readToken("--color-slate-text", "#475569"),
  slateLight: readToken("--color-slate-400", "#94A3B8"),
  grid: readToken("--color-slate-200", "#E2E8F0"),
  track: readToken("--color-slate-100", "#F1F5F9"),
  paper: readToken("--color-paper", "#F8FAFC"),
  primary: readToken("--color-primary", "#4F46E5"),
  info: readToken("--color-info", "#2563EB"),
  success: readToken("--color-success", "#16A34A"),
  warning: readToken("--color-warning", "#F59E0B"),
  alert: readToken("--color-alert", "#DC2626"),
  violet: readToken("--color-violet-500", "#8B5CF6"),
  teal: readToken("--color-teal-500", "#0D9488"),
  pink: readToken("--color-pink-500", "#DB2777"),
  cyan: readToken("--color-cyan-500", "#0891B2"),
});

let cached = buildPalette();
let cachedTheme = null;

const themeMode = () =>
  typeof document === "undefined"
    ? "light"
    : document.documentElement.getAttribute("data-theme") || "light";

/** Re-reads tokens when the app theme changes; safe to call during render. */
export function syncChartTheme() {
  const attr = themeMode();
  if (attr !== cachedTheme) {
    cachedTheme = attr;
    cached = buildPalette();
  }
  return cached;
}

/* SVG colours are baked in at render time, so a theme flip has to re-render the
   chart — CSS cannot repaint them. Charts subscribe through this store. */
const listeners = new Set();
let observer = null;

function ensureObserver() {
  if (observer || typeof MutationObserver === "undefined") return;
  observer = new MutationObserver(() => {
    cachedTheme = null;
    listeners.forEach((fn) => fn());
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
}

function subscribeToTheme(cb) {
  ensureObserver();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Call inside any chart component so it repaints when the theme flips. */
export function useChartTheme() {
  return useSyncExternalStore(subscribeToTheme, themeMode, () => "light");
}

export const C = new Proxy(
  {},
  {
    get(_, prop) {
      return syncChartTheme()[prop];
    },
  },
);

/** A snapshot for callers that need the palette as a plain value. */
export function chartColors() {
  return syncChartTheme();
}

/** Palette key → live colour. Anything that is not a known key is passed
 *  through untouched, so raw hex values still work at call sites. */
export function resolveColor(value) {
  if (!value) return value;
  const palette = syncChartTheme();
  return Object.prototype.hasOwnProperty.call(palette, value) ? palette[value] : value;
}

// Functions, not objects: Recharts reads `.fill` eagerly at render, so these
// must resolve the current theme at call time rather than at module load.
export const axisTick = () => ({ fontSize: 11.5, fill: C.slate });
export const axisTickSm = () => ({ fontSize: 11, fill: C.slateLight });

/** Categorical order used wherever a chart plots more than one series. */
export const SERIES = [
  "info",
  "success",
  "warning",
  "violet",
  "pink",
  "teal",
  "alert",
  "cyan",
];

/** Attendance status → colour key. Shared by the donut, trend and status strip. */
export const ATT_STATUS = {
  Present: { key: "success", soft: "#DCFCE7", label: "Present" },
  Leave: { key: "info", soft: "#DBEAFE", label: "On leave" },
  Absent: { key: "alert", soft: "#FEE2E2", label: "Absent" },
};

export const ATT_ORDER = ["Present", "Leave", "Absent"];

/** Marks a percentage as strong / on-track / needs-work. */
export function performanceBand(pct) {
  if (pct >= 85) return "strong";
  if (pct >= 60) return "steady";
  if (pct >= 40) return "weak";
  return "risk";
}

export const BAND_TONE = {
  strong: { key: "success", soft: "#DCFCE7", text: "#15803D" },
  steady: { key: "info", soft: "#DBEAFE", text: "#1D4ED8" },
  weak: { key: "warning", soft: "#FEF3C7", text: "#B45309" },
  risk: { key: "alert", soft: "#FEE2E2", text: "#B91C1C" },
};

export function toneFor(pct) {
  return C[BAND_TONE[performanceBand(pct)].key];
}

/** Palette key (not a resolved colour) for a percentage band. */
export function toneKeyFor(pct) {
  return BAND_TONE[performanceBand(pct)].key;
}

export function softFor(pct) {
  return BAND_TONE[performanceBand(pct)].soft;
}

export function textFor(pct) {
  return BAND_TONE[performanceBand(pct)].text;
}
