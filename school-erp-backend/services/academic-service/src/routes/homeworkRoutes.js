const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/homeworkController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeStudentSchedule, scopeClassTeacher, guardClassBody } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/", requirePermission("homework:write"), scopeClassTeacher, guardClassBody(), ctrl.createHomework);
router.get("/", requirePermission("homework:read"), scopeStudentSchedule({ section: true }), scopeClassTeacher, ctrl.getHomework);
router.put("/:id", requirePermission("homework:write"), scopeClassTeacher, ctrl.updateHomework);
router.delete("/:id", requirePermission("homework:write"), scopeClassTeacher, ctrl.deleteHomework);

module.exports = router;
