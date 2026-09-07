const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/payrollController");
const { verifyToken, resolveTenant, requireTenant, requirePermission } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/", requirePermission("payroll:admin"), ctrl.generatePayroll);
router.get("/", requirePermission("payroll:view"), ctrl.getPayroll);
router.patch("/:id/pay", requirePermission("payroll:admin"), ctrl.markPaid);

module.exports = router;
