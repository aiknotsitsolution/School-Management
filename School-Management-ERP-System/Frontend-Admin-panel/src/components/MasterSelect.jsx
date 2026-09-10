import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, ChevronDown, AlertTriangle, X } from "lucide-react";
import { api } from "../lib/api";
import { getMasterCache, setMasterCache } from "../lib/masterCache";

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
  className = "",
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
    const next = !open;
    if (next) {
      if (!getMasterCache(kind)) load();
      else setItems(getMasterCache(kind));
    }
    setOpen(next);
  };

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = useMemo(
    () => items.find((i) => String(i._id) === String(value)),
    [items, value],
  );

  const baseItems = filterItems ? filterItems(items) : items;

  const filtered = useMemo(() => {
    const q = normalizeLabel(query);
    if (!q) return baseItems;
    return baseItems.filter((i) => normalizeLabel(renderLabel(i)).includes(q));
  }, [baseItems, query, renderLabel]);

  const select = (item) => {
    onChange(String(item._id), item);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-black/10 text-[13px] outline-none focus:border-ink/40 bg-white text-left"
      >
        <span className={selected ? "text-ink" : "text-slate-text/60"}>
          {selected ? renderLabel(selected) : fallbackLabel || placeholder}
        </span>
        <ChevronDown size={15} className="text-slate-text/50 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white rounded-xl border border-black/10 shadow-lg overflow-hidden">
          {/* Search box */}
          <div className="p-2 border-b border-black/[0.06] relative">
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
              className="w-full pl-8 pr-7 py-2 rounded-lg border border-black/10 text-[13px] outline-none focus:border-ink/40 bg-paper/50 placeholder:text-slate-text/50"
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
          <div className="max-h-56 overflow-y-auto">
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
            ) : filtered.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-[13px] text-slate-text">
                  {query ? `No subjects found for "${query}"` : emptyLabel}
                </p>
              </div>
            ) : (
              filtered.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => select(item)}
                  className={`w-full text-left px-4 py-2 text-[13px] hover:bg-paper transition-colors ${
                    selected && String(selected._id) === String(item._id)
                      ? "bg-amber/10 text-ink font-medium"
                      : "text-ink"
                  }`}
                >
                  {renderLabel(item)}
                </button>
              ))
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
              className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-amber-dark border-t border-black/[0.06] hover:bg-amber/5 transition-colors"
            >
              <Plus size={14} /> Add Custom {label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}