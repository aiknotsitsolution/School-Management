import { useEffect, useMemo, useState } from "react";
import { FileBarChart } from "lucide-react";
import { PageIntro, Card, Pill } from "../../components/UI";
import PageArtwork from "../../components/PageArtwork";
import {
  BarRowChart,
  Donut,
  ProgressRing,
  SubjectRadar,
  TrendArea,
} from "../../components/studentcharts/StudentCharts";
import { toneFor, toneKeyFor } from "../../components/studentcharts/theme";
import { api } from "../../lib/api";
import { computeGrade } from "../../lib/grading";

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
    return Object.entries(group)
      .map(([examName, subjects]) => {
        const sorted = [...subjects].sort((a, b) => String(a.subject || "").localeCompare(String(b.subject || "")));
        const obtained = sorted.reduce((s, m) => s + (Number(m.marksObtained) || 0), 0);
        const max = sorted.reduce((s, m) => s + (Number(m.maxMarks) || 0), 0);
        const dates = sorted.map((m) => m.date).filter(Boolean).sort();
        return {
          examName,
          subjects: sorted,
          obtained,
          max,
          pct: max ? Math.round((obtained / max) * 100) : 0,
          lastDate: dates.length ? dates[dates.length - 1] : "",
        };
      })
      .sort((a, b) => (a.lastDate || "").localeCompare(b.lastDate || ""));
  }, [marks]);

  /** The most recent exam drives the headline subject visuals. */
  const best = byExam[byExam.length - 1] || null;

  /** Subject bars for the most recent exam, strongest first. */
  const subjectBars = useMemo(() => {
    if (!best) return [];
    return best.subjects
      .map((m) => ({
        id: m._id,
        label: m.subject,
        value: m.maxMarks ? Math.round((m.marksObtained / m.maxMarks) * 100) : 0,
        obtained: m.marksObtained,
        maxMarks: m.maxMarks,
        grade: m.grade || computeGrade(m.marksObtained, m.maxMarks),
      }))
      .sort((a, b) => b.value - a.value);
  }, [best]);

  /** Radar needs a stable axis, so cap it at the six biggest subjects. */
  const subjectRadar = useMemo(
    () => subjectBars.slice(0, 6).map((s) => ({ subject: s.label, value: s.value, grade: s.grade })),
    [subjectBars],
  );

  /** Overall % per exam so improvement across terms is visible. */
  const examTrend = useMemo(
    () => byExam.map((e) => ({ label: e.examName, value: e.pct })),
    [byExam],
  );

  /** Grade distribution for the latest exam. */
  const gradeSplit = useMemo(() => {
    if (!best) return [];
    const counts = best.subjects.reduce((acc, m) => {
      const g = m.grade || computeGrade(m.marksObtained, m.maxMarks);
      if (g) acc[g] = (acc[g] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [best]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Academics" title="My Results" art="chart" description="Your report card for this session." />
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200 animate-pulse" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro eyebrow="Academics" title="My Results" art="chart" description="Your report card for this session." />

      {byExam.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <PageArtwork name="chart" size={64} className="mx-auto mb-4" />
            <p className="text-[15px] font-semibold text-ink">No results published</p>
            <p className="text-[13px] text-slate-text/70 mt-1">Your marks will appear here once teachers publish them.</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <div className="flex flex-col items-center gap-3 py-2">
                <ProgressRing
                  value={Number(marks.percentage) || 0}
                  size={150}
                  stroke={13}
                  color={toneKeyFor(Number(marks.percentage) || 0)}
                  label="Overall"
                  sublabel="All exams"
                  ariaLabel={`Overall percentage ${marks.percentage}`}
                />
                <Donut
                  data={gradeSplit}
                  height={132}
                  centerValue={best ? best.subjects.length : 0}
                  centerLabel="Subjects"
                />
              </div>
            </Card>

            <Card className="lg:col-span-2" title={`Subject Performance · ${best?.examName || ""}`} subtitle="Percentage scored in each subject">
              <BarRowChart
                data={subjectBars}
                height={Math.max(180, subjectBars.length * 36)}
                color="info"
                colorFor={(d) => toneFor(d.value)}
                tooltipLabel="Score"
              />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Subject Balance" subtitle="How your scores spread across subjects">
              <SubjectRadar data={subjectRadar} height={270} color="violet" />
            </Card>
            <Card title="Progress Across Exams" subtitle="Overall percentage for each exam">
              <TrendArea data={examTrend} height={270} color="violet" suffix="%" tooltipLabel="Overall" />
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
              {exam.subjects.length > 1 && (
                <div className="mb-4">
                  <BarRowChart
                    data={exam.subjects.map((m) => ({
                      id: m._id,
                      label: m.subject,
                      value: m.maxMarks ? Math.round((m.marksObtained / m.maxMarks) * 100) : 0,
                      obtained: m.marksObtained,
                      maxMarks: m.maxMarks,
                    }))}
                    height={Math.max(140, exam.subjects.length * 32)}
                    color="info"
                    colorFor={(d) => toneFor(d.value)}
                    tooltipLabel="Score"
                  />
                </div>
              )}
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
                        <tr key={m._id || i} className="border-t border-slate-200">
                          <td className="px-5 py-2.5 font-medium text-ink">{m.subject}</td>
                          <td className="px-3 py-2.5">{m.marksObtained} / {m.maxMarks}</td>
                          <td className="px-3 py-2.5"><Pill tone={["A+", "A", "B+"].includes(m.grade || computeGrade(m.marksObtained, m.maxMarks)) ? "success" : "neutral"}>{m.grade || computeGrade(m.marksObtained, m.maxMarks)}</Pill></td>
                          <td className="px-5 py-2.5 text-right font-semibold text-ink">{pct}%</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-slate-300">
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