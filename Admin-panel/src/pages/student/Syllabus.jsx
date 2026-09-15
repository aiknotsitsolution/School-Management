import { useState, useEffect } from "react";
import { ScrollText, CheckCircle2, Circle, Clock } from "lucide-react";
import { PageIntro, Card, Pill } from "../../components/UI";
import { api } from "../../lib/api";

const STATUS_ICON = {
  completed: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" },
  in_progress: { icon: Clock, color: "text-amber-500", bg: "bg-amber-50" },
  pending: { icon: Circle, color: "text-ink/25", bg: "bg-slate-50" },
};

const TERM_COLORS = {
  "Term 1": "bg-blue-50 text-blue-600 border-blue-100",
  "Term 2": "bg-purple-50 text-purple-600 border-purple-100",
  "Full Year": "bg-amber-50 text-amber-600 border-amber-100",
};

export default function Syllabus() {
  const [syllabus, setSyllabus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);

  useEffect(() => {
    fetchSyllabus();
  }, []);

  const fetchSyllabus = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.syllabus.list();
      setSyllabus(res.data?.data || []);
    } catch (err) {
      setError(err.message || "Failed to load syllabus");
    } finally {
      setLoading(false);
    }
  };

  const subjects = [...new Set(syllabus.map((s) => s.subject))].sort();

  const getProgress = (topics) => {
    if (!topics || topics.length === 0) return 0;
    const completed = topics.filter((t) => t.status === "completed").length;
    return Math.round((completed / topics.length) * 100);
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Learning"
        title="Syllabus"
        description="View your complete syllabus for all subjects."
      />

      {error && (
        <Card>
          <div className="py-10 text-center">
            <p className="text-[13px] text-red-500">{error}</p>
            <button onClick={fetchSyllabus} className="mt-3 text-[12px] text-amber-600 font-semibold hover:underline">
              Retry
            </button>
          </div>
        </Card>
      )}

      {!error && loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <div className="animate-pulse space-y-3 p-1">
                <div className="h-4 bg-ink/5 rounded w-1/2" />
                <div className="h-3 bg-ink/5 rounded w-3/4" />
                <div className="h-2 bg-ink/5 rounded-full w-full" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {!error && !loading && syllabus.length === 0 && (
        <Card>
          <div className="py-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-ink/[0.04] flex items-center justify-center mx-auto mb-3">
              <ScrollText size={24} className="text-slate-text/30" />
            </div>
            <p className="text-[14px] font-semibold text-ink">No syllabus available</p>
            <p className="text-[12.5px] text-slate-text/60 mt-1 max-w-xs mx-auto">
              Syllabus for your class will appear here once uploaded by the school.
            </p>
          </div>
        </Card>
      )}

      {!error && !loading && syllabus.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedSubject(null)}
              className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg border transition-colors ${
                !selectedSubject
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-white text-ink/50 border-ink/10 hover:bg-ink/[0.02]"
              }`}
            >
              All Subjects ({syllabus.length})
            </button>
            {subjects.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSubject(s)}
                className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg border transition-colors ${
                  selectedSubject === s
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-white text-ink/50 border-ink/10 hover:bg-ink/[0.02]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {syllabus
              .filter((s) => !selectedSubject || s.subject === selectedSubject)
              .map((s) => {
                const progress = getProgress(s.topics);
                const completed = s.topics?.filter((t) => t.status === "completed").length || 0;
                const inProgress = s.topics?.filter((t) => t.status === "in_progress").length || 0;
                const total = s.topics?.length || 0;
                return (
                  <Card key={s._id}>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                            <ScrollText size={17} className="text-amber-600" />
                          </div>
                          <div>
                            <p className="text-[14px] font-semibold text-ink">{s.subject}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11.5px] text-ink/40">Class {s.class}{s.section ? ` ${s.section}` : ""}</span>
                              <Pill className={`text-[10px] border ${TERM_COLORS[s.term] || TERM_COLORS["Full Year"]}`}>
                                {s.term}
                              </Pill>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 sm:gap-6">
                        <div className="text-center">
                          <p className="text-[18px] font-bold text-ink">{total}</p>
                          <p className="text-[10.5px] text-ink/40">Topics</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[18px] font-bold text-emerald-600">{completed}</p>
                          <p className="text-[10.5px] text-ink/40">Done</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[18px] font-bold text-amber-600">{inProgress}</p>
                          <p className="text-[10.5px] text-ink/40">In Progress</p>
                        </div>
                        <div className="w-24">
                          <div className="flex justify-between text-[10px] text-ink/40 mb-1">
                            <span>{progress}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-ink/5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    {s.topics && s.topics.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-ink/[0.06] space-y-2">
                        {s.topics.map((topic, idx) => {
                          const st = STATUS_ICON[topic.status] || STATUS_ICON.pending;
                          const StIcon = st.icon;
                          return (
                            <div key={idx} className="flex items-start gap-3">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${st.bg}`}>
                                <StIcon size={14} className={st.color} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={`text-[13px] font-medium ${topic.status === "completed" ? "text-ink/40 line-through" : "text-ink"}`}>
                                  {topic.title}
                                </p>
                                {topic.description && (
                                  <p className="text-[11.5px] text-ink/40 mt-0.5">{topic.description}</p>
                                )}
                              </div>
                              <Pill className={`text-[10px] border shrink-0 ${
                                topic.status === "completed" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                topic.status === "in_progress" ? "bg-amber-50 text-amber-600 border-amber-100" :
                                "bg-slate-50 text-ink/40 border-ink/10"
                              }`}>
                                {topic.status === "completed" ? "Done" : topic.status === "in_progress" ? "Ongoing" : "Pending"}
                              </Pill>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}
