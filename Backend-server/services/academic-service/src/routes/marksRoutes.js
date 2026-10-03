const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/examController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeStudentQuery, scopeClassTeacher, scopeClassTeacherAggregate } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/", requirePermission("marks:write"), ctrl.enterMarks);
router.get("/", requirePermission("marks:read"), scopeStudentQuery, scopeClassTeacher, ctrl.getMarks);
router.get("/class-summary", requirePermission("marks:read"), scopeClassTeacherAggregate, ctrl.getClassSummary);
router.get("/report-card", requirePermission("marks:read"), scopeStudentQuery, scopeClassTeacher, ctrl.getReportCard);
router.get("/report-card/pdf", requirePermission("marks:read"), scopeStudentQuery, scopeClassTeacher, ctrl.getReportCardPdf);

module.exports = router;