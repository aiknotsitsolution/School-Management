const Leave = require("../models/Leave");
const Staff = require("../models/Staff");
const { pushNotifications } = require("../utils/notify");
const { paginate, pageInfo } = require("@school-erp/shared/src/utils/pagination");

// Mass-assignment guard: only these fields may be set from the request body.
// status / staffId / approvedBy are always server-controlled.
const LEAVE_FIELDS = ["leaveType", "fromDate", "toDate", "reason", "remarks"];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const applyLeave = async (req, res) => {
  try {
    const staffId = ["class_teacher", "teacher", "staff"].includes(req.user.role) ? req.user.refId : req.body.staffId;
    const leave = await Leave.create({ ...pick(req.body, LEAVE_FIELDS), staffId, schoolId: req.tenantId });
    res.status(201).json({ success: true, data: leave });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getLeaves = async (req, res) => {
  try {
    const filter = { schoolId: req.tenantId };
    if (["class_teacher", "teacher", "staff"].includes(req.user.role)) {
      filter.staffId = req.user.refId;
    }
    if (req.query.status) filter.status = req.query.status;
    const { page, limit, skip } = paginate(req.query);
    const [leaves, total] = await Promise.all([
      Leave.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Leave.countDocuments(filter),
    ]);
    res.json({ success: true, count: leaves.length, total, ...pageInfo(total, page, limit), data: leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateLeaveStatus = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be Approved or Rejected" });
    }
    const leave = await Leave.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId },
      { status, remarks, approvedBy: req.user.name },
      { new: true },
    );
    if (!leave) return res.status(404).json({ success: false, message: "Leave not found" });

    if (["Approved", "Rejected"].includes(status)) {
      const staff = await Staff.findById(leave.staffId).select("userId employeeId name").lean();
      if (staff?.userId) {
        pushNotifications({
          token: req.token,
          schoolId: req.tenantId,
          userIds: [staff.userId],
          title: `Leave ${status}`,
          message: `Your ${leave.leaveType || "leave"} request (${staff.employeeId || "—"}) was ${status.toLowerCase()}.`,
          kind: "leave",
          link: "/staff/leave",
        });
      }
    }
    return res.json({ success: true, data: leave });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { applyLeave, getLeaves, updateLeaveStatus };
