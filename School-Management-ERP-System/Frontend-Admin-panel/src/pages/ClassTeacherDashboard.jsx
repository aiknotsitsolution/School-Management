import { useMemo, useState } from "react";
import {
  CalendarCheck,
  BookOpenCheck,
  Search,
  Check,
  X as XIcon,
  ChevronRight,
  FileText,
  Award,
  AlertCircle,
  Bell,
  CalendarDays,
  StickyNote,
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
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  Tooltip,
  CartesianGrid,
  YAxis,
} from "recharts";
import {
  TEACHER,
  CLASS_STUDENTS,
  TODAY_ATTENDANCE,
  PENDING_HOMEWORK,
  UPCOMING_EXAMS,
  TEACHER_NOTICES,
  TEACHER_TIMETABLE_TODAY,
  STUDENT_LEAVE_REQUESTS,
  PERFORMANCE_TOP,
  PERFORMANCE_NEEDS_ATTENTION,
  TEACHER_ATTENDANCE_TREND,
} from "../lib/dummyData";

const ATTENDANCE_COLORS = {
  present: "bg-success",
  absent: "bg-alert",
  late: "bg-amber",
  leave: "bg-info",
};

const ATTENDANCE_LABEL = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  leave: "Leave",
};

const SUBJECT_COLOR = {
  Science: "bg-success/12 text-success",
  Physics: "bg-info/12 text-info",
  "Free / Prep": "bg-slate-100 text-slate-500",
  Break: "bg-slate-100 text-slate-400",
  "Science (8-B)": "bg-success/12 text-success",
  "Physics (8-B)": "bg-info/12 text-info",
  "Lab Period": "bg-[#6B4F9C]/10 text-[#6B4F9C]",
};

const HOMEWORK_TONE = {
  Science: "success",
  Physics: "info",
};

