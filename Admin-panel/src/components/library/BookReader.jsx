import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { PageFlip } from "page-flip/dist/js/page-flip.module.js";

// Google Play Books / PubHTML5-style two-page spread with a real 3D page-turn
// animation (page-flip, MIT). Renders PDF pages into lazily-filled canvases:
// only the current spread ± a couple of spreads is rasterised, so memory stays
// flat on a 200-page book; pages further away release their backing store and
// repaint when the reader flips near them.
//
// State lives in refs rather than React state because page-flip rewrites each
// page element's inline style on every frame — React nodes inside the flip
// book would fight it. The host is one static div; everything under it is
// imperative.

const MIN_PAGE_W = 200;
// Keep the current spread + ~2 spreads either side painted: with showCover the
// spreads are [0], [1,2], [3,4]… so -4/+5 covers every reachable turn.
const WINDOW_BEFORE = 4;
const WINDOW_AFTER = 5;

function computeSizes(boxW, boxH, aspect) {
  const availW = Math.max(MIN_PAGE_W, boxW - 32);
  const availH = Math.max(Math.round(MIN_PAGE_W * aspect), boxH - 32);
  // Narrow viewports read better as a single page — page-flip switches to
  // portrait itself once the block is narrower than two pages.
  const pageW = availW < 640 ? Math.min(availW, availH * aspect) : Math.min(availW / 2, availH * aspect);
  const w = Math.max(MIN_PAGE_W, Math.round(pageW));
  return { pageW: w, pageH: Math.round(w / aspect) };
}

function makePage(theme) {
  const el = document.createElement("div");
  const inner = document.createElement("div");
  inner.className = "relative w-full h-full flex items-center justify-center";
  inner.style.background = theme.page;
  const canvas = document.createElement("canvas");
  canvas.className = "block w-full h-full";
  canvas.style.filter = theme.filter;
  const ph = document.createElement("div");
  ph.className = "absolute inset-0 items-center justify-center";
  ph.style.display = "none";
  const spin = document.createElement("div");
  // The spinner sits on theme.page (white / cream / near-black), so its colours
  // are chosen per theme rather than a fixed slate pair: track and head both
  // clear 3:1 against every page background (WCAG 1.4.11 — it is the only
  // loading affordance, there is no text under it).
  spin.className = "w-5 h-5 rounded-full border-2 animate-spin";
  spin.style.borderColor = "#64748b"; // slate-500: 4.76:1 on white, 4.06:1 on sepia, 3.58:1 on night
  spin.style.borderTopColor = theme.key === "night" ? "#e7e7ea" : "#0f172a";
  ph.appendChild(spin);
  inner.appendChild(canvas);
  inner.appendChild(ph);
  el.appendChild(inner);
  return { el, inner, canvas, ph };
}

