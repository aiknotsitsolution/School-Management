import { useCallback, useEffect, useState } from "react";
import {
  Ban,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Pause,
  Play,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { Button, Card, Input, PageIntro, Pill, Select, toast } from "../components/UI";

const STATUS_TONES = {
  trialing: "info",
  active: "success",
  past_due: "amber",
  suspended: "neutral",
  cancelled: "alert",
  expired: "neutral",
};

const fmtMoney = (amount, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount ?? 0);

const fmtDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function Subscriptions() {
  const [rows, setRows] = useState([]);
  const [plans, setPlans] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [filters, setFilters] = useState({ q: "", status: "", plan: "", expiringWithin: "" });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ planId: "", days: 7 });

  const load = useCallback(
    (override) => {
      const params = new URLSearchParams();
      const f = { ...filters, ...(override || {}) };
      if (f.q) params.set("q", f.q);
      if (f.status) params.set("status", f.status);
      if (f.plan) params.set("plan", f.plan);
      if (f.expiringWithin) params.set("expiringWithin", f.expiringWithin);
      params.set("page", String(page));
      setLoading(true);
      api.subscriptions
        .list(params.toString())
        .then(({ data, total: t, pages: p }) => {
          setRows(data || []);
          setTotal(t ?? 0);
          setPages(p ?? 0);
        })
        .catch((err) => toast(err.message, "error"))
        .finally(() => setLoading(false));
    },
    [filters, page],
  );

  useEffect(() => {
    api.plans
      .list()
      .then(({ data }) => setPlans(data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (id) => {
    setSelected(id);
    setDetail(null);
    setDetailLoading(true);
    setForm({ planId: "", days: 7 });
    try {
      const res = await api.subscriptions.get(id);
      setDetail(res.data);
      if (res.data.history?.[0]) {
        setForm((prev) => ({ ...prev, planId: res.data.history[0].plan?._id || "" }));
      }
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const runAction = async (action, extra = {}) => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.subscriptions.act(selected, action, extra);
      toast(`Subscription ${action.replace(/[A-Z]/g, (c) => " " + c.toLowerCase())}`);
      openDetail(selected);
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const generateInvoice = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.billing.invoices.generate(selected);
      toast("Invoice generated");
      openDetail(selected);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const topStat = (sub) =>
    sub.status === "trialing" ? `Trial ends ${fmtDate(sub.trialEndDate)}` : `Next billing ${fmtDate(sub.nextBillingDate)}`;

  return (
    <div className="max-w-6xl">
      <PageIntro
        eyebrow="Platform Owner · Billing"
        title="Subscriptions"
        description="Every tenant school has exactly one current subscription. Plan changes supersede the old one and auto-generate an invoice."
      />

      <div className="flex items-center gap-2 mb-4">
        <span className="text-[12.5px] font-semibold text-slate-text/70">Expiring:</span>
        {[
          { days: 7, label: "Next 7 days" },
          { days: 15, label: "Next 15 days" },
          { days: 30, label: "Next 30 days" },
        ].map((bucket) => {
          const active = filters.expiringWithin === String(bucket.days);
          return (
            <button
              key={bucket.days}
              onClick={() => {
                setFilters({ ...filters, expiringWithin: active ? "" : String(bucket.days), status: "" });
                setPage(1);
              }}
              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-colors ${
                active
                  ? "bg-alert text-white"
                  : "bg-white text-ink border border-black/10 hover:bg-paper"
              }`}
            >
              {bucket.label}
            </button>
          );
        })}
        {filters.expiringWithin && (
          <button
            onClick={() => {
              setFilters({ ...filters, expiringWithin: "" });
              setPage(1);
            }}
            className="text-[12px] font-semibold text-slate-text/60 hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>

      <Card className="mb-5" bodyClassName="p-4">
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            load();
          }}
        >
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/50" />
            <Input
              className="w-full pl-9"
              placeholder="Search school name or code…"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          </div>
          <Select
            className="w-40"
            value={filters.status}
            onChange={(e) => {
              setFilters({ ...filters, status: e.target.value });
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {Object.keys(STATUS_TONES).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <Select
            className="w-44"
            value={filters.plan}
            onChange={(e) => {
              setFilters({ ...filters, plan: e.target.value });
              setPage(1);
            }}
          >
            <option value="">All plans</option>
            {plans.map((p) => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </Select>
          <Button variant="amber" type="submit">Apply</Button>
        </form>
      </Card>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card title={`Current subscriptions (${total})`} className="lg:col-span-2" bodyClassName="p-0">
          {loading ? (
            <p className="p-6 text-[13px] text-slate-text/70">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-[13px] text-slate-text/70">No subscriptions match.</p>
          ) : (
            <div className="divide-y divide-black/[0.05]">
              {rows.map((sub) => (
                <button
                  key={sub._id}
                  onClick={() => openDetail(sub._id)}
                  className={`w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-paper transition-colors ${
                    selected === sub._id ? "bg-amber/10" : ""
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-ink text-amber flex items-center justify-center shrink-0">
                    <CreditCard size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-ink truncate">
                      {sub.school?.name || "—"}
                    </p>
                    <p className="text-[11.5px] text-slate-text/70">
                      {sub.school?.code} · {sub.plan?.name || "—"} · {fmtMoney(sub.price, sub.currency)}/{sub.billingCycle}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Pill tone={STATUS_TONES[sub.status] || "neutral"}>{sub.status}</Pill>
                    <p className="text-[10.5px] text-slate-text/55 mt-1">{topStat(sub)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-black/[0.06]">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft size={15} /> Prev
              </Button>
              <span className="text-[12.5px] text-slate-text/70">Page {page} of {pages}</span>
              <Button variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next <ChevronRight size={15} />
              </Button>
            </div>
          )}
        </Card>

        <Card
          title={detail ? "Subscription detail" : "Manage subscription"}
          className="lg:col-span-1"
          action={
            detail && (
              <button onClick={() => setSelected(null)} className="text-slate-text/60 hover:text-ink">
                <X size={18} />
              </button>
            )
          }
        >
          {!selected ? (
            <p className="text-[13px] text-slate-text/70 leading-relaxed">
              Select a subscription to change its plan, extend the trial,
              suspend, reactivate, or cancel — and see its invoice history.
            </p>
          ) : detailLoading ? (
            <p className="text-[13px] text-slate-text/70">Loading…</p>
          ) : detail ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[14px] font-semibold text-ink">{detail.school?.name}</p>
                  <p className="text-[11.5px] text-slate-text/70">{detail.school?.code}</p>
                </div>
                <Pill tone={STATUS_TONES[detail.status] || "neutral"}>{detail.status}</Pill>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  ["Plan", detail.plan?.name || "—"],
                  ["Amount", `${fmtMoney(detail.price, detail.currency)}/${detail.billingCycle}`],
                  ["Started", fmtDate(detail.startDate)],
                  ["Trial end", fmtDate(detail.trialEndDate)],
                  ["Next billing", fmtDate(detail.nextBillingDate)],
                  ["Period", `${fmtDate(detail.currentPeriodStart)} → ${fmtDate(detail.currentPeriodEnd)}`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-paper px-3 py-2">
                    <p className="text-[10.5px] font-semibold text-slate-text/60 uppercase tracking-wide">{label}</p>
                    <p className="text-[12.5px] font-semibold text-ink mt-0.5 truncate">{value}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3 border-t border-black/[0.06] pt-4">
                <p className="text-[12px] font-semibold text-slate-text">Actions</p>
                <div className="flex items-center gap-2">
                  <Select
                    className="flex-1"
                    value={form.planId}
                    onChange={(e) => setForm({ ...form, planId: e.target.value })}
                  >
                    <option value="">Change plan…</option>
                    {plans
                      .filter((p) => p.isActive)
                      .map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} · {fmtMoney(p.price, p.currency)}/{p.billingCycle}
                        </option>
                      ))}
                  </Select>
                  <Button
                    variant="outline"
                    disabled={!form.planId || busy}
                    onClick={() => form.planId && runAction("changePlan", { planId: form.planId })}
                    title="Change plan (supersedes current, generates invoice)"
                  >
                    <RefreshCcw size={14} />
                  </Button>
                </div>

                {detail.status === "trialing" && (
                  <div className="flex items-center gap-2">
                    <Input
                      className="w-20"
                      type="number"
                      min="1"
                      value={form.days}
                      onChange={(e) => setForm({ ...form, days: e.target.value })}
                    />
                    <span className="text-[12px] text-slate-text/70">days</span>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => runAction("extendTrial", { days: Number(form.days) })}
                    >
                      <CalendarPlus size={14} /> Extend trial
                    </Button>
                  </div>
                )}

                {(detail.status === "suspended" || detail.status === "cancelled" || detail.status === "expired") && (
                  <Button variant="amber" className="w-full justify-center" disabled={busy} onClick={() => runAction("reactivate")}>
                    <Play size={14} /> Reactivate
                  </Button>
                )}
                {["trialing", "active", "past_due"].includes(detail.status) && (
                  <Button variant="outline" className="w-full justify-center" disabled={busy} onClick={() => runAction("suspend")}>
                    <Pause size={14} /> Suspend
                  </Button>
                )}
                {!["cancelled", "expired"].includes(detail.status) && (
                  <Button variant="outline" className="w-full justify-center" disabled={busy} onClick={() => runAction("cancel")}>
                    <Ban size={14} /> Cancel subscription
                  </Button>
                )}
                <Button variant="ghost" className="w-full justify-center" disabled={busy} onClick={generateInvoice}>
                  <CreditCard size={14} /> Generate invoice
                </Button>
              </div>

              <div className="border-t border-black/[0.06] pt-4">
                <p className="text-[12px] font-semibold text-slate-text mb-2">
                  Invoices ({detail.invoices?.length || 0})
                </p>
                {detail.invoices?.length === 0 ? (
                  <p className="text-[12.5px] text-slate-text/70">No invoices yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {detail.invoices.slice(0, 5).map((inv) => (
                      <div key={inv._id} className="flex items-center gap-2 rounded-lg bg-paper px-3 py-2 text-[12.5px]">
                        <Pill tone={STATUS_TONES[inv.status] || "neutral"}>{inv.status}</Pill>
                        <span className="font-mono text-slate-text/80 truncate">{inv.invoiceNumber}</span>
                        <span className="ml-auto font-semibold text-ink">{fmtMoney(inv.amount, inv.currency)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-black/[0.06] pt-4">
                <p className="text-[12px] font-semibold text-slate-text mb-2">
                  History ({detail.history?.length || 0})
                </p>
                <div className="space-y-1.5">
                  {detail.history?.slice(0, 5).map((h) => (
                    <div key={h._id} className="flex items-center gap-2 rounded-lg bg-paper px-3 py-2 text-[12.5px]">
                      <Pill tone={STATUS_TONES[h.status] || "neutral"}>{h.status}</Pill>
                      <span className="truncate text-slate-text/80">{h.plan?.name || "—"}</span>
                      <span className="ml-auto text-slate-text/60">{fmtDate(h.startDate)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}