import { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  TrendingUp,
  AlertCircle,
  Receipt,
  ArrowRight,
  ArrowDownCircle,
  CircleDollarSign,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageIntro, Card, StatCard, Pill, Button, toast } from "../../components/UI";
import { api } from "../../lib/api";
import useStaffContext, { fmtMoney, fmtDate, todayISO, dateOf } from "./useStaffContext";

export default function AccountantDashboard() {
  const { user, school, persona } = useStaffContext();
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.fees.payments.list(),
      api.fees.invoices.list(),
    ])
      .then(([p, i]) => {
        setPayments(p.status === "fulfilled" ? p.value.data || [] : []);
        setInvoices(i.status === "fulfilled" ? i.value.data || [] : []);
        if (p.status === "rejected") toast(p.value?.message, "error");
        if (i.status === "rejected") toast(i.value?.message, "error");
      })
      .finally(() => setLoading(false));
  }, []);

  const today = todayISO();
  const monthPrefix = today.slice(0, 7);

  const stats = useMemo(() => {
    const todayPaid = payments
      .filter((p) => dateOf(p.paidOn) === today)
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const monthPaid = payments
      .filter((p) => dateOf(p.paidOn).startsWith(monthPrefix))
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const due = invoices.filter((i) => i.status !== "Paid");
    const outstanding = due.reduce(
      (s, i) => s + (Number(i.amount || 0) - Number(i.paidAmount || 0)),
      0,
    );
    const byStatus = {}; 
    invoices.forEach((i) => { byStatus[i.status] = (byStatus[i.status] || 0) + 1; });
    const byMode = {};
    payments.forEach((p) => { byMode[p.mode] = (byMode[p.mode] || 0) + 1; });
    return {
      todayPaid, monthPaid, outstanding, dueCount: due.length,
      byStatus, byMode, totalCollected: payments.reduce((s, p) => s + Number(p.amount || 0), 0),
    };
  }, [payments, invoices, today, monthPrefix]);

  if (loading) {
    return <p className="text-[13px] text-slate-text py-10 text-center">Loading accountant dashboard…</p>;
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Accountant Workspace"
        title="Fees & Collections"
        description={`Track fee collections at ${school?.name || "your school"}.`}
        right={
          <Button variant="amber" onClick={() => navigate("/accountant/fees")}>
            Manage Fees <ArrowRight size={15} />
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Today's Collection" value={fmtMoney(stats.todayPaid)} sub="Payments logged today" accent="success" />
        <StatCard icon={CircleDollarSign} label="This Month" value={fmtMoney(stats.monthPaid)} sub={`${monthPrefix.slice(5, 7)}/2026 period`} accent="amber" />
        <StatCard icon={Wallet} label="Lifetime Collected" value={fmtMoney(stats.totalCollected)} sub={`${payments.length} transactions`} accent="info" />
        <StatCard icon={AlertCircle} label="Outstanding" value={fmtMoney(stats.outstanding)} sub={`${stats.dueCount} unpaid invoices`} accent="alert" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card title="Recent Transactions" className="lg:col-span-2">
          {payments.length === 0 ? (
            <p className="text-[13px] text-slate-text py-8 text-center">No payments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                    <th className="px-5 py-2 font-semibold">Student</th>
                    <th className="px-3 py-2 font-semibold">Amount</th>
                    <th className="px-3 py-2 font-semibold">Mode</th>
                    <th className="px-3 py-2 font-semibold">Receipt</th>
                    <th className="px-3 py-2 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.slice(0, 7).map((p) => (
                    <tr key={p._id} className="border-t border-black/[0.06]">
                      <td className="px-5 py-2.5 font-semibold text-ink">{p.studentId || "—"}</td>
                      <td className="px-3 py-2.5 text-success font-semibold">{fmtMoney(p.amount)}</td>
                      <td className="px-3 py-2.5"><Pill tone="neutral">{p.mode || "—"}</Pill></td>
                      <td className="px-3 py-2.5 text-slate-text/80">{p.receiptNo || "—"}</td>
                      <td className="px-3 py-2.5 text-slate-text/80">{fmtDate(p.paidOn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Invoice Status">
            <div className="space-y-3">
              {["Paid", "Partial", "Unpaid", "Overdue"].map((s) => (
                <div key={s} className="flex items-center justify-between">
                  <Pill tone={s === "Paid" ? "success" : s === "Overdue" ? "alert" : s === "Partial" ? "amber" : "neutral"}>{s}</Pill>
                  <span className="text-[13px] font-semibold text-ink">{stats.byStatus[s] || 0}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Payment Modes">
            {Object.keys(stats.byMode).length === 0 ? (
              <p className="text-[13px] text-slate-text py-6 text-center">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(stats.byMode).map(([mode, count]) => (
                  <div key={mode} className="flex items-center justify-between">
                    <span className="text-[13px] text-ink">{mode}</span>
                    <span className="text-[13px] font-semibold text-slate-text">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <button
          onClick={() => navigate("/accountant/fees")}
          className="flex items-center justify-between bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5 hover:border-info/40 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-info/10 text-info flex items-center justify-center"><Receipt size={19} /></div>
            <div>
              <p className="font-display font-semibold text-ink text-[15px]">Collect Payment</p>
              <p className="text-[12.5px] text-slate-text/70">Record a fee payment against an invoice</p>
            </div>
          </div>
          <ArrowDownCircle size={18} className="text-slate-text/40" />
        </button>
        <button
          onClick={() => navigate("/accountant/fees")}
          className="flex items-center justify-between bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5 hover:border-amber/40 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber/10 text-amber flex items-center justify-center"><Wallet size={19} /></div>
            <div>
              <p className="font-display font-semibold text-ink text-[15px]">Fee Structure</p>
              <p className="text-[12.5px] text-slate-text/70">Define or update fee types per class</p>
            </div>
          </div>
          <ArrowRight size={18} className="text-slate-text/40" />
        </button>
      </div>
    </div>
  );
}