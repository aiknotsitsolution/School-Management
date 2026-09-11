import { useEffect, useState } from "react";
import { Check, CreditCard, Gauge, Zap } from "lucide-react";
import { api } from "../lib/api";
import { Button, Card, PageIntro, Pill, toast } from "../components/UI";
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

  useEffect(() => {
    let active = true;
    Promise.all([api.subscription.me(), api.subscription.plans(), api.subscription.usage()])
      .then(([subRes, plansRes, usageRes]) => {
        if (!active) return;
        setSub(subRes.data || null);
        setPlans(plansRes.data || []);
        setUsage(usageRes.data || null);
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

  const refresh = async () => {
    try {
      const [subRes, plansRes, usageRes] = await Promise.all([
        api.subscription.me(),
        api.subscription.plans(),
        api.subscription.usage(),
      ]);
      setSub(subRes.data || null);
      setPlans(plansRes.data || []);
      setUsage(usageRes.data || null);
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const upgrade = async (plan) => {
    if (busyId) return;
    setBusyId(plan._id);
    setNotice("");
    try {
      const res = await api.subscription.upgrade(plan._id);

      if (res.data?.requiresPayment) {
        const { id, providerOrderId, checkout } = res.data;
        if (checkout?.keyId && providerOrderId) {
          const payload = await openRazorpayCheckout({
            keyId: checkout.keyId,
            orderId: providerOrderId,
            amount: checkout.amount,
            currency: checkout.currency,
            name: "School ERP",
            description: `Upgrade to ${plan.name}`,
          });
          await api.payments.orders.confirm(id, payload);
          toast("Payment confirmed — your plan has been switched", "success");
        } else {
          setNotice(
            "A payment was initiated but the gateway is not fully configured. Please complete the payment at the platform office.",
          );
        }
        await refresh();
      } else {
        setSub(res.data || null);
        toast(res.message || "Plan upgraded", "success");
      }
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusyId("");
    }
  };

  const currentPlan = plans.find((p) => String(p._id) === String(sub?.plan?._id)) || null;

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

      <Card title="Current plan" bodyClassName="p-5">
        {sub ? (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-display font-bold text-ink">{sub.plan?.name || "—"}</p>
                  <p className="text-[11.5px] font-mono text-slate-text/60">{sub.plan?.code}</p>
                </div>
                <Pill tone={STATUS_TONES[sub.status] || "neutral"}>{sub.status}</Pill>
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
                <div className="rounded-lg bg-paper px-3 py-2">
                  <p className="text-[11px] font-semibold text-slate-text/60 uppercase tracking-wide">Trial ends</p>
                  <p className="text-[13px] font-medium text-ink mt-0.5">{fmtDate(sub.trialEndDate)}</p>
                </div>
                <div className="rounded-lg bg-paper px-3 py-2">
                  <p className="text-[11px] font-semibold text-slate-text/60 uppercase tracking-wide">Period ends</p>
                  <p className="text-[13px] font-medium text-ink mt-0.5">{fmtDate(sub.currentPeriodEnd)}</p>
                </div>
                <div className="rounded-lg bg-paper px-3 py-2">
                  <p className="text-[11px] font-semibold text-slate-text/60 uppercase tracking-wide">Next billing</p>
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
                    {isCurrent && <Pill tone="success">Current</Pill>}
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-display font-bold text-ink">{fmtMoney(plan.price, plan.currency)}</span>
                    <span className="text-[12px] text-slate-text/60">/ {plan.billingCycle}</span>
                  </div>

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
                    <Button variant="amber" className="flex-1 justify-center" onClick={() => upgrade(plan)} disabled={!!busyId}>
                      <Zap size={14} /> {busyId === plan._id ? "Switching…" : "Switch to this plan"}
                    </Button>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}