import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageIntro, Card, Pill, StatCard } from "../../components/UI";
import { api } from "../../lib/api";
import useStudentContext from "./useStudentContext";

const TYPE_TONES = {
  incident: "alert", positive: "success", warning: "amber",
  detention: "alert", suspension: "alert", other: "neutral",
};

const SEV_TONES = { low: "info", medium: "amber", high: "alert", critical: "alert" };

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function StudentBehavior() {
  const { user } = useStudentContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.behavior.list("limit=200")
      .then(({ data }) => {
        const all = Array.isArray(data) ? data : data?.data || [];
        setItems(all.filter((r) => r.studentId === user?._id));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?._id]);

  const counts = useMemo(() => {
    const c = { total: items.length, positive: 0, incident: 0, warning: 0 };
    items.forEach((r) => {
      if (r.type === "positive") c.positive++;
      else if (r.type === "incident") c.incident++;
      else if (r.type === "warning") c.warning++;
    });
    return c;
  }, [items]);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="My Profile"
        title="My Behavior Log"
        description="View your conduct records and behavioral notes."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ShieldAlert} label="Total Records" value={String(counts.total)} sub="All records" accent="info" />
        <StatCard icon={CheckCircle2} label="Positive" value={String(counts.positive)} sub="Good conduct" accent="success" />
        <StatCard icon={AlertTriangle} label="Incidents" value={String(counts.incident)} sub="Incidents" accent="alert" />
        <StatCard icon={ShieldAlert} label="Warnings" value={String(counts.warning)} sub="Warnings" accent="amber" />
      </div>

      <Card title="Behavior Records">
        {loading ? (
          <div className="py-14 text-center text-[13px] text-slate-text/60">Loading...</div>
        ) : items.length === 0 ? (
          <div className="py-14 text-center text-[13px] text-slate-text/60">No behavior records found.</div>
        ) : (
          <div className="space-y-3">
            {items.map((r) => (
              <div key={r._id} className="p-3 rounded-xl bg-paper/60 hover:bg-paper transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink">{r.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Pill tone={TYPE_TONES[r.type] || "neutral"}>{r.type}</Pill>
                      <Pill tone={SEV_TONES[r.severity] || "neutral"}>{r.severity}</Pill>
                      <span className="text-[11px] text-slate-text/60">{fmtDate(r.date)}</span>
                    </div>
                    {r.description && <p className="text-[12px] text-slate-text/70 mt-1.5">{r.description}</p>}
                    {r.actionTaken && <p className="text-[12px] text-slate-text/60 mt-1"><strong>Action:</strong> {r.actionTaken}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
