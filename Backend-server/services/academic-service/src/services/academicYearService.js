const Exam = require("../models/Exam");
const Marks = require("../models/Marks");
const StudentAcademicRecord = require("../models/StudentAcademicRecord");
const { getStudentModel } = require("../db/studentDb");
const { computeResultWith, resolveScale } = require("../utils/grading");
const ObjectId = require("mongoose").Types.ObjectId;

// ---------------------------------------------------------------------------
// Shared academic-year flow logic used by promotion, transfer and rollover
// controllers (plus the report-card identity resolution). Keeps session
// parsing, roster building and result summaries in one place so business
// rules are not re-implemented per controller.
// ---------------------------------------------------------------------------

const ACADEMIC_RECORD_STATUSES = [
  "Promoted",
  "Promoted with Conditions",
  "Detained",
  "Transferred",
  "Graduated",
];

// "2026-27" -> "2027-28". Returns null for unparseable labels.
function deriveNextSession(session) {
  const match = String(session || "").trim().match(/^(\d{4})\s*[-—–]\s*(\d{2})$/);
  if (!match) return null;
  const start = parseInt(match[1], 10);
  const nextStart = start + 1;
  return `${nextStart}-${String((nextStart + 1) % 100).padStart(2, "0")}`;
}

function isObjectId(value) {
  return ObjectId.isValid(value) && String(new ObjectId(value)) === String(value);
}

// Fail-open access to the student mirror: when STUDENT_MONGODB_URI is absent
// (legacy/test single-DB setups) the mirror is unavailable and callers degrade
// gracefully (e.g. report card keeps the raw admissionNo).
async function tryStudentModel() {
  try {
    return await getStudentModel();
  } catch {
    return null;
  }
}

// Resolve a report-card / promotion / transfer student reference to the
// canonical admissionNo, tenant-safe: the value may be a MongoDB _id or an
// admissionNo string, and must belong to this school.
async function resolveStudentAdmissionNo(schoolId, value) {
  if (value == null || String(value).trim() === "") return value;
  const Student = await tryStudentModel();
  if (!Student) return value;
  const trimmed = String(value).trim();
  if (isObjectId(trimmed)) {
    const byId = await Student.findOne({ _id: trimmed, schoolId }).select("admissionNo").lean();
    if (byId) return byId.admissionNo;
  }
  const byNo = await Student.findOne({ schoolId, admissionNo: trimmed }).select("admissionNo").lean();
  if (byNo) return byNo.admissionNo;
  return trimmed; // legacy admission id with no student row yet — pass through
}

// Published exam ids for a session (optionally class-scoped).
// branchId is threaded through the session/promotion helpers below so a summary
// can never mix marks from another campus; resolveScale() stays school-wide
// because grading scales are a school-level policy.
async function publishedExamIdsForSession({ schoolId, branchId, session, class: cls }) {
  const filter = { schoolId, status: "published" };
  if (branchId) filter.branchId = branchId;
  if (session) filter.session = session;
  if (cls) filter.class = cls;
  const exams = await Exam.find(filter).select("_id").lean();
  return exams.map((exam) => exam._id);
}

