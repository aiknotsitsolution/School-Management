import { useEffect, useMemo, useState } from "react";
import { ClipboardList, CalendarDays, Clock3, DoorOpen, Trophy } from "lucide-react";
import { PageIntro, Card, Pill, StatCard, toast } from "../../components/UI";
import { api } from "../../lib/api";
import { useTeacherContext, fmtDate } from "./useTeacherContext";

export default function Exams() {
  const { cls, section, assignment, query } = useTeacherContext();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    api.exams
      .list(query)
      .then(({ data }) => setExams(data || []))
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [query]);

  const examNames = useMemo(
    () => ["All", ...new Set((exams || []).map((e) => e.examName))],
    [exams],
  );

  const list = useMemo(
    () =>
      (exams || [])
        .filter((e) => filter === "All" || e.examName === filter)
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [exams, filter],
  );

  const upcoming = list.filter((e) => new Date(e.date) >= new Date());
  const subjects = new Set((exams || []).map((e) => e.subject)).size;

  if (!cls) {
    return (
      <Card>
        <div className="py-16 text-center">
          <ClipboardList size={40} className="mx-auto text-slate-text/30 mb-3" />
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
        title="Examinations"
        description={`Exam schedule for ${assignment}. Marks entry is handled by the school office.`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ClipboardList}
          label="Total Exams"
          value={String((exams || []).length)}
          sub={`For class ${cls}`}
          accent="info"
        />
        <StatCard
          icon={CalendarDays}
          label="Upcoming"
          value={String(upcoming.length)}
          sub="Still to be held"
          accent="success"
        />
        <StatCard
          icon={Trophy}
          label="Subjects"
          value={String(subjects)}
          sub="Subjects scheduled"
          accent="amber"
        />
        <StatCard
          icon={Clock3}
          label="Exam Terms"
          value={String(examNames.length - 1)}
          sub="Distinct terms"
          accent="neutral"
        />
      </div>

      {examNames.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {examNames.map((n) => (
            <button
              key={n}
              onClick={() => setFilter(n)}
              className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors ${
                filter === n
                  ? "bg-ink text-white border-ink"
                  : "bg-white text-slate-text border-black/10 hover:border-ink/30"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <Card>
          <p className="text-[13px] text-slate-text py-10 text-center">
            Loading exams…
          </p>
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <p className="text-[13px] text-slate-text py-14 text-center">
            No exams scheduled for {assignment}.
          </p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {list.map((ex) => {
            const past = new Date(ex.date) < new Date();
            return (
              <Card key={ex._id} className={past ? "opacity-80" : ""}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber/12 text-amber-dark flex items-center justify-center shrink-0">
                      <Trophy size={18} />
                    </div>
                    <div>
                      <p className="font-display font-bold text-ink text-[15px]">
                        {ex.subject}
                      </p>
                      <p className="text-[11.5px] text-slate-text/60">
                        {ex.examName}
                      </p>
                    </div>
                  </div>
                  <Pill tone={past ? "neutral" : "alert"}>
                    {past ? "Completed" : fmtDate(ex.date)}
                  </Pill>
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4 pt-3 border-t border-black/[0.06] text-[12.5px] text-slate-text/80">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={14} className="text-slate-text/50" />
                    {fmtDate(ex.date)}
                  </span>
                  {ex.startTime && (
                    <span className="flex items-center gap-1.5">
                      <Clock3 size={14} className="text-slate-text/50" />
                      {ex.startTime}
                      {ex.endTime ? ` – ${ex.endTime}` : ""}
                    </span>
                  )}
                  {ex.room && (
                    <span className="flex items-center gap-1.5">
                      <DoorOpen size={14} className="text-slate-text/50" />
                      Room {ex.room}
                    </span>
                  )}
                  <span className="font-semibold text-ink">
                    Max marks: {ex.maxMarks}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}