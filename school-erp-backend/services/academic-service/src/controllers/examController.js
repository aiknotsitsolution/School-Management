const Exam = require("../models/Exam");
const Marks = require("../models/Marks");
const ExamType = require("../models/ExamType");
const SchoolClass = require("../models/SchoolClass");
const SchoolSection = require("../models/SchoolSection");
const SchoolSubject = require("../models/SchoolSubject");
const TimeSlot = require("../models/TimeSlot");
const Room = require("../models/Room");
const ObjectId = require("mongoose").Types.ObjectId;
const { paginate, pageInfo } = require("../utils/pagination");

// Mass-assignment guard: only these fields may be set from the request body.
const EXAM_FIELDS = [
  "examName", "class", "section", "subject", "date", "startTime", "endTime", "room", "maxMarks", "passingMarks",
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
    // Subjects are dual-scope: a valid ref is either a platform global subject
    // (schoolId null) or this school's tenant subject. Other masters are strictly
    // per-school.
    if (field === "subjectId") {
      const exists = await Model.findOne({
        _id: value,
        $or: [{ scope: "global" }, { scope: "tenant", schoolId }],
      }).lean();
      if (!exists) {
        const wrong = new Error(`Referenced ${field} does not exist for this school`);
        wrong.status = 400;
        throw wrong;
      }
      continue;
    }
    const exists = await Model.findOne({ _id: value, schoolId }).lean();
    if (!exists) {
      const wrong = new Error(`Referenced ${field} does not exist for this school`);
      wrong.status = 400;
      throw wrong;
    }
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
    const { class: cls, section, subject } = req.query;
    const filter = { schoolId: req.tenantId };
    if (cls) filter.class = cls;
    if (section) filter.section = section;
    if (subject) filter.subject = subject;
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

    await validateMasterRefs(req.tenantId, req.body);

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
    const exam = await Exam.findOneAndDelete({ _id: req.params.id, schoolId: req.tenantId });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });
    res.json({ success: true, message: "Exam deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const enterMarks = async (req, res) => {
  try {
    const { examId, entries } = req.body; // entries: [{ studentId, marksObtained }]
    const exam = await Exam.findOne({ _id: examId, schoolId: req.tenantId });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    const results = [];
    for (const e of entries) {
      const doc = await Marks.findOneAndUpdate(
        { schoolId: req.tenantId, studentId: e.studentId, examId, subject: exam.subject },
        {
          schoolId: req.tenantId,
          studentId: e.studentId,
          examId,
          examName: exam.examName,
          class: exam.class,
          subject: exam.subject,
          marksObtained: e.marksObtained,
          maxMarks: exam.maxMarks,
        },
        { new: true, upsert: true, runValidators: true },
      );
      results.push(doc);
    }
    res.json({ success: true, count: results.length, data: results });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const gradeOf = (obtained, max) => {
  if (!max) return "N/A";
  const pct = (obtained / max) * 100;
  return pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B+" : pct >= 60 ? "B" : pct >= 50 ? "C" : pct >= 33 ? "D" : "F";
};

const getReportCard = async (req, res) => {
  try {
    const { studentId, examName } = req.query;
    if (!studentId) return res.status(400).json({ success: false, message: "studentId is required" });
    const filter = { schoolId: req.tenantId, studentId };
    if (req.teacherScope) filter.class = req.teacherScope.class;
    if (examName) filter.examName = examName;
    const marks = await Marks.find(filter).sort({ subject: 1 });

    const totalObtained = marks.reduce((s, m) => s + m.marksObtained, 0);
    const totalMax = marks.reduce((s, m) => s + m.maxMarks, 0);
    const percentage = totalMax ? ((totalObtained / totalMax) * 100).toFixed(2) : "0.00";

    res.json({
      success: true,
      data: { studentId, examName: examName || "All", subjects: marks, totalObtained, totalMax, percentage },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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

    const { class: cls, section, examName } = req.query;
    if (!cls) return res.status(400).json({ success: false, message: "class is required" });

    const filter = { schoolId: req.tenantId, class: cls };
    if (examName) filter.examName = examName;

    const marks = await Marks.find(filter).lean();

    const byStudent = {};
    for (const m of marks) {
      if (!byStudent[m.studentId]) {
        byStudent[m.studentId] = { studentId: m.studentId, subjects: [], total: 0, maxTotal: 0 };
      }
      byStudent[m.studentId].subjects.push({
        subject: m.subject,
        marksObtained: m.marksObtained,
        maxMarks: m.maxMarks,
        grade: m.grade || gradeOf(m.marksObtained, m.maxMarks),
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
      return { ...g, pct: +pct.toFixed(2), grade: gradeOf(g.total, g.maxTotal) };
    });

    const classAverage = totalMax ? (totalObtained / totalMax) * 100 : 0;
    const subjectAverages = {};
    for (const m of marks) {
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
        class: cls,
        section: section || null,
        classAveragePct: +classAverage.toFixed(2),
        subjectAverages: subjectAvgList,
        students: rows,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createExam, getExams, updateExam, deleteExam, enterMarks, getReportCard, getClassSummary };
