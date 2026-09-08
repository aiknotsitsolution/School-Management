import { useEffect, useMemo, useState } from "react";
import { Search, Receipt, Plus, Wallet, DollarSign, X } from "lucide-react";
import {
  PageIntro,
  Card,
  Input,
  Select,
  Button,
  Pill,
  StatCard,
  toast,
} from "../../components/UI";
import { api } from "../../lib/api";
import useStaffContext, { fmtMoney, fmtDate } from "./useStaffContext";

const TABS = ["Invoices", "Fee Structure"];

export default function Fees() {
  const [tab, setTab] = useState("Invoices");
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [structures, setStructures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [collect, setCollect] = useState(null);
  const [showStructureForm, setShowStructureForm] = useState(false);

  const refresh = () => {
    setLoading(true);
    Promise.allSettled([
      api.fees.invoices.list(),
      api.fees.payments.list(),
      api.fees.structures.list(),
    ])
      .then(([i, p, s]) => {
        setInvoices(i.status === "fulfilled" ? i.value.data || [] : []);
        setPayments(p.status === "fulfilled" ? p.value.data || [] : []);
        setStructures(s.status === "fulfilled" ? s.value.data || [] : []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const list = useMemo(() => {
    const q = search.toLowerCase();
    return (invoices || [])
      .filter((i) => !statusFilter || i.status === statusFilter)
      .filter(
        (i) =>
          !q ||
          (i.studentId || "").toLowerCase().includes(q) ||
          (i.feeType || "").toLowerCase().includes(q) ||
          (String(i.class || "").toLowerCase().includes(q)),
      )
      .sort((a, b) => (a.status === "Paid" ? 1 : -1) - (b.status === "Paid" ? 1 : -1));
  }, [invoices, statusFilter, search]);

  const handleCollect = async () => {
    try {
      await api.fees.payments.create(collect);
      toast("Payment recorded", "success");
      setCollect(null);
      refresh();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const handleStructure = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.fees.structures.create({
        class: fd.get("class"),
        session: fd.get("session"),
        feeType: fd.get("feeType"),
        amount: Number(fd.get("amount")),
        frequency: fd.get("frequency"),
        dueDate: fd.get("dueDate") || null,
      });
      toast("Fee structure created", "success");
      setShowStructureForm(false);
      refresh();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const handleDeleteStructure = async (id) => {
    try {
      await api.fees.structures.remove(id);
      toast("Fee structure removed", "success");
      refresh();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Accountant Workspace"
        title="Manage Fees"
        description="Invoices, collection and fee structures."
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
              tab === t ? "bg-ink text-white" : "bg-white text-slate-text hover:bg-paper border border-black/[0.06]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Invoices" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Receipt} label="Invoices" value={String(invoices.length)} accent="info" />
            <StatCard icon={Wallet} label="Collected" value={fmtMoney(payments.reduce((s, p) => s + Number(p.amount || 0), 0))} accent="success" />
            <StatCard icon={DollarSign} label="Unpaid" value={String(invoices.filter((i) => i.status !== "Paid").length)} accent="alert" />
            <StatCard icon={Wallet} label="Outstanding ₹" value={fmtMoney(invoices.filter((i) => i.status !== "Paid").reduce((s, i) => s + (Number(i.amount || 0) - Number(i.paidAmount || 0)), 0))} accent="amber" />
          </div>

          <Card
            title="Invoices"
            action={
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40" />
                  <Input placeholder="Search admission no / fee…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-52" />
                </div>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36">
                  <option value="">All statuses</option>
                  {["Unpaid", "Partial", "Paid", "Overdue"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </div>
            }
          >
            {loading ? (
              <p className="text-[13px] text-slate-text py-10 text-center">Loading invoices…</p>
            ) : list.length === 0 ? (
              <p className="text-[13px] text-slate-text py-10 text-center">No invoices yet.</p>
            ) : (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                      <th className="px-5 py-2 font-semibold">Student</th>
                      <th className="px-3 py-2 font-semibold">Class</th>
                      <th className="px-3 py-2 font-semibold">Fee Type</th>
                      <th className="px-3 py-2 font-semibold">Amount</th>
                      <th className="px-3 py-2 font-semibold">Paid</th>
                      <th className="px-3 py-2 font-semibold">Due</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold text-right">Collect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((i) => {
                      const due = Number(i.amount || 0) - Number(i.paidAmount || 0);
                      return (
                        <tr key={i._id} className="border-t border-black/[0.06] hover:bg-paper/60">
                          <td className="px-5 py-2.5 font-semibold text-ink">{i.studentId || "—"}</td>
                          <td className="px-3 py-2.5">Class {i.class || "—"}</td>
                          <td className="px-3 py-2.5">{i.feeType || "—"}</td>
                          <td className="px-3 py-2.5">{fmtMoney(i.amount)}</td>
                          <td className="px-3 py-2.5 text-success font-semibold">{fmtMoney(i.paidAmount || 0)}</td>
                          <td className="px-3 py-2.5">{fmtMoney(due)}</td>
                          <td className="px-3 py-2.5">
                            <Pill tone={i.status === "Paid" ? "success" : i.status === "Overdue" ? "alert" : i.status === "Partial" ? "amber" : "neutral"}>{i.status}</Pill>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {i.status !== "Paid" ? (
                              <button onClick={() => setCollect({ invoiceId: i._id, studentId: i.studentId, amount: due, mode: "Cash", transactionId: "" })} className="text-[12px] font-semibold text-info hover:underline">
                                Collect
                              </button>
                            ) : (
                              <span className="text-[12px] text-slate-text/50">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === "Fee Structure" && (
        <Card
          title="Fee Structures"
          bodyClassName="p-0"
          action={
            <Button variant="amber" onClick={() => setShowStructureForm((v) => !v)}>
              <Plus size={15} /> Add Structure
            </Button>
          }
        >
          {showStructureForm && (
            <form onSubmit={handleStructure} className="p-5 border-b border-black/[0.06] grid sm:grid-cols-3 gap-3">
              <Input name="class" placeholder="Class (e.g. 6)" required />
              <Input name="session" placeholder="Session (e.g. 2026-27)" required />
              <Input name="feeType" placeholder="Fee type (e.g. Tuition)" required />
              <Input name="amount" type="number" placeholder="Amount" required />
              <Select name="frequency" defaultValue="Quarterly">
                {["Monthly", "Quarterly", "Annually", "One-time"].map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </Select>
              <Input name="dueDate" type="date" />
              <div className="sm:col-span-3 flex justify-end">
                <Button type="submit">Save Structure</Button>
              </div>
            </form>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                  <th className="px-5 py-2 font-semibold">Class</th>
                  <th className="px-3 py-2 font-semibold">Session</th>
                  <th className="px-3 py-2 font-semibold">Fee Type</th>
                  <th className="px-3 py-2 font-semibold">Amount</th>
                  <th className="px-3 py-2 font-semibold">Frequency</th>
                  <th className="px-3 py-2 font-semibold">Due Date</th>
                  <th className="px-3 py-2 font-semibold text-right"></th>
                </tr>
              </thead>
              <tbody>
                {(structures || []).map((s) => (
                  <tr key={s._id} className="border-t border-black/[0.06]">
                    <td className="px-5 py-2.5 font-semibold text-ink">Class {s.class}</td>
                    <td className="px-3 py-2.5">{s.session}</td>
                    <td className="px-3 py-2.5">{s.feeType}</td>
                    <td className="px-3 py-2.5">{fmtMoney(s.amount)}</td>
                    <td className="px-3 py-2.5"><Pill tone="neutral">{s.frequency}</Pill></td>
                    <td className="px-3 py-2.5">{fmtDate(s.dueDate)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => handleDeleteStructure(s._id)} className="text-alert hover:underline text-[12px] font-semibold">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {collect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setCollect(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-ink text-[17px]">Collect Payment</h3>
              <button onClick={() => setCollect(null)} className="p-2 rounded-lg hover:bg-paper text-slate-text"><X size={18} /></button>
            </div>
            <p className="text-[13px] text-slate-text">Student <b className="text-ink">{collect.studentId || "—"}</b></p>
            <label className="block text-[12px] font-semibold text-slate-text/70">Amount (₹)</label>
            <Input type="number" value={collect.amount} onChange={(e) => setCollect({ ...collect, amount: Number(e.target.value) })} />
            <label className="block text-[12px] font-semibold text-slate-text/70">Mode</label>
            <Select value={collect.mode} onChange={(e) => setCollect({ ...collect, mode: e.target.value })}>
              {["Cash", "Card", "UPI", "Net Banking", "Cheque"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
            <label className="block text-[12px] font-semibold text-slate-text/70">Transaction ID (optional)</label>
            <Input value={collect.transactionId} onChange={(e) => setCollect({ ...collect, transactionId: e.target.value })} placeholder="UPI/ref no." />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCollect(null)}>Cancel</Button>
              <Button onClick={handleCollect}>Record Payment</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}