import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import {
  Plus,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Receipt,
  X,
  Save,
  Search,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Input,
  Select,
  Pill,
  StatCard,
  toast,
} from "../components/UI";

const MODES = ["Cash", "Card", "UPI", "Net Banking", "Cheque", "Online Gateway"];

function formatDate(value) {
  return value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
}

function emptyForm() {
  return {
    studentId: "",
    invoiceId: "",
    amount: 0,
    mode: "Cash",
    transactionId: "",
  };
}

export default function FeesCollection() {
  const [students, setStudents] = useState([]);
  const [structures, setStructures] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");

  const reload = () => {
    Promise.all([
      api.students.list("limit=1000"),
      api.fees.structures.list().catch(() => ({ data: [] })),
      api.fees.invoices.list().catch(() => ({ data: [] })),
      api.fees.payments.list().catch(() => ({ data: [] })),
    ])
      .then(([studentResponse, structureResponse, invoiceResponse, paymentResponse]) => {
        setStudents((studentResponse.data || []).map((item) => ({
          ...item,
          id: item._id,
        })));
        setStructures(structureResponse.data || []);
        setInvoices(invoiceResponse.data || []);
        setPayments(paymentResponse.data || []);
        setLoadError("");
      })
      .catch((err) => setLoadError(err.message));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const studentMap = useMemo(
    () => new Map(students.map((s) => [String(s.id), s])),
    [students],
  );

  const invoiceMap = useMemo(
    () => new Map(invoices.map((i) => [String(i._id), i])),
    [invoices],
  );

  const enrichedPayments = useMemo(() => {
    return payments.map((payment) => {
      const id = payment._id || payment.id;
      const student = studentMap.get(String(payment.studentId));
      const invoice = invoiceMap.get(String(payment.invoiceId));
      return {
        id,
        receiptNo: payment.receiptNo || "—",
        studentId: payment.studentId,
        studentName:
          student?.name || invoice?.studentId || payment.studentId || "—",
        className:
          student?.class ||
          invoice?.class ||
          (student ? `Class ${student.class}` : "—"),
        feeType: invoice?.feeType || "Fee",
        amount: Number(payment.amount || 0),
        mode: payment.mode || "—",
        paidOn: payment.paidOn,
        collectedBy: payment.collectedBy || "—",
      };
    });
  }, [payments, studentMap, invoiceMap]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enrichedPayments;
    return enrichedPayments.filter(
      (p) =>
        (p.studentName || "").toLowerCase().includes(q) ||
        (p.receiptNo || "").toLowerCase().includes(q) ||
        (p.feeType || "").toLowerCase().includes(q),
    );
  }, [enrichedPayments, query]);

  const stats = useMemo(() => {
    const collected = payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0,
    );
    const outstanding = invoices.reduce(
      (sum, invoice) =>
        sum +
        Math.max(0, Number(invoice.amount) - Number(invoice.paidAmount || 0)),
      0,
    );
    const overdue = invoices.filter((invoice) => invoice.status === "Overdue")
      .length;
    return { collected, count: payments.length, outstanding, overdue };
  }, [payments, invoices]);

  const outstandingForStudent = (studentId) => {
    return invoices
      .filter((invoice) => String(invoice.studentId) === String(studentId))
      .reduce(
        (sum, invoice) =>
          sum +
          Math.max(0, Number(invoice.amount) - Number(invoice.paidAmount || 0)),
        0,
      );
  };

  const studentInvoices = useMemo(() => {
    if (!form.studentId) return [];
    return invoices
      .filter(
        (invoice) =>
          String(invoice.studentId) === String(form.studentId) &&
          Number(invoice.amount) - Number(invoice.paidAmount || 0) > 0,
      )
      .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
  }, [invoices, form.studentId]);

  const handleSelectStudent = (studentId) => {
    const firstInvoice = invoices.find(
      (invoice) =>
        String(invoice.studentId) === String(studentId) &&
        Number(invoice.amount) - Number(invoice.paidAmount || 0) > 0,
    );
    setForm({
      studentId,
      invoiceId: firstInvoice ? firstInvoice._id : "",
      amount: firstInvoice
        ? Math.max(0, Number(firstInvoice.amount) - Number(firstInvoice.paidAmount || 0))
        : 0,
      mode: "Cash",
      transactionId: "",
    });
  };

  const handleSelectInvoice = (invoiceId) => {
    const match = studentInvoices.find(
      (invoice) => String(invoice._id) === String(invoiceId),
    );
    setForm((prev) => ({
      ...prev,
      invoiceId,
      amount: match
        ? Math.max(0, Number(match.amount) - Number(match.paidAmount || 0))
        : 0,
    }));
  };

  const handleSave = async () => {
    if (!form.studentId || !form.invoiceId || form.amount <= 0) return;
    setBusy(true);
    try {
      const { data } = await api.fees.payments.create({
        invoiceId: form.invoiceId,
        amount: Number(form.amount),
        mode: form.mode,
        transactionId: form.transactionId.trim() || undefined,
      });
      toast(`Payment recorded · ${data?.payment?.receiptNo || "done"}`);
      setShowModal(false);
      setForm(emptyForm());
      reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const payableStudents = students.filter(
    (student) => outstandingForStudent(student.id) > 0,
  );

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Finance"
        title="Fees Collection"
        description="Track payments, dues and receipts across the school."
        right={
          <Button variant="amber" onClick={() => setShowModal(true)}>
            <Plus size={15} /> Record Payment
          </Button>
        }
      />

      {loadError && (
        <Card>
          <p className="text-sm text-alert">{loadError}</p>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Wallet}
          label="Collected (All Time)"
          value={`₹${(stats.collected / 100000).toFixed(1)}L`}
          sub={`${stats.count} successful payments`}
          accent="success"
        />
        <StatCard
          icon={TrendingUp}
          label="Collection Rate"
          value={`${stats.collected > 0 || stats.outstanding > 0 ? Math.min(100, Math.round((stats.collected / (stats.collected + stats.outstanding)) * 100)) : 0}%`}
          sub="Collected vs outstanding"
          accent="amber"
        />
        <StatCard
          icon={AlertTriangle}
          label="Outstanding Dues"
          value={`₹${(stats.outstanding / 100000).toFixed(1)}L`}
          sub={`${payableStudents.length} students with dues`}
          accent="alert"
        />
        <StatCard
          icon={Receipt}
          label="Receipts Issued"
          value={String(stats.count)}
          sub={`${stats.overdue} invoices overdue`}
          accent="info"
        />
      </div>

      <Card title="Fee Structure">
        {structures.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-slate-text/60">
            No fee structures configured yet
          </p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/[0.06]">
                  <th className="px-5 py-2.5 font-semibold">Fee Type</th>
                  <th className="px-5 py-2.5 font-semibold">Class</th>
                  <th className="px-5 py-2.5 font-semibold">Session</th>
                  <th className="px-5 py-2.5 font-semibold">Amount</th>
                  <th className="px-5 py-2.5 font-semibold">Frequency</th>
                  <th className="px-5 py-2.5 font-semibold">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {structures.slice(0, 50).map((structure) => (
                  <tr
                    key={structure._id}
                    className="border-b border-black/[0.04] hover:bg-paper/60"
                  >
                    <td className="px-5 py-3 font-semibold text-ink">
                      {structure.feeType}
                    </td>
                    <td className="px-5 py-3 text-slate-text">
                      {structure.class}
                    </td>
                    <td className="px-5 py-3 text-slate-text">
                      {structure.session}
                    </td>
                    <td className="px-5 py-3 text-slate-text font-medium">
                      ₹{Number(structure.amount).toLocaleString("en-IN")}
                    </td>
                    <td className="px-5 py-3">
                      <Pill>{structure.frequency}</Pill>
                    </td>
                    <td className="px-5 py-3 text-slate-text whitespace-nowrap">
                      {formatDate(structure.dueDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Recent Transactions"
        action={
          <div className="relative w-52">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
            />
            <Input
              placeholder="Search student, receipt..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-8"
            />
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
            <Button variant="amber" className="mt-4" onClick={() => setShowModal(true)}>
              <Plus size={15} /> Record Payment
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/[0.06]">
                  <th className="px-5 py-2.5 font-semibold">Receipt No.</th>
                  <th className="px-5 py-2.5 font-semibold">Student</th>
                  <th className="px-5 py-2.5 font-semibold">Class</th>
                  <th className="px-5 py-2.5 font-semibold">Fee Type</th>
                  <th className="px-5 py-2.5 font-semibold">Amount</th>
                  <th className="px-5 py-2.5 font-semibold">Mode</th>
                  <th className="px-5 py-2.5 font-semibold">Date</th>
                  <th className="px-5 py-2.5 font-semibold">Collected By</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-b border-black/[0.04] hover:bg-paper/60"
                  >
                    <td className="px-5 py-3 font-mono text-[12px] text-slate-text">
                      {payment.receiptNo}
                    </td>
                    <td className="px-5 py-3 font-semibold text-ink">
                      {payment.studentName}
                    </td>
                    <td className="px-5 py-3 text-slate-text">
                      {payment.className}
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone="info">{payment.feeType}</Pill>
                    </td>
                    <td className="px-5 py-3 text-slate-text font-medium">
                      ₹{payment.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="px-5 py-3 text-slate-text">{payment.mode}</td>
                    <td className="px-5 py-3 text-slate-text whitespace-nowrap">
                      {formatDate(payment.paidOn)}
                    </td>
                    <td className="px-5 py-3 text-slate-text">
                      {payment.collectedBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
                  Record Payment
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  Select a student and their pending invoice to record payment.
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
                  Student *
                </label>
                <Select
                  value={form.studentId}
                  onChange={(event) => handleSelectStudent(event.target.value)}
                  className="w-full"
                >
                  <option value="">Select a student...</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} — Class {student.class}-{student.section}
                      {outstandingForStudent(student.id) > 0
                        ? ""
                        : " (no dues)"}
                    </option>
                  ))}
                </Select>
              </div>

              {form.studentId && studentInvoices.length === 0 && (
                <p className="text-[12.5px] text-slate-text/70 bg-paper rounded-lg px-3 py-2.5">
                  No pending invoices for this student.
                </p>
              )}

              {form.studentId && studentInvoices.length > 0 && (
                <>
                  <div>
                    <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                      Pending Invoice *
                    </label>
                    <Select
                      value={form.invoiceId}
                      onChange={(event) => handleSelectInvoice(event.target.value)}
                      className="w-full"
                    >
                      {studentInvoices.map((invoice) => (
                        <option key={invoice._id} value={invoice._id}>
                          {invoice.feeType} · {invoice.session} · ₹
                          {Math.max(
                            0,
                            Number(invoice.amount) -
                              Number(invoice.paidAmount || 0),
                          ).toLocaleString("en-IN")}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                        Amount (₹) *
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={form.amount}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            amount: Number(event.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                        Mode *
                      </label>
                      <Select
                        value={form.mode}
                        onChange={(event) =>
                          setForm({ ...form, mode: event.target.value })
                        }
                        className="w-full"
                      >
                        {MODES.map((mode) => (
                          <option key={mode} value={mode}>
                            {mode}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                      Transaction ID
                    </label>
                    <Input
                      placeholder="Optional reference / UTR number"
                      value={form.transactionId}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          transactionId: event.target.value,
                        })
                      }
                    />
                  </div>
                </>
              )}
            </div>

            <div className="px-5 py-4 border-t border-black/[0.06] flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                variant="amber"
                onClick={handleSave}
                disabled={busy || !form.studentId || !form.invoiceId || form.amount <= 0}
              >
                <Save size={15} /> {busy ? "Saving..." : "Record Payment"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}