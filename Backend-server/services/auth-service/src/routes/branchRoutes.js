const express = require("express");
const router = express.Router();
const { validateObjectIdParam } = require("@school-erp/shared/src/middleware/objectId");
router.param("id", validateObjectIdParam);

const ctrl = require("../controllers/branchController");
const { verifyToken, resolveTenant, requirePermission } = require("../middleware/auth");
const { requireSchoolActive } = require("@school-erp/shared/src/middleware/requireSchoolActive");

// Branches are tenant-scoped. Regular users inherit the tenant from the token;
// platform (super_admin) must select a school via X-School-Id.
const requireTenant = async (req, res, next) => {
  if (!req.tenantId) {
    return res.status(400).json({ success: false, message: "No school context (X-School-Id required)" });
  }
  return requireSchoolActive(req, res, next);
};

// /api/branches
router.use(verifyToken, resolveTenant, requireTenant);

// Static paths first: `/:id` would otherwise swallow these and 400 on the
// ObjectId check.
router.get("/mine", ctrl.listMyBranches);
router.get("/quota", requirePermission("branches:read"), ctrl.getBranchQuota);

router.get("/", requirePermission("branches:read"), ctrl.listBranches);
router.get("/:id", requirePermission("branches:read"), ctrl.getBranch);
router.post("/", requirePermission("branches:write"), ctrl.createBranch);
router.patch("/:id", requirePermission("branches:write"), ctrl.updateBranch);
router.post("/:id/head-office", requirePermission("branches:write"), ctrl.setHeadOffice);
router.delete("/:id", requirePermission("branches:write"), ctrl.deleteBranch);

module.exports = router;
