import { useEffect, useState } from "react";
import { ShieldCheck, Search } from "lucide-react";
import { api } from "../../lib/api";
import { Card, Input, PageIntro, Pill, Select, toast } from "../../components/UI";

const ACTION_CLASSES = {
  login: "bg-blue-100 text-blue-800",
  logout: "bg-slate-100 text-slate-600",
  "user.created": "bg-emerald-100 text-emerald-800",
  "user.updated": "bg-teal-100 text-teal-800",
  "user.deactivated": "bg-amber-100 text-amber-800",
  "user.soft_deleted": "bg-red-100 text-red-800",
  "user.restored": "bg-emerald-100 text-emerald-800",
  "school.created": "bg-emerald-100 text-emerald-800",
  "school.updated": "bg-teal-100 text-teal-800",
  "school.suspended": "bg-red-100 text-red-800",
  "school.activated": "bg-emerald-100 text-emerald-800",
  "school.deactivated": "bg-amber-100 text-amber-800",
  "school.reactivated": "bg-emerald-100 text-emerald-800",
  "plan.created": "bg-indigo-100 text-indigo-800",
  "plan.updated": "bg-indigo-100 text-indigo-800",
  "plan.deactivated": "bg-amber-100 text-amber-800",
  "plan.archived": "bg-slate-100 text-slate-600",
  "subscription.created": "bg-indigo-100 text-indigo-800",
  "subscription.changed": "bg-indigo-100 text-indigo-800",
  "subscription.suspended": "bg-red-100 text-red-800",
  "subscription.reactivated": "bg-emerald-100 text-emerald-800",
  "subscription.cancelled": "bg-amber-100 text-amber-800",
  "invoice.generated": "bg-purple-100 text-purple-800",
  "invoice.updated": "bg-purple-100 text-purple-800",
  "report.generated": "bg-cyan-100 text-cyan-800",
  "settings.changed": "bg-slate-100 text-slate-700",
};

const fmtDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export default function AuditLogs() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ actorEmail: "", action: "", targetType: "", result: "" });

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.actorEmail) params.set("actorEmail", filters.actorEmail);
    if (filters.action) params.set("action", filters.action);
    if (filters.targetType) params.set("targetType", filters.targetType);
    if (filters.result) params.set("result", filters.result);
    params.set("page", String(page));
    setLoading(true);
    api.platform
      .auditLogs(params.toString())
      .then(({ data, total: t, pages: p }) => {
        setRows(data || []);
        setTotal(t ?? 0);
        setPages(p ?? 0);
      })
      .catch((err) => toast(err.message, "error"))
      .finally(() => setLoading(false));
  }, [filters, page]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  return (
    <div className="max-w-6xl">
      <PageIntro
        eyebrow="Platform Owner · System"
        title="Audit Logs"
        description="Immutable, append-only trail of sensitive platform actions. Every entry records who did what, to which entity, and the outcome. Secrets are never stored."
      />

      <Card className="mb-5" bodyClassName="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/50" />
            <Input
              placeholder="Filter by actor email…"
              className="pl-9"
              value={filters.actorEmail}
              onChange={(e) => updateFilter("actorEmail", e.target.value)}
            />
          </div>
          <Select className="w-44" value={filters.action} onChange={(e) => updateFilter("action", e.target.value)}>
            <option value="">All actions</option>
            {Object.keys(ACTION_CLASSES).map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </Select>
          <Select className="w-40" value={filters.targetType} onChange={(e) => updateFilter("targetType", e.target.value)}>
            <option value="">All targets</option>
            <option value="school">School</option>
            <option value="user">User</option>
            <option value="plan">Plan</option>
            <option value="subscription">Subscription</option>
            <option value="invoice">Invoice</option>
            <option value="report">Report</option>
            <option value="setting">Setting</option>
          </Select>
          <Select className="w-32" value={filters.result} onChange={(e) => updateFilter("result", e.target.value)}>
            <option value="">All results</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </Select>
          <span className="ml-auto text-[12px] text-slate-text/60">{total} entries</span>
        </div>
      </Card>

      <Card bodyClassName="p-0">
        {loading ? (
          <p className="p-8 text-center text-[13px] text-slate-text/70">Loading audit trail…</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-[13px] text-slate-text/70">
            <ShieldCheck size={18} className="inline mr-1.5 -mt-0.5" />
            No audit entries match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="bg-paper">
                <tr className="border-b border-black/[0.06] text-[11px] uppercase tracking-wide text-slate-text">
                  <th className="py-2.5 px-4 font-semibold">When</th>
                  <th className="py-2.5 px-4 font-semibold">Actor</th>
                  <th className="py-2.5 px-4 font-semibold">Action</th>
                  <th className="py-2.5 px-4 font-semibold">Target</th>
                  <th className="py-2.5 px-4 font-semibold">Result</th>
                  <th className="py-2.5 px-4 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {rows.map((row) => (
                  <tr key={row._id} className="hover:bg-paper/60 align-top">
                    <td className="py-2.5 px-4 whitespace-nowrap text-slate-text">{fmtDate(row.createdAt)}</td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <p className="font-medium text-ink">{row.actorEmail || "system"}</p>
                      {row.actorRole && <p className="text-[11px] text-slate-text/60">{row.actorRole}</p>}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <Pill className={ACTION_CLASSES[row.action] || "bg-slate-100 text-slate-600"}>{row.action}</Pill>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap text-slate-text">
                      {row.targetType || "—"}
                      {row.targetId ? <span className="text-[11px] text-slate-text/50 block">{String(row.targetId).slice(0, 8)}</span> : null}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <Pill className={row.result === "failure" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}>
                        {row.result}
                      </Pill>
                    </td>
                    <td className="py-2.5 px-4">
                      <p className="text-slate-text">{row.message || "—"}</p>
                      {row.reason && <p className="text-[11.5px] text-slate-text/60 mt-0.5">Reason: {row.reason}</p>}
                      {row.context?.ip && <p className="text-[10.5px] text-slate-text/50 mt-0.5">IP {row.context.ip}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-black/[0.06]">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="text-[12.5px] font-semibold text-slate-text disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="text-[12px] text-slate-text/60">Page {page} of {pages}</span>
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="text-[12.5px] font-semibold text-slate-text disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
