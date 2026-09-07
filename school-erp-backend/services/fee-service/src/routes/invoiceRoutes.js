const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/invoiceController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeStudentQuery } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/", requirePermission("fees:collect"), ctrl.createInvoice);
router.get("/", requirePermission("fees:read"), scopeStudentQuery, ctrl.getInvoices);

module.exports = router;
