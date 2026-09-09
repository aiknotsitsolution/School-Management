const Exam = require("../models/Exam");
const Marks = require("../models/Marks");
const { paginate, pageInfo } = require("../utils/pagination");

// Mass-assignment guard: only these fields may be set from the request body.
const EXAM_FIELDS = [
  "examName", "class", "subject", "date", "startTime", "endTime", "room", "maxMarks", "passingMarks",
];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const createExam = async (req, res) => {
  try {
    const exam = await Exam.create({ ...pick(req.body, EXAM_FIELDS), schoolId: req.tenantId });
    res.status(201).json({ success: true, data: exam });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getExams = async (req, res) => {
  try {
    const { class: cls, subject } = req.query;
    const filter = { schoolId: req.tenantId };
    if (cls) filter.class = cls;
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
    const exam = await Exam.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId },
      pick(req.body, EXAM_FIELDS),
      { new: true, runValidators: true },
    );
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });
    res.json({ success: true, data: exam });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
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
