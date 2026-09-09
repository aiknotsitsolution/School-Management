const Homework = require("../models/Homework");
const { paginate, pageInfo } = require("../utils/pagination");

// Mass-assignment guard: only these fields may be set from the request body
// (schoolId / assignedBy / timestamps stay server-owned).
const HOMEWORK_FIELDS = [
  "class", "section", "subject", "title", "description", "dueDate", "maxMarks", "attachments",
];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const createHomework = async (req, res) => {
  try {
    const homework = await Homework.create({ ...pick(req.body, HOMEWORK_FIELDS), schoolId: req.tenantId, assignedBy: req.user.name });
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
    const { page, limit, skip } = paginate(req.query);
    const [data, total] = await Promise.all([
      Homework.find(filter).sort({ dueDate: 1 }).skip(skip).limit(limit),
      Homework.countDocuments(filter),
    ]);
    res.json({ success: true, count: data.length, total, ...pageInfo(total, page, limit), data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateHomework = async (req, res) => {
  try {
    const hw = await Homework.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId, ...(req.teacherScope || {}) },
      pick(req.body, HOMEWORK_FIELDS),
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
