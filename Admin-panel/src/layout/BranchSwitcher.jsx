import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Building2, Check, ChevronDown, Star } from "lucide-react";
import { api } from "../lib/api";
import { setActiveBranchId } from "../store/authSlice";

const ALL = "all";

/**
 * Campus switcher for the top bar.
 *
 * Shown to the school admin only. The platform owner is platform-scope and has
 * no tenant of its own, so it has neither a school switcher nor a branch one —
 * see Topbar.jsx.
 *
 * Hidden unless the school actually has more than one branch, so a
 * single-campus school never sees a control that would do nothing. The head
 * office is listed first and tagged "Default" (the backend already sorts it
 * that way); admins also get an "All branches" entry, which is the school-wide
 * unfiltered view.
 *
 * The selection is persisted (redux + localStorage) and picked up by lib/api,
 * which sends it as X-Branch-Id on every request, so the moment another campus
 * is picked every list on screen is scoped to it.
 */
export default function BranchSwitcher() {
  const dispatch = useDispatch();
  const role = useSelector((s) => s.auth?.user?.role);
  const userBranchId = useSelector((s) => s.auth?.user?.branchId);
  const activeBranchId = useSelector((s) => s.auth?.activeBranchId);

  const [branches, setBranches] = useState([]);
  const [open, setOpen] = useState(false);
  // Starts true: the list is fetched once on mount, so there is no moment where
  // "not loading" would wrongly mean "no branches".
  const [loading, setLoading] = useState(true);
  const ref = useRef(null);

  // Mirrors canViewAllBranches() in the shared branch middleware: a school_admin
  // that is not assigned to a campus. A campus-assigned admin is pinned
  // server-side (the API answers 403 for "all" and for any other campus), so
  // offering those entries here would only produce broken requests.
  const isAdmin = role === "school_admin" || role === "admin";
  const canViewAll = isAdmin && !userBranchId;
  // A pinned admin may only ever see their own campus, so there is nothing to switch.
  const pinnedToBranch = Boolean(userBranchId);

  // Campus switching is a school-admin tool. The platform owner is filtered out
  // before any fetch happens, so it never issues the branches request.
  const showForRole = isAdmin;

  useEffect(() => {
    if (!showForRole) return undefined;
    let cancelled = false;
    api.branches
      .mine()
      .then((res) => {
        if (cancelled) return;
        const list = res.data || [];
        setBranches(list);
        // A stale selection (branch deleted, or switched school) is dropped
        // rather than left to 400 on every subsequent request.
        const stored = localStorage.getItem("erp_active_branch");
        if (stored) {
          const stillThere = list.some((b) => String(b._id) === String(stored));
          if (!stillThere) {
            localStorage.removeItem("erp_active_branch");
            dispatch(setActiveBranchId(null));
          }
        }
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
  }, [dispatch, showForRole]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = useCallback(
    (id) => {
      dispatch(setActiveBranchId(id === ALL ? null : id));
      setOpen(false);
      // A branch switch changes every list on screen, so a reload is the
      // honest way to avoid showing one campus's rows under another's totals.
      window.location.reload();
    },
    [dispatch],
  );

  // Wrong role, one campus, or a pinned admin locked to their own campus — in
  // every case there is nothing to switch between.
  if (!showForRole || loading || branches.length < 2 || pinnedToBranch) return null;

  const current = branches.find((b) => String(b._id) === String(activeBranchId));
  const label = current ? current.name : "All branches";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        {current?.isHeadOffice ? (
          <Star size={14} className="text-amber-500" />
        ) : (
          <Building2 size={14} className="text-slate-400" />
        )}
        <span className="max-w-[9rem] truncate">{label}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-1 w-60 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {canViewAll && (
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!activeBranchId}
                onClick={() => choose(ALL)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <Building2 size={14} className="text-slate-400" />
                <span className="flex-1">All branches</span>
                {!activeBranchId && <Check size={14} className="text-emerald-500" />}
              </button>
            </li>
          )}
          {branches.map((b) => (
            <li key={b._id}>
              <button
                type="button"
                role="option"
                aria-selected={String(activeBranchId) === String(b._id)}
                onClick={() => choose(b._id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                {b.isHeadOffice ? (
                  <Star size={14} className="shrink-0 text-amber-500" />
                ) : (
                  <Building2 size={14} className="shrink-0 text-slate-400" />
                )}
                <span className="flex-1 truncate">{b.name}</span>
                {b.isHeadOffice && (
                  <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                    Default
                  </span>
                )}
                {String(activeBranchId) === String(b._id) && (
                  <Check size={14} className="shrink-0 text-emerald-500" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
