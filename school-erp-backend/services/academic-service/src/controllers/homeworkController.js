const Homework = require("../models/Homework");

const createHomework = async (req, res) => {
  try {
    const homework = await Homework.create({ ...req.body, schoolId: req.tenantId, assignedBy: req.user.name });
    res.status(201).json({ success: true, data: homework });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getHomework = async (req, res) => {
  try {
    const { class: cls, section, subject } = req.query;
    const filter = { schoolId: req.tenantId };
    if (cls) filter.class = cls;
    if (section) filter.section = section;
    if (subject) filter.subject = subject;
    const data = await Homework.find(filter).sort({ dueDate: 1 });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateHomework = async (req, res) => {
  try {
    const hw = await Homework.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId, ...(req.teacherScope || {}) },
      req.body,
      { new: true },
    );
    if (!hw) return res.status(404).json({ success: false, message: "Homework not found" });
    res.json({ success: true, data: hw });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteHomework = async (req, res) => {
  try {
    const hw = await Homework.findOneAndDelete({ _id: req.params.id, schoolId: req.tenantId, ...(req.teacherScope || {}) });
    if (!hw) return res.status(404).json({ success: false, message: "Homework not found" });
    res.json({ success: true, message: "Homework deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createHomework, getHomework, updateHomework, deleteHomework };
