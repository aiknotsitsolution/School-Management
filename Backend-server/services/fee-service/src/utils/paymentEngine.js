// Shared payment engine core (fee-service). Single place that RESOLVES a
// school gateways, builds provider orders and COMPLETES orders, run by all
// confirmation paths (signed webhook, client payment signature, and later the
// staff manual queue) with the same idempotent side effects.
const FeeInvoice = require("../models/FeeInvoice");
const Payment = require("../models/Payment");
const PaymentOrder = require("../models/PaymentOrder");
const { paymentGateways } = require("@school-erp/shared");
const gatewayClient = require("./gatewayClient");

const AUTH_URL = process.env.AUTH_SERVICE_URL || "http://localhost:5001";
const INTERNAL_KEY = process.env.INTERNAL_NOTIFY_KEY;

const USABLE_STATUSES = ["active", "pending_verification"];
const ONLINE_MODES = ["platform", "razorpay", "stripe", "phonepe"];
const MANUAL_MODES = ["upi", "qr", "bank", "manual"];

// The school's effective gateway; falls back to the platform mode when a
// config is missing or disabled (a school is never gateway-less).
const resolveGateway = async (schoolId) => {
  const cfg = await gatewayClient.getGatewayConfig(schoolId);
  if (cfg && USABLE_STATUSES.includes(cfg.status)) return cfg;
  return { schoolId, mode: "platform", status: "active", providers: {}, display: {} };
};

const driverFor = (mode) => {
  const { driver } = paymentGateways.driverFor({ mode: MANUAL_MODES.includes(mode) ? "manual" : mode });
  return driver;
};

// Driver config per mode: platform reads environment credentials, the school
// online modes read the decrypted provider block from auth.
const driverConfig = (gateway, mode) =>
  mode === "platform" ? {} : gateway.providers?.[mode] || {};

// Try to create a real provider order (online modes). Never throws — failures
// leave the order pending/unconfigured so the honest 503 surfaces at checkout.
const tryCreateProviderOrder = async (order, gateway) => {
  if (!ONLINE_MODES.includes(gateway.mode)) return;
  try {
    const created = await driverFor(gateway.mode).createOrder(driverConfig(gateway, gateway.mode), {
      amount: order.amount,
      currency: order.currency || "INR",
      receipt: order.externalRef,
    });
    if (created.ok) {
      order.providerOrderId = created.providerOrderId;
      order.provider = gateway.mode;
    } else {
      order.provider = "unconfigured";
    }
  } catch {
    order.provider = "unconfigured";
  }
};

// Client-safe checkout descriptor for an order (never secrets).
const buildCheckout = (order, gateway) => {
  const driver = driverFor(order.gatewayMode);
  const base = driver.getCheckoutConfig(driverConfig(gateway, order.gatewayMode)) || {};
  return {
    mode: order.gatewayMode,
    provider: order.provider,
    amount: order.amount,
    currency: order.currency,
    providerOrderId: order.providerOrderId || null,
    checkoutUrl: base.checkoutUrl || base.payUrl || base.checkoutBase || null,
    keyId: base.keyId || null,
    publishableKey: base.publishableKey || null,
    merchantId: base.merchantId || null,
    baseUrl: base.baseUrl || null,
    enabled: Boolean(base.enabled !== undefined ? base.enabled : order.providerOrderId),
    display: base.display || null,
  };
};

// Idempotent completion. One caller wins the findOneAndUpdate; everything else
// sees { already: true }. Side effects run exactly once for the winner.
const completeOrder = async (order, { confirmedBy } = {}) => {
  const winner = await PaymentOrder.findOneAndUpdate(
    { _id: order._id, status: { $in: ["pending", "awaiting_confirmation", "awaiting_manual_confirm"] } },
    {
      $set: {
        status: "completed",
        confirmedAt: new Date(),
        confirmedBy: confirmedBy || "gateway",
      },
    },
    { new: true }
  );
  if (!winner) return { already: true };

  if (order.purpose === "subscription_upgrade") {
    await notifyAuthSubscriptionPaid(order);
  } else {
    await reconcileFeePayment(order);
  }
  return { already: false };
};

// Fee invoice reconciliation (mirrors the legacy confirmOrder accounting).
const reconcileFeePayment = async (order) => {
  const invoice = await FeeInvoice.findOne({ _id: order.invoiceId, schoolId: order.schoolId });
  if (!invoice) {
    console.error(`[fee-engine] invoice ${order.invoiceId} missing for completed order ${order._id}`);
    return;
  }
  const receiptNo = `RCPT-${Date.now()}-${order.externalRef}`;
  await Payment.create({
    schoolId: order.schoolId,
    invoiceId: invoice._id,
    studentId: order.studentId,
    amount: order.amount,
    mode: `Online Gateway (${order.gatewayMode})`,
    transactionId: order.providerOrderId || order.externalRef,
    receiptNo,
    collectedBy: order.confirmedBy || `gateway:${order.gatewayMode}`,
  });
  invoice.paidAmount += Number(order.amount);
  invoice.receiptNo = receiptNo;
  invoice.status = invoice.paidAmount >= invoice.amount ? "Paid" : "Partial";
  await invoice.save();
};

// Subscription upgrades are applied by auth-service (single billing source).
// Non-fatal: if this fails the order stays completed and the confirm/webhook
// retries are idempotent.
const notifyAuthSubscriptionPaid = async (order) => {
  if (!INTERNAL_KEY) {
    console.error("[fee-engine] INTERNAL_NOTIFY_KEY missing — cannot apply subscription switch");
    return;
  }
  try {
    await fetch(`${AUTH_URL}/api/auth/internal/subscription-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL_KEY },
      body: JSON.stringify({
        schoolId: order.schoolId,
        planId: order.metadata?.planId,
        amount: order.amount,
        currency: order.currency,
        orderId: String(order._id),
        providerOrderId: order.providerOrderId || null,
        durationPeriods: order.metadata?.durationPeriods || 1,
        switchMode: order.metadata?.switchMode || "immediate",
        startDate: order.metadata?.startDate || null,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    console.error("[fee-engine] subscription-paid callback failed:", err.message);
  }
};

module.exports = {
  resolveGateway,
  driverFor,
  driverConfig,
  tryCreateProviderOrder,
  buildCheckout,
  completeOrder,
  ONLINE_MODES,
  MANUAL_MODES,
};