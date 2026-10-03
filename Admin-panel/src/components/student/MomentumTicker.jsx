import { useMemo } from "react";
import { Award, CalendarClock, CheckCircle2, Flame, IndianRupee } from "lucide-react";
import { momentumStats } from "../../lib/momentum";

function daysUntil(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - start) / 86400000);
}

function whenLabel(days) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/**
 * Scrolling strip of real student facts — attendance, streak, pending work,
 * the next exam and pending fees. Nothing here is generated or placeholder.
 */
export default function MomentumTicker({
  attendance = [],
  homework = [],
  submissions = [],
  exams = [],
  marks,
  pendingDue = 0,
}) {
  const items = useMemo(() => {
    const stats = momentumStats({ attendance, homework, submissions, marks });
    const out = [];

    if (attendance.length > 0) {
      const present = attendance.filter(
        (a) => a.status === "Present" || a.status === "Half Day",
      ).length;
      out.push({
        icon: CheckCircle2,
        tone: "text-emerald-600",
        text: `Attendance ${Math.round((present / attendance.length) * 100)}%`,
      });
    }

    if (stats.submittedCount > 0) {
      out.push({
        icon: Flame,
        tone: "text-brand",
        text: `${stats.homeworkStreak}-day homework streak`,
      });
    }

    const pending = homework.filter(
      (h) => !submissions.some((s) => String(s.homeworkId) === String(h._id)),
    );
    if (pending.length > 0) {
      out.push({
        icon: CheckCircle2,
        tone: "text-primary",
        text: `${pending.length} assignment${pending.length === 1 ? "" : "s"} to submit`,
      });
    }

    const next = exams
      .map((e) => ({ exam: e, days: daysUntil(e?.date || e?.examDate) }))
      .filter((x) => x.days !== null && x.days >= 0)
      .sort((a, b) => a.days - b.days)[0];
    if (next) {
      out.push({
        icon: CalendarClock,
        tone: "text-amber-600",
        // Exam documents expose `examName` (see models/Exam.js) — there is no
        // `title`/`name` field, so the old lookup always fell through to "Exam".
        text: `${next.exam.examName || "Exam"} · ${whenLabel(next.days)}`,
      });
    }

    if (pendingDue > 0) {
      out.push({
        icon: IndianRupee,
        tone: "text-rose-500",
        text: `Fees pending ₹${Number(pendingDue).toLocaleString("en-IN")}`,
      });
    }

    out.push({
      icon: Award,
      tone: "text-info",
      text: `Level ${stats.level} ${stats.title} · ${stats.xp} XP`,
    });

    return out;
  }, [attendance, homework, submissions, exams, marks, pendingDue]);

  if (items.length < 2) return null;

  return (
    <div className="momentum-ticker-fade relative overflow-hidden rounded-2xl border border-slate-200 bg-white py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="momentum-marquee flex w-max items-center gap-7 group-hover:[animation-play-state:paused]">
        {[...items, ...items].map((item, i) => (
          <span
            key={`${item.text}-${i}`}
            className="flex items-center gap-2 whitespace-nowrap px-1"
            aria-hidden={i >= items.length}
          >
            <item.icon size={14} className={`${item.tone} shrink-0`} aria-hidden="true" />
            <span className="text-[12px] font-semibold text-ink">{item.text}</span>
            <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
          </span>
        ))}
      </div>
      <p className="sr-only">{items.map((i) => i.text).join(". ")}</p>
    </div>
  );
}