// Best-marks-per-subject result summary across a session's published exams.
async function computeStudentSummary({ schoolId, branchId, studentId, session, class: cls, section: sec }) {
  const examIds = await publishedExamIdsForSession({ schoolId, branchId, session, class: cls, section: sec });
  if (!examIds.length) {
    return { totalObtained: 0, totalMax: 0, percentage: null, failedSubjects: 0, subjects: [] };
  }
  const marksFilter = { schoolId, studentId, examId: { $in: examIds } };
  if (branchId) marksFilter.branchId = branchId;
  const marks = await Marks.find(marksFilter).lean();
  const scale = await resolveScale(schoolId);
  const bySubject = {};
  for (const mark of marks) {
    const result = computeResultWith(scale, mark.marksObtained, mark.maxMarks, mark.passingMarks ?? null);
    const prev = bySubject[mark.subject];
    if (!prev || mark.marksObtained > prev.marksObtained) {
      bySubject[mark.subject] = {
        subject: mark.subject,
        marksObtained: mark.marksObtained,
        maxMarks: mark.maxMarks,
        passed: result.passed,
        pct: +result.pct.toFixed(2),
        grade: result.grade,
      };
    }
  }
  const subjects = Object.values(bySubject).sort((a, b) => a.subject.localeCompare(b.subject));
  const totalObtained = subjects.reduce((sum, row) => sum + row.marksObtained, 0);
  const totalMax = subjects.reduce((sum, row) => sum + row.maxMarks, 0);
  return {
    subjects,
    totalObtained,
    totalMax,
    failedSubjects: subjects.filter((row) => !row.passed).length,
    percentage: totalMax ? +((totalObtained / totalMax) * 100).toFixed(2) : null,
  };
}

// Enrolled students for a class/section, excluding students already recorded
// for the from-session of the given flow kind (prevents duplicate promotion).
async function rosterFor({ schoolId, branchId, class: cls, section: sec, fromSession, kind = "promotion" }) {
  const Student = await tryStudentModel();
  if (!Student) {
    const err = new Error("Student database is not configured for academic-service");
    err.status = 503;
    throw err;
  }
  const filter = { schoolId, status: { $in: ["Active", "Inactive"] } };
  if (branchId) filter.branchId = branchId;
  if (cls) filter.class = cls;
  if (sec) filter.section = sec;
  const students = await Student.find(filter)
    .select("admissionNo name class section rollNo")
    .lean();
  if (fromSession) {
    const doneFilter = { schoolId, session: fromSession, kind };
    if (branchId) doneFilter.branchId = branchId;
    const done = await StudentAcademicRecord.find(doneFilter)
      .select("studentId")
      .lean();
    const doneSet = new Set(done.map((d) => d.studentId));
    return students.filter((s) => !doneSet.has(s.admissionNo));
  }
  return students;
}

// Union of student admission numbers across a teacher's whole assignment
// union. StudentAcademicRecord rows are addressed by studentId only (they
// carry no class/section), so scoping a teacher to their academic history means
// resolving the request through the roster rather than filtering a class field.
// Returns [] when there is nothing to scope to, which fails closed for the
// caller ($in: [] matches no record).
async function rosterAdmissionNosFor({ schoolId, branchId, scopes }) {
  const pairs = (scopes || [])
    .filter((s) => s && s.class != null && String(s.class).trim() !== "")
    .map((s) => ({ class: String(s.class), section: s.section == null ? null : String(s.section) }));
  if (!pairs.length) return [];
  const Student = await tryStudentModel();
  if (!Student) return [];
  const filter = { schoolId, status: { $in: ["Active", "Inactive"] } };
  if (branchId) filter.branchId = branchId;
  filter.$or = pairs.map((p) =>
    p.section == null || p.section === "" ? { class: p.class } : { class: p.class, section: p.section },
  );
  const rows = await Student.find(filter).select("admissionNo").lean();
  return rows.map((r) => String(r.admissionNo)).filter(Boolean);
}

// Distinct enrolled classes for a school (rollover preparation).
async function enrolledClasses({ schoolId, branchId }) {
  const Student = await tryStudentModel();
  if (!Student) return [];
  const filter = { schoolId, status: { $in: ["Active", "Inactive"] } };
  if (branchId) filter.branchId = branchId;
  const raw = await Student.distinct("class", filter);
  return raw.filter((c) => c).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
}

module.exports = {
  ACADEMIC_RECORD_STATUSES,
  deriveNextSession,
  resolveStudentAdmissionNo,
  tryStudentModel,
  publishedExamIdsForSession,
  computeStudentSummary,
  rosterFor,
  rosterAdmissionNosFor,
  enrolledClasses,
};