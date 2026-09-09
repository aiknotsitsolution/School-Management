const express = require("express");
const router = express.Router();
const { validateObjectIdParam } = require("../middleware/objectId");
router.param("id", validateObjectIdParam);
router.param("homeworkId", validateObjectIdParam);
const ctrl = require("../controllers/staffController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, restrictToOwnStaff } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/", requirePermission("staff:write"), ctrl.createStaff);
router.get("/", requirePermission("staff:read"), ctrl.getStaff);
router.get("/:id", requirePermission("staff:read"), restrictToOwnStaff((req) => req.params.id), ctrl.getStaffById);
router.put("/:id", requirePermission("staff:write"), ctrl.updateStaff);
router.delete("/:id", requirePermission("staff:write"), ctrl.deleteStaff);

module.exports = router;
