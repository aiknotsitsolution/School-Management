const StudentHealthRecord = require("../models/StudentHealthRecord");

const getHealth = async (req, res) => {
  try {
    const { studentId } = req.query;
    if (!studentId) {
      return res.status(400).json({ success: false, message: "studentId is required" });
    }

    // Teachers must be scoped to the student's class.
    if (req.user.role === "teacher" && req.teacherScope) {
      const Student = require("../models/Student");
      const student = await Student.findOne({
        schoolId: req.tenantId,
        $or: [
          { admissionNo: studentId },
          { _id: studentId },
        ],
      }).lean();
      if (!student || !req.teacherScope.has(student.class, student.section)) {
        return res.status(403).json({ success: false, message: "Access denied — student is not in your assigned classes" });
      }
    }

    const record = await StudentHealthRecord.findOne({
      schoolId: req.tenantId,
      studentId,
    }).lean();

    res.json({ success: true, data: record || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const upsertHealth = async (req, res) => {
  try {
    const { studentId, ...update } = req.body;
    if (!studentId) {
      return res.status(400).json({ success: false, message: "studentId is required" });
    }

    // Teachers must be scoped to the student's class.
    if (req.user.role === "teacher" && req.teacherScope) {
      const Student = require("../models/Student");
      const student = await Student.findOne({
        schoolId: req.tenantId,
        $or: [
          { admissionNo: studentId },
          { _id: studentId },
        ],
      }).lean();
      if (!student || !req.teacherScope.has(student.class, student.section)) {
        return res.status(403).json({ success: false, message: "Access denied — student is not in your assigned classes" });
      }
    }

    update.lastUpdatedBy = req.user.refId || req.user.id;
    update.lastUpdatedByRole = req.user.role;

    const record = await StudentHealthRecord.findOneAndUpdate(
      { schoolId: req.tenantId, studentId },
      { $set: update },
      { upsert: true, new: true, runValidators: true },
    );

    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getHealth, upsertHealth };
