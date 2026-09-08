import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Users,
  Search,
  Trophy,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Select,
  Pill,
  StatCard,
  Input,
  toast,
} from "../../components/UI";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { api } from "../../lib/api";
import { useTeacherContext } from "./useTeacherContext";

const SUBJECT_COLORS = ["#3B6FA0", "#3F8F5F", "#C9832A", "#9A5FB0", "#D65A4A", "#4AA3A3", "#8A7A4F"];

export default function Performance() {
  const { cls, section, assignment, query } = useTeacherContext();
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [marks, setMarks] = useState(null);
  const [examNames, setExamNames] = useState([]);
  const [examName, setExamName] = useState("");
  const [loading, setLoading] = useState(true);
  const [marksLoading, setMarksLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    Promise.allSettled([
      api.students.list(`${query}&limit=500`),
      api.attendance.list(query),
      api.exams.list(query),
    ]).then(([sr, ar, er]) => {
      setStudents(Array.isArray(sr.value?.data) ? sr.value.data : []);
      setRecords(Array.isArray(ar.value?.data) ? ar.value.data : []);
      const names = [
        ...new Set((Array.isArray(er.value?.data) ? er.value.data : []).map((e) => e.examName)),
      ];
      setExamNames(names);
      setExamName(names[0] || "");
      setLoading(false);
    });
  }, [query]);

  useEffect(() => {
    if (!examName) {
      setMarks(null);
      return;
    }
    setMarksLoading(true);
    api.marks
      .classSummary(`class=${encodeURIComponent(cls)}&examName=${encodeURIComponent(examName)}`)
      .then((res) => setMarks(res.data))
      .catch((e) => toast(e.message, "error"))
      .finally(() => setMarksLoading(false));
  }, [examName, cls]);

  const nameById = useMemo(() => {
    const map = {};
    (students || []).forEach((s) => (map[s.admissionNo] = s.name));
    return map;
  }, [students]);

  const attendanceTrend = useMemo(() => {
    const grouped = {};
    (records || []).forEach((r) => {
      const key = new Date(r.date).toISOString().slice(0, 7);
      if (!grouped[key]) grouped[key] = { total: 0, present: 0, date: r.date };
      grouped[key].total += 1;
      if (r.status === "Present") grouped[key].present += 1;
    });
    return Object.values(grouped)
      .map((g) => ({
        month: new Date(g.date).toLocaleDateString("en-IN", { month: "short" }),
        attendance: g.total ? Math.round((g.present / g.total) * 100) : 0,
      }))
      .slice(-8);
  }, [records]);

  const studentRows = useMemo(() => {
    const rows = (marks?.students || []).map((st) => ({
      ...st,
      name: nameById[st.studentId] || st.studentId,
    }));
    const q = search.toLowerCase();
    return q
      ? rows.filter((r) => r.name.toLowerCase().includes(q))
      : rows;
  }, [marks, students, nameById, search]);

  const lowScorers = (marks?.students || []).filter((s) => s.pct < 50);
  const attendanceRate = useMemo(() => {
    if (!records.length) return null;
    const present = records.filter((r) => r.status === "Present").length;
    return Math.round((present / records.length) * 100);
  }, [records]);

  if (!cls) {
    return (
      <Card>
        <div className="py-16 text-center">
          <BarChart3 size={40} className="mx-auto text-slate-text/30 mb-3" />
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
        title="Class Performance"
        description={`Attendance and academic performance for ${assignment}.`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp}
          label="Class Average"
          value={marks ? `${marks.classAveragePct}%` : "—"}
          sub={examName || "Select an exam"}
          accent="success"
        />
        <StatCard
          icon={Users}
          label="Students Assessed"
          value={String((marks?.students || []).length)}
          sub="In this exam"
          accent="info"
        />
        <StatCard
          icon={Trophy}
          label="Top Scorer"
          value={
            marks?.students?.length
              ? `${nameById[marks.students[0].studentId] || marks.students[0].studentId}`
              : "—"
          }
          sub={
            marks?.students?.length
              ? `${marks.students[0].pct}% · ${marks.students[0].grade}`
              : "Awaiting marks"
          }
          accent="amber"
        />
        <StatCard
          icon={AlertTriangle}
          label="Need Support"
          value={String(lowScorers.length)}
          sub="Scored below 50%"
          accent="alert"
        />
      </div>

      <Card
        title={
          <div className="flex flex-wrap items-center gap-3">
            <span>Academic Summary</span>
            <Select
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              className="min-w-40"
            >
              {examNames.length === 0 && <option value="">No exams yet</option>}
              {examNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
        }
        action={
          <span className="text-[12px] text-slate-text/60">
            Class average:{" "}
            <strong className="text-ink">
              {marks ? `${marks.classAveragePct}%` : "—"}
            </strong>
          </span>
        }
      >
        {marksLoading ? (
          <p className="text-[13px] text-slate-text py-10 text-center">
            Loading results…
          </p>
        ) : !marks || !marks.students.length ? (
          <p className="text-[13px] text-slate-text py-10 text-center">
            No marks have been entered for {examName || "this exam"} yet. Results
            appear here once the school office publishes them.
          </p>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-[12px] font-semibold text-slate-text/60 uppercase tracking-wide mb-3">
                Subject Averages
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={marks.subjectAverages} margin={{ left: -18, top: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEEAE0" />
                  <XAxis
                    dataKey="subject"
                    tick={{ fontSize: 11, fill: "#64748B" }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "#64748B" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid #E5E2D9", fontSize: 13 }}
                    formatter={(value) => [`${value}%`, "Average"]}
                  />
                  <Bar dataKey="averagePct" radius={[6, 6, 0, 0]}>
                    {marks.subjectAverages.map((_s, i) => (
                      <Cell key={i} fill={SUBJECT_COLORS[i % SUBJECT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-semibold text-slate-text/60 uppercase tracking-wide">
                  Student Results
                </p>
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
                  />
                  <Input
                    placeholder="Search student..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 w-52 py-1.5 text-[12.5px]"
                  />
                </div>
              </div>
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                      <th className="px-5 py-2 font-semibold">Rank</th>
                      <th className="px-3 py-2 font-semibold">Student</th>
                      <th className="px-3 py-2 font-semibold">Subjects</th>
                      <th className="px-3 py-2 font-semibold">Total</th>
                      <th className="px-3 py-2 font-semibold">%</th>
                      <th className="px-3 py-2 font-semibold">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentRows.map((st, i) => (
                      <tr key={st.studentId} className="border-t border-black/[0.06] hover:bg-paper/60">
                        <td className="px-5 py-2.5">
                          <Pill tone="neutral">#{i + 1}</Pill>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-ink">
                          {st.name}
                        </td>
                        <td className="px-3 py-2.5 text-slate-text/70">
                          {st.subjects.length}
                        </td>
                        <td className="px-3 py-2.5">
                          {st.total} <span className="text-slate-text/50">/ {st.maxTotal}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`font-bold ${
                              st.pct >= 60
                                ? "text-success"
                                : st.pct >= 50
                                  ? "text-amber-dark"
                                  : "text-alert"
                            }`}
                          >
                            {st.pct}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Pill tone={st.grade === "F" ? "alert" : "success"}>
                            {st.grade}
                          </Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Attendance Trend">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={attendanceTrend} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B6FA0" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#3B6FA0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEEAE0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: "1px solid #E5E2D9", fontSize: 13 }}
                formatter={(value) => [`${value}%`, "Attendance"]}
              />
              <Area type="monotone" dataKey="attendance" stroke="#3B6FA0" strokeWidth={2.5} fill="url(#perfGrad)" />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-[12px] text-slate-text/60 mt-2">
            Overall attendance rate:{" "}
            <strong className="text-ink">{attendanceRate ?? "—"}%</strong>
          </p>
        </Card>

        <Card title="Students Needing Support">
          {lowScorers.length === 0 ? (
            <p className="text-[13px] text-slate-text py-12 text-center">
              Great job — no students scored below 50% in {examName || "this exam"}.
            </p>
          ) : (
            <div className="space-y-2.5">
              {lowScorers.map((s) => (
                <div
                  key={s.studentId}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-alert/5 border border-alert/10"
                >
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink truncate">
                      {nameById[s.studentId] || s.studentId}
                    </p>
                    <p className="text-[11.5px] text-slate-text/60">
                      Grade {s.grade} · {s.subjects.length} subjects
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[15px] font-bold text-alert">{s.pct}%</p>
                    <Pill tone="alert">{s.grade}</Pill>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => toast("Consider follow-up with these students", "info")}
              >
                Plan follow-up
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}