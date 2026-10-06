import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  BookOpenCheck,
  CalendarCheck,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Coins,
  CreditCard,
  Megaphone,
  Plus,
  Sun,
  Trophy,
  Zap,
} from "lucide-react";
import { Card, StatCard } from "../../components/UI";
import { QuickActions as QuickActionRail, ACCENTS } from "../../components/dashboard/DashKit";
import PageArtwork, { artworkForLucide } from "../../components/PageArtwork";
import {
  TrendArea,
  BarRowChart,
  Donut,
  Sparkline,
  ProgressRing,
  StatusStrip,
} from "../../components/studentcharts/StudentCharts";
import { ATT_ORDER, ATT_STATUS, toneFor } from "../../components/studentcharts/theme";
import { computeGrade } from "../../lib/grading";
import { api } from "../../lib/api";
import useStudentContext, {
  fmtDate,
  fmtMoney,
  greeting,
  dateOf,
} from "./useStudentContext";
import studentHeroImage from "../../assets/dashboard-images/Student-dashboard-image.png";
import MomentumStrip from "../../components/student/MomentumStrip";
import MomentumTicker from "../../components/student/MomentumTicker";
import OnTrackCard from "../../components/student/OnTrackCard";
import ValueStrip from "../../components/student/ValueStrip";

const WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const QUICK_ACTIONS = [
  { to: "/student/attendance", label: "My Attendance", icon: CalendarCheck, accent: "alert" },
  { to: "/student/timetable", label: "My Timetable", icon: CalendarRange, accent: "info" },
  { to: "/student/homework", label: "Homework & Assignments", icon: BookOpen, accent: "violet" },
  { to: "/student/exams", label: "Examinations", icon: ClipboardList, accent: "success" },
  { to: "/student/results", label: "Results / Report Card", icon: Trophy, accent: "warn" },
  // Same online checkout the parent portal links to; OnlinePayment reads only
  // this account's own invoices for a student session.
  { to: "/online-payment", label: "Pay Fees Online", icon: CreditCard, accent: "success" },
];

const ATT_DOT = {
  Present: "bg-emerald-500",
  Absent: "bg-rose-500",
  Leave: "bg-blue-600",
  "Half Day": "bg-amber-500",
};

const ATT_VALUE = {
  Present: "text-emerald-600",
  Absent: "text-rose-500",
  Leave: "text-blue-600",
  "Half Day": "text-amber-500",
};

const BADGE = {
  success: "bg-emerald-100 text-emerald-700",
  alert: "bg-rose-100 text-rose-600",
  warning: "bg-amber-100 text-amber-700",
  info: "bg-blue-100 text-blue-700",
};

const SUBJECT_TONES = {
  Hindi: "bg-violet-50 text-violet-600",
  English: "bg-indigo-50 text-indigo-600",
  Maths: "bg-blue-50 text-blue-600",
  Mathematics: "bg-blue-50 text-blue-600",
  EVS: "bg-emerald-50 text-emerald-600",
  Science: "bg-emerald-50 text-emerald-600",
  Social: "bg-teal-50 text-teal-600",
  "Social Science": "bg-teal-50 text-teal-600",
  Art: "bg-pink-50 text-pink-600",
  "G.K.": "bg-cyan-50 text-cyan-600",
};

const FALLBACK_SUBJECT_TONES = [
  "bg-blue-50 text-blue-600",
  "bg-violet-50 text-violet-600",
  "bg-emerald-50 text-emerald-600",
  "bg-amber-50 text-amber-600",
  "bg-rose-50 text-rose-600",
];

function subjectTone(subject) {
  const key = String(subject || "").trim();
  if (SUBJECT_TONES[key]) return SUBJECT_TONES[key];
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) % 997;
  return FALLBACK_SUBJECT_TONES[hash % FALLBACK_SUBJECT_TONES.length];
}

