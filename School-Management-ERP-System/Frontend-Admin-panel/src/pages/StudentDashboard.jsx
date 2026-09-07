import { useMemo, useState } from "react";
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
  Send,
  BarChart3,
} from "lucide-react";
import {
  StatCard,
  Card,
  Pill,
  Button,
  Input,
  Avatar,
  toast,
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
import {
  STUDENT,
  STUDENT_ATTENDANCE,
  STUDENT_TIMETABLE,
  STUDENT_EXAMS,
  STUDENT_SUBJECT_MARKS,
  STUDENT_HOMEWORK,
  STUDENT_FEES,
  STUDENT_LIBRARY,
  STUDENT_NOTICES,
  STUDENT_EVENTS,
  STUDENT_TRANSPORT,
} from "../lib/dummyData";

const SUBJECT_BAR_COLORS = ["#16213E", "#E8A33D", "#3F8F5F", "#3B6FA0", "#D65A4A", "#6B4F9C"];

const STATUS_PILL = {
  present: "success",
  absent: "alert",
  late: "amber",
  leave: "info",
};

const HOMEWORK_STATUS_PILL = {
  Submitted: "success",
  Pending: "amber",
  Graded: "success",
};

function formatShortDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function todayPeriodName() {
  const h = new Date().getHours();
  const m = new Date().getMinutes();
  const time = h * 60 + m;
  const periodStarts = [540, 580, 620, 660, 700, 740, 780, 820]; // 09:00, 09:40, ...
  for (let i = periodStarts.length - 1; i >= 0; i--) {
    if (time >= periodStarts[i]) return i;
  }
  return 0;
}

export default function StudentDashboard() {
  const [leaveForm, setLeaveForm] = useState({ fromDate: "", toDate: "", reason: "" });
  const [homeworkFilter, setHomeworkFilter] = useState("All");

  const currentPeriodIdx = todayPeriodName();

  const feesPaidPct = STUDENT_FEES.total
    ? Math.round((STUDENT_FEES.paid / STUDENT_FEES.total) * 100)
    : 0;

  const pendingHomework = STUDENT_HOMEWORK.filter((h) => h.status === "Pending");
  const completedHomework = STUDENT_HOMEWORK.filter((h) => h.status !== "Pending");
  const filteredHomework = useMemo(() => {
    if (homeworkFilter === "All") return STUDENT_HOMEWORK;
    return STUDENT_HOMEWORK.filter((h) => h.status === homeworkFilter);
  }, [homeworkFilter]);

  const avgMarks = useMemo(() => {
    if (!STUDENT_SUBJECT_MARKS.length) return 0;
    const total = STUDENT_SUBJECT_MARKS.reduce((a, s) => a + s.percentage, 0);
    return Math.round(total / STUDENT_SUBJECT_MARKS.length);
  }, []);

  const handleLeaveSubmit = (e) => {
    e.preventDefault();
    if (!leaveForm.fromDate || !leaveForm.toDate || !leaveForm.reason.trim()) return;
    toast("Leave application submitted successfully!", "success");
    setLeaveForm({ fromDate: "", toDate: "", reason: "" });
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden bg-ink">
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink-light to-ink opacity-90" />
        <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(STUDENT.name)}&background=E8A33D&color=16213E&bold=true`}
              name={STUDENT.name}
              size={56}
            />
            <div>
              <p className="text-amber font-semibold text-[12.5px]">{todayLabel()}</p>
              <h2 className="font-display text-2xl sm:text-[28px] font-bold text-white mt-0.5">
                {greeting()}, {STUDENT.name.split(" ")[0]} 👋
              </h2>
              <p className="text-white/60 text-[13.5px] mt-1">
                Class {STUDENT.class}-{STUDENT.section} · Roll #{STUDENT.roll} · {STUDENT.admissionNo}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 text-center">
              <p className="font-display text-xl font-bold text-white">{STUDENT_ATTENDANCE.percentage}%</p>
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={CalendarCheck} label="Attendance" value={`${STUDENT_ATTENDANCE.percentage}%`} sub={`${STUDENT_ATTENDANCE.present}/${STUDENT_ATTENDANCE.total} days`} accent="success" />
        <StatCard icon={ClipboardList} label="Upcoming Exams" value={String(STUDENT_EXAMS.filter((e) => e.status === "Upcoming").length)} sub="Scheduled soon" accent="alert" />
        <StatCard icon={CreditCard} label="Pending Fees" value={`₹${(STUDENT_FEES.pending / 1000).toFixed(0)}K`} sub={`Due: ${formatShortDate(STUDENT_FEES.nextDue)}`} accent={STUDENT_FEES.pending > 0 ? "alert" : "success"} />
        <StatCard icon={BookOpenCheck} label="Homework Due" value={String(pendingHomework.length)} sub="Assignments pending" accent="amber" />
        <StatCard icon={BookOpen} label="Library Books" value={String(STUDENT_LIBRARY.length)} sub="Currently issued" accent="info" />
      </div>

      {/* Timetable + Attendance Calendar */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Today's Timetable" action={<CalendarDays size={16} className="text-slate-text/50" />}>
          <div className="space-y-2">
            {STUDENT_TIMETABLE.map((p, i) => {
              const isBreak = p.subject === "Break";
              const isCurrent = i === currentPeriodIdx && !isBreak;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 py-2.5 px-2 rounded-lg transition-colors ${
                    isCurrent ? "bg-amber/10 border border-amber/30" : ""
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isBreak ? "bg-slate-300" : isCurrent ? "bg-amber" : "bg-success"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-[13px] font-semibold truncate ${isBreak ? "text-slate-text/60" : "text-ink"}`}>
                        {p.subject}
                      </p>
                      {isCurrent && <Pill tone="amber">Now</Pill>}
                    </div>
                    <p className="text-[11px] text-slate-text/60">{p.period}{p.teacher ? ` · ${p.teacher}` : ""}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Attendance — September" className="lg:col-span-2">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-4 text-[11.5px] text-slate-text/70">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-success" /> Present</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-alert" /> Absent</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber" /> Late</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-info" /> Leave</span>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5 mb-4">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="text-center text-[11px] font-semibold text-slate-text/50 py-1">{d}</div>
            ))}
            {/* Sept 1 2026 is a Tuesday → offset 1 */}
            {Array.from({ length: 1 }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {STUDENT_ATTENDANCE.calendarDays.map((d) => (
              <div
                key={d.day}
                className={`aspect-square rounded-lg flex items-center justify-center text-[12px] font-semibold ${
                  d.status === "present"
                    ? "bg-success/12 text-success"
                    : d.status === "absent"
                      ? "bg-alert/12 text-alert"
                      : d.status === "late"
                        ? "bg-amber/15 text-amber-dark"
                        : "bg-info/10 text-info"
                }`}
                title={`Day ${d.day}: ${d.status}`}
              >
                {d.day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Present", value: STUDENT_ATTENDANCE.present, color: "text-success" },
              { label: "Absent", value: STUDENT_ATTENDANCE.absent, color: "text-alert" },
              { label: "Late", value: STUDENT_ATTENDANCE.late, color: "text-amber-dark" },
              { label: "Leave", value: STUDENT_ATTENDANCE.leave, color: "text-info" },
            ].map((s) => (
              <div key={s.label} className="bg-paper rounded-xl p-3 text-center">
                <p className={`font-display text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[11px] text-slate-text/60">{s.label}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Exams + Marks + Performance */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Exams & Marks" action={<a href="/report-card" className="text-[12px] font-semibold text-info flex items-center gap-1">Full report <ChevronRight size={13} /></a>}>
          <div className="space-y-2.5">
            {STUDENT_EXAMS.map((ex) => (
              <div key={ex.id} className="flex items-center justify-between gap-3 pb-2.5 border-b border-black/[0.06] last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink truncate">{ex.name}</p>
                  <p className="text-[11.5px] text-slate-text/70">{formatShortDate(ex.date)}</p>
                </div>
                {ex.status === "Completed" ? (
                  <div className="text-right shrink-0">
                    <p className="text-[14px] font-bold text-success">{ex.marks}/{ex.maxMarks}</p>
                    <p className="text-[11px] text-slate-text/60">{Math.round((ex.marks / ex.maxMarks) * 100)}%</p>
                  </div>
                ) : (
                  <Pill tone="amber">Upcoming</Pill>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Subject-wise Performance" action={<BarChart3 size={16} className="text-slate-text/50" />}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={STUDENT_SUBJECT_MARKS} margin={{ left: -20, top: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEEAE0" />
              <XAxis dataKey="subject" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E5E2D9", fontSize: 12.5 }} formatter={(v) => [`${v}%`, "Score"]} />
              <Bar dataKey="percentage" radius={[6, 6, 0, 0]}>
                {STUDENT_SUBJECT_MARKS.map((_, i) => (
                  <Cell key={i} fill={SUBJECT_BAR_COLORS[i % SUBJECT_BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/[0.06] text-[12px]">
            <span className="text-slate-text/60">Overall Average</span>
            <span className="font-bold text-ink">{avgMarks}%</span>
          </div>
        </Card>

        <div className="space-y-5">
          {/* Fees */}
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
                <span className="text-success font-semibold">₹{(STUDENT_FEES.paid / 1000).toFixed(0)}K paid</span>
                <span className="text-alert font-semibold">₹{(STUDENT_FEES.pending / 1000).toFixed(0)}K pending</span>
              </div>
            </div>
            <div className="space-y-2">
              {STUDENT_FEES.history.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between pb-2 border-b border-black/[0.06] last:border-0 last:pb-0">
                  <div>
                    <p className="text-[12.5px] font-semibold text-ink">{inv.label}</p>
                    <p className="text-[11px] text-slate-text/60">
                      {inv.paidOn ? `Paid ${formatShortDate(inv.paidOn)}` : `Due ${formatShortDate(STUDENT_FEES.nextDue)}`}
                    </p>
                  </div>
                  <Pill tone={inv.status === "Paid" ? "success" : "alert"}>{inv.status}</Pill>
                </div>
              ))}
            </div>
          </Card>

          {/* Library */}
          <Card title="Library Books" action={<BookOpen size={16} className="text-slate-text/50" />}>
            <div className="space-y-2">
              {STUDENT_LIBRARY.map((b) => {
                const daysLeft = Math.ceil((new Date(b.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
                const isUrgent = daysLeft <= 3;
                return (
                  <div key={b.id} className="flex items-start justify-between gap-2 pb-2.5 border-b border-black/[0.06] last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink truncate">{b.title}</p>
                      <p className="text-[11px] text-slate-text/60">{b.author}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Pill tone={isUrgent ? "alert" : "info"}>
                        {isUrgent ? `${daysLeft}d left` : `Due ${formatShortDate(b.dueDate)}`}
                      </Pill>
                    </div>
                  </div>
                );
              })}
              {STUDENT_LIBRARY.length === 0 && (
                <p className="text-[13px] text-slate-text text-center py-4">No books currently issued.</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Homework + Notices */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Homework" action={
          <div className="flex gap-1.5">
            {["All", "Pending", "Submitted", "Graded"].map((f) => (
              <button
                key={f}
                onClick={() => setHomeworkFilter(f)}
                className={`px-2.5 py-1 rounded-full text-[11.5px] font-semibold border transition-colors ${
                  homeworkFilter === f
                    ? "bg-ink text-white border-ink"
                    : "bg-white text-slate-text border-black/10 hover:border-ink/30"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        }>
          <div className="space-y-2.5">
            {filteredHomework.map((hw) => (
              <div key={hw.id} className="pb-2.5 border-b border-black/[0.06] last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-[13px] font-semibold text-ink leading-snug">{hw.title}</p>
                  <Pill tone={HOMEWORK_STATUS_PILL[hw.status]}>{hw.status}</Pill>
                </div>
                <div className="flex items-center gap-3 text-[11.5px] text-slate-text/60">
                  <span>{hw.subject}</span>
                  <span>Due: {formatShortDate(hw.dueDate)}</span>
                  {hw.submittedOn && <span>Submitted: {formatShortDate(hw.submittedOn)}</span>}
                  {hw.grade && <span className="font-semibold text-success">Grade: {hw.grade}</span>}
                </div>
              </div>
            ))}
            {filteredHomework.length === 0 && (
              <p className="text-[13px] text-slate-text text-center py-6">No homework found for this filter.</p>
            )}
          </div>
        </Card>

        <div className="space-y-5">
          {/* Notices & Events */}
          <Card title="Notices & Events" action={<Bell size={16} className="text-slate-text/50" />}>
            <div className="space-y-3">
              {STUDENT_NOTICES.slice(0, 3).map((n) => (
                <div key={n.id} className="flex items-start gap-2.5">
                  <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${n.pinned ? "bg-amber" : "bg-info"}`} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink leading-snug">{n.title}</p>
                    <p className="text-[11px] text-slate-text/60 mt-0.5">{formatShortDate(n.date)} · {n.category}</p>
                  </div>
                </div>
              ))}
              <div className="border-t border-black/[0.06] pt-2.5 mt-2.5">
                <p className="text-[12px] font-semibold text-slate-text/50 uppercase mb-2">Upcoming Events</p>
                {STUDENT_EVENTS.map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-1.5">
                    <div>
                      <p className="text-[13px] font-medium text-ink">{e.title}</p>
                      <p className="text-[11px] text-slate-text/60">{e.venue}</p>
                    </div>
                    <Pill tone="info">{formatShortDate(e.date)}</Pill>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Transport */}
          <Card title="Bus / Transport Info" action={<Bus size={16} className="text-slate-text/50" />}>
            <div className="space-y-2.5 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-text">Bus</span>
                <span className="font-semibold text-ink">{STUDENT_TRANSPORT.busNo}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-text">Route</span>
                <span className="font-semibold text-ink text-right max-w-[60%]">{STUDENT_TRANSPORT.route}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-text">Driver</span>
                <span className="font-semibold text-ink">{STUDENT_TRANSPORT.driverName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-text">Contact</span>
                <span className="font-semibold text-ink">{STUDENT_TRANSPORT.driverContact}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-black/[0.06]">
                <div className="bg-paper rounded-xl p-3 text-center">
                  <p className="font-display text-lg font-bold text-ink">{STUDENT_TRANSPORT.pickupTime}</p>
                  <p className="text-[11px] text-slate-text/60">Pickup</p>
                </div>
                <div className="bg-paper rounded-xl p-3 text-center">
                  <p className="font-display text-lg font-bold text-ink">{STUDENT_TRANSPORT.dropTime}</p>
                  <p className="text-[11px] text-slate-text/60">Drop</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Leave Application + Quick Actions */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Apply for Leave" className="lg:col-span-1">
          <form onSubmit={handleLeaveSubmit} className="space-y-3">
            <div>
              <label className="text-[12px] font-semibold text-ink mb-1.5 block">From Date</label>
              <Input type="date" value={leaveForm.fromDate} onChange={(e) => setLeaveForm((f) => ({ ...f, fromDate: e.target.value }))} required />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-ink mb-1.5 block">To Date</label>
              <Input type="date" value={leaveForm.toDate} onChange={(e) => setLeaveForm((f) => ({ ...f, toDate: e.target.value }))} required />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-ink mb-1.5 block">Reason</label>
              <textarea
                rows={3}
                placeholder="Reason for leave..."
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))}
                className="w-full rounded-lg border border-black/10 p-3 text-[13px] outline-none focus:border-ink/40 resize-none"
                required
              />
            </div>
            <Button variant="amber" className="w-full justify-center" type="submit">
              <Send size={14} /> Submit Leave Request
            </Button>
          </form>
        </Card>

        <Card title="Quick Actions" className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <a href="/attendance" className="group rounded-xl border border-black/[0.06] p-4 hover:border-amber/40 hover:bg-amber/5 transition-colors">
              <CalendarCheck size={20} className="text-success mb-2" />
              <p className="text-[13px] font-semibold text-ink">View Attendance</p>
              <p className="text-[11px] text-slate-text/60 mt-0.5">Monthly register</p>
            </a>
            <a href="/homework" className="group rounded-xl border border-black/[0.06] p-4 hover:border-amber/40 hover:bg-amber/5 transition-colors">
              <BookOpenCheck size={20} className="text-info mb-2" />
              <p className="text-[13px] font-semibold text-ink">All Homework</p>
              <p className="text-[11px] text-slate-text/60 mt-0.5">View assignments</p>
            </a>
            <a href="/examination" className="group rounded-xl border border-black/[0.06] p-4 hover:border-amber/40 hover:bg-amber/5 transition-colors">
              <ClipboardList size={20} className="text-alert mb-2" />
              <p className="text-[13px] font-semibold text-ink">Examinations</p>
              <p className="text-[11px] text-slate-text/60 mt-0.5">Schedule & marks</p>
            </a>
            <a href="/report-card" className="group rounded-xl border border-black/[0.06] p-4 hover:border-amber/40 hover:bg-amber/5 transition-colors">
              <FileText size={20} className="text-[#6B4F9C] mb-2" />
              <p className="text-[13px] font-semibold text-ink">Report Card</p>
              <p className="text-[11px] text-slate-text/60 mt-0.5">Full results</p>
            </a>
            <a href="/fees-collection" className="group rounded-xl border border-black/[0.06] p-4 hover:border-amber/40 hover:bg-amber/5 transition-colors">
              <CreditCard size={20} className="text-amber mb-2" />
              <p className="text-[13px] font-semibold text-ink">Fee Details</p>
              <p className="text-[11px] text-slate-text/60 mt-0.5">Payment history</p>
            </a>
            <a href="/bus-tracking" className="group rounded-xl border border-black/[0.06] p-4 hover:border-amber/40 hover:bg-amber/5 transition-colors">
              <Bus size={20} className="text-info mb-2" />
              <p className="text-[13px] font-semibold text-ink">Bus Tracking</p>
              <p className="text-[11px] text-slate-text/60 mt-0.5">Live location</p>
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
