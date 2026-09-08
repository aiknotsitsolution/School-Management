const StaffAttendance = require("../models/StaffAttendance");

const markAttendance = async (req, res) => {
  try {
    const { staffId, date, status, checkIn, checkOut, note } = req.body;
    if (!date || !status) {
      return res.status(400).json({ success: false, message: "date and status are required" });
    }
    const targetStaffId =
      req.user.role === "staff" || req.user.role === "class_teacher"
        ? req.user.refId
        : staffId;
    if (!targetStaffId) {
      return res.status(400).json({ success: false, message: "No staff record linked to this account" });
    }
    const record = await StaffAttendance.findOneAndUpdate(
      { schoolId: req.tenantId, staffId: targetStaffId, date },
      {
        $set: {
          status,
          checkIn: checkIn || null,
          checkOut: checkOut || null,
          note: note || null,
          markedBy: req.user.refId || req.user.name || req.user.id,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getAttendance = async (req, res) => {
  try {
    const { staffId, date, status, limit } = req.query;
    const filter = { schoolId: req.tenantId };
    if (req.user.role === "staff" || req.user.role === "class_teacher") {
      filter.staffId = req.user.refId;
    } else if (staffId) {
      filter.staffId = staffId;
    }
    if (date) filter.date = date;
    if (status) filter.status = status;
    const data = await StaffAttendance.find(filter)
      .sort({ date: -1 })
      .limit(Number(limit) || 200);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { markAttendance, getAttendance };