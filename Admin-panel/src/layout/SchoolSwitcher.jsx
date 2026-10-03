import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Building2, Check, ChevronDown, Eye, PenLine, X } from "lucide-react";
import { api } from "../lib/api";
import {
  setActiveSchoolId,
  setImpersonateReadOnly,
} from "../store/authSlice";

/**
 * Tenant switcher for the platform owner (super_admin).
 *
 * The backend has always supported a super_admin operating inside one tenant:
 * it reads the school from the X-School-Id header (see
 * shared/src/middleware/tenant.js) rather than from the JWT, because a platform
 * token is not bound to any school. What was missing was a way to choose the
 * school — until one is chosen there is no tenant context at all, so
 * canSeeNavigation keeps every school module hidden and the school APIs would
 * answer "no school context".
 *
 * Writes stay blocked while impersonating (see impersonateReadOnly) and the
 * control to lift that lives here too, next to the tenant it applies to —
 * rather than as a stray toggle somewhere else in the UI.
 *
 * Soft-deleted and suspended schools are excluded: impersonating a suspended
 * tenant is not a support task, and deleted rows are excluded from every list
 * endpoint by design.
 */
export default function SchoolSwitcher() {
  const dispatch = useDispatch();
  const role = useSelector((s) => s.auth?.user?.role);
  const activeSchoolId = useSelector((s) => s.auth?.activeSchoolId);
  const readOnly = useSelector((s) => s.auth?.impersonateReadOnly);

  const [schools, setSchools] = useState([]);
  const [open, setOpen] = useState(false);
  // Starts true: the list is fetched once on mount, so there is no moment where
  // "not loading" would wrongly mean "no schools".
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const ref = useRef(null);

  const isPlatformOwner = role === "super_admin";

  useEffect(() => {
    if (!isPlatformOwner) return undefined;
    let cancelled = false;
    api.platform.schools
      .list("limit=200")
      .then((res) => {
        if (cancelled) return;
        setSchools(res.data || []);
        // A stale selection (school deleted since it was stored) is dropped
        // rather than left to 400 on every subsequent request.
        const stored = localStorage.getItem("erp_active_school");
        if (stored && !(res.data || []).some((s) => String(s._id) === String(stored))) {
          localStorage.removeItem("erp_active_school");
          dispatch(setActiveSchoolId(null));
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch, isPlatformOwner]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
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

  // Fire-and-forget: the trail is best-effort and must never block or fail the
  // tenant switch itself, mirroring the backend's "audit must never fail the
  // primary operation" rule.
  const audit = useCallback((action, schoolId) => {
    api.platform.recordImpersonation(action, schoolId || null).catch(() => {});
  }, []);

  const choose = useCallback(
    (id) => {
      const next = id ? String(id) : null;
      // Order matters: on the way out the header still carries the tenant being
      // left, on the way in it does not carry the incoming one yet — but the
      // endpoint takes the tenant from the body, so both report correctly.
      if (!next && activeSchoolId) audit("impersonation.ended", activeSchoolId);
      if (next) audit("impersonation.started", next);
      dispatch(setActiveSchoolId(next));
      setOpen(false);
    },
    [activeSchoolId, audit, dispatch],
  );

  const toggleEditing = useCallback(() => {
    dispatch(setImpersonateReadOnly(!readOnly));
    if (readOnly) audit("impersonation.write_enabled", activeSchoolId);
  }, [activeSchoolId, audit, dispatch, readOnly]);

  const selected = schools.find((s) => String(s._id) === String(activeSchoolId));
  const name = selected?.name || activeSchoolId || "No school selected";

  if (!isPlatformOwner) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={loading}
          className="flex items-center gap-2 rounded-full bg-paper border border-slate-200 pl-3 pr-2 py-1.5 text-[12.5px] font-medium text-ink hover:bg-primary/10 transition-colors disabled:opacity-60"
          title={
            activeSchoolId
              ? "Operating inside this tenant — click to change"
              : "Select a school to operate inside its ERP"
          }
        >
          <Building2 size={15} className="text-primary-dark shrink-0" />
          <span className="max-w-[180px] truncate">{loading ? "Loading schools…" : name}</span>
          <ChevronDown size={14} className="text-slate-text/60 shrink-0" />
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl z-50 scrollbar-thin">
            <div className="px-3 py-2 border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
              Operating as
            </div>
            <button
              type="button"
              onClick={() => choose(null)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] hover:bg-primary/5"
            >
              <span className="text-slate-text/70">Platform (no tenant)</span>
              {!activeSchoolId && <Check size={15} className="text-primary shrink-0" />}
            </button>
            {failed && (
              <div className="px-3 py-2.5 text-[12px] text-red-600">
                Could not load schools.
              </div>
            )}
            {schools.map((s) => (
              <button
                key={s._id}
                type="button"
                onClick={() => choose(s._id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] hover:bg-primary/5 border-t border-gray-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-ink font-medium">{s.name}</span>
                  <span className="block text-[11px] text-slate-text/60">
                    {s.code}
                    {s.status && ` · ${s.status}`}
                  </span>
                </span>
                {String(s._id) === String(activeSchoolId) && (
                  <Check size={15} className="text-primary shrink-0" />
                )}
              </button>
            ))}
            {!failed && !loading && !schools.length && (
              <div className="px-3 py-2.5 text-[12px] text-slate-text/60">
                No schools available.
              </div>
            )}
          </div>
        )}
      </div>

      {activeSchoolId && (
        <>
          <span
            className={`hidden xl:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              readOnly
                ? "bg-amber-50 text-amber-800 border border-amber-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
            title={
              readOnly
                ? "Read-only: writes are blocked by the server for this session"
                : "Editing enabled — write requests are being accepted for this tenant"
            }
          >
            {readOnly ? <Eye size={12} /> : <PenLine size={12} />}
            {readOnly ? "Read-only" : "Editing on"}
          </span>
          <button
            type="button"
            onClick={toggleEditing}
            className="hidden md:inline-flex items-center rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-text hover:bg-primary/10 transition-colors"
          >
            {readOnly ? "Enable editing" : "Stop editing"}
          </button>
          <button
            type="button"
            onClick={() => choose(null)}
            className="inline-flex items-center rounded-full border border-slate-200 p-1.5 text-slate-text hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Leave this tenant and return to the platform console"
            aria-label="Leave tenant"
          >
            <X size={13} />
          </button>
        </>
      )}
    </div>
  );
}
