const { v4: uuidv4 } = require("uuid");
const FeeInvoice = require("../models/FeeInvoice");
const Payment = require("../models/Payment");
const PaymentOrder = require("../models/PaymentOrder");

// Whether a real payment provider is configured. Provider setup (keys, webhook
// signing secret, callback URL) is deployment work; until then, orders can be
// created and viewed but cannot be confirmed as paid.
const providerEnabled = () =>
  process.env.PAYMENT_PROVIDER_ENABLED === "true" &&
  Boolean(process.env.PAYMENT_PROVIDER_NAME);

// Staff/accounts: create a payment order against an unpaid invoice for a student.
const createOrder = async (req, res) => {
  try {
    const { invoiceId, provider } = req.body || {};
    if (!invoiceId) return res.status(400).json({ success: false, message: "invoiceId is required" });

    const invoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId: req.tenantId });
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    // Students may only create orders against their own invoices.
    if (req.user.role === "student" && String(invoice.studentId) !== String(req.user.refId)) {
      return res.status(403).json({ success: false, message: "Cannot create a payment for another student" });
    }

    const due = Number(invoice.amount) - Number(invoice.paidAmount || 0);
    if (due <= 0) return res.status(400).json({ success: false, message: "Invoice is already fully paid" });

    const order = await PaymentOrder.create({
      schoolId: req.tenantId,
      invoiceId: invoice._id,
      studentId: invoice.studentId,
      admissionNo: req.user.role === "student" ? req.user.refId : invoice.studentId,
      amount: due,
      provider: provider || (providerEnabled() ? process.env.PAYMENT_PROVIDER_NAME : "unconfigured"),
      providerOrderId: uuidv4(),
      externalRef: `PKG-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      data: {
        id: order._id,
        invoiceId: order.invoiceId,
        studentId: order.studentId,
        amount: order.amount,
        currency: order.currency,
        provider: order.provider,
        providerOrderId: order.providerOrderId,
        externalRef: order.externalRef,
        status: order.status,
        checkoutUrl: null, // populated only when a provider is configured
        createdAt: order.createdAt,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Prepares a provider checkout descriptor. With no provider configured this
// returns the honest state rather than pretending a redirect happened.
const initiateOrder = async (req, res) => {
  try {
    const order = await PaymentOrder.findOne({ _id: req.params.id, schoolId: req.tenantId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (req.user.role === "student" && String(order.studentId) !== String(req.user.refId)) {
      return res.status(403).json({ success: false, message: "Not your payment order" });
    }
    if (order.status !== "pending") {
      return res.status(400).json({ success: false, message: `Order is already ${order.status}` });
    }

    if (!providerEnabled()) {
      return res.status(503).json({
        success: false,
        message: "Payment provider is not configured. Please complete payment at the school office.",
        code: "PROVIDER_NOT_CONFIGURED",
      });
    }

    order.status = "awaiting_confirmation";
    await order.save();

    res.json({
      success: true,
      data: {
        id: order._id,
        provider: order.provider,
        amount: order.amount,
        currency: order.currency,
        providerOrderId: order.providerOrderId,
        // In production this is returned by the provider's session/checkout call.
        checkoutUrl: process.env.PAYMENT_PROVIDER_CHECKOUT_BASE
          ? `${process.env.PAYMENT_PROVIDER_CHECKOUT_BASE}/${order.providerOrderId}`
          : null,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Internal provider-confirmation path. Only reachable when a provider is
// configured and the caller presents the provider webhook secret. This is the
// ONLY place a payment order can transition to completed and reconcile money.
const confirmOrder = async (req, res) => {
  try {
    if (!providerEnabled()) {
      return res.status(503).json({ success: false, message: "Payment provider is not configured" });
    }

    const signature = req.headers["x-payment-signature"];
    const expected = process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET;
    if (!signature || !expected || signature !== expected) {
      return res.status(401).json({ success: false, message: "Invalid provider signature" });
    }

    const order = await PaymentOrder.findOne({ _id: req.params.id, schoolId: req.tenantId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.status === "completed") {
      return res.json({ success: true, data: { order, note: "Already confirmed" } });
    }
    if (!["pending", "awaiting_confirmation"].includes(order.status)) {
      return res.status(400).json({ success: false, message: `Order is ${order.status}` });
    }

    const invoice = await FeeInvoice.findOne({ _id: order.invoiceId, schoolId: req.tenantId });
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    const receiptNo = `RCPT-${Date.now()}-${order.externalRef}`;
    const payment = await Payment.create({
      schoolId: req.tenantId,
      invoiceId: invoice._id,
      studentId: order.studentId,
      amount: order.amount,
      mode: "Online Gateway",
      transactionId: order.providerOrderId,
      receiptNo,
      collectedBy: `gateway:${order.provider}`,
    });

    invoice.paidAmount += Number(order.amount);
    invoice.receiptNo = receiptNo;
    invoice.status = invoice.paidAmount >= invoice.amount ? "Paid" : "Partial";
    await invoice.save();

    order.status = "completed";
    order.confirmedAt = new Date();
    order.confirmedBy = `gateway:${order.provider}`;
    await order.save();

    res.json({ success: true, data: { order, payment, invoice } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const order = await PaymentOrder.findOne({ _id: req.params.id, schoolId: req.tenantId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (req.user.role === "student" && String(order.studentId) !== String(req.user.refId)) {
      return res.status(403).json({ success: false, message: "Not your payment order" });
    }
    if (order.status === "completed") {
      return res.status(400).json({ success: false, message: "Completed orders cannot be cancelled" });
    }
    order.status = "cancelled";
    await order.save();
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const filter = { schoolId: req.tenantId };
    if (req.user.role === "student") filter.studentId = req.user.refId;
    else if (req.query.studentId) filter.studentId = req.query.studentId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.invoiceId) filter.invoiceId = req.query.invoiceId;

    const data = await PaymentOrder.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createOrder, initiateOrder, confirmOrder, cancelOrder, getOrders };