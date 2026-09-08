import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  Clock,
  CheckCircle2,
  XCircle,
  CarFront,
  Sun,
} from "lucide-react";
import { PageIntro, Card, Input, Button, Pill, StatCard, toast } from "../components/UI";
import { api } from "../lib/api";
import useStaffContext, { fmtDate, todayISO, dateOf } from "./staff/useStaffContext";

const STATUSES = ["Present", "Absent", "Leave", "Half Day", "Late"];

export default function MyAttendance() {
  const { user, persona } = useStaffContext();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(() => todayISO());
  const [draft, setDraft] = useState(null);

  const refresh = () => {
    setLoading(true);
    api.staff.attendance
      .list()
      .then(({ data }) => setRecords(data || []))
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const todaysRecord = useMemo(
    () => (records || []).find((r) => r.date === today),
    [records, today],
  );

  useEffect(() => {
    if (todaysRecord) {
      setDraft({
        date: todaysRecord.date,
        status: todaysRecord.status,
        checkIn: todaysRecord.checkIn || "",
        checkOut: todaysRecord.checkOut || "",
        note: todaysRecord.note || "",
      });
    } else {
      setDraft({ date: today, status: "Present", checkIn: "", checkOut: "", note: "" });
    }
  }, [todaysRecord, today]);

  const monthRecords = useMemo(
    () => (records || []).filter((r) => dateOf(r.date).startsWith(today.slice(0, 7))),
    [records, today],
  );

  const summary = useMemo(() => {
    const counts = {};
    monthRecords.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return {
      present: counts["Present"] || 0,
      late: counts["Late"] || 0,
      absent: counts["Absent"] || 0,
      leave: (counts["Leave"] || 0) + (counts["Half Day"] || 0),
      total: monthRecords.length,
    };
  }, [monthRecords]);

  const submitMark = async (e) => {
    e.preventDefault();
    if (!draft?.status) return;
    try {
      await api.staff.attendance.mark(draft);
      toast("Attendance marked", "success");
      refresh();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const toneFor = (status) =>
    status === "Present"
      ? "success"
      : status === "Late"
        ? "amber"
        : status === "Absent"
          ? "alert"
          : "neutral";

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Staff Tools"
        title="My Attendance"
        description="Mark and track your own daily attendance."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CheckCircle2} label="Present" value={String(summary.present)} sub={`of ${summary.total} this month`} accent="success" />
        <StatCard icon={CarFront} label="Late" value={String(summary.late)} sub="Marked in late" accent="amber" />
        <StatCard icon={XCircle} label="Absent" value={String(summary.absent)} sub="Missed days" accent="alert" />
        <StatCard icon={Sun} label="Leave / Half Day" value={String(summary.leave)} sub="Approved or taken" accent="info" />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <Card title={`Mark Today (${fmtDate(today)})`} className="lg:col-span-2">
          <form onSubmit={submitMark} className="space-y-3">
            <div>
              <label className="text-[12px] font-semibold text-slate-text/70">Date</label>
              <Input
                type="date"
                value={today}
                max={todayISO()}
                onChange={(e) => setToday(e.target.value)}
                className="w-full mt-1"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-slate-text/70">Status</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, status: s }))}
                    className={`px-2 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${
                      draft?.status === s
                        ? "bg-ink text-white border-ink"
                        : "bg-white text-slate-text border-black/10 hover:bg-paper"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[12px] font-semibold text-slate-text/70">Check-in</label>
                <Input
                  type="time"
                  value={draft?.checkIn || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, checkIn: e.target.value }))}
                  className="w-full mt-1"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-slate-text/70">Check-out</label>
                <Input
                  type="time"
                  value={draft?.checkOut || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, checkOut: e.target.value }))}
                  className="w-full mt-1"
                />
              </div>
            </div>
            <Input
              placeholder="Note (optional)"
              value={draft?.note || ""}
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            />
            <Button type="submit" className="w-full justify-center">
              {todaysRecord ? "Update Attendance" : "Mark Attendance"}
            </Button>
            <p className="text-[12px] text-slate-text/60">
              {todaysRecord
                ? "An entry already exists — saving overwrites it."
                : "Records are saved per staff member and date."}
            </p>
          </form>
        </Card>

        <Card
          title="Attendance History"
          className="lg:col-span-3"
          action={
            <span className="text-[12px] font-semibold text-slate-text flex items-center gap-1.5">
              <Clock size={13} /> {monthRecords.length} days recorded
            </span>
          }
        >
          {loading ? (
            <p className="text-[13px] text-slate-text py-10 text-center">Loading…</p>
          ) : (records || []).length === 0 ? (
            <div className="py-10 text-center">
              <CalendarCheck size={40} className="mx-auto text-slate-text/30 mb-3" />
              <p className="text-[15px] font-semibold text-ink">No attendance recorded yet</p>
              <p className="text-[13px] text-slate-text/70 mt-1">Mark today's entry on the left to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                    <th className="px-5 py-2 font-semibold">Date</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Check-in</th>
                    <th className="px-3 py-2 font-semibold">Check-out</th>
                    <th className="px-3 py-2 font-semibold">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(records || [])]
                    .sort((a, b) => (a.date < b.date ? 1 : -1))
                    .slice(0, 30)
                    .map((r) => (
                      <tr key={r._id} className="border-t border-black/[0.06]">
                        <td className="px-5 py-2.5 font-medium text-ink">{fmtDate(r.date)}</td>
                        <td className="px-3 py-2.5">
                          <Pill tone={toneFor(r.status)}>{r.status}</Pill>
                        </td>
                        <td className="px-3 py-2.5 text-slate-text/80">{r.checkIn || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-text/80">{r.checkOut || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-text/70 max-w-[200px] truncate">{r.note || "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}