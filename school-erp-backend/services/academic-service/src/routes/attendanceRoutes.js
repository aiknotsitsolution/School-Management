const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/attendanceController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeStudentQuery } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/mark", requirePermission("attendance:mark"), ctrl.markAttendance);
router.get("/", requirePermission("attendance:read"), scopeStudentQuery, ctrl.getAttendance);

module.exports = router;
