const Homework = require("../models/Homework");
const { paginate, pageInfo } = require("@school-erp/shared/src/utils/pagination");
const {
  findMissingMasterRefs,
  missingMessage,
} = require("../utils/masterRefs");
const { notifyByRefIds, notifyClassStudents } = require("../utils/notify");

async function assertRefs(tenantId, body) {
  const missing = await findMissingMasterRefs({
    schoolId: tenantId,
    class: body.class,
    section: body.section,
    subject: body.subject,
  });
  if (missing.length) {
    const err = new Error(missingMessage(missing));
    err.status = 400;
    throw err;
  }
}

// Mass-assignment guard: only these fields may be set from the request body
// (schoolId / assignedBy / timestamps stay server-owned).
const HOMEWORK_FIELDS = [
  "assignType", "class", "section", "subject", "title", "description",
  "assignedTo", "assignedToRole", "assignedToUserId", "priority", "dueDate", "maxMarks", "attachments",
];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const createHomework = async (req, res) => {
  try {
    const assignType = req.body.assignType || "student";
    if (assignType === "student") {
      await assertRefs(req.tenantId, req.body);
    }
    const homework = await Homework.create({
      ...pick(req.body, HOMEWORK_FIELDS),
      assignType,
      schoolId: req.tenantId,
      assignedBy: req.user.name,
    });
    if (assignType === "student") {
      notifyClassStudents({
        schoolId: req.tenantId,
        class: homework.class,
        section: homework.section,
        title: "New Homework",
        message: `${homework.title} — ${homework.subject || ""} assigned by ${req.user.name}.`,
        kind: "homework",
        link: "/homework",
      });
    } else if (assignType === "staff" && homework.assignedToUserId) {
      notifyByRefIds({
        schoolId: req.tenantId,
        refIds: [homework.assignedToUserId],
        title: "New Work Assigned",
        message: `${homework.title} assigned by ${req.user.name}. Due: ${homework.dueDate ? new Date(homework.dueDate).toLocaleDateString("en-IN") : "No deadline"}.`,
        kind: "homework",
        link: "/homework",
      });
    }
    res.status(201).json({ success: true, data: homework });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
};

const getHomework = async (req, res) => {
  try {
    const { class: cls, section, subject, assignType } = req.query;
    const filter = { schoolId: req.tenantId };
    if (cls) filter.class = cls;
    if (section) filter.section = section;
    if (subject) filter.subject = subject;
    if (assignType) filter.assignType = assignType;
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
    const existing = await Homework.findOne({ _id: req.params.id, schoolId: req.tenantId });
    if (!existing) return res.status(404).json({ success: false, message: "Homework not found" });
    if (req.teacherScope && !req.teacherScope.has(existing.class, existing.section)) {
      return res.status(403).json({ success: false, message: "You can only manage homework in your assigned classes and sections" });
    }

    const updates = pick(req.body, HOMEWORK_FIELDS);
    // Validate only the fields being changed so legacy stored values (left
    // untouched by this edit) are never re-checked against the masters.
    if (existing.assignType === "student") {
      const check = {};
      for (const key of ["class", "section", "subject"]) {
        if (updates[key] !== undefined && existing[key] !== String(updates[key]).trim()) {
          check[key] = updates[key];
        }
      }
      if (Object.keys(check).length) await assertRefs(req.tenantId, check);
    }

    const hw = await Homework.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId },
      updates,
      { new: true },
    );
    if (hw && hw.assignType === "staff" && hw.assignedToUserId) {
      notifyByRefIds({
        schoolId: req.tenantId,
        refIds: [hw.assignedToUserId],
        title: "Work Updated",
        message: `${hw.title} was updated by ${req.user.name}.`,
        kind: "homework",
        link: "/homework",
      });
    }
    res.json({ success: true, data: hw });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
};

const deleteHomework = async (req, res) => {
  try {
    const existing = await Homework.findOne({ _id: req.params.id, schoolId: req.tenantId });
    if (!existing) return res.status(404).json({ success: false, message: "Homework not found" });
    if (req.teacherScope && !req.teacherScope.has(existing.class, existing.section)) {
      return res.status(403).json({ success: false, message: "You can only manage homework in your assigned classes and sections" });
    }
    const hw = await Homework.findOneAndDelete({ _id: existing._id, schoolId: req.tenantId });
    if (!hw) return res.status(404).json({ success: false, message: "Homework not found" });
    res.json({ success: true, message: "Homework deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createHomework, getHomework, updateHomework, deleteHomework };
