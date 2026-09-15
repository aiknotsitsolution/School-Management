import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "./UI";

export default function SearchableDropdown({
  category,
  label,
  value,
  onChange,
  placeholder = "Type to search…",
}) {
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const load = () => {
    api.platform.referenceData
      .list(category)
      .then(({ data }) => setOptions(data || []))
      .catch(() => {});
  };

  useEffect(() => { load(); }, [category]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(query.toLowerCase())
  );

  const exactMatch = options.some(
    (o) => o.toLowerCase() === (query || value || "").toLowerCase()
  );

  const handleAdd = async () => {
    const val = query.trim();
    if (!val) return;
    setAdding(true);
    try {
      await api.platform.referenceData.add(category, val);
      toast(`Added "${val}"`);
      setQuery("");
      load();
      onChange(val);
      setOpen(false);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-text/60 mb-1">
        {label}
      </label>
      <div
        className="flex items-center border border-black/10 rounded-lg bg-white hover:border-ink/30 transition-colors cursor-text"
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        <input
          ref={inputRef}
          type="text"
          className="flex-1 px-3 py-2 text-[13px] bg-transparent outline-none min-w-0"
          placeholder={value || placeholder}
          value={open ? query : value || ""}
          onFocus={() => setOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="px-2 text-slate-text/50 hover:text-ink"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-black/10 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`w-full text-left px-3 py-2 text-[13px] hover:bg-amber/10 transition-colors ${
                  opt === value ? "bg-amber/15 font-semibold text-ink" : "text-ink"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt);
                  setQuery("");
                  setOpen(false);
                }}
              >
                {opt}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-[12px] text-slate-text/50">No matches</div>
          )}

          {query.trim() && !exactMatch && (
            <button
              type="button"
              disabled={adding}
              onMouseDown={(e) => { e.preventDefault(); handleAdd(); }}
              className="w-full text-left px-3 py-2 text-[13px] font-semibold text-amber-dark bg-amber/10 border-t border-black/[0.06] hover:bg-amber/20 transition-colors flex items-center gap-2"
            >
              <Plus size={13} />
              {adding ? "Adding…" : `Add "${query.trim()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
