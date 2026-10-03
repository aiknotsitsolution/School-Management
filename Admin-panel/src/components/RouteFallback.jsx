// Route-level loading fallback.
//
// Every page is now code-split, so this shows while a chunk is in flight. It
// keeps the layout chrome (sidebar + topbar) visible by rendering only the
// content area, so navigating never flashes a full-page blank.
export default function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div className="dot-spinner" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="dot" style={{ "--i": i }} />
          ))}
        </div>
        <p className="text-[12.5px] font-medium text-slate-text/70">Loading…</p>
      </div>
    </div>
  );
}
