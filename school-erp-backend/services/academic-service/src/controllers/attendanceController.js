const Attendance = require("../models/Attendance");
const { getStudentModel } = require("../db/studentDb");
const { paginate, pageInfo } = require("../utils/pagination");

// Resolves the set of admissionNo values enrolled in the teacher's class +
// section for this school. Returns null when the student DB is unreachable so
// the caller can fail closed rather than trusting unvalidated studentIds.
const getEnrolledStudentIds = async (tenantId, classLabel, section) => {
  let Student;
  try {
    Student = await getStudentModel();
  } catch (err) {
    throw new Error("Student enrollment check unavailable: " + err.message);
  }
  const query = { schoolId: tenantId, class: classLabel };
  if (section) query.section = section;
  const enrolled = await Student.find(query).select("admissionNo").lean();
  return new Set(enrolled.map((s) => String(s.admissionNo)));
};

const markAttendance = async (req, res) => {
  try {
    const { records } = req.body; // [{ studentId, class, section, date, status, remarks }]
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: "records array is required" });
    }

    // Class-teacher writes are tied to their assigned class/section. Every
    // studentId must actually be enrolled there, or the whole submission is
    // rejected — clients do not get to nominate arbitrary classmates.
    if (req.teacherScope) {
      let allowed;
      try {
        allowed = await getEnrolledStudentIds(req.tenantId, req.teacherScope.class, req.teacherScope.section);
      } catch (err) {
        return res.status(503).json({ success: false, message: err.message });
      }
      const invalid = [...new Set(records.map((r) => String(r.studentId).trim()).filter(Boolean))]
        .filter((id) => !allowed.has(id));
      if (invalid.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Some studentIds are not enrolled in your class/section",
          invalidStudentIds: invalid,
        });
      }
    }

    const ops = records.map((r) => ({
      updateOne: {
        filter: { schoolId: req.tenantId, studentId: r.studentId, date: new Date(r.date) },
        update: { ...r, schoolId: req.tenantId, date: new Date(r.date), markedBy: req.user.name },
        upsert: true,
      },
    }));
    await Attendance.bulkWrite(ops);
    res.json({ success: true, message: `Attendance marked for ${records.length} student(s)` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getAttendance = async (req, res) => {
  try {
    const { studentId, class: cls, section, from, to } = req.query;
    const filter = { schoolId: req.tenantId };
    if (studentId) filter.studentId = studentId;
    if (cls) filter.class = cls;
    if (section) filter.section = section;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }
    const { page, limit, skip } = paginate(req.query);
    const [data, total, present] = await Promise.all([
      Attendance.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
      Attendance.countDocuments(filter),
      studentId ? Attendance.countDocuments({ ...filter, status: "Present" }) : Promise.resolve(0),
    ]);

    let summary = null;
    if (studentId) {
      summary = { total: total, present: present, percentage: total ? ((present / total) * 100).toFixed(2) : "0.00" };
    }

    res.json({ success: true, count: data.length, total, ...pageInfo(total, page, limit), summary, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


module.exports = { markAttendance, getAttendance };
