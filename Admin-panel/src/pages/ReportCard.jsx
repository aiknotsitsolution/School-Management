import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Printer, Download, Search, Settings2, X, ImageUp, Trash2, Check } from "lucide-react";
import { PageIntro, Card, Button, Select, Input, toast } from "../components/UI";
import { api } from "../lib/api";
import { selectSchool } from "../store/selectors";
import { setSchool as setSchoolAction } from "../store/authSlice";
import { computeGrade, computePercentage } from "../lib/grading";
import { usePermission } from "../lib/permissions";
import { sessionLabel } from "../lib/session";

const ACCENT_RE = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_ACCENT = "#E8A33D";

function getRemark(pct) {
  if (pct >= 90) return "Outstanding performance. Keep up the excellent work!";
  if (pct >= 80) return "Very good performance. Continue the hard work.";
  if (pct >= 70)
    return "Good performance. Focus on weaker subjects for better results.";
  if (pct >= 60)
    return "Satisfactory. Needs more regular practice and revision.";
  return "Needs significant improvement. Extra attention and support recommended.";
}

function formatClass(c) {
  if (["Nursery", "LKG", "UKG"].includes(c)) return c;
  if (String(c).startsWith("11") || String(c).startsWith("12"))
    return `Class ${c}`;
  return `Class ${c}`;
}

