const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/syllabusController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeStudentSchedule, scopeClassTeacher, scopeClassTeacherAggregate, guardClassBody } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

// A syllabus row is class+section+subject level. A student read is pinned to
// their own section, a teacher read to their assigned class; only what the
// route resolved is readable. scopeStudentSchedule({ section: true }) writes
// the student's section NAME into req.query.section, which getSyllabus
// resolves to that section's id (rows are keyed by sectionId, not name).
router.get("/", requirePermission("homework:read"), scopeStudentSchedule({ section: true }), scopeClassTeacherAggregate, ctrl.getSyllabus);
router.post("/bulk", requirePermission("homework:write"), scopeClassTeacher, guardClassBody("sections"), ctrl.createBulkSyllabus);
router.post("/", requirePermission("homework:write"), scopeClassTeacher, guardClassBody(), ctrl.createSyllabus);
router.patch("/:id", requirePermission("homework:write"), scopeClassTeacher, guardClassBody(), ctrl.updateSyllabus);
router.delete("/:id", requirePermission("homework:write"), scopeClassTeacher, ctrl.deleteSyllabus);

module.exports = router;
