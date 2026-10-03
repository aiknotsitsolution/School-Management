import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  BookOpenCheck,
  CalendarDays,
  ClipboardList,
  Users,
  Save,
  Timer,
  GraduationCap,
  AlertTriangle,
  Trophy,
  Megaphone,
  CheckCircle2,
  Check,
  Clock,
  RotateCcw,
  Zap,
  UserCheck,
  CalendarRange,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  StatCard,
  Pill,
  Button,
  Avatar,
  toast,
} from "../components/UI";
import { api } from "../lib/api";
import { selectUser, selectSchool } from "../store/selectors";
import { sessionLabel } from "../lib/session";
import { useSelector } from "react-redux";
import { todayISO, fmtDate, useTeacherContext } from "./teacher/useTeacherContext";
import { EmptyBlock } from "../components/StateViews";
import {
  HeroBanner,
  GlassStat,
  QuickActions,
  MetricGrid,
  Panel,
  ViewLink,
  EmptyPanel,
  ListRow,
  Badge,
  Donut,
  StatTile,
  BarList,
  SegmentedControl,
  AlertStrip,
  DashboardSkeleton,
  ACCENTS,
  greeting,
} from "../components/dashboard/DashKit";

const WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STATUSES = ["Present", "Absent", "Leave", "Half Day"];
const STATUS_STYLE = {
  Present: "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  Absent: "bg-rose-100 text-rose-600 ring-1 ring-inset ring-rose-200",
  Leave: "bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200",
  "Half Day": "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200",
};
const STATUS_DOT = {
  Present: "bg-emerald-500",
  Absent: "bg-rose-500",
  Leave: "bg-sky-500",
  "Half Day": "bg-amber-500",
};
const STATUS_BAR = {
  Present: "bg-emerald-500",
  Absent: "bg-rose-500",
  Leave: "bg-sky-500",
  "Half Day": "bg-amber-500",
};

function toMinutes(t) {
  if (!t) return null;
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function periodStatus(period, nowMin) {
  const start = toMinutes(period.startTime);
  const end = toMinutes(period.endTime);
  if (start == null) return { key: "unscheduled", label: "Scheduled" };
  let endMin = end;
  if (endMin != null && endMin <= start) endMin += 1440;
  if (nowMin < start) {
    const diff = start - nowMin;
    if (diff <= 30) return { key: "upcoming_soon", label: `Start in ${diff} min` };
    return { key: "upcoming", label: "Upcoming" };
  }
  if (endMin == null) return { key: "ongoing", label: "In session" };
  if (nowMin >= endMin) return { key: "completed", label: "Completed" };
  return { key: "ongoing", label: `Ongoing · ${endMin - nowMin} min left` };
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

const PERIOD_TONE = {
  ongoing: "bg-emerald-100 text-emerald-700",
  upcoming_soon: "bg-sky-100 text-sky-700",
  upcoming: "bg-slate-100 text-slate-600",
  completed: "bg-slate-100 text-slate-600",
  unscheduled: "bg-slate-100 text-slate-600",
};

function PeriodCard({ period, nowMin }) {
  const st = periodStatus(period, nowMin);
  const isLive = st.key === "ongoing";
  return (
    <div
      className="relative w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-[0_12px_30px_-18px_rgba(15,23,42,0.45)]"
    >
      <span
        className="pointer-events-none absolute -right-6 -top-7 h-16 w-16 rounded-full bg-emerald-50"
        aria-hidden="true"
      />
      <div className="relative flex items-center justify-between gap-2">
        <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-600">
          P{period.periodNo ?? ""}
        </span>
        <span className="text-[11.5px] font-semibold tabular-nums text-slate-text/75">
          {period.startTime}
          {period.endTime ? ` – ${period.endTime}` : ""}
        </span>
      </div>
      <div className="relative mt-3 flex items-center gap-2.5">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            isLive ? ACCENTS.success.icon : ACCENTS.neutral.icon
          }`}
          aria-hidden="true"
        >
          <Timer size={16} />
        </span>
        <p className="truncate font-display text-[15px] font-bold leading-tight text-ink">
          {period.subject || "—"}
        </p>
      </div>
      <div className="relative mt-auto pt-3.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${PERIOD_TONE[st.key]}`}
        >
          {st.key === "ongoing" ? (
            <CheckCircle2 size={12} className="animate-pulse" aria-hidden="true" />
          ) : (
            <Clock size={12} aria-hidden="true" />
          )}
          {st.label}
        </span>
      </div>
    </div>
  );
}

