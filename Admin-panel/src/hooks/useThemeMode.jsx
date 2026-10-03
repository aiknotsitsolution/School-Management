import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "zipschool-theme";
const ThemeContext = createContext(null);

const prefersDark = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

const readStored = () => {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : "system";
};

/** Resolves "system" against the OS setting, so a stored "system" still tracks it. */
const resolve = (pref) => (pref === "system" ? (prefersDark() ? "dark" : "light") : pref);

/** Written synchronously so anything reading the DOM (charts, CSS vars) is
 *  already correct by the time the state change re-renders consumers. */
const applyTheme = (mode) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", mode);
  root.style.colorScheme = mode;
};

export function ThemeProvider({ children }) {
  const [pref, setPref] = useState(readStored);
  const resolved = resolve(pref);

  // Keep the DOM in sync on every change, including the initial "system" value.
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  // A stored "system" preference should follow the OS live.
  useEffect(() => {
    if (pref !== "system" || typeof window === "undefined") return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => applyTheme(e.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const setMode = useCallback((m) => {
    applyTheme(resolve(m));
    try {
      window.localStorage.setItem(STORAGE_KEY, m);
    } catch {}
    setPref(m);
  }, []);

  const toggle = useCallback(() => {
    setMode(resolve(pref) === "dark" ? "light" : "dark");
  }, [pref, setMode]);

  const value = useMemo(
    () => ({ mode: resolved, pref, setMode, toggle }),
    [resolved, pref, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeMode must be used inside <ThemeProvider>");
  return ctx;
}
