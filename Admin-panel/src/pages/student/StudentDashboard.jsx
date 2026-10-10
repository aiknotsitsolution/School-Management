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
import { Card, StatCard, toast } from "../../components/UI";
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
import { dateKey, formatHolidayDate } from "../../lib/date";
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
};

const ATT_VALUE = {
  Present: "text-emerald-600",
  Absent: "text-rose-500",
  Leave: "text-blue-600",
};

/**
 * Dashboard card renders inside a 380px column, so a cell is ~39px wide — the
 * full word never fits ("Mahatma Gandhi Jayanti" needs 100px). `mini` prints
 * these single letters instead and keeps the full name on the chip's `title`,
 * so hovering still reveals which holiday or status it is.
 */
const ATT_SHORT = { Present: "P", Absent: "A", Leave: "L" };


/**
 * School Calendar — attendance and school-published holidays in one month
 * grid. The mini variant is used on the dashboard; full is used on Attendance.
 */
export function StudentAttendanceCalendar({
  attendance = [],
  events = [],
  holidayError = "",
  variant = "full",
}) {
  const [month, setMonth] = useState(() => {
    const [year, monthNumber] = dateKey(new Date()).split("-").map(Number);
    return new Date(year, monthNumber - 1, 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => dateOf(new Date()));
  const [monthAttendance, setMonthAttendance] = useState([]);
  const [calendarError, setCalendarError] = useState("");
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const today = dateOf(new Date());
  // "2026-10-" — the prefix every date key in the rendered month shares.
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}-`;

  useEffect(() => {
    let active = true;
    const from = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
    const to = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
    const params = new URLSearchParams({ from, to, limit: "1000" });
    setCalendarError("");
    api.attendance
      .list(params.toString())
      .then(({ data }) => {
        if (active) setMonthAttendance(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        if (!active) return;
        setMonthAttendance([]);
        setCalendarError(error.message || "Attendance for this month could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [year, monthIndex, daysInMonth]);

  const attendanceByDate = useMemo(() => {
    const byDate = new Map();
    [...attendance, ...monthAttendance].forEach((record) => {
      const key = dateOf(record.date);
      if (key) byDate.set(key, record);
    });
    return byDate;
  }, [attendance, monthAttendance]);

  const holidaysByDate = useMemo(() => {
    const byDate = new Map();
    events
      .filter((event) => String(event.category || "").trim().toLowerCase() === "holiday")
      .forEach((event) => {
        const key = dateOf(event.date);
        if (!key) return;
        if (!byDate.has(key)) byDate.set(key, []);
        const dayEvents = byDate.get(key);
        const titleKey = String(event.title || "Holiday").trim().toLowerCase();
        if (!dayEvents.some((item) => String(item.title || "Holiday").trim().toLowerCase() === titleKey)) {
          dayEvents.push(event);
        }
      });
    return byDate;
  }, [events]);

  // The legend doubles as the month's tally. The mini grid prints single
  // letters, so this strip is where a student actually reads how the month
  // went — hence a count beside each label rather than a bare word.
  const legendCounts = useMemo(() => {
    const counts = { Present: 0, Absent: 0, Leave: 0, Holiday: 0 };
    attendanceByDate.forEach((record, key) => {
      if (!key.startsWith(monthKey)) return;
      if (record.status in counts) counts[record.status] += 1;
    });
    holidaysByDate.forEach((dayEvents, key) => {
      if (!key.startsWith(monthKey)) return;
      counts.Holiday += dayEvents.length;
    });
    return counts;
  }, [attendanceByDate, holidaysByDate, monthKey]);

  const selectedAttendance = attendanceByDate.get(selectedDate);
  const selectedHolidays = holidaysByDate.get(selectedDate) || [];
  const monthItems = useMemo(() => {
    const dates = new Set();
    for (const day of attendanceByDate.keys()) {
      if (day.startsWith(`${year}-${String(monthIndex + 1).padStart(2, "0")}-`)) dates.add(day);
    }
    for (const day of holidaysByDate.keys()) {
      if (day.startsWith(`${year}-${String(monthIndex + 1).padStart(2, "0")}-`)) dates.add(day);
    }
    return [...dates]
      .sort()
      .map((day) => ({
        day,
        attendance: attendanceByDate.get(day),
        holidays: holidaysByDate.get(day) || [],
      }));
  }, [attendanceByDate, holidaysByDate, year, monthIndex]);

  return (
    <Card
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-info/10 text-info">
            <CalendarDays size={16} />
          </span>
          <span className="font-display text-[15.5px] font-bold text-ink">School Calendar</span>
        </span>
      }
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => {
              const previous = new Date(year, monthIndex - 1, 1);
              setMonth(previous);
              setSelectedDate(dateOf(previous));
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-text transition hover:bg-paper"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[104px] text-center text-[12.5px] font-semibold text-ink">
            {month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => {
              const next = new Date(year, monthIndex + 1, 1);
              setMonth(next);
              setSelectedDate(dateOf(next));
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-text transition hover:bg-paper"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      }
    >
      {/* `mini` renders a plain block (grid + legend stacked); `full` splits
          into grid | detail so the rail sits beside it instead of under it. */}
      <div className={variant === "full" ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_272px]" : ""}>
        <div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="py-2 text-[10px] font-bold uppercase tracking-wide text-slate-text/55">
            {day}
          </div>
        ))}
        {Array.from({ length: firstDay }, (_, index) => (
          <div key={`blank-${index}`} aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const dayDate = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayAttendance = attendanceByDate.get(dayDate);
          const dayHolidays = holidaysByDate.get(dayDate) || [];
          const isSelected = dayDate === selectedDate;
          // Full-word chips instead of the old P/A/L/H monograms — the whole
          // point of the compact card is that a day reads at a glance.
          const attendanceChip = {
            Present: { text: "Present", style: "bg-emerald-100 text-emerald-700" },
            Absent: { text: "Absent", style: "bg-rose-100 text-rose-700" },
            Leave: { text: "Leave", style: "bg-blue-100 text-blue-700" },
          }[dayAttendance?.status];
          const cellTint = {
            Present: "bg-emerald-50/80",
            Absent: "bg-rose-50/80",
            Leave: "bg-blue-50/80",
          }[dayAttendance?.status];
          const hasHoliday = dayHolidays.length > 0;
          return (
            <button
              key={dayDate}
              type="button"
              aria-label={`${dayDate}${dayAttendance ? `, ${dayAttendance.status}` : ""}${dayHolidays.length ? `, Holiday: ${dayHolidays.map((event) => event.title).join(", ")}` : ""}`}
              onClick={() => setSelectedDate(dayDate)}
              className={`flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-lg border px-0.5 py-1 transition ${
                isSelected
                  ? "border-info bg-info/10 font-bold text-info"
                  : hasHoliday
                    ? "border-teal-200 bg-teal-50/70 font-semibold text-ink hover:bg-teal-100"
                    : cellTint
                      ? `border-transparent ${cellTint} font-semibold text-ink hover:border-slate-200`
                  : dayDate === today
                    ? "border-info/40 bg-info/5 font-semibold text-ink"
                    : "border-transparent text-ink hover:border-slate-200 hover:bg-paper"
              }`}
            >
              <span className="text-[12px] font-bold leading-none">{day}</span>
              <span className="flex w-full min-h-[13px] flex-col items-stretch gap-[2px]">
                {attendanceChip && (
                  <span
                    title={attendanceChip.text}
                    className={`truncate rounded px-1 text-center text-[7.5px] font-extrabold uppercase leading-[11px] tracking-tight ${attendanceChip.style}`}
                  >
                    {variant === "mini"
                      ? ATT_SHORT[attendanceChip.text] || attendanceChip.text
                      : attendanceChip.text}
                  </span>
                )}
                {dayHolidays.slice(0, 2).map((event) => (
                  <span
                    key={event._id || event.title}
                    title={event.title || "Holiday"}
                    className="truncate rounded bg-[#0D9488] px-1 text-center text-[7.5px] font-extrabold leading-[11px] text-white"
                  >
                    {variant === "mini" ? "Holiday" : event.title || "Holiday"}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      {calendarError && (
        <p role="status" className="mt-3 text-[12px] text-rose-600">{calendarError}</p>
      )}
      {holidayError && (
        <p role="status" className="mt-2 text-[12px] text-rose-600">
          School holidays could not be loaded: {holidayError}
        </p>
      )}
      {/* Legend uses the exact chip styles the grid renders, so the legend
          doubles as the colour key for what the student sees in a cell. */}
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
        {[
          ["bg-emerald-100 text-emerald-700", "Present"],
          ["bg-rose-100 text-rose-700", "Absent"],
          ["bg-blue-100 text-blue-700", "Leave"],
          ["bg-[#0D9488] text-white", "Holiday"],
        ].map(([style, label]) => (
          <span
            key={label}
            title={`${legendCounts[label]} ${label.toLowerCase()} in ${month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}`}
            className={`rounded px-2 py-0.5 text-[10px] font-bold tabular-nums ${style}`}
          >
            {label} {legendCounts[label]}
          </span>
        ))}
      </div>
        </div>

        {/* Right rail — the month list and the selected day sit beside the
            grid instead of stacked under it. Hidden in `mini`. */}
        {variant === "full" && (
        <div className="space-y-3 lg:border-l lg:border-slate-100 lg:pl-4">
      <div className="border-t border-slate-100 pt-3 lg:border-t-0 lg:pt-0">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-text/55">
        Attendance and India / school holidays this month
        </p>
        {monthItems.length === 0 ? (
          <p className="text-[12px] text-slate-text/65">
          {holidayError
            ? "Holiday calendars could not be loaded."
            : "No attendance or India / school holidays for this month."}
        </p>
        ) : (
          <div className="max-h-48 space-y-1.5 overflow-y-auto">
            {monthItems.map(({ day, attendance: record, holidays }) => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDate(day)}
                className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-paper"
              >
                <span className="text-[12px] font-medium text-ink">
                  {formatHolidayDate(day, {
                    day: "numeric",
                    month: "short",
                    weekday: "short",
                  })}
                </span>
                <span className="flex flex-wrap justify-end gap-1.5">
                  {record && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${record.status === "Present" ? "bg-emerald-100 text-emerald-700" : record.status === "Absent" ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"}`}>
                      {record.status}
                    </span>
                  )}
                  {holidays.map((event) => (
                    <span key={event._id || event.title} className="rounded-full bg-[#0D9488] px-2 py-0.5 text-[10px] font-bold text-white">
                      Holiday{event.title ? `: ${event.title}` : ""}
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-xl bg-paper/70 px-3.5 py-3">
        <p className="text-[11px] font-semibold text-slate-text/60">
          {formatHolidayDate(selectedDate, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        {selectedAttendance && (
          <p className={`mt-1 text-[13px] font-semibold ${ATT_VALUE[selectedAttendance.status] || "text-ink"}`}>
            Attendance: {selectedAttendance.status}
          </p>
        )}
        {selectedHolidays.map((event) => (
          <p key={event._id || event.title} className="mt-1 text-[13px] font-semibold text-teal-600">
            Holiday: {event.title}
          </p>
        ))}
        {!selectedAttendance && selectedHolidays.length === 0 && (
          <p className="mt-1 text-[12px] text-slate-text/65">
            No attendance record or holiday announced for this date.
          </p>
        )}
      </div>
        </div>
        )}
      </div>
    </Card>
  );
}

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

function ClassCard({ period, cls, section, nowMin, compact = false }) {
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
      className={`relative flex shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-[0_12px_30px_-18px_rgba(15,23,42,0.45)] ${
        compact ? "w-[190px] p-3" : "w-[248px] p-4"
      }`}
    >
      <span
        className={`pointer-events-none absolute -right-6 -top-7 rounded-full bg-blue-50 ${compact ? "h-12 w-12" : "h-16 w-16"}`}
        aria-hidden="true"
      />
      <div className="relative flex items-center justify-between gap-2">
        <span
          className={`rounded-md bg-violet-100 font-bold uppercase tracking-wide text-violet-600 ${
            compact ? "px-1.5 py-0.5 text-[9px]" : "px-1.5 py-0.5 text-[10px]"
          }`}
        >
          {amPm(period)}
        </span>
        <span
          className={`font-semibold tabular-nums text-slate-text/90 ${compact ? "text-[11px]" : "text-[12px]"}`}
        >
          {timeRange(period)}
        </span>
      </div>
      <div className={`relative flex items-center gap-2.5 ${compact ? "mt-2" : "mt-3"}`}>
        <span
          className={`flex shrink-0 items-center justify-center rounded-lg ${
            compact ? "h-7 w-7" : "h-9 w-9"
          } ${subjectTone(period.subject)}`}
          aria-hidden="true"
        >
          <BookOpen size={compact ? 13 : 16} />
        </span>
        <div className="min-w-0">
          <p
            className={`truncate font-display font-bold leading-tight text-ink ${
              compact ? "text-[13px]" : "text-[15px]"
            }`}
          >
            {period.subject || "—"}
          </p>
          <p className={`truncate text-slate-text/70 ${compact ? "text-[11px]" : "text-[12px]"}`}>
            {period.teacherName || "Teacher not assigned"}
          </p>
        </div>
      </div>
      {/* The class line is dropped in `compact` — the greeting banner right
          above this card already shows "Class 1-A", so it would only repeat. */}
      {!compact && (
        <p className="relative mt-1.5 text-[11.5px] text-slate-text/60">
          {cls ? `Class ${cls}${section ? `-${section}` : ""}` : ""}
        </p>
      )}
      <div className={`relative mt-auto ${compact ? "pt-2" : "pt-3.5"}`}>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-bold ${
            compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
          } ${statusTone}`}
        >
          {st.key === "ongoing" ? (
            <CheckCircle2 size={compact ? 10 : 12} className={isLive ? "animate-pulse" : ""} aria-hidden="true" />
          ) : st.key === "upcoming_soon" ? (
            <Plus size={compact ? 10 : 12} aria-hidden="true" />
          ) : st.key === "completed" ? (
            <CheckCircle2 size={compact ? 10 : 12} aria-hidden="true" />
          ) : (
            <Clock size={compact ? 10 : 12} aria-hidden="true" />
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
    events: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [holidayError, setHolidayError] = useState("");
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
    setHolidayError("");

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
        api.exams.list(`class=${encodeURIComponent(scopedCls)}${scopedSection ? `&section=${encodeURIComponent(scopedSection)}` : ""}`),
        api.marks.reportCard(),
        api.fees.invoices.list(),
        api.notices.list(),
        api.homework.submissions.myList(),
        api.events.list("limit=1000"),
        api.events.indiaHolidays(),
      ]);
      if (!alive) return;

      const value = (i) => (results[i].status === "fulfilled" ? results[i].value.data : null);
      if (results[0].status === "rejected") {
        setError("We couldn't load your data. Please sign out and sign in again.");
      }
      if (results[9].status === "rejected") {
        const message = results[9].reason?.message || "Could not load school holidays";
        toast(message, "error");
      }
      if (results[10].status === "rejected") {
        const message = results[10].reason?.message || "Could not load India holidays";
        toast(message, "error");
      }
      const holidayErrors = [
        results[9].status === "rejected"
          ? results[9].reason?.message || "School holidays could not be loaded."
          : "",
        results[10].status === "rejected"
          ? results[10].reason?.message || "India holidays could not be loaded."
          : "",
      ].filter(Boolean);
      setHolidayError(holidayErrors.join(" "));
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
        events: [...(value(9) || []), ...(value(10) || [])],
      });
      setLoading(false);
    };

    run();
    return () => { alive = false; };
  }, [cls, section]);

  useEffect(() => {
    const unsubscribe = api.attendanceStream.subscribe({
      onData: () => {
        if (document.visibilityState !== "visible") return;
        api.attendance
          .list()
          .then(({ data: attendance }) => {
            setData((current) => ({
              ...current,
              attendance: Array.isArray(attendance) ? attendance : [],
            }));
          })
          .catch((refreshError) => {
            toast(refreshError.message || "Could not refresh attendance", "error");
          });
      },
    });
    return unsubscribe;
  }, []);

  const { profile, attendance, timetable, homework, exams, marks, invoices, notices, submissions, events } = data;

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
    const counted = attendance.filter((a) => a.status === "Present").length;
    return Math.round((counted / attendance.length) * 100);
  }, [attendance]);

  const byStatus = useMemo(() => {
    const m = { Present: 0, Absent: 0, Leave: 0 };
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
      if (a.status === "Present") b.hit += 1;
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
  // Already netted out of `feesTotal` above — surfaced so the student can see
  // why their billed figure sits below the published fee package.
  const concessionTotal = invoices.reduce((s, i) => s + Number(i.concessionAmount || 0), 0);

  const todayIdx = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayRow = timetable.find((t) => t.day === WEEK[todayIdx]);
  const todayPeriods = todayRow?.periods || [];
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
          (timetable.find((t) => t.day === day)?.periods || []).length > 0,
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
      {/* Halved greeting beside a compact month view. The detail rail (month
          list + selected day) lives on My Attendance instead, so everything
          here clears the fold the moment a student logs in. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left column: the halved greeting with Today's Classes tucked into
            the band the taller calendar card leaves beside it. */}
        <div className="space-y-5">
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

        {/* Halved from the original 206/228px. Nothing was dropped — the
            greeting, date pill and both CTAs share one row, with the name and
            meta stacked underneath, so the same content fits the shorter
            banner and leaves room for the calendar card beside it. */}
        {/* `justify-start`, not `justify-center`: the banner is ~224px tall to
            match the calendar beside it, and centering left a dead band above
            the greeting that made it read as mid-card rather than at the top. */}
        <div className="relative z-10 flex min-h-[196px] flex-col justify-start gap-2.5 p-5 sm:min-h-[224px] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/80">
              <Sun size={14} className="text-amber-300" aria-hidden="true" />
              {greeting()},
              <span className="ml-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11.5px] font-medium normal-case tracking-normal text-white">
                <CalendarDays size={12} aria-hidden="true" />
                {dateLabel}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/student/timetable"
                className="group inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink shadow-[0_12px_28px_-18px_rgba(11,25,44,0.95)] transition-colors hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                View timetable
                <ArrowRight
                  size={13}
                  className="transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
              <Link
                to="/student/results"
                className="inline-flex items-center gap-2 rounded-full border border-white/45 bg-white/10 px-3.5 py-1.5 text-[12px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                See progress
              </Link>
            </div>
          </div>

          <div className="min-w-0">
            <h1 className="font-display text-[26px] font-bold leading-[1.06] tracking-tight text-white sm:text-[32px]">
              {firstName}
            </h1>
            {heroMeta ? (
              <p className="mt-0.5 truncate text-[12.5px] text-white/85">{heroMeta}</p>
            ) : null}
          </div>
        </div>
      </section>

          {/* Today's Classes fills the band the 446px calendar leaves below the
              224px greeting, so the top row no longer has dead space beside the
              taller card. Card and period tiles are compacted to fit it. */}
          <Card
            title={
              <span className="flex items-center gap-2.5">
                <PanelIcon>
                  <CalendarDays size={15} />
                </PanelIcon>
                <span className="font-display text-[15px] font-bold text-ink">Today's Classes</span>
              </span>
            }
            action={<ViewLink to="/student/timetable">Full timetable</ViewLink>}
            headerClassName="px-4 pt-4 pb-0"
            bodyClassName="px-4 pb-4 pt-3"
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
                  className="scrollbar-hidden flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40 rounded-xl"
                >
                  {todayPeriods.map((p, i) => (
                    <ClassCard
                      key={`${p.subject}-${p.startTime}-${i}`}
                      period={p}
                      cls={activeCls}
                      section={activeSection}
                      nowMin={nowMin}
                      compact
                    />
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
        </div>

        {/* Compact month view — chips only, no detail rail. */}
        <StudentAttendanceCalendar
          variant="mini"
          attendance={attendance}
          events={events}
          holidayError={holidayError}
        />
      </div>

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
                      {concessionTotal > 0 && (
                        <p className="mt-1 text-[11.5px] font-semibold text-violet-700">
                          Concession −{fmtMoney(concessionTotal)} applied
                        </p>
                      )}
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
