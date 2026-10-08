import { useMemo, useRef, useState } from "react";
import { Search, Plus, ChevronDown, AlertTriangle, X } from "lucide-react";
import { api } from "../lib/api";
import { getMasterCache, setMasterCache } from "../lib/masterCache";
import PopoverPanel from "./PopoverPanel";

function normalizeLabel(label) {
  return label.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Searchable, master-backed dropdown.
 *
 * Fetches a master list from /api/exam-masters/:kind (tenant scoped server-side)
 * and renders it as a searchable popover with a fixed max height and internal
 * scroll. Supports an optional "Add Custom ..." row that is always accessible.
 *
 * Loads the list once and caches it across opens (per kind) to avoid repeated
 * API calls when the same form is opened repeatedly.
 */

export default function MasterSelect({
  kind,
  value, // currently selected _id (or "" for none)
  onChange,
  placeholder = "Select...",
  label,
  emptyLabel = "No options available",
  searchLabel = "Search...",
  canAdd = false,
  onAdd = null,
  renderLabel = (item) => item.name,
  fallbackLabel = "",
  filterItems = null,
  // Rows appended after the master list — for values that are intentionally not
  // masters (e.g. Break/Lunch timetable slots). null keeps behaviour as-is.
  extraItems = null,
  extraItemsLabel = "More",
  className = "",
  disabled = false,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);

  const load = (force = false) => {
    const cached = getMasterCache(kind);
    if (cached && !force) {
      setItems(cached);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setItems([]);
    api.examMasters
      .list(kind)
      .then(({ data }) => {
        const rows = data || [];
        setMasterCache(kind, rows);
        setItems(rows);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  const toggle = () => {
    if (disabled) return;
    const next = !open;
    if (next) {
      if (!getMasterCache(kind)) load();
      else setItems(getMasterCache(kind));
    }
    setOpen(next);
  };

  // Outside-click / Escape dismissal lives in PopoverPanel: the panel is
  // portalled to <body>, so clicks on it no longer land inside rootRef.

  const selected = useMemo(() => {
    const pool =
      extraItems && extraItems.length ? [...items, ...extraItems] : items;
    const byId = pool.find((i) => String(i._id) === String(value));
    if (byId) return byId;
    // Stored records do not always carry the master id back, so fall back to the
    // label the caller already holds — the highlighted row then always matches
    // the text the trigger is showing.
    if (!value && fallbackLabel) {
      return pool.find((i) => renderLabel(i) === fallbackLabel) || null;
    }
    return null;
  }, [items, extraItems, value, fallbackLabel, renderLabel]);

  const baseItems = filterItems ? filterItems(items) : items;

  const filtered = useMemo(() => {
    const q = normalizeLabel(query);
    if (!q) return baseItems;
    return baseItems.filter((i) => normalizeLabel(renderLabel(i)).includes(q));
  }, [baseItems, query, renderLabel]);

  const extraVisible = useMemo(() => {
    if (!extraItems || !extraItems.length) return [];
    const q = normalizeLabel(query);
    if (!q) return extraItems;
    return extraItems.filter((i) => normalizeLabel(renderLabel(i)).includes(q));
  }, [extraItems, query, renderLabel]);

  const select = (item) => {
    onChange(String(item._id), item);
    setOpen(false);
    setQuery("");
  };

  const rowClass = (item) =>
    `w-full text-left px-4 py-2 text-[13px] hover:bg-paper transition-colors ${
      selected && String(selected._id) === String(item._id)
        ? "bg-primary/10 text-ink font-medium"
        : "text-ink"
    }`;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-slate-300 text-[13px] outline-none focus:border-primary bg-white text-left ${
          disabled ? "cursor-not-allowed opacity-50" : ""
        }`}
      >
        <span className={selected ? "text-ink" : "text-slate-text/60"}>
          {selected ? renderLabel(selected) : fallbackLabel || placeholder}
        </span>
        <ChevronDown size={15} className="text-slate-text/50 shrink-0" />
      </button>

      <PopoverPanel open={open} anchorRef={rootRef} onClose={() => setOpen(false)}>
          {/* Search box */}
          <div className="p-2 border-b border-slate-200 relative">
            <Search
              size={14}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-text/40"
            />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchLabel}
              className="w-full pl-8 pr-7 py-2 rounded-lg border border-slate-300 text-[13px] outline-none focus:border-primary bg-paper/50 placeholder:text-slate-text/50"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-text/40 hover:text-ink"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-3 text-[13px] text-slate-text/70">
                Loading {label.toLowerCase()}...
              </div>
            ) : error ? (
              <div className="px-4 py-3 text-center">
                <AlertTriangle
                  size={20}
                  className="mx-auto text-alert/70 mb-1"
                />
                <p className="text-[13px] text-slate-text">
                  Unable to load {label.toLowerCase()}s.
                </p>
                <button
                  type="button"
                  onClick={() => load(true)}
                  className="mt-2 text-[12.5px] font-semibold text-info hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : filtered.length === 0 && extraVisible.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-[13px] text-slate-text">
                  {query ? `No subjects found for "${query}"` : emptyLabel}
                </p>
              </div>
            ) : (
              <>
                {filtered.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => select(item)}
                    className={rowClass(item)}
                  >
                    {renderLabel(item)}
                  </button>
                ))}
                {extraVisible.length > 0 && (
                  <div className="mt-1 border-t border-slate-200 px-4 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-text/50">
                    {extraItemsLabel}
                  </div>
                )}
                {extraVisible.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => select(item)}
                    className={rowClass(item)}
                  >
                    {renderLabel(item)}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Footer: add custom row (always accessible) */}
          {canAdd && onAdd && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAdd();
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-primary-dark border-t border-slate-200 hover:bg-primary/5 transition-colors"
            >
              <Plus size={14} /> Add Custom {label}
            </button>
          )}
      </PopoverPanel>
    </div>
  );
}