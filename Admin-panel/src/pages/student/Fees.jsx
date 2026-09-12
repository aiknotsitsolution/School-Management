import { useEffect, useMemo, useState } from "react";
import { CreditCard, Wallet, FileClock } from "lucide-react";
import { PageIntro, Card, Pill } from "../../components/UI";
import { api } from "../../lib/api";
import { fmtDate, fmtMoney } from "./useStudentContext";

export default function Fees() {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.fees.invoices.list(),
      api.fees.payments.list(),
      api.fees.orders.list(),
    ]).then(([i, p, o]) => {
      setInvoices(i.status === "fulfilled" ? (i.value.data || []) : []);
      setPayments(p.status === "fulfilled" ? (p.value.data || []) : []);
      setOrders(o.status === "fulfilled" ? (o.value.data || []) : []);
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

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Finance"
        title="Fees & Payments"
        description="Your fee invoices and payment history."
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="col-span-1 sm:col-span-2">
          <div className="p-1">
            <p className="font-display text-3xl font-bold text-ink">{fmtMoney(totals.due)}</p>
            <p className="text-[11px] text-slate-text/60 mt-1">Outstanding balance</p>
          </div>
        </Card>
        <Card><p className="font-display text-xl font-bold text-success">{fmtMoney(totals.paid)}</p><p className="text-[11px] text-slate-text/60 mt-1">Paid</p></Card>
        <Card><p className="font-display text-xl font-bold text-ink">{fmtMoney(totals.total)}</p><p className="text-[11px] text-slate-text/60 mt-1">Total invoiced</p></Card>
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
                  <th className="px-5 py-2 font-semibold">Title</th>
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
                    <tr key={inv._id} className="border-t border-black/[0.06]">
                      <td className="px-5 py-2.5 font-medium text-ink">{inv.title}</td>
                      <td className="px-3 py-2.5 text-slate-text/80">{fmtDate(inv.dueDate || inv.createdAt)}</td>
                      <td className="px-3 py-2.5 font-semibold text-ink">{fmtMoney(inv.amount || 0)}</td>
                      <td className="px-3 py-2.5 text-success">{fmtMoney(inv.paidAmount || 0)}</td>
                      <td className="px-3 py-2.5">
                        <Pill tone={String(status).toLowerCase().includes("paid") ? "success" : "warning"}>{status}</Pill>
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
                </tr>
              </thead>
              <tbody>
                {sortedPayments.map((p) => (
                  <tr key={p._id || p.receiptNo} className="border-t border-black/[0.06]">
                    <td className="px-5 py-2.5">{fmtDate(p.paymentDate || p.createdAt)}</td>
                    <td className="px-3 py-2.5 font-semibold text-success">{fmtMoney(p.amount || 0)}</td>
                    <td className="px-3 py-2.5 text-slate-text/80">{p.receiptNo || p.transactionId || p.invoiceId || "—"}</td>
                    <td className="px-5 py-2.5 text-slate-text/80">{p.mode || "Cash"}</td>
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
              <div key={o._id} className="rounded-xl border border-black/[0.06] p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileClock size={15} className="text-slate-text/50 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-ink truncate">{o.externalRef}</p>
                    <p className="text-[11.5px] text-slate-text/60">₹{Number(o.amount || 0).toLocaleString("en-IN")} · {fmtDate(o.confirmedAt || o.createdAt)}</p>
                  </div>
                </div>
                <Pill tone={String(o.status).includes("complete") ? "success" : "warning"}>{o.status}</Pill>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <p className="text-[12.5px] text-slate-text/80 flex items-center gap-2">
          <Wallet size={14} className="text-slate-text/50" />
          Payments are confirmed by the school's payment gateway once configured. Until then, pay at the school office and keep your receipt.
        </p>
      </Card>
    </div>
  );
}