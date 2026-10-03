const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/syllabusController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeClassTeacher, scopeClassTeacherAggregate, guardClassBody } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

// A syllabus row is class+subject level — the model carries no section — so a
// read legitimately covers a whole class. Teachers stay pinned to their own
// assigned class; only the class the route resolved is readable.
router.get("/", requirePermission("homework:read"), scopeClassTeacherAggregate, ctrl.getSyllabus);
router.post("/", requirePermission("homework:write"), scopeClassTeacher, guardClassBody(), ctrl.createSyllabus);
router.patch("/:id", requirePermission("homework:write"), scopeClassTeacher, guardClassBody(), ctrl.updateSyllabus);
router.delete("/:id", requirePermission("homework:write"), scopeClassTeacher, ctrl.deleteSyllabus);

module.exports = router;
