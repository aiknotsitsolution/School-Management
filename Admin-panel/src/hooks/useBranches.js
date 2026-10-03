import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

/**
 * Campus (branch) options for the pickers on Users, Teachers & Staff and the
 * admission form.
 *
 * `/branches/mine` is the endpoint every signed-in role may call — unlike
 * `/branches` it needs no `branches:read` permission — so a teacher opening a
 * form is not turned away, and the list is already sorted head-office first.
 */
export function useBranches() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.branches
      .mine()
      .then((res) => {
        if (!cancelled) setBranches(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolves a stored branchId to its campus name; null means the account or
  // record is school-wide rather than missing from the list.
  const nameOf = useCallback(
    (id) => branches.find((b) => String(b._id) === String(id))?.name || null,
    [branches],
  );

  return { branches, loading, nameOf };
}
