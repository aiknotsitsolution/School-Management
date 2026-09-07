const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/examController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeStudentQuery } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/", requirePermission("marks:write"), ctrl.enterMarks);
router.get("/report-card", requirePermission("marks:read"), scopeStudentQuery, ctrl.getReportCard);

module.exports = router;
