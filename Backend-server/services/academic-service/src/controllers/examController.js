const Exam = require("../models/Exam");
const Marks = require("../models/Marks");
const ExamType = require("../models/ExamType");
const SchoolClass = require("../models/SchoolClass");
const SchoolSection = require("../models/SchoolSection");
const SchoolSubject = require("../models/SchoolSubject");
const TimeSlot = require("../models/TimeSlot");
const Room = require("../models/Room");
const ObjectId = require("mongoose").Types.ObjectId;
const { paginate, pageInfo } = require("@school-erp/shared/src/utils/pagination");
const {
  findMissingMasterRefs,
  missingMessage,
} = require("../utils/masterRefs");
const { computeGrade, computeResult } = require("../utils/grading");
const { resolveStudentAdmissionNo } = require("../services/academicYearService");
const { notifyClassStudents } = require("../utils/notify");

// Mass-assignment guard: only these fields may be set from the request body.
const EXAM_FIELDS = [
  "examName", "class", "section", "subject", "date", "startTime", "endTime", "room", "maxMarks", "passingMarks", "session",
];
// Optional reference to the master entity that produced the snapshot string.
const EXAM_REF_FIELDS = [
  "examTypeId", "classId", "sectionId", "subjectId", "timeSlotId", "roomId",
];
const TYPE_OF = {
  examTypeId: ExamType,
  classId: SchoolClass,
  sectionId: SchoolSection,
  subjectId: SchoolSubject,
  timeSlotId: TimeSlot,
  roomId: Room,
};
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

function isObjectId(value) {
  return ObjectId.isValid(value) && String(new ObjectId(value)) === String(value);
}

// Result publishing state machine: draft -> reviewed -> published.
const EXAM_STATUS_TRANSITIONS = {
  draft: ["reviewed"],
  reviewed: ["draft", "published"],
  published: ["reviewed"],
};

// Subjects toggle status:"active"/"inactive"; the other masters use active:true.
const ACTIVE_FILTERS = {
  subjectId: { status: "active" },
};

// Verify every master reference resolves inside THIS tenant. Rejects a value a
// school has no right to (cross-tenant leakage) and keeps exam records tenant-consistent.
async function validateMasterRefs(schoolId, body) {
  if (!body) return;
  const toCheck = [];
  for (const field of EXAM_REF_FIELDS) {
    const value = body[field];
    if (value == null || value === "") continue;
    if (!isObjectId(value)) {
      const wrong = new Error(`${field} must be a valid ObjectId`);
      wrong.status = 400;
      throw wrong;
    }
    toCheck.push([field, value]);
  }
  for (const [field, value] of toCheck) {
    const Model = TYPE_OF[field];
    const active = ACTIVE_FILTERS[field] || { active: true };
    const exists = await Model.findOne({ _id: value, schoolId, ...active }).lean();
    if (!exists) {
      const wrong = new Error(`Referenced ${field} does not exist for this school or is inactive`);
      wrong.status = 400;
      throw wrong;
    }
  }
}

// Snapshot strings (class/section/subject/room) must resolve to active masters
// when this school has configured the catalogs. Lenient while a kind's catalog
// is empty (legacy free-string exams keep working). On update, unchanged
// values are skipped: a legacy stored value is never re-validated, only new or
// changed values enter the dataset through the check.
async function assertSnapshotRefs(schoolId, body, existing) {
  const same = (kind) => {
    const value = body && body[kind];
    if (value == null || String(value).trim() === "") return false;
    if (existing) {
      const prev = existing[kind];
      if (prev != null && String(prev).trim() === String(value).trim()) return true;
    }
    return false;
  };
  const owned = {};
  for (const kind of ["class", "section", "subject", "room"]) {
    if (!same(kind)) owned[kind] = body ? body[kind] : undefined;
  }
  const missing = await findMissingMasterRefs({ schoolId, ...owned });
  if (missing.length) {
    const wrong = new Error(missingMessage(missing));
    wrong.status = 400;
    throw wrong;
  }
}

function toTimeSlotPayload(body) {
  const { timeSlotId, startTime, endTime } = body || {};
  const payload = {};
  if (timeSlotId) payload.timeSlotId = timeSlotId;
  if (startTime || endTime) {
    if (startTime) payload.startTime = startTime;
    if (endTime) payload.endTime = endTime;
  }
  return Object.keys(payload).length ? payload : null;
}

