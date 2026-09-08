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
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  StatCard,
  Card,
  Pill,
  Button,
  Avatar,
  toast,
} from "../components/UI";
import { api } from "../lib/api";
import { selectUser, selectSchool } from "../store/selectors";
import { useSelector } from "react-redux";
import { todayISO, fmtDate } from "./teacher/useTeacherContext";

const WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STATUSES = ["Present", "Absent", "Leave", "Half Day"];
const STATUS_STYLE = {
  Present: "bg-success/12 text-success",
  Absent: "bg-alert/12 text-alert",
  Leave: "bg-info/12 text-info",
  "Half Day": "bg-amber/15 text-amber-dark",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function ClassTeacherDashboard() {
  const user = useSelector(selectUser);
  const school = useSelector(selectSchool);
  const cls = user?.class || null;
  const section = user?.section || null;

  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [markMap, setMarkMap] = useState({});
  const [homework, setHomework] = useState([]);
  const [exams, setExams] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [notices, setNotices] = useState([]);
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const q = useMemo(
    () =>
      cls
        ? `class=${encodeURIComponent(cls)}${section ? `&section=${encodeURIComponent(section)}` : ""}`
        : "",
    [cls, section],
  );

  useEffect(() => {
    Promise.allSettled([
      api.staff.list(),
      api.notices.list(),
      cls ? api.students.list(`${q}&limit=500`) : Promise.resolve({ data: [] }),
      cls ? api.attendance.list(q) : Promise.resolve({ data: [] }),
      cls ? api.homework.list(q) : Promise.resolve({ data: [] }),
      cls ? api.exams.list(q) : Promise.resolve({ data: [] }),
      cls ? api.timetable.list(q) : Promise.resolve({ data: [] }),
    ]).then((res) => {
      const val = (i, key = "data") =>
        res[i].status === "fulfilled" ? res[i].value?.[key] : null;
      const staffList = Array.isArray(val(0)) ? val(0) : [];
      setStaff(staffList[0] || null);
      setNotices(Array.isArray(val(1)) ? val(1) : []);
      setStudents(Array.isArray(val(2)) ? val(2) : []);
      setAttendance(Array.isArray(val(3)) ? val(3) : []);
      setHomework(Array.isArray(val(4)) ? val(4) : []);
      setExams(Array.isArray(val(5)) ? val(5) : []);
      setTimetable(Array.isArray(val(6)) ? val(6) : []);
      setLoading(false);
    });
  }, [cls, q]);

  const todayAttendance = useMemo(() => {
    const byStudent = {};
    attendance.forEach((a) => {
      const d = new Date(a.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (key === todayISO()) byStudent[a.studentId] = a.status;
    });
    return byStudent;
  }, [attendance]);

  useEffect(() => {
    const map = {};
    students.forEach((s) => {
      if (todayAttendance[s.admissionNo]) map[s._id] = todayAttendance[s.admissionNo];
    });
    setMarkMap(map);
  }, [todayAttendance, students]);

  if (!loading && !cls) {
    return (
      <div className="rounded-2xl bg-paper p-10 text-center">
        <p className="font-display text-xl font-bold text-ink mb-1">
          No class assigned yet
        </p>
        <p className="text-[13px] text-slate-text">
          Contact the school admin to link your class and section.
        </p>
      </div>
    );
  }

  const marked = Object.values(markMap).filter(Boolean);
  const presentCount = marked.filter((s) => s === "Present").length;
  const absentCount = marked.filter((s) => s === "Absent").length;
  const leaveCount = marked.filter((s) => s === "Leave" || s === "Half Day").length;
  const unmarkedCount = students.length - marked.length;

  const todayPeriods = (timetable.find((t) => t.day === WEEK[new Date().getDay()])?.periods || []).filter((p) => p.subject !== "Break");
  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
  const upcomingExams = exams.filter((e) => new Date(e.date) >= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date));
  const openHomework = homework.filter((h) => new Date(h.dueDate) >= new Date());
  const overdueHomework = homework.filter((h) => new Date(h.dueDate) < new Date());
  const attendanceRate = attendance.length
    ? Math.round((attendance.filter((r) => r.status === "Present").length / attendance.length) * 100)
    : null;

  const setStatus = (id, status) =>
    setMarkMap((m) =>
      m[id] === status ? { ...m, [id]: undefined } : { ...m, [id]: status },
    );

  const saveAttendance = async () => {
    const records = students
      .filter((s) => markMap[s._id])
      .map((s) => ({
        studentId: s.admissionNo,
        class: cls,
        section,
        date: todayISO(),
        status: markMap[s._id],
      }));
    if (!records.length) {
      toast("Select at least one status before saving", "amber");
      return;
    }
    setSaving(true);
    try {
      await api.attendance.mark(records);
      toast(`Attendance saved for ${records.length} student(s)`);
      const { data: fresh } = await api.attendance.list(q);
      setAttendance(Array.isArray(fresh) ? fresh : []);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative rounded-2xl overflow-hidden bg-ink">
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink-light to-ink opacity-90" />
        <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar src={staff?.photoUrl} name={user?.name || "Teacher"} size={54} />
            <div>
              <p className="text-amber font-semibold text-[12.5px]">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              <h2 className="font-display text-2xl sm:text-[26px] font-bold text-white mt-0.5">
                {greeting()}, {(user?.name || "Teacher").split(" ")[0]}
              </h2>
              <p className="text-white/60 text-[13.5px] mt-1">
                Class Teacher · Class {cls}
                {section ? `-${section}` : ""} · {students.length} students
                {staff?.designation ? ` · ${staff.designation}` : ""}
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Students"
          value={String(students.length)}
          sub={`Class ${cls}${section ? `-${section}` : ""}`}
          accent="info"
        />
        <StatCard
          icon={CalendarCheck}
          label="Present Today"
          value={String(presentCount)}
          sub={`${absentCount} absent · ${unmarkedCount} unmarked`}
          accent="success"
        />
        <StatCard
          icon={ClipboardList}
          label="Upcoming Exams"
          value={String(upcomingExams.length)}
          sub={upcomingExams.map((e) => e.subject).slice(0, 2).join(" · ") || "No exams"}
          accent="alert"
        />
        <StatCard
          icon={BookOpenCheck}
          label="Open Homework"
          value={String(openHomework.length)}
          sub={`${overdueHomework.length} overdue`}
          accent="amber"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card
          title="Mark Attendance · Today"
          className="lg:col-span-2"
          action={
            <span className="text-[11px] font-semibold text-slate-text/60">{todayISO()}</span>
          }
        >
          {loading ? (
            <p className="text-[13px] text-slate-text py-8 text-center">Loading students…</p>
          ) : students.length === 0 ? (
            <p className="text-[13px] text-slate-text py-8 text-center">No students found in this class.</p>
          ) : (
            <>
              <div className="overflow-x-auto -mx-5 max-h-80">
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                      <th className="px-5 py-2 font-semibold">Student</th>
                      {STATUSES.map((s) => (
                        <th key={s} className="px-3 py-2 font-semibold text-center">{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s._id} className="border-t border-black/[0.06]">
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar src={s.photoUrl} name={s.name} size={30} />
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
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-black/[0.06]">
                <span className="text-[12px] text-slate-text/60">
                  Tap a status to set it, tap again to clear. {unmarkedCount} unmarked.
                </span>
                <Button onClick={saveAttendance} disabled={saving}>
                  <Save size={15} /> {saving ? "Saving…" : "Save Attendance"}
                </Button>
              </div>
            </>
          )}
        </Card>

        <Card
          title="Today's Timetable"
          action={<CalendarDays size={16} className="text-slate-text/50" />}
        >
          {isWeekend ? (
            <p className="text-[13px] text-slate-text py-8 text-center">Weekend — no classes.</p>
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
              <Link
                to="/teacher/timetable"
                className="flex items-center gap-1 text-[12px] font-semibold text-info pt-1"
              >
                Full timetable <ArrowRight size={13} />
              </Link>
            </div>
          ) : (
            <p className="text-[13px] text-slate-text py-8 text-center">No timetable published yet.</p>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card
          title="Homework & Assignments"
          className="lg:col-span-2"
          action={
            <Link to="/teacher/homework" className="text-[12px] font-semibold text-info flex items-center gap-1">
              Manage <ChevronRight size={13} />
            </Link>
          }
        >
          {loading ? (
            <p className="text-[13px] text-slate-text py-8 text-center">Loading…</p>
          ) : homework.length === 0 ? (
            <p className="text-[13px] text-slate-text py-8 text-center">Nothing assigned yet.</p>
          ) : (
            <div className="space-y-2.5">
              {homework.slice(0, 6).map((hw) => (
                <div key={hw._id} className="flex items-center justify-between gap-3 pb-2.5 border-b border-black/[0.06] last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink truncate">{hw.title}</p>
                    <p className="text-[11.5px] text-slate-text/60">Due {fmtDate(hw.dueDate)}</p>
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

        <Card
          title="Upcoming Exams"
          action={
            <Link to="/teacher/exams" className="text-[12px] font-semibold text-info flex items-center gap-1">
              View all <ChevronRight size={13} />
            </Link>
          }
        >
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
                  <Pill tone="alert">{fmtDate(ex.date)}</Pill>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card
          title="Notices"
          className="lg:col-span-2"
          action={
            <Link to="/teacher/notices" className="text-[12px] font-semibold text-info flex items-center gap-1">
              View all <ChevronRight size={13} />
            </Link>
          }
        >
          {notices.length === 0 ? (
            <p className="text-[13px] text-slate-text py-6 text-center">No notices yet.</p>
          ) : (
            <div className="space-y-3">
              {notices.slice(0, 5).map((n) => (
                <div key={n._id} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-amber" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink leading-snug">{n.title}</p>
                    <p className="text-[11.5px] text-slate-text/60 mt-0.5 line-clamp-2">{n.description || n.body || ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Class Insights"
          action={
            <Link to="/teacher/performance" className="text-[12px] font-semibold text-info flex items-center gap-1">
              Full report <ChevronRight size={13} />
            </Link>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] text-slate-text">Attendance rate</span>
              <span className="text-[14px] font-bold text-success">{attendanceRate ?? "—"}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-success rounded-full transition-all" style={{ width: `${attendanceRate ?? 0}%` }} />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-black/[0.06]">
              <span className="text-[12.5px] text-slate-text">Absent today</span>
              <span className="text-[14px] font-bold text-alert">{absentCount}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-black/[0.06]">
              <span className="text-[12.5px] text-slate-text">Leave / Half day</span>
              <span className="text-[14px] font-bold text-info">{leaveCount}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-black/[0.06]">
              <span className="text-[12.5px] text-slate-text">Open homework</span>
              <span className="text-[14px] font-bold text-ink">{openHomework.length}</span>
            </div>
            <p className="text-[11.5px] text-slate-text/50 pt-1">
              {school?.name || "School"} · Session {school?.session || "—"}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}