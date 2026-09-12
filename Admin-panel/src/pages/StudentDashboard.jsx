import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck,
  ClipboardList,
  BookOpenCheck,
  CreditCard,
  ChevronRight,
  Megaphone,
} from "lucide-react";
import { StatCard, Card, Pill, Avatar } from "../components/UI";
import { api } from "../lib/api";
import useStudentContext, {
  fmtDate,
  fmtMoney,
  greeting,
  dateOf,
} from "./student/useStudentContext";

const WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function StudentDashboard() {
  const { user, cls, section } = useStudentContext();

  const [data, setData] = useState({
    profile: null,
    attendance: [],
    timetable: [],
    homework: [],
    exams: [],
    marks: { subjects: [], percentage: 0, totalObtained: 0, totalMax: 0 },
    invoices: [],
    notices: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.allSettled([
      api.students.me(),
      api.attendance.list(),
      api.timetable.list(`class=${encodeURIComponent(cls || "")}&section=${encodeURIComponent(section || "")}`),
      api.homework.list(`class=${encodeURIComponent(cls || "")}&section=${encodeURIComponent(section || "")}`),
      api.exams.list(`class=${encodeURIComponent(cls || "")}`),
      api.marks.reportCard(),
      api.fees.invoices.list(),
      api.notices.list(),
    ]).then((results) => {
      const value = (i) => (results[i].status === "fulfilled" ? results[i].value.data : null);
      if (results[0].status === "rejected") setError("We couldn't load your data. Please sign out and sign in again.");
      setData({
        profile: value(0),
        attendance: value(1) || [],
        timetable: value(2) || [],
        homework: value(3) || [],
        exams: value(4) || [],
        marks: value(5) || { subjects: [], percentage: 0, totalObtained: 0, totalMax: 0 },
        invoices: value(6) || [],
        notices: value(7) || [],
      });
      setLoading(false);
    });
  }, [cls, section]);

  const { profile, attendance, timetable, homework, exams, marks, invoices, notices } = data;

  const name = profile?.name || user?.name || "Student";
  const firstName = name.split(" ")[0];
  const admissionNo = profile?.admissionNo || user?.refId || "";

  const hwClass = useMemo(() => {
    const today = dateOf(new Date());
    return (homework || []).map((h) => ({
      ...h,
      overdue: h.dueDate && dateOf(h.dueDate) < today,
      dueSoon: h.dueDate && dateOf(h.dueDate) >= today,
    }));
  }, [homework]);
  const hwPending = hwClass.filter((h) => !h.overdue).length;
  const hwOverdue = hwClass.filter((h) => h.overdue).length;

  const attPct = useMemo(() => {
    if (!attendance.length) return 0;
    const counted = attendance.filter((a) => a.status === "Present" || a.status === "Half Day").length;
    return Math.round((counted / attendance.length) * 100);
  }, [attendance]);

  const byStatus = useMemo(() => {
    const m = { Present: 0, Absent: 0, Leave: 0, "Half Day": 0 };
    attendance.forEach((a) => { if (m[a.status] !== undefined) m[a.status] += 1; });
    return m;
  }, [attendance]);

  const avgMarks = useMemo(() => {
    const subs = marks.subjects || [];
    if (!subs.length) return 0;
    return Math.round(subs.reduce((s, x) => s + (x.marksObtained / Math.max(1, x.maxMarks)) * 100, 0) / subs.length);
  }, [marks]);


  const todayISO = () => dateOf(new Date());

  const feesTotal = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const paidAmount = invoices.reduce((s, i) => s + Number(i.paidAmount || 0), 0);
  const pendingDue = Math.max(0, feesTotal - paidAmount);

  const todayRow = timetable.find((t) => t.day === WEEK[new Date().getDay()]);
  const todayPeriods = (todayRow?.periods || []).filter((p) => p.subject !== "Break");
  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;

  const upcomingExams = [...(exams || [])]
    .filter((e) => new Date(e.date) >= todayISO())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);

  const resultsByExam = useMemo(() => {
    const group = {};
    (marks.subjects || []).forEach((m) => {
      const key = m.examName || "All";
      if (!group[key]) group[key] = [];
      group[key].push(m);
    });
    return Object.entries(group).map(([examName, subjects]) => {
      const obtained = subjects.reduce((s, m) => s + m.marksObtained, 0);
      const max = subjects.reduce((s, m) => s + m.maxMarks, 0);
      return {
        examName,
        subjects,
        obtained,
        max,
        pct: max ? Math.round((obtained / max) * 100) : 0,
      };
    });
  }, [marks]);

 

  return (
    <div className="space-y-6">
      <div className="relative rounded-2xl overflow-hidden bg-ink">
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink-light to-ink opacity-90" />
        <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={name} size={56} />
            <div>
              <p className="text-amber font-semibold text-[12.5px]">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              <h2 className="font-display text-2xl sm:text-[28px] font-bold text-white mt-0.5">
                {greeting()}, {firstName}
              </h2>
              <p className="text-white/60 text-[13.5px] mt-1">
                {cls ? `Class ${cls}${section ? `-${section}` : ""} · ` : ""}
                {admissionNo ? `Admission ${admissionNo}` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="bg-white rounded-xl px-4 py-3 text-center shadow-sm">
              <p className="font-display text-xl font-bold text-ink">{attPct}%</p>
              <p className="text-slate-text/60 text-[11px]">Attendance</p>
            </div>
            <div className="bg-white rounded-xl px-4 py-3 text-center shadow-sm">
              <p className="font-display text-xl font-bold text-ink">{avgMarks}%</p>
              <p className="text-slate-text/60 text-[11px]">Avg. Marks</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <Card>
          <p className="text-[13px] text-alert font-medium text-center py-2">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CalendarCheck} label="Attendance" value={`${attPct}%`} sub={`${byStatus.Present} present of ${attendance.length} recorded`} accent="success" />
        <StatCard icon={BookOpenCheck} label="Homework" value={String(hwPending + hwOverdue)} sub={hwOverdue ? `${hwOverdue} overdue` : "Nothing overdue"} accent={hwOverdue ? "alert" : "amber"} />
        <StatCard icon={ClipboardList} label="Upcoming Exams" value={String(upcomingExams.length)} sub="Scheduled ahead" accent="alert" />
        <StatCard icon={CreditCard} label="Fees Due" value={fmtMoney(pendingDue)} sub={feesTotal ? `of ${fmtMoney(feesTotal)} invoiced` : "No invoices yet"} accent={pendingDue > 0 ? "alert" : "success"} />
      </div>

      {loading && (
        <div className="grid lg:grid-cols-3 gap-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 bg-white rounded-2xl border border-black/[0.06] animate-pulse" />
          ))}
        </div>
      )}

      {!loading && (
        <>
          <div className="grid lg:grid-cols-3 gap-5">
            <Card title="Today's Classes" action={<Link className="text-[12px] font-semibold text-info flex items-center gap-1" to="/student/timetable">Full timetable <ChevronRight size={13} /></Link>}>
              {isWeekend ? (
                <p className="text-[13px] text-slate-text py-8 text-center">Weekend — no classes today.</p>
              ) : todayPeriods.length ? (
                <div className="space-y-2">
                  {todayPeriods.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5 px-2 rounded-lg">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${new Date().getHours() >= 12 ? "bg-amber" : "bg-success"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-ink truncate">{p.subject}</p>
                        <p className="text-[11px] text-slate-text/60">
                          {p.startTime}{p.endTime ? ` – ${p.endTime}` : ""}{p.teacherName ? ` · ${p.teacherName}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-slate-text py-8 text-center">No timetable published for today.</p>
              )}
            </Card>

            <Card title="Attendance Overview" className="lg:col-span-2" action={<Link className="text-[12px] font-semibold text-info flex items-center gap-1" to="/student/attendance">View all <ChevronRight size={13} /></Link>}>
              {attendance.length === 0 ? (
                <p className="text-[13px] text-slate-text py-10 text-center">No attendance records yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Present", value: byStatus.Present, color: "text-success" },
                    { label: "Absent", value: byStatus.Absent, color: "text-alert" },
                    { label: "Leave", value: byStatus.Leave, color: "text-info" },
                    { label: "Half Day", value: byStatus["Half Day"], color: "text-amber-dark" },
                  ].map((s) => (
                    <div key={s.label} className="bg-paper rounded-xl p-4 text-center">
                      <p className={`font-display text-lg font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[11px] text-slate-text/60">{s.label}</p>
                    </div>
                  ))}
                  <div className="col-span-full bg-paper rounded-xl p-4">
                    <div className="flex items-end justify-between mb-2">
                      <p className="text-[13px] text-slate-text">Overall attendance</p>
                      <p className="text-[14px] font-bold text-ink">{attPct}%</p>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-success rounded-full" style={{ width: `${attPct}%` }} />
                    </div>
                    <p className="text-[11px] text-slate-text/60 mt-1.5">
                      Latest: {attendance.slice(-3).map((a) => `${fmtDate(a.date)} · ${a.status}`).join("   ")}
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <Card title="Homework & Assignments" className="lg:col-span-2" action={<Link className="text-[12px] font-semibold text-info flex items-center gap-1" to="/student/homework">All assignments <ChevronRight size={13} /></Link>}>
              {hwClass.length === 0 ? (
                <p className="text-[13px] text-slate-text py-8 text-center">No homework assigned yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {[...hwClass].sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")).slice(0, 6).map((h) => (
                    <div key={h._id} className="pb-2.5 border-b border-black/[0.06] last:border-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-ink leading-snug truncate">{h.title}</p>
                          <p className="text-[11px] text-slate-text/60 mt-0.5">
                            {h.subject} · Assigned {fmtDate(h.assignedDate)} · Due {fmtDate(h.dueDate)}
                          </p>
                        </div>
                        {h.overdue ? (
                          <Pill tone="alert">Overdue</Pill>
                        ) : (
                          <Pill tone="amber">Pending</Pill>
                        )}
                      </div>
                      {h.description && (
                        <p className="text-[12px] text-slate-text/70 line-clamp-2">{h.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Upcoming Exams" action={<Link className="text-[12px] font-semibold text-info flex items-center gap-1" to="/student/exams">All exams <ChevronRight size={13} /></Link>}>
              {upcomingExams.length === 0 ? (
                <p className="text-[13px] text-slate-text py-8 text-center">No upcoming exams.</p>
              ) : (
                <div className="space-y-2.5">
                  {upcomingExams.map((ex) => (
                    <div key={ex._id} className="flex items-start justify-between gap-2 pb-2.5 border-b border-black/[0.06] last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-ink truncate">{ex.examName}</p>
                        <p className="text-[11px] text-slate-text/60">{ex.subject}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-bold text-ink">{fmtDate(ex.date)}</p>
                        <p className="text-[11px] text-slate-text/60">{ex.startTime || ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <Card title="Recent Results" action={<Link className="text-[12px] font-semibold text-info flex items-center gap-1" to="/student/results">Report card <ChevronRight size={13} /></Link>}>
              {resultsByExam.length === 0 ? (
                <p className="text-[13px] text-slate-text py-8 text-center">No results published yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {resultsByExam.slice(-3).reverse().map((r) => (
                    <div key={r.examName} className="flex items-center justify-between gap-2 pb-2.5 border-b border-black/[0.06] last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-ink truncate">{r.examName}</p>
                        <p className="text-[11px] text-slate-text/60">{r.subjects.length} subjects</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[14px] font-bold text-success">{r.pct}%</p>
                        <p className="text-[11px] text-slate-text/60">{r.obtained}/{r.max}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Fees & Payments" action={<Link className="text-[12px] font-semibold text-info flex items-center gap-1" to="/student/fees">Details <ChevronRight size={13} /></Link>}>
              {invoices.length === 0 ? (
                <p className="text-[13px] text-slate-text py-8 text-center">No fee invoices yet.</p>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-end justify-between mb-1">
                    <p className="text-[13px] text-slate-text">Outstanding</p>
                    <p className="text-[14px] font-bold text-ink">{fmtMoney(pendingDue)}</p>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-success rounded-full" style={{ width: `${feesTotal ? Math.round((paidAmount / feesTotal) * 100) : 0}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="text-success font-semibold">{fmtMoney(paidAmount)} paid</span>
                    <span className="text-alert font-semibold">{fmtMoney(pendingDue)} due</span>
                  </div>
                  <p className="text-[11px] text-slate-text/60 pt-1">Payments are collected at the school office. Online payment is not available.</p>
                </div>
              )}
            </Card>

            <Card title="Notices" action={<Link className="text-[12px] font-semibold text-info flex items-center gap-1" to="/student/notices">All notices <ChevronRight size={13} /></Link>}>
              {notices.length === 0 ? (
                <p className="text-[13px] text-slate-text py-8 text-center">No notices right now.</p>
              ) : (
                <div className="space-y-3">
                  {notices.slice(0, 5).map((n) => (
                    <div key={n._id} className="flex items-start gap-2.5">
                      <Megaphone size={14} className="mt-0.5 shrink-0 text-amber" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-ink leading-snug">{n.title}</p>
                        {n.description && <p className="text-[11.5px] text-slate-text/70 line-clamp-2 mt-0.5">{n.description}</p>}
                        <p className="text-[11px] text-slate-text/50 mt-0.5">{fmtDate(n.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}