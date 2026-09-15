import { useEffect, useRef, useState } from "react";
import { Check, CreditCard, Gauge, Zap, ArrowUpRight, Clock, X, Eye, AlertTriangle, Download, ChevronDown, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { api } from "../lib/api";
import { Button, Card, Input, PageIntro, Pill, toast } from "../components/UI";
import { openRazorpayCheckout } from "../utils/razorpay";

const LIMIT_LABELS = {
  students: "Students",
  teachers: "Teachers",
  staff: "Staff",
  adminUsers: "Admin users",
};

const STATUS_TONES = {
  trialing: "info",
  active: "success",
  past_due: "amber",
  suspended: "neutral",
  cancelled: "alert",
  expired: "neutral",
};

const fmtMoney = (value, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);

const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

function UsageBar({ label, used, limit }) {
  const unlimited = limit === null || limit === undefined || limit === "";
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const over = !unlimited && used > limit;
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] mb-1">
        <span className="font-semibold text-slate-text">{label}</span>
        <span className={over ? "text-alert font-semibold" : "text-slate-text/60"}>
          {used}
          {unlimited ? " (unlimited)" : ` / ${limit}`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-paper overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-alert" : "bg-success"}`}
          style={{ width: `${unlimited ? 0 : pct}%` }}
        />
      </div>
    </div>
  );
}

