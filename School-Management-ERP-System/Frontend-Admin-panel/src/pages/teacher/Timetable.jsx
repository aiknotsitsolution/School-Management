import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Timer, Coffee } from "lucide-react";
import { PageIntro, Card, Pill, toast } from "../../components/UI";
import { api } from "../../lib/api";
import { useTeacherContext } from "./useTeacherContext";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Timetable() {
  const { cls, section, query } = useTeacherContext();
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    api.timetable
      .list(query)
      .then(({ data }) => setTimetable(data || []))
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [query]);

  const byDay = useMemo(() => {
    const map = {};
    DAYS.forEach((d) => (map[d] = []));
    (timetable || []).forEach((t) => {
      map[t.day] = (t.periods || []).filter((p) => p.subject !== "Break");
    });
    return map;
  }, [timetable]);

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long" });

  if (!cls) {
    return (
      <Card>
        <div className="py-16 text-center">
          <CalendarDays size={40} className="mx-auto text-slate-text/30 mb-3" />
          <p className="text-[15px] font-semibold text-ink">
            No class assigned yet
          </p>
          <p className="text-[13px] text-slate-text/70 mt-1">
            Contact your school admin to link your class and section.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="My Teaching"
        title="Timetable"
        description={`Weekly schedule for Class ${cls}${section ? `-${section}` : ""}.`}
      />

      {loading ? (
        <Card>
          <p className="text-[13px] text-slate-text py-10 text-center">
            Loading timetable…
          </p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {DAYS.map((day) => {
            const periods = byDay[day] || [];
            const highlight = today === day;
            return (
              <Card
                key={day}
                className={highlight ? "ring-1 ring-amber/40" : ""}
                title={
                  <div className="flex items-center gap-2">
                    <span>{day}</span>
                    {highlight && <Pill tone="amber">Today</Pill>}
                  </div>
                }
                action={
                  <CalendarDays size={16} className="text-slate-text/50" />
                }
              >
                {periods.length === 0 ? (
                  <p className="text-[13px] text-slate-text py-8 text-center">
                    No periods scheduled.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {periods.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-2 rounded-xl bg-paper/70"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white border border-black/[0.06] flex items-center justify-center shrink-0">
                          {p.subject === "Break" ? (
                            <Coffee size={15} className="text-slate-text/60" />
                          ) : (
                            <Timer size={15} className="text-amber-dark" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13.5px] font-semibold text-ink truncate">
                            {p.subject}
                          </p>
                          <p className="text-[11.5px] text-slate-text/60">
                            {p.startTime || "—"}
                            {p.endTime ? ` – ${p.endTime}` : ""}
                          </p>
                        </div>
                        <Pill tone={i % 2 === 0 ? "info" : "neutral"}>
                          Period {i + 1}
                        </Pill>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {!loading && Object.values(byDay).every((p) => p.length === 0) && (
        <div className="rounded-xl bg-ink/5 border border-ink/10 px-4 py-3.5 text-[13px] text-slate-text">
          No timetable published for this class yet. Ask your school admin to
          publish one.
        </div>
      )}
    </div>
  );
}