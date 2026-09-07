const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/examController");
const { verifyToken, resolveTenant, requireTenant, requirePermission } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/", requirePermission("exams:write"), ctrl.createExam);
router.get("/", requirePermission("exams:read"), ctrl.getExams);
router.put("/:id", requirePermission("exams:write"), ctrl.updateExam);
router.delete("/:id", requirePermission("exams:write"), ctrl.deleteExam);

module.exports = router;
