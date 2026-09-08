const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/homeworkSubmissionController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeClassTeacher } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

// Teacher: list submissions for assigned class/section (?homeworkId= or ?class=&section=)
router.get("/class/list", requirePermission("homework:read"), scopeClassTeacher, ctrl.listSubmissionsForClass);

// Student: view own submissions (optionally scoped to one homework via ?homeworkId=)
router.get("/", requirePermission("homework:read"), ctrl.getMySubmissions);

// Student: submit their homework. Subject to class/section + ownership checks.
router.post("/:homeworkId", requirePermission("homework:read"), ctrl.submitHomework);

// Student: view own submission for a specific homework.
router.get("/:homeworkId", requirePermission("homework:read"), ctrl.getMySubmissions);

// Teacher: review (feedback + marks) a submission in their class/section.
router.patch("/review/:id", requirePermission("homework:write"), scopeClassTeacher, ctrl.reviewSubmission);

module.exports = router;
