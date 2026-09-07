const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/paymentController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeStudentQuery } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/", requirePermission("fees:collect"), ctrl.recordPayment);
router.get("/", requirePermission("fees:read"), scopeStudentQuery, ctrl.getPayments);

module.exports = router;
