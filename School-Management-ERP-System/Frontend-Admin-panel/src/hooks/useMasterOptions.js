import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { getMasterCache, setMasterCache } from "../lib/masterCache";

/**
 * Master-driven options for class/section/subject dropdowns.
 *
 * Returns the master catalog values as strings (the shape the legacy forms
 * already consume). FAIL-OPEN: when the masters are unavailable, the fetch
 * errors, or the catalog is empty, it returns `fallback` (the legacy hardcoded
 * list) so every existing form keeps working for schools that have not adopted
 * the master catalogs yet.
 */
export function useMasterOptions(kind, fallback = []) {
  const [options, setOptions] = useState(fallback);
  const [rawItems, setRawItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cached = getMasterCache(kind);
    if (cached) {
      setRawItems(cached);
      setOptions(cached.length ? cached.map((m) => m.name) : fallback);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    api.examMasters
      .list(kind)
      .then(({ data }) => {
        const rows = data || [];
        setMasterCache(kind, rows);
        if (cancelled) return;
        setRawItems(rows);
        setOptions(rows.length ? rows.map((m) => m.name) : fallback);
      })
      .catch(() => {
        if (cancelled) return;
        setOptions(fallback);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  return { options, rawItems, loading };
}