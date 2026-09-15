const express = require("express");
const router = express.Router();
const { validateObjectIdParam } = require("@school-erp/shared/src/middleware/objectId");
router.param("id", validateObjectIdParam);
router.param("homeworkId", validateObjectIdParam);
const ctrl = require("../controllers/examController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeStudentSchedule, scopeClassTeacher } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/", requirePermission("exams:write"), ctrl.createExam);
router.get("/", requirePermission("exams:read"), scopeStudentSchedule(), scopeClassTeacher, ctrl.getExams);
router.put("/:id", requirePermission("exams:write"), ctrl.updateExam);
router.delete("/:id", requirePermission("exams:write"), ctrl.deleteExam);
router.patch("/:id/status", requirePermission("exams:write"), ctrl.updateExamStatus);

module.exports = router;