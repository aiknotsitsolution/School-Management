const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/inventoryController");
const { verifyToken, resolveTenant, requireTenant, requirePermission } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/", requirePermission("inventory:write"), ctrl.addItem);
router.get("/", requirePermission("inventory:read"), ctrl.getItems);
router.put("/:id", requirePermission("inventory:write"), ctrl.updateItem);
router.delete("/:id", requirePermission("inventory:write"), ctrl.deleteItem);

module.exports = router;
