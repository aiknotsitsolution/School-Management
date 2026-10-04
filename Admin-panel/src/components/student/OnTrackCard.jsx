import { ArrowRight, CircleAlert, CircleCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

function tone(pct, good, ok) {
  if (pct >= good) return { label: "Strong", bar: "bg-emerald-500", text: "text-emerald-600" };
  if (pct >= ok) return { label: "Steady", bar: "bg-amber-500", text: "text-amber-600" };
  return { label: "Behind", bar: "bg-rose-500", text: "text-rose-600" };
}

function Row({ label, sub, pct, good, ok, showBar }) {
  const t = tone(pct, good, ok);
  return (
    <li className="flex items-center gap-3 sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[13px] font-semibold text-ink">{label}</span>
          <span className={`shrink-0 text-[13px] font-bold tabular-nums ${t.text}`}>{pct}%</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/8">
            <div
              className={`h-full rounded-full ${t.bar} transition-[width] duration-700 ease-out`}
              style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-text/70">
            {showBar ? t.label : ""}
          </span>
        </div>
        {sub ? <p className="mt-1 text-[11.5px] text-slate-text/80">{sub}</p> : null}
      </div>
    </li>
  );
}

export default function OnTrackCard({
  attendancePct = 0,
  attendanceCount = 0,
  submissionPct = null,
  submittedCount = 0,
  totalCount = 0,
  examPct = null,
  className = "",
}) {
  const metrics = [{ pct: attendancePct, good: 85, ok: 70 }];
  if (submissionPct !== null) metrics.push({ pct: submissionPct, good: 80, ok: 60 });
  if (examPct !== null) metrics.push({ pct: examPct, good: 75, ok: 50 });

  const score = metrics.reduce((s, m) => s + m.pct, 0) / (metrics.length || 1);

  const verdict =
    score >= 80
      ? { text: "You're on track", note: "Everything is moving in the right direction. Keep the rhythm.", Icon: CircleCheck, pill: "bg-emerald-50 text-emerald-700 ring-emerald-200" }
      : score >= 60
        ? { text: "Steady, with room to push", note: "A couple of areas need a little more attention this week.", Icon: Sparkles, pill: "bg-amber-50 text-amber-700 ring-amber-200" }
        : { text: "Needs attention", note: "Catch up on pending work and attendance to get back on track.", Icon: CircleAlert, pill: "bg-rose-50 text-rose-700 ring-rose-200" };

  const { Icon } = verdict;

  return (
    <section
      aria-label="Progress check"
      className={`relative overflow-hidden rounded-3xl border border-ink/10 bg-white p-5 shadow-[0_18px_44px_-34px_rgba(11,25,44,0.6)] sm:p-6 ${className}`}
    >
      <span className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-primary/8" aria-hidden="true" />
      <span className="pointer-events-none absolute -left-12 -bottom-10 h-32 w-32 rounded-full bg-[#E9424E]/8" aria-hidden="true" />

      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              Weekly check
            </p>
            <h2 className="mt-2 font-display text-[24px] font-bold leading-tight tracking-tight text-ink sm:text-[28px]">
              {verdict.text}
            </h2>
            <p className="mt-1.5 max-w-[46ch] text-[13px] leading-relaxed text-slate-text">{verdict.note}</p>
          </div>

          <span className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 ring-inset ${verdict.pill}`}>
            <Icon size={14} aria-hidden="true" />
            {Math.round(score)}% overall
          </span>
        </div>

        <ul className="mt-5 space-y-4">
          <Row
            label="Attendance"
            sub={`${attendanceCount} days recorded`}
            pct={attendancePct}
            good={85}
            ok={70}
            showBar
          />
          {submissionPct !== null ? (
            <Row
              label="Assignments"
              sub={`${submittedCount} of ${totalCount} submitted`}
              pct={submissionPct}
              good={80}
              ok={60}
              showBar
            />
          ) : null}
          {examPct !== null ? (
            <Row label="Latest exam" sub="Average across subjects" pct={examPct} good={75} ok={50} showBar />
          ) : null}
        </ul>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink/8 pt-4">
          <p className="text-[12px] text-slate-text/80">Based on your attendance, submissions and marks.</p>
          <Link
            to="/student/results"
            className="group report-cta inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
          >
            See report card
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