function formatShortDate(d) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function ClassTeacherDashboard() {
  const [query, setQuery] = useState("");
  const [leaveActions, setLeaveActions] = useState({});

  // ─── Computed stats ────────────────────────────────────────────────────────
  const attendanceCounts = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, leave: 0 };
    Object.values(TODAY_ATTENDANCE).forEach((s) => {
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, []);

  const totalStudents = CLASS_STUDENTS.length;
  const presentToday = attendanceCounts.present + attendanceCounts.late;
  const absentToday = attendanceCounts.absent;
  const attendancePct = totalStudents
    ? Math.round((presentToday / totalStudents) * 100)
    : 0;
  const avgAttendance = totalStudents
    ? Math.round(
        CLASS_STUDENTS.reduce((a, s) => a + s.attendance, 0) / totalStudents,
      )
    : 0;

  const studentsWithStatus = useMemo(() => {
    return CLASS_STUDENTS.map((s) => ({
      ...s,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=16213E&color=fff&bold=true`,
      status: TODAY_ATTENDANCE[s.id] || "present",
    })).sort((a, b) => a.roll - b.roll);
  }, []);

  const filteredStudents = useMemo(() => {
    if (!query) return studentsWithStatus;
    const q = query.toLowerCase();
    return studentsWithStatus.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        String(s.roll).includes(q) ||
        s.id.toLowerCase().includes(q),
    );
  }, [query, studentsWithStatus]);

  // ─── Leave handling (local state) ──────────────────────────────────────────
  const handleLeave = (id, action) => {
    setLeaveActions((prev) => ({ ...prev, [id]: action }));
    const req = STUDENT_LEAVE_REQUESTS.find((l) => l.id === id);
    if (req) {
      toast(`Leave ${action === "Approved" ? "approved" : "rejected"} for ${req.studentName}`, action === "Approved" ? "success" : "info");
    }
  };

  const pendingLeaves = STUDENT_LEAVE_REQUESTS.filter(
    (l) => l.status === "Pending" && !leaveActions[l.id],
  );
  const resolvedLeaves = STUDENT_LEAVE_REQUESTS.filter(
    (l) => l.status === "Approved" || leaveActions[l.id],
  );

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="relative rounded-2xl overflow-hidden bg-ink">
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink-light to-ink opacity-90" />
        <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-amber font-semibold text-[12.5px]">
              {todayLabel()}
            </p>
            <h2 className="font-display text-2xl sm:text-[28px] font-bold text-white mt-1">
              {greeting()}, {TEACHER.name.split(" ")[0]} 👋
            </h2>
            <p className="text-white/60 text-[13.5px] mt-1.5">
              Class Teacher — Class {TEACHER.class}, Section {TEACHER.section} · {TEACHER.subjects.join(" & ")}
            </p>
          </div>
          <div className="flex gap-3">
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 text-center">
              <p className="font-display text-xl font-bold text-white">
                {attendancePct}%
              </p>
              <p className="text-white/50 text-[11px]">Class Attendance</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 text-center">
              <p className="font-display text-xl font-bold text-white">
                {totalStudents}
              </p>
              <p className="text-white/50 text-[11px]">Students</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          icon={Users}
          label="Total Students"
          value={String(totalStudents)}
          sub={`Class ${TEACHER.class}-${TEACHER.section}`}
          accent="amber"
        />
        <StatCard
          icon={CalendarCheck}
          label="Present Today"
          value={String(presentToday)}
          sub={`${attendancePct}% attendance`}
          accent="success"
        />
        <StatCard
          icon={UserX}
          label="Absent Today"
          value={String(absentToday)}
          sub={`${attendanceCounts.leave} on leave`}
          accent="alert"
        />
        <StatCard
          icon={BookOpenCheck}
          label="Pending Homework"
          value={String(PENDING_HOMEWORK.length)}
          sub={`${PENDING_HOMEWORK.reduce((a, h) => a + h.submissions, 0)} submissions so far`}
          accent="info"
        />
        <StatCard
          icon={ClipboardList}
          label="Upcoming Exams"
          value={String(UPCOMING_EXAMS.length)}
          sub={`Next: ${formatShortDate(UPCOMING_EXAMS[0]?.date || "")}`}
          accent="alert"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Attendance"
          value={`${avgAttendance}%`}
          sub="Class 8-A average"
          accent="success"
        />
      </div>

      {/* Attendance trend + Today's Timetable */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Attendance Trend — Class 8-A" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={TEACHER_ATTENDANCE_TREND} margin={{ left: -20, top: 5 }}>
              <defs>
                <linearGradient id="attGradTeacher" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3F8F5F" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3F8F5F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEEAE0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <YAxis domain={[80, 100]} tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E5E2D9", fontSize: 13, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }} formatter={(v) => [`${v}%`, "Attendance"]} />
              <Area type="monotone" dataKey="attendance" stroke="#3F8F5F" strokeWidth={2.5} fill="url(#attGradTeacher)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Today's Periods" action={<CalendarDays size={16} className="text-slate-text/50" />}>
          <div className="space-y-2">
            {TEACHER_TIMETABLE_TODAY.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${ATTENDANCE_COLORS[p.type === "break" ? "leave" : "present"]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-ink truncate">{p.subject}</p>
                  <p className="text-[11px] text-slate-text/60">{p.period}</p>
                </div>
                <Pill tone={p.type === "break" ? "neutral" : p.type === "free" ? "amber" : p.type === "lab" ? "info" : "success"}>
                  {p.type === "break" ? "Break" : p.type === "free" ? "Free" : p.type === "lab" ? "Lab" : "Class"}
                </Pill>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Today's Attendance + Leave Requests */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Today's Attendance" className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-black/[0.06]">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40" />
              <Input
                placeholder="Search by name or roll..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 w-full"
              />
            </div>
            <div className="flex gap-3 text-[12px] font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-success" /> Present</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-alert" /> Absent</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber" /> Late</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-info" /> Leave</span>
            </div>
          </div>

          <div className="space-y-1 divide-y divide-black/5">
            {filteredStudents.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2.5 hover:bg-paper/60 -mx-2 px-2 rounded-lg transition-colors">
                <Avatar src={s.avatar} name={s.name} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-ink truncate">{s.name}</p>
                    <Pill tone="neutral">#{s.roll}</Pill>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11.5px] font-semibold ${ATTENDANCE_COLORS[s.status]}/10 text-ink`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${ATTENDANCE_COLORS[s.status]} mr-1.5`} />
                  {ATTENDANCE_LABEL[s.status]}
                </span>
              </div>
            ))}
          </div>

          {filteredStudents.length === 0 && (
            <div className="py-12 text-center">
              <Search size={32} className="mx-auto text-slate-text/30 mb-2" />
              <p className="text-[14px] font-medium text-ink">No students found</p>
              <p className="text-[13px] text-slate-text/60">Try a different search term.</p>
            </div>
          )}

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-black/[0.06] text-[12px] text-slate-text/70">
            <span>
              Showing <strong className="text-ink">{filteredStudents.length}</strong> students
            </span>
            <span>
              Present: <strong className="text-success">{attendanceCounts.present + attendanceCounts.late}</strong> ·
              Absent: <strong className="text-alert">{absentToday}</strong> ·
              Leave: <strong className="text-info">{attendanceCounts.leave}</strong>
            </span>
          </div>
        </Card>

        <div className="space-y-5">
          {/* Leave Requests */}
          <Card title="Student Leave Requests" action={<CalendarDays size={16} className="text-slate-text/50" />}>
            <div className="space-y-3">
              {STUDENT_LEAVE_REQUESTS.map((l) => {
                const resolved = leaveActions[l.id] || l.status;
                const isPending = resolved === "Pending";
                return (
                  <div key={l.id} className="pb-3 border-b border-black/[0.06] last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[13px] font-semibold text-ink">{l.studentName}</p>
                      <Pill tone={isPending ? "amber" : resolved === "Approved" ? "success" : "neutral"}>
                        {isPending ? "Pending" : resolved}
                      </Pill>
                    </div>
                    <p className="text-[11.5px] text-slate-text/70">
                      {formatShortDate(l.fromDate)} – {formatShortDate(l.toDate)}
                    </p>
                    <p className="text-[12px] text-slate-text mt-1">{l.reason}</p>
                    {isPending && (
                      <div className="flex gap-2 mt-2">
                        <Button variant="amber" className="!py-1.5 !px-3 !text-[12px]" onClick={() => handleLeave(l.id, "Approved")}>
                          <Check size={13} /> Approve
                        </Button>
                        <Button variant="outline" className="!py-1.5 !px-3 !text-[12px] !text-alert !border-alert/30" onClick={() => handleLeave(l.id, "Rejected")}>
                          <XIcon size={13} /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              {STUDENT_LEAVE_REQUESTS.length === 0 && (
                <p className="text-[13px] text-slate-text text-center py-6">No leave requests.</p>
              )}
            </div>
          </Card>

          {/* Notices */}
          <Card title="Recent Notices" action={<Bell size={16} className="text-slate-text/50" />}>
            <div className="space-y-2.5">
              {TEACHER_NOTICES.map((n) => (
                <div key={n.id} className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber mt-2 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink leading-snug">{n.title}</p>
                    <p className="text-[11px] text-slate-text/60 mt-0.5">
                      {formatShortDate(n.date)} · {n.category}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Pending Homework + Upcoming Exams */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Pending Homework" action={
          <a href="/homework" className="text-[12px] font-semibold text-info flex items-center gap-1">
            View all <ChevronRight size={13} />
          </a>
        }>
          <div className="space-y-3">
            {PENDING_HOMEWORK.map((hw) => (
              <div key={hw.id} className="flex items-start justify-between gap-3 pb-3 border-b border-black/[0.06] last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink leading-snug">{hw.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Pill tone={HOMEWORK_TONE[hw.subject] || "neutral"}>{hw.subject}</Pill>
                    <span className="text-[11px] text-slate-text/60">Due: {formatShortDate(hw.dueDate)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-bold text-amber-dark">{hw.submissions}/{hw.total}</p>
                  <p className="text-[11px] text-slate-text/60">submitted</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Upcoming Exams" action={
          <a href="/examination" className="text-[12px] font-semibold text-info flex items-center gap-1">
            View all <ChevronRight size={13} />
          </a>
        }>
          <div className="space-y-3">
            {UPCOMING_EXAMS.map((ex) => (
              <div key={ex.id} className="flex items-start justify-between gap-3 pb-3 border-b border-black/[0.06] last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink leading-snug">{ex.name}</p>
                  <p className="text-[11.5px] text-slate-text/70 mt-1">
                    {formatShortDate(ex.date)} · {ex.time}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-bold text-ink">{ex.maxMarks}</p>
                  <p className="text-[11px] text-slate-text/60">marks</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Performance + Quick Actions */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Top Performers" action={<Award size={16} className="text-slate-text/50" />}>
          <div className="space-y-3">
            {PERFORMANCE_TOP.map((s, i) => (
              <div key={s.roll} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-amber/15 text-amber-dark flex items-center justify-center text-[12px] font-bold">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-ink">{s.name}</p>
                  <p className="text-[11px] text-slate-text/60">Roll #{s.roll}</p>
                </div>
                <span className="text-[14px] font-bold text-success">{s.avg}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Needs Attention" action={<AlertCircle size={16} className="text-alert/60" />}>
          <div className="space-y-3">
            {PERFORMANCE_NEEDS_ATTENTION.map((s) => (
              <div key={s.roll} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-alert/10 text-alert flex items-center justify-center text-[12px] font-bold">
                  {s.roll}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-ink">{s.name}</p>
                  <p className="text-[11px] text-slate-text/60">Roll #{s.roll}</p>
                </div>
                <span className={`text-[14px] font-bold ${s.avg < 60 ? "text-alert" : "text-amber-dark"}`}>{s.avg}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Quick Actions">
          <div className="grid grid-cols-2 gap-3">
            <a href="/attendance" className="group rounded-xl border border-black/[0.06] p-4 hover:border-amber/40 hover:bg-amber/5 transition-colors">
              <CalendarCheck size={20} className="text-amber mb-2" />
              <p className="text-[13px] font-semibold text-ink">Mark Attendance</p>
              <p className="text-[11px] text-slate-text/60 mt-0.5">Open register</p>
            </a>
            <a href="/homework" className="group rounded-xl border border-black/[0.06] p-4 hover:border-amber/40 hover:bg-amber/5 transition-colors">
              <BookOpenCheck size={20} className="text-info mb-2" />
              <p className="text-[13px] font-semibold text-ink">Assign Homework</p>
              <p className="text-[11px] text-slate-text/60 mt-0.5">Create new</p>
            </a>
            <a href="/report-card" className="group rounded-xl border border-black/[0.06] p-4 hover:border-amber/40 hover:bg-amber/5 transition-colors">
              <FileText size={20} className="text-success mb-2" />
              <p className="text-[13px] font-semibold text-ink">View Report Card</p>
              <p className="text-[11px] text-slate-text/60 mt-0.5">Class results</p>
            </a>
            <a href="/notice-board" className="group rounded-xl border border-black/[0.06] p-4 hover:border-amber/40 hover:bg-amber/5 transition-colors">
              <StickyNote size={20} className="text-[#6B4F9C] mb-2" />
              <p className="text-[13px] font-semibold text-ink">Send Notice</p>
              <p className="text-[11px] text-slate-text/60 mt-0.5">Post circular</p>
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
