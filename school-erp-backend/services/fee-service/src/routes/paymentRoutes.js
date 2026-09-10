const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/paymentController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeStudentQuery } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/", requirePermission("fees:collect"), ctrl.recordPayment);
router.get("/receipt/:receiptNo", requirePermission("fees:read"), ctrl.getReceipt);
router.get("/reports", requirePermission("fees:reports"), ctrl.getFeeReports);
router.get("/", requirePermission("fees:read"), scopeStudentQuery, ctrl.getPayments);

module.exports = router;
