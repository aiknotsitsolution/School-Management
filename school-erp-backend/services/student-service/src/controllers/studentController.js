const Student = require("../models/Student");

const createStudent = async (req, res) => {
  try {
    const student = await Student.create({ ...req.body, schoolId: req.tenantId });
    res.status(201).json({ success: true, data: student });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getStudents = async (req, res) => {
  try {
    const { class: cls, section, status, search, page = 1, limit = 20 } = req.query;
    const filter = { schoolId: req.tenantId };

    if (req.user.role === "student") {
      filter.admissionNo = req.user.refId;
    }

    if (cls) filter.class = cls;
    if (section) filter.section = section;
    if (status) filter.status = status;
    if (search) filter.name = { $regex: search, $options: "i" };

    const students = await Student.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Student.countDocuments(filter);
    res.json({ success: true, count: students.length, total, page: Number(page), data: students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getStudentById = async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.id, schoolId: req.tenantId });
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateStudent = async (req, res) => {
  try {
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId },
      req.body,
      { new: true, runValidators: true },
    );
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findOneAndDelete({ _id: req.params.id, schoolId: req.tenantId });
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });
    res.json({ success: true, message: "Student deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const bulkStats = async (req, res) => {
  try {
    const total = await Student.countDocuments({ schoolId: req.tenantId });
    const byClass = await Student.aggregate([
      { $match: { schoolId: req.tenantId } },
      { $group: { _id: "$class", count: { $sum: 1 } } },
    ]);
    const active = await Student.countDocuments({ schoolId: req.tenantId, status: "Active" });
    res.json({ success: true, data: { total, active, byClass } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createStudent, getStudents, getStudentById, updateStudent, deleteStudent, bulkStats };
