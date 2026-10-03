/** Compact icon + label + value row. Generic so dashboards can feed it either
 *  real status items or feature statements. */
export default function ValueStrip({ items = [], className = "" }) {
  if (!items.length) return null;
  return (
    <ul
      className={`grid grid-cols-1 gap-3 sm:grid-cols-3 ${className}`}
      aria-label="Highlights"
    >
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <li
            key={it.label}
            className="group flex items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3 transition-colors hover:border-primary/35 hover:bg-primary/[0.03]"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `${it.color || "#0C47CF"}14`, color: it.color || "#0C47CF" }}
              aria-hidden="true"
            >
              {Icon ? <Icon size={17} strokeWidth={2} /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold uppercase tracking-wide text-slate-text/70">
                {it.label}
              </p>
              <p className="truncate text-[14px] font-bold text-ink">{it.value}</p>
            </div>
            {it.sub ? (
              <span className="shrink-0 rounded-full bg-ink/5 px-2 py-1 text-[11px] font-semibold text-slate-text">
                {it.sub}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
