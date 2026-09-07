const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/platformController");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

// Platform-owner only. All billing + subscription operations are global to the
// platform and never fall under a school tenant scope.
router.use(verifyToken, authorizeRoles("super_admin"));

// Plans
router.get("/plans", ctrl.listPlans);
router.get("/plans/:id", ctrl.getPlan);
router.post("/plans", ctrl.createPlan);
router.patch("/plans/:id", ctrl.updatePlan);
router.delete("/plans/:id", ctrl.deletePlan);

// Subscriptions
router.get("/subscriptions", ctrl.listSubscriptions);
router.get("/subscriptions/:id", ctrl.getSubscription);
router.post("/subscriptions", ctrl.createSubscription);
router.patch("/subscriptions/:id", ctrl.updateSubscription);

// Billing / invoices
router.get("/invoices", ctrl.listInvoices);
router.get("/invoices/:id", ctrl.getInvoice);
router.post("/invoices/generate", ctrl.generateInvoice);
router.patch("/invoices/:id", ctrl.updateInvoice);

module.exports = router;