// Persist the validated master refs (examTypeId, classId, sectionId, subjectId,
// timeSlotId, roomId) that the snapshot strings came from.
function toRefPayload(body) {
  const payload = {};
  for (const field of EXAM_REF_FIELDS) {
    const value = body && body[field];
    if (value != null && value !== "") payload[field] = value;
  }
  return payload;
}

const createExam = async (req, res) => {
  try {
    await validateMasterRefs(req.tenantId, req.body);
    await assertSnapshotRefs(req.tenantId, req.body);
    const slot = toTimeSlotPayload(req.body) || {};
    const refs = toRefPayload(req.body);
    const payload = pick(req.body, EXAM_FIELDS);
    const exam = await Exam.create({
      ...payload,
      ...slot,
      ...refs,
      schoolId: req.tenantId,
    });
    res.status(201).json({ success: true, data: exam });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
};

const getExams = async (req, res) => {
  try {
    const { class: cls, section, subject, status, session } = req.query;
    const filter = { schoolId: req.tenantId };
    if (cls) filter.class = cls;
    if (section) filter.section = section;
    if (subject) filter.subject = subject;
    if (status) filter.status = status;
    if (session) filter.session = session;
    const { page, limit, skip } = paginate(req.query);
    const [data, total] = await Promise.all([
      Exam.find(filter).sort({ date: 1 }).skip(skip).limit(limit),
      Exam.countDocuments(filter),
    ]);
    res.json({ success: true, count: data.length, total, ...pageInfo(total, page, limit), data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateExam = async (req, res) => {
  try {
    const existing = await Exam.findOne({ _id: req.params.id, schoolId: req.tenantId });
    if (!existing) return res.status(404).json({ success: false, message: "Exam not found" });

    if (existing.status === "published") {
      return res.status(400).json({
        success: false,
        message: "This exam's results are published. Unpublish it (status -> reviewed) before editing.",
      });
    }

    await validateMasterRefs(req.tenantId, req.body);
    await assertSnapshotRefs(req.tenantId, req.body, existing);

    // Merge snapshot times with the existing record so a ref-only update never
    // blanks times, and an explicit startTime/endTime overrides them.
    const slot = toTimeSlotPayload(req.body) || {};
    const refs = toRefPayload(req.body);
    const fields = {
      ...pick(req.body, EXAM_FIELDS),
      ...(slot.startTime || slot.endTime || slot.timeSlotId ? slot : {}),
      ...refs,
    };

    const exam = await Exam.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId },
      fields,
      { new: true, runValidators: true },
    );
    res.json({ success: true, data: exam });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
};

const deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, schoolId: req.tenantId });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });
    if (exam.status !== "draft") {
      return res.status(400).json({
        success: false,
        message: "Only draft exams can be deleted. Unpublish or revert the exam to draft first.",
      });
    }
    await Marks.deleteMany({ schoolId: req.tenantId, examId: exam._id });
    await Exam.deleteOne({ _id: exam._id });
    res.json({ success: true, message: "Exam deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /exams/:id/status — explicit result publishing state machine.
const updateExamStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["draft", "reviewed", "published"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be draft, reviewed or published" });
    }
    const exam = await Exam.findOne({ _id: req.params.id, schoolId: req.tenantId });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });
    if (exam.status === status) return res.json({ success: true, data: exam });

    const allowed = EXAM_STATUS_TRANSITIONS[exam.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot move an exam from '${exam.status}' to '${status}' (allowed: ${allowed.join(", ") || "none"})`,
      });
    }
    if (status === "published") {
      const count = await Marks.countDocuments({ schoolId: req.tenantId, examId: exam._id });
      if (count === 0) {
        return res.status(400).json({ success: false, message: "Cannot publish an exam with no marks entered." });
      }
    }
    exam.status = status;
    await exam.save();
    if (status === "published") {
      notifyClassStudents({
        schoolId: req.tenantId,
        class: exam.class,
        section: exam.section,
        title: "Results Published",
        message: `Results for ${exam.examName} (${exam.subject}) are now available.`,
        kind: "exam",
        link: "/marks",
      });
    }
    res.json({ success: true, data: exam });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
};

const enterMarks = async (req, res) => {
  try {
    const { examId, entries } = req.body; // entries: [{ studentId, marksObtained }]
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, message: "entries is required" });
    }
    const exam = await Exam.findOne({ _id: examId, schoolId: req.tenantId });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });
    if (exam.status === "published") {
      return res.status(400).json({
        success: false,
        message: "This exam's results are published. Unpublish it (status -> reviewed) before revising marks.",
      });
    }

    const results = [];
    for (const e of entries) {
      const studentId = String(e.studentId || "").trim();
      if (!studentId) {
        return res.status(400).json({ success: false, message: "Every entry needs a studentId" });
      }
      const obtained = Number(e.marksObtained);
      if (Number.isNaN(obtained) || obtained < 0 || obtained > exam.maxMarks) {
        return res.status(400).json({
          success: false,
          message: `marksObtained for ${studentId} must be a number between 0 and ${exam.maxMarks}`,
        });
      }
      const result = computeResult(obtained, exam.maxMarks, exam.passingMarks ?? 33);
      // findOneAndUpdate skips the pre("save") grade hook, so grade/pct/passed
      // are computed here from the canonical grading util.
      const doc = await Marks.findOneAndUpdate(
        { schoolId: req.tenantId, studentId, examId, subject: exam.subject },
        {
          schoolId: req.tenantId,
          studentId,
          examId,
          examName: exam.examName,
          class: exam.class,
          section: exam.section || "",
          session: exam.session || "",
          subject: exam.subject,
          marksObtained: obtained,
          maxMarks: exam.maxMarks,
          passingMarks: exam.passingMarks ?? 33,
          pct: +result.pct.toFixed(2),
          grade: result.grade,
          passed: result.passed,
          remarks: e.remarks,
        },
        { new: true, upsert: true, runValidators: true },
      );
      results.push(doc);
    }
    res.json({ success: true, count: results.length, data: results });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
};

const getMarks = async (req, res) => {
  try {
    const { examId, class: cls, section, session } = req.query;
    const filter = { schoolId: req.tenantId };
    if (req.user && req.user.role === "student") {
      // Students are locked to their own records and only ever see published
      // results (scopeStudentQuery mirrors the self-scoping at the route).
      filter.studentId = String(req.user.refId || "").trim();
      const published = await Exam.find({ schoolId: req.tenantId, status: "published" })
        .select("_id")
        .lean();
      filter.examId = { $in: published.map((e) => e._id) };
    } else {
      // Teachers are constrained to their assignment scope; admins may filter.
      if (req.teacherScope) filter.class = req.teacherScope.class;
      else if (cls) filter.class = cls;
      if (examId) filter.examId = examId;
      if (section) filter.section = section;
    }
    if (session) filter.session = session;
    const { page, limit, skip } = paginate(req.query);
    const [data, total] = await Promise.all([
      Marks.find(filter).sort({ studentId: 1 }).skip(skip).limit(limit),
      Marks.countDocuments(filter),
    ]);
    res.json({ success: true, count: data.length, total, ...pageInfo(total, page, limit), data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

// examId -> { status, session } map for a report card's mark rows.
async function examStatusMap(schoolId, marks) {
  const ids = [...new Set(marks.map((m) => String(m.examId)).filter(Boolean))];
  if (!ids.length) return new Map();
  const exams = await Exam.find({ _id: { $in: ids }, schoolId })
    .select("_id status session")
    .lean();
  return new Map(exams.map((exam) => [String(exam._id), exam]));
}

// Students are locked to published results. Admins/teachers see drafts too
// unless they explicitly opt out with includeDrafts=0.
function includeDrafts(req) {
  if (req.user && req.user.role === "student") return false;
  return String(req.query.includeDrafts ?? "1") !== "0";
}

const getReportCard = async (req, res) => {
  try {
    const { examName } = req.query;
    const rawStudentId = req.query.studentId;
    if (!rawStudentId) return res.status(400).json({ success: false, message: "studentId is required" });
    const studentId = await resolveStudentAdmissionNo(req.tenantId, rawStudentId);

    const filter = { schoolId: req.tenantId, studentId };
    if (req.teacherScope) filter.class = req.teacherScope.class;
    if (examName) filter.examName = examName;
    const marks = await Marks.find(filter).sort({ subject: 1 });

    const seeAll = includeDrafts(req);
    const statusById = await examStatusMap(req.tenantId, marks);
    const visible = marks.filter((m) => {
      if (seeAll) return true;
      const exam = statusById.get(String(m.examId));
      return !!exam && exam.status === "published";
    });

    const subjects = visible.map((m) => {
      const exam = statusById.get(String(m.examId));
      const result = computeResult(m.marksObtained, m.maxMarks, m.passingMarks ?? 33);
      return {
        _id: m._id,
        subject: m.subject,
        marksObtained: m.marksObtained,
        maxMarks: m.maxMarks,
        pct: m.pct != null ? m.pct : +result.pct.toFixed(2),
        grade: m.grade || result.grade,
        passed: m.passed != null ? m.passed : result.passed,
        passingMarks: m.passingMarks ?? 33,
        session: (exam && exam.session) || m.session || null,
        status: exam ? exam.status : m.status || null,
        examId: m.examId,
        examName: m.examName,
        remarks: m.remarks || null,
      };
    });

    const totalObtained = subjects.reduce((sum, row) => sum + row.marksObtained, 0);
    const totalMax = subjects.reduce((sum, row) => sum + row.maxMarks, 0);
    const percentage = totalMax ? ((totalObtained / totalMax) * 100).toFixed(2) : "0.00";

    res.json({
      success: true,
      data: {
        studentId,
        examName: examName || "All",
        session: null,
        subjects,
        totalObtained,
        totalMax,
        percentage,
        publishedOnly: !seeAll,
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

// Aggregated academic performance for a whole class (per exam). Class Teachers
// are scoped to their assignment by scopeClassTeacher. School admins pick any class.
const getClassSummary = async (req, res) => {
  try {
    // Class-level aggregates expose every other student's marks. Students have
    // their own report card endpoint and must never reach class summary data.
    if (req.user && req.user.role === "student") {
      return res.status(403).json({ success: false, message: "Students can only view their own report card" });
    }

    const { class: cls, section, examName, session } = req.query;
    if (!cls) return res.status(400).json({ success: false, message: "class is required" });

    const filter = { schoolId: req.tenantId, class: cls };
    if (examName) filter.examName = examName;
    if (session) filter.session = session;
    const marks = await Marks.find(filter).lean();

    // Same publish visibility rule as the report card: students off, staff on.
    const seeAll = includeDrafts(req);
    const statusById = await examStatusMap(req.tenantId, marks);
    const visible = marks.filter((m) => {
      if (seeAll) return true;
      const exam = statusById.get(String(m.examId));
      return !!exam && exam.status === "published";
    });

    const byStudent = {};
    for (const m of visible) {
      if (!byStudent[m.studentId]) {
        byStudent[m.studentId] = { studentId: m.studentId, subjects: [], total: 0, maxTotal: 0 };
      }
      byStudent[m.studentId].subjects.push({
        subject: m.subject,
        marksObtained: m.marksObtained,
        maxMarks: m.maxMarks,
        grade: m.grade || computeGrade(m.marksObtained, m.maxMarks),
      });
      byStudent[m.studentId].total += m.marksObtained;
      byStudent[m.studentId].maxTotal += m.maxMarks;
    }

    let totalObtained = 0;
    let totalMax = 0;
    const rows = Object.values(byStudent).map((g) => {
      const pct = g.maxTotal ? (g.total / g.maxTotal) * 100 : 0;
      totalObtained += g.total;
      totalMax += g.maxTotal;
      g.subjects.sort((a, b) => a.subject.localeCompare(b.subject));
      return { ...g, pct: +pct.toFixed(2), grade: computeGrade(g.total, g.maxTotal) };
    });

    const classAverage = totalMax ? (totalObtained / totalMax) * 100 : 0;
    const subjectAverages = {};
    for (const m of visible) {
      if (!subjectAverages[m.subject]) subjectAverages[m.subject] = { obtained: 0, max: 0, count: 0 };
      subjectAverages[m.subject].obtained += m.marksObtained;
      subjectAverages[m.subject].max += m.maxMarks;
      subjectAverages[m.subject].count += 1;
    }
    const subjectAvgList = Object.entries(subjectAverages).map(([subject, v]) => ({
      subject,
      averagePct: v.max ? +(((v.obtained / v.max) * 100).toFixed(2)) : 0,
    }));

    rows.sort((a, b) => b.pct - a.pct);

    res.json({
      success: true,
      count: rows.length,
      data: {
        examName: examName || null,
        session: session || null,
        class: cls,
        section: section || null,
        classAveragePct: +classAverage.toFixed(2),
        subjectAverages: subjectAvgList,
        students: rows,
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createExam,
  getExams,
  updateExam,
  deleteExam,
  updateExamStatus,
  enterMarks,
  getMarks,
  getReportCard,
  getClassSummary,
};