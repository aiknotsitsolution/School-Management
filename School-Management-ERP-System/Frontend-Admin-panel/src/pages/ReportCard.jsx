import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Printer, Download, Search } from "lucide-react";
import { PageIntro, Card, Button, Select, Input } from "../components/UI";
import { api } from "../lib/api";
import { selectSchool } from "../store/selectors";

function getGrade(pct) {
  if (pct >= 91) return "A1";
  if (pct >= 81) return "A2";
  if (pct >= 71) return "B1";
  if (pct >= 61) return "B2";
  if (pct >= 51) return "C1";
  if (pct >= 41) return "C2";
  if (pct >= 33) return "D";
  return "E";
}

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
  const school = useSelector(selectSchool);
  const schoolName = school?.name || "School Management ERP";
  const schoolAddress = school?.address || "";
  const schoolAffiliation = school?.affiliation || "";
  const schoolLogo = (school?.shortName || "S").slice(0, 1).toUpperCase();
  const session = school?.session || String(new Date().getFullYear());
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [term, setTerm] = useState("Term 1");
  const [query, setQuery] = useState("");
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

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
    const query = `studentId=${encodeURIComponent(selectedId)}&examName=${encodeURIComponent(term)}`;
    api.marks
      .reportCard(query)
      .then(({ data }) => setReport(data))
      .catch((requestError) => setError(requestError.message));
  }, [selectedId, term]);

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
        grade: getGrade(max ? (marks / max) * 100 : 0),
      };
    });
  }, [report]);

  const total = results.reduce((a, r) => a + r.marks, 0);
  const maxTotal = results.reduce((a, r) => a + r.max, 0);
  const pct = maxTotal ? ((total / maxTotal) * 100).toFixed(1) : 0;
  const overallGrade = maxTotal ? getGrade(Number(pct)) : "—";
  const remark = maxTotal ? getRemark(Number(pct)) : "";
  const hasMarks = results.length > 0;

  const attendancePct = student?.attendance;

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
        </div>
      </Card>

      {/* Report Card Preview */}
      <Card bodyClassName="p-0">
        <div className="p-6 sm:p-8 max-w-3xl mx-auto" id="report-card-print">
          {/* Header */}
          <div className="text-center border-b-2 border-ink pb-5 mb-6">
            <p className="text-4xl leading-none">{schoolLogo}</p>
            <h2 className="font-display text-2xl font-bold text-ink mt-2 tracking-tight">
              {schoolName}
            </h2>
            <p className="text-[12.5px] text-slate-text mt-1">
              {schoolAddress}
            </p>
            <p className="text-[11.5px] text-slate-text/70">
              {schoolAffiliation}
            </p>
            <div className="mt-3 inline-flex items-center gap-2">
              <span className="font-display font-semibold text-amber-dark text-[14px]">
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
                <span className="text-slate-text/60">Student ID:</span>{" "}
                <b className="text-ink">{student.id}</b>
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
                {hasMarks ? (Number(pct) >= 33 ? "PASS" : "FAIL") : "—"}
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
            This is a computer-generated report card for demonstration purposes.
          </p>
        </div>
      </Card>
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
