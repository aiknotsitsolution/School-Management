import { useEffect, useRef, useState } from "react";
import { Search, Plus, ChevronDown, X } from "lucide-react";

/**
 * Lightweight searchable dropdown for string arrays.
 * Drop-in replacement for <Select> when you need search, scroll, and optional
 * "+ Add Custom" functionality.
 */
export default function SearchableSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Select...",
  onAdd,
  addLabel,
  renderLabel,
  disabled = false,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const displayLabel = (opt) => (renderLabel ? renderLabel(opt) : opt);

  const filtered = query
    ? options.filter((o) =>
        displayLabel(o).toLowerCase().includes(query.toLowerCase()),
      )
    : options;

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

  const toggle = () => {
    if (disabled) return;
    setOpen((prev) => !prev);
    if (!open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const select = (opt) => {
    onChange(opt);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-black/10 text-[13.5px] outline-none bg-white text-left transition-all ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-slate-50"
            : "hover:border-black/20 focus:border-amber focus:ring-4 focus:ring-amber/15"
        }`}
      >
        <span className={value ? "text-ink" : "text-slate-text/60 truncate"}>
          {value ? displayLabel(value) : placeholder}
        </span>
        <ChevronDown size={15} className="text-slate-text/50 shrink-0 ml-1" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white rounded-xl border border-black/10 shadow-lg overflow-hidden">
          <div className="p-2 border-b border-black/[0.06] relative">
            <Search
              size={14}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-text/40"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-8 pr-7 py-2 rounded-xl border border-black/10 text-[13px] outline-none focus:border-amber focus:ring-4 focus:ring-amber/15 bg-paper/50 placeholder:text-slate-text/50"
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
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-4 text-center text-[13px] text-slate-text/60">
                {query ? `No results for "${query}"` : "No options"}
              </div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => select(opt)}
                  className={`w-full text-left px-4 py-2 text-[13px] hover:bg-paper transition-colors ${
                    value === opt
                      ? "bg-amber/10 text-ink font-medium"
                      : "text-ink"
                  }`}
                >
                  {displayLabel(opt)}
                </button>
              ))
            )}
          </div>
          {onAdd && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAdd();
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-amber-dark border-t border-black/[0.06] hover:bg-amber/5 transition-colors"
            >
              <Plus size={14} />
              {addLabel || "Add Custom"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
