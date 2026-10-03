const {
  scopeQuery,
  branchIdForWrite,
} = require("@school-erp/shared/src/middleware/branchScope");
const StudyMaterial = require("../models/StudyMaterial");

const getMaterials = async (req, res) => {
  try {
    const filter = scopeQuery(StudyMaterial, req, { schoolId: req.tenantId })
    // The route already resolved (and validated) the teacher's class; pin to it
    // so omitting ?class= can never widen the read to the whole school.
    if (req.teacherScope) {
      filter.class = req.teacherScope.class;
      // A material is optionally section-specific, so a class-wide one has no
      // section. Without a section filter the listing covers the sections this
      // teacher is assigned to plus every class-wide material — never another
      // teacher's section. ($in matches both null and a missing field.)
      filter.section = req.query.section
        ? req.query.section
        : { $in: [...(req.teacherScope.sections || []), null] };
    } else {
      if (req.query.class) filter.class = req.query.class;
      if (req.query.section) filter.section = req.query.section;
    }
    if (req.query.subject) filter.subject = req.query.subject;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: "i" } },
        { subject: { $regex: req.query.search, $options: "i" } },
      ];
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      StudyMaterial.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      StudyMaterial.countDocuments(filter),
    ]);
    res.json({ success: true, count: data.length, total, page, pages: Math.ceil(total / limit), data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createMaterial = async (req, res) => {
  try {
    const { title, description, subject, class: cls, section, type, fileUrl, linkUrl, fileName, fileSize } = req.body;
    if (!title || !subject || !cls) {
      return res.status(400).json({ success: false, message: "title, subject, and class are required" });
    }
    const material = await StudyMaterial.create({
      title, description, subject, class: cls, section, type, fileUrl, linkUrl, fileName, fileSize,
      uploadedBy: req.user.refId,
      uploadedByName: req.user.name || "",
      schoolId: req.tenantId,

      branchId: branchIdForWrite(req),    });
    res.status(201).json({ success: true, data: material });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteMaterial = async (req, res) => {
  try {
    // guardClassBody never sees a stored row, so re-check the target here: a
    // teacher may only delete material for a class/section they are assigned to.
    if (req.teacherScope) {
      const existing = await StudyMaterial.findOne(scopeQuery(StudyMaterial, req, { _id: req.params.id, schoolId: req.tenantId })).lean();
      if (!existing) return res.status(404).json({ success: false, message: "Not found" });
      if (!req.teacherScope.has(existing.class, existing.section)) {
        return res.status(403).json({
          success: false,
          message: "Teachers can only manage their assigned classes and sections",
        });
      }
    }
    const material = await StudyMaterial.findOneAndDelete(scopeQuery(StudyMaterial, req, { _id: req.params.id, schoolId: req.tenantId }));
    if (!material) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getMaterials, createMaterial, deleteMaterial };