export default function ReportCard() {
  const dispatch = useDispatch();
  const school = useSelector(selectSchool);
  const schoolName = school?.name || "Zipschool OS";
  const schoolAddress = school?.address || "";
  const schoolLogo = (school?.shortName || "S").slice(0, 1).toUpperCase();
  const session = sessionLabel(school) || String(new Date().getFullYear());
  const canCustomize = usePermission("school:settings");
  const reportCardSettings = school?.settings?.reportCard || {};
  const schoolAffiliation =
    reportCardSettings.affiliation || school?.affiliation || "";
  const footerNote =
    reportCardSettings.footerNote ||
    "This is a computer-generated report card for demonstration purposes.";
  const accentColor = ACCENT_RE.test(reportCardSettings.accent)
    ? reportCardSettings.accent
    : DEFAULT_ACCENT;
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [term, setTerm] = useState("Term 1");
  const [query, setQuery] = useState("");
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [includeDrafts, setIncludeDrafts] = useState(true);
  const [customizing, setCustomizing] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);
  const [customDraft, setCustomDraft] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!canCustomize) return;
    api.school
      .me()
      .then(({ data }) => dispatch(setSchoolAction(data)))
      .catch(() => {});
  }, [canCustomize, dispatch]);

  useEffect(() => {
    api.students
      .list("limit=1000")
      .then(({ data }) => {
        const loadedStudents = (data || []).map((item) => ({
          ...item,
          id: item._id,
          roll: item.rollNo || "—",
          fatherName: item.parentName || "—",
          avatar:
            item.photoUrl ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=16213E&color=fff&bold=true`,
        }));
        setStudents(loadedStudents);
        setSelectedId(loadedStudents[0]?.id || "");
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setReport(null);
      return;
    }
    const selectedStudent = students.find((s) => s.id === selectedId);
    const studentId = selectedStudent?.admissionNo || selectedId;
    const query = `studentId=${encodeURIComponent(studentId)}&examName=${encodeURIComponent(term)}&includeDrafts=${includeDrafts ? "1" : "0"}`;
    api.marks
      .reportCard(query)
      .then(({ data }) => setReport(data))
      .catch((requestError) => setError(requestError.message));
  }, [selectedId, term, students, includeDrafts]);

  const filteredStudents = useMemo(() => {
    if (!query.trim()) return students.slice(0, 40);
    const q = query.toLowerCase();
    return students
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          String(s.roll).includes(q),
      )
      .slice(0, 40);
  }, [query, students]);

  const student = students.find((s) => s.id === selectedId) || students[0];

  const results = useMemo(() => {
    return (report?.subjects || []).map((item) => {
      const marks = Number(item.marksObtained || 0);
      const max = Number(item.maxMarks || 0);
      return {
        subject: item.subject,
        marks,
        max,
        pct: Number(item.pct ?? (max ? (marks / max) * 100 : 0)),
        passed:
          item.passed != null
            ? item.passed
            : computePercentage(marks, max) >= Number(item.passingMarks || 33),
        grade: item.grade || computeGrade(marks, max),
        status: item.status || null,
        session: item.session || null,
      };
    });
  }, [report]);

  const total = results.reduce((a, r) => a + r.marks, 0);
  const maxTotal = results.reduce((a, r) => a + r.max, 0);
  const pct = maxTotal ? ((total / maxTotal) * 100).toFixed(1) : 0;
  const overallGrade = maxTotal ? computeGrade(total, maxTotal) : "—";
  const remark = maxTotal ? getRemark(Number(pct)) : "";
  const hasMarks = results.length > 0;

  const attendancePct = student?.attendance;

  const openCustomize = () => {
    setCustomDraft({
      logo: school?.logo || "",
      affiliation: reportCardSettings.affiliation || school?.affiliation || "",
      footerNote: reportCardSettings.footerNote || "",
      accent: accentColor,
    });
    setCustomizing(true);
  };

  const pickLogo = (file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      toast("Please choose an image file", "error");
      return;
    }
    if (file.size > 1024 * 1024) {
      toast("Logo should be smaller than 1MB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCustomDraft((d) => ({ ...d, logo: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const saveCustom = async () => {
    if (!customDraft) return;
    if (!ACCENT_RE.test(customDraft.accent)) {
      toast("Accent must be a hex color like #E8A33D", "error");
      return;
    }
    setSavingCustom(true);
    try {
      const { data } = await api.school.update({
        logo: customDraft.logo,
        reportCard: {
          affiliation: customDraft.affiliation,
          footerNote: customDraft.footerNote,
          accent: customDraft.accent,
        },
      });
      dispatch(setSchoolAction(data));
      localStorage.setItem("erp_school", JSON.stringify(data));
      toast("Report card settings saved");
      setCustomizing(false);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSavingCustom(false);
    }
  };

  if (!student) {
    return (
      <div className="space-y-6">
        <PageIntro
          eyebrow="Academics"
          title="Report Card"
          description={error || "No students are available for a report card."}
        />
        <Card>
          <p className="text-sm text-slate-text">
            Create a student record before generating a report card.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="Report Card"
        description="Generate and print term-wise report cards for any student."
        right={
          <div className="flex gap-2 no-print">
            {canCustomize && (
              <Button variant="outline" onClick={openCustomize}>
                <Settings2 size={15} /> Customize
              </Button>
            )}
            <Button variant="outline">
              <Download size={15} /> Download PDF
            </Button>
            <Button variant="amber" onClick={() => window.print()}>
              <Printer size={15} /> Print
            </Button>
          </div>
        }
      />

      {/* Controls (hidden on print) */}
      <Card className="no-print" title="Select Student">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
            />
            <Input
              placeholder="Search by name, ID or roll..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="min-w-[260px]"
          >
            {filteredStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {formatClass(s.class)}-{s.section} (Roll {s.roll})
              </option>
            ))}
          </Select>
          <Select
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="min-w-[130px]"
          >
            <option value="Term 1">Term 1</option>
            <option value="Term 2">Term 2</option>
            <option value="Final">Final</option>
          </Select>
          <label className="inline-flex items-center gap-2 shrink-0 text-[12.5px] font-medium text-slate-text cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeDrafts}
              onChange={(e) => setIncludeDrafts(e.target.checked)}
              className="accent-amber"
            />
            Include draft results
          </label>
        </div>
        {!includeDrafts && (
          <p className="text-[12px] text-slate-text/60 mt-2">
            Only published results are shown. Turn on “Include draft results” to
            preview marks entered for exams that are still in draft/review.
          </p>
        )}
      </Card>

      {/* Report Card Preview */}
      <Card bodyClassName="p-0">
        <div className="p-6 sm:p-8 max-w-3xl mx-auto" id="report-card-print">
          {/* Header */}
          <div
            className="text-center border-b-2 border-ink pb-5 mb-6"
            style={{ borderColor: accentColor }}
          >
            {school?.logo ? (
              <img
                src={school.logo}
                alt={`${schoolName} logo`}
                className="h-16 max-w-[180px] w-auto object-contain mx-auto"
              />
            ) : (
              <p className="w-16 h-16 rounded-2xl bg-ink text-amber text-3xl font-display font-bold flex items-center justify-center mx-auto">
                {schoolLogo}
              </p>
            )}
            <h2 className="font-display text-2xl font-bold text-ink mt-2 tracking-tight">
              {schoolName}
            </h2>
            <p className="text-[12.5px] text-slate-text mt-1">
              {schoolAddress}
            </p>
            {schoolAffiliation && (
              <p className="text-[11.5px] text-slate-text/70">
                {schoolAffiliation}
              </p>
            )}
            <div className="mt-3 inline-flex items-center gap-2">
              <span
                className="font-display font-semibold text-[14px]"
                style={{ color: accentColor }}
              >
                {term.toUpperCase()} — PROGRESS REPORT
              </span>
              <span className="text-[12.5px] text-slate-text/60">
                · {session}
              </span>
            </div>
          </div>

          {/* Student Info */}
          <div className="flex items-start gap-5 mb-6">
            <img
              src={student.avatar}
              alt={student.name}
              className="w-20 h-20 rounded-xl object-cover border border-black/10 shrink-0"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-2 text-[13px] flex-1">
              <p>
                <span className="text-slate-text/60">Student Name:</span>{" "}
                <b className="text-ink">{student.name}</b>
              </p>
              <p>
                <span className="text-slate-text/60">Admission ID:</span>{" "}
                <b className="text-ink">{student.admissionNo || "—"}</b>
              </p>
              <p>
                <span className="text-slate-text/60">Class / Section:</span>{" "}
                <b className="text-ink">
                  {formatClass(student.class)}-{student.section}
                </b>
              </p>
              <p>
                <span className="text-slate-text/60">Roll No.:</span>{" "}
                <b className="text-ink">{student.roll}</b>
              </p>
              <p>
                <span className="text-slate-text/60">Father's Name:</span>{" "}
                <b className="text-ink">{student.fatherName}</b>
              </p>
              <p>
                <span className="text-slate-text/60">Date of Birth:</span>{" "}
                <b className="text-ink">{student.dob}</b>
              </p>
            </div>
          </div>

          {/* Marks Table */}
          {!hasMarks && (
            <div className="rounded-xl border border-black/[0.08] p-6 mb-6 text-center">
              <p className="text-[13.5px] font-semibold text-ink">
                No marks recorded for {term} yet
              </p>
              <p className="text-[12.5px] text-slate-text/60 mt-1">
                Enter marks for this exam to generate a report card.
              </p>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-black/[0.08] mb-6">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-ink text-white text-left text-[11.5px] uppercase tracking-wide">
                  <th className="px-4 py-3 font-semibold">Subject</th>
                  <th className="px-4 py-3 font-semibold text-center">
                    Max Marks
                  </th>
                  <th className="px-4 py-3 font-semibold text-center">
                    Marks Obtained
                  </th>
                  <th className="px-4 py-3 font-semibold text-center">Grade</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, idx) => (
                  <tr
                    key={r.subject}
                    className={idx % 2 === 0 ? "bg-white" : "bg-paper/60"}
                  >
                    <td className="px-4 py-2.5 font-semibold text-ink">
                      {r.subject}
                    </td>
                    <td className="px-4 py-2.5 text-center text-slate-text">
                      {r.max}
                    </td>
                    <td className="px-4 py-2.5 text-center font-semibold text-ink">
                      {r.marks}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center min-w-[36px] px-2 py-0.5 rounded-md bg-ink/8 text-ink text-[12px] font-bold">
                        {r.grade}
                      </span>
                      {r.status && r.status !== "published" && (
                        <span className="block mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-dark">
                          {r.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="bg-ink/5 border-t-2 border-ink/20 font-semibold">
                  <td className="px-4 py-3 text-ink">Total</td>
                  <td className="px-4 py-3 text-center text-ink">{maxTotal}</td>
                  <td className="px-4 py-3 text-center text-ink">{total}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center min-w-[36px] px-2 py-0.5 rounded-md bg-amber text-ink text-[12px] font-bold">
                      {overallGrade}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Summary boxes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl border border-black/[0.08] p-3.5 text-center">
              <p className="text-[11px] text-slate-text/60 uppercase tracking-wide font-semibold">
                Percentage
              </p>
              <p className="font-display text-2xl font-bold text-ink mt-1">
                {pct}%
              </p>
            </div>
            <div className="rounded-xl border border-black/[0.08] p-3.5 text-center">
              <p className="text-[11px] text-slate-text/60 uppercase tracking-wide font-semibold">
                Overall Grade
              </p>
              <p className="font-display text-2xl font-bold text-amber-dark mt-1">
                {overallGrade}
              </p>
            </div>
            <div className="rounded-xl border border-black/[0.08] p-3.5 text-center">
              <p className="text-[11px] text-slate-text/60 uppercase tracking-wide font-semibold">
                Attendance
              </p>
              <p className="font-display text-2xl font-bold text-success mt-1">
                {attendancePct ? `${attendancePct}%` : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-black/[0.08] p-3.5 text-center">
              <p className="text-[11px] text-slate-text/60 uppercase tracking-wide font-semibold">
                Result
              </p>
              <p className="font-display text-lg font-bold text-success mt-1.5">
                {hasMarks
                  ? results.every((r) => r.passed)
                    ? "PASS"
                    : "FAIL"
                  : "—"}
              </p>
            </div>
          </div>

          {/* Remarks */}
          <div className="rounded-xl bg-paper border border-black/[0.06] p-4 mb-8">
            <p className="text-[11.5px] font-semibold text-slate-text/60 uppercase tracking-wide mb-1.5">
              Class Teacher's Remarks
            </p>
            <p className="text-[13.5px] text-ink leading-relaxed">{remark}</p>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-black/[0.08]">
            <div className="text-center">
              <div className="h-12 mb-2" />
              <div className="border-t border-black/20 pt-2">
                <p className="text-[12px] font-semibold text-ink">
                  Class Teacher
                </p>
              </div>
            </div>
            <div className="text-center">
              <div className="h-12 mb-2" />
              <div className="border-t border-black/20 pt-2">
                <p className="text-[12px] font-semibold text-ink">Principal</p>
              </div>
            </div>
            <div className="text-center">
              <div className="h-12 mb-2" />
              <div className="border-t border-black/20 pt-2">
                <p className="text-[12px] font-semibold text-ink">
                  Parent / Guardian
                </p>
              </div>
            </div>
          </div>

          <p className="text-center text-[11px] text-slate-text/50 mt-6">
            {footerNote}
          </p>
        </div>
      </Card>

      {/* Customize report card */}
      {customizing && customDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => !savingCustom && setCustomizing(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  Customize Report Card
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  School logo, affiliation and styling used on printed report
                  cards.
                </p>
              </div>
              <button
                onClick={() => !savingCustom && setCustomizing(false)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-[12.5px] font-medium text-ink mb-1.5">
                  School Logo
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border border-black/10 bg-paper flex items-center justify-center overflow-hidden shrink-0">
                    {customDraft.logo ? (
                      <img
                        src={customDraft.logo}
                        alt="Logo preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-2xl font-display font-bold text-slate-text/40">
                        {schoolLogo}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => pickLogo(e.target.files?.[0])}
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileRef.current?.click()}
                      disabled={savingCustom}
                    >
                      <ImageUp size={15} /> Upload logo
                    </Button>
                    {customDraft.logo && (
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setCustomDraft((d) => ({ ...d, logo: "" }))
                        }
                        disabled={savingCustom}
                      >
                        <Trash2 size={14} /> Remove
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-[11.5px] text-slate-text/50 mt-1.5">
                  PNG / JPG / WebP / SVG, up to 1MB. Saved with the school
                  record — no logo shows the first letter as a badge.
                </p>
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-ink mb-1.5">
                  Affiliation line
                </label>
                <Input
                  value={customDraft.affiliation}
                  onChange={(e) =>
                    setCustomDraft((d) => ({
                      ...d,
                      affiliation: e.target.value,
                    }))
                  }
                  placeholder="Affiliated to CBSE, New Delhi"
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-ink mb-1.5">
                  Footer note
                </label>
                <Input
                  value={customDraft.footerNote}
                  onChange={(e) =>
                    setCustomDraft((d) => ({
                      ...d,
                      footerNote: e.target.value,
                    }))
                  }
                  placeholder="This is a computer-generated report card"
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-ink mb-1.5">
                  Accent color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={ACCENT_RE.test(customDraft.accent) ? customDraft.accent : DEFAULT_ACCENT}
                    onChange={(e) =>
                      setCustomDraft((d) => ({ ...d, accent: e.target.value }))
                    }
                    className="w-10 h-10 rounded-lg border border-black/10 cursor-pointer bg-transparent p-0.5"
                  />
                  <Input
                    value={customDraft.accent}
                    onChange={(e) =>
                      setCustomDraft((d) => ({ ...d, accent: e.target.value }))
                    }
                    className="w-28 font-mono"
                    placeholder="#E8A33D"
                  />
                </div>
                <p className="text-[11.5px] text-slate-text/50 mt-1.5">
                  Used for the report-card header rule and the term title.
                </p>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-black/[0.06] flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setCustomizing(false)}
                disabled={savingCustom}
              >
                Cancel
              </Button>
              <Button
                variant="amber"
                onClick={saveCustom}
                disabled={savingCustom || !ACCENT_RE.test(customDraft.accent)}
              >
                <Check size={15} />
                {savingCustom ? "Saving…" : "Save Settings"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// import { Printer, Download } from "lucide-react";
// import { PageIntro, Card, Button, Select } from "../components/UI";

// export default function ReportCard() {
//   const student = students[3];
//   const total = subjectResults.reduce((a, s) => a + s.marks, 0);
//   const maxTotal = subjectResults.reduce((a, s) => a + s.max, 0);
//   const pct = ((total / maxTotal) * 100).toFixed(1);
//   const grade = pct >= 90 ? "A1" : pct >= 80 ? "A2" : pct >= 70 ? "B1" : "B2";

//   return (
//     <div className="space-y-6">
//       <PageIntro
//         eyebrow="Academics"
//         title="Report Card"
//         description="Generate and print term-wise report cards for any student."
//         right={
//           <div className="flex gap-2">
//             <Button variant="outline"><Download size={15} /> Download PDF</Button>
//             <Button variant="amber" onClick={() => window.print()}><Printer size={15} /> Print</Button>
//           </div>
//         }
//       />

//       <Card
//         action={
//           <Select defaultValue={student.id}>
//             {students.slice(0, 10).map((s) => (
//               <option key={s.id} value={s.id}>{s.name} — Class {s.class}-{s.section}</option>
//             ))}
//           </Select>
//         }
//       >
//         <div className="max-w-3xl mx-auto">
//           <div className="text-center border-b-2 border-ink pb-4 mb-5">
//             <p className="text-3xl">{school.logo}</p>
//             <h2 className="font-display text-xl font-bold text-ink mt-1">{school.name}</h2>
//             <p className="text-[11.5px] text-slate-text">{school.address}</p>
//             <p className="text-[11px] text-slate-text/70">{school.affiliation}</p>
//             <p className="font-display font-semibold text-amber-dark mt-2 text-[13px]">TERM 2 — PROGRESS REPORT · {school.session}</p>
//           </div>

//           <div className="flex items-center gap-4 mb-6">
//             <img src={student.avatar} alt={student.name} className="w-16 h-16 rounded-xl object-cover" />
//             <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[12.5px] flex-1">
//               <p><span className="text-slate-text/60">Student Name:</span> <b className="text-ink">{student.name}</b></p>
//               <p><span className="text-slate-text/60">Roll No.:</span> <b className="text-ink">{student.roll}</b></p>
//               <p><span className="text-slate-text/60">Class:</span> <b className="text-ink">{student.class}-{student.section}</b></p>
//               <p><span className="text-slate-text/60">House:</span> <b className="text-ink">{student.house}</b></p>
//               <p><span className="text-slate-text/60">DOB:</span> <b className="text-ink">{student.dob}</b></p>
//               <p><span className="text-slate-text/60">Attendance:</span> <b className="text-ink">{student.attendance}%</b></p>
//             </div>
//           </div>

//           <table className="w-full text-[13px] border border-black/10 rounded-lg overflow-hidden mb-5">
//             <thead>
//               <tr className="bg-ink text-white text-left text-[11.5px] uppercase">
//                 <th className="px-4 py-2.5 font-semibold">Subject</th>
//                 <th className="px-4 py-2.5 font-semibold text-center">Marks Obtained</th>
//                 <th className="px-4 py-2.5 font-semibold text-center">Max Marks</th>
//                 <th className="px-4 py-2.5 font-semibold text-center">Grade</th>
//               </tr>
//             </thead>
//             <tbody>
//               {subjectResults.map((s) => {
//                 const g = s.marks >= 90 ? "A1" : s.marks >= 80 ? "A2" : s.marks >= 70 ? "B1" : "B2";
//                 return (
//                   <tr key={s.subject} className="border-t border-black/[0.06]">
//                     <td className="px-4 py-2.5 font-medium text-ink">{s.subject}</td>
//                     <td className="px-4 py-2.5 text-center text-slate-text">{s.marks}</td>
//                     <td className="px-4 py-2.5 text-center text-slate-text">{s.max}</td>
//                     <td className="px-4 py-2.5 text-center font-semibold text-success">{g}</td>
//                   </tr>
//                 );
//               })}
//               <tr className="border-t-2 border-ink bg-paper font-bold">
//                 <td className="px-4 py-2.5 text-ink">Total</td>
//                 <td className="px-4 py-2.5 text-center text-ink">{total}</td>
//                 <td className="px-4 py-2.5 text-center text-ink">{maxTotal}</td>
//                 <td className="px-4 py-2.5 text-center text-success">{grade}</td>
//               </tr>
//             </tbody>
//           </table>

//           <div className="grid grid-cols-3 gap-4 mb-6">
//             <div className="rounded-xl bg-paper p-4 text-center">
//               <p className="font-display text-2xl font-bold text-ink">{pct}%</p>
//               <p className="text-[11px] text-slate-text/60 mt-0.5">Overall Percentage</p>
//             </div>
//             <div className="rounded-xl bg-paper p-4 text-center">
//               <p className="font-display text-2xl font-bold text-ink">{grade}</p>
//               <p className="text-[11px] text-slate-text/60 mt-0.5">Overall Grade</p>
//             </div>
//             <div className="rounded-xl bg-paper p-4 text-center">
//               <p className="font-display text-2xl font-bold text-ink">6 / 42</p>
//               <p className="text-[11px] text-slate-text/60 mt-0.5">Class Rank</p>
//             </div>
//           </div>

//           <div>
//             <p className="text-[12.5px] font-semibold text-ink mb-1">Class Teacher's Remark</p>
//             <p className="text-[12.5px] text-slate-text italic">
//               "{student.name.split(" ")[0]} has shown consistent improvement this term, particularly in analytical subjects. Encourage more practice in written expression."
//             </p>
//           </div>

//           <div className="flex justify-between mt-10 pt-4 border-t border-black/10 text-[11.5px] text-slate-text">
//             <p>Class Teacher's Signature</p>
//             <p>Principal's Signature</p>
//           </div>
//         </div>
//       </Card>
//     </div>
//   );
// }
