import { useEffect, useMemo, useState } from "react";
import { CalendarRange } from "lucide-react";
import { PageIntro, Card, Pill } from "../../components/UI";
import PageArtwork from "../../components/PageArtwork";
import { ACCENTS } from "../../components/dashboard/DashKit";
import { api } from "../../lib/api";
import useStudentContext from "./useStudentContext";

const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* One accent per weekday, so six columns are told apart at a glance instead of
   reading as six identical white boxes. Order follows WEEK. */
const DAY_ACCENT = ["primary", "violet", "teal", "info", "warn", "success"];

const isToday = (day) => day === WEEK[new Date().getDay() - 1];

/** Times are stored as the zero-padded 24h "HH:MM" an <input type="time">
 *  emits, so they parse without guessing. Null when unset or malformed. */
const minutesOf = (t) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t ?? "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Splits a stored time so a period can read "9:00 – 9:45 AM" rather than
 *  "09:00-09:45". The meridiem is printed once, after the range. */
const timeParts = (t) => {
  const mins = minutesOf(t);
  if (mins === null) return null;
  const h = Math.floor(mins / 60);
  return {
    clock: `${h % 12 === 0 ? 12 : h % 12}:${String(mins % 60).padStart(2, "0")}`,
    meridiem: h < 12 ? "AM" : "PM",
  };
};

export default function Timetable() {
  const { user } = useStudentContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  // A failed fetch is NOT the same as an empty timetable. Folding a 403 into
  // the empty state told students "No timetable published yet" when the real
  // answer was "your account has no class", which sent them hunting for a
  // publish button that was never the problem.
  const [error, setError] = useState("");
  // Ticks once a minute, so the "Now" marker on today's column stays honest
  // without re-rendering the whole week on every frame.
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const cls = user?.class || ""; // backend scopes students to their own class
    const section = user?.section || "";
    setLoading(true);
    setError("");
    api.timetable
      .list(`class=${encodeURIComponent(cls)}&section=${encodeURIComponent(section)}`)
      .then(({ data }) => {
        const byDay = {};
        (Array.isArray(data) ? data : []).forEach((r) => {
          byDay[r.day] = r;
        });
        setRows(WEEK.map((d) => ({ day: d, entry: byDay[d] || null })));
      })
      .catch((err) => {
        setError(err?.message || "We couldn't load your timetable.");
        setRows(WEEK.map((d) => ({ day: d, entry: null })));
      })
      .finally(() => setLoading(false));
  }, [user?.class, user?.section]);

  const anyData = useMemo(() => rows.some((r) => r.entry?.periods?.length), [rows]);

  const nowMins = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="My Timetable" art="calendar"
        description={user?.class ? `Weekly timetable for Class ${user.class}${user.section ? `-${user.section}` : ""}.` : "Your weekly timetable."}
      />

      {loading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-40 bg-white rounded-2xl border border-slate-200 animate-pulse" />)}
        </div>
      ) : error ? (
        <Card>
          <div className="py-10 text-center">
            <p className="text-[15px] font-semibold text-ink">Couldn&apos;t load your timetable</p>
            <p className="text-[13px] text-red-500 mt-1">{error}</p>
          </div>
        </Card>
      ) : !anyData ? (
        <Card>
          <div className="py-10 text-center">
            <PageArtwork name="calendar" size={64} className="mx-auto mb-4" />
            <p className="text-[15px] font-semibold text-ink">No timetable published yet</p>
            <p className="text-[13px] text-slate-text/70 mt-1">Your timetable will appear here once the school publishes it.</p>
          </div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map(({ day, entry }, i) => {
            // Break and Lunch are part of the day too — the student sees the
            // same rows the admin grid stores, nothing hidden.
            const periods = entry?.periods || [];
            const today = isToday(day);
            const accent = ACCENTS[DAY_ACCENT[i]];

            // Only today's column can hold a live period, and only during
            // school hours — otherwise the marker would sit on the first class
            // of every past or future day.
            const liveIdx =
              today && nowMins >= 6 * 60 && nowMins <= 18 * 60
                ? periods.findIndex((p) => {
                    const s = minutesOf(p.startTime);
                    const e = minutesOf(p.endTime);
                    if (s === null || nowMins < s) return false;
                    return e === null ? nowMins <= s + 60 : nowMins <= e;
                  })
                : -1;

            return (
              <Card
                key={day}
                title={
                  <span className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${accent.dot}`} />
                    <span className="font-display text-[15px] font-semibold text-ink">{day}</span>
                  </span>
                }
                subtitle={periods.length ? `${periods.length} ${periods.length === 1 ? "period" : "periods"}` : undefined}
                className={today ? "ring-2 ring-primary/25" : ""}
                action={today ? <Pill tone="primary">Today</Pill> : undefined}
                decor="weekgrid"
                decorTone={accent.text}
                headerClassName={`px-5 py-4 border-b ${today ? "bg-primary-light/50 border-primary-border/60" : "border-slate-200"}`}
                bodyClassName="p-4"
              >
                {periods.length === 0 ? (
                  <div className="py-8 text-center">
                    <PageArtwork name="calendar" size={44} className="mx-auto mb-3 opacity-80" />
                    <p className="text-[12.5px] text-slate-text/60">No classes</p>
                  </div>
                ) : (
                  <ol className="relative space-y-1">
                    {/* One continuous rule the periods hang from, so a day reads
                        as a column of a schedule rather than a loose stack. */}
                    <span
                      aria-hidden="true"
                      className={`absolute left-[5px] top-3 bottom-3 w-px ${accent.bar} opacity-30`}
                    />
                    {periods.map((p, j) => {
                      const live = j === liveIdx;
                      const from = timeParts(p.startTime);
                      const to = timeParts(p.endTime);
                      return (
                        <li
                          key={j}
                          className={`relative flex items-center gap-3 rounded-xl border py-2 pl-5 pr-2 transition-colors ${
                            live ? accent.soft : "border-transparent hover:border-slate-200 hover:bg-paper/60"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`absolute left-0 top-1/2 -translate-y-1/2 rounded-full ring-4 ring-white ${
                              live ? `h-3 w-3 ${accent.bar}` : `h-2.5 w-2.5 ${accent.dot} opacity-70`
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-ink">{p.subject}</p>
                            <p className="truncate text-[11px] text-slate-text/60">{p.teacherName || "—"}</p>
                          </div>
                          {live && (
                            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${accent.chip}`}>
                              Now
                            </span>
                          )}
                          <div className="shrink-0 text-right text-[11px] tabular-nums text-slate-text/70">
                            {from ? from.clock : "—"}
                            {to && <span className="text-slate-text/50"> – {to.clock}</span>}
                            {from && <span className="ml-0.5 text-[10px] text-slate-text/50">{from.meridiem}</span>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary-dark">
          <CalendarRange size={15} />
        </span>
        <p className="text-[12.5px] text-slate-text/80">
          Timetable is set by the school. Break and Lunch appear at the time they
          are scheduled.
        </p>
      </div>
    </div>
  );
}