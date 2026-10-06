const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/syllabusController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeStudentSchedule, scopeClassTeacher, scopeClassTeacherAggregate, guardClassBody } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

// A syllabus row is class+subject level — the model carries no section — so a
// read legitimately covers a whole class. Students are pinned to their own
// class, teachers to their assigned class; only the class the route resolved
// is readable.
router.get("/", requirePermission("homework:read"), scopeStudentSchedule(), scopeClassTeacherAggregate, ctrl.getSyllabus);
router.post("/bulk", requirePermission("homework:write"), scopeClassTeacher, guardClassBody("sections"), ctrl.createBulkSyllabus);
router.post("/", requirePermission("homework:write"), scopeClassTeacher, guardClassBody(), ctrl.createSyllabus);
router.patch("/:id", requirePermission("homework:write"), scopeClassTeacher, guardClassBody(), ctrl.updateSyllabus);
router.delete("/:id", requirePermission("homework:write"), scopeClassTeacher, ctrl.deleteSyllabus);

module.exports = router;
