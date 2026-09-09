const Staff = require("../models/Staff");
const { paginate, pageInfo } = require("../utils/pagination");

// Escapes regex metacharacters in user search terms to prevent regex
// injection / ReDoS-style patterns; length-capped to bound scan cost.
const escapeRegex = (term) =>
  String(term).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Mass-assignment guard: only these fields may be set from the request body
// (userId / schoolId / _id / timestamps stay server-owned).
const STAFF_FIELDS = [
  "employeeId", "name", "designation", "department", "role", "subjects",
  "classesAssigned", "qualification", "joiningDate", "contact", "email",
  "address", "photoUrl", "salary", "status",
];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const createStaff = async (req, res) => {
  try {
    const staff = await Staff.create({ ...pick(req.body, STAFF_FIELDS), schoolId: req.tenantId });
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
    if (search) filter.name = { $regex: escapeRegex(search), $options: "i" };

    const { page, limit, skip } = paginate(req.query);
    const [staff, total] = await Promise.all([
      Staff.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Staff.countDocuments(filter),
    ]);
    res.json({ success: true, count: staff.length, total, ...pageInfo(total, page, limit), data: staff });
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
      pick(req.body, STAFF_FIELDS),
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