export default function TeacherDashboard() {
  const user = useSelector(selectUser);
  const school = useSelector(selectSchool);
  const {
    cls,
    section,
    hasClassTeacher,
    teachingAssignments,
    teachingScopes,
    allScopes,
    activeScopeIdx,
    setActiveScope,
    loading: ctxLoading,
  } = useTeacherContext();

  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [markMap, setMarkMap] = useState({});
  const [homework, setHomework] = useState([]);
  const [exams, setExams] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [notices, setNotices] = useState([]);
  const [staff, setStaff] = useState(null);
  const [achievements, setAchievements] = useState([]);
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
      cls ? api.achievements.list(`${q}&limit=50`) : Promise.resolve({ data: [] }),
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
      setAchievements(Array.isArray(val(7)) ? val(7) : []);
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

  // Live attendance: when anyone in the school marks attendance (SSE push
  // from academic-service via the comm-service hub), refresh this class view
  // instead of showing stale data until a manual save/reload.
  useEffect(() => {
    if (!cls) return undefined;
    const unsubscribe = api.attendanceStream.subscribe({
      onData: () => {
        if (document.visibilityState !== "visible") return;
        api.attendance
          .list(q)
          .then(({ data }) => setAttendance(Array.isArray(data) ? data : []))
          .catch(() => {});
      },
    });
    return unsubscribe;
  }, [cls, q]);

  useEffect(() => {
    api.staff.attendance.meToday()
      .then(({ data }) => {
        if (!data) setShowCheckin(true);
      })
      .catch(() => setShowCheckin(true));
  }, []);

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

  const scopeQuery = (scope) =>
    `class=${encodeURIComponent(scope.class)}${scope.section ? `&section=${encodeURIComponent(scope.section)}` : ""}`;

  const setStatus = (id, status) =>
    setMarkMap((m) =>
      m[id] === status ? { ...m, [id]: undefined } : { ...m, [id]: status },
    );

  const markAll = (status) => {
    setMarkMap((m) => {
      const next = { ...m };
      students.forEach((s) => {
        next[s._id] = status;
      });
      return next;
    });
  };

  const clearAll = () => {
    setMarkMap((m) => {
      const next = {};
      Object.keys(m).forEach((k) => {
        next[k] = undefined;
      });
      return next;
    });
  };

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
      toast("Select at least one status before saving", "primary");
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

  if (!ctxLoading && !loading && !cls) {
    return (
      <div className="rounded-3xl bg-gradient-to-br from-slate-50 to-paper p-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-primary shadow-sm">
          <GraduationCap size={28} />
        </div>
        <p className="mt-5 font-display text-xl font-bold text-ink">
          {hasClassTeacher ? "No class assigned yet" : "No teaching assignment yet"}
        </p>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-slate-text">
          Contact the school admin to assign you a class, section and subject
          {sessionLabel(school) ? ` for session ${sessionLabel(school)}` : ""}.
        </p>
      </div>
    );
  }

  const academicAchievements = achievements.filter((r) => r.category === "academic").length;

  const attentionItems = [];
  if (unmarkedCount > 0) {
    attentionItems.push({
      label: `${unmarkedCount} student${unmarkedCount === 1 ? "" : "s"} with no attendance marked today`,
      tone: "alert",
      icon: AlertTriangle,
    });
  }
  if (overdueHomework.length > 0) {
    attentionItems.push({
      label: `${overdueHomework.length} homework assignment${overdueHomework.length === 1 ? "" : "s"} overdue`,
      tone: "warning",
      icon: BookOpenCheck,
    });
  }

  const quickActions = [
    { to: "/teacher/attendance", icon: CalendarCheck, label: "Mark Attendance", accent: "success" },
    { to: "/teacher/homework", icon: BookOpenCheck, label: "Assign Homework", accent: "violet" },
    { to: "/teacher/exams", icon: ClipboardList, label: "Examinations", accent: "alert" },
    { to: "/teacher/timetable", icon: CalendarRange, label: "My Timetable", accent: "warn" },
    { to: "/teacher/performance", icon: Trophy, label: "Class Insights", accent: "primary" },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <HeroBanner
        gradient="emerald"
        eyebrow={greeting()}
        name={(user?.name || "Teacher").split(" ")[0]}
        title={(user?.name || "Teacher").split(" ")[0]}
        meta={
          [
            hasClassTeacher ? `Class Teacher · Class ${cls}` : "Teacher",
            section ? `-${section}` : "",
            hasClassTeacher && students.length ? ` · ${students.length} students` : "",
            teachingAssignments.length
              ? ` · ${teachingAssignments.length} teaching assignment${teachingAssignments.length === 1 ? "" : "s"}`
              : "",
            staff?.designation ? ` · ${staff.designation}` : "",
          ]
            .filter(Boolean)
            .join("")
        }
        dateLabel={new Date().toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        image={school?.settings?.bannerImage}
        stats={
          <>
            <GlassStat value={presentCount} label="Present today" />
            <GlassStat value={openHomework.length} label="Open homework" />
            <GlassStat value={students.length} label="Students" />
          </>
        }
      />

      {/* ── Class scope switcher ──────────────────────────────────── */}
      {allScopes.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Users size={16} />
            </span>
            <div>
              <p className="text-[13px] font-bold text-ink">Active class</p>
              <p className="text-[11.5px] text-slate-text/60">
                Switch between the classes assigned to you
              </p>
            </div>
          </div>
          <SegmentedControl
            ariaLabel="Active class"
            value={activeScopeIdx}
            onChange={setActiveScope}
            options={allScopes.map((s) => ({
              value: allScopes.indexOf(s),
              label: `Class ${s.class}-${s.section || "?"}`,
            }))}
          />
        </div>
      )}

      {/* ── Quick actions ──────────────────────────────────────────── */}
      <QuickActions
        title="Quick Actions"
        icon={Zap}
        action={<ViewLink to="/teacher/timetable">Full timetable</ViewLink>}
        items={quickActions}
      />

      {attentionItems.length > 0 && (
        <Panel
          title="Attention Required"
          icon={AlertTriangle}
          iconTone={ACCENTS.alert.icon}
          subtitle="Things worth acting on today"
        >
          <AlertStrip items={attentionItems} />
        </Panel>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* ── Metric strip ───────────────────────────────────────── */}
          <MetricGrid columns={4}>
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
              sub={
                overdueHomework.length ? (
                  <span className="font-semibold text-rose-500">
                    {overdueHomework.length} overdue
                  </span>
                ) : (
                  "Nothing overdue"
                )
              }
              accent="primary"
            />
          </MetricGrid>

          <StatCard
            icon={Trophy}
            label="Achievements"
            value={String(achievements.length)}
            sub={`${academicAchievements} academic`}
            accent="success"
          />

          {/* ── Today's periods ────────────────────────────────────── */}
          <Panel
            title="Today's Teaching"
            icon={CalendarDays}
            iconTone={ACCENTS.teal.icon}
            decor="periods"
            decorTone={ACCENTS.teal.text}
            subtitle={
              isWeekend
                ? "Weekend — enjoy the break"
                : `${todayPeriods.length} period${todayPeriods.length === 1 ? "" : "s"} scheduled`
            }
            action={<ViewLink to="/teacher/timetable">Full timetable</ViewLink>}
          >
            {isWeekend ? (
              <EmptyPanel
                icon={CalendarDays}
                iconTone={ACCENTS.success.icon}
                title="Weekend — no classes"
                text="No periods are scheduled for today. Use the time to plan next week."
                action={<ViewLink to="/teacher/timetable">Full timetable</ViewLink>}
              />
            ) : todayPeriods.length ? (
              <div className="scrollbar-thin flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-1">
                {todayPeriods.map((p, i) => (
                  <PeriodCard
                    key={`${p.subject}-${p.startTime}-${i}`}
                    period={p}
                    nowMin={nowMinutes()}
                  />
                ))}
              </div>
            ) : (
              <EmptyPanel
                icon={CalendarRange}
                title="No timetable published yet"
                text="The class timetable has not been published yet, so no periods appear here."
                action={<ViewLink to="/teacher/timetable">Full timetable</ViewLink>}
              />
            )}
          </Panel>

          {/* ── Mark attendance ────────────────────────────────────── */}
          <Panel
            title="Mark Attendance · Today"
            icon={UserCheck}
            iconTone={ACCENTS.success.icon}
            subtitle={todayISO()}
            action={
              students.length > 0 && (
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => markAll("Present")}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11.5px] font-bold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    <Check size={12} /> All present
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11.5px] font-bold text-slate-600 transition hover:bg-slate-200"
                  >
                    <RotateCcw size={12} /> Reset
                  </button>
                </div>
              )
            }
          >
            {loading ? (
              <p className="py-8 text-center text-[13px] text-slate-text">Loading students…</p>
            ) : students.length === 0 ? (
              <EmptyBlock title="No students found in this class." />
            ) : (
              <>
                {/* Progress summary */}
                <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <StatTile
                    label="Marked"
                    value={`${marked.length}/${students.length}`}
                    dot="bg-slate-400"
                  />
                  <StatTile
                    label="Present"
                    value={presentCount}
                    dot={STATUS_DOT.Present}
                    tone="text-emerald-600"
                  />
                  <StatTile
                    label="Absent"
                    value={absentCount}
                    dot={STATUS_DOT.Absent}
                    tone="text-rose-500"
                  />
                  <StatTile
                    label="Leave / half"
                    value={leaveCount}
                    dot={STATUS_DOT["Half Day"]}
                    tone="text-amber-600"
                  />
                </div>

                <div className="-mx-5 max-h-[420px] overflow-x-auto overflow-y-auto sm:-mx-6">
                  <table className="w-full text-[13px]">
                    <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
                      <tr className="text-left text-[11px] uppercase tracking-wide text-slate-text/50">
                        <th className="px-5 py-2.5 font-semibold sm:px-6">Student</th>
                        {STATUSES.map((s) => (
                          <th key={s} className="px-2 py-2.5 text-center font-semibold">
                            {s}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s) => (
                        <tr
                          key={s._id}
                          className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-2.5 sm:px-6">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Avatar src={s.photoUrl} name={s.name} size={30} />
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-ink">{s.name}</p>
                                <p className="text-[11px] text-slate-text/60">
                                  {s.admissionNo}
                                  {s.rollNo ? ` · Roll ${s.rollNo}` : ""}
                                </p>
                              </div>
                            </div>
                          </td>
                          {STATUSES.map((st) => (
                            <td key={st} className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => setStatus(s._id, st)}
                                aria-pressed={markMap[s._id] === st}
                                className={`min-w-[62px] rounded-full px-2.5 py-1.5 text-[11.5px] font-bold transition-all ${
                                  markMap[s._id] === st
                                    ? `${STATUS_STYLE[st]} shadow-[0_2px_8px_-4px_rgba(15,23,42,0.4)]`
                                    : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                }`}
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

                <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-4 sm:flex-row">
                  <span className="text-[12px] text-slate-text/60">
                    Tap a status to set it, tap again to clear. {unmarkedCount} unmarked.
                  </span>
                  <Button onClick={saveAttendance} disabled={saving}>
                    <Save size={15} /> {saving ? "Saving…" : "Save Attendance"}
                  </Button>
                </div>
              </>
            )}
          </Panel>

          {/* ── Homework + exams ───────────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel
              className="lg:col-span-2"
              title="Homework & Assignments"
              icon={BookOpenCheck}
              iconTone={ACCENTS.violet.icon}
              subtitle={`${openHomework.length} open · ${overdueHomework.length} overdue`}
            action={<ViewLink to="/teacher/homework">Manage</ViewLink>}
            decor="tasks"
            decorTone={ACCENTS.violet.text}
          >
              {homework.length === 0 ? (
                <EmptyPanel
                  icon={BookOpenCheck}
                  iconTone={ACCENTS.violet.icon}
                  title="Nothing assigned yet"
                  text="Create a homework assignment and it will show up here for quick review."
                  action={<ViewLink to="/teacher/homework">Assign homework</ViewLink>}
                />
              ) : (
                <div className="space-y-2.5">
                  {homework.slice(0, 6).map((hw) => (
                    <ListRow
                      key={hw._id}
                      icon={BookOpenCheck}
                      iconTone={ACCENTS.violet.icon}
                      title={hw.title}
                      meta={`Due ${fmtDate(hw.dueDate)}`}
                      trailing={
                        <>
                          <Pill tone="primary">{hw.subject}</Pill>
                          {new Date(hw.dueDate) < new Date() && (
                            <Badge tone="alert">Overdue</Badge>
                          )}
                        </>
                      }
                    />
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title="Upcoming Exams"
              icon={ClipboardList}
              iconTone={ACCENTS.alert.icon}
              action={<ViewLink to="/teacher/exams">View all</ViewLink>}
            >
              {upcomingExams.length === 0 ? (
                <EmptyPanel
                  icon={ClipboardList}
                  iconTone={ACCENTS.alert.icon}
                  title="No exams scheduled"
                  text="Examination schedules created by the school will appear here."
                />
              ) : (
                <div className="space-y-2.5">
                  {upcomingExams.slice(0, 6).map((ex) => (
                    <ListRow
                      key={ex._id}
                      icon={ClipboardList}
                      iconTone={ACCENTS.alert.icon}
                      title={ex.subject}
                      meta={ex.examName}
                      trailing={<Badge tone="warning">{fmtDate(ex.date)}</Badge>}
                    />
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {/* ── Insights + scopes ──────────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel
              title="Class Insights"
              icon={Trophy}
              iconTone={ACCENTS.primary.icon}
              subtitle={`${school?.name || "School"} · Session ${sessionLabel(school) || "—"}`}
              action={<ViewLink to="/teacher/performance">Full report</ViewLink>}
            >
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                <Donut
                  value={attendanceRate ?? 0}
                  color="text-success"
                  label={attendanceRate != null ? `${attendanceRate}%` : "—"}
                  sublabel="Attendance"
                />
                <div className="w-full flex-1">
                  <BarList
                    accent="primary"
                    showPct={false}
                    items={[
                      { label: "Present today", value: presentCount, barClass: STATUS_BAR.Present },
                      { label: "Absent today", value: absentCount, barClass: STATUS_BAR.Absent },
                      {
                        label: "Leave / half day",
                        value: leaveCount,
                        barClass: "bg-amber-500",
                      },
                      { label: "Not marked", value: unmarkedCount, barClass: "bg-slate-300" },
                    ]}
                  />
                </div>
              </div>
            </Panel>

            <Panel
              className="lg:col-span-2"
              title="My Teaching"
              icon={GraduationCap}
              iconTone={ACCENTS.teal.icon}
              subtitle={`${teachingScopes.length} teaching scope${teachingScopes.length === 1 ? "" : "s"}`}
            >
              {teachingScopes.length === 0 ? (
                <EmptyPanel
                  icon={GraduationCap}
                  iconTone={ACCENTS.teal.icon}
                  title="No teaching scopes assigned"
                  text="Once the school admin assigns you subjects, they will be listed here."
                />
              ) : (
                <div className="space-y-2.5">
                  {teachingScopes.slice(0, 6).map((scope, i) => {
                    const subjects = scope.subjects?.length ? scope.subjects.join(", ") : null;
                    return (
                      <ListRow
                        key={`${scope.class}-${scope.section || ""}-${i}`}
                        icon={GraduationCap}
                        iconTone={ACCENTS.teal.icon}
                        title={`Class ${scope.class}${scope.section ? `-${scope.section}` : ""}`}
                        meta={subjects || "All subjects"}
                        trailing={
                          <>
                            <Link
                              to={`/teacher/timetable?${scopeQuery(scope)}`}
                              className="whitespace-nowrap rounded-lg bg-sky-50 px-2.5 py-1 text-[11.5px] font-bold text-sky-700 transition hover:bg-sky-100"
                            >
                              Timetable
                            </Link>
                            <Link
                              to={`/teacher/attendance?${scopeQuery(scope)}`}
                              className="whitespace-nowrap rounded-lg bg-emerald-50 px-2.5 py-1 text-[11.5px] font-bold text-emerald-700 transition hover:bg-emerald-100"
                            >
                              Attendance
                            </Link>
                          </>
                        }
                      />
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          {/* ── Notices ────────────────────────────────────────────── */}
          <Panel
            title="Notices"
            icon={Megaphone}
            iconTone={ACCENTS.warn.icon}
            subtitle="Announcements from the school"
            action={<ViewLink to="/teacher/notices">View all</ViewLink>}
          >
            {notices.length === 0 ? (
              <EmptyPanel
                icon={Megaphone}
                iconTone={ACCENTS.warn.icon}
                title="No notices yet"
                text="School announcements and circulars will appear here."
              />
            ) : (
              <div className="grid gap-2.5 md:grid-cols-2">
                {notices.slice(0, 6).map((n) => (
                  <ListRow
                    key={n._id}
                    icon={Megaphone}
                    iconTone={ACCENTS.warn.icon}
                    title={n.title}
                    description={n.description || n.body || ""}
                    meta={fmtDate(n.createdAt)}
                  />
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
