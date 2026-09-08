const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/attendanceController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeStudentQuery, scopeClassTeacher, guardClassBody } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/mark", requirePermission("attendance:mark"), scopeClassTeacher, guardClassBody("records"), ctrl.markAttendance);
router.get("/", requirePermission("attendance:read"), scopeStudentQuery, scopeClassTeacher, ctrl.getAttendance);

module.exports = router;
