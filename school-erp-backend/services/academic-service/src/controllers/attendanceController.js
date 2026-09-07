const Attendance = require("../models/Attendance");

const markAttendance = async (req, res) => {
  try {
    const { records } = req.body; // [{ studentId, class, section, date, status, remarks }]
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: "records array is required" });
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
    const data = await Attendance.find(filter).sort({ date: -1 });

    let summary = null;
    if (studentId) {
      const total = data.length;
      const present = data.filter((d) => d.status === "Present").length;
      summary = { total, present, percentage: total ? ((present / total) * 100).toFixed(2) : "0.00" };
    }

    res.json({ success: true, count: data.length, summary, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


module.exports = { markAttendance, getAttendance };
