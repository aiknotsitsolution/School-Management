import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  ClipboardList,
  BookOpenCheck,
  CreditCard,
  BookOpen,
  Bell,
  Bus,
  CalendarDays,
  ChevronRight,
  FileText,
  BarChart3,
} from "lucide-react";
import {
  StatCard,
  Card,
  Pill,
  Avatar,
} from "../components/UI";
import {
  ResponsiveContainer,
  XAxis,
  Tooltip,
  CartesianGrid,
  YAxis,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { api } from "../lib/api";
import { selectUser } from "../store/selectors";
import { useSelector } from "react-redux";

const SUBJECT_BAR_COLORS = ["#16213E", "#E8A33D", "#3F8F5F", "#3B6FA0", "#D65A4A", "#6B4F9C"];

const WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function fmtShort(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function fmtMoney(n) {
  const v = Number(n || 0);
  return v ? `₹${v.toLocaleString("en-IN")}` : "0";
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function StudentDashboard() {
  const user = useSelector(selectUser);
  const cls = user?.class || "";
  const section = user?.section || "";

  const [data, setData] = useState({
    profile: null,
    attendance: [],
    marks: { subjects: [], percentage: 0, totalObtained: 0, totalMax: 0 },
    invoices: [],
    payments: [],
    homework: [],
    timetable: [],
    exams: [],
    issues: [],
    transport: [],
    notices: [],
    events: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.students.me(),
      api.attendance.list(),
      api.marks.reportCard(),
      api.fees.invoices.list(),
      api.fees.payments.list(),
      api.homework.list(`class=${encodeURIComponent(cls)}&section=${encodeURIComponent(section)}`),
      api.timetable.list(`class=${encodeURIComponent(cls)}&section=${encodeURIComponent(section)}`),
      api.exams.list(`class=${encodeURIComponent(cls)}`),
      api.issues.list(),
      api.transport.list(),
      api.notices.list(),
      api.events.list(),
    ]).then((results) => {
      const value = (i) => (results[i].status === "fulfilled" ? results[i].value.data : null);
      setData({
        profile: value(0),
        attendance: value(1) || [],
        marks: value(2) || { subjects: [], percentage: 0, totalObtained: 0, totalMax: 0 },
        invoices: value(3) || [],
        payments: value(4) || [],
        homework: value(5) || [],
        timetable: value(6) || [],
        exams: value(7) || [],
        issues: value(8) || [],
        transport: Array.isArray(value(9)) ? value(9) : value(9) ? [value(9)] : [],
        notices: value(10) || [],
        events: value(11) || [],
      });
      setLoading(false);
    });
  }, [cls, section]);

  const { profile, attendance, marks, invoices, payments, homework, timetable, exams, issues, transport, notices, events } = data;

  const displayName = profile?.name || user?.name || "Student";
  const firstName = displayName.split(" ")[0];
  const admissionNo = profile?.admissionNo || user?.refId || "";

  const attPct = useMemo(() => {
    if (!attendance.length) return 0;
    const present = attendance.filter((a) => a.status === "Present" || a.status === "Half Day").length;
    return Math.round((present / attendance.length) * 100);
  }, [attendance]);

  const byStatus = useMemo(() => {
    const m = { Present: 0, Absent: 0, Late: 0, Leave: 0 };
    attendance.forEach((a) => { if (m[a.status] !== undefined) m[a.status] += 1; });
    return m;
  }, [attendance]);

  const avgMarks = useMemo(() => {
    const subs = marks.subjects || [];
    if (!subs.length) return 0;
    return Math.round(subs.reduce((s, x) => s + (x.marksObtained / Math.max(1, x.maxMarks)) * 100, 0) / subs.length);
  }, [marks]);

  const subjectMarks = useMemo(
    () => (marks.subjects || []).map((s) => ({ subject: s.subject, percentage: Math.round((s.marksObtained / Math.max(1, s.maxMarks)) * 100) })),
    [marks],
  );

  const feesPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const feesTotal = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const pendingDue = Math.max(0, feesTotal - feesPaid);
  const feesPaidPct = feesTotal ? Math.round((feesPaid / feesTotal) * 100) : 0;

  const todayRow = timetable.find((t) => t.day === WEEK[new Date().getDay()]);
  const todayPeriods = (todayRow?.periods || []).filter((p) => p.subject !== "Break");
  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;

  const upcomingExams = exams.filter((e) => new Date(e.date) >= new Date()).slice(0, 4);
  const pastExams = exams.filter((e) => new Date(e.date) < new Date());

  const route = transport[0] || null;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden bg-ink">
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink-light to-ink opacity-90" />
        <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={displayName} size={56} />
            <div>
              <p className="text-amber font-semibold text-[12.5px]">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              <h2 className="font-display text-2xl sm:text-[28px] font-bold text-white mt-0.5">
                {greeting()}, {firstName} 👋
              </h2>
              <p className="text-white/60 text-[13.5px] mt-1">
                {cls && section ? `Class ${cls}-${section} · ` : ""}{admissionNo && `Roll/admission ${admissionNo}`}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 text-center">
              <p className="font-display text-xl font-bold text-white">{attPct}%</p>
              <p className="text-white/50 text-[11px]">Attendance</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 text-center">
              <p className="font-display text-xl font-bold text-white">{avgMarks}%</p>
              <p className="text-white/50 text-[11px]">Avg. Marks</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CalendarCheck} label="Attendance" value={`${attPct}%`} sub={`${byStatus.Present} present of ${attendance.length} recorded`} accent="success" />
        <StatCard icon={ClipboardList} label="Upcoming Exams" value={String(upcomingExams.length)} sub="Scheduled ahead" accent="alert" />
        <StatCard icon={CreditCard} label="Pending Fees" value={fmtMoney(pendingDue)} sub={`of ${fmtMoney(feesTotal)} invoiced`} accent={pendingDue > 0 ? "alert" : "success"} />
        <StatCard icon={BookOpenCheck} label="Homework Due" value={String(homework.length)} sub="Open assignments" accent="amber" />
      </div>

      {loading && <p className="text-[13px] text-slate-text/70">Loading your dashboard…</p>}

      {/* Timetable + Attendance */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Today's Timetable" action={<CalendarDays size={16} className="text-slate-text/50" />}>
          {isWeekend ? (
            <p className="text-[13px] text-slate-text py-8 text-center">Weekend — no classes today. 🎉</p>
          ) : todayPeriods.length ? (
            <div className="space-y-2">
              {todayPeriods.map((p, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 px-2 rounded-lg">
                  <div className="w-2 h-2 rounded-full shrink-0 bg-success" />
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
            <p className="text-[13px] text-slate-text py-8 text-center">No timetable published yet.</p>
          )}
        </Card>

        <Card title="Attendance Overview" className="lg:col-span-2">
          {attendance.length === 0 ? (
            <p className="text-[13px] text-slate-text py-10 text-center">No attendance records yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Present", value: byStatus.Present, color: "text-success" },
                { label: "Absent", value: byStatus.Absent, color: "text-alert" },
                { label: "Late", value: byStatus.Late, color: "text-amber-dark" },
                { label: "Leave", value: byStatus.Leave, color: "text-info" },
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
                  Latest records: {attendance.slice(-3).map((a) => `${fmtShort(a.date)} · ${a.status}`).join("   ")}
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Exams + Marks */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Exams & Marks" action={<a href="/report-card" className="text-[12px] font-semibold text-info flex items-center gap-1">Full report <ChevronRight size={13} /></a>}>
          <div className="space-y-2.5">
            {pastExams.length === 0 && upcomingExams.length === 0 && (
              <p className="text-[13px] text-slate-text py-6 text-center">No exams scheduled.</p>
            )}
            {[...pastExams, ...upcomingExams].slice(0, 6).map((ex) => {
              const marksFor = (marks.subjects || []).find((m) => m.examId === ex._id || m.examName === ex.examName);
              return (
                <div key={ex._id} className="flex items-center justify-between gap-3 pb-2.5 border-b border-black/[0.06] last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink truncate">{ex.examName} · {ex.subject}</p>
                    <p className="text-[11.5px] text-slate-text/70">{fmtShort(ex.date)}</p>
                  </div>
                  {marksFor ? (
                    <div className="text-right shrink-0">
                      <p className="text-[14px] font-bold text-success">{marksFor.marksObtained}/{marksFor.maxMarks}</p>
                      <p className="text-[11px] text-slate-text/60">{Math.round((marksFor.marksObtained / Math.max(1, marksFor.maxMarks)) * 100)}%</p>
                    </div>
                  ) : (
                    <Pill tone={new Date(ex.date) >= new Date() ? "amber" : "info"}>
                      {new Date(ex.date) >= new Date() ? "Upcoming" : "Result awaited"}
                    </Pill>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Subject-wise Performance" action={<BarChart3 size={16} className="text-slate-text/50" />}>
          {subjectMarks.length === 0 ? (
            <p className="text-[13px] text-slate-text py-10 text-center">No marks recorded yet.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={subjectMarks} margin={{ left: -20, top: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEEAE0" />
                  <XAxis dataKey="subject" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E5E2D9", fontSize: 12.5 }} formatter={(v) => [`${v}%`, "Score"]} />
                  <Bar dataKey="percentage" radius={[6, 6, 0, 0]}>
                    {subjectMarks.map((_, i) => (
                      <Cell key={i} fill={SUBJECT_BAR_COLORS[i % SUBJECT_BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/[0.06] text-[12px]">
                <span className="text-slate-text/60">Overall Average</span>
                <span className="font-bold text-ink">{avgMarks}%</span>
              </div>
            </>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="Fee Status" action={<CreditCard size={16} className="text-slate-text/50" />}>
            <div className="mb-4">
              <div className="flex items-end justify-between mb-2">
                <p className="text-[13px] text-slate-text">Overall Progress</p>
                <p className="text-[14px] font-bold text-ink">{feesPaidPct}%</p>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-success rounded-full transition-all" style={{ width: `${feesPaidPct}%` }} />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[11.5px]">
                <span className="text-success font-semibold">{fmtMoney(feesPaid)} paid</span>
                <span className="text-alert font-semibold">{fmtMoney(pendingDue)} pending</span>
              </div>
            </div>
            {invoices.length === 0 ? (
              <p className="text-[13px] text-slate-text text-center py-3">No fee invoices yet.</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv._id} className="flex items-center justify-between pb-2 border-b border-black/[0.06] last:border-0 last:pb-0">
                    <div>
                      <p className="text-[12.5px] font-semibold text-ink">{inv.feeType} · {inv.session || ""}</p>
                      <p className="text-[11px] text-slate-text/60">Due {fmtShort(inv.dueDate)}</p>
                    </div>
                    <Pill tone={inv.status === "Paid" ? "success" : "alert"}>{inv.status || "Unpaid"}</Pill>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Library" action={<BookOpen size={16} className="text-slate-text/50" />}>
            {issues.length === 0 ? (
              <p className="text-[13px] text-slate-text text-center py-4">No books currently issued.</p>
            ) : (
              <div className="space-y-2">
                {issues.map((b) => (
                  <div key={b._id} className="flex items-start justify-between gap-2 pb-2.5 border-b border-black/[0.06] last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink truncate">{b.bookId?.title || "Book"}</p>
                      <p className="text-[11px] text-slate-text/60">{b.bookId?.author || "—"}</p>
                    </div>
                    <Pill tone={new Date(b.dueDate) - new Date() <= 3 * 86400000 && b.status === "Issued" ? "alert" : "info"}>
                      Due {fmtShort(b.dueDate)}
                    </Pill>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Homework + Notices */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Homework" className="lg:col-span-2" action={<BookOpenCheck size={16} className="text-slate-text/50" />}>
          {homework.length === 0 ? (
            <p className="text-[13px] text-slate-text text-center py-6">No homework assigned yet.</p>
          ) : (
            <div className="space-y-2.5">
              {homework.map((hw) => (
                <div key={hw._id} className="pb-2.5 border-b border-black/[0.06] last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-[13px] font-semibold text-ink leading-snug">{hw.title}</p>
                    <Pill tone="amber">{hw.subject}</Pill>
                  </div>
                  <div className="flex items-center gap-3 text-[11.5px] text-slate-text/60">
                    <span>Due: {fmtShort(hw.dueDate)}</span>
                    {hw.description && <span className="truncate max-w-[55%]">{hw.description}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="Notices & Events" action={<Bell size={16} className="text-slate-text/50" />}>
            {notices.length === 0 && events.length === 0 ? (
              <p className="text-[13px] text-slate-text text-center py-4">Nothing new yet.</p>
            ) : (
              <div className="space-y-3">
                {notices.slice(0, 3).map((n) => (
                  <div key={n._id} className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-amber" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink leading-snug">{n.title}</p>
                      <p className="text-[11px] text-slate-text/60 mt-0.5">{fmtShort(n.createdAt)} · {Array.isArray(n.audience) ? n.audience[0] : "All"}</p>
                    </div>
                  </div>
                ))}
                {events.slice(0, 2).map((e) => (
                  <div key={e._id} className="flex items-center justify-between py-1.5">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink truncate">{e.title}</p>
                      <p className="text-[11px] text-slate-text/60">{e.venue}</p>
                    </div>
                    <Pill tone="info">{fmtShort(e.date)}</Pill>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Bus / Transport" action={<Bus size={16} className="text-slate-text/50" />}>
            {route ? (
              <div className="space-y-2.5 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-text">Bus</span>
                  <span className="font-semibold text-ink">{route.routeNo}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-text">Driver</span>
                  <span className="font-semibold text-ink">{route.driverName || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-text">Contact</span>
                  <span className="font-semibold text-ink">{route.driverContact || "—"}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-black/[0.06]">
                  {(route.stops || []).slice(0, 2).map((s, i) => (
                    <div key={i} className="bg-paper rounded-xl p-3 text-center">
                      <p className="font-display text-lg font-bold text-ink">{s.time || "—"}</p>
                      <p className="text-[11px] text-slate-text/60 truncate">{s.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-slate-text text-center py-4">No bus assigned.</p>
            )}
          </Card>
        </div>
      </div>

      {/* Quick links */}
      <Card title="Quick Links">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: "/attendance", icon: CalendarCheck, label: "View Attendance", color: "text-success" },
            { href: "/homework", icon: BookOpenCheck, label: "All Homework", color: "text-info" },
            { href: "/examination", icon: ClipboardList, label: "Examinations", color: "text-alert" },
            { href: "/report-card", icon: FileText, label: "Report Card", color: "text-[#6B4F9C]" },
          ].map((q) => (
            <a key={q.href} href={q.href} className="group rounded-xl border border-black/[0.06] p-4 hover:border-amber/40 hover:bg-amber/5 transition-colors">
              <q.icon size={20} className={`${q.color} mb-2`} />
              <p className="text-[13px] font-semibold text-ink">{q.label}</p>
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}