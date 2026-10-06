// The printable report-card sheet, shared by the staff Report Card page and the
// student "My Results" view. Both render the payload of GET /marks/report-card
// through this one component, so the on-screen card, the browser print and the
// server-rendered PDF stay on a single rendering instead of drifting apart per
// portal. Presentational only: no fetching, no permissions, no local state.
import { useMemo } from "react";
import { computeGrade, computePercentage } from "../../lib/grading";
import { sessionLabel } from "../../lib/session";
import {
  ACCENT_RE,
  DEFAULT_ACCENT,
  fmtDate,
  formatClass,
  getRemark,
  initialsOf,
  mergeCceAreas,
} from "./reportCardMeta";

/**
 * @param {object} school     School record (logo, name, address, settings.reportCard)
 * @param {object} student    { name, admissionNo, class, section, roll, fatherName, dob, avatar }
 * @param {string} termLabel  "Term 1" or a full exam name ("Term 1 — Unit Test")
 * @param {string} [session]  Session label; falls back to the payload, then the school
 * @param {object} report     GET /marks/report-card payload
 * @param {object} [cce]      Co-scholastic row for this student + term (nullable)
 * @param {boolean} [showCcePlaceholder] Staff can add a CCE row, so render the empty table
 */
export default function ReportCardSheet({
  school,
  student,
  termLabel,
  session,
  report,
  cce = null,
  showCcePlaceholder = false,
}) {
  const schoolName = school?.name || "Zipschool OS";
  const schoolAddress = school?.address || "";
  const schoolLogo = (school?.shortName || "S").slice(0, 1).toUpperCase();
  const reportCardSettings = school?.settings?.reportCard || {};
  const schoolAffiliation =
    reportCardSettings.affiliation || school?.affiliation || "";
  const footerNote =
    reportCardSettings.footerNote ||
    "This is a computer-generated report card for demonstration purposes.";
  const accentColor = ACCENT_RE.test(String(reportCardSettings.accent || ""))
    ? reportCardSettings.accent
    : DEFAULT_ACCENT;

  const term = termLabel || report?.examName || "Report Card";
  const sessionText =
    session ||
    report?.session ||
    sessionLabel(school) ||
    String(new Date().getFullYear());

  const results = useMemo(
    () =>
      (report?.subjects || []).map((item) => {
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
              : computePercentage(marks, max) >=
                Number(item.passingMarks || 33),
          grade: item.grade || computeGrade(marks, max),
          status: item.status || null,
          session: item.session || null,
        };
      }),
    [report],
  );

  const total = results.reduce((a, r) => a + r.marks, 0);
  const maxTotal = results.reduce((a, r) => a + r.max, 0);
  const pct = maxTotal ? ((total / maxTotal) * 100).toFixed(1) : 0;
  const overallGrade = maxTotal ? computeGrade(total, maxTotal) : "—";
  const remark = maxTotal ? getRemark(Number(pct)) : "";
  const hasMarks = results.length > 0;

  const attendance = report?.attendance || null;
  const attendancePct = attendance ? attendance.pct : null;
  const classRank = report?.classRank || null;
  const totalStudents = report?.totalStudents || 0;

  const s = student || {};
  // This card was generated for ONE class's exam — show that class, so the
  // header, the marks table and the rank all describe the same group even when
  // the student's profile has since been moved to another class.
  const cardClass = report?.class || s.class || "";
  const cardSection = report?.section || s.section || "";

  return (
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
          <p className="w-16 h-16 rounded-2xl bg-primary text-white text-3xl font-display font-bold flex items-center justify-center mx-auto">
            {schoolLogo}
          </p>
        )}
        <h2 className="font-display text-2xl font-bold text-ink mt-2 tracking-tight">
          {schoolName}
        </h2>
        <p className="text-[12.5px] text-slate-text mt-1">{schoolAddress}</p>
        {schoolAffiliation && (
          <p className="text-[11.5px] text-slate-text/70">{schoolAffiliation}</p>
        )}
        <div className="mt-3 inline-flex items-center gap-2">
          <span
            className="font-display font-semibold text-[14px]"
            style={{ color: accentColor }}
          >
            {String(term).toUpperCase()} — PROGRESS REPORT
          </span>
          <span className="text-[12.5px] text-slate-text/60">
            · {sessionText}
          </span>
        </div>
      </div>

      {/* Student Info */}
      <div className="flex items-start gap-5 mb-6">
        {s.avatar ? (
          <img
            src={s.avatar}
            alt={s.name || "Student"}
            className="w-20 h-20 rounded-xl object-cover border border-slate-300 shrink-0"
          />
        ) : (
          <div
            aria-hidden="true"
            className="w-20 h-20 rounded-xl border border-primary-border bg-primary/10 text-primary-dark text-2xl font-display font-bold flex items-center justify-center shrink-0"
          >
            {initialsOf(s.name)}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-2 text-[13px] flex-1">
          <p>
            <span className="text-slate-text/60">Student Name:</span>{" "}
            <b className="text-ink">{s.name || "—"}</b>
          </p>
          <p>
            <span className="text-slate-text/60">Admission ID:</span>{" "}
            <b className="text-ink">{s.admissionNo || "—"}</b>
          </p>
          <p>
            <span className="text-slate-text/60">Class / Section:</span>{" "}
            <b className="text-ink">
              {formatClass(cardClass)}
              {cardSection ? `-${cardSection}` : ""}
            </b>
          </p>
          <p>
            <span className="text-slate-text/60">Roll No.:</span>{" "}
            <b className="text-ink">{s.roll || "—"}</b>
          </p>
          <p>
            <span className="text-slate-text/60">Father's Name:</span>{" "}
            <b className="text-ink">{s.fatherName || "—"}</b>
          </p>
          <p>
            <span className="text-slate-text/60">Date of Birth:</span>{" "}
            <b className="text-ink">{fmtDate(s.dob)}</b>
          </p>
        </div>
      </div>

      {/* Marks Table */}
      {!hasMarks && (
        <div className="rounded-xl border border-slate-200 p-6 mb-6 text-center">
          <p className="text-[13.5px] font-semibold text-ink">
            No marks recorded for {term} yet
          </p>
          <p className="text-[12.5px] text-slate-text/60 mt-1">
            Enter marks for this exam to generate a report card.
          </p>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 mb-6">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-ink text-white text-left text-[11.5px] uppercase tracking-wide dark:bg-slate-200 dark:text-ink">
              <th className="px-4 py-3 font-semibold">Subject</th>
              <th className="px-4 py-3 font-semibold text-center">Max Marks</th>
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
                    <span className="block mt-1 text-[10px] font-semibold uppercase tracking-wide text-primary-dark">
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
                <span className="inline-flex items-center justify-center min-w-[36px] px-2 py-0.5 rounded-md bg-primary text-white text-[12px] font-bold">
                  {overallGrade}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="rounded-xl border border-slate-200 p-3.5 text-center">
          <p className="text-[11px] text-slate-text/60 uppercase tracking-wide font-semibold">
            Percentage
          </p>
          <p className="font-display text-2xl font-bold text-ink mt-1">
            {pct}%
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 p-3.5 text-center">
          <p className="text-[11px] text-slate-text/60 uppercase tracking-wide font-semibold">
            Overall Grade
          </p>
          <p className="font-display text-2xl font-bold text-primary-dark mt-1">
            {overallGrade}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 p-3.5 text-center">
          <p className="text-[11px] text-slate-text/60 uppercase tracking-wide font-semibold">
            Class Rank
          </p>
          <p className="font-display text-2xl font-bold text-ink mt-1">
            {classRank || "—"}
          </p>
          {classRank && totalStudents > 0 && (
            <p className="text-[10px] text-slate-text/60 mt-0.5">
              of {totalStudents}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 p-3.5 text-center">
          <p className="text-[11px] text-slate-text/60 uppercase tracking-wide font-semibold">
            Attendance
          </p>
          <p className="font-display text-2xl font-bold text-success mt-1">
            {attendancePct != null ? `${attendancePct}%` : "—"}
          </p>
          {attendance && (
            <p className="text-[10px] text-slate-text/60 mt-0.5">
              {attendance.present}P · {attendance.absent}A ·{" "}
              {attendance.leave}L
              {attendance.halfDays ? ` · ${attendance.halfDays}H` : ""}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 p-3.5 text-center">
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

      {/* Co-Scholastic Assessment (printed when a record exists or staff can add one) */}
      {(cce || showCcePlaceholder) && (
        <div className="mb-6">
          <p className="text-[11.5px] font-semibold text-slate-text/60 uppercase tracking-wide mb-2">
            Co-Scholastic Assessment
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-ink text-white text-left text-[11.5px] uppercase tracking-wide dark:bg-slate-200 dark:text-ink">
                  <th className="px-4 py-2.5 font-semibold">Area</th>
                  <th className="px-4 py-2.5 font-semibold text-center">
                    Grade
                  </th>
                  <th className="px-4 py-2.5 font-semibold">Remark</th>
                </tr>
              </thead>
              <tbody>
                {mergeCceAreas(cce?.areas).map((row, idx) => (
                  <tr
                    key={row.area}
                    className={`border-b border-slate-100 last:border-0 ${
                      idx % 2 ? "bg-paper/40" : "bg-white"
                    }`}
                  >
                    <td className="px-4 py-2.5 font-semibold text-ink">
                      {row.area}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center min-w-[36px] px-2 py-0.5 rounded-md bg-ink/8 text-ink text-[12px] font-bold">
                        {row.grade || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-text">
                      {row.remark || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cce?.comments && (
            <p className="text-[12.5px] text-slate-text/80 mt-2">
              <span className="font-semibold">Comments:</span> {cce.comments}
            </p>
          )}
        </div>
      )}

      {/* Remarks */}
      <div className="rounded-xl bg-paper border border-slate-200 p-4 mb-8">
        <p className="text-[11.5px] font-semibold text-slate-text/60 uppercase tracking-wide mb-1.5">
          Class Teacher's Remarks
        </p>
        <p className="text-[13.5px] text-ink leading-relaxed">{remark}</p>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200">
        <div className="text-center">
          <div className="h-12 mb-2" />
          <div className="border-t border-slate-400 pt-2">
            <p className="text-[12px] font-semibold text-ink">
              Class Teacher
            </p>
          </div>
        </div>
        <div className="text-center">
          <div className="h-12 mb-2" />
          <div className="border-t border-slate-400 pt-2">
            <p className="text-[12px] font-semibold text-ink">Principal</p>
          </div>
        </div>
        <div className="text-center">
          <div className="h-12 mb-2" />
          <div className="border-t border-slate-400 pt-2">
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
  );
}
