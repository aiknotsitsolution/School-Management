const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/staffAttendanceController");
const {
  verifyToken,
  resolveTenant,
  requireTenant,
  authorizeRoles,
} = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant, authorizeRoles("school_admin", "class_teacher", "staff"));

router.post("/", ctrl.markAttendance);
router.get("/", ctrl.getAttendance);

module.exports = router;