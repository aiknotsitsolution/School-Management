import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import pdfjsLib from "../../lib/pdfjs";

const THEMES = [
  // Bars use explicit colors (not theme vars): the reader is a self-themed
  // overlay, so app-dark mode must not turn a white bar's text light-on-light.
  { key: "light", label: "Light", page: "#ffffff", canvas: "#f1f2f4", filter: "none", bar: "#ffffff", barText: "text-[#1f2937]", barBorder: "border-[#0f172a]/10" },
  { key: "sepia", label: "Sepia", page: "#f6ecd9", canvas: "#e7dcc4", filter: "sepia(0.35) contrast(0.96)", bar: "#f6ecd9", barText: "text-[#4a3b22]", barBorder: "border-[#d9c9a8]" },
  { key: "night", label: "Night", page: "#1c1c1e", canvas: "#101012", filter: "invert(1) hue-rotate(180deg)", pageFilter: "none", bar: "#101012", barText: "text-[#e7e7ea]", barBorder: "border-white/10" },
];

const THEME_KEY = "zipschool-pdf-theme";
const progressKey = (src) => `zipschool-pdf-progress:${src}`;

function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return THEMES.some((t) => t.key === saved) ? saved : "light";
  } catch {
    return "light";
  }
}

// Full-screen, Google Play Books-style PDF reader. Page-by-page navigation
// (arrows, tap zones, scrubber), zoom, light/sepia/night reading themes,
// keyboard shortcuts and a remembered last-read page per document.
export default function PdfReader({ src, title, onClose }) {
  const [doc, setDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [themeKey, setThemeKey] = useState(loadTheme);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const docRef = useRef(null);
  const renderTaskRef = useRef(null);
  const pageRefRef = useRef(null);

  const theme = THEMES.find((t) => t.key === themeKey) || THEMES[0];

  // --- document lifecycle -------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError("");
    pdfjsLib
      .getDocument({ url: src })
      .promise.then((d) => {
        if (cancelled) {
          d.destroy();
          return;
        }
        docRef.current = d;
        setDoc(d);
        setNumPages(d.numPages);
        // Resume where the reader stopped last time.
        let start = 1;
        try {
          const saved = parseInt(localStorage.getItem(progressKey(src)), 10);
          if (Number.isFinite(saved) && saved >= 1 && saved <= d.numPages) start = saved;
        } catch { /* private mode — start at page 1 */ }
        setPage(start);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || "Could not open this document");
        setStatus("error");
      });
    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch { /* already finished */ }
      }
      if (docRef.current) {
        try { docRef.current.destroy(); } catch { /* already destroyed */ }
        docRef.current = null;
      }
    };
  }, [src]);

  const computeFitScale = useCallback(
    async (targetPage) => {
      if (!docRef.current || !viewportRef.current) return 1;
      const p = await docRef.current.getPage(targetPage);
      const base = p.getViewport({ scale: 1 });
      const box = viewportRef.current.getBoundingClientRect();
      const available = Math.max(160, box.width - 48);
      const availableH = Math.max(200, box.height - 48);
      return Math.min(available / base.width, availableH / base.height, 3);
    },
    []
  );

  // --- page rendering -----------------------------------------------------
  useEffect(() => {
    if (status !== "ready" || !docRef.current || !canvasRef.current) return undefined;
    let cancelled = false;

    const render = async () => {
      const pdfPage = await docRef.current.getPage(page);
      if (cancelled) return;
      let nextScale = scale;
      if (fitWidth) {
        nextScale = await computeFitScale(page);
        if (cancelled) return;
        setScale(nextScale);
      }
      const viewport = pdfPage.getViewport({ scale: nextScale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch { /* noop */ }
      }
      const task = pdfPage.render({ canvasContext: ctx, viewport, transform: [dpr, 0, 0, dpr, 0, 0] });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch (err) {
        if (err?.name !== "RenderingCancelledException") throw err;
      }
      if (!cancelled && pageRefRef.current) pageRefRef.current.focus({ preventScroll: true });
    };

    render().catch(() => {
      if (!cancelled) {
        setError("Could not render this page");
        setStatus("error");
      }
    });

    return () => { cancelled = true; };
  }, [status, doc, page, scale, fitWidth, computeFitScale]);

  // Remember the last-read page.
  useEffect(() => {
    if (status !== "ready" || !page) return;
    try { localStorage.setItem(progressKey(src), String(page)); } catch { /* ignore */ }
  }, [page, src, status]);

  const goTo = useCallback(
    (next) => {
      setPage(Math.min(Math.max(next, 1), numPages || 1));
    },
    [numPages]
  );

  // --- keyboard shortcuts -------------------------------------------------
  useEffect(() => {
    if (status !== "ready") return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); goTo(page + 1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); goTo(page - 1); }
      else if (e.key === "+" || e.key === "=") { e.preventDefault(); setFitWidth(false); setScale((s) => Math.min(s + 0.15, 3)); }
      else if (e.key === "-") { e.preventDefault(); setFitWidth(false); setScale((s) => Math.max(s - 0.15, 0.4)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, page, goTo, onClose]);

  // --- swipe (touch) ------------------------------------------------------
  const touchX = useRef(null);
  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 60) goTo(page + (dx < 0 ? 1 : -1));
    touchX.current = null;
  };

  const download = async () => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = title ? `${title}.pdf` : "document.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      window.open(src, "_blank", "noopener");
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col" style={{ background: theme.canvas }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Top bar */}
      <div className={`flex items-center gap-3 border-b px-4 py-2.5 ${theme.barBorder}`} style={{ background: theme.bar }}>
        <button
          onClick={onClose}
          className={`p-1.5 rounded-lg hover:bg-black/5 ${theme.barText}`}
          title="Close reader (Esc)"
        >
          <X size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-[13.5px] font-semibold truncate ${theme.barText}`}>{title || "Document"}</p>
          {numPages > 0 && (
            <p className={`text-[11px] opacity-60 ${theme.barText}`}>
              Page {page} of {numPages}
            </p>
          )}
        </div>
        <button
          onClick={() => {
            const next = THEMES[(THEMES.findIndex((t) => t.key === themeKey) + 1) % THEMES.length].key;
            setThemeKey(next);
            try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
          }}
          className={`p-1.5 rounded-lg hover:bg-black/5 ${theme.barText}`}
          title={`Theme: ${theme.label} — click to switch`}
        >
          {themeKey === "night" ? <Moon size={17} /> : <Sun size={17} />}
        </button>
        <button onClick={download} className={`p-1.5 rounded-lg hover:bg-black/5 ${theme.barText}`} title="Download PDF">
          <Download size={17} />
        </button>
        <button onClick={toggleFullscreen} className={`p-1.5 rounded-lg hover:bg-black/5 ${theme.barText}`} title="Fullscreen">
          {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
      </div>

      {/* Page area */}
      <div ref={viewportRef} className="relative flex-1 overflow-auto flex items-start justify-center p-4">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 py-24 text-[#475569]">
            <Loader2 size={26} className="animate-spin" />
            <p className="text-[13px]">Opening book…</p>
          </div>
        )}
        {status === "error" && (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <p className="text-[13.5px] font-semibold text-[#0f172a]">{error}</p>
            <div className="flex gap-2">
              <a href={src} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-lg bg-primary text-white text-[13px] font-semibold">
                Open in new tab
              </a>
              <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[#0f172a]/15 text-[13px] font-semibold text-[#0f172a]">
                Close
              </button>
            </div>
          </div>
        )}
        {status === "ready" && (
          <>
            {/* Tap zones (like page turns in Play Books) */}
            {page > 1 && (
              <button
                onClick={() => goTo(page - 1)}
                className="sticky left-0 top-1/2 -translate-y-1/2 self-center p-2 rounded-full bg-black/50 text-white hover:bg-black/65 transition-colors"
                title="Previous page"
              >
                <ChevronLeft size={22} />
              </button>
            )}
            <div
              className="relative mx-2 shadow-2xl"
              style={{ background: theme.page, filter: themeKey === "night" ? "none" : undefined }}
            >
              <canvas ref={canvasRef} className="block" style={{ filter: theme.filter }} />
              {/* invisible click targets for page turns */}
              <button
                aria-label="Previous page"
                onClick={() => goTo(page - 1)}
                className="absolute inset-y-0 left-0 w-[12%] cursor-w-resize"
                style={{ display: page > 1 ? "block" : "none" }}
              />
              <button
                aria-label="Next page"
                onClick={() => goTo(page + 1)}
                className="absolute inset-y-0 right-0 w-[12%] cursor-e-resize"
                style={{ display: page < numPages ? "block" : "none" }}
              />
            </div>
            {page < numPages && (
              <button
                onClick={() => goTo(page + 1)}
                className="sticky right-0 top-1/2 -translate-y-1/2 self-center p-2 rounded-full bg-black/50 text-white hover:bg-black/65 transition-colors"
                title="Next page"
              >
                <ChevronRight size={22} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Bottom bar: scrubber + zoom */}
      <div className={`flex items-center gap-3 border-t px-4 py-2.5 ${theme.barBorder}`} style={{ background: theme.bar }}>
        <button
          onClick={() => goTo(page - 1)}
          disabled={page <= 1 || status !== "ready"}
          className={`p-1.5 rounded-lg hover:bg-black/5 disabled:opacity-30 ${theme.barText}`}
          title="Previous page (←)"
        >
          <ChevronLeft size={18} />
        </button>
        <input
          type="range"
          min={1}
          max={Math.max(numPages, 1)}
          value={page}
          disabled={status !== "ready"}
          onChange={(e) => goTo(Number(e.target.value))}
          className="flex-1 accent-primary"
          aria-label="Page scrubber"
        />
        <span className={`text-[12px] font-semibold tabular-nums ${theme.barText}`}>
          {page} / {numPages || "–"}
        </span>
        <button
          onClick={() => goTo(page + 1)}
          disabled={page >= numPages || status !== "ready"}
          className={`p-1.5 rounded-lg hover:bg-black/5 disabled:opacity-30 ${theme.barText}`}
          title="Next page (→)"
        >
          <ChevronRight size={18} />
        </button>
        <div className={`flex items-center gap-1 border-l pl-3 ml-1 ${theme.barBorder}`}>
          <button
            onClick={() => { setFitWidth(false); setScale((s) => Math.max(s - 0.15, 0.4)); }}
            disabled={status !== "ready"}
            className={`p-1.5 rounded-lg hover:bg-black/5 disabled:opacity-30 ${theme.barText}`}
            title="Zoom out (−)"
          >
            <ZoomOut size={17} />
          </button>
          <button
            onClick={async () => { setFitWidth(true); setScale(await computeFitScale(page)); }}
            className={`px-1.5 text-[11.5px] font-semibold rounded hover:bg-black/5 ${theme.barText}`}
            title="Fit page"
          >
            {fitWidth ? "Fit" : `${Math.round(scale * 100)}%`}
          </button>
          <button
            onClick={() => { setFitWidth(false); setScale((s) => Math.min(s + 0.15, 3)); }}
            disabled={status !== "ready"}
            className={`p-1.5 rounded-lg hover:bg-black/5 disabled:opacity-30 ${theme.barText}`}
            title="Zoom in (+)"
          >
            <ZoomIn size={17} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
