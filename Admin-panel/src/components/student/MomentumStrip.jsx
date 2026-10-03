import { useEffect, useMemo, useRef } from "react";
import { Award, Flame, Sparkles } from "lucide-react";
import { lastSevenDays, momentumStats, SUBMISSION_XP } from "../../lib/momentum";
import { useCelebrate } from "../celebration/CelebrationProvider";

const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;

const DOT_TONE = {
  Present: "bg-emerald-500",
  "Half Day": "bg-sky-400",
  Leave: "bg-amber-400",
  Absent: "bg-rose-400",
};

export default function MomentumStrip({ attendance = [], homework = [], submissions = [], marks }) {
  const stats = useMemo(
    () => momentumStats({ attendance, homework, submissions, marks }),
    [attendance, homework, submissions, marks],
  );
  const week = useMemo(() => lastSevenDays(attendance), [attendance]);
  const celebrate = useCelebrate();
  const seenLevel = useRef(stats.level);

  useEffect(() => {
    if (stats.level > seenLevel.current) {
      celebrate({
        title: `Level ${stats.level} unlocked`,
        message: `${stats.title} · ${
          stats.remaining > 0 ? `${stats.remaining} XP to Level ${stats.level + 1}` : "Highest level reached"
        }`,
      });
    }
    seenLevel.current = stats.level;
  }, [stats.level, stats.title, stats.remaining, celebrate]);

  const hasAttendance = attendance.length > 0;
  const ringOffset = RING_C - (RING_C * stats.progressPct) / 100;

  return (
    <section aria-label="Your momentum" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Attendance streak */}
      <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:border-brand/35 hover:shadow-[0_24px_48px_-26px_rgba(233,66,78,0.5)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-text/70">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
              Attendance streak
            </p>
            <p className="mt-2.5 flex items-baseline gap-1.5">
              <span className="font-display text-[34px] font-bold leading-none tracking-tight tabular-nums text-ink">
                {stats.attendanceStreak}
              </span>
              <span className="text-[12px] font-semibold text-slate-text/70">
                {stats.attendanceStreak === 1 ? "day" : "days"}
              </span>
            </p>
          </div>
          <span
            className={`celebrate-flame grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
              stats.attendanceStreak > 0
                ? "bg-gradient-to-br from-amber-400 to-brand text-white shadow-[0_12px_26px_-12px_rgba(233,66,78,0.85)]"
                : "bg-slate-100 text-slate-text/45"
            }`}
          >
            <Flame size={22} strokeWidth={2.1} aria-hidden="true" />
          </span>
        </div>

        <p className="mt-2.5 text-[11.5px] leading-snug text-slate-text/70">
          {hasAttendance
            ? `${stats.presentDays} of ${attendance.length} records marked present`
            : "No attendance records yet"}
        </p>

        <div className="mt-3.5 flex items-end justify-between gap-1" aria-hidden="true">
          {week.map((d, i) => (
            <span
              key={d.key}
              className="celebrate-dot flex flex-col items-center gap-1.5"
              style={{ animationDelay: `${i * 55}ms` }}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${DOT_TONE[d.status] || "bg-slate-200"} ${
                  d.status === "Present" ? "ring-2 ring-emerald-500/25" : ""
                }`}
              />
              <span className="text-[9.5px] font-bold text-slate-text/55">{d.label}</span>
            </span>
          ))}
        </div>
        <p className="sr-only">
          Last 7 days: {week.map((d) => `${d.title}`).join(", ")}
        </p>
      </div>

      {/* Level + XP */}
      <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_24px_48px_-26px_rgba(12,71,207,0.5)]">
        <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-text/70">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
          Level &amp; XP
        </p>

        <div className="mt-3 flex items-center gap-4">
          <div className="relative h-[74px] w-[74px] shrink-0">
            <svg viewBox="0 0 74 74" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="37" cy="37" r={RING_R} fill="none" strokeWidth="6" className="stroke-slate-100" />
              <circle
                cx="37"
                cy="37"
                r={RING_R}
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={ringOffset}
                className="celebrate-ring stroke-primary"
              />
            </svg>
            <span className="absolute inset-0 grid place-items-center">
              <span className="celebrate-pop font-display text-[21px] font-bold leading-none tabular-nums text-ink">
                {stats.level}
              </span>
            </span>
          </div>

          <div className="min-w-0">
            <p className="font-display text-[16px] font-bold leading-tight tracking-tight text-ink">
              {stats.title}
            </p>
            <p className="mt-1 text-[11.5px] font-semibold tabular-nums text-slate-text/70">
              {stats.xp} XP total
            </p>
            <p className="mt-0.5 text-[11.5px] text-slate-text/70">
              {stats.remaining > 0 ? `${stats.remaining} XP to Level ${stats.level + 1}` : "Top level reached"}
            </p>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-3 bottom-3 translate-y-2 rounded-xl border border-slate-200 bg-white/97 p-3 opacity-0 shadow-[0_18px_40px_-22px_rgba(15,23,42,0.5)] backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-text/60">
            Where your XP comes from
          </p>
          <ul className="mt-2 space-y-1.5">
            {stats.sources.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-3 text-[11.5px]">
                <span className="min-w-0 truncate text-slate-text/80">
                  {s.label} <span className="text-slate-text/55">· {s.detail}</span>
                </span>
                <span className="shrink-0 font-bold tabular-nums text-ink">+{s.xp}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Homework streak */}
      <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/35 hover:shadow-[0_24px_48px_-26px_rgba(16,185,129,0.5)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-text/70">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Homework streak
            </p>
            <p className="mt-2.5 flex items-baseline gap-1.5">
              <span className="font-display text-[34px] font-bold leading-none tracking-tight tabular-nums text-ink">
                {stats.homeworkStreak}
              </span>
              <span className="text-[12px] font-semibold text-slate-text/70">in a row</span>
            </p>
          </div>
          <span
            className={`celebrate-pop grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
              stats.homeworkStreak > 0
                ? "bg-gradient-to-br from-emerald-400 to-primary text-white shadow-[0_12px_26px_-12px_rgba(16,185,129,0.85)]"
                : "bg-slate-100 text-slate-text/45"
            }`}
          >
            <Award size={22} strokeWidth={2.1} aria-hidden="true" />
          </span>
        </div>

        <p className="mt-2.5 text-[11.5px] leading-snug text-slate-text/70">
          {stats.submittedCount} assignment{stats.submittedCount === 1 ? "" : "s"} submitted · +{SUBMISSION_XP} XP each
        </p>

        <p className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10.5px] font-bold text-emerald-600">
          <Sparkles size={12} aria-hidden="true" />
          Submit on time to keep it alive
        </p>
      </div>
    </section>
  );
}
