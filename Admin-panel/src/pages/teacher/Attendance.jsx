import { useEffect, useMemo, useState } from "react";
import {
  X,
  Save,
  UserCheck,
  UserX,
  CalendarCheck,
  Clock3,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Avatar,
  StatCard,
  toast,
} from "../../components/UI";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  Tooltip,
  CartesianGrid,
  YAxis,
} from "recharts";
import { api } from "../../lib/api";
import { useTeacherContext, todayISO, fmtDate } from "./useTeacherContext";

const STATUS_CONFIG = {
  Present: { label: "P", full: "Present", tone: "success", active: "bg-success text-white border-success" },
  Absent: { label: "A", full: "Absent", tone: "alert", active: "bg-alert text-white border-alert" },
  "Half Day": { label: "HD", full: "Half Day", tone: "amber", active: "bg-amber text-ink border-amber" },
  Leave: { label: "L", full: "Leave", tone: "info", active: "bg-info text-white border-info" },
};

export default function Attendance() {
  const { cls, section, query } = useTeacherContext();
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [marks, setMarks] = useState({});
  const [historyDate, setHistoryDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    Promise.allSettled([
      api.students.list(`${query}&limit=500`),
      api.attendance.list(query),
    ]).then(([sr, ar]) => {
      setStudents(Array.isArray(sr.value?.data) ? sr.value.data : []);
      setRecords(Array.isArray(ar.value?.data) ? ar.value.data : []);
      setLoading(false);
    });
  }, [query]);

  const todayRecords = useMemo(() => {
    const byStudent = {};
    (records || []).forEach((r) => {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (key === todayISO()) byStudent[r.studentId] = r.status;
    });
    return byStudent;
  }, [records]);

  useEffect(() => {
    const map = {};
    (students || []).forEach((s) => {
      if (todayRecords[s.admissionNo]) map[s._id] = todayRecords[s.admissionNo];
    });
    setMarks(map);
  }, [todayRecords, students]);

  const setMark = (id, status) =>
    setMarks((m) => (m[id] === status ? { ...m, [id]: undefined } : { ...m, [id]: status }));

  const markAll = (status) => {
    const next = { ...marks };
    (students || []).forEach((s) => {
      next[s._id] = status;
    });
    setMarks(next);
  };

  const counts = useMemo(() => {
    const c = { Present: 0, Absent: 0, "Half Day": 0, Leave: 0, Unmarked: 0 };
    (students || []).forEach((s) => {
      const st = marks[s._id];
      if (st) c[st] = (c[st] || 0) + 1;
      else c.Unmarked += 1;
    });
    return c;
  }, [marks, students]);

  const trend = useMemo(() => {
    const grouped = {};
    (records || []).forEach((r) => {
      const key = new Date(r.date).toISOString().slice(0, 7);
      if (!grouped[key]) grouped[key] = { total: 0, present: 0, date: r.date };
      grouped[key].total += 1;
      if (r.status === "Present") grouped[key].present += 1;
    });
    return Object.values(grouped)
      .map((g) => ({
        month: new Date(g.date).toLocaleDateString("en-IN", { month: "short" }),
        attendance: g.total ? Math.round((g.present / g.total) * 100) : 0,
      }))
      .slice(-8);
  }, [records]);

  const history = useMemo(() => {
    const byDate = {};
    (records || []).forEach((r) => {
      const key = new Date(r.date).toDateString();
      if (!byDate[key])
        byDate[key] = { date: r.date, total: 0, present: 0, absent: 0, leave: 0 };
      byDate[key].total += 1;
      if (r.status === "Present") byDate[key].present += 1;
      else if (r.status === "Absent") byDate[key].absent += 1;
      else byDate[key].leave += 1;
    });
    return Object.values(byDate).sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );
  }, [records]);

  const filteredHistory = useMemo(
    () =>
      historyDate
        ? history.filter((h) => new Date(h.date).toISOString().slice(0, 10) === historyDate)
        : history,
    [history, historyDate],
  );

  const saveAttendance = async () => {
    const marked = (students || [])
      .filter((s) => marks[s._id])
      .map((s) => ({
        studentId: s.admissionNo,
        class: cls,
        section,
        date: todayISO(),
        status: marks[s._id],
      }));
    if (!marked.length) {
      toast("Select at least one status before saving", "amber");
      return;
    }
    setSaving(true);
    try {
      await api.attendance.mark(marked);
      toast(`Attendance saved for ${marked.length} student(s)`);
      const { data: fresh } = await api.attendance.list(query);
      setRecords(Array.isArray(fresh) ? fresh : []);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (!cls) {
    return (
      <Card>
        <div className="py-16 text-center">
          <CalendarCheck size={40} className="mx-auto text-slate-text/30 mb-3" />
          <p className="text-[15px] font-semibold text-ink">
            No class assigned yet
          </p>
          <p className="text-[13px] text-slate-text/70 mt-1">
            Contact your school admin to link your class and section.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="My Teaching"
        title="Attendance"
        description={`Daily attendance register for Class ${cls}${section ? `-${section}` : ""}.`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={CalendarCheck}
          label="Marked Today"
          value={`${(students || []).length - counts.Unmarked}/${(students || []).length}`}
          sub={`${counts.Unmarked} still unmarked`}
          accent="success"
        />
        <StatCard
          icon={UserCheck}
          label="Present"
          value={String(counts.Present)}
          sub="Marked present today"
          accent="amber"
        />
        <StatCard
          icon={X}
          label="Absent"
          value={String(counts.Absent)}
          sub={`${counts.Leave} on leave`}
          accent="alert"
        />
        <StatCard
          icon={Clock3}
          label="Half Day"
          value={String(counts["Half Day"])}
          sub="Marked as late today"
          accent="info"
        />
      </div>

      <Card title="Monthly Attendance Trend">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart
            data={trend}
            margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="teachAttGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3F8F5F" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#3F8F5F" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEEAE0" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "#64748B" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: "#64748B" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: "1px solid #E5E2D9", fontSize: 13 }}
              formatter={(value) => [`${value}%`, "Attendance"]}
            />
            <Area
              type="monotone"
              dataKey="attendance"
              stroke="#3F8F5F"
              strokeWidth={2.5}
              fill="url(#teachAttGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card
        title="Mark Today's Attendance"
        action={
          <span className="text-[12.5px] font-medium text-slate-text/70">
            {todayISO()}
          </span>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-4 border-b border-black/6">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(STATUS_CONFIG).map(([status]) => (
              <button
                key={status}
                onClick={() => markAll(status)}
                disabled={!students.length}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-paper text-slate-text hover:bg-black/5 disabled:opacity-50"
              >
                Mark all {status === "Half Day" ? "Half Day" : status}
              </button>
            ))}
          </div>
          <span className="text-[11.5px] text-slate-text/60">
            Tap a status to set it; tap again to clear.
          </span>
        </div>

        {loading ? (
          <p className="text-[13px] text-slate-text py-10 text-center">
            Loading students…
          </p>
        ) : (students || []).length === 0 ? (
          <p className="text-[13px] text-slate-text py-10 text-center">
            No students found for this class and section.
          </p>
        ) : (
          <div className="divide-y divide-black/5">
            {students.map((s) => {
              const status = marks[s._id];
              return (
                <div
                  key={s._id}
                  className="flex items-center gap-3 py-2.5 hover:bg-paper/60 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <Avatar src={s.photoUrl} name={s.name} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink truncate">
                      {s.name}
                    </p>
                    <p className="text-[11.5px] text-slate-text/60">
                      {s.admissionNo} · Roll {s.rollNo || "—"}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <button
                        key={key}
                        title={cfg.full}
                        onClick={() => setMark(s._id, key)}
                        className={`w-9 h-9 rounded-lg text-[12px] font-bold border transition-all ${
                          status === key
                            ? cfg.active
                            : "bg-white text-slate-text/55 border-black/10 hover:bg-paper hover:border-black/20"
                        }`}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(students || []).length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5 pt-4 border-t border-black/6">
            <div className="text-[12.5px] text-slate-text/70">
              Present <strong className="text-success">{counts.Present}</strong>
              {" · "}Absent <strong className="text-alert">{counts.Absent}</strong>
              {" · "}Half Day <strong className="text-amber-dark">{counts["Half Day"]}</strong>
              {" · "}Leave <strong className="text-info">{counts.Leave}</strong>
            </div>
            <Button variant="amber" onClick={saveAttendance} disabled={saving}>
              <Save size={15} /> {saving ? "Saving…" : "Save Attendance"}
            </Button>
          </div>
        )}
      </Card>

      <Card
        title="Attendance History"
        action={
          <input
            type="date"
            value={historyDate}
            onChange={(e) => setHistoryDate(e.target.value)}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-[12.5px] outline-none focus:border-ink/40"
          />
        }
      >
        {filteredHistory.length === 0 ? (
          <p className="text-[13px] text-slate-text py-10 text-center">
            No attendance records yet.
          </p>
        ) : (
          <div className="space-y-2">
            {filteredHistory.slice(0, 15).map((h) => {
              const pct = h.total ? Math.round((h.present / h.total) * 100) : 0;
              return (
                <div
                  key={h.date}
                  className="flex items-center gap-3 py-2.5 border-b border-black/[0.06] last:border-0"
                >
                  <div className="w-10 h-10 rounded-lg bg-paper flex items-center justify-center text-slate-text shrink-0">
                    <CalendarCheck size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-ink">
                      {fmtDate(h.date)}
                    </p>
                    <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-success rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-bold text-success">{pct}%</p>
                    <p className="text-[11px] text-slate-text/60">
                      {h.present} P · {h.absent} A · {h.leave} L
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}