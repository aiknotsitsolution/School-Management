import { ChevronLeft, ChevronRight } from "lucide-react";

// Reports & Analytics-style segmented tab bar: pill container with the active
// tab filled ink/amber. Each tab carries a live count badge.
// tabs: [{ id, label, icon, count }]
export function SegmentedTabs({ tabs, active, onChange }) {
  return (
    <div className="inline-flex items-center gap-1 bg-paper border border-black/[0.06] p-1 rounded-xl flex-wrap">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg transition-colors ${
            active === tab.id ? "bg-ink text-amber shadow-sm" : "text-slate-text hover:text-ink"
          }`}
        >
          <tab.icon size={15} />
          {tab.label}
          {tab.count != null && (
            <span className="text-[11px] rounded-full px-1.5 py-0.5 bg-white/60">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// Numbered pagination: page-number window (with first/last + ellipsis), prev/
// next chevrons and an optional "Page x of y" info text. Renders nothing when
// there is a single page (or none).
export function Pagination({ page, pages, onPage, info = true }) {
  if (!pages || pages <= 1) return null;
  const window = 5;
  let from = Math.max(1, page - Math.floor(window / 2));
  let to = Math.min(pages, from + window - 1);
  from = Math.max(1, to - window + 1);
  const numbers = [];
  for (let n = from; n <= to; n++) numbers.push(n);
  const nav =
    "w-8 h-8 inline-flex items-center justify-center rounded-lg border border-black/[0.06] bg-paper text-slate-text hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
  const pageBtn = (n, current) =>
    `w-8 h-8 inline-flex items-center justify-center rounded-lg text-[13px] font-semibold transition-colors ${
      current ? "bg-ink text-amber" : "border border-black/[0.06] bg-paper text-slate-text hover:text-ink"
    }`;
  return (
    <div className="flex items-center justify-between pt-4 border-t border-black/[0.06] mt-4">
      {info ? (
        <p className="text-[12px] text-slate-text/60">
          Page {page} of {pages}
        </p>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-1.5">
        <button className={nav} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft size={15} />
        </button>
        {from > 1 && (
          <button className={pageBtn(1, false)} onClick={() => onPage(1)}>
            1
          </button>
        )}
        {from > 2 && <span className="text-[12px] text-slate-text/40 px-0.5">…</span>}
        {numbers.map((n) => (
          <button key={n} className={pageBtn(n, n === page)} onClick={() => onPage(n)}>
            {n}
          </button>
        ))}
        {to < pages - 1 && <span className="text-[12px] text-slate-text/40 px-0.5">…</span>}
        {to < pages && (
          <button className={pageBtn(pages, false)} onClick={() => onPage(pages)}>
            {pages}
          </button>
        )}
        <button className={nav} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}