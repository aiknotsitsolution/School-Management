const express = require("express");
const router = express.Router();
const {
  verifyToken,
  resolveTenant,
  requireTenant,
  requirePermission,
  requireAnyPermission,
} = require("../middleware/auth");
const { validateObjectIdParam } = require("@school-erp/shared/src/middleware/objectId");
const ctrl = require("../controllers/examMasterController");

// /api/exam-masters/:kind/...  (kind: exam-types | classes | sections | subjects | time-slots | rooms)
router.use(verifyToken, resolveTenant, requireTenant);

// READ also accepts library:manage and fees:structure. Class / section /
// subject names are the org metadata every staff form needs to file a record,
// and the study-material form is filed by the librarian, whose bundle has no
// exams:read — without this the Add Material modal renders empty class/subject
// dropdowns (the frontend fails open to a hardcoded fallback of []). The fee
// structure / invoice generators need the same class list and are filed by the
// accountant (fees:structure, no exams:read). Writes stay exams:write.
const readMaster = requireAnyPermission("exams:read", "library:manage", "fees:structure");
router.get("/:kind", readMaster, ctrl.list);
router.get("/:kind/:id", readMaster, ctrl.getById);
router.post("/validate-refs", requirePermission("exams:read"), ctrl.validateRefs);
router.post("/:kind", requirePermission("exams:write"), ctrl.create);
router.patch("/:kind/:id/deactivate", requirePermission("exams:write"), ctrl.deactivate);
router.patch("/:kind/:id/restore", requirePermission("exams:write"), ctrl.restore);
router.patch("/:kind/:id", requirePermission("exams:write"), ctrl.update);

module.exports = router;