function toMinutes(t) {
  if (!t) return null;
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function format12h(t) {
  if (!t) return "—";
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(t);
  let h = parseInt(m[1], 10) % 12;
  if (h === 0) h = 12;
  const suffix = parseInt(m[1], 10) >= 12 ? "PM" : "AM";
  return `${h}:${m[2]} ${suffix}`;
}

function timeRange(period) {
  const from = format12h(period.startTime);
  const to = format12h(period.endTime);
  if (from === "—") return "—";
  return period.endTime ? `${from} – ${to}` : from;
}

function amPm(period) {
  const start = period.startTime;
  if (!start) return "";
  const hour = parseInt(String(start).split(":")[0], 10);
  if (Number.isNaN(hour)) return "";
  return hour < 12 ? "AM" : "PM";
}

function classStatus(period, nowMin) {
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
  const rem = endMin - nowMin;
  return { key: "ongoing", label: `Ongoing · ${rem} min left` };
}

function fmtShort(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function daysUntil(value) {
  const d = dateOf(value);
  if (!d) return null;
  const today = dateOf(new Date());
  return Math.round((new Date(`${d}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000);
}

function ViewLink({ to, children }) {
  return (
    <Link
      className="group/link inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-semibold text-info transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40 rounded"
      to={to}
    >
      {children}
      <ChevronRight size={14} className="transition-transform group-hover/link:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

function PanelIcon({ tone = "bg-blue-50 text-blue-600", children }) {
  return (
    <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`} aria-hidden="true">
      {children}
    </span>
  );
}

function EmptyPanel({ icon: Icon, title, text, action, iconTone = "bg-blue-50 text-blue-500" }) {
  const art = artworkForLucide(Icon);
  return (
    <div className="py-10 px-4 text-center">
      {art ? (
        <PageArtwork name={art} size={56} className="mx-auto" />
      ) : (
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${iconTone}`} aria-hidden="true">
          <Icon size={24} />
        </div>
      )}
      <p className="mt-4 text-[14.5px] font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-[34ch] text-[12.5px] leading-relaxed text-slate-text/70">{text}</p>
      {action && <div className="mt-3.5 flex justify-center">{action}</div>}
    </div>
  );
}

function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} aria-hidden="true" />;
}

function AttStat({ label, value, status }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${ATT_DOT[status]}`} aria-hidden="true" />
        <span className="text-[12px] font-medium text-slate-text/80">{label}</span>
      </div>
      <p className={`font-display text-[22px] font-bold leading-none mt-2 ${ATT_VALUE[status]}`}>{value}</p>
    </div>
  );
}

function Badge({ tone, children }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${BADGE[tone]}`}>
      {children}
    </span>
  );
}

function AssignmentItem({ h }) {
  const status = h.submission ? "Completed" : h.overdue ? "Overdue" : "Pending";
  const tone = status === "Completed" ? "success" : status === "Overdue" ? "alert" : "warning";
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-blue-200 hover:bg-blue-50/40">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600" aria-hidden="true">
        <BookOpen size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate text-[13.5px] font-bold leading-snug text-ink">{h.title}</p>
          <Badge tone={tone}>{status}</Badge>
        </div>
        <p className="mt-1 truncate text-[11.5px] text-slate-text/70">
          {h.subject} · Assigned {fmtDate(h.assignedDate)} · Due {fmtDate(h.dueDate)}
        </p>
        {h.description && (
          <p className="mt-1 line-clamp-1 text-[12px] text-slate-text/70">{h.description}</p>
        )}
      </div>
    </div>
  );
}

function ExamDateBadge({ value }) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return <span className="shrink-0 text-[12px] text-slate-text">{fmtDate(value)}</span>;
  }
  return (
    <div className="w-11 shrink-0 rounded-lg border border-blue-100 bg-blue-50 py-1.5 text-center text-blue-700" aria-hidden="true">
      <p className="font-display text-[15px] font-bold leading-none">{d.getDate()}</p>
      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide">
        {d.toLocaleDateString("en-IN", { month: "short" })}
      </p>
    </div>
  );
}

function ExamItem({ ex }) {
  const days = daysUntil(ex.date);
  const dayLabel =
    days === 0 ? "Today" : days === 1 ? "Tomorrow" : days != null && days > 0 ? `${days} days left` : "";
  const tone = days != null && days <= 3 ? "warning" : "info";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-blue-200 hover:bg-blue-50/40">
      <ExamDateBadge value={ex.date} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-bold leading-snug text-ink">{ex.examName}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-slate-text/70">
          {ex.subject}
          {ex.type ? ` · ${ex.type}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {dayLabel && <Badge tone={tone}>{dayLabel}</Badge>}
        <span className="text-[11px] text-slate-text/60">{fmtDate(ex.date)}</span>
      </div>
    </div>
  );
}

function NoticeItem({ n }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl p-3.5 transition-colors ${
        n.pinned ? "border border-blue-100 bg-blue-50/60" : "border border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600" aria-hidden="true">
        <Megaphone size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-[13px] font-bold leading-snug text-ink">{n.title}</p>
        <p className="mt-1 truncate text-[11.5px] text-slate-text/70">
          {n.senderName || n.category || "School Administration"} · {fmtDate(n.createdAt)}
        </p>
        {n.description && (
          <p className="mt-0.5 line-clamp-2 text-[11.5px] text-slate-text/70">{n.description}</p>
        )}
      </div>
    </div>
  );
}

function ClassCard({ period, cls, section, nowMin }) {
  const st = classStatus(period, nowMin);
  const statusTone = {
    ongoing: "bg-emerald-100 text-emerald-700",
    upcoming_soon: "bg-blue-100 text-blue-700",
    upcoming: "bg-slate-100 text-slate-600",
    completed: "bg-slate-100 text-slate-600",
    unscheduled: "bg-slate-100 text-slate-600",
  }[st.key];
  const isLive = st.key === "ongoing";
  return (
    <article
      role="listitem"
      className="relative flex w-[248px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-[0_12px_30px_-18px_rgba(15,23,42,0.45)]"
    >
      <span
        className="pointer-events-none absolute -right-6 -top-7 h-16 w-16 rounded-full bg-blue-50"
        aria-hidden="true"
      />
      <div className="relative flex items-center justify-between gap-2">
        <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-600">
          {amPm(period)}
        </span>
        <span className="text-[12px] font-semibold tabular-nums text-slate-text/90">{timeRange(period)}</span>
      </div>
      <div className="relative mt-3 flex items-center gap-2.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${subjectTone(period.subject)}`} aria-hidden="true">
          <BookOpen size={16} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-[15px] font-bold leading-tight text-ink">
            {period.subject || "—"}
          </p>
          <p className="truncate text-[12px] text-slate-text/70">
            {period.teacherName || "Teacher not assigned"}
          </p>
        </div>
      </div>
      <p className="relative mt-1.5 text-[11.5px] text-slate-text/60">
        {cls ? `Class ${cls}${section ? `-${section}` : ""}` : ""}
      </p>
      <div className="relative mt-auto pt-3.5">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone}`}>
          {st.key === "ongoing" ? (
            <CheckCircle2 size={12} className={isLive ? "animate-pulse" : ""} aria-hidden="true" />
          ) : st.key === "upcoming_soon" ? (
            <Plus size={12} aria-hidden="true" />
          ) : st.key === "completed" ? (
            <CheckCircle2 size={12} aria-hidden="true" />
          ) : (
            <Clock size={12} aria-hidden="true" />
          )}
          {st.label}
        </span>
      </div>
    </article>
  );
}

function LoadingDashboard() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your dashboard…</span>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[132px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[300px] rounded-2xl" />
      <Skeleton className="h-[230px] rounded-2xl" />
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-[240px] rounded-2xl lg:col-span-2" />
        <Skeleton className="h-[240px] rounded-2xl" />
      </div>
    </div>
  );
}

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
    submissions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
const [now, setNow] = useState(() => new Date());
const [canScroll, setCanScroll] = useState({ left: false, right: true });

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");

    const run = async () => {
      // /students/me is the authoritative profile and needs no class/section, so
      // it resolves first: the JWT `user` claim may not carry them, which would
      // otherwise send the class-scoped calls below with empty values and get
      // back nothing. Still exactly one profile request, no second fetch.
      let profile = null;
      let profileFailed = false;
      try {
        profile = (await api.students.me()).data || null;
      } catch {
        profileFailed = true;
      }
      if (!alive) return;

      const scopedCls = profile?.class || cls || "";
      const scopedSection = profile?.section || section || "";

      // Every entry below is an api.* call that resolves to { success, data },
      // which `value()` unwraps. The profile promise has to be wrapped into that
      // same shape: `profile` is ALREADY the unwrapped student document, so
      // unwrapping it a second time produced `undefined` and silently dropped
      // class/section from the hero — only the JWT's name/refId survived.
      const results = await Promise.allSettled([
        profileFailed ? Promise.reject(new Error("profile")) : Promise.resolve({ data: profile }),
        api.attendance.list(),
        api.timetable.list(`class=${encodeURIComponent(scopedCls)}&section=${encodeURIComponent(scopedSection)}`),
        api.homework.list(`class=${encodeURIComponent(scopedCls)}&section=${encodeURIComponent(scopedSection)}`),
        api.exams.list(`class=${encodeURIComponent(scopedCls)}`),
        api.marks.reportCard(),
        api.fees.invoices.list(),
        api.notices.list(),
        api.homework.submissions.myList(),
      ]);
      if (!alive) return;

      const value = (i) => (results[i].status === "fulfilled" ? results[i].value.data : null);
      if (results[0].status === "rejected") {
        setError("We couldn't load your data. Please sign out and sign in again.");
      }
      setData({
        profile: value(0),
        attendance: value(1) || [],
        timetable: value(2) || [],
        homework: value(3) || [],
        exams: value(4) || [],
        marks: value(5) || { subjects: [], percentage: 0, totalObtained: 0, totalMax: 0 },
        invoices: value(6) || [],
        notices: value(7) || [],
        submissions: value(8) || [],
      });
      setLoading(false);
    };

    run();
    return () => { alive = false; };
  }, [cls, section]);

  const { profile, attendance, timetable, homework, exams, marks, invoices, notices, submissions } = data;

  // Class/section for display. /students/me is authoritative; the JWT claim is
  // only a fallback so the first paint is never blank.
  const activeCls = profile?.class || cls || "";
  const activeSection = profile?.section || section || "";

  const name = profile?.name || user?.name || "Student";
  const firstName = name.split(" ")[0];
  const admissionNo = profile?.admissionNo || user?.refId || "";
  const dateLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Meta line under the greeting: class/section, admission number and — when
  // the staff DB has an assignment — the class teacher. Empty pieces are
  // dropped rather than rendered as "Class Teacher: ", so the line reads clean
  // when the profile or the class-teacher lookup comes back partial.
  const heroMeta = [
    activeCls ? `Class ${activeCls}${activeSection ? `-${activeSection}` : ""}` : "",
    admissionNo ? `Admission ${admissionNo}` : "",
    profile?.classTeacher ? `Class Teacher: ${profile.classTeacher}` : "",
  ]
    .filter(Boolean)
    .join(" • ");

  const hwClass = useMemo(() => {
    const today = dateOf(new Date());
    const subByHw = {};
    (submissions || []).forEach((s) => {
      subByHw[String(s.homeworkId)] = s;
    });
    return (homework || []).map((h) => ({
      ...h,
      overdue: h.dueDate && dateOf(h.dueDate) < today,
      dueSoon: h.dueDate && dateOf(h.dueDate) >= today,
      submission: subByHw[String(h._id)] || null,
    }));
  }, [homework, submissions]);

  const hwOverdue = hwClass.filter((h) => h.overdue).length;

  const attPct = useMemo(() => {
    if (!attendance.length) return 0;
    const counted = attendance.filter((a) => a.status === "Present" || a.status === "Half Day").length;
    return Math.round((counted / attendance.length) * 100);
  }, [attendance]);

  const byStatus = useMemo(() => {
    const m = { Present: 0, Absent: 0, Leave: 0, "Half Day": 0 };
    attendance.forEach((a) => {
      if (m[a.status] !== undefined) m[a.status] += 1;
    });
    return m;
  }, [attendance]);

  /** Month-by-month attendance % — the trend behind the headline ring. */
  const attendanceTrend = useMemo(() => {
    const buckets = new Map();
    attendance.forEach((a) => {
      const d = new Date(a.date);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!buckets.has(key)) {
        buckets.set(key, {
          label: d.toLocaleDateString("en-IN", { month: "short" }),
          fullLabel: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
          order: d.getFullYear() * 12 + d.getMonth(),
          hit: 0,
          total: 0,
        });
      }
      const b = buckets.get(key);
      b.total += 1;
      if (a.status === "Present" || a.status === "Half Day") b.hit += 1;
    });
    return [...buckets.values()]
      .sort((a, b) => a.order - b.order)
      .map((b) => ({ ...b, value: b.total ? Math.round((b.hit / b.total) * 100) : 0 }));
  }, [attendance]);

  /** Status split for the donut — same colours as the ring and status pills. */
  const attendanceSplit = useMemo(
    () =>
      ATT_ORDER.filter((k) => byStatus[k] > 0).map((k) => ({
        name: ATT_STATUS[k].label,
        value: byStatus[k],
        color: ATT_STATUS[k].key,
      })),
    [byStatus],
  );

  const todayISO = dateOf(new Date());

  const feesTotal = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const paidAmount = invoices.reduce((s, i) => s + Number(i.paidAmount || 0), 0);
  const pendingDue = Math.max(0, feesTotal - paidAmount);

  const todayIdx = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayRow = timetable.find((t) => t.day === WEEK[todayIdx]);
  const todayPeriods = (todayRow?.periods || []).filter((p) => p.subject !== "Break");
  // The timetable is the source of truth for which days the school runs — this
  // one is Mon–Sat, so a hardcoded Sat/Sun check used to report "weekend" on a
  // Saturday that has 5 periods and hide them. `isWeekendDay` now only picks
  // the wording; whether a day has classes comes from the data below.
  const hasTimetable = timetable.length > 0;
  const isDayOff = hasTimetable && todayPeriods.length === 0;
  const isWeekendDay = todayIdx === 0 || todayIdx === 6;
  const nextClassDay = hasTimetable
    ? [...Array(7).keys()]
        .map((i) => WEEK[(todayIdx + 1 + i) % 7])
        .find((day) =>
          (timetable.find((t) => t.day === day)?.periods || []).some((p) => p.subject !== "Break"),
        )
    : null;

  const classesRef = useRef(null);

  const syncClassScroll = () => {
    const el = classesRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const overflow = max > 4;
    setCanScroll({
      left: overflow && el.scrollLeft > 4,
      right: overflow && el.scrollLeft < max - 4,
    });
  };

  useEffect(() => {
    const frame = requestAnimationFrame(syncClassScroll);
    return () => cancelAnimationFrame(frame);
  }, [todayPeriods.length, loading]);

  const scrollClasses = (dir) => {
    const el = classesRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 272, behavior: "smooth" });
  };

  const handleClassesKeyDown = (e) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollClasses(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollClasses(-1);
    }
  };

  const upcomingExams = [...(exams || [])]
    .filter((e) => new Date(e.date) >= new Date(`${todayISO}T00:00:00`))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);

  const resultsByExam = useMemo(() => {
    const group = {};
    (marks.subjects || []).forEach((m) => {
      const key = m.examName || "All";
      if (!group[key]) group[key] = [];
      group[key].push(m);
    });
    return Object.entries(group)
      .map(([examName, subjects]) => {
        const obtained = subjects.reduce((s, m) => s + (Number(m.marksObtained) || 0), 0);
        const max = subjects.reduce((s, m) => s + (Number(m.maxMarks) || 0), 0);
        const dates = subjects.map((m) => m.date).filter(Boolean).sort();
        return {
          examName,
          subjects,
          obtained,
          max,
          pct: max ? Math.round((obtained / max) * 100) : 0,
          lastDate: dates.length ? dates[dates.length - 1] : "",
        };
      })
      .sort((a, b) => (a.lastDate || "").localeCompare(b.lastDate || ""));
  }, [marks]);

  // Newest 7 attendance records, in chronological display order (oldest → newest
  // left to right). The endpoint returns `.sort({ date: -1 })`, so the previous
  // `attendance.slice(-7).reverse()` took the seven OLDEST rows. Sorted on a copy
  // so `attendance` itself is never mutated — the percentage, status-count and
  // month-trend memos above keep reading the original array unchanged.
  const recentAttendance = useMemo(
    () =>
      [...attendance]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 7)
        .reverse(),
    [attendance],
  );

  const latestExam = resultsByExam.length ? resultsByExam[resultsByExam.length - 1] : null;

  /** Recent days rendered as the status strip instead of plain text pills. */
  const recentStatus = recentAttendance.map((a, i) => ({
    id: `${a.date}-${i}`,
    color: (ATT_STATUS[a.status] || {}).key || "slateLight",
    label: `${fmtShort(a.date)} · ${a.status}`,
  }));

  /** Subject-wise marks for the latest exam, ordered by percentage. */
  const subjectPerformance = useMemo(() => {
    if (!latestExam) return [];
    return latestExam.subjects
      .map((m) => {
        const pct = m.maxMarks ? Math.round((m.marksObtained / m.maxMarks) * 100) : 0;
        return {
          id: m._id,
          label: m.subject,
          value: pct,
          obtained: m.marksObtained,
          maxMarks: m.maxMarks,
          grade: m.grade || computeGrade(m.marksObtained, m.maxMarks),
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [latestExam]);

  /** Exam-over-exam overall %, so progress across terms is visible at a glance. */
  const examSeries = useMemo(
    () => resultsByExam.map((e) => ({ label: e.examName, value: e.pct })),
    [resultsByExam],
  );

  const nextInvoice =
    [...invoices]
      .filter((i) => Number(i.amount || 0) - Number(i.paidAmount || 0) > 0.5)
      .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")))[0] || null;

  const topNotices = [...notices]
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 3);

    // Every assignment that is due today or later and has not been submitted — i.e.
  // all pending future homework, with no 7-day bound. Named for what it counts so
  // the card label below describes the data honestly.
  const pendingSubmitCount = hwClass.filter((h) => h.dueSoon && !h.submission).length;
  const submittedCount = hwClass.filter((h) => h.submission).length;
  const submissionPct = hwClass.length ? Math.round((submittedCount / hwClass.length) * 100) : null;
  const examPct = latestExam ? latestExam.pct : marks.percentage || null;
  const nextExam = upcomingExams[0];

  const heroValues = [
    isDayOff
      ? {
          icon: Clock,
          label: "Today",
          value: isWeekendDay ? "Week off" : "Day off",
          sub: "No classes",
          color: "#0C47CF",
        }
      : { icon: Clock, label: "Today", value: `${todayPeriods.length} periods`, sub: "Scheduled", color: "#0C47CF" },
    pendingSubmitCount
      // Was "Due soon" / "This week" — but `dueSoon` means dueDate >= today, so
      // the count is unbounded into the future, not a 7-day window. Relabelled to
      // "To submit" / "Pending" to match MomentumTicker's wording. Icon, colour
      // and layout untouched.
      ? { icon: ClipboardList, label: "To submit", value: `${pendingSubmitCount} assignments`, sub: "Pending", color: "#E9424E" }
      : { icon: ClipboardList, label: "To submit", value: "All clear", sub: "Nothing pending", color: "#E9424E" },
    nextExam
      ? { icon: CalendarDays, label: "Next exam", value: fmtDate(nextExam.date), sub: `${upcomingExams.length} scheduled`, color: "#16A34A" }
      : { icon: CalendarDays, label: "Next exam", value: "None scheduled", sub: "Check exams", color: "#16A34A" },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── Greeting banner ─────────────────────────────────────────── */}
      <section
        aria-label="Greeting"
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0A39A3] via-[#0C47CF] to-[#2B4180] ring-1 ring-inset ring-white/15"
      >
        <img
          src={studentHeroImage}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 h-full w-[52%] object-cover object-[68%_50%] saturate-[1.15] opacity-95 [mask-image:linear-gradient(to_right,transparent,black_55%)] sm:w-[58%] lg:w-[64%]"
        />
        <span
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent"
          aria-hidden="true"
        />
        <span className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full bg-white/10" aria-hidden="true" />
        <span className="pointer-events-none absolute -bottom-24 left-16 h-56 w-56 rounded-full bg-white/5" aria-hidden="true" />

        <div className="relative z-10 flex min-h-[206px] items-center gap-6 p-6 sm:min-h-[228px] sm:p-8">
          <div className="min-w-0 max-w-full lg:max-w-[44%]">
            <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">
              <Sun size={15} className="text-amber-300" aria-hidden="true" />
              {greeting()},
            </p>
            <h1 className="mt-2 font-display text-[30px] font-bold leading-[1.06] tracking-tight text-white sm:text-[42px]">
              {firstName}
            </h1>
            {heroMeta ? (
              <p className="mt-2 text-[13.5px] leading-relaxed text-white/85">{heroMeta}</p>
            ) : null}
            <span className="mt-3.5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-[12.5px] font-medium text-white">
              <CalendarDays size={14} aria-hidden="true" />
              {dateLabel}
            </span>

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <Link
                to="/student/timetable"
                className="group inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-ink shadow-[0_12px_28px_-18px_rgba(11,25,44,0.95)] transition-colors hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                View timetable
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
              <Link
                to="/student/results"
                className="inline-flex items-center gap-2 rounded-full border border-white/45 bg-white/10 px-4 py-2 text-[12.5px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                See progress
              </Link>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-[13px] font-semibold text-rose-600">{error}</p>
        </div>
      )}

      <MomentumTicker
        attendance={attendance}
        homework={homework}
        submissions={submissions}
        exams={exams}
        marks={marks}
        pendingDue={pendingDue}
      />

      <ValueStrip items={heroValues} />

      <MomentumStrip
        attendance={attendance}
        homework={homework}
        submissions={submissions}
        marks={marks}
      />

      {/* ── Quick actions ───────────────────────────────────────────── */}
      <QuickActionRail
        title="Quick Actions"
        icon={Zap}
        action={<ViewLink to="/student/timetable">View All</ViewLink>}
        items={QUICK_ACTIONS}
      />

      {loading ? (
        <LoadingDashboard />
      ) : (
        <>
          {/* ── Metric strip ────────────────────────────────────────── */}
          <section aria-label="Key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={CalendarCheck2}
              accent="alert"
              label="Attendance"
              value={`${attPct}%`}
              sub={`${byStatus.Present} present of ${attendance.length} recorded`}
              chart={<Sparkline data={attendanceTrend} color="success" height={30} />}
            />
            <StatCard
              icon={BookOpenCheck}
              accent="primary"
              label="Homework"
              value={String(hwClass.length)}
              sub={
                hwOverdue ? (
                  <span className="font-semibold text-rose-500">{hwOverdue} overdue</span>
                ) : hwClass.length ? (
                  "Nothing overdue"
                ) : (
                  "No homework yet"
                )
              }
            />
            <StatCard
              icon={CalendarDays}
              accent="info"
              label="Upcoming Exams"
              value={String(upcomingExams.length)}
              sub={upcomingExams.length ? "Scheduled ahead" : "Nothing scheduled"}
            />
            <StatCard
              icon={CreditCard}
              accent="success"
              label="Fees Due"
              value={fmtMoney(pendingDue)}
              sub={feesTotal ? `of ${fmtMoney(feesTotal)} invoiced` : "No invoices yet"}
            />
          </section>

          {/* ── Today's classes ─────────────────────────────────────── */}
          <Card
            title={
              <span className="flex items-center gap-2.5">
                <PanelIcon>
                  <CalendarDays size={15} />
                </PanelIcon>
                <span className="font-display text-[15.5px] font-bold text-ink">Today's Classes</span>
              </span>
            }
            action={<ViewLink to="/student/timetable">Full timetable</ViewLink>}
            headerClassName="px-5 sm:px-6 pt-5 pb-0"
            bodyClassName="px-5 sm:px-6 pb-5 pt-4"
            decor="periods"
          >
            {/* Same soft-circle decor as OnTrackCard ("Needs attention"): theme
                tokens at 8% opacity, so both hues flip with the mode instead of
                a fixed pastel that only reads on a light surface. */}
            <span
              className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-primary/8"
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute -left-12 -bottom-10 h-32 w-32 rounded-full bg-[#E9424E]/8"
              aria-hidden="true"
            />
            {isDayOff ? (
              <EmptyPanel
                icon={CalendarCheck}
                iconTone="bg-emerald-50 text-emerald-500"
                title={isWeekendDay ? "Weekend — no classes today" : "No classes scheduled today"}
                text={
                  nextClassDay
                    ? `${isWeekendDay ? "Enjoy your day off. " : ""}Your next classes are on ${nextClassDay}.`
                    : isWeekendDay
                      ? "Enjoy your day off."
                      : "No classes are scheduled today."
                }
                action={<ViewLink to="/student/timetable">Full timetable</ViewLink>}
              />
            ) : todayPeriods.length ? (
              <div className="relative">
                <div
                  role="list"
                  aria-label="Today's classes"
                  tabIndex={0}
                  ref={classesRef}
                  onScroll={syncClassScroll}
                  onKeyDown={handleClassesKeyDown}
                  className="scrollbar-hidden flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40 rounded-xl"
                >
                  {todayPeriods.map((p, i) => (
                    <ClassCard key={`${p.subject}-${p.startTime}-${i}`} period={p} cls={activeCls} section={activeSection} nowMin={nowMin} />
                  ))}
                </div>

                {todayPeriods.length > 1 && (
                  <button
                    type="button"
                    onClick={() => scrollClasses(-1)}
                    disabled={!canScroll.left}
                    aria-label="Scroll classes left"
                    className="absolute -left-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-text shadow-md transition hover:text-info disabled:cursor-not-allowed disabled:opacity-40 sm:flex"
                  >
                    <ChevronLeft size={18} />
                  </button>
                )}
                {todayPeriods.length > 1 && (
                  <>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-0 top-0 hidden h-full w-14 bg-gradient-to-l from-white via-white/80 to-transparent sm:block"
                    />
                    <button
                      type="button"
                      onClick={() => scrollClasses(1)}
                      disabled={!canScroll.right}
                      aria-label="Scroll classes right"
                      className="absolute -right-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-info text-white shadow-[0_10px_24px_-10px_rgba(37,99,235,0.9)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <EmptyPanel
                icon={CalendarDays}
                title="No timetable published for today"
                text="Your class teacher has not published a timetable for today yet."
                action={<ViewLink to="/student/timetable">Full timetable</ViewLink>}
              />
            )}

          </Card>

          <OnTrackCard
            attendancePct={attPct}
            attendanceCount={attendance.length}
            submissionPct={submissionPct}
            submittedCount={submittedCount}
            totalCount={hwClass.length}
            examPct={examPct}
          />

          {/* ── Attendance overview ─────────────────────────────────── */}
          <Card
            title={
              <span className="flex items-center gap-2.5">
                <PanelIcon>
                  <BarChart3 size={15} />
                </PanelIcon>
                <span className="font-display text-[15.5px] font-bold text-ink">Attendance Overview</span>
              </span>
            }
            action={<ViewLink to="/student/attendance">View all</ViewLink>}
            headerClassName="px-5 sm:px-6 pt-5 pb-0"
            bodyClassName="px-5 sm:px-6 pb-5 pt-4"
            decor="attend"
            decorTone={ACCENTS.info.text}
          >
            {attendance.length === 0 ? (
              <EmptyPanel
                icon={CalendarCheck}
                iconTone="bg-emerald-50 text-emerald-500"
                title="No attendance records yet"
                text="Your daily attendance will appear here once classes begin."
              />
            ) : (
              <div>
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
                  <div className="flex shrink-0 flex-col items-center gap-1.5">
                    <ProgressRing
                      value={attPct}
                      size={140}
                      stroke={12}
                      color="success"
                      label="Attendance"
                      ariaLabel={`Overall attendance ${attPct} percent`}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-text/60">
                      Month by month
                    </p>
                    <div className="mt-2">
                <TrendArea
                  data={attendanceTrend}
                  height={190}
                  color="info"
                  tooltipLabel="Attendance"
                  footerFor={(p) => `${p.hit} of ${p.total} days`}
                />
                    </div>
                  </div>

                  <div className="shrink-0 lg:w-[250px]">
                    <Donut
                      data={attendanceSplit}
                      height={168}
                      centerValue={attendance.length}
                      centerLabel="Records"
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-3.5 lg:grid-cols-4">
                  {ATT_ORDER.map((k) => (
                    <AttStat key={k} label={ATT_STATUS[k].label} value={byStatus[k]} status={k} />
                  ))}
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3.5">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-text/60">
                    Recent activity
                  </p>
                  <div className="mt-2.5">
                    <StatusStrip items={recentStatus} />
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* ── Homework + Exams ────────────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Card
              className="lg:col-span-2"
              title={
                <span className="flex items-center gap-2.5">
                  <PanelIcon>
                    <BookOpenCheck size={15} />
                  </PanelIcon>
                  <span className="font-display text-[15.5px] font-bold text-ink">Homework &amp; Assignments</span>
                </span>
              }
              action={<ViewLink to="/student/homework">All assignments</ViewLink>}
              headerClassName="px-5 sm:px-6 pt-5 pb-0"
              bodyClassName="px-5 sm:px-6 pb-5 pt-4"
              decor="tasks"
              decorTone={ACCENTS.violet.text}
            >
              {hwClass.length === 0 ? (
                <EmptyPanel
                  icon={BookOpenCheck}
                  title="No homework right now"
                  text="New assignments from your teachers will appear here as soon as they are shared."
                  action={<ViewLink to="/student/homework">Open homework</ViewLink>}
                />
              ) : (
                <div className="space-y-2.5">
                  {[...hwClass]
                    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
                    .slice(0, 5)
                    .map((h) => (
                      <AssignmentItem key={h._id} h={h} />
                    ))}
                </div>
              )}
            </Card>

            <Card
              title={
                <span className="flex items-center gap-2.5">
                  <PanelIcon>
                    <CalendarCheck2 size={15} />
                  </PanelIcon>
                  <span className="font-display text-[15.5px] font-bold text-ink">Upcoming Exams</span>
                </span>
              }
              action={<ViewLink to="/student/exams">All exams</ViewLink>}
              headerClassName="px-5 sm:px-6 pt-5 pb-0"
              bodyClassName="px-5 sm:px-6 pb-5 pt-2"
            >
              {upcomingExams.length === 0 ? (
                <EmptyPanel
                  icon={CalendarDays}
                  title="You're all caught up!"
                  text="No exams scheduled yet. New schedules will appear here."
                  action={<ViewLink to="/student/exams">View exams</ViewLink>}
                />
              ) : (
                <div className="space-y-2.5">
                  {upcomingExams.map((ex) => (
                    <ExamItem key={ex._id} ex={ex} />
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* ── Results + Fees + Notices ────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Card
              title={
                <span className="flex items-center gap-2.5">
                  <PanelIcon>
                    <Trophy size={15} />
                  </PanelIcon>
                  <span className="font-display text-[15.5px] font-bold text-ink">Recent Results</span>
                </span>
              }
              action={<ViewLink to="/student/results">Report card</ViewLink>}
              headerClassName="px-5 sm:px-6 pt-5 pb-0"
              bodyClassName="px-5 sm:px-6 pb-5 pt-2"
              decor="trend"
              decorTone={ACCENTS.warn.text}
            >
              {!latestExam ? (
                <EmptyPanel
                  icon={Award}
                  title="No results published yet"
                  text="Your marks and report cards will appear here once results are published."
                  action={<ViewLink to="/student/results">View results</ViewLink>}
                />
              ) : (
                <div>
                  <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <p className="truncate text-[12.5px] font-semibold text-slate-text">{latestExam.examName}</p>
                    <Badge tone={latestExam.pct >= 40 ? "success" : "alert"}>{latestExam.pct}% overall</Badge>
                  </div>

                  {subjectPerformance.length >= 2 && (
                    <div className="mb-3.5">
                      <BarRowChart
                        data={subjectPerformance}
                        height={Math.max(120, subjectPerformance.length * 34)}
                        color="info"
                        colorFor={(d) => toneFor(d.value)}
                        tooltipLabel="Score"
                      />
                    </div>
                  )}

                  <ul className="divide-y divide-slate-100">
                    {latestExam.subjects.slice(0, 6).map((m, i) => {
                      const grade = m.grade || computeGrade(m.marksObtained, m.maxMarks);
                      return (
                        <li key={m._id || i} className="flex items-center justify-between gap-2 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-ink">{m.subject}</p>
                            {m.date && <p className="mt-0.5 text-[11px] text-slate-text/60">{fmtDate(m.date)}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-2.5">
                            <span className="text-[12.5px] font-semibold tabular-nums text-ink">
                              {m.marksObtained}/{m.maxMarks}
                            </span>
                            <Badge
                              tone={
                                ["A+", "A", "B+"].includes(grade)
                                  ? "success"
                                  : grade === "F"
                                    ? "alert"
                                    : "info"
                              }
                            >
                              {grade}
                            </Badge>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {examSeries.length > 1 && (
                    <div className="mt-4 border-t border-slate-100 pt-3.5">
                      <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-text/60">
                        Across exams
                      </p>
                      <TrendArea
                        data={examSeries}
                        height={140}
                        color="violet"
                        suffix="%"
                        tooltipLabel="Overall"
                      />
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card
              title={
                <span className="flex items-center gap-2.5">
                  <PanelIcon>
                    <Coins size={15} />
                  </PanelIcon>
                  <span className="font-display text-[15.5px] font-bold text-ink">Fees &amp; Payments</span>
                </span>
              }
              action={<ViewLink to="/student/fees">Details</ViewLink>}
              headerClassName="px-5 sm:px-6 pt-5 pb-0"
              bodyClassName="px-5 sm:px-6 pb-5 pt-3"
              decor="coins"
              decorTone={ACCENTS.success.text}
            >
              {pendingDue > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3.5">
                    <ProgressRing
                      value={feesTotal ? (paidAmount / feesTotal) * 100 : 0}
                      size={104}
                      stroke={10}
                      color="warning"
                      label="Paid"
                      ariaLabel={`${Math.round(feesTotal ? (paidAmount / feesTotal) * 100 : 0)} percent of fees paid`}
                    />
                    <div className="min-w-0">
                      <p className="font-display text-[26px] font-bold leading-none text-ink">{fmtMoney(pendingDue)}</p>
                      <p className="mt-1.5 text-[11.5px] text-slate-text/70">Amount Due</p>
                      <p className="mt-1 text-[12px] text-slate-text/70">
                        of {fmtMoney(feesTotal)} invoiced
                      </p>
                    </div>
                  </div>
                  {nextInvoice && (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-ink">{nextInvoice.title}</p>
                        <p className="text-[11.5px] text-slate-text/70">
                          Due {fmtDate(nextInvoice.dueDate || nextInvoice.createdAt)}
                        </p>
                      </div>
                      <Link
                        to="/student/fees"
                        className="shrink-0 whitespace-nowrap text-[12px] font-semibold text-info hover:text-blue-700"
                      >
                        View Invoice
                      </Link>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5">
                    {/* /85 not /70: inside the emerald panel the copy sits on a
                        darker surface in dark mode, where /70 measured 3.94:1. */}
                    <p className="text-[11.5px] leading-snug text-slate-text/85">
                      Pay online with UPI or card, or settle at the school office.
                    </p>
                    <Link
                      to="/online-payment"
                      className="shrink-0 whitespace-nowrap rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[12px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                    >
                      Pay Online
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-4">
                  <ProgressRing
                    value={100}
                    size={104}
                    stroke={10}
                    color="success"
                    label="Settled"
                    ariaLabel="All fees settled"
                  />
                  <div className="min-w-0">
                    <p className="font-display text-[26px] font-bold leading-none text-ink">{fmtMoney(0)}</p>
                    <p className="mt-1.5 text-[11.5px] text-slate-text/70">Amount Due</p>
                    <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-bold text-emerald-600">
                      <CheckCircle2 size={14} aria-hidden="true" />
                      {invoices.length ? "No pending invoices" : "No invoices raised yet"}
                    </p>
                  </div>
                </div>
              )}
            </Card>

            <Card
              title={
                <span className="flex items-center gap-2.5">
                  <PanelIcon>
                    <Megaphone size={15} />
                  </PanelIcon>
                  <span className="font-display text-[15.5px] font-bold text-ink">Notices</span>
                </span>
              }
              action={<ViewLink to="/student/notices">All notices</ViewLink>}
              headerClassName="px-5 sm:px-6 pt-5 pb-0"
              bodyClassName="px-5 sm:px-6 pb-5 pt-3"
              decor="broadcast"
              decorTone={ACCENTS.alert.text}
            >
              {topNotices.length === 0 ? (
                <EmptyPanel
                  icon={Megaphone}
                  title="No notices right now"
                  text="School announcements and circulars will appear here."
                />
              ) : (
                <div className="space-y-2.5">
                  {topNotices.map((n) => (
                    <NoticeItem key={n._id} n={n} />
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
