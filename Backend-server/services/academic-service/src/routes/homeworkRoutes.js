const express = require("express");
const router = express.Router();
const { validateObjectIdParam } = require("@school-erp/shared/src/middleware/objectId");
router.param("id", validateObjectIdParam);
router.param("homeworkId", validateObjectIdParam);
const ctrl = require("../controllers/homeworkController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeStudentSchedule, scopeClassTeacher, guardClassBody } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/", requirePermission("homework:write"), scopeClassTeacher, guardClassBody(), ctrl.createHomework);
// Self-service "My Work". Ownership-scoped instead of permission-scoped: a
// non-teaching staff member holds no homework:read (it gates the school-wide
// list), yet must still see and progress what was assigned to them. Listed
// before the collection route purely so the literal path reads first.
router.get("/mine", ctrl.getMyHomework);
router.get("/", requirePermission("homework:read"), scopeStudentSchedule({ section: true }), scopeClassTeacher, ctrl.getHomework);
router.patch("/:id/status", ctrl.updateMyWorkStatus);
router.put("/:id", requirePermission("homework:write"), scopeClassTeacher, guardClassBody(), ctrl.updateHomework);
router.delete("/:id", requirePermission("homework:write"), scopeClassTeacher, ctrl.deleteHomework);

module.exports = router;
