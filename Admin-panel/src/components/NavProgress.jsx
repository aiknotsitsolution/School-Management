import { useEffect, useRef, useState } from "react";

// Navigation feedback for the sidebar.
//
// React Router wraps route changes in startTransition, which keeps the previous
// page on screen until the next one commits and, in doing so, suppresses the
// Suspense fallback. Measured on a cold route that was ~1.3s of "I clicked and
// nothing happened": the URL updates at once, the sidebar highlight moves, and
// the content area still shows the page you left.
//
// Watching `useLocation()` cannot fix that — Router v7 folds the location into
// the same transition, so by the time the hook reports the new path the swap has
// already happened and there is nothing left to report. So we hook the history
// API instead: `history.pushState` runs *before* React is told to re-render, at
// which point the DOM still holds the outgoing page. That gives us an honest
// "the click registered, the page has not landed yet" window to render into.
//
// Mounted once in App, outside <Routes>, so it survives every navigation.

const SKELETON_AFTER = 120; // ms — navigations that land this fast never flash a skeleton
const GIVE_UP_AFTER = 5000; // ms — never strand the user behind an overlay
const POLL_EVERY = 80; // ms — how often we check whether the new page has landed

const mainText = () => document.querySelector("main")?.innerText ?? "";

function Skeleton({ left, top, width, height }) {
  return (
    <div
      className="fixed z-[290] overflow-hidden bg-paper"
      style={{ left, top, width, height }}
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="animate-pulse space-y-5 p-4 sm:p-6">
        <div className="h-3 w-40 rounded bg-slate-text/15" />
        <div className="h-7 w-64 rounded-lg bg-slate-text/20" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-text/10" />
          ))}
        </div>
        <div className="h-56 rounded-2xl bg-slate-text/10" />
      </div>
    </div>
  );
}

export default function NavProgress() {
  const [bar, setBar] = useState(false);
  const [skeleton, setSkeleton] = useState(null);

  // Latest snapshot the poll is comparing against; null when no wait is in
  // flight. A ref so the history callbacks share one job across re-renders.
  const pendingBefore = useRef(null);

  useEffect(() => {
    let skeletonTimer = null;
    let pollTimer = null;
    let giveUpTimer = null;

    const stop = () => {
      pendingBefore.current = null;
      clearTimeout(skeletonTimer);
      clearTimeout(giveUpTimer);
      clearInterval(pollTimer);
      setBar(false);
      setSkeleton(null);
    };

    const tick = () => {
      const before = pendingBefore.current;
      if (before === null) return;
      if (mainText() !== before) stop();
    };

    const begin = () => {
      // Fired while the app shell (and its <main>) is not mounted — the login
      // or landing routes — so there is nothing to give feedback about.
      const main = document.querySelector("main");
      if (!main) return;

      // A second click supersedes the first: re-snapshot so the poll watches
      // for this navigation's swap rather than the previous one's.
      pendingBefore.current = main.innerText;

      clearTimeout(skeletonTimer);
      clearTimeout(giveUpTimer);
      clearInterval(pollTimer);

      setBar(true);
      setSkeleton(null);

      skeletonTimer = setTimeout(() => {
        if (pendingBefore.current === null) return;
        const target = document.querySelector("main");
        if (!target) return stop();
        const r = target.getBoundingClientRect();
        setSkeleton({ left: r.left, top: r.top, width: r.width, height: r.height });
      }, SKELETON_AFTER);

      pollTimer = setInterval(tick, POLL_EVERY);
      giveUpTimer = setTimeout(stop, GIVE_UP_AFTER);
    };

    // Patch rather than subscribe: React Router's own history object calls
    // these, and they run before its state update — which is the whole point.
    const originalPush = window.history.pushState;
    const originalReplace = window.history.replaceState;
    window.history.pushState = function patchedPush(...args) {
      const result = originalPush.apply(this, args);
      begin();
      return result;
    };
    window.history.replaceState = function patchedReplace(...args) {
      const result = originalReplace.apply(this, args);
      begin();
      return result;
    };
    const onPopState = () => begin();
    window.addEventListener("popstate", onPopState);

    return () => {
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
      window.removeEventListener("popstate", onPopState);
      stop();
    };
  }, []);

  if (!bar && !skeleton) return null;

  return (
    <>
      {bar && (
        <div className="fixed inset-x-0 top-0 z-[300] h-[3px] overflow-hidden bg-primary/15">
          <div className="nav-progress h-full" />
        </div>
      )}
      {skeleton && <Skeleton {...skeleton} />}
    </>
  );
}
