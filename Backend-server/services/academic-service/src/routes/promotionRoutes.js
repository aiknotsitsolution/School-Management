const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/promotionController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeClassTeacherAggregate } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

// /preview aggregates the whole class roster, so a section-less ?class= is
// allowed for teachers. /history is addressed by studentId only — academic
// records carry no class/section — so the controller narrows it to the
// teacher's own roster instead of relying on a class/section address.
router.get("/preview", requirePermission("promotion:read"), scopeClassTeacherAggregate, ctrl.preview);
router.get("/history", requirePermission("promotion:read"), ctrl.history);
router.post("/", requirePermission("promotion:write"), ctrl.commit);

module.exports = router;