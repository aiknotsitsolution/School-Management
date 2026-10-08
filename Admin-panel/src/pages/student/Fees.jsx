import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, Wallet, FileClock, Download } from "lucide-react";
import { PageIntro, Card, Pill, toast } from "../../components/UI";
import {
  BarRowChart,
  Donut,
  ProgressRing,
  Sparkline,
} from "../../components/studentcharts/StudentCharts";
import { api } from "../../lib/api";
import { fmtDate, fmtMoney } from "./useStudentContext";

export default function Fees() {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.fees.invoices.list(),
      api.fees.payments.list(),
      api.fees.orders.list(),
      // One-place statement: yearly package vs billed vs collected vs balance.
      api.fees.plans.summary("me"),
    ]).then(([i, p, o, s]) => {
      setInvoices(i.status === "fulfilled" ? (i.value.data || []) : []);
      setPayments(p.status === "fulfilled" ? (p.value.data || []) : []);
      setOrders(o.status === "fulfilled" ? (o.value.data || []) : []);
      setSummary(s.status === "fulfilled" ? s.value.data || null : null);
      setLoading(false);
    });
  }, []);

  const totals = useMemo(() => {
    const total = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
    const paid = invoices.reduce((s, i) => s + Number(i.paidAmount || 0), 0);
    return { total, paid, due: Math.max(0, total - paid) };
  }, [invoices]);

  const sortedInvoices = useMemo(
    () => [...invoices].sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")),
    [invoices],
  );

  const sortedPayments = useMemo(
    () => [...payments].sort((a, b) => (a.paymentDate || a.createdAt || "") < (b.paymentDate || b.createdAt || "") ? 1 : -1),
    [payments],
  );

  // The receipt is the student's own proof of payment, so they download it
  // straight from their history instead of asking the office for a copy.
  const downloadReceipt = async (receiptNo) => {
    try {
      await api.fees.payments.downloadReceiptPdf(receiptNo);
      toast("Receipt PDF downloaded", "success");
    } catch (err) {
      toast(err.message || "Download failed", "error");
    }
  };

  /** How much of each invoice is settled, for the per-invoice bar chart. */
  const invoiceBars = useMemo(
    () =>
      sortedInvoices.map((inv) => {
        const amount = Number(inv.amount || 0);
        const paid = Number(inv.paidAmount || 0);
        return {
          id: inv._id,
          label: inv.feeType || inv.title || "Invoice",
          value: amount ? Math.round((paid / amount) * 100) : 0,
          obtained: paid,
          maxMarks: amount,
          paid,
          amount,
        };
      }),
    [sortedInvoices],
  );

  /** Paid vs pending split, coloured so the balance is readable at a glance. */
  const paymentSplit = useMemo(() => {
    const list = [
      { name: "Paid", value: totals.paid, color: "success" },
      { name: "Pending", value: totals.due, color: "warning" },
    ];
    return list.filter((d) => d.value > 0);
  }, [totals]);

  const paidShare = totals.total ? Math.round((totals.paid / totals.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Finance"
        title="Fees & Payments"
        art="fees"
        description="Your fee invoices and payment history."
      />

      {/* Yearly package: what was fixed at admission vs what is billed,
          collected and still due — the single place for the money story. */}
      <Card
        title={`Yearly Fee Package${summary?.plan ? ` · ${summary.plan.session}` : ""}`}
        subtitle="Annual fees fixed at admission, head-wise"
      >
        {!summary ? (
          <p className="py-6 text-center text-[13px] text-slate-text/70">
            {loading ? "Loading…" : "No fee package on record yet — the school office sets it up at admission."}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-paper/60 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
                  Package (Year)
                </p>
                <p className="mt-1 font-display text-xl font-bold text-ink">
                  {summary.totals.planned === null ? "—" : fmtMoney(summary.totals.planned)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-paper/60 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
                  Invoiced
                </p>
                <p className="mt-1 font-display text-xl font-bold text-ink">
                  {fmtMoney(summary.totals.invoiced)}
                </p>
              </div>
              <div className="rounded-xl border border-success/30 bg-success/5 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
                  Collected
                </p>
                <p className="mt-1 font-display text-xl font-bold text-success">
                  {fmtMoney(summary.totals.collected)}
                </p>
              </div>
              <div
                className={`rounded-xl border p-3 ${
                  summary.totals.outstanding > 0
                    ? "border-alert/30 bg-alert/5"
                    : "border-success/30 bg-success/5"
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
                  Balance Due
                </p>
                <p
                  className={`mt-1 font-display text-xl font-bold ${
                    summary.totals.outstanding > 0 ? "text-alert" : "text-success"
                  }`}
                >
                  {fmtMoney(summary.totals.outstanding)}
                </p>
              </div>
            </div>

            {summary.headwise.length > 0 ? (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-text/50">
                      <th className="px-5 py-2 font-semibold">Fee Head</th>
                      <th className="px-3 py-2 text-right font-semibold">Annual Fee</th>
                      <th className="px-3 py-2 text-right font-semibold">Invoiced</th>
                      <th className="px-3 py-2 text-right font-semibold">Paid</th>
                      <th className="px-5 py-2 text-right font-semibold">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.headwise.map((row) => (
                      <tr key={row.feeType} className="border-t border-slate-200">
                        <td className="px-5 py-2.5 font-medium text-ink">{row.feeType}</td>
                        <td className="px-3 py-2.5 text-right text-slate-text/80">
                          {row.planned ? fmtMoney(row.planned) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-text/80">
                          {fmtMoney(row.invoiced)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-success">
                          {fmtMoney(row.paid)}
                        </td>
                        <td
                          className={`px-5 py-2.5 text-right font-semibold ${
                            row.balance > 0 ? "text-alert" : "text-success"
                          }`}
                        >
                          {fmtMoney(row.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[13px] text-slate-text/70">
                No fee heads in your package yet.
              </p>
            )}

            {summary.concessions.length > 0 && (
              <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-3.5 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[12.5px] font-semibold text-violet-800">
                    Concession applied
                  </span>
                  {summary.totals.concession > 0 && (
                    <span className="text-[12.5px] font-semibold text-violet-800">
                      − {fmtMoney(summary.totals.concession)}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] text-violet-700/80">
                  {/* The Kind is the name, so echoing both would read
                      "SC Concession · SC". */}
                  {summary.concessions
                    .map(
                      (c) =>
                        `${c.name || c.kind}` +
                        ` · ${c.type === "percent" ? `${c.value}%` : fmtMoney(c.value)}`,
                    )
                    .join(", ")}
                </p>
                <p className="mt-1 text-[11.5px] text-violet-700/70">
                  Already adjusted into every amount on this page.
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="flex flex-col items-center gap-3 py-2">
            <ProgressRing
              value={paidShare}
              size={150}
              stroke={13}
              color={totals.due > 0 ? "warning" : "success"}
              label="Settled"
              sublabel={`of ${fmtMoney(totals.total)}`}
              ariaLabel={`${paidShare} percent of fees settled`}
            />
            {paymentSplit.length > 0 && (
              <Donut data={paymentSplit} height={124} centerValue={invoices.length} centerLabel="Invoices" />
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2" title="Settlement by Invoice" subtitle="How much of each invoice is paid">
          <BarRowChart
            data={invoiceBars}
            height={Math.max(170, invoiceBars.length * 36)}
            color="success"
            colorFor={(d) => (d.value >= 100 ? "success" : d.value > 0 ? "warning" : "alert")}
            tooltipLabel="Paid"
            footerFor={(d) => `${fmtMoney(d.paid)} of ${fmtMoney(d.amount)}`}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <div className="p-1">
            <p className="font-display text-3xl font-bold text-ink">{fmtMoney(totals.due)}</p>
            <p className="text-[11px] text-slate-text/60 mt-1">Outstanding balance</p>
          </div>
        </Card>
        <Card>
          <p className="font-display text-xl font-bold text-success">{fmtMoney(totals.paid)}</p>
          <p className="text-[11px] text-slate-text/60 mt-1">Paid</p>
        </Card>
        <Card>
          <p className="font-display text-xl font-bold text-ink">{fmtMoney(totals.total)}</p>
          <p className="text-[11px] text-slate-text/60 mt-1">Total invoiced</p>
        </Card>
        <Card>
          <p className="text-[11px] font-semibold text-slate-text/60">Receipts</p>
          <p className="mt-1.5 font-display text-xl font-bold text-ink">{payments.length}</p>
          <div className="mt-2">
            <Sparkline data={sortedPayments.slice(0, 8).reverse().map((p) => ({ value: Number(p.amount) || 0 }))} color="success" height={26} />
          </div>
        </Card>
      </div>

      <Card title={`Invoices (${invoices.length})`}>
        {loading ? (
          <p className="text-[13px] text-slate-text py-10 text-center">Loading…</p>
        ) : sortedInvoices.length === 0 ? (
          <div className="py-10 text-center">
            <CreditCard size={40} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[15px] font-semibold text-ink">No invoices yet</p>
            <p className="text-[13px] text-slate-text/70 mt-1">Your fee invoices will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                  <th className="px-5 py-2 font-semibold">Fee Head</th>
                  <th className="px-3 py-2 font-semibold">Due Date</th>
                  <th className="px-3 py-2 font-semibold">Amount</th>
                  <th className="px-3 py-2 font-semibold">Paid</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedInvoices.map((inv) => {
                  const remaining = Number(inv.amount || 0) - Number(inv.paidAmount || 0);
                  const status = inv.status || (remaining <= 0 ? "Paid" : "Pending");
                  return (
                    <tr key={inv._id} className="border-t border-slate-200">
                      <td className="px-5 py-2.5 font-medium text-ink">
                        {inv.feeType || inv.title || "Fee invoice"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-text/80">{fmtDate(inv.dueDate || inv.createdAt)}</td>
                      <td className="px-3 py-2.5 font-semibold text-ink">
                        {fmtMoney(inv.amount || 0)}
                        {Number(inv.concessionAmount || 0) > 0 && (
                          <>
                            <span className="ml-1.5 text-[11px] font-medium text-slate-text/45 line-through">
                              {fmtMoney(inv.grossAmount || inv.amount)}
                            </span>
                            <span className="ml-1.5 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 whitespace-nowrap">
                              −{fmtMoney(inv.concessionAmount)}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-success">{fmtMoney(inv.paidAmount || 0)}</td>
                      <td className="px-3 py-2.5">
                        <Pill tone={String(status).toLowerCase().includes("paid") ? "success" : "alert"}>{status}</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Payment History (${payments.length})`}>
        {sortedPayments.length === 0 ? (
          <p className="text-[13px] text-slate-text py-6 text-center">No payments recorded.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                  <th className="px-5 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Amount</th>
                  <th className="px-3 py-2 font-semibold">Txn / Receipt</th>
                  <th className="px-5 py-2 font-semibold">Mode</th>
                  <th className="px-5 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPayments.map((p) => (
                  <tr key={p._id || p.receiptNo} className="border-t border-slate-200">
                    <td className="px-5 py-2.5">{fmtDate(p.paidOn || p.paymentDate || p.createdAt)}</td>
                    <td className="px-3 py-2.5 font-semibold text-success">{fmtMoney(p.amount || 0)}</td>
                    <td className="px-3 py-2.5 text-slate-text/80">
                      {p.receiptNo || p.transactionId || p.invoiceId || "—"}
                      {p.receiptNo && (
                        <span
                          className={`ml-2 rounded px-1 py-px text-[10px] font-semibold uppercase ${
                            p.receiptMode === "manual"
                              ? "bg-primary/10 text-primary"
                              : "bg-slate-100 text-slate-text/70"
                          }`}
                        >
                          {p.receiptMode === "manual" ? "manual" : "auto"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-slate-text/80">
                      {p.mode || "Cash"}
                      {p.source === "online" && (
                        <span className="ml-2 rounded bg-success/10 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase text-success">
                          online
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right whitespace-nowrap">
                      {p.receiptNo ? (
                        <button
                          type="button"
                          onClick={() => downloadReceipt(p.receiptNo)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Download size={13} /> Receipt
                        </button>
                      ) : (
                        <span className="text-[11.5px] text-slate-text/50">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Payment Orders (${orders.length})`}>
        {orders.length === 0 ? (
          <p className="text-[13px] text-slate-text py-6 text-center">No open payment orders.</p>
        ) : (
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o._id} className="rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileClock size={15} className="text-slate-text/50 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-ink truncate">{o.externalRef}</p>
                    <p className="text-[11.5px] text-slate-text/60">₹{Number(o.amount || 0).toLocaleString("en-IN")} · {fmtDate(o.confirmedAt || o.createdAt)}</p>
                  </div>
                </div>
                <Pill tone={String(o.status).includes("complete") ? "success" : "alert"}>{o.status}</Pill>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12.5px] text-slate-text/80 flex items-center gap-2">
            <Wallet size={14} className="text-slate-text/50" />
            Pay online yourself, or at the school office and collect the receipt. Portal payments get an
            auto-generated receipt number; counter cash receipts use the office receipt book.
          </p>
          <Link
            to="/online-payment"
            className="shrink-0 whitespace-nowrap rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-[12px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            Pay Online
          </Link>
        </div>
      </Card>
    </div>
  );
}