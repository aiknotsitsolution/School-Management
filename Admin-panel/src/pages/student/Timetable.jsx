import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Clock } from "lucide-react";
import { PageIntro, Card, Pill } from "../../components/UI";
import { api } from "../../lib/api";
import useStudentContext from "./useStudentContext";

const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const isToday = (day) => day === WEEK[new Date().getDay() - 1];

export default function Timetable() {
  const { user } = useStudentContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cls = user?.class || ""; // backend scopes students to their own class
    const section = user?.section || "";
    setLoading(true);
    api.timetable
      .list(`class=${encodeURIComponent(cls)}&section=${encodeURIComponent(section)}`)
      .then(({ data }) => {
        const byDay = {};
        (Array.isArray(data) ? data : []).forEach((r) => {
          byDay[r.day] = r;
        });
        setRows(WEEK.map((d) => ({ day: d, entry: byDay[d] || null })));
      })
      .catch(() => setRows(WEEK.map((d) => ({ day: d, entry: null }))))
      .finally(() => setLoading(false));
  }, [user?.class, user?.section]);

  const anyData = useMemo(() => rows.some((r) => r.entry?.periods?.length), [rows]);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="My Timetable"
        description={user?.class ? `Weekly timetable for Class ${user.class}${user.section ? `-${user.section}` : ""}.` : "Your weekly timetable."}
      />

      {loading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-40 bg-white rounded-2xl border border-black/[0.06] animate-pulse" />)}
        </div>
      ) : !anyData ? (
        <Card>
          <div className="py-10 text-center">
            <CalendarRange size={40} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[15px] font-semibold text-ink">No timetable published yet</p>
            <p className="text-[13px] text-slate-text/70 mt-1">Your timetable will appear here once the school publishes it.</p>
          </div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map(({ day, entry }) => {
            const periods = (entry?.periods || []).filter((p) => p.subject !== "Break");
            return (
              <Card
                key={day}
                title={day}
                className={isToday(day) ? "ring-1 ring-amber/50" : ""}
                action={isToday(day) ? <Pill tone="amber">Today</Pill> : undefined}
              >
                {periods.length === 0 ? (
                  <p className="text-[12.5px] text-slate-text/60 py-4 text-center">No classes</p>
                ) : (
                  <div className="space-y-2">
                    {periods.map((p, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 px-2 rounded-lg bg-paper/60">
                        <div className="w-2 h-2 rounded-full shrink-0 bg-success" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-ink truncate">{p.subject}</p>
                          <p className="text-[11px] text-slate-text/60 truncate">{p.teacherName || "—"}</p>
                        </div>
                        <div className="shrink-0 text-[11px] text-slate-text/60 flex items-center gap-1">
                          <Clock size={11} />
                          {p.startTime}{p.endTime ? `-${p.endTime}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <p className="text-[12.5px] text-slate-text/80 flex items-center gap-2">
          <CalendarRange size={14} className="text-slate-text/50" />
          Timetable is set by the school. Periods marked as "Break" are excluded from this view.
        </p>
      </Card>
    </div>
  );
}