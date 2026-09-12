import { useEffect, useMemo, useState } from "react";
import { Save, ClipboardList, PenLine, Lock, Search, Users, Send, Unlock } from "lucide-react";
import { PageIntro, Card, Button, Select, Input, Pill, StatCard, toast } from "../components/UI";
import { api } from "../lib/api";
import { computeGrade, computePercentage } from "../lib/grading";
import { usePermission } from "../lib/permissions";
import { useMasterOptions } from "../hooks/useMasterOptions";
import SearchableSelect from "../components/SearchableSelect";

const CLASS_OPTIONS_FALLBACK = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11-Sci", "11-Com", "12-Sci", "12-Com"];

function formatClass(c) {
  if (["Nursery", "LKG", "UKG"].includes(c)) return c;
  return `Class ${c}`;
}

function examLabel(e) {
  return `${e.examName || "Exam"} · ${e.subject || "Subject"} · ${formatClass(e.class)}${e.section ? `-${e.section}` : ""}`;
}

export default function MarksEntry() {
  const { options: masterClasses } = useMasterOptions("classes", CLASS_OPTIONS_FALLBACK);
  const CLASS_OPTIONS = ["All", ...masterClasses.filter((c) => c !== "All")];
  const { options: masterSections, rawItems: rawSections } = useMasterOptions("sections", ["All", "A", "B", "C"]);
  const SECTION_OPTIONS = ["All", ...masterSections.filter((s) => s !== "All")];
  const canEnterMarks = usePermission("marks:write");
  const [exams, setExams] = useState([]);
  const [cls, setCls] = useState("All");
  const [sec, setSec] = useState("All");
  const [examId, setExamId] = useState("");
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState([]);
  const [entries, setEntries] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const filteredSections = useMemo(() => {
    if (cls === "All") return SECTION_OPTIONS;
    return ["All", ...[...new Set(rawSections.filter((s) => s.className === cls).map((s) => s.name))]];
  }, [cls, SECTION_OPTIONS, rawSections]);

  useEffect(() => {
    api.exams
      .list()
      .then(({ data }) => setExams((data || []).map((e) => ({ ...e, id: e._id, status: e.status || "draft" }))))
      .catch(() => {});
  }, []);

  const availableExams = useMemo(() => {
    return exams.filter((e) => {
      const matchClass = cls === "All" || e.class === cls;
      const matchSection = sec === "All" || (e.section || "") === sec;
      return matchClass && matchSection;
    });
  }, [exams, cls, sec]);

  const exam = availableExams.find((e) => e.id === examId) || null;
  const isPublished = exam?.status === "published";

  useEffect(() => {
    if (!examId) {
      setStudents([]);
      setEntries({});
      return;
    }
    setLoading(true);
    Promise.allSettled([
      api.students.list(`class=${encodeURIComponent(exam.class)}&section=${encodeURIComponent(exam.section || "")}&limit=500`),
      api.marks.list(`examId=${examId}&limit=1000`),
    ]).then(([sr, mr]) => {
      const roster = Array.isArray(sr.value?.data) ? sr.value.data : [];
      setStudents(roster);
      const prefill = {};
      (Array.isArray(mr.value?.data) ? mr.value.data : []).forEach((m) => {
        prefill[m.studentId] = {
          marksObtained: String(m.marksObtained ?? ""),
          remarks: m.remarks || "",
        };
      });
      setEntries(prefill);
      setLoading(false);
    });
  }, [examId, exam?.class, exam?.section]);

  const filteredStudents = useMemo(() => {
    if (!query.trim()) return students;
    const q = query.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.admissionNo || "").toLowerCase().includes(q) ||
        String(s.rollNo || "").includes(q),
    );
  }, [query, students]);

  const stats = useMemo(() => {
    const filled = students.filter((s) => entries[s.admissionNo] && entries[s.admissionNo].marksObtained !== "").length;
    const avg = students.reduce((sum, s) => {
      const v = Number(entries[s.admissionNo]?.marksObtained);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
    return {
      total: students.length,
      filled,
      pct: students.length ? Math.round((filled / students.length) * 100) : 0,
      average: filled ? (avg / filled).toFixed(1) : 0,
    };
  }, [students, entries]);

  const setEntry = (admissionNo, field, value) => {
    setEntries((prev) => ({
      ...prev,
      [admissionNo]: {
        marksObtained: prev[admissionNo]?.marksObtained ?? "",
        remarks: prev[admissionNo]?.remarks ?? "",
        [field]: value,
      },
    }));
  };

  const fillAll = (value) => {
    const next = {};
    students.forEach((s) => {
      next[s.admissionNo] = { marksObtained: String(value), remarks: "" };
    });
    if (Object.keys(entries).length) {
      students.forEach((s) => {
        const existing = entries[s.admissionNo];
        if (existing && existing.remarks) {
          next[s.admissionNo] = { ...next[s.admissionNo], remarks: existing.remarks };
        }
      });
    }
    setEntries(next);
  };

  const handleSave = async () => {
    if (!exam) return;
    const payload = students
      .filter((s) => {
        const v = entries[s.admissionNo]?.marksObtained;
        return v != null && String(v).trim() !== "";
      })
      .map((s) => ({
        studentId: s.admissionNo,
        marksObtained: Number(entries[s.admissionNo].marksObtained),
        remarks: entries[s.admissionNo].remarks || undefined,
      }));
    if (!payload.length) {
      toast("Enter marks for at least one student before saving", "amber");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.marks.enter({ examId: exam.id, entries: payload });
      toast(`Saved ${data.length} mark row(s)`);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const syncExamStatus = (updated) => {
    setExams((prev) =>
      prev.map((x) =>
        x.id === updated._id ? { ...x, id: updated._id, status: updated.status } : x,
      ),
    );
  };

  const publishResult = async () => {
    if (!exam) return;
    if (
      !window.confirm(
        `Publish results for "${examLabel(exam)}"? Students will be able to see their results and marks will be locked.`,
      )
    ) {
      return;
    }
    setPublishing(true);
    try {
      if (exam.status === "draft") {
        const reviewedRes = await api.exams.updateStatus(exam.id, "reviewed");
        syncExamStatus(reviewedRes.data);
      }
      const { data } = await api.exams.updateStatus(exam.id, "published");
      syncExamStatus(data);
      toast("Results published");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setPublishing(false);
    }
  };

  const unpublishResult = async () => {
    if (!exam) return;
    if (
      !window.confirm(
        `Unpublish results for "${examLabel(exam)}"? Marks become editable again and students will no longer see them.`,
      )
    ) {
      return;
    }
    setPublishing(true);
    try {
      const { data } = await api.exams.updateStatus(exam.id, "reviewed");
      syncExamStatus(data);
      toast("Results unpublished");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="Marks Entry"
        description="Record marks per student for a scheduled examination."
        right={
          exam ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {!isPublished && canEnterMarks && (
                <Button
                  variant="outline"
                  onClick={handleSave}
                  disabled={saving || !students.length}
                >
                  <Save size={15} /> {saving ? "Saving…" : "Save Marks"}
                </Button>
              )}
              {!isPublished ? (
                <Button
                  variant="amber"
                  onClick={publishResult}
                  disabled={publishing || stats.filled === 0}
                  title={
                    stats.filled === 0
                      ? "Enter marks for at least one student before publishing"
                      : undefined
                  }
                >
                  <Send size={15} /> {publishing ? "Publishing…" : "Publish Result"}
                </Button>
              ) : (
                <>
                  <Pill tone="success">Published</Pill>
                  <Button variant="outline" onClick={unpublishResult} disabled={publishing}>
                    <Unlock size={15} /> {publishing ? "Unpublishing…" : "Unpublish"}
                  </Button>
                </>
              )}
            </div>
          ) : null
        }
      />

      <Card title="Select Examination">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40" />
            <Input
              placeholder="Search students…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <SearchableSelect
            options={CLASS_OPTIONS}
            value={cls}
            onChange={(val) => { setCls(val); setSec("All"); setExamId(""); }}
            renderLabel={(c) => (c === "All" ? "All Classes" : formatClass(c))}
            placeholder="All Classes"
            className="min-w-[130px]"
          />
          <SearchableSelect
            options={filteredSections}
            value={sec}
            onChange={(val) => { setSec(val); setExamId(""); }}
            renderLabel={(s) => (s === "All" ? "All Sections" : `Section ${s}`)}
            placeholder="All Sections"
            className="min-w-[110px]"
          />
          <Select value={examId} onChange={(e) => setExamId(e.target.value)} className="min-w-[260px] flex-1">
            <option value="">Select an exam…</option>
            {availableExams.map((e) => (
              <option key={e.id} value={e.id}>
                {examLabel(e)}
                {e.status === "published" ? " · Published" : ""}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {!exam ? (
        <Card>
          <div className="py-12 text-center">
            <ClipboardList size={36} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[14px] font-medium text-ink">No examination selected</p>
            <p className="text-[13px] text-slate-text/60 mt-1">
              Choose an exam above to load its student roster.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Students" value={String(stats.total)} sub={`${formatClass(exam.class)}${exam.section ? `-${exam.section}` : ""}`} accent="info" />
            <StatCard icon={PenLine} label="Filled" value={`${stats.filled}/${stats.total}`} sub={`${stats.pct}% entered`} accent="amber" />
            <StatCard icon={ClipboardList} label="Average" value={String(stats.average)} sub={`Max ${exam.maxMarks} marks`} accent="success" />
            <StatCard icon={Lock} label="Status" value={exam.status === "published" ? "Published" : exam.status === "reviewed" ? "Reviewed" : "Draft"} sub={isPublished ? "Read-only" : "Editable"} accent={isPublished ? "alert" : "info"} />
          </div>

          <Card
            title={`Marks Entry · ${exam.subject}`}
            action={
              exam && !isPublished && canEnterMarks ? (
                <Input
                  type="number"
                  min="0"
                  max={exam.maxMarks}
                  placeholder={`Fill all (0-${exam.maxMarks})`}
                  className="w-32"
                  onChange={(e) => e.target.value !== "" && fillAll(e.target.value)}
                />
              ) : null
            }
          >
            {isPublished ? (
              <div className="py-8 text-center">
                <Lock size={32} className="mx-auto text-slate-text/30 mb-3" />
                <p className="text-[14px] font-semibold text-ink">Results are published</p>
                <p className="text-[12.5px] text-slate-text/60 mt-1">
                  Unpublish the exam from the Examination page before revising marks.
                </p>
              </div>
            ) : loading ? (
              <div className="py-12 text-center text-[13px] text-slate-text/60">Loading roster…</div>
            ) : students.length === 0 ? (
              <div className="py-12 text-center">
                <Users size={32} className="mx-auto text-slate-text/30 mb-3" />
                <p className="text-[14px] font-medium text-ink">No students found</p>
                <p className="text-[13px] text-slate-text/60 mt-1">No students are enrolled in this class/section.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide bg-paper/80 border-b border-black/[0.06]">
                      <th className="px-4 py-2.5 font-semibold">Admission No.</th>
                      <th className="px-4 py-2.5 font-semibold">Student</th>
                      <th className="px-4 py-2.5 font-semibold">Roll</th>
                      <th className="px-4 py-2.5 font-semibold">Max</th>
                      <th className="px-4 py-2.5 font-semibold">Marks Obtained</th>
                      <th className="px-4 py-2.5 font-semibold">%</th>
                      <th className="px-4 py-2.5 font-semibold">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s, idx) => {
                      const value = entries[s.admissionNo]?.marksObtained;
                      const parsed = Number(value);
                      const valid = value != null && String(value).trim() !== "" && Number.isFinite(parsed);
                      const pct = valid ? Number(computePercentage(parsed, exam.maxMarks).toFixed(2)) : null;
                      const grade = valid ? computeGrade(parsed, exam.maxMarks) : null;
                      return (
                        <tr key={s.admissionNo || s._id} className={`border-b border-black/[0.04] last:border-0 ${idx % 2 === 0 ? "" : "bg-paper/40"}`}>
                          <td className="px-4 py-3 text-slate-text">{s.admissionNo}</td>
                          <td className="px-4 py-3 font-semibold text-ink">{s.name}</td>
                          <td className="px-4 py-3 text-slate-text">{s.rollNo || "—"}</td>
                          <td className="px-4 py-3 text-slate-text">{exam.maxMarks}</td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min="0"
                              max={exam.maxMarks}
                              placeholder="—"
                              value={value ?? ""}
                              disabled={!canEnterMarks || isPublished}
                              onChange={(e) => setEntry(s.admissionNo, "marksObtained", e.target.value)}
                              className="w-24"
                            />
                          </td>
                          <td className="px-4 py-3 text-slate-text">
                            {pct != null ? `${pct}%` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {grade ? (
                              <Pill tone={["A+", "A", "B+", "B"].includes(grade) ? "success" : "neutral"}>{grade}</Pill>
                            ) : (
                              <span className="text-slate-text/40">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}