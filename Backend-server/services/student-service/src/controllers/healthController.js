const mongoose = require("mongoose");
const { scopeQuery } = require("@school-erp/shared/src/middleware/branchScope");
const StudentHealthRecord = require("../models/StudentHealthRecord");

// A student may be addressed by admissionNo or by _id. Casting a non-ObjectId
// into _id throws, so the _id arm is only added when the value really is one.
const studentIdArms = (value) => {
  const arms = [{ admissionNo: value }];
  if (mongoose.isValidObjectId(value)) arms.push({ _id: value });
  return arms;
};

// Fields that may be written via the public upsert. schoolId / _id / studentId
// are server-owned (filter keys) and must never come from the request body.
const HEALTH_WRITABLE_FIELDS = [
  "allergies",
  "chronicConditions",
  "immunizations",
  "medications",
  "bloodGroup",
  "heightCm",
  "weightKg",
  "visionNotes",
  "hearingNotes",
  "emergencyMedicalContact",
  "emergencyMedicalPhone",
  "notes",
];

const pickHealthFields = (body) =>
  Object.fromEntries(
    Object.entries(body).filter(([key]) => HEALTH_WRITABLE_FIELDS.includes(key)),
  );

const resolveStudentIdForRequest = (req) => {
  // Students may only ever touch their own record (IDOR fix).
  if (req.user.role === "student") return String(req.user.refId || "");
  return String(req.query.studentId || "");
};

const getHealth = async (req, res) => {
  try {
    if (req.user.role === "student") {
      const ownId = resolveStudentIdForRequest(req);
      if (!ownId) {
        return res.status(400).json({ success: false, message: "studentId is required" });
      }
      const record = await StudentHealthRecord.findOne(scopeQuery(StudentHealthRecord, req, {
        schoolId: req.tenantId,
        studentId: ownId,
      })).lean();
      return res.json({ success: true, data: record || null });
    }

    const { studentId } = req.query;
    if (!studentId) {
      return res.status(400).json({ success: false, message: "studentId is required" });
    }

    // Teachers must be scoped to the student's class.
    if (req.user.role === "teacher" && req.teacherScope) {
      const Student = require("../models/Student");
      const student = await Student.findOne(scopeQuery(Student, req, {
        schoolId: req.tenantId,
        $or: studentIdArms(studentId),
      })).lean();
      if (!student || !req.teacherScope.has(student.class, student.section)) {
        return res.status(403).json({ success: false, message: "Access denied — student is not in your assigned classes" });
      }
    }

    const record = await StudentHealthRecord.findOne(scopeQuery(StudentHealthRecord, req, {
      schoolId: req.tenantId,
      studentId,
    })).lean();

    res.json({ success: true, data: record || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const upsertHealth = async (req, res) => {
  try {
    const body = req.body || {};
    let studentId;
    let studentBranchId = null;
    if (req.user.role === "student") {
      studentId = resolveStudentIdForRequest(req);
      if (!studentId) {
        return res.status(400).json({ success: false, message: "studentId is required" });
      }
      const Self = require("../models/Student");
      const self = await Self.findOne(scopeQuery(Self, req, {
        schoolId: req.tenantId,
        $or: studentIdArms(studentId),
      })).select("branchId").lean();
      if (!self) {
        return res.status(404).json({ success: false, message: "No student found in this campus" });
      }
      studentBranchId = self.branchId || null;
    } else {
      studentId = body.studentId;
      if (!studentId) {
        return res.status(400).json({ success: false, message: "studentId is required" });
      }

      // The caller must actually be able to reach this student in THIS campus.
      // The upsert below matches on {schoolId, studentId} only, so this is the
      // check that keeps a campus admin out of another campus's health record.
      const Student = require("../models/Student");
      const student = await Student.findOne(scopeQuery(Student, req, {
        schoolId: req.tenantId,
        $or: studentIdArms(studentId),
      })).lean();
      if (!student) {
        return res.status(404).json({ success: false, message: "No student found in this campus" });
      }
      studentBranchId = student.branchId || null;

      // Teachers must be scoped to the student's class.
      if (req.user.role === "teacher" && req.teacherScope) {
        if (!req.teacherScope.has(student.class, student.section)) {
          return res.status(403).json({ success: false, message: "Access denied — student is not in your assigned classes" });
        }
      }
    }

    const update = pickHealthFields(body);
    update.lastUpdatedBy = req.user.refId || req.user.id;
    update.lastUpdatedByRole = req.user.role;
    // Stamped because the row is built from this update on insert; without it a
    // new row could never be found by a branch-scoped read.
    update.branchId = studentBranchId || null;

    // Match ONLY the unique index {schoolId, studentId}. branchId is not part of
    // that index, so putting it in the match made the upsert miss existing rows
    // whose branchId is null and then die on E11000 with a duplicate key error.
    const record = await StudentHealthRecord.findOneAndUpdate(
      { schoolId: req.tenantId, studentId },
      { $set: update },
      { upsert: true, new: true, runValidators: true },
    );
    if (!record) {
      return res.status(404).json({ success: false, message: "No student found in this campus" });
    }

    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getHealth, upsertHealth };