const BookReader = forwardRef(function BookReader(
  { doc, numPages, startPage, theme, page, zoom, onPageChange },
  ref
) {
  const hostRef = useRef(null);
  const apiRef = useRef(null); // { pf, parent, applyWindow, applySize }
  const pagesRef = useRef([]);
  const sizeRef = useRef({ pageW: 0, pageH: 0, baseW: 0, baseH: 0, aspect: 1 });
  const renderedRef = useRef(new Set());
  const chainRef = useRef(Promise.resolve());
  const zoomRef = useRef(zoom);
  const onPageChangeRef = useRef(onPageChange);
  zoomRef.current = zoom;
  onPageChangeRef.current = onPageChange;

  useImperativeHandle(ref, () => ({
    next: () => apiRef.current?.pf.flipNext("top"),
    prev: () => apiRef.current?.pf.flipPrev("top"),
  }));

  // --- boot: measure, build page shells, hand them to page-flip ------------
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !doc || numPages < 1) return undefined;
    let dead = false;
    chainRef.current = Promise.resolve();
    renderedRef.current = new Set();

    const emit = (leftIndex) => {
      if (dead) return;
      const pf = apiRef.current?.pf;
      let right = null;
      if (pf && pf.getOrientation() === "landscape" && leftIndex !== 0 && leftIndex + 1 < numPages) {
        right = leftIndex + 2; // 1-based number of the right leaf
      }
      onPageChangeRef.current?.(leftIndex + 1, right);
      apiRef.current?.applyWindow(leftIndex);
    };

    const setPh = (i, on) => {
      const rec = pagesRef.current[i];
      if (rec) rec.ph.style.display = on ? "flex" : "none";
    };

    const release = (i) => {
      const rec = pagesRef.current[i];
      if (!rec || !renderedRef.current.has(i)) return;
      rec.canvas.width = 0;
      rec.canvas.height = 0;
      rec.ph.style.display = "none";
      renderedRef.current.delete(i);
    };

    const renderPage = async (i) => {
      if (dead || i < 0 || i >= numPages) return;
      const rec = pagesRef.current[i];
      if (!rec || renderedRef.current.has(i)) return;
      setPh(i, true);
      try {
        const pdfPage = await doc.getPage(i + 1);
        if (dead) return;
        const { pageW } = sizeRef.current;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const base = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({ scale: (pageW / base.width) * dpr });
        rec.canvas.width = Math.floor(viewport.width);
        rec.canvas.height = Math.floor(viewport.height);
        const ctx = rec.canvas.getContext("2d");
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, rec.canvas.width, rec.canvas.height);
        await pdfPage.render({ canvasContext: ctx, viewport }).promise;
        if (dead) return;
        renderedRef.current.add(i);
      } catch {
        // Cancelled (reader closed, or a new density pass superseded it) —
        // leave the shell blank; the next window pass retries it.
        release(i);
      } finally {
        if (!dead) setPh(i, false);
      }
    };

    // Serialise renders so a scrubber jump never stampedes pdf.js, and so the
    // pages nearest the reader always win the queue.
    const enqueue = (i) => {
      chainRef.current = chainRef.current.then(() => renderPage(i));
    };

    const applyWindow = (center) => {
      const want = [];
      for (let d = -WINDOW_BEFORE; d <= WINDOW_AFTER; d += 1) {
        const i = center + d;
        if (i >= 0 && i < numPages) want.push(i);
      }
      const keep = new Set(want);
      [...renderedRef.current].forEach((i) => {
        if (!keep.has(i)) release(i);
      });
      want
        .sort((a, b) => Math.abs(a - center) - Math.abs(b - center))
        .forEach((i) => {
          if (!renderedRef.current.has(i)) enqueue(i);
        });
    };

    const applySize = () => {
      const pf = apiRef.current?.pf;
      const s = sizeRef.current;
      const box = hostRef.current?.getBoundingClientRect();
      if (!pf || !s.aspect || !box) return;
      const { pageW: baseW, pageH: baseH } = computeSizes(box.width, box.height, s.aspect);
      const w = Math.round(baseW * zoomRef.current);
      const h = Math.round(baseH * zoomRef.current);
      const st = pf.getSettings();
      if (st.width === w && st.height === h) return;
      st.width = w;
      st.height = h;
      s.baseW = baseW;
      s.baseH = baseH;
      s.pageW = w;
      s.pageH = h;
      const parent = apiRef.current?.parent;
      if (parent) {
        parent.style.minWidth = `${w}px`;
        parent.style.minHeight = `${h}px`;
      }
      pf.update();
      // Density changed → repaint the visible window at the new size.
      [...renderedRef.current].forEach((i) => {
        const rec = pagesRef.current[i];
        if (rec) {
          rec.canvas.width = 0;
          rec.canvas.height = 0;
        }
      });
      renderedRef.current.clear();
      applyWindow(pf.getCurrentPageIndex());
    };

    (async () => {
      try {
        const p1 = await doc.getPage(1);
        if (dead) return;
        const base = p1.getViewport({ scale: 1 });
        const aspect = base.width / base.height;
        const box = host.getBoundingClientRect();
        const { pageW, pageH } = computeSizes(box.width, box.height, aspect);
        sizeRef.current = { pageW, pageH, baseW: pageW, baseH: pageH, aspect };

        pagesRef.current = Array.from({ length: numPages }, () => makePage(theme));

        const parent = document.createElement("div");
        parent.className = "w-full";
        host.appendChild(parent);

        const start = Math.min(Math.max((startPage || 1) - 1, 0), numPages - 1);
        const pf = new PageFlip(parent, {
          width: Math.round(pageW * zoomRef.current),
          height: Math.round(pageH * zoomRef.current),
          size: "fixed",
          autoSize: false,
          usePortrait: true,
          showCover: true,
          startPage: start,
          flippingTime: 700,
          drawShadow: true,
          maxShadowOpacity: 0.6,
          showPageCorners: true,
          clickEventForward: true,
          useMouseEvents: true,
        });
        pf.loadFromHTML(pagesRef.current.map((r) => r.el));
        pf.on("flip", ({ data }) => emit(data));
        pf.on("changeOrientation", () => emit(pf.getCurrentPageIndex()));
        apiRef.current = { pf, parent, applyWindow, applySize };
        // Paint the restored spread (also reports it to the parent bar).
        emit(pf.getCurrentPageIndex());
      } catch {
        // Boot failure leaves the parent's error/retry UI; host is cleaned by
        // the teardown below.
      }
    })();

    return () => {
      dead = true;
      const api = apiRef.current;
      apiRef.current = null;
      if (api) {
        try {
          // page-flip runs an un-cancellable rAF draw loop; neutering
          // drawFrame is the only way to stop it painting a detached canvas.
          const r = api.pf.getRender();
          r.drawFrame = () => {};
          r.animation = null;
        } catch { /* already torn down */ }
        try { api.pf.destroy(); } catch { /* already destroyed */ }
      }
      host.replaceChildren();
      pagesRef.current = [];
    };
    // theme/startPage baked in at boot; theme changes repaint below, page
    // jumps are handled by the sync effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, numPages]);

  // --- theme repaint (shells keep identity, styles only) -------------------
  useEffect(() => {
    pagesRef.current.forEach((rec) => {
      rec.inner.style.background = theme.page;
      rec.canvas.style.filter = theme.filter;
    });
  }, [theme]);

  // --- zoom: page-flip settings mutated in place, then window re-rendered ---
  useEffect(() => {
    apiRef.current?.applySize();
  }, [zoom]);

  // --- window resize: same funnel, debounced -------------------------------
  useEffect(() => {
    let t = null;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => apiRef.current?.applySize(), 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // --- parent scrubber / progress jumps ------------------------------------
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const target = Math.min(Math.max(page - 1, 0), numPages - 1);
    if (api.pf.getCurrentPageIndex() !== target) api.pf.turnToPage(target);
  }, [page, numPages]);

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 flex items-center justify-center p-4"
      aria-label="Flip book reader"
    />
  );
});

export default BookReader;
