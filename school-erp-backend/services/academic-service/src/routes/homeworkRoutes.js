const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/homeworkController");
const { verifyToken, resolveTenant, requireTenant, requirePermission } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/", requirePermission("homework:write"), ctrl.createHomework);
router.get("/", requirePermission("homework:read"), ctrl.getHomework);
router.put("/:id", requirePermission("homework:write"), ctrl.updateHomework);
router.delete("/:id", requirePermission("homework:write"), ctrl.deleteHomework);

module.exports = router;
