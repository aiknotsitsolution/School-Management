const express = require("express");
const router = express.Router();
const { validateObjectIdParam } = require("@school-erp/shared/src/middleware/objectId");
router.param("id", validateObjectIdParam);
const ctrl = require("../controllers/studentFeePlanController");
const {
  verifyToken,
  resolveTenant,
  requireTenant,
  requirePermission,
} = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

// Summary first: it must never be swallowed by the parameterised /:id below.
router.get("/summary/:studentId", requirePermission("fees:read"), ctrl.getStudentSummary);

router.get("/", requirePermission("fees:read"), ctrl.getPlans);
router.post("/", requirePermission("fees:structure"), ctrl.createPlan);
// Idempotent auto-fill from the class fee structure (onboarding + admin button).
router.post("/ensure", requirePermission("fees:structure"), ctrl.ensurePlan);
router.get("/:id", requirePermission("fees:read"), ctrl.getPlan);
router.put("/:id", requirePermission("fees:structure"), ctrl.updatePlan);

module.exports = router;
