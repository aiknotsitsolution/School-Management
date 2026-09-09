const express = require("express");
const router = express.Router();
const { validateObjectIdParam } = require("../middleware/objectId");
router.param("id", validateObjectIdParam);
router.param("homeworkId", validateObjectIdParam);
const ctrl = require("../controllers/timetableController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeStudentSchedule, scopeClassTeacher } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/", requirePermission("timetable:write"), ctrl.upsertTimetable);
router.get("/", requirePermission("timetable:read"), scopeStudentSchedule({ section: true }), scopeClassTeacher, ctrl.getTimetable);
router.delete("/:id", requirePermission("timetable:write"), ctrl.deleteTimetable);

module.exports = router;
