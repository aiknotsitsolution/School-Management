import { useEffect, useMemo, useState } from "react";
import { Award, FileBarChart } from "lucide-react";
import { PageIntro, Card, Pill } from "../../components/UI";
import { api } from "../../lib/api";

const gradeOf = (obtained, max) => {
  if (!max) return "N/A";
  const pct = (obtained / max) * 100;
  return pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B+" : pct >= 60 ? "B" : pct >= 50 ? "C" : pct >= 33 ? "D" : "F";
};

export default function Results() {
  const [marks, setMarks] = useState({ subjects: [], totalObtained: 0, totalMax: 0, percentage: "0.00" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.marks
      .reportCard(null)
      .then(({ data }) => setMarks(data || { subjects: [], totalObtained: 0, totalMax: 0, percentage: "0.00" }))
      .catch(() => setMarks({ subjects: [], totalObtained: 0, totalMax: 0, percentage: "0.00" }))
      .finally(() => setLoading(false));
  }, []);

  const byExam = useMemo(() => {
    const group = {};
    (marks.subjects || []).forEach((m) => {
      const key = m.examName || "All";
      if (!group[key]) group[key] = [];
      group[key].push(m);
    });
    return Object.entries(group).map(([examName, subjects]) => {
      const sorted = [...subjects].sort((a, b) => a.subject.localeCompare(b.subject));
      const obtained = sorted.reduce((s, m) => s + (Number(m.marksObtained) || 0), 0);
      const max = sorted.reduce((s, m) => s + (Number(m.maxMarks) || 0), 0);
      return {
        examName,
        subjects: sorted,
        obtained,
        max,
        pct: max ? Math.round((obtained / max) * 100) : 0,
      };
    });
  }, [marks]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Academics" title="My Results" description="Your report card for this session." />
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-28 bg-white rounded-2xl border border-black/[0.06] animate-pulse" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro eyebrow="Academics" title="My Results" description="Your report card for this session." />

      {byExam.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <Award size={40} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[15px] font-semibold text-ink">No results published</p>
            <p className="text-[13px] text-slate-text/70 mt-1">Your marks will appear here once teachers publish them.</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <div className="p-1">
                <p className="font-display text-3xl font-bold text-ink">{marks.percentage}%</p>
                <p className="text-[11px] text-slate-text/60 mt-1">Overall (all exams)</p>
              </div>
            </Card>
            <Card><p className="font-display text-xl font-bold text-ink">{marks.totalObtained}</p><p className="text-[11px] text-slate-text/60 mt-1">Total obtained</p></Card>
            <Card><p className="font-display text-xl font-bold text-ink">{marks.totalMax}</p><p className="text-[11px] text-slate-text/60 mt-1">Total maximum</p></Card>
          </div>

          {byExam.map((exam) => (
            <Card
              key={exam.examName}
              title={exam.examName}
              action={<Pill tone={exam.pct >= 40 ? "success" : "alert"}>{exam.pct}%</Pill>}
            >
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                      <th className="px-5 py-2 font-semibold">Subject</th>
                      <th className="px-3 py-2 font-semibold">Marks</th>
                      <th className="px-3 py-2 font-semibold">Grade</th>
                      <th className="px-5 py-2 font-semibold text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exam.subjects.map((m, i) => {
                      const pct = m.maxMarks ? Math.round((m.marksObtained / m.maxMarks) * 100) : 0;
                      return (
                        <tr key={m._id || i} className="border-t border-black/[0.06]">
                          <td className="px-5 py-2.5 font-medium text-ink">{m.subject}</td>
                          <td className="px-3 py-2.5">{m.marksObtained} / {m.maxMarks}</td>
                          <td className="px-3 py-2.5"><Pill tone={["A+", "A", "B+"].includes(m.grade || gradeOf(m.marksObtained, m.maxMarks)) ? "success" : "neutral"}>{m.grade || gradeOf(m.marksObtained, m.maxMarks)}</Pill></td>
                          <td className="px-5 py-2.5 text-right font-semibold text-ink">{pct}%</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-black/10">
                      <td className="px-5 py-2.5 font-bold text-ink">Total</td>
                      <td className="px-3 py-2.5 font-semibold text-ink">{exam.obtained} / {exam.max}</td>
                      <td className="px-3 py-2.5" />
                      <td className="px-5 py-2.5 text-right font-bold text-ink">{exam.pct}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </>
      )}

      <Card>
        <p className="text-[12.5px] text-slate-text/80 flex items-center gap-2">
          <FileBarChart size={14} className="text-slate-text/50" />
          Results are published by teachers for your class. Contact the school office for any discrepancy.
        </p>
      </Card>
    </div>
  );
}