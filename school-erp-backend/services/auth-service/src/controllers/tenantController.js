const Plan = require("../models/Plan");
const Subscription = require("../models/Subscription");
const { CURRENT_SUBSCRIPTION_STATUSES } = require("../models/Subscription");
const School = require("../models/School");
const User = require("../models/User");
const { writeAudit } = require("../utils/audit");
const {
  toSubscriptionJson,
  buildSubscriptionDates,
  closeCurrentSubscriptions,
  createInvoiceForSubscription,
  loadSubscription,
  loadPlanOrThrow,
  rawError,
} = require("./platformController");

// --------------------------------------------------------------------------
// School-facing subscription self-service. A school admin can inspect their
// own plan, compare public plans and upgrade instantly. All lookups are
// scoped to req.tenantId (from the JWT) — a school can never touch another
// tenant's billing data.
// --------------------------------------------------------------------------

const getMySubscription = async (req, res) => {
  try {
    const sub = await Subscription.findOne({
      schoolId: req.tenantId,
      status: { $in: CURRENT_SUBSCRIPTION_STATUSES },
    })
      .sort({ createdAt: -1 })
      .populate("planId", "_id name code price currency billingCycle trialDays")
      .lean();
    res.json({ success: true, data: sub ? toSubscriptionJson(sub) : null });
  } catch (err) {
    rawError(res, err);
  }
};

const listPublicPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true, isPublic: true })
      .sort({ sortOrder: 1, price: 1 })
      .lean();
    res.json({ success: true, count: plans.length, data: plans });
  } catch (err) {
    rawError(res, err);
  }
};

// Live usage vs plan limits. Counts platform user accounts inside this school
// (the same measure the tenant's plan limits are expressed against).
const getMyUsage = async (req, res) => {
  try {
    const filter = { schoolId: req.tenantId, deletedAt: null };
    const [students, teachers, staff, adminUsers, total] = await Promise.all([
      User.countDocuments({ ...filter, role: "student" }),
      User.countDocuments({ ...filter, role: "teacher" }),
      User.countDocuments({ ...filter, role: "staff" }),
      User.countDocuments({ ...filter, role: "school_admin" }),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, data: { students, teachers, staff, adminUsers, total } });
  } catch (err) {
    rawError(res, err);
  }
};

const upgradeMyPlan = async (req, res) => {
  try {
    const schoolId = req.tenantId;
    if (!schoolId) {
      return res.status(400).json({ success: false, message: "No school attached to this account" });
    }
    const { planId } = req.body || {};
    if (!planId) {
      return res.status(400).json({ success: false, message: "planId is required" });
    }

    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({ success: false, message: "School not found" });
    }
    if (school.status !== "active") {
      return res.status(409).json({ success: false, message: "School is not active — contact the platform owner" });
    }

    const plan = await loadPlanOrThrow(planId);
    if (!plan.isPublic) {
      return res.status(409).json({ success: false, message: "This plan is not available for self-service upgrade" });
    }

    const current = await Subscription.findOne({ schoolId, status: { $in: CURRENT_SUBSCRIPTION_STATUSES } })
      .sort({ createdAt: -1 })
      .populate("planId", "_id code")
      .lean();
    if (current && String(current.planId?._id || current.planId) === String(plan._id)) {
      const loaded = await loadSubscription(current._id);
      return res.json({ success: true, message: "Already subscribed to this plan", data: toSubscriptionJson(loaded) });
    }

    // Paid plans: never switch instantly — a payment order is created on the
    // platform gateway and the switch happens after payment (webhook/signature)
    // via the internal subscription-paid callback.
    if (Number(plan.price) > 0) {
      const feeUrl = process.env.FEE_SERVICE_URL || "http://localhost:5005";
      const resOrder = await fetch(`${feeUrl}/api/payments/internal/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-key": process.env.INTERNAL_NOTIFY_KEY || "",
        },
        body: JSON.stringify({
          schoolId,
          planId: plan._id,
          amount: plan.price,
          currency: plan.currency,
        }),
        signal: AbortSignal.timeout(10000),
      });
      const json = await resOrder.json().catch(() => ({}));
      if (!resOrder.ok || !json.success) {
        return res.status(503).json({
          success: false,
          message: "Payment engine unavailable — please try again shortly",
        });
      }
      return res.json({ success: true, data: { requiresPayment: true, ...json.data } });
    }

    // Free / trial plans switch instantly (no money changes hands).
    // Mirror the platform owner's changePlan flow: atomically close any current
    // subscription (partial unique index forbids two concurrent current subs),
    // then create the upgraded one and invoice it.
    const dates = buildSubscriptionDates(plan, new Date());
    await closeCurrentSubscriptions(schoolId, { reason: "self-upgrade" });

    const next = await Subscription.create({
      schoolId,
      planId: plan._id,
      status: dates.status,
      startDate: dates.startDate,
      trialStartDate: dates.trialStartDate,
      trialEndDate: dates.trialEndDate,
      currentPeriodStart: dates.currentPeriodStart,
      currentPeriodEnd: dates.currentPeriodEnd,
      nextBillingDate: dates.nextBillingDate,
      billingCycle: plan.billingCycle,
      price: plan.price,
      currency: plan.currency,
    });
    await School.updateOne({ _id: schoolId }, { $set: { plan: plan.code } });
    await createInvoiceForSubscription(next);
    await writeAudit({ req, user: req.user, action: "subscription.changed", targetType: "subscription", targetId: next._id, message: `School upgraded to plan ${plan.code}` });

    const loaded = await loadSubscription(next._id);
    return res.status(201).json({ success: true, message: "Plan upgraded", data: toSubscriptionJson(loaded) });
  } catch (err) {
    rawError(res, err);
  }
};

module.exports = { getMySubscription, listPublicPlans, getMyUsage, upgradeMyPlan };