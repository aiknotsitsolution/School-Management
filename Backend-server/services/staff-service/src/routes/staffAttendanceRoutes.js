const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/staffAttendanceController");
const {
  verifyToken,
  resolveTenant,
  requireTenant,
  requirePermission,
  authorizeRoles,
} = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant, authorizeRoles("school_admin", "teacher", "staff"));

router.post("/", requirePermission("attendance:mark"), ctrl.markAttendance);
router.get("/", ctrl.getAttendance);

module.exports = router;