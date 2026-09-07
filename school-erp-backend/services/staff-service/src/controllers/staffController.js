const Staff = require("../models/Staff");

const createStaff = async (req, res) => {
  try {
    const staff = await Staff.create({ ...req.body, schoolId: req.tenantId });
    res.status(201).json({ success: true, data: staff });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getStaff = async (req, res) => {
  try {
    const { department, role, status, search } = req.query;
    const filter = { schoolId: req.tenantId };

    if (["class_teacher", "staff"].includes(req.user.role)) {
      filter._id = req.user.refId;
    }

    if (department) filter.department = department;
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (search) filter.name = { $regex: search, $options: "i" };

    const staff = await Staff.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: staff.length, data: staff });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getStaffById = async (req, res) => {
  try {
    const staff = await Staff.findOne({ _id: req.params.id, schoolId: req.tenantId });
    if (!staff) return res.status(404).json({ success: false, message: "Staff not found" });
    res.json({ success: true, data: staff });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateStaff = async (req, res) => {
  try {
    const staff = await Staff.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId },
      req.body,
      { new: true, runValidators: true },
    );
    if (!staff) return res.status(404).json({ success: false, message: "Staff not found" });
    res.json({ success: true, data: staff });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteStaff = async (req, res) => {
  try {
    const staff = await Staff.findOneAndDelete({ _id: req.params.id, schoolId: req.tenantId });
    if (!staff) return res.status(404).json({ success: false, message: "Staff not found" });
    res.json({ success: true, message: "Staff removed" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createStaff, getStaff, getStaffById, updateStaff, deleteStaff };
