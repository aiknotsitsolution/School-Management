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

router.get("/me/today", ctrl.getMyToday);
router.get("/today", requirePermission("attendance:read"), ctrl.getTodayAll);
router.get("/monthly", requirePermission("attendance:read"), ctrl.getMonthlySummary);
// Self check-in deliberately sits WITHOUT requirePermission("attendance:mark"):
// that permission is about writing other people's rows, while several persona
// bundles (Accountant, Librarian, Receptionist, Transport) grant no attendance
// powers at all — gating here locked them out of their own check-in popup.
// markAttendance enforces attendance:mark for anyone marking someone else.
router.post("/", ctrl.markAttendance);
router.patch("/:id/correct", requirePermission("attendance:mark"), ctrl.correctAttendance);
router.get("/", ctrl.getAttendance);

module.exports = router;
