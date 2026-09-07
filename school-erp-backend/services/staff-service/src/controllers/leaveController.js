const Leave = require("../models/Leave");

const applyLeave = async (req, res) => {
  try {
    const staffId = ["class_teacher", "staff"].includes(req.user.role) ? req.user.refId : req.body.staffId;
    const leave = await Leave.create({ ...req.body, staffId, schoolId: req.tenantId });
    res.status(201).json({ success: true, data: leave });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getLeaves = async (req, res) => {
  try {
    const filter = { schoolId: req.tenantId };
    if (["class_teacher", "staff"].includes(req.user.role)) {
      filter.staffId = req.user.refId;
    }
    if (req.query.status) filter.status = req.query.status;
    const leaves = await Leave.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: leaves.length, data: leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateLeaveStatus = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const leave = await Leave.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId },
      { status, remarks, approvedBy: req.user.name },
      { new: true },
    );
    if (!leave) return res.status(404).json({ success: false, message: "Leave not found" });
    res.json({ success: true, data: leave });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { applyLeave, getLeaves, updateLeaveStatus };
