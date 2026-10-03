import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Clock, MapPin } from "lucide-react";
import { PageIntro, Card, Pill } from "../../components/UI";
import PageArtwork from "../../components/PageArtwork";
import { BarRowChart, Donut, ProgressRing } from "../../components/studentcharts/StudentCharts";
import { api } from "../../lib/api";
import useStudentContext, { fmtDate, dateOf } from "./useStudentContext";

export default function Exams() {
  const { user } = useStudentContext();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  // A rejected class-scoped fetch is not an empty schedule — see Timetable.jsx.
  const [error, setError] = useState("");

  useEffect(() => {
    const cls = user?.class || "";
    setLoading(true);
    setError("");
    api.exams
      .list(`class=${encodeURIComponent(cls)}`)
      .then(({ data }) => setExams(data || []))
      .catch((err) => {
        setError(err?.message || "We couldn't load your exams.");
        setExams([]);
      })
      .finally(() => setLoading(false));
  }, [user?.class]);

  const today = dateOf(new Date());
  const upcoming = useMemo(
    () => exams.filter((e) => dateOf(e.date) >= today).sort((a, b) => (a.date < b.date ? -1 : 1)),
    [exams, today],
  );
  const past = useMemo(
    () => exams.filter((e) => dateOf(e.date) < today).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [exams, today],
  );

  /** How many exams remain per subject, busiest subject first. */
  const upcomingBySubject = useMemo(() => {
    const counts = new Map();
    upcoming.forEach((e) => counts.set(e.subject, (counts.get(e.subject) || 0) + 1));
    return [...counts.entries()]
      .map(([label, total]) => ({ label, value: total }))
      .sort((a, b) => b.value - a.value);
  }, [upcoming]);

  const examSplit = useMemo(
    () =>
      [
        { name: "Upcoming", value: upcoming.length, color: "info" },
        { name: "Completed", value: past.length, color: "success" },
      ].filter((d) => d.value > 0),
    [upcoming.length, past.length],
  );

  const doneShare = exams.length ? Math.round((past.length / exams.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="My Examinations" art="exams"
        description={user?.class ? `Exam schedule for Class ${user.class}.` : "Your exam schedule."}
      />

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 bg-white rounded-2xl border border-slate-200 animate-pulse" />)}</div>
      ) : error ? (
        <Card>
          <div className="py-10 text-center">
            <p className="text-[15px] font-semibold text-ink">Couldn&apos;t load your exams</p>
            <p className="text-[13px] text-red-500 mt-1">{error}</p>
          </div>
        </Card>
      ) : exams.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <ClipboardList size={40} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[15px] font-semibold text-ink">No exams scheduled</p>
            <p className="text-[13px] text-slate-text/70 mt-1">The exam schedule for your class will appear here.</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <div className="flex flex-col items-center gap-3 py-2">
                <ProgressRing
                  value={doneShare}
                  size={150}
                  stroke={13}
                  color="violet"
                  label="Completed"
                  sublabel={`${upcoming.length} still ahead`}
                  ariaLabel={`${doneShare} percent of exams completed`}
                />
                {examSplit.length > 0 && (
                  <Donut data={examSplit} height={120} centerValue={exams.length} centerLabel="Exams" />
                )}
              </div>
            </Card>

            <Card className="lg:col-span-2" title="Upcoming by Subject" subtitle="How many exams remain in each subject">
              <BarRowChart
                data={upcomingBySubject}
                height={Math.max(160, upcomingBySubject.length * 34)}
                color="violet"
                tooltipLabel="Exams left"
                suffix=""
                max={Math.max(1, ...upcomingBySubject.map((d) => d.value))}
              />
            </Card>
          </div>

          <Card title={`Upcoming Exams (${upcoming.length})`}>
            {upcoming.length === 0 ? (
              <p className="text-[13px] text-slate-text py-4 text-center">Nothing scheduled ahead.</p>
            ) : (
              <div className="space-y-2.5">
                {upcoming.map((e) => (
                  <div key={e._id} className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-200 last:border-0">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-ink">{e.subject}</p>
                      <p className="text-[12px] text-slate-text/70 mt-0.5">{e.examName}</p>
                      <div className="flex items-center gap-4 mt-1.5 text-[11.5px] text-slate-text/60">
                        {e.startTime && <span className="flex items-center gap-1"><Clock size={11} />{e.startTime}{e.endTime ? `–${e.endTime}` : ""}</span>}
                        {e.room && <span className="flex items-center gap-1"><MapPin size={11} />Room {e.room}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-bold text-ink">{fmtDate(e.date)}</p>
                      <Pill tone="alert">Upcoming</Pill>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title={`Completed Exams (${past.length})`}>
            {past.length === 0 ? (
              <p className="text-[13px] text-slate-text py-4 text-center">No completed exams yet.</p>
            ) : (
              <div className="space-y-2.5">
                {past.map((e) => (
                  <div key={e._id} className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-200 last:border-0">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-ink">{e.subject}</p>
                      <p className="text-[12px] text-slate-text/70 mt-0.5">{e.examName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-medium text-slate-text">{fmtDate(e.date)}</p>
                      <Pill tone="neutral">Completed</Pill>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      <Card>
        <p className="text-[12.5px] text-slate-text/80 flex items-center gap-2">
          <ClipboardList size={14} className="text-slate-text/50" />
          Exam updates are published by the school. Carry your admit details and reach on time.
        </p>
      </Card>
    </div>
  );
}