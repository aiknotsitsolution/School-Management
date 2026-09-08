const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/paymentOrderController");
const { verifyToken, resolveTenant, requireTenant, requirePermission } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

// List payment orders (staff: all/any student; student: own only via controller filter)
router.get("/", requirePermission("fees:read"), ctrl.getOrders);

// Create an order against an unpaid invoice (accounts or student, own invoice).
router.post("/", requirePermission("fees:read"), ctrl.createOrder);

// Attempt provider checkout. Returns 503 when provider not configured.
router.post("/:id/initiate", requirePermission("fees:read"), ctrl.initiateOrder);

// Master cancel (restore order to cancelled so it can be recreated).
router.patch("/:id/cancel", requirePermission("fees:read"), ctrl.cancelOrder);

// Provider webhook confirmation. NOT exposed via the public gateway proxy:
// guarded by provider signing secret and only honored when provider is enabled.
router.post("/:id/confirm", ctrl.confirmOrder);

module.exports = router;