export default function Subscription() {
  const [sub, setSub] = useState(null);
  const [plans, setPlans] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  // Checkout modal state
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [duration, setDuration] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [switchMode, setSwitchMode] = useState("advance");
  const [declarationChecked, setDeclarationChecked] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Scheduled subscription (advance purchase)
  const [scheduledSub, setScheduledSub] = useState(null);

  // Invoice dropdown state
  const [invoiceDropdownOpen, setInvoiceDropdownOpen] = useState(false);
  const [latestInvoice, setLatestInvoice] = useState(null);

  // View invoice modal
  const [viewInvoice, setViewInvoice] = useState(null);
  const [viewInvoiceLoading, setViewInvoiceLoading] = useState(false);

  // Previous invoices / transaction history modal
  const [showInvoicesList, setShowInvoicesList] = useState(false);
  const [invoicesList, setInvoicesList] = useState([]);
  const [invoicesTotal, setInvoicesTotal] = useState(0);
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [invoicesPages, setInvoicesPages] = useState(1);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesSearch, setInvoicesSearch] = useState("");
  const [invoicesStatusFilter, setInvoicesStatusFilter] = useState("");
  const [invoicesDownloading, setInvoicesDownloading] = useState("");

  // View plan modal state
  const [viewPlan, setViewPlan] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.subscription.me(), api.subscription.scheduled(), api.subscription.plans(), api.subscription.usage(), api.invoices.list("limit=1")])
      .then(([subRes, schedRes, plansRes, usageRes, invRes]) => {
        if (!active) return;
        setSub(subRes.data || null);
        setScheduledSub(schedRes.data || null);
        setPlans(plansRes.data || []);
        setUsage(usageRes.data || null);
        setLatestInvoice(invRes.data?.invoices?.[0] || null);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Close invoice dropdown on outside click
  const invoiceDropdownRef = useRef(null);
  useEffect(() => {
    if (!invoiceDropdownOpen) return;
    const handler = (e) => {
      if (invoiceDropdownRef.current && !invoiceDropdownRef.current.contains(e.target)) {
        setInvoiceDropdownOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [invoiceDropdownOpen]);

  const refresh = async () => {
    try {
      const [subRes, schedRes, plansRes, usageRes] = await Promise.all([
        api.subscription.me(),
        api.subscription.scheduled(),
        api.subscription.plans(),
        api.subscription.usage(),
      ]);
      setSub(subRes.data || null);
      setScheduledSub(schedRes.data || null);
      setPlans(plansRes.data || []);
      setUsage(usageRes.data || null);
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const fetchLatestInvoice = async () => {
    try {
      const res = await api.invoices.list("limit=1");
      setLatestInvoice(res.data?.invoices?.[0] || null);
    } catch (_) { /* silent */ }
  };

  const fetchInvoicesList = async (page = 1, search = "", status = "") => {
    setInvoicesLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      const res = await api.invoices.list(params.toString());
      setInvoicesList(res.data?.invoices || []);
      setInvoicesTotal(res.data?.total || 0);
      setInvoicesPage(res.data?.page || 1);
      setInvoicesPages(res.data?.pages || 1);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setInvoicesLoading(false);
    }
  };

  const openViewInvoice = async (invoiceId) => {
    setViewInvoiceLoading(true);
    try {
      const res = await api.invoices.get(invoiceId);
      setViewInvoice(res.data);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setViewInvoiceLoading(false);
    }
  };

  const downloadInvoicePdf = async (invoiceId) => {
    try {
      await api.invoices.downloadPdf(invoiceId);
    } catch (err) {
      toast(err.message || "Download failed", "error");
    }
  };

  const openCheckout = (plan) => {
    setCheckoutPlan(plan);
    setDuration(1);
    setSwitchMode("advance");
    setDeclarationChecked(false);
  };

  const closeCheckout = () => {
    setCheckoutPlan(null);
    setDuration(1);
    setSwitchMode("advance");
    setDeclarationChecked(false);
    setProcessing(false);
  };

  const getUnitLabel = (plan) => (plan.billingCycle === "yearly" ? "year" : "month");
  const getPluralLabel = (plan) => (plan.billingCycle === "yearly" ? "years" : "months");

  // Calculate savings for yearly plans compared to monthly equivalent
  const getSavings = (plan) => {
    if (plan.billingCycle !== "yearly") return null;
    const baseName = plan.code.replace("_yearly", "");
    const monthlyPlan = plans.find((p) => p.code === baseName && p.billingCycle === "monthly");
    if (!monthlyPlan || !monthlyPlan.price) return null;
    const monthlyTotal = monthlyPlan.price * 12;
    const yearlyTotal = plan.price;
    const saved = monthlyTotal - yearlyTotal;
    return saved > 0 ? saved : null;
  };

  const getMonthlyEquivalent = (plan) => {
    if (plan.billingCycle !== "yearly") return null;
    const baseName = plan.code.replace("_yearly", "");
    const monthlyPlan = plans.find((p) => p.code === baseName && p.billingCycle === "monthly");
    return monthlyPlan || null;
  };

  const upgrade = async (plan, durationPeriods, mode) => {
    if (busyId) return;
    setBusyId(plan._id);
    setNotice("");
    setProcessing(true);
    setShowConfirmModal(false);
    try {
      const res = await api.subscription.upgrade(plan._id, durationPeriods, mode);

      if (res.data?.requiresPayment) {
        const { id, providerOrderId, checkout } = res.data;
        if (checkout?.keyId && providerOrderId) {
          const payload = await openRazorpayCheckout({
            keyId: checkout.keyId,
            orderId: providerOrderId,
            amount: checkout.amount,
            currency: checkout.currency,
            name: "Zipschool OS",
            description: `Upgrade to ${plan.name} (${durationPeriods} ${durationPeriods === 1 ? getUnitLabel(plan) : getPluralLabel(plan)})`,
          });
          await api.fees.orders.confirm(id, payload);
          toast("Payment confirmed — your plan has been switched", "success");
          closeCheckout();
        } else {
          setNotice(
            "A payment was initiated but the gateway is not fully configured. Please complete the payment at the platform office.",
          );
        }
        await refresh();
      } else {
        setSub(res.data || null);
        toast(res.message || "Plan upgraded", "success");
        closeCheckout();
      }
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusyId("");
      setProcessing(false);
    }
  };

  const currentPlan = plans.find((p) => String(p._id) === String(sub?.plan?._id)) || null;
  const isTrial = sub?.status === "trialing";
  const isTrialPlan = sub?.plan?.code === "trial";

  if (loading) {
    return (
      <div className="w-full">
        <PageIntro eyebrow="Administration" title="Subscription & Upgrade" />
        <Card>
          <p className="text-[13px] text-slate-text/70">Loading your subscription…</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <PageIntro eyebrow="Administration" title="Subscription & Upgrade" />
        <Card>
          <p className="text-[13px] text-alert">{error}</p>
          <Button variant="outline" className="mt-3" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <PageIntro
        eyebrow="Administration"
        title="Subscription & Upgrade"
        description="Your school's current plan, live usage against included limits, and every upgrade option available on the platform."
      />

      <Card
        title="Current plan"
        bodyClassName="p-5"
        action={
          sub && !isTrialPlan ? (
            <div className="relative" ref={invoiceDropdownRef}>
              <button
                onClick={() => setInvoiceDropdownOpen(!invoiceDropdownOpen)}
                className="flex items-center gap-1.5 text-[12.5px] font-medium text-slate-text hover:text-ink border border-black/[0.08] rounded-lg px-3 py-1.5 hover:bg-paper transition-colors"
              >
                <FileText size={14} /> Invoices <ChevronDown size={12} className={`transition-transform ${invoiceDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {invoiceDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl border border-black/[0.08] shadow-lg z-30 py-1">
                  <button
                    className="w-full text-left px-3 py-2 text-[12.5px] text-ink hover:bg-paper flex items-center gap-2"
                    onClick={() => {
                      setInvoiceDropdownOpen(false);
                      if (latestInvoice) downloadInvoicePdf(latestInvoice._id);
                      else toast("No invoice available yet", "info");
                    }}
                  >
                    <Download size={13} /> Download Invoice
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-[12.5px] text-ink hover:bg-paper flex items-center gap-2"
                    onClick={() => {
                      setInvoiceDropdownOpen(false);
                      if (latestInvoice) openViewInvoice(latestInvoice._id);
                      else toast("No invoice available yet", "info");
                    }}
                  >
                    <Eye size={13} /> View Invoice
                  </button>
                  <div className="border-t border-black/[0.06] my-1" />
                  <button
                    className="w-full text-left px-3 py-2 text-[12.5px] text-ink hover:bg-paper flex items-center gap-2"
                    onClick={() => {
                      setInvoiceDropdownOpen(false);
                      setShowInvoicesList(true);
                      fetchInvoicesList(1);
                    }}
                  >
                    <FileText size={13} /> Previous Invoices
                  </button>
                </div>
              )}
            </div>
          ) : null
        }
      >
        {sub ? (
          <>
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-display font-bold text-ink">{sub.plan?.name || "—"}</p>
                    <p className="text-[11.5px] font-mono text-slate-text/60">{sub.plan?.code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={STATUS_TONES[sub.status] || "neutral"}>{sub.status}</Pill>
                    {sub.status === "active" && sub.currentPeriodEnd && (
                      <span className="text-[11px] text-slate-text/60">
                        {Math.max(0, Math.ceil((new Date(sub.currentPeriodEnd) - new Date()) / (1000 * 60 * 60 * 24)))} days left
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-display font-bold text-ink">
                    {fmtMoney(sub.price, sub.currency)}
                  </span>
                  <span className="text-[12px] text-slate-text/60">/ {sub.billingCycle}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-paper px-3 py-2">
                    <p className="text-[11px] font-semibold text-slate-text/60 uppercase tracking-wide">Started</p>
                    <p className="text-[13px] font-medium text-ink mt-0.5">{fmtDate(sub.startDate)}</p>
                  </div>
                  {sub.trialEndDate && (
                    <div className="rounded-lg bg-paper px-3 py-2">
                      <p className="text-[11px] font-semibold text-slate-text/60 uppercase tracking-wide">Trial ends</p>
                      <p className="text-[13px] font-medium text-ink mt-0.5">{fmtDate(sub.trialEndDate)}</p>
                    </div>
                  )}
                  {(sub.durationPeriods || 1) > 1 && (
                    <div className="rounded-lg bg-paper px-3 py-2">
                      <p className="text-[11px] font-semibold text-slate-text/60 uppercase tracking-wide">Duration</p>
                      <p className="text-[13px] font-medium text-ink mt-0.5">
                        {sub.durationPeriods} {sub.billingCycle === "yearly" ? "years" : "months"}
                      </p>
                    </div>
                  )}
                  <div className="rounded-lg bg-paper px-3 py-2">
                    <p className="text-[11px] font-semibold text-slate-text/60 uppercase tracking-wide">Renews on</p>
                    <p className="text-[13px] font-medium text-ink mt-0.5">{fmtDate(sub.nextBillingDate)}</p>
                  </div>
                </div>

                <ul className="space-y-1.5">
                  {(currentPlan?.features?.length ? currentPlan.features : ["View feature details from the platform owner"]).map(
                    (feature) => (
                      <li key={feature} className="flex items-start gap-2 text-[12.5px] text-slate-text">
                        <Check size={14} className="text-success shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>

              <div className="space-y-4">
                <p className="text-[12px] font-semibold text-slate-text/70 uppercase tracking-wide flex items-center gap-1.5">
                  <Gauge size={14} /> Included limits vs current usage
                </p>
                {usage ? (
                  <div className="space-y-4">
                    {Object.keys(LIMIT_LABELS).map((key) => (
                      <UsageBar
                        key={key}
                        label={LIMIT_LABELS[key]}
                        used={usage[key] || 0}
                        limit={currentPlan?.limits?.[key] ?? null}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-[12.5px] text-slate-text/70">Usage data is unavailable right now.</p>
                )}
              </div>
            </div>

            {isTrial && (
              <div className="mt-5 rounded-2xl border border-amber/30 bg-gradient-to-br from-amber/5 via-transparent to-amber/10 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber/15 flex items-center justify-center shrink-0">
                    <Clock size={22} className="text-amber-dark" />
                  </div>
                  <div>
                    <p className="text-[13.5px] font-bold text-ink">Your trial is active</p>
                    <p className="text-[12px] text-slate-text/70 mt-0.5">
                      {sub.trialEndDate && (() => {
                        const daysLeft = Math.max(0, Math.ceil((new Date(sub.trialEndDate) - new Date()) / (1000 * 60 * 60 * 24)));
                        return daysLeft > 0
                          ? `${daysLeft} days remaining — ends ${fmtDate(sub.trialEndDate)}`
                          : `Trial ended on ${fmtDate(sub.trialEndDate)}`;
                      })()}
                      {" — "}{isTrialPlan ? "Choose a paid plan to get started." : "Upgrade to unlock all features."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:ml-auto shrink-0">
                  <Button
                    variant="amber"
                    className="!text-[12.5px]"
                    onClick={() => document.getElementById("plans-section")?.scrollIntoView({ behavior: "smooth" })}
                  >
                    {isTrialPlan ? <><ArrowUpRight size={14} /> Choose a plan</> : <>Compare plans</>}
                  </Button>
                  {!isTrialPlan && (
                    <Button
                      variant="amber"
                      className="!text-[12.5px]"
                      onClick={() => currentPlan && openCheckout(currentPlan)}
                      disabled={!!busyId}
                    >
                      <Zap size={14} /> {busyId === currentPlan?._id ? "Processing…" : `Buy ${sub.plan?.name}`}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="py-6 text-center">
            <CreditCard size={32} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[14px] font-medium text-ink">No active subscription</p>
            <p className="text-[13px] text-slate-text/60 mt-1">
              Pick a plan below to activate billing for this school.
            </p>
          </div>
        )}
      </Card>

      {/* Scheduled subscription banner (advance purchase) */}
      {scheduledSub && scheduledSub.planId && (
        <div className="rounded-2xl border border-info/30 bg-gradient-to-br from-info/5 via-transparent to-info/10 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-info/15 flex items-center justify-center shrink-0">
              <Clock size={22} className="text-info" />
            </div>
            <div>
              <p className="text-[13.5px] font-bold text-ink">
                {scheduledSub.planId.name} — Scheduled Upgrade
              </p>
              <p className="text-[12px] text-slate-text/70 mt-0.5">
                Activates on {fmtDate(scheduledSub.startDate)} · {scheduledSub.durationPeriods} {scheduledSub.durationPeriods === 1 ? getUnitLabel(scheduledSub.planId) : getPluralLabel(scheduledSub.planId)} · {fmtMoney(scheduledSub.price * scheduledSub.durationPeriods)}
              </p>
            </div>
          </div>
          <div className="sm:ml-auto shrink-0">
            <Button variant="outline" className="!text-[12px]" onClick={() => toast("Contact platform admin to cancel scheduled upgrade", "info")}>
              Cancel Scheduled
            </Button>
          </div>
        </div>
      )}

      <div id="plans-section">
      <Card
        title="Plans"
        bodyClassName="p-5"
        action={
          <Pill tone="info">
            {sub ? "Paid plans switch after payment" : "Free trial available on paid plans"}
          </Pill>
        }
      >
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {notice && (
            <div className="sm:col-span-2 xl:col-span-3 rounded-lg bg-amber/10 border border-amber/20 px-4 py-3 text-[12.5px] text-slate-text">
              {notice}
            </div>
          )}
          {plans.length === 0 ? (
            <p className="text-[13px] text-slate-text/70">No public plans are available right now.</p>
          ) : (
            plans.map((plan) => {
              const isCurrent = String(plan._id) === String(currentPlan?._id || sub?.plan?._id);
              return (
                <Card key={plan._id} className="flex flex-col" bodyClassName="p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-semibold text-ink">{plan.name}</p>
                      <p className="text-[11.5px] font-mono text-slate-text/60">{plan.code}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {plan.price === 0 && plan.trialDays > 0 && (
                        <Pill tone="info">Free Trial</Pill>
                      )}
                      {isCurrent && <Pill tone="success">Current</Pill>}
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-display font-bold text-ink">{fmtMoney(plan.price, plan.currency)}</span>
                    <span className="text-[12px] text-slate-text/60">/ {plan.billingCycle}</span>
                    {getSavings(plan) && (
                      <span className="text-[11px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
                        Save {fmtMoney(getSavings(plan))}
                      </span>
                    )}
                  </div>

                  {getMonthlyEquivalent(plan) && (
                    <p className="text-[11.5px] text-slate-text/60 -mt-2">
                      vs {fmtMoney(getMonthlyEquivalent(plan).price)}/month ({fmtMoney(getMonthlyEquivalent(plan).price * 12)}/year)
                    </p>
                  )}

                  <p className="text-[12.5px] text-slate-text/80 leading-relaxed min-h-[36px]">
                    {plan.description || "—"}
                  </p>

                  <ul className="space-y-1.5 flex-1">
                    {(plan.features || []).map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-[12.5px] text-slate-text">
                        <Check size={14} className="text-success shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                    <li className="flex items-center gap-2 text-[11.5px] text-slate-text/60 pt-1">
                      <span className="bg-paper text-slate-text/70 px-1.5 py-0.5 rounded">
                        {plan.trialDays > 0 ? `${plan.trialDays}-day trial` : "No trial"}
                      </span>
                      <span>
                        {Object.entries(plan.limits || {})
                          .filter(([, v]) => v !== null && v !== undefined)
                          .map(([k, v]) => `${LIMIT_LABELS[k] || k}: ${v}`)
                          .join(" · ") || "Unlimited limits"}
                      </span>
                    </li>
                  </ul>

                  {isCurrent ? (
                    <p className="text-center text-[12.5px] font-medium text-success">
                      This is your current plan
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 justify-center" onClick={() => setViewPlan(plan)}>
                        <Eye size={14} /> View Plan
                      </Button>
                      <Button variant="amber" className="flex-1 justify-center" onClick={() => openCheckout(plan)} disabled={!!busyId}>
                        <Zap size={14} /> {busyId === plan._id ? "Switching…" : (isTrial ? `Upgrade to ${plan.name}` : "Switch")}
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </Card>
      </div>

      {/* ─── Checkout Modal ─── */}
      {checkoutPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={!processing ? closeCheckout : undefined} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-ink text-[16px]">{checkoutPlan.name}</h3>
                <p className="text-[12px] text-slate-text/60">{checkoutPlan.description}</p>
              </div>
              <button onClick={closeCheckout} className="text-slate-text/40 hover:text-ink" disabled={processing}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Base price display */}
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-display font-bold text-ink">
                  {fmtMoney(checkoutPlan.price, checkoutPlan.currency)}
                </span>
                <span className="text-[12px] text-slate-text/60">/ {getUnitLabel(checkoutPlan)}</span>
              </div>

              {/* Switch mode (only when there's an active subscription) */}
              {sub && (
                <div className="rounded-lg border border-black/[0.06] p-4 space-y-3">
                  <p className="text-[12.5px] font-semibold text-ink">When do you want this plan to start?</p>

                  {/* Advance option */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="switchMode"
                      value="advance"
                      checked={switchMode === "advance"}
                      onChange={() => { setSwitchMode("advance"); setDeclarationChecked(false); }}
                      disabled={processing}
                      className="mt-0.5 accent-amber"
                    />
                    <div>
                      <span className="text-[13px] font-medium text-ink">Start after current plan expires</span>
                      <p className="text-[11.5px] text-slate-text/60 mt-0.5">
                        Your {sub.planId?.name || "current"} plan ends on {fmtDate(sub.currentPeriodEnd)} — new plan activates on {fmtDate(sub.currentPeriodEnd)}
                      </p>
                    </div>
                  </label>

                  {/* Immediate option */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="switchMode"
                      value="immediate"
                      checked={switchMode === "immediate"}
                      onChange={() => setSwitchMode("immediate")}
                      disabled={processing}
                      className="mt-0.5 accent-amber"
                    />
                    <div>
                      <span className="text-[13px] font-medium text-ink">Start immediately</span>
                      <p className="text-[11.5px] text-amber-dark mt-0.5">
                        Your remaining {Math.max(0, Math.ceil((new Date(sub.currentPeriodEnd) - new Date()) / (1000 * 60 * 60 * 24)))} days on {sub.planId?.name || "current"} plan will be forfeited
                      </p>
                    </div>
                  </label>

                  {/* Declaration checkbox (only for immediate) */}
                  {switchMode === "immediate" && (
                    <label className="flex items-start gap-3 pt-2 border-t border-black/[0.04] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={declarationChecked}
                        onChange={(e) => setDeclarationChecked(e.target.checked)}
                        disabled={processing}
                        className="mt-0.5 accent-amber"
                      />
                      <span className="text-[12px] text-slate-text leading-snug">
                        I understand that my remaining days on the current plan will be forfeited and this action cannot be undone.
                      </span>
                    </label>
                  )}
                </div>
              )}

              {/* Duration input */}
              <div>
                <label className="text-[12px] font-semibold text-slate-text mb-1.5 block">
                  How many {getPluralLabel(checkoutPlan)} do you want to purchase?
                </label>
                <Input
                  type="number"
                  min="1"
                  max="99"
                  step="1"
                  className="w-full"
                  value={duration}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) setDuration(Math.max(1, Math.min(99, v)));
                  }}
                  disabled={processing}
                />
                <p className="text-[11px] text-slate-text/50 mt-1">Min: 1, Max: 99</p>
              </div>

              {/* Price breakdown */}
              <div className="rounded-lg bg-paper p-4 space-y-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-slate-text">Base price</span>
                  <span className="font-medium text-ink">{fmtMoney(checkoutPlan.price)}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-slate-text">Duration</span>
                  <span className="font-medium text-ink">
                    {duration} {duration === 1 ? getUnitLabel(checkoutPlan) : getPluralLabel(checkoutPlan)}
                  </span>
                </div>
                <div className="border-t border-black/10 pt-2 flex items-center justify-between text-[14px]">
                  <span className="font-semibold text-ink">Total</span>
                  <span className="font-display font-bold text-ink text-lg">
                    {fmtMoney(checkoutPlan.price * duration)}
                  </span>
                </div>

                {/* Savings comparison for yearly plans */}
                {getMonthlyEquivalent(checkoutPlan) && (() => {
                  const monthlyEquiv = getMonthlyEquivalent(checkoutPlan);
                  const monthlyForDuration = monthlyEquiv.price * duration * 12;
                  const yearlyForDuration = checkoutPlan.price * duration;
                  const saved = monthlyForDuration - yearlyForDuration;
                  if (saved <= 0) return null;
                  return (
                    <div className="bg-success/10 rounded-lg px-3 py-2 mt-2">
                      <p className="text-[12px] text-success font-semibold">
                        You save {fmtMoney(saved)} vs paying {fmtMoney(monthlyEquiv.price)}/month for {duration} {duration === 1 ? "year" : "years"}
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-black/[0.06] flex justify-end gap-2">
              <Button variant="outline" onClick={closeCheckout} disabled={processing}>
                Cancel
              </Button>
              <Button
                variant="amber"
                onClick={() => {
                  if (switchMode === "immediate" && sub) {
                    setShowConfirmModal(true);
                  } else {
                    upgrade(checkoutPlan, duration, "advance");
                  }
                }}
                disabled={processing || duration < 1 || (switchMode === "immediate" && !declarationChecked)}
              >
                {processing ? "Processing…" : <>Make Payment {fmtMoney(checkoutPlan.price * duration)}</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Confirmation Modal (Immediate Switch) ─── */}
      {showConfirmModal && checkoutPlan && sub && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={() => !processing && setShowConfirmModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-5 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-amber/15 flex items-center justify-center mx-auto">
                <AlertTriangle size={28} className="text-amber-dark" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-ink text-[16px]">Switch Immediately?</h3>
                <p className="text-[13px] text-slate-text mt-2 leading-relaxed">
                  You have <strong>{Math.max(0, Math.ceil((new Date(sub.currentPeriodEnd) - new Date()) / (1000 * 60 * 60 * 24)))} days remaining</strong> on your{" "}
                  <strong>{sub.planId?.name || "current"}</strong> plan (ends {fmtDate(sub.currentPeriodEnd)}).
                </p>
                <p className="text-[13px] text-slate-text mt-2 leading-relaxed">
                  If you switch to <strong>{checkoutPlan.name}</strong> immediately, your remaining days will be{" "}
                  <strong className="text-amber-dark">forfeited</strong> and this action cannot be undone.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-black/[0.06] flex justify-center gap-3">
              <Button variant="outline" onClick={() => setShowConfirmModal(false)} disabled={processing} className="flex-1">
                Go Back
              </Button>
              <Button
                variant="amber"
                onClick={() => upgrade(checkoutPlan, duration, "immediate")}
                disabled={processing}
                className="flex-1"
              >
                {processing ? "Processing…" : "Confirm Switch"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── View Plan Modal ─── */}
      {viewPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setViewPlan(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-display font-semibold text-ink text-[16px]">{viewPlan.name}</h3>
                <p className="text-[12px] text-slate-text/60">{viewPlan.code}</p>
              </div>
              <button onClick={() => setViewPlan(null)} className="text-slate-text/40 hover:text-ink">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
              {/* Pricing */}
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-display font-bold text-ink">
                    {fmtMoney(viewPlan.price, viewPlan.currency)}
                  </span>
                  <span className="text-[12px] text-slate-text/60">/ {viewPlan.billingCycle}</span>
                  {getSavings(viewPlan) && (
                    <span className="text-[11px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
                      Save {fmtMoney(getSavings(viewPlan))}/year
                    </span>
                  )}
                </div>
                {getMonthlyEquivalent(viewPlan) && (
                  <p className="text-[12px] text-slate-text/60">
                    vs {fmtMoney(getMonthlyEquivalent(viewPlan).price)}/month ({fmtMoney(getMonthlyEquivalent(viewPlan).price * 12)}/year)
                  </p>
                )}
              </div>

              <p className="text-[13px] text-slate-text/80 leading-relaxed">
                {viewPlan.description || "—"}
              </p>

              {/* Trial */}
              <div className="rounded-lg bg-paper px-4 py-3">
                <p className="text-[12px] font-semibold text-slate-text/60 uppercase tracking-wide mb-1">Trial</p>
                <p className="text-[13px] font-medium text-ink">
                  {viewPlan.trialDays > 0 ? `${viewPlan.trialDays} days free trial` : "No trial — immediate billing"}
                </p>
              </div>

              {/* Feature Limits */}
              <div>
                <p className="text-[12px] font-semibold text-slate-text/60 uppercase tracking-wide mb-2">Feature Limits</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(LIMIT_LABELS).map(([key, label]) => {
                    const val = viewPlan.limits?.[key];
                    const isUnlimited = val === null || val === undefined;
                    return (
                      <div key={key} className="flex items-center justify-between rounded-lg bg-paper px-3 py-2">
                        <span className="text-[12px] text-slate-text">{label}</span>
                        <span className={`text-[13px] font-semibold ${isUnlimited ? "text-success" : "text-ink"}`}>
                          {isUnlimited ? "Unlimited" : val.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Features */}
              <div>
                <p className="text-[12px] font-semibold text-slate-text/60 uppercase tracking-wide mb-2">Features</p>
                <ul className="space-y-2">
                  {(viewPlan.features || []).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[13px] text-slate-text">
                      <Check size={14} className="text-success shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  {(!viewPlan.features || viewPlan.features.length === 0) && (
                    <li className="text-[12.5px] text-slate-text/50">No features listed</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-black/[0.06] flex justify-end gap-2 shrink-0">
              <Button variant="outline" onClick={() => setViewPlan(null)}>Close</Button>
              <Button variant="amber" onClick={() => { setViewPlan(null); openCheckout(viewPlan); }}>
                <Zap size={14} /> Buy {viewPlan.name}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── View Invoice Modal ─── */}
      {(viewInvoice || viewInvoiceLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => !viewInvoiceLoading && setViewInvoice(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-display font-semibold text-ink text-[16px]">
                  {viewInvoice ? `Invoice ${viewInvoice.invoiceNumber}` : "Loading…"}
                </h3>
                {viewInvoice && (
                  <p className="text-[12px] text-slate-text/60">{fmtDate(viewInvoice.createdAt)}</p>
                )}
              </div>
              <button onClick={() => setViewInvoice(null)} className="text-slate-text/40 hover:text-ink" disabled={viewInvoiceLoading}>
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto flex-1">
              {viewInvoiceLoading ? (
                <div className="py-12 text-center text-[13px] text-slate-text/60">Loading invoice…</div>
              ) : viewInvoice ? (
                <div className="space-y-4">
                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <Pill tone={viewInvoice.status === "paid" ? "success" : viewInvoice.status === "overdue" ? "alert" : "amber"}>
                      {(viewInvoice.status || "issued").toUpperCase()}
                    </Pill>
                    <span className="text-[12px] text-slate-text/60">
                      {viewInvoice.paidAt ? `Paid ${fmtDate(viewInvoice.paidAt)}` : `Due ${fmtDate(viewInvoice.dueDate)}`}
                    </span>
                  </div>

                  {/* School */}
                  <div className="rounded-lg bg-paper px-4 py-3">
                    <p className="text-[11px] font-semibold text-slate-text/60 uppercase tracking-wide mb-1">Bill To</p>
                    <p className="text-[13px] font-medium text-ink">{viewInvoice.school?.name || viewInvoice.planName || "School"}</p>
                    <p className="text-[12px] text-slate-text/60">Code: {viewInvoice.school?.code || "—"}</p>
                  </div>

                  {/* Plan details */}
                  <div className="rounded-lg bg-paper px-4 py-3 space-y-2">
                    <p className="text-[11px] font-semibold text-slate-text/60 uppercase tracking-wide">Plan Details</p>
                    <div className="grid grid-cols-2 gap-2 text-[12.5px]">
                      <div><span className="text-slate-text/60">Plan:</span> <span className="font-medium text-ink">{viewInvoice.planName || "—"}</span></div>
                      <div><span className="text-slate-text/60">Cycle:</span> <span className="font-medium text-ink">{viewInvoice.planCode?.includes("yearly") ? "Yearly" : "Monthly"}</span></div>
                      <div><span className="text-slate-text/60">Duration:</span> <span className="font-medium text-ink">{viewInvoice.durationPeriods || 1} {(viewInvoice.durationPeriods || 1) === 1 ? "month" : "months"}</span></div>
                      <div><span className="text-slate-text/60">Period:</span> <span className="font-medium text-ink">{fmtDate(viewInvoice.periodStart)} — {fmtDate(viewInvoice.periodEnd)}</span></div>
                    </div>
                  </div>

                  {/* Amount breakdown */}
                  <div className="rounded-lg bg-paper px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="text-slate-text/60">Base Price</span>
                      <span className="font-medium text-ink">{fmtMoney(viewInvoice.amount / (viewInvoice.durationPeriods || 1))}</span>
                    </div>
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="text-slate-text/60">Duration</span>
                      <span className="font-medium text-ink">× {viewInvoice.durationPeriods || 1} {viewInvoice.planCode?.includes("yearly") ? "years" : "months"}</span>
                    </div>
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="text-slate-text/60">Subtotal</span>
                      <span className="font-medium text-ink">{fmtMoney(viewInvoice.amount)}</span>
                    </div>
                    {(viewInvoice.cgstAmount > 0 || viewInvoice.sgstAmount > 0) && (
                      <>
                        <div className="flex items-center justify-between text-[12.5px]">
                          <span className="text-slate-text/60">CGST @{viewInvoice.gstRate ? Math.round(viewInvoice.gstRate / 2) : 9}%</span>
                          <span className="font-medium text-ink">{fmtMoney(viewInvoice.cgstAmount)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[12.5px]">
                          <span className="text-slate-text/60">SGST @{viewInvoice.gstRate ? Math.round(viewInvoice.gstRate / 2) : 9}%</span>
                          <span className="font-medium text-ink">{fmtMoney(viewInvoice.sgstAmount)}</span>
                        </div>
                      </>
                    )}
                    <div className="border-t border-black/10 pt-2 flex items-center justify-between text-[14px]">
                      <span className="font-semibold text-ink">Total Paid</span>
                      <span className="font-display font-bold text-ink">{fmtMoney(viewInvoice.totalAmount || viewInvoice.amount)}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="px-6 py-4 border-t border-black/[0.06] flex justify-end gap-2 shrink-0">
              <Button variant="outline" onClick={() => setViewInvoice(null)}>Close</Button>
              {viewInvoice && ["paid", "issued"].includes(viewInvoice.status) && (
                <Button variant="amber" onClick={() => downloadInvoicePdf(viewInvoice._id)}>
                  <Download size={14} /> Download PDF
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Previous Invoices / Transaction History Modal ─── */}
      {showInvoicesList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setShowInvoicesList(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-display font-semibold text-ink text-[16px]">Transaction History</h3>
                <p className="text-[12px] text-slate-text/60">{invoicesTotal} invoice{invoicesTotal !== 1 ? "s" : ""} total</p>
              </div>
              <button onClick={() => setShowInvoicesList(false)} className="text-slate-text/40 hover:text-ink">
                <X size={18} />
              </button>
            </div>

            {/* Filters */}
            <div className="px-6 py-3 border-b border-black/[0.04] flex items-center gap-3 shrink-0">
              <input
                type="text"
                placeholder="Search invoices…"
                className="flex-1 text-[12.5px] border border-black/[0.08] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber/30"
                value={invoicesSearch}
                onChange={(e) => setInvoicesSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") fetchInvoicesList(1, invoicesSearch, invoicesStatusFilter); }}
              />
              <select
                className="text-[12.5px] border border-black/[0.08] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber/30 bg-white"
                value={invoicesStatusFilter}
                onChange={(e) => { setInvoicesStatusFilter(e.target.value); fetchInvoicesList(1, invoicesSearch, e.target.value); }}
              >
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="issued">Issued</option>
                <option value="overdue">Overdue</option>
                <option value="void">Void</option>
              </select>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {invoicesLoading ? (
                <div className="py-12 text-center text-[13px] text-slate-text/60">Loading invoices…</div>
              ) : invoicesList.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText size={32} className="mx-auto text-slate-text/30 mb-3" />
                  <p className="text-[13px] text-slate-text/60">No invoices found</p>
                </div>
              ) : (
                <div className="divide-y divide-black/[0.04]">
                  {invoicesList.map((inv) => (
                    <div key={inv._id} className="px-6 py-3 flex items-center gap-4 hover:bg-paper/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-ink truncate">{inv.invoiceNumber}</span>
                          <Pill tone={inv.status === "paid" ? "success" : inv.status === "overdue" ? "alert" : "amber"}>
                            {inv.status}
                          </Pill>
                        </div>
                        <p className="text-[12px] text-slate-text/60 mt-0.5">
                          {inv.planName || "—"} · {inv.durationPeriods || 1} {(inv.durationPeriods || 1) === 1 ? "month" : "months"} · {fmtDate(inv.createdAt)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-semibold text-ink">{fmtMoney(inv.totalAmount || inv.amount)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          className="p-1.5 rounded-lg hover:bg-paper text-slate-text/60 hover:text-ink"
                          title="View"
                          onClick={() => { setShowInvoicesList(false); openViewInvoice(inv._id); }}
                        >
                          <Eye size={15} />
                        </button>
                        {["paid", "issued"].includes(inv.status) && (
                          <button
                            className="p-1.5 rounded-lg hover:bg-paper text-slate-text/60 hover:text-ink"
                            title="Download PDF"
                            onClick={() => downloadInvoicePdf(inv._id)}
                          >
                            <Download size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {invoicesPages > 1 && (
              <div className="px-6 py-3 border-t border-black/[0.06] flex items-center justify-between shrink-0">
                <span className="text-[12px] text-slate-text/60">
                  Page {invoicesPage} of {invoicesPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="!text-[12px] !px-3 !py-1"
                    onClick={() => fetchInvoicesList(invoicesPage - 1, invoicesSearch, invoicesStatusFilter)}
                    disabled={invoicesPage <= 1}
                  >
                    <ChevronLeft size={14} /> Prev
                  </Button>
                  <Button
                    variant="outline"
                    className="!text-[12px] !px-3 !py-1"
                    onClick={() => fetchInvoicesList(invoicesPage + 1, invoicesSearch, invoicesStatusFilter)}
                    disabled={invoicesPage >= invoicesPages}
                  >
                    Next <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
