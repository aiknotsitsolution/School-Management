import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarDays } from "lucide-react";
import { PageIntro, Card, Pill } from "../../components/UI";
import { api } from "../../lib/api";
import { fmtDate, dateOf } from "./useStudentContext";

const POLICY = { Present: "success", Absent: "alert", Leave: "info", "Half Day": "amber" };

export default function Attendance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => dateOf(new Date()).slice(0, 7));

  const refresh = () => {
    setLoading(true);
    api.attendance
      .list()
      .then(({ data }) => setRecords(data || []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const summary = useMemo(() => {
    const m = { Present: 0, Absent: 0, Leave: 0, "Half Day": 0 };
    records.forEach((r) => { if (m[r.status] !== undefined) m[r.status] += 1; });
    const counted = m.Present + m["Half Day"];
    const total = records.length;
    return { ...m, total, pct: total ? Math.round((counted / total) * 100) : 0 };
  }, [records]);

  const monthRecords = useMemo(
    () => [...records].filter((r) => dateOf(r.date).startsWith(month)).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [records, month],
  );

  const months = useMemo(() => {
    const set = new Set(records.map((r) => dateOf(r.date).slice(0, 7)).filter(Boolean));
    return [...set].sort().reverse();
  }, [records]);

  return (
    <div className="space-y-6">
      <PageIntro eyebrow="Academics" title="My Attendance" description="Your attendance record for this session." />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="col-span-2 lg:col-span-1">
            <p className="font-display text-3xl font-bold text-ink">{summary.pct}%</p>
            <p className="text-[11px] text-slate-text/60 mt-1">Overall attendance</p>
          </Card>
        <Card><p className="font-display text-xl font-bold text-success">{summary.Present}</p><p className="text-[11px] text-slate-text/60 mt-1">Present</p></Card>
        <Card><p className="font-display text-xl font-bold text-alert">{summary.Absent}</p><p className="text-[11px] text-slate-text/60 mt-1">Absent</p></Card>
        <Card><p className="font-display text-xl font-bold text-info">{summary.Leave}</p><p className="text-[11px] text-slate-text/60 mt-1">Leave</p></Card>
        <Card><p className="font-display text-xl font-bold text-amber-dark">{summary["Half Day"]}</p><p className="text-[11px] text-slate-text/60 mt-1">Half Day</p></Card>
      </div>

      <Card
        title={`Attendance History (${monthRecords.length})`}
        action={
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-paper border border-black/10 rounded-lg px-2.5 py-1.5 text-[12px] text-ink outline-none"
          >
            {(months.length ? months : [month]).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        }
      >
        {loading ? (
          <p className="text-[13px] text-slate-text py-10 text-center">Loading…</p>
        ) : records.length === 0 ? (
          <div className="py-10 text-center">
            <CalendarCheck size={40} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[15px] font-semibold text-ink">No attendance records available</p>
            <p className="text-[13px] text-slate-text/70 mt-1">Records will appear here once the school marks them.</p>
          </div>
        ) : monthRecords.length === 0 ? (
          <p className="text-[13px] text-slate-text py-10 text-center">No records for the selected month.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                  <th className="px-5 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {monthRecords.map((r) => (
                  <tr key={r._id} className="border-t border-black/[0.06]">
                    <td className="px-5 py-2.5 font-medium text-ink">{fmtDate(r.date)}</td>
                    <td className="px-3 py-2.5"><Pill tone={POLICY[r.status] || "neutral"}>{r.status}</Pill></td>
                    <td className="px-3 py-2.5 text-slate-text/70">{r.remarks || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <p className="text-[12.5px] text-slate-text/80 flex items-center gap-2">
          <CalendarDays size={14} className="text-slate-text/50" />
          Attendance is recorded by school staff. You can view your record but cannot change it.
        </p>
      </Card>
    </div>
  );
}