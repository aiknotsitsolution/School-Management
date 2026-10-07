/**
 * Global async-button feedback.
 *
 * Every request this panel makes goes through `window.fetch` — `request()` in
 * lib/api.js plus the handful of direct PDF/attachment fetches — so wrapping it
 * once gives a single in-flight counter. A capture-phase click listener
 * remembers the button that started the round-trip; when a fetch begins within
 * a second of that click the button flips into a busy state (inline spinner,
 * no further clicks) and stays there until all in-flight requests settle.
 *
 * That way all 800+ buttons report their own round-trip without each call site
 * managing a `saving` flag — pages that already do it themselves (they disable
 * themselves or render an `.animate-spin` icon) are skipped so they don't end
 * up with two spinners.
 */

const CLICK_WINDOW_MS = 1000;
const LOADING_ATTR = "data-async-loading";

let inflight = 0;
let lastButton = null;
let lastClickAt = 0;

function markBusy(button) {
  if (button.hasAttribute(LOADING_ATTR) || button.disabled) return;
  // Page owns its own busy state — leave it alone.
  if (button.querySelector(".animate-spin, [data-busy-icon]")) return;
  button.setAttribute(LOADING_ATTR, "");
  button.setAttribute("aria-busy", "true");
}

function clearBusy() {
  document.querySelectorAll(`[${LOADING_ATTR}]`).forEach((element) => {
    element.removeAttribute(LOADING_ATTR);
    element.removeAttribute("aria-busy");
  });
}

export function installInflightTracker() {
  if (typeof window === "undefined" || window.__inflightTrackerInstalled) return;
  window.__inflightTrackerInstalled = true;

  // Capture phase so a handler that stopPropagation()s cannot hide the source
  // of the request, and so a busy button swallows repeat activations (pointer
  // clicks are already blocked by `pointer-events: none`, keyboard ones are not).
  document.addEventListener(
    "click",
    (event) => {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (!button) return;
      if (button.hasAttribute(LOADING_ATTR)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (button.disabled) return;
      lastButton = button;
      lastClickAt = Date.now();
    },
    true,
  );

  const originalFetch = window.fetch.bind(window);
  window.fetch = function trackedFetch(...args) {
    inflight += 1;
    const source = lastButton;
    const clickedRecently = source && source.isConnected && Date.now() - lastClickAt <= CLICK_WINDOW_MS;
    if (clickedRecently) {
      // Wait a tick: React renders its own busy state (disabled /
      // `.animate-spin`) in the same batch as this click, so marking
      // synchronously would double up on pages that already show a spinner.
      setTimeout(() => {
        if (inflight > 0 && source.isConnected) markBusy(source);
      }, 0);
    }
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      inflight = Math.max(0, inflight - 1);
      if (inflight === 0) clearBusy();
    };
    return originalFetch(...args).then(
      (response) => {
        settle();
        return response;
      },
      (error) => {
        settle();
        throw error;
      },
    );
  };
}
