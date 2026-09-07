import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  BookOpenCheck,
  Bell,
  CalendarDays,
  ClipboardList,
  Users,
  Save,
  ChevronRight,
  Timer,
} from "lucide-react";
import {
  StatCard,
  Card,
  Pill,
  Button,
  Avatar,
  toast,
} from "../components/UI";
import { api } from "../lib/api";
import { selectUser } from "../store/selectors";
import { useSelector } from "react-redux";

const WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STATUSES = ["Present", "Absent", "Leave"];
const STATUS_STYLE = {
  Present: "bg-success/12 text-success",
  Absent: "bg-alert/12 text-alert",
  Leave: "bg-info/12 text-info",
  "Half Day": "bg-amber/15 text-amber-dark",
};

function fmtShort(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function ClassTeacherDashboard() {
  const user = useSelector(selectUser);
  const [classes, setClasses] = useState([]);
  const [activeClass, setActiveClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [markMap, setMarkMap] = useState({});
  const [homework, setHomework] = useState([]);
  const [exams, setExams] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.allSettled([api.staff.list(), api.notices.list()]).then((res) => {
      const staff = Array.isArray(res[0].value?.data)
        ? res[0].value.data[0] || null
        : res[0].value?.data || null;
      setNotices(Array.isArray(res[1].value?.data) ? res[1].value.data : []);
      const assigned = staff?.classesAssigned || [];
      if (!assigned.length) {
        setLoading(false);
        return;
      }
      setClasses(assigned);
      setActiveClass(assigned[0]);
    });
  }, []);

  const activeKey = activeClass
    ? `${activeClass.class}-${activeClass.section}`
    : null;

  useEffect(() => {
    if (!activeKey) return;
    const [targetClass, targetSection] = activeKey.split("-");
    setLoading(true);
    const q = `class=${encodeURIComponent(targetClass)}&section=${encodeURIComponent(targetSection)}`;
    Promise.allSettled([
      api.students.list(q),
      api.attendance.list(q),
      api.homework.list(q),
      api.exams.list(q),
      api.timetable.list(q),
    ]).then((results) => {
      const value = (i) => (results[i].status === "fulfilled" ? results[i].value.data : null);
      setStudents(value(0) || []);
      setAttendance(value(1) || []);
      setHomework(value(2) || []);
      setExams(value(3) || []);
      setTimetable(value(4) || []);
      setLoading(false);
    });
  }, [activeKey]);

  const studentsArr = useMemo(() => Array.isArray(students) ? students : [], [students]);

  const todayAttendance = useMemo(() => {
    const byStudent = {};
    attendance.forEach((a) => {
      const d = new Date(a.date);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (dStr === todayStr()) byStudent[a.studentId] = a.status;
    });
    return byStudent;
  }, [attendance]);

  useEffect(() => {
    if (todayAttendance) {
      const map = {};
      studentsArr.forEach((s) => { map[s._id] = todayAttendance[s.admissionNo] || "Present"; });
      setMarkMap(map);
    }
  }, [todayAttendance, studentsArr]);

  if (!loading && !activeClass) {
    return (
      <div className="rounded-2xl bg-paper p-10 text-center">
        <p className="font-display text-xl font-bold text-ink mb-1">No class assigned yet</p>
        <p className="text-[13px] text-slate-text">Contact the school admin to link your class.</p>
      </div>
    );
  }

  const presentCount = Object.values(markMap).filter((s) => s === "Present").length;
  const absentCount = studentsArr.length - presentCount;
  const todayPeriods = (timetable.find((t) => t.day === WEEK[new Date().getDay()])?.periods || []).filter((p) => p.subject !== "Break");
  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
  const upcomingExams = exams.filter((e) => new Date(e.date) >= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date));
  const overdueHomework = homework.filter((h) => new Date(h.dueDate) < new Date());
  const openHomework = homework.filter((h) => new Date(h.dueDate) >= new Date());

  const setStatus = (studentId, status) => setMarkMap((m) => ({ ...m, [studentId]: status }));

  const saveAttendance = async () => {
    const records = studentsArr.map((s) => ({
      studentId: s.admissionNo,
      class: activeClass.class,
      section: activeClass.section,
      date: todayStr(),
      status: markMap[s._id] || "Present",
    }));
    setSaving(true);
    try {
      await api.attendance.mark(records);
      toast.success(`Attendance saved for ${records.length} student(s)`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Class switcher */}
      {classes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {classes.map((c) => (
            <Button
              key={`${c.class}-${c.section}`}
              variant={activeClass?.class === c.class && activeClass?.section === c.section ? "primary" : "outline"}
              onClick={() => setActiveClass(c)}
            >
              Class {c.class}-{c.section}
            </Button>
          ))}
        </div>
      )}

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden bg-ink">
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink-light to-ink opacity-90" />
        <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={user?.name || "Teacher"} size={54} />
            <div>
              <p className="text-amber font-semibold text-[12.5px]">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              <h2 className="font-display text-2xl sm:text-[26px] font-bold text-white mt-0.5">
                {greeting()}, {(user?.name || "Teacher").split(" ")[0]} 👋
              </h2>
              <p className="text-white/60 text-[13.5px] mt-1">
                Class Teacher · Class {activeClass?.class}-{activeClass?.section} · {studentsArr.length} students
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 text-center">
              <p className="font-display text-xl font-bold text-white">{presentCount}</p>
              <p className="text-white/50 text-[11px]">Present today</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 text-center">
              <p className="font-display text-xl font-bold text-white">{openHomework.length}</p>
              <p className="text-white/50 text-[11px]">Open homework</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Students" value={String(studentsArr.length)} sub={`Class ${activeClass?.class}-${activeClass?.section}`} accent="info" />
        <StatCard icon={CalendarCheck} label="Present" value={String(presentCount)} sub={`${absentCount} absent`} accent="success" />
        <StatCard icon={ClipboardList} label="Upcoming Exams" value={String(upcomingExams.length)} sub={upcomingExams.map((e) => e.subject).slice(0, 2).join(" · ") || "No exams"} accent="alert" />
        <StatCard icon={BookOpenCheck} label="Homework Done" value={String(homework.length - overdueHomework.length)} sub={`${overdueHomework.length} overdue`} accent="amber" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Mark attendance */}
        <Card
          title="Mark Attendance · Today"
          className="lg:col-span-2"
          action={
            <span className="text-[11px] font-semibold text-slate-text/60">{todayStr()}</span>
          }
        >
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                  <th className="px-5 py-2 font-semibold">Student</th>
                  {STATUSES.map((s) => (
                    <th key={s} className="px-3 py-2 font-semibold text-center">{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {studentsArr.map((s) => (
                  <tr key={s._id} className="border-t border-black/[0.06]">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={s.name} size={30} />
                        <div className="min-w-0">
                          <p className="font-semibold text-ink truncate">{s.name}</p>
                          <p className="text-[11px] text-slate-text/60">{s.admissionNo}</p>
                        </div>
                      </div>
                    </td>
                    {STATUSES.map((st) => (
                      <td key={st} className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => setStatus(s._id, st)}
                          className={`text-[11.5px] font-semibold rounded-full px-2.5 py-1 min-w-[64px] transition-colors ${markMap[s._id] === st ? STATUS_STYLE[st] : "text-slate-400 hover:text-slate-500"}`}
                        >
                          {st}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
                {studentsArr.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-text">
                      No students found in this class.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {studentsArr.length > 0 && (
            <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-black/[0.06]">
              <span className="text-[12px] text-slate-text/60">Defaults to Present if unchecked</span>
              <Button onClick={saveAttendance} disabled={saving}>
                <Save size={15} /> {saving ? "Saving…" : "Save Attendance"}
              </Button>
            </div>
          )}
        </Card>

        {/* Timetable today */}
        <Card title="Today's Timetable" action={<CalendarDays size={16} className="text-slate-text/50" />}>
          {isWeekend ? (
            <p className="text-[13px] text-slate-text py-8 text-center">Weekend — no classes. 🎉</p>
          ) : todayPeriods.length ? (
            <div className="space-y-2">
              {todayPeriods.map((p, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 px-2">
                  <div className="w-8 h-8 rounded-lg bg-amber/12 text-amber-dark flex items-center justify-center shrink-0">
                    <Timer size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-ink truncate">{p.subject}</p>
                    <p className="text-[11px] text-slate-text/60">{p.startTime}{p.endTime ? ` – ${p.endTime}` : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-slate-text py-8 text-center">No timetable published yet.</p>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Homework */}
        <Card title="Homework" className="lg:col-span-2" action={<a href="/homework" className="text-[12px] font-semibold text-info flex items-center gap-1">Manage <ChevronRight size={13} /></a>}>
          {homework.length === 0 ? (
            <p className="text-[13px] text-slate-text py-8 text-center">Nothing assigned yet.</p>
          ) : (
            <div className="space-y-2.5">
              {homework.slice(0, 6).map((hw) => (
                <div key={hw._id} className="flex items-center justify-between gap-3 pb-2.5 border-b border-black/[0.06] last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink truncate">{hw.title}</p>
                    <p className="text-[11.5px] text-slate-text/60">Need by {fmtShort(hw.dueDate)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Pill tone="amber">{hw.subject}</Pill>
                    {new Date(hw.dueDate) < new Date() && <Pill tone="alert">Overdue</Pill>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Upcoming Exams" action={<ClipboardList size={16} className="text-slate-text/50" />}>
          {upcomingExams.length === 0 ? (
            <p className="text-[13px] text-slate-text py-8 text-center">No exams scheduled.</p>
          ) : (
            <div className="space-y-2.5">
              {upcomingExams.slice(0, 6).map((ex) => (
                <div key={ex._id} className="flex items-center justify-between gap-2 pb-2.5 border-b border-black/[0.06] last:border-0 last:pb-0">
                  <div>
                    <p className="text-[13px] font-semibold text-ink">{ex.subject}</p>
                    <p className="text-[11.5px] text-slate-text/60">{ex.examName}</p>
                  </div>
                  <Pill tone="alert">{fmtShort(ex.date)}</Pill>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Notices to Class" className="lg:col-span-2" action={<Bell size={16} className="text-slate-text/50" />}>
          {notices.length === 0 ? (
            <p className="text-[13px] text-slate-text py-6 text-center">No notices yet.</p>
          ) : (
            <div className="space-y-3">
              {notices.slice(0, 5).map((n) => (
                <div key={n._id} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-amber" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink leading-snug">{n.title}</p>
                    <p className="text-[11.5px] text-slate-text/60 mt-0.5">{n.body || n.message || ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Class Insights">
          {studentsArr.length === 0 ? (
            <p className="text-[13px] text-slate-text py-6 text-center">No data to summarize.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-slate-text">Present today</span>
                <span className="text-[14px] font-bold text-success">{presentCount}/{studentsArr.length}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-success rounded-full transition-all" style={{ width: `${studentsArr.length ? Math.round((presentCount / studentsArr.length) * 100) : 0}%` }} />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-black/[0.06]">
                <span className="text-[12.5px] text-slate-text">Absent / Leave</span>
                <span className="text-[14px] font-bold text-alert">{absentCount}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-black/[0.06]">
                <span className="text-[12.5px] text-slate-text">Open homework items</span>
                <span className="text-[14px] font-bold text-ink">{openHomework.length}</span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}