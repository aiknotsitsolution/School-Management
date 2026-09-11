const express = require("express");
const router = express.Router();
const { internalGuard, getPaymentGateway, subscriptionPaid } = require("../controllers/internalController");

router.use(internalGuard);

// Payment engine fetches the decryptable school gateway config.
router.get("/payment-gateway", getPaymentGateway);

// Payment engine notifies that a subscription_upgrade order has been paid.
router.post("/subscription-paid", subscriptionPaid);

module.exports = router;