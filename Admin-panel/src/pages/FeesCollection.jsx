import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { api } from "../lib/api";
import { hasPermission } from "../lib/permissions";
import { selectUser } from "../store/selectors";
import { useMasterOptions } from "../hooks/useMasterOptions";
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
  Loader2,
  FilePlus2,
  Power,
  Printer,
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
import SearchableSelect from "../components/SearchableSelect";

const MODES = ["Cash", "Card", "UPI", "Net Banking", "Cheque", "Online Gateway"];
const FREQUENCIES = ["Monthly", "Quarterly", "Annually", "One-time"];

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

function emptyStructureForm() {
  return {
    class: "",
    feeType: "",
    session: "",
    amount: "",
    frequency: "Monthly",
    dueDate: "",
  };
}

export default function FeesCollection() {
  const user = useSelector(selectUser);
  const canStructure = hasPermission(user, "fees:structure");
  const canCollect = hasPermission(user, "fees:collect");

  const { options: classOptions } = useMasterOptions("classes", []);
  const { options: feeTypeOptions } = useMasterOptions("fee-types", [
    "Tuition",
    "Transport",
    "Hostel",
    "Exam",
    "Library",
    "Sports",
    "Lab",
    "Miscellaneous",
  ]);
  const { options: sectionOptions, rawItems: rawSections } = useMasterOptions("sections", []);

  const [students, setStudents] = useState([]);
  const [structures, setStructures] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [showStructureModal, setShowStructureModal] = useState(false);
  const [editingStructure, setEditingStructure] = useState(null);
  const [structureForm, setStructureForm] = useState(emptyStructureForm());
  const [structureBusy, setStructureBusy] = useState(false);
  const [sessionFilter, setSessionFilter] = useState("");

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    class: "",
    section: "",
    feeType: "",
    session: "",
    dueDate: "",
  });
  const filteredInvoiceSections = useMemo(() => {
    if (!invoiceForm.class) return sectionOptions;
    return [...new Set(rawSections.filter((s) => s.className === invoiceForm.class).map((s) => s.name))];
  }, [invoiceForm.class, sectionOptions, rawSections]);
  const [invoicePreview, setInvoicePreview] = useState(null);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [invoiceStep, setInvoiceStep] = useState("form");

  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [receiptBusy, setReceiptBusy] = useState(false);

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
        invoiceId: payment.invoiceId,
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
        invoiceAmount: Number(invoice?.amount || 0),
        paidAmount: Number(invoice?.paidAmount || 0),
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

  const distinctSessions = useMemo(() => {
    const set = new Set(structures.map((s) => s.session).filter(Boolean));
    return [...set].sort();
  }, [structures]);

  const filteredStructures = useMemo(() => {
    if (!sessionFilter) return structures;
    return structures.filter((s) => s.session === sessionFilter);
  }, [structures, sessionFilter]);

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
    const paidCount = invoices.filter((invoice) => invoice.status === "Paid").length;
    const partial = invoices.filter(
      (invoice) =>
        invoice.status === "Partially Paid" ||
        (Number(invoice.paidAmount || 0) > 0 &&
          Number(invoice.paidAmount || 0) < Number(invoice.amount)),
    ).length;
    return { collected, count: payments.length, outstanding, overdue, paidCount, partial };
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
    if (!form.studentId) {
      toast("Select a student", "error");
      return;
    }
    if (!form.invoiceId) {
      toast("Select a pending invoice", "error");
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast("Enter a valid payment amount", "error");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.fees.payments.create({
        invoiceId: form.invoiceId,
        amount,
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

  const openNewStructure = () => {
    setEditingStructure(null);
    setStructureForm(emptyStructureForm());
    setShowStructureModal(true);
  };

  const openEditStructure = (structure) => {
    setEditingStructure(structure);
    setStructureForm({
      class: structure.class || "",
      feeType: structure.feeType || "",
      session: structure.session || "",
      amount: structure.amount || "",
      frequency: structure.frequency || "Monthly",
      dueDate: structure.dueDate ? structure.dueDate.slice(0, 10) : "",
    });
    setShowStructureModal(true);
  };

  const handleSaveStructure = async () => {
    const amount = Number(structureForm.amount);
    const payload = {
      ...structureForm,
      amount,
    };
    if (!payload.class || !payload.feeType) {
      toast("Class and fee type are required", "error");
      return;
    }
    if (!String(payload.session || "").trim()) {
      toast("Session is required", "error");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast("Amount must be a positive number", "error");
      return;
    }
    setStructureBusy(true);
    try {
      if (editingStructure) {
        await api.fees.structures.update(editingStructure._id, payload);
        toast("Structure updated");
      } else {
        await api.fees.structures.create(payload);
        toast("Structure created");
      }
      setShowStructureModal(false);
      setEditingStructure(null);
      setStructureForm(emptyStructureForm());
      reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setStructureBusy(false);
    }
  };

  const handleToggleStructure = async (structure) => {
    try {
      await api.fees.structures.toggleActive(structure._id, !structure.active);
      toast(structure.active ? "Structure deactivated" : "Structure activated");
      reload();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const handleDeleteStructure = async (structure) => {
    if (!window.confirm(`Delete ${structure.feeType} for ${structure.class}?`)) return;
    try {
      await api.fees.structures.remove(structure._id);
      toast("Structure deleted");
      reload();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const handlePreviewInvoices = async () => {
    if (!invoiceForm.class || !invoiceForm.feeType) {
      toast("Class and fee type are required", "error");
      return;
    }
    if (!String(invoiceForm.session || "").trim()) {
      toast("Session is required", "error");
      return;
    }
    setInvoiceBusy(true);
    try {
      const { data } = await api.fees.invoices.generatePreview(invoiceForm);
      setInvoicePreview(data);
      setInvoiceStep("preview");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setInvoiceBusy(false);
    }
  };

  const handleConfirmInvoices = async () => {
    if (!invoicePreview?.rows) return;
    const nonDupes = invoicePreview.rows.filter((r) => !r.duplicate);
    if (nonDupes.length === 0) {
      toast("No new invoices to generate", "info");
      return;
    }
    setInvoiceBusy(true);
    try {
      await api.fees.invoices.generateConfirm({
        invoices: nonDupes.map((r) => ({
          studentId: r.studentId,
          class: invoiceForm.class,
          feeType: invoiceForm.feeType,
          session: invoiceForm.session,
          amount: r.amount,
          dueDate: invoiceForm.dueDate || undefined,
        })),
      });
      toast(`${nonDupes.length} invoices generated`);
      setShowInvoiceModal(false);
      setInvoicePreview(null);
      setInvoiceStep("form");
      setInvoiceForm({ class: "", section: "", feeType: "", session: "", dueDate: "" });
      reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setInvoiceBusy(false);
    }
  };

  const handleViewReceipt = async (payment) => {
    if (!payment.receiptNo || payment.receiptNo === "—") {
      toast("No receipt number for this payment", "info");
      return;
    }
    setShowReceiptModal(true);
    setReceiptBusy(true);
    setReceiptData(null);
    try {
      const { data } = await api.fees.payments.receipt(payment.receiptNo);
      setReceiptData(data);
    } catch (err) {
      toast(err.message, "error");
      setShowReceiptModal(false);
    } finally {
      setReceiptBusy(false);
    }
  };

  const handlePrintReceipt = () => {
    const el = document.getElementById("receipt-printable");
    if (!el) return;
    const win = window.open("", "_blank", "width=400,height=600");
    win.document.write(
      `<html><head><title>Receipt</title><style>body{font-family:monospace;padding:20px;font-size:13px;}table{width:100%;border-collapse:collapse;}td{padding:4px 0;}hr{margin:10px 0;}</style></head><body>${el.innerHTML}</body></html>`,
    );
    win.document.close();
    win.print();
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
          <div className="flex items-center gap-2">
            {canCollect && (
              <Button
                variant="primary"
                onClick={() => {
                  setShowInvoiceModal(true);
                  setInvoiceStep("form");
                  setInvoicePreview(null);
                }}
              >
                <FilePlus2 size={15} /> Generate Invoices
              </Button>
            )}
            <Button variant="amber" onClick={() => setShowModal(true)}>
              <Plus size={15} /> Record Payment
            </Button>
          </div>
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
          label="Invoices Overview"
          value={String(invoices.length)}
          sub={`${stats.paidCount} paid · ${stats.partial} partial · ${stats.overdue} overdue`}
          accent="info"
        />
      </div>

      <Card
        title="Fee Structure"
        action={
          <div className="flex items-center gap-2">
            {distinctSessions.length > 0 && (
              <Select
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                className="text-[12px] py-1.5 px-2.5"
              >
                <option value="">All Sessions</option>
                {distinctSessions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            )}
            {canStructure && (
              <Button variant="amber" className="text-[12px] py-1.5" onClick={openNewStructure}>
                <Plus size={14} /> Add Fee Structure
              </Button>
            )}
          </div>
        }
      >
        {filteredStructures.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-slate-text/60">
            No fee structures{sessionFilter ? ` for session ${sessionFilter}` : ""} configured yet
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
                  <th className="px-5 py-2.5 font-semibold">Status</th>
                  {canStructure && (
                    <th className="px-5 py-2.5 font-semibold text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredStructures.slice(0, 50).map((structure) => (
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
                    <td className="px-5 py-3">
                      <Pill tone={structure.active !== false ? "success" : "neutral"}>
                        {structure.active !== false ? "Active" : "Inactive"}
                      </Pill>
                    </td>
                    {canStructure && (
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditStructure(structure)}
                            className="p-1.5 rounded-lg hover:bg-paper text-slate-text/60 hover:text-ink"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleToggleStructure(structure)}
                            className="p-1.5 rounded-lg hover:bg-paper text-slate-text/60 hover:text-amber"
                            title={structure.active !== false ? "Deactivate" : "Activate"}
                          >
                            <Power size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteStructure(structure)}
                            className="p-1.5 rounded-lg hover:bg-paper text-slate-text/60 hover:text-alert"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
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
                  <th className="px-5 py-2.5 font-semibold text-right">Receipt</th>
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
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleViewReceipt(payment)}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline"
                      >
                        <Receipt size={13} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Record Payment Modal */}
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

      {/* Fee Structure Modal */}
      {showStructureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => {
              setShowStructureModal(false);
              setEditingStructure(null);
            }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  {editingStructure ? "Edit Fee Structure" : "New Fee Structure"}
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  {editingStructure
                    ? "Update the details for this fee structure."
                    : "Define a new fee structure for a class."}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowStructureModal(false);
                  setEditingStructure(null);
                }}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Class *
                  </label>
                   <SearchableSelect
                     options={classOptions}
                     value={structureForm.class}
                     onChange={(val) =>
                       setStructureForm({ ...structureForm, class: val })
                     }
                     placeholder="Select class..."
                     className="w-full"
                   />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Fee Type *
                  </label>
                  <Select
                    value={structureForm.feeType}
                    onChange={(e) =>
                      setStructureForm({ ...structureForm, feeType: e.target.value })
                    }
                    className="w-full"
                  >
                    <option value="">Select fee type...</option>
                    {feeTypeOptions.map((ft) => (
                      <option key={ft} value={ft}>{ft}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Session *
                  </label>
                  <Input
                    placeholder="e.g. 2026-27"
                    value={structureForm.session}
                    onChange={(e) =>
                      setStructureForm({ ...structureForm, session: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Amount (₹) *
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={structureForm.amount}
                    onChange={(e) =>
                      setStructureForm({ ...structureForm, amount: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Frequency
                  </label>
                  <Select
                    value={structureForm.frequency}
                    onChange={(e) =>
                      setStructureForm({ ...structureForm, frequency: e.target.value })
                    }
                    className="w-full"
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Due Date
                  </label>
                  <Input
                    type="date"
                    value={structureForm.dueDate}
                    onChange={(e) =>
                      setStructureForm({ ...structureForm, dueDate: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-black/[0.06] flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowStructureModal(false);
                  setEditingStructure(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="amber"
                onClick={handleSaveStructure}
                disabled={structureBusy}
              >
                {structureBusy ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}{" "}
                {structureBusy
                  ? "Saving..."
                  : editingStructure
                    ? "Update Structure"
                    : "Create Structure"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Invoices Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => {
              setShowInvoiceModal(false);
              setInvoicePreview(null);
              setInvoiceStep("form");
            }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  Bulk Invoice Generation
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  {invoiceStep === "form"
                    ? "Select criteria to generate invoices for eligible students."
                    : "Review the preview before confirming."}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowInvoiceModal(false);
                  setInvoicePreview(null);
                  setInvoiceStep("form");
                }}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {invoiceStep === "form" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                        Class *
                      </label>
                       <SearchableSelect
                         options={classOptions}
                         value={invoiceForm.class}
                         onChange={(val) =>
                           setInvoiceForm({ ...invoiceForm, class: val, section: "" })
                         }
                         placeholder="Select class..."
                         className="w-full"
                       />
                    </div>
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                        Section
                      </label>
                       <SearchableSelect
                         options={filteredInvoiceSections}
                         value={invoiceForm.section}
                         onChange={(val) =>
                           setInvoiceForm({ ...invoiceForm, section: val })
                         }
                         placeholder="All sections"
                         className="w-full"
                       />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                        Fee Type *
                      </label>
                      <Select
                        value={invoiceForm.feeType}
                        onChange={(e) =>
                          setInvoiceForm({ ...invoiceForm, feeType: e.target.value })
                        }
                        className="w-full"
                      >
                        <option value="">Select fee type...</option>
                        {feeTypeOptions.map((ft) => (
                          <option key={ft} value={ft}>{ft}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                        Session
                      </label>
                      <Input
                        placeholder="e.g. 2026-27"
                        value={invoiceForm.session}
                        onChange={(e) =>
                          setInvoiceForm({ ...invoiceForm, session: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                      Due Date
                    </label>
                    <Input
                      type="date"
                      value={invoiceForm.dueDate}
                      onChange={(e) =>
                        setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })
                      }
                    />
                  </div>
                </>
              )}

              {invoiceStep === "preview" && invoicePreview && (
                <>
                  <div className="flex items-center gap-4 text-[12.5px] text-slate-text">
                    <span>
                      Total: <strong className="text-ink">{invoicePreview.rows?.length || 0}</strong>
                    </span>
                    <span>
                      Duplicates:{" "}
                      <strong className="text-amber-dark">
                        {invoicePreview.rows?.filter((r) => r.duplicate).length || 0}
                      </strong>
                    </span>
                    <span>
                      New invoices:{" "}
                      <strong className="text-success">
                        {invoicePreview.rows?.filter((r) => !r.duplicate).length || 0}
                      </strong>
                    </span>
                  </div>

                  {invoicePreview.rows && invoicePreview.rows.length > 0 && (
                    <div className="overflow-x-auto -mx-5">
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/[0.06]">
                            <th className="px-5 py-2.5 font-semibold">Student</th>
                            <th className="px-5 py-2.5 font-semibold">ID</th>
                            <th className="px-5 py-2.5 font-semibold">Amount</th>
                            <th className="px-5 py-2.5 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoicePreview.rows.map((row, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-black/[0.04] hover:bg-paper/60"
                            >
                              <td className="px-5 py-3 font-semibold text-ink">
                                {row.studentName || row.studentId}
                              </td>
                              <td className="px-5 py-3 text-slate-text font-mono text-[12px]">
                                {row.studentId}
                              </td>
                              <td className="px-5 py-3 text-slate-text font-medium">
                                ₹{Number(row.amount).toLocaleString("en-IN")}
                              </td>
                              <td className="px-5 py-3">
                                {row.duplicate ? (
                                  <Pill tone="amber">Duplicate</Pill>
                                ) : (
                                  <Pill tone="success">New</Pill>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-5 py-4 border-t border-black/[0.06] flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (invoiceStep === "preview") {
                    setInvoiceStep("form");
                    setInvoicePreview(null);
                  } else {
                    setShowInvoiceModal(false);
                    setInvoicePreview(null);
                    setInvoiceStep("form");
                  }
                }}
              >
                {invoiceStep === "preview" ? "Back" : "Cancel"}
              </Button>
              {invoiceStep === "form" ? (
                <Button
                  variant="amber"
                  onClick={handlePreviewInvoices}
                  disabled={invoiceBusy}
                >
                  {invoiceBusy ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Search size={15} />
                  )}{" "}
                  {invoiceBusy ? "Loading..." : "Preview"}
                </Button>
              ) : (
                <Button
                  variant="amber"
                  onClick={handleConfirmInvoices}
                  disabled={
                    invoiceBusy ||
                    !invoicePreview?.rows?.filter((r) => !r.duplicate).length
                  }
                >
                  {invoiceBusy ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}{" "}
                  {invoiceBusy
                    ? "Generating..."
                    : `Confirm Generated ${invoicePreview?.rows?.filter((r) => !r.duplicate).length || 0} Invoices`}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => {
              setShowReceiptModal(false);
              setReceiptData(null);
            }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <h3 className="font-display font-semibold text-ink text-[17px]">
                Payment Receipt
              </h3>
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  setReceiptData(null);
                }}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
              {receiptBusy ? (
                <div className="py-10 text-center">
                  <Loader2 size={24} className="mx-auto text-slate-text/40 animate-spin mb-3" />
                  <p className="text-[13px] text-slate-text/60">Loading receipt...</p>
                </div>
              ) : receiptData ? (
                <div id="receipt-printable" className="font-mono text-[12.5px] text-ink">
                  <div className="text-center mb-4">
                    <p className="font-display font-bold text-[17px]">
                      {receiptData.schoolName || "School Name"}
                    </p>
                    <p className="text-slate-text/60 text-[11px] mt-0.5">
                      {receiptData.schoolAddress || ""}
                    </p>
                  </div>
                  <hr className="border-black/10 my-3" />
                  <p className="text-center font-semibold text-[13px] mb-3">
                    PAYMENT RECEIPT
                  </p>
                  <table className="w-full">
                    <tbody>
                      <tr>
                        <td className="py-1.5 text-slate-text/70">Receipt No.</td>
                        <td className="py-1.5 text-right font-semibold">
                          {receiptData.receiptNo || "—"}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-text/70">Date</td>
                        <td className="py-1.5 text-right">
                          {formatDate(receiptData.date || receiptData.paidOn)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-text/70">Student</td>
                        <td className="py-1.5 text-right font-semibold">
                          {receiptData.studentName || "—"}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-text/70">Class</td>
                        <td className="py-1.5 text-right">{receiptData.class || "—"}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-text/70">Fee Type</td>
                        <td className="py-1.5 text-right">{receiptData.feeType || "—"}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-text/70">Mode</td>
                        <td className="py-1.5 text-right">{receiptData.mode || "—"}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-text/70">Invoice Amount</td>
                        <td className="py-1.5 text-right">
                          ₹{Number(receiptData.invoiceAmount || 0).toLocaleString("en-IN")}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-text/70">Paid Amount</td>
                        <td className="py-1.5 text-right font-semibold">
                          ₹{Number(receiptData.amount || receiptData.paidAmount || 0).toLocaleString("en-IN")}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-text/70">Balance</td>
                        <td className="py-1.5 text-right">
                          ₹{Math.max(
                            0,
                            Number(receiptData.invoiceAmount || 0) -
                              Number(receiptData.paidAmount || receiptData.amount || 0),
                          ).toLocaleString("en-IN")}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-text/70">Collected By</td>
                        <td className="py-1.5 text-right">{receiptData.collectedBy || "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                  <hr className="border-black/10 my-3" />
                  <p className="text-center text-[11px] text-slate-text/50 mt-2">
                    This is a computer-generated receipt.
                  </p>
                </div>
              ) : (
                <p className="py-10 text-center text-[13px] text-slate-text/60">
                  No receipt data available.
                </p>
              )}
            </div>

            <div className="px-5 py-4 border-t border-black/[0.06] flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowReceiptModal(false); setReceiptData(null); }}>
                Close
              </Button>
              {receiptData && (
                <Button variant="amber" onClick={handlePrintReceipt}>
                  <Printer size={15} /> Print Receipt
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
