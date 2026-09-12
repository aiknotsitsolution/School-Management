const mongoose = require("mongoose");
const StaffAttendance = require("../models/StaffAttendance");
const Staff = require("../models/Staff");

const VALID_STATUSES = ["Present", "Absent", "Late", "Half-Day"];

const markAttendance = async (req, res) => {
  try {
    const { staffId, date, status, checkIn, checkOut, note } = req.body;
    if (!date || !status) {
      return res.status(400).json({ success: false, message: "date and status are required" });
    }
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    }
    const targetStaffId =
req.user.role === "staff" || req.user.role === "teacher"
        ? req.user.refId
        : staffId;
    if (!targetStaffId) {
      return res.status(400).json({ success: false, message: "No staff record linked to this account" });
    }
    // Admins pass a staffId from the request body; it must reference a real
    // staff record in the SAME school (tenant-scoped referential check).
    if (req.user.role === "school_admin" || req.user.role === "super_admin") {
      if (!mongoose.isValidObjectId(targetStaffId)) {
        return res.status(400).json({ success: false, message: "staffId must reference a real staff member" });
      }
      const exists = await Staff.findOne({ _id: targetStaffId, schoolId: req.tenantId }).select("_id").lean();
      if (!exists) {
        return res.status(400).json({ success: false, message: "No staff record found for this school" });
      }
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
    const { staffId, date, status, page = 1, limit = 50 } = req.query;
    const filter = { schoolId: req.tenantId };
    if (req.user.role === "staff" || req.user.role === "teacher") {
      filter.staffId = req.user.refId;
    } else if (staffId) {
      filter.staffId = staffId;
    }
    if (date) filter.date = date;
    if (status) filter.status = status;

    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (p - 1) * l;

    const [data, total] = await Promise.all([
      StaffAttendance.find(filter).sort({ date: -1 }).skip(skip).limit(l),
      StaffAttendance.countDocuments(filter),
    ]);
    res.json({ success: true, count: data.length, total, page: p, limit: l, pages: Math.ceil(total / l), data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { markAttendance, getAttendance };