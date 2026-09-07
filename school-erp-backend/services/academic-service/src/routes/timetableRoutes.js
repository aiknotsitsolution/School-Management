const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/timetableController");
const { verifyToken, resolveTenant, requireTenant, requirePermission } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/", requirePermission("timetable:write"), ctrl.upsertTimetable);
router.get("/", requirePermission("timetable:read"), ctrl.getTimetable);
router.delete("/:id", requirePermission("timetable:write"), ctrl.deleteTimetable);

module.exports = router;
