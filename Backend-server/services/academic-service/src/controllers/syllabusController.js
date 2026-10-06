const {
  scopeQuery,
  branchIdForWrite,
  withBranchScope,
} = require("@school-erp/shared/src/middleware/branchScope");
const Syllabus = require("../models/Syllabus");
const SchoolClass = require("../models/SchoolClass");
const SchoolSection = require("../models/SchoolSection");
const SchoolSubject = require("../models/SchoolSubject");
const mongoose = require("mongoose");

const resolveSyllabusSection = async (req, { cls, subject, sectionId }) => {
  if (!cls || !subject || !sectionId || !mongoose.Types.ObjectId.isValid(sectionId)) {
    throw new Error("Class, section and subject are required");
  }
  const schoolClass = await SchoolClass.findOne(
    withBranchScope(req, {
      schoolId: req.tenantId,
      active: true,
      name: String(cls).trim(),
    }),
  ).lean();
  if (!schoolClass) throw new Error("Selected class is inactive or does not belong to this school");
  const section = await SchoolSection.findOne(
    withBranchScope(req, {
      _id: sectionId,
      schoolId: req.tenantId,
      active: true,
    }),
  ).lean();
  if (!section) throw new Error("Selected section is inactive or does not belong to this school");
  const belongsToClass = section.classId
    ? String(section.classId) === String(schoolClass._id)
    : section.className === schoolClass.name;
  if (!belongsToClass) {
    throw new Error("Selected section does not belong to the selected class");
  }
  const subjectMaster = await SchoolSubject.findOne(
    withBranchScope(req, {
      schoolId: req.tenantId,
      sectionId: section._id,
      status: "active",
      name: String(subject).trim(),
    }),
  ).lean();
  if (!subjectMaster) throw new Error("Selected subject does not belong to the selected section");
  return section;
};

const getSyllabus = async (req, res) => {
  try {
    const filter = scopeQuery(Syllabus, req, { schoolId: req.tenantId })
    // The route already resolved (and validated) the teacher's class; pin to it
    // so omitting ?class= can never widen the read to the whole school.
    if (req.teacherScope) filter.class = req.teacherScope.class;
    else if (req.query.class) filter.class = req.query.class;
    if (req.query.sectionId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.sectionId)) {
        return res.status(400).json({ success: false, message: "A valid section is required" });
      }
      const section = await SchoolSection.findOne(
        withBranchScope(req, {
          _id: req.query.sectionId,
          schoolId: req.tenantId,
          active: true,
        }),
      ).lean();
      if (!section) {
        return res.status(400).json({ success: false, message: "Selected section is inactive or does not belong to this school" });
      }
      const schoolClass = section.classId
        ? await SchoolClass.findOne(
            withBranchScope(req, {
              _id: section.classId,
              schoolId: req.tenantId,
              active: true,
            }),
          ).lean()
        : null;
      const sectionClassName = schoolClass?.name || section.className;
      if (filter.class && sectionClassName !== filter.class) {
        return res.status(400).json({
          success: false,
          message: "Selected section does not belong to the selected class",
        });
      }
      filter.class = sectionClassName;
      filter.sectionId = section._id;
    }
    if (req.query.subject) filter.subject = req.query.subject;
    if (req.query.term) filter.term = req.query.term;
    const data = await Syllabus.find(filter).sort({ class: 1, subject: 1 });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createSyllabus = async (req, res) => {
  try {
    const { class: cls, subject, term, topics, totalHours } = req.body;
    const section = await resolveSyllabusSection(req, {
      cls,
      subject,
      sectionId: req.body.sectionId,
    });
    const syllabus = await Syllabus.create({
      class: cls,
      sectionId: section._id,
      sectionName: section.name,
      subject,
      term,
      topics,
      totalHours,
      schoolId: req.tenantId,
      branchId: branchIdForWrite(req),
    });
    res.status(201).json({ success: true, data: syllabus });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const createBulkSyllabus = async (req, res) => {
  try {
    const { class: cls, sections, term, topics, totalHours } = req.body;
    if (!cls || !Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Class and at least one section with subjects are required",
      });
    }
    const documents = [];
    const seen = new Set();
    for (const row of sections) {
      if (!row || !Array.isArray(row.subjects) || row.subjects.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Every selected section must have at least one subject",
        });
      }
      for (const subject of row.subjects) {
        const section = await resolveSyllabusSection(req, {
          cls,
          subject,
          sectionId: row.sectionId,
        });
        const key = `${section._id}:${String(subject).trim().toLowerCase()}`;
        if (seen.has(key)) {
          return res.status(400).json({
            success: false,
            message: `Subject "${subject}" was selected more than once for section "${section.name}"`,
          });
        }
        seen.add(key);
        documents.push({
          class: String(cls).trim(),
          sectionId: section._id,
          sectionName: section.name,
          subject: String(subject).trim(),
          term,
          topics,
          totalHours,
          schoolId: req.tenantId,
          branchId: branchIdForWrite(req),
        });
      }
    }
    const created = await Syllabus.insertMany(documents);
    res.status(201).json({ success: true, count: created.length, data: created });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
};

// Mass-assignment guard: only these fields may be set from the request body.
// schoolId (tenant) and _id are deliberately excluded so a client can never
// move a syllabus to another school.
const SYLLABUS_FIELDS = ["class", "sectionId", "subject", "term", "topics", "totalHours"];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const updateSyllabus = async (req, res) => {
  try {
    // guardClassBody validates the class being written TO; the stored row still
    // has to be one the teacher owns, or they could retarget someone else's
    // syllabus by naming their own class in the body.
    const existing = await Syllabus.findOne(scopeQuery(Syllabus, req, { _id: req.params.id, schoolId: req.tenantId })).lean();
    if (!existing) return res.status(404).json({ success: false, message: "Not found" });
    if (req.teacherScope) {
      if (!req.teacherScope.has(existing.class)) {
        return res.status(403).json({
          success: false,
          message: "Teachers can only manage their assigned classes and sections",
        });
      }
    }
    const updates = pick(req.body, SYLLABUS_FIELDS);
    if (["class", "sectionId", "subject"].some((field) => req.body[field] !== undefined)) {
      const section = await resolveSyllabusSection(req, {
        cls: req.body.class ?? existing.class,
        subject: req.body.subject ?? existing.subject,
        sectionId: req.body.sectionId ?? existing.sectionId,
      });
      updates.sectionId = section._id;
      updates.sectionName = section.name;
    }
    const syllabus = await Syllabus.findOneAndUpdate(scopeQuery(Syllabus, req, 
      { _id: req.params.id, schoolId: req.tenantId }),
      updates,
      { new: true }
    );
    if (!syllabus) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: syllabus });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteSyllabus = async (req, res) => {
  try {
    // Teachers may only delete a syllabus for a class they are assigned to. The
    // row has no section, so the check is class-level (guardClassBody cannot
    // see the stored row, only the request body).
    if (req.teacherScope) {
      const existing = await Syllabus.findOne(scopeQuery(Syllabus, req, { _id: req.params.id, schoolId: req.tenantId })).lean();
      if (!existing) return res.status(404).json({ success: false, message: "Not found" });
      if (!req.teacherScope.has(existing.class)) {
        return res.status(403).json({
          success: false,
          message: "Teachers can only manage their assigned classes and sections",
        });
      }
    }
    const syllabus = await Syllabus.findOneAndDelete(scopeQuery(Syllabus, req, { _id: req.params.id, schoolId: req.tenantId }));
    if (!syllabus) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getSyllabus,
  createSyllabus,
  createBulkSyllabus,
  updateSyllabus,
  deleteSyllabus,
};
