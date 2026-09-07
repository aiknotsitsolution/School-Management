import { useEffect, useMemo, useState } from "react";
import useLocalStorage from "../hooks/useLocalStorage";
import { api } from "../lib/api";
import { PermissionGate } from "../lib/permissions";
import {
  Plus,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Receipt,
  X,
  Save,
  Search,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Input,
  Select,
  Pill,
  statusTone,
  StatCard,
} from "../components/UI";
const feeStructure = [];
const initialTransactions = [];

const MODES = [
  "Online — UPI",
  "Online — Card",
  "Online — Net Banking",
  "Cash",
  "Cheque",
  "Bank Transfer",
];
const STATUSES = ["All", "Success", "Pending Clearance", "Overdue"];
const TERMS = ["Term 1", "Term 2"];
const CLASSES = [
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 12",
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function todayForReceipt() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function emptyForm() {
  return {
    student: "",
    class: "Class 6",
    term: "Term 2",
    amount: feeStructure.reduce((a, f) => a + f.termAmount, 0),
    mode: "Online — UPI",
    date: todayISO(),
    status: "Success",
  };
}

export default function FeesCollection() {
  const [transactions, setTransactions] = useState(initialTransactions);
  useEffect(() => {
    api.fees.payments
      .list()
      .then(({ data }) => setTransactions(data || []))
      .catch(() => {});
  }, []);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);

  const totalTerm = useMemo(
    () => feeStructure.reduce((a, f) => a + f.termAmount, 0),
    [],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return transactions.filter((t) => {
      const matchStatus = statusFilter === "All" || t.status === statusFilter;
      const matchQuery =
        !q ||
        t.student.toLowerCase().includes(q) ||
        (t.receipt || "").toLowerCase().includes(q) ||
        (t.id || "").toLowerCase().includes(q) ||
        t.class.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [transactions, query, statusFilter]);

  const stats = useMemo(() => {
    const successful = transactions.filter(
      (t) => t.status === "Success" && t.amount > 0,
    );
    const collected = successful.reduce((a, t) => a + t.amount, 0);
    const overdue = transactions.filter((t) => t.status === "Overdue").length;
    const pendingClearance = transactions.filter(
      (t) => t.status === "Pending Clearance",
    ).length;
    return {
      collected,
      count: successful.length,
      overdue,
      pendingClearance,
      total: transactions.length,
    };
  }, [transactions]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (t) => {
    setEditId(t.id);
    setForm({
      student: t.student,
      class: t.class,
      term: t.term,
      amount: t.amount || 0,
      mode: t.mode,
      date: t.date !== "—" ? t.date : todayISO(),
      status: t.status,
    });
    setShowModal(true);
  };

  const updateForm = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSave = () => {
    if (!form.student.trim()) return;

    if (editId) {
      setTransactions((prev) =>
        prev.map((t) => (t.id === editId ? { ...t, ...form } : t)),
      );
    } else {
      const newTxn = {
        id: `TXN${9000 + transactions.length + 1}`,
        receipt: `RCPT-${todayForReceipt()}-${String(900 + transactions.length + 1).padStart(3, "0")}`,
        ...form,
        student: form.student.trim(),
      };
      setTransactions((prev) => [newTxn, ...prev]);
    }
    setShowModal(false);
    setForm(emptyForm());
    setEditId(null);
  };

  const handleDelete = (id) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Finance"
        title="Fees Collection"
        description="Track payments, dues and receipts across the school."
        right={
          <PermissionGate permission="fees:collect">
            <Button variant="amber" onClick={openAdd}>
              <Plus size={15} /> Record Payment
            </Button>
          </PermissionGate>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Wallet}
          label="Collected (Term 2)"
          value={`₹${(stats.collected / 100000).toFixed(1)}L`}
          sub={`${stats.count} successful payments`}
          accent="success"
        />
        <StatCard
          icon={TrendingUp}
          label="Collection Rate"
          value={`${Math.min(100, Math.round((stats.collected / (totalTerm * 1000)) * 100))}%`}
          sub="Estimated vs target"
          accent="amber"
        />
        <StatCard
          icon={AlertTriangle}
          label="Overdue Accounts"
          value={String(stats.overdue)}
          sub="Past due date"
          accent="alert"
        />
        <StatCard
          icon={Receipt}
          label="Receipts Issued"
          value={String(stats.count)}
          sub={`${stats.pendingClearance} pending clearance`}
          accent="info"
        />
      </div>

      <Card title="Term 2 Fee Structure (per student)">
        <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {feeStructure.map((f) => (
            <div key={f.head} className="rounded-xl bg-paper p-3.5">
              <p className="text-[11.5px] text-slate-text/70">{f.head}</p>
              <p className="font-display font-bold text-ink text-lg mt-1">
                ₹{f.termAmount.toLocaleString("en-IN")}
              </p>
            </div>
          ))}
          <div className="rounded-xl bg-ink p-3.5 text-white">
            <p className="text-[11.5px] text-white/60">Total per Student</p>
            <p className="font-display font-bold text-lg mt-1">
              ₹{totalTerm.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </Card>

      <Card
        title="Recent Transactions"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
              />
              <Input
                placeholder="Search student, receipt..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 w-52"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-w-[140px]"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === "All" ? "All Status" : s}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="py-14 text-center">
            <Receipt size={36} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[14px] font-medium text-ink">
              No transactions found
            </p>
            <p className="text-[13px] text-slate-text/60 mt-1">
              Try changing filters or record a new payment.
            </p>
            <PermissionGate permission="fees:collect">
              <Button variant="amber" className="mt-4" onClick={openAdd}>
                <Plus size={15} /> Record Payment
              </Button>
            </PermissionGate>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/[0.06]">
                  <th className="px-5 py-2.5 font-semibold">Receipt No.</th>
                  <th className="px-5 py-2.5 font-semibold">Student</th>
                  <th className="px-5 py-2.5 font-semibold">Class</th>
                  <th className="px-5 py-2.5 font-semibold">Term</th>
                  <th className="px-5 py-2.5 font-semibold">Amount</th>
                  <th className="px-5 py-2.5 font-semibold">Mode</th>
                  <th className="px-5 py-2.5 font-semibold">Date</th>
                  <th className="px-5 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-black/[0.04] hover:bg-paper/60"
                  >
                    <td className="px-5 py-3 font-mono text-[12px] text-slate-text">
                      {t.receipt}
                    </td>
                    <td className="px-5 py-3 font-semibold text-ink">
                      {t.student}
                    </td>
                    <td className="px-5 py-3 text-slate-text">{t.class}</td>
                    <td className="px-5 py-3 text-slate-text">{t.term}</td>
                    <td className="px-5 py-3 text-slate-text font-medium">
                      {t.amount ? `₹${t.amount.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-text">{t.mode}</td>
                    <td className="px-5 py-3 text-slate-text whitespace-nowrap">
                      {t.date}
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={statusTone(t.status)}>{t.status}</Pill>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <PermissionGate permission="fees:collect">
                        <button
                          onClick={() => openEdit(t)}
                          className="p-1.5 rounded-lg hover:bg-paper text-slate-text/60 hover:text-info transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-1.5 rounded-lg hover:bg-paper text-slate-text/60 hover:text-alert transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </PermissionGate>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ========== RECORD / EDIT PAYMENT MODAL ========== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  {editId ? "Edit Payment" : "Record Payment"}
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  Enter the payment details to save a transaction.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Student Name *
                </label>
                <Input
                  placeholder="Full student name"
                  value={form.student}
                  onChange={(e) => updateForm("student", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Class
                  </label>
                  <Select
                    value={form.class}
                    onChange={(e) => updateForm("class", e.target.value)}
                  >
                    {CLASSES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Term
                  </label>
                  <Select
                    value={form.term}
                    onChange={(e) => updateForm("term", e.target.value)}
                  >
                    {TERMS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Amount (₹)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={form.amount}
                  onChange={(e) => updateForm("amount", Number(e.target.value))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Mode
                  </label>
                  <Select
                    value={form.mode}
                    onChange={(e) => updateForm("mode", e.target.value)}
                  >
                    {MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Status
                  </label>
                  <Select
                    value={form.status}
                    onChange={(e) => updateForm("status", e.target.value)}
                  >
                    <option value="Success">Success</option>
                    <option value="Pending Clearance">Pending Clearance</option>
                    <option value="Overdue">Overdue</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Date
                </label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => updateForm("date", e.target.value)}
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-black/[0.06] flex justify-between gap-2">
              <div>
                {editId && (
                  <Button
                    variant="outline"
                    className="text-alert border-alert/30 hover:bg-alert/5"
                    onClick={() => {
                      handleDelete(editId);
                      setShowModal(false);
                    }}
                  >
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="amber"
                  onClick={handleSave}
                  disabled={!form.student.trim()}
                >
                  <Save size={15} /> {editId ? "Update" : "Record"} Payment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
