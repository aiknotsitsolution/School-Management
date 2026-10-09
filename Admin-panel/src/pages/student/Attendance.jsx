import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { PageIntro, Card, Pill, Select, toast } from "../../components/UI";
import PageArtwork from "../../components/PageArtwork";
import {
  TrendArea,
  BarRowChart,
  Donut,
  ProgressRing,
} from "../../components/studentcharts/StudentCharts";
import { ATT_ORDER, ATT_STATUS } from "../../components/studentcharts/theme";
import { api } from "../../lib/api";
import { fmtDate, dateOf } from "./useStudentContext";

const POLICY = { Present: "success", Absent: "alert", Leave: "info" };

export default function Attendance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => dateOf(new Date()).slice(0, 7));

  const refresh = () => {
    setLoading(true);
    api.attendance
      .list()
      .then(({ data }) => setRecords(data || []))
      .catch((error) => {
        toast(error.message || "Could not load attendance records", "error");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    const unsubscribe = api.attendanceStream.subscribe({
      onData: () => {
        if (document.visibilityState !== "visible") return;
        api.attendance
          .list()
          .then(({ data }) => setRecords(data || []))
          .catch((error) => toast(error.message || "Could not refresh attendance records", "error"));
      },
    });
    return unsubscribe;
  }, []);

  const summary = useMemo(() => {
    const m = { Present: 0, Absent: 0, Leave: 0 };
    records.forEach((r) => { if (m[r.status] !== undefined) m[r.status] += 1; });
    const counted = m.Present;
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

  /** Weekly attendance % across the whole session — the long-view trend. */
  const weeklyTrend = useMemo(() => {
    const weeks = new Map();
    records.forEach((r) => {
      const day = dateOf(r.date);
      if (!day) return;
      const d = new Date(day);
      if (Number.isNaN(d.getTime())) return;
      const monday = new Date(d);
      const shift = (d.getDay() + 6) % 7;
      monday.setDate(d.getDate() - shift);
      const key = monday.toISOString().slice(0, 10);
      if (!weeks.has(key)) weeks.set(key, { label: monday.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), hit: 0, total: 0 });
      const w = weeks.get(key);
      w.total += 1;
      if (r.status === "Present") w.hit += 1;
    });
    return [...weeks.values()]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((w) => ({ label: w.label, value: w.total ? Math.round((w.hit / w.total) * 100) : 0 }));
  }, [records]);

  /** Day-of-week breakdown, Monday first. */
  const weekdaySplit = useMemo(() => {
    const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const buckets = order.map((label) => ({ label, hit: 0, total: 0 }));
    records.forEach((r) => {
      const day = dateOf(r.date);
      if (!day) return;
      const d = new Date(day);
      if (Number.isNaN(d.getTime())) return;
      const idx = (d.getDay() + 6) % 7;
      buckets[idx].total += 1;
      if (r.status === "Present") buckets[idx].hit += 1;
    });
    return buckets
      .filter((b) => b.total > 0)
      .map((b) => ({ label: b.label, value: Math.round((b.hit / b.total) * 100), total: b.total }));
  }, [records]);

  const statusSplit = useMemo(
    () =>
      ATT_ORDER.filter((k) => summary[k] > 0).map((k) => ({
        name: ATT_STATUS[k].label,
        value: summary[k],
        color: ATT_STATUS[k].key,
      })),
    [summary],
  );

  return (
    <div className="space-y-6">
      <PageIntro eyebrow="Academics" title="My Attendance" art="attendance" description="Your attendance record for this session." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="flex flex-col items-center gap-3 py-2">
            <ProgressRing
              value={summary.pct}
              size={150}
              stroke={13}
              color="success"
              label="Attendance"
              sublabel={`${summary.total} records`}
              ariaLabel={`Overall attendance ${summary.pct} percent`}
            />
            <Donut data={statusSplit} height={132} centerValue={summary.total} centerLabel="Records" />
          </div>
        </Card>

        <Card className="lg:col-span-2" title="Weekly Trend" subtitle="Percentage of days attended, by week">
            <TrendArea
              data={weeklyTrend}
              height={188}
              color="success"
              tooltipLabel="Attendance"
              footerFor={(p) => `${p.hit} of ${p.total} days`}
            />
        </Card>
      </div>

      {weekdaySplit.length > 0 && (
        <Card title="Attendance by Day" subtitle="Which days you attend most reliably">
          <BarRowChart
            data={weekdaySplit}
            height={Math.max(150, weekdaySplit.length * 36)}
            color="info"
            colorFor={(d) => (d.value >= 85 ? "success" : d.value >= 60 ? "info" : "alert")}
            tooltipLabel="Attendance"
          />
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card><p className="font-display text-xl font-bold text-success">{summary.Present}</p><p className="text-[11px] text-slate-text/60 mt-1">Present</p></Card>
        <Card><p className="font-display text-xl font-bold text-alert">{summary.Absent}</p><p className="text-[11px] text-slate-text/60 mt-1">Absent</p></Card>
        <Card><p className="font-display text-xl font-bold text-info">{summary.Leave}</p><p className="text-[11px] text-slate-text/60 mt-1">Leave</p></Card>
      </div>

      <Card
        title={`Attendance History (${monthRecords.length})`}
        action={
          <Select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {(months.length ? months : [month]).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
        }
      >
        {loading ? (
          <p className="text-[13px] text-slate-text py-10 text-center">Loading…</p>
        ) : records.length === 0 ? (
          <div className="py-10 text-center">
            <PageArtwork name="attendance" size={64} className="mx-auto mb-4" />
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
                  <tr key={r._id} className="border-t border-slate-200">
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