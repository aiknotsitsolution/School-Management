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
  Download,
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

const MODES = ["Cash", "Card", "UPI", "Net Banking", "Bank Transfer", "Cheque", "Online Gateway"];
const FREQUENCIES = ["Monthly", "Quarterly", "Annually", "One-time"];
const ORDER_STATUS_TONES = {
  pending: "neutral",
  awaiting_confirmation: "warning",
  awaiting_manual_confirm: "info",
  completed: "success",
  failed: "alert",
  cancelled: "neutral",
};
const ORDER_STATUS_LABELS = {
  pending: "Pending",
  awaiting_confirmation: "Awaiting Gateway",
  awaiting_manual_confirm: "Awaiting Office Verification",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

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
    receiptNo: "",
    chequeNo: "",
    chequeDate: "",
    bankName: "",
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

function emptyConcessionForm() {
  return {
    studentId: "",
    kind: "Sibling",
    name: "",
    type: "percent",
    value: "",
    session: "",
    feeType: "",
    siblingOf: "",
    notes: "",
  };
}

const inr = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

// Small stat tile inside the student summary (keeps the Card markup readable).
function SummaryStat({ label, value, sub, tone }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        tone === "alert"
          ? "border-alert/30 bg-alert/5"
          : tone === "success"
            ? "border-success/30 bg-success/5"
            : "border-slate-200 bg-paper/60"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
        {label}
      </p>
      <p
        className={`mt-1 text-[17px] font-display font-semibold ${
          tone === "alert" ? "text-alert" : tone === "success" ? "text-success" : "text-ink"
        }`}
      >
        {value}
      </p>
      {sub ? <p className="text-[11.5px] text-slate-text/70 mt-0.5">{sub}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Student Fee Summary — the ONE place for a student's money story:
//   yearly package (agreed at admission) → invoiced → collected → balance,
// head by head, with the receipt trail underneath. Managers (fees:structure)
// can create the package from the class structure and edit it in place.
// ---------------------------------------------------------------------------
function StudentFeeSummary({ students, activeSession, feeTypeOptions, canEdit, onSaved }) {
  const [studentId, setStudentId] = useState("");
  const [summary, setSummary] = useState(null);
  const [requestState, setRequestState] = useState({ key: "", error: "" });
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [heads, setHeads] = useState([]);

  useEffect(() => {
    if (!studentId || !activeSession) return undefined;
    const key = `${studentId}\u0000${activeSession}`;
    let cancelled = false;
    api.fees.plans
      .summary(studentId, activeSession)
      .then(({ data }) => {
        if (!cancelled) {
          setSummary(data);
          setEditing(false);
          setRequestState({ key, error: "" });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRequestState({ key, error: err.message || "Could not load the fee summary" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeSession, studentId]);

  const requestKey = `${studentId}\u0000${activeSession}`;
  const loading = Boolean(studentId && activeSession && requestState.key !== requestKey);
  const error = requestState.key === requestKey ? requestState.error : "";
  const refresh = async () => {
    const { data } = await api.fees.plans.summary(studentId, activeSession);
    setSummary(data);
  };

  const handleEnsure = async () => {
    setBusy(true);
    try {
      // Response body is { success, created, data } — `created` is top level, the
      // plan document lives under `data`.
      const res = await api.fees.plans.ensure({ studentId, session: activeSession });
      toast(
        res && res.created
          ? "Fee package created from the class fee structure"
          : "A fee package already exists for this session",
      );
      await refresh();
      onSaved?.();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = () => {
    const plan = summary?.plan;
    setHeads(
      (plan?.heads || []).map((head) => ({
        feeType: head.feeType,
        annualAmount: head.annualAmount,
        frequency: head.frequency || "Annually",
        active: head.active !== false,
      })),
    );
    setEditing(true);
  };

  const setHead = (index, patch) =>
    setHeads((prev) => prev.map((head, i) => (i === index ? { ...head, ...patch } : head)));

  const saveEdit = async () => {
    const cleaned = heads
      .map((head) => ({
        feeType: String(head.feeType || "").trim(),
        annualAmount: Number(head.annualAmount),
        frequency: head.frequency || "Annually",
        active: head.active !== false,
      }))
      .filter((head) => head.feeType && Number.isFinite(head.annualAmount) && head.annualAmount >= 0);
    if (cleaned.length === 0) {
      toast("Add at least one fee head with an annual amount", "error");
      return;
    }
    setBusy(true);
    try {
      if (summary?.plan) {
        await api.fees.plans.update(summary.plan._id, { heads: cleaned });
        toast("Fee package updated");
      } else {
        await api.fees.plans.create({
          studentId,
          session: activeSession,
          class: summary?.class || undefined,
          heads: cleaned,
        });
        toast("Fee package created");
      }
      setEditing(false);
      await refresh();
      onSaved?.();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const activeHeads = (summary?.plan?.heads || []).filter((head) => head.active !== false);
  const inactiveCount = (summary?.plan?.heads || []).length - activeHeads.length;
  const student = students.find((s) => (s.admissionNo || s.id) === studentId);

  return (
    <Card
      title="Student Fee Summary"
      action={
        // Stacks full-width on a phone (390px): session + student selectors
        // side by side are ~400px, wider than the card body at that size.
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-full">
          <Select
            value={activeSession}
            disabled
            className="w-full sm:w-36"
          >
            {activeSession ? (
              <option value={activeSession}>{activeSession}</option>
            ) : (
              <option value="">No active session</option>
            )}
          </Select>
          <Select
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            className="w-full sm:w-64"
          >
            <option value="">Select a student...</option>
            {students.map((s) => (
              <option key={s.id} value={s.admissionNo || s.id}>
                {s.name} — {s.admissionNo || s.id}
              </option>
            ))}
          </Select>
        </div>
      }
    >
      {!studentId && (
        <p className="py-8 text-center text-[13px] text-slate-text/70">
          Pick a student to see the full-year fee package, what has been billed, what is
          collected and what is still due — in one place.
        </p>
      )}

      {studentId && activeSession && loading && (
        <p className="py-8 text-center text-[13px] text-slate-text/60">Loading summary…</p>
      )}

      {studentId && !activeSession && (
        <p className="py-4 text-sm text-alert">No active academic session is configured</p>
      )}

      {studentId && activeSession && !loading && error && <p className="py-4 text-sm text-alert">{error}</p>}

      {studentId && activeSession && !loading && !error && summary && (
        <div className="space-y-5">
          <div>
            <p className="text-[13px] font-semibold text-ink">
              {student?.name || summary.studentId}{" "}
              <span className="font-normal text-slate-text/70">
                · {summary.studentId}
                {summary.class ? ` · Class ${summary.class}` : ""}
                {summary.session ? ` · ${summary.session}` : ""}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <SummaryStat
              label="Package (Year)"
              value={summary.totals.planned === null ? "—" : inr(summary.totals.planned)}
              sub={
                summary.plan
                  ? `${activeHeads.length} heads${summary.plan.source === "onboarding" ? " · auto" : " · manual"}`
                  : "no package yet"
              }
            />
            <SummaryStat
              label="Invoiced"
              value={inr(summary.totals.invoiced)}
              sub={`${summary.invoices.length} invoice${summary.invoices.length === 1 ? "" : "s"}`}
            />
            <SummaryStat
              label="Collected"
              value={inr(summary.totals.collected)}
              sub={`${summary.payments.length} receipt${summary.payments.length === 1 ? "" : "s"}`}
              tone="success"
            />
            <SummaryStat
              label="Balance Due"
              value={inr(summary.totals.outstanding)}
              sub={summary.totals.outstanding > 0 ? "pending collection" : "all clear"}
              tone={summary.totals.outstanding > 0 ? "alert" : undefined}
            />
            <SummaryStat
              label="Concession"
              value={inr(summary.totals.concession)}
              sub={`${summary.concessions.length} active`}
            />
          </div>

          {/* Yearly package */}
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-[13px] font-semibold text-ink">
                Yearly Fee Package
                {summary.plan ? ` · ${summary.plan.session}` : ""}
                {summary.plan?.notes ? (
                  <span className="ml-2 font-normal text-slate-text/60">({summary.plan.notes})</span>
                ) : null}
              </h4>
              {canEdit && !editing && (
                <div className="flex items-center gap-2">
                  {!summary.plan && (
                    <Button
                      variant="primary"
                      className="px-3 py-1.5 text-[12px]"
                      onClick={handleEnsure}
                      disabled={busy}
                    >
                      {busy ? "Working…" : "Create from class structure"}
                    </Button>
                  )}
                  {summary.plan && (
                    <Button
                      variant="outline"
                      className="px-3 py-1.5 text-[12px]"
                      onClick={startEdit}
                    >
                      <Pencil size={13} /> Edit package
                    </Button>
                  )}
                </div>
              )}
            </div>

            {!editing && summary.plan && activeHeads.length > 0 && (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11.5px] uppercase tracking-wide text-slate-text/60">
                    <th className="py-2 pr-3 font-semibold">Head</th>
                    <th className="py-2 pr-3 font-semibold">Frequency</th>
                    <th className="py-2 text-right font-semibold">Annual Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {activeHeads.map((head, index) => (
                    <tr key={`${head.feeType}-${index}`} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium text-ink">{head.feeType}</td>
                      <td className="py-2 pr-3 text-slate-text">{head.frequency}</td>
                      <td className="py-2 text-right text-slate-text">{inr(head.annualAmount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 pr-3 text-[12px] font-semibold uppercase tracking-wide text-slate-text/70">
                      Total
                    </td>
                    <td />
                    <td className="py-2 text-right text-[15px] font-semibold text-ink">
                      {inr(summary.plan.totalAnnual)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}

            {!editing && summary.plan && activeHeads.length === 0 && (
              <p className="text-[13px] text-slate-text/70">
                This package has no active heads yet — use <strong>Edit package</strong> to add
                them.
              </p>
            )}

            {!editing && !summary.plan && (
              <p className="text-[13px] text-slate-text/70">
                No yearly fee package recorded for this student yet.{" "}
                {canEdit
                  ? "Create it from the class fee structure, then adjust the annual amounts."
                  : "Ask a fee manager to set it up."}
                {inactiveCount > 0 ? "" : ""}
              </p>
            )}

            {editing && (
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-2 text-[11.5px] font-semibold uppercase tracking-wide text-slate-text/60">
                  <span className="col-span-4">Fee Head</span>
                  <span className="col-span-3">Frequency</span>
                  <span className="col-span-3">Annual Amount (₹)</span>
                  <span className="col-span-1">Active</span>
                  <span className="col-span-1" />
                </div>
                {heads.map((head, index) => (
                  <div key={index} className="grid grid-cols-12 items-center gap-2">
                    <Select
                      value={head.feeType}
                      onChange={(event) => setHead(index, { feeType: event.target.value })}
                      className="col-span-4"
                    >
                      <option value="">Select head...</option>
                      {(() => {
                        const options = feeTypeOptions.includes(head.feeType)
                          ? feeTypeOptions
                          : [...feeTypeOptions, head.feeType].filter(Boolean);
                        return options.map((ft) => (
                          <option key={ft} value={ft}>
                            {ft}
                          </option>
                        ));
                      })()}
                    </Select>
                    <Select
                      value={head.frequency}
                      onChange={(event) => setHead(index, { frequency: event.target.value })}
                      className="col-span-3"
                    >
                      {FREQUENCIES.map((freq) => (
                        <option key={freq} value={freq}>
                          {freq}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      value={head.annualAmount}
                      onChange={(event) =>
                        setHead(index, { annualAmount: Number(event.target.value) })
                      }
                      className="col-span-3"
                    />
                    <label className="col-span-1 flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={head.active !== false}
                        onChange={(event) => setHead(index, { active: event.target.checked })}
                      />
                    </label>
                    <button
                      onClick={() => setHeads((prev) => prev.filter((_, i) => i !== index))}
                      className="col-span-1 rounded p-1.5 text-slate-text/60 hover:bg-paper hover:text-alert"
                      title="Remove head"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    className="px-3 py-1.5 text-[12px]"
                    onClick={() =>
                      setHeads((prev) => [
                        ...prev,
                        { feeType: "", annualAmount: 0, frequency: "Monthly", active: true },
                      ])
                    }
                  >
                    <Plus size={13} /> Add head
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="px-3 py-1.5 text-[12px]"
                      onClick={() => setEditing(false)}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      className="px-3 py-1.5 text-[12px]"
                      onClick={saveEdit}
                      disabled={busy}
                    >
                      <Save size={13} /> {busy ? "Saving…" : "Save package"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Head-wise: planned vs billed vs collected vs balance */}
          {summary.headwise.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11.5px] uppercase tracking-wide text-slate-text/60">
                    <th className="py-2 pr-3 font-semibold">Fee Head</th>
                    <th className="py-2 pr-3 text-right font-semibold">Planned (Year)</th>
                    <th className="py-2 pr-3 text-right font-semibold">Invoiced</th>
                    <th className="py-2 pr-3 text-right font-semibold">Collected</th>
                    <th className="py-2 text-right font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.headwise.map((row) => (
                    <tr key={row.feeType} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium text-ink">{row.feeType}</td>
                      <td className="py-2 pr-3 text-right text-slate-text">
                        {row.planned ? inr(row.planned) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right text-slate-text">{inr(row.invoiced)}</td>
                      <td className="py-2 pr-3 text-right text-success">{inr(row.paid)}</td>
                      <td
                        className={`py-2 text-right font-semibold ${
                          row.balance > 0 ? "text-alert" : "text-success"
                        }`}
                      >
                        {inr(row.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Receipt trail */}
          {summary.payments.length > 0 && (
            <div>
              <h4 className="mb-2 text-[13px] font-semibold text-ink">Receipts</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[11.5px] uppercase tracking-wide text-slate-text/60">
                      <th className="py-2 pr-3 font-semibold">Receipt No.</th>
                      <th className="py-2 pr-3 font-semibold">Mode</th>
                      <th className="py-2 pr-3 font-semibold">Source</th>
                      <th className="py-2 pr-3 font-semibold">Date</th>
                      <th className="py-2 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.payments.map((payment) => (
                      <tr key={payment._id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-mono text-[12px] text-slate-text">
                          {payment.receiptNo}
                          <span
                            className={`ml-2 rounded px-1 py-px text-[10px] font-semibold uppercase ${
                              payment.receiptMode === "manual"
                                ? "bg-primary/10 text-primary"
                                : "bg-slate-100 text-slate-text/70"
                            }`}
                          >
                            {payment.receiptMode === "manual" ? "manual" : "auto"}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-slate-text">{payment.mode}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase ${
                              payment.source === "online"
                                ? "bg-success/10 text-success"
                                : "bg-slate-100 text-slate-text/70"
                            }`}
                          >
                            {payment.source === "online" ? "online" : "counter"}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-slate-text">{formatDate(payment.paidOn)}</td>
                        <td className="py-2 text-right font-semibold text-ink">
                          {inr(payment.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
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
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState("");
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [showStructureModal, setShowStructureModal] = useState(false);
  const [editingStructure, setEditingStructure] = useState(null);
  const [structureForm, setStructureForm] = useState(emptyStructureForm());
  const [structureBusy, setStructureBusy] = useState(false);
  const [feeStructureBreakdown, setFeeStructureBreakdown] = useState(null);
  const [activeSession, setActiveSession] = useState("");

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

  const [orders, setOrders] = useState([]);
  const [orderBusyId, setOrderBusyId] = useState(null);

  const [recon, setRecon] = useState(null);
  const [reconFrom, setReconFrom] = useState("");
  const [reconTo, setReconTo] = useState("");

  const [concessions, setConcessions] = useState([]);
  const [showConcessionModal, setShowConcessionModal] = useState(false);
  const [concessionBusy, setConcessionBusy] = useState(false);
  const [concessionForm, setConcessionForm] = useState(emptyConcessionForm());

  useEffect(() => {
    const params = new URLSearchParams();
    if (reconFrom) params.set("from", reconFrom);
    if (reconTo) params.set("to", reconTo);
    api.fees.reports
      .reconciliation(params.toString())
      .then(({ data }) => setRecon(data))
      .catch(() => setRecon(null));
  }, [reconFrom, reconTo]);

  const reload = async () => {
    let currentSessionLoaded = false;
    try {
      const { data: currentSessionData } = await api.sessions.current();
      currentSessionLoaded = true;
      const currentName = currentSessionData?.name || "";
      setActiveSession(currentName);
      const structureQuery = new URLSearchParams({
        session: currentName || "__no_active_session__",
      }).toString();
      const invoiceQuery = new URLSearchParams({
        session: currentName || "__no_active_session__",
        limit: "1000",
      }).toString();
      const paymentQuery = new URLSearchParams({
        session: currentName || "__no_active_session__",
        limit: "1000",
      }).toString();
      const [
        studentResponse,
        structureResponse,
        invoiceResponse,
        paymentResponse,
        orderResponse,
        concessionResponse,
      ] = await Promise.all([
        api.students.list("limit=1000"),
        api.fees.structures.list(structureQuery),
        api.fees.invoices.list(invoiceQuery).catch(() => ({ data: [] })),
        api.fees.payments.list(paymentQuery),
        api.fees.orders.list("limit=50").catch(() => ({ data: [] })),
        api.fees.concessions.list().catch(() => ({ data: [] })),
      ]);
      setStudents((studentResponse.data || []).map((item) => ({
        ...item,
        id: item._id,
      })));
      setStructures(structureResponse.data || []);
      setInvoices(invoiceResponse.data || []);
      setPayments(paymentResponse.data || []);
      setPaymentSummary(paymentResponse.paymentSummary || null);
      setOrders(orderResponse.data || []);
      setConcessions(concessionResponse.data || []);
      setLoadError("");
    } catch (err) {
      if (!currentSessionLoaded) setActiveSession("");
      setStructures([]);
      setPayments([]);
      setPaymentSummary(null);
      setLoadError(err.message || "Could not load the active academic session");
    }
  };

  const confirmOrderManually = async (order) => {
    const receivedRef = window.prompt(
      `Confirm ₹${order.amount} received for ${order.admissionNo || order.studentId}.\nEnter the payer reference (UPI ref / bank ref, optional):`,
      "",
    );
    if (receivedRef === null) return;
    setOrderBusyId(order._id);
    try {
      await api.fees.orders.manualConfirm(order._id, { receivedRef: receivedRef.trim() });
      toast("Payment verified and recorded");
      reload();
    } catch (err) {
      toast(err.message || "Failed to confirm order", "error");
    } finally {
      setOrderBusyId(null);
    }
  };

  const cancelOrder = async (order) => {
    if (!window.confirm("Cancel this payment order?")) return;
    setOrderBusyId(order._id);
    try {
      await api.fees.orders.cancel(order._id);
      toast("Order cancelled");
      reload();
    } catch (err) {
      toast(err.message || "Failed to cancel order", "error");
    } finally {
      setOrderBusyId(null);
    }
  };

  const handleSaveConcession = async () => {
    if (!concessionForm.studentId) {
      toast("Select a student", "error");
      return;
    }
    if (!concessionForm.name.trim()) {
      toast("Enter a concession name", "error");
      return;
    }
    const value = Number(concessionForm.value);
    if (!Number.isFinite(value) || value < 0 || (concessionForm.type === "percent" && value > 100)) {
      toast("Enter a valid value (percent 0-100 or flat amount)", "error");
      return;
    }
    if (!concessionForm.session.trim()) {
      toast("Session is required", "error");
      return;
    }
    setConcessionBusy(true);
    try {
      await api.fees.concessions.create({
        studentId: concessionForm.studentId,
        kind: concessionForm.kind,
        name: concessionForm.name.trim(),
        type: concessionForm.type,
        value,
        session: concessionForm.session.trim(),
        feeType: concessionForm.feeType,
        siblingOf: concessionForm.siblingOf,
        notes: concessionForm.notes,
      });
      toast("Concession requested — awaiting approval");
      setShowConcessionModal(false);
      setConcessionForm(emptyConcessionForm());
      reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setConcessionBusy(false);
    }
  };

  const handleConcessionAction = async (concession, action) => {
    try {
      if (action === "approve") {
        await api.fees.concessions.approve(concession._id);
        toast("Concession approved");
      } else if (action === "reject") {
        const reason = window.prompt("Rejection reason (optional):", "") || "";
        await api.fees.concessions.reject(concession._id, reason.trim());
        toast("Concession rejected");
      } else {
        if (!window.confirm("Delete this concession? Future invoices will no longer apply it.")) return;
        await api.fees.concessions.remove(concession._id);
        toast("Concession deleted");
      }
      reload();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const studentMap = useMemo(
    () => new Map(students.map((s) => [String(s.id), s])),
    [students],
  );

  // Keyed by admissionNo — payments/concessions reference students by
  // admission number, not by Mongo id.
  const studentByAdmission = useMemo(
    () => new Map(students.map((s) => [String(s.admissionNo || ""), s])),
    [students],
  );

  const concessionTones = { Active: "success", Requested: "primary", Rejected: "neutral" };

  const invoiceMap = useMemo(
    () => new Map(invoices.map((i) => [String(i._id), i])),
    [invoices],
  );

  const enrichedPayments = useMemo(() => {
    return payments.map((payment) => {
      const id = payment._id || payment.id;
      const student =
        studentByAdmission.get(String(payment.studentId)) ||
        studentMap.get(String(payment.studentId));
      const invoice = invoiceMap.get(String(payment.invoiceId));
      return {
        id,
        receiptNo: payment.receiptNo || "—",
        // Provenance: office receipt book vs minted, counter vs portal.
        receiptMode: payment.receiptMode || "auto",
        source: payment.source || "counter",
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
        clearanceStatus: payment.clearanceStatus || "",
        chequeNo: payment.chequeNo || "",
        paidOn: payment.paidOn,
        collectedBy: payment.collectedBy || "—",
        invoiceAmount: Number(invoice?.amount || 0),
        paidAmount: Number(invoice?.paidAmount || 0),
      };
    });
  }, [payments, studentMap, studentByAdmission, invoiceMap]);

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
    return activeSession ? [activeSession] : [];
  }, [activeSession]);

  const distinctFeeTypes = useMemo(() => {
    const set = new Set(structures.map((s) => s.feeType).filter(Boolean));
    return [...set].sort();
  }, [structures]);

  const filteredStructures = useMemo(() => {
    if (!activeSession) return [];
    return structures.filter((structure) => structure.session === activeSession);
  }, [activeSession, structures]);

  const feeStructureSummaries = useMemo(() => {
    return new Map(
      filteredStructures.map((structure) => {
        const classKey = String(structure.class || "").trim().toLowerCase();
        const classStudents = students.filter(
          (student) =>
            String(student.class || "").trim().toLowerCase() === classKey &&
            String(student.status || "Active").toLowerCase() === "active",
        );
        const classStudentIds = new Set(
          classStudents.map((student) => String(student.admissionNo || student.id || student._id)),
        );
        const studentInvoices = new Map(
          invoices
            .filter(
              (invoice) =>
                classStudentIds.has(String(invoice.studentId)) &&
                invoice.session === activeSession &&
                invoice.feeType === structure.feeType,
            )
            .map((invoice) => [String(invoice.studentId), invoice]),
        );
        const records = classStudents.map((student) => {
          const studentId = String(student.admissionNo || student.id || student._id);
          const invoice = studentInvoices.get(studentId) || null;
          const amount = Number(invoice?.amount || 0);
          const paidAmount = Number(invoice?.paidAmount || 0);
          return {
            student,
            invoice,
            amount,
            paidAmount,
            balance: Math.max(0, amount - paidAmount),
            paid: Boolean(
              invoice &&
              (invoice.status === "Paid" || paidAmount >= amount),
            ),
          };
        });
        const summary = {
          records,
          paidCount: records.filter((record) => record.paid).length,
          pendingCount: records.filter((record) => record.invoice && !record.paid).length,
          notInvoicedCount: records.filter((record) => !record.invoice).length,
          pendingAmount: records.reduce((total, record) => total + record.balance, 0),
        };
        return [String(structure._id), summary];
      }),
    );
  }, [activeSession, filteredStructures, invoices, students]);

  const selectedStructureSummary = feeStructureBreakdown
    ? feeStructureSummaries.get(feeStructureBreakdown.structureId)
    : null;
  const selectedStructureRecords = selectedStructureSummary?.records.filter((record) =>
    feeStructureBreakdown.status === "paid"
      ? record.paid
      : feeStructureBreakdown.status === "pending"
        ? record.invoice && !record.paid
        : !record.invoice,
  ) || [];

  const stats = useMemo(() => {
    const collected = Number(paymentSummary?.netCollected || 0);
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
    return {
      collected,
      count: paymentSummary?.successfulCount ?? payments.length,
      outstanding,
      overdue,
      paidCount,
      partial,
    };
  }, [paymentSummary, payments, invoices]);

  const metricInvoices = useMemo(() => {
    if (selectedMetric === "outstanding") {
      return invoices.filter(
        (invoice) => Number(invoice.amount) - Number(invoice.paidAmount || 0) > 0,
      );
    }
    return invoices;
  }, [invoices, selectedMetric]);

  const collectedDetailPayments = useMemo(
    () => enrichedPayments.filter((payment) => payment.clearanceStatus !== "Bounced"),
    [enrichedPayments],
  );

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
      // Rebuilt wholesale, so every field must be re-seeded — dropping
      // receiptNo here made the receipt input uncontrolled and crashed the
      // Cash/Cheque required-check on the next save.
      receiptNo: "",
      chequeNo: "",
      chequeDate: "",
      bankName: "",
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
    if (form.mode === "Cheque" && !form.chequeNo.trim()) {
      toast("Enter the cheque number", "error");
      return;
    }
    // Offline instruments carry the office's receipt-book number (server
    // enforces this too for Cash/Cheque); blank = service mints RCPT-….
    const receiptNo = form.receiptNo.trim();
    const needsReceipt = form.mode === "Cash" || form.mode === "Cheque";
    if (needsReceipt && !receiptNo) {
      toast(`Enter the receipt number from your receipt book (${form.mode})`, "error");
      return;
    }
    if (receiptNo && !/^[A-Za-z0-9][A-Za-z0-9/_#.-]{2,39}$/.test(receiptNo)) {
      toast("Receipt number: 3-40 chars, letters/digits and - _ / . # only", "error");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.fees.payments.create({
        invoiceId: form.invoiceId,
        amount,
        mode: form.mode,
        transactionId: form.transactionId.trim() || undefined,
        receiptNo: receiptNo || undefined,
        chequeNo: form.mode === "Cheque" ? form.chequeNo.trim() : undefined,
        chequeDate: form.mode === "Cheque" && form.chequeDate ? form.chequeDate : undefined,
        bankName: form.mode === "Cheque" && form.bankName.trim() ? form.bankName.trim() : undefined,
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
    if (!activeSession) {
      toast("Activate an academic session before creating a fee structure", "error");
      return;
    }
    setEditingStructure(null);
    setStructureForm({ ...emptyStructureForm(), session: activeSession });
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
    const session = activeSession.trim();
    const payload = {
      ...structureForm,
      amount,
      session,
    };
    if (!payload.class || !payload.feeType) {
      toast("Class and fee type are required", "error");
      return;
    }
    if (!session) {
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
    const session = activeSession.trim();
    if (!invoiceForm.class || !invoiceForm.feeType) {
      toast("Class and fee type are required", "error");
      return;
    }
    if (!session) {
      toast("Session is required", "error");
      return;
    }
    setInvoiceBusy(true);
    try {
      const payload = { ...invoiceForm, session };
      const { data } = await api.fees.invoices.generatePreview(payload);
      setInvoicePreview(data);
      setInvoiceStep("preview");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setInvoiceBusy(false);
    }
  };

  const handleConfirmInvoices = async () => {
    if (!invoicePreview?.preview) return;
    const nonDupes = invoicePreview.preview.filter((r) => !r.isDuplicate);
    if (nonDupes.length === 0) {
      toast("No new invoices to generate", "info");
      return;
    }
    const session = activeSession.trim();
    setInvoiceBusy(true);
    try {
      await api.fees.invoices.generateConfirm({
        invoices: nonDupes.map((r) => ({
          studentId: r.studentId,
          class: invoiceForm.class,
          feeType: invoiceForm.feeType,
          session,
          // Server re-applies concessions on the GROSS amount — never post the
          // already-netted figure or a student would be discounted twice.
          amount: r.grossAmount != null ? r.grossAmount : r.amount,
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

  const handleClearance = async (payment, action) => {
    if (
      action === "bounce" &&
      !window.confirm("Bounce this cheque? The payment will be reversed from the invoice.")
    ) {
      return;
    }
    try {
      const reason =
        action === "bounce" ? window.prompt("Bounce reason (optional)") || undefined : undefined;
      await api.fees.payments.setClearance(payment.id, { action, reason });
      toast(action === "clear" ? "Cheque cleared" : "Cheque bounced — payment reversed");
      reload();
    } catch (err) {
      toast(err.message, "error");
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

  const handleDownloadReceiptPdf = async () => {
    if (!receiptData?.receiptNo) return;
    try {
      await api.fees.payments.downloadReceiptPdf(receiptData.receiptNo);
      toast("Receipt PDF downloaded", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const payableStudents = students.filter(
    (student) => outstandingForStudent(student.admissionNo || student.id) > 0,
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
                  if (!activeSession) {
                    toast("Activate an academic session before generating invoices", "error");
                    return;
                  }
                  setInvoiceForm((prev) => ({
                    ...prev,
                    session: activeSession,
                  }));
                  setShowInvoiceModal(true);
                  setInvoiceStep("form");
                  setInvoicePreview(null);
                }}
              >
                <FilePlus2 size={15} /> Generate Invoices
              </Button>
            )}
            <Button variant="primary" onClick={() => setShowModal(true)}>
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
          label="Collected (Active Season)"
          value={paymentSummary ? `₹${stats.collected.toLocaleString("en-IN")}` : "—"}
          sub={
            paymentSummary
              ? `${stats.count} successful payments${activeSession ? ` · ${activeSession}` : ""}`
              : loadError
                ? "Collection total unavailable"
                : "Loading collection total…"
          }
          accent="success"
          onClick={() => setSelectedMetric("collected")}
        />
        <StatCard
          icon={TrendingUp}
          label="Collection Rate"
          value={`${stats.collected > 0 || stats.outstanding > 0 ? Math.min(100, Math.round((stats.collected / (stats.collected + stats.outstanding)) * 100)) : 0}%`}
          sub="Collected vs outstanding"
          accent="primary"
          onClick={() => setSelectedMetric("collection-rate")}
        />
        <StatCard
          icon={AlertTriangle}
          label="Outstanding Dues"
          value={inr(stats.outstanding)}
          sub={`${payableStudents.length} students with dues`}
          accent="alert"
          onClick={() => setSelectedMetric("outstanding")}
        />
        <StatCard
          icon={Receipt}
          label="Invoices Overview"
          value={String(invoices.length)}
          sub={`${stats.paidCount} paid · ${stats.partial} partial · ${stats.overdue} overdue`}
          accent="info"
          onClick={() => setSelectedMetric("invoices")}
        />
      </div>

      {selectedMetric && (
        <Card
          title={`${{
            collected: "Collected Payments",
            "collection-rate": "Collection Rate Details",
            outstanding: "Outstanding Dues",
            invoices: "Active Season Invoices",
          }[selectedMetric]}${activeSession ? ` · ${activeSession}` : ""}`}
          action={
            <Button variant="ghost" onClick={() => setSelectedMetric("")} aria-label="Close details">
              <X size={16} /> Close
            </Button>
          }
        >
          {selectedMetric === "collected" ? (
            collectedDetailPayments.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-slate-text/70">
                No payments found for {activeSession || "the active season"}.
              </p>
            ) : (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[11.5px] uppercase tracking-wide text-slate-text/60">
                      <th className="px-5 py-2.5 font-semibold">Receipt</th>
                      <th className="px-5 py-2.5 font-semibold">Student</th>
                      <th className="px-5 py-2.5 font-semibold">Fee Type</th>
                      <th className="px-5 py-2.5 font-semibold">Date</th>
                      <th className="px-5 py-2.5 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collectedDetailPayments.map((payment) => (
                      <tr key={payment.id} className="border-b border-slate-100">
                        <td className="px-5 py-3 font-mono text-slate-text">{payment.receiptNo}</td>
                        <td className="px-5 py-3 font-medium text-ink">{payment.studentName}</td>
                        <td className="px-5 py-3 text-slate-text">{payment.feeType}</td>
                        <td className="px-5 py-3 text-slate-text">{formatDate(payment.paidOn)}</td>
                        <td className="px-5 py-3 text-right font-semibold text-ink">{inr(payment.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            metricInvoices.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-slate-text/70">
                {selectedMetric === "outstanding"
                  ? "No outstanding invoices for this season."
                  : "No invoices found for this season."}
              </p>
            ) : (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[11.5px] uppercase tracking-wide text-slate-text/60">
                      <th className="px-5 py-2.5 font-semibold">Student</th>
                      <th className="px-5 py-2.5 font-semibold">Fee Type</th>
                      <th className="px-5 py-2.5 font-semibold">Due Date</th>
                      <th className="px-5 py-2.5 font-semibold">Status</th>
                      <th className="px-5 py-2.5 text-right font-semibold">Billed</th>
                      <th className="px-5 py-2.5 text-right font-semibold">Paid</th>
                      <th className="px-5 py-2.5 text-right font-semibold">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricInvoices.map((invoice) => {
                      const student = studentByAdmission.get(String(invoice.studentId));
                      const balance = Math.max(
                        0,
                        Number(invoice.amount) - Number(invoice.paidAmount || 0),
                      );
                      return (
                        <tr key={invoice._id} className="border-b border-slate-100">
                          <td className="px-5 py-3 font-medium text-ink">
                            {student?.name || invoice.studentId}
                          </td>
                          <td className="px-5 py-3 text-slate-text">{invoice.feeType}</td>
                          <td className="px-5 py-3 text-slate-text">{formatDate(invoice.dueDate)}</td>
                          <td className="px-5 py-3"><Pill>{invoice.status}</Pill></td>
                          <td className="px-5 py-3 text-right text-slate-text">{inr(invoice.amount)}</td>
                          <td className="px-5 py-3 text-right text-slate-text">{inr(invoice.paidAmount)}</td>
                          <td className="px-5 py-3 text-right font-semibold text-ink">{inr(balance)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </Card>
      )}

      {/* One place: per-student package vs billed vs collected vs balance. */}
      <StudentFeeSummary
        students={students}
        activeSession={activeSession}
        feeTypeOptions={feeTypeOptions}
        canEdit={canStructure}
        onSaved={reload}
      />

      <Card
        title="Fee Structure"
        action={
          <div className="flex items-center gap-2">
            {distinctSessions.length > 0 && (
              <Select
                value={activeSession}
                className="text-[12px] py-1.5 px-2.5"
              >
                <option value="">All Sessions</option>
                {distinctSessions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            )}
            {canStructure && (
              <Button variant="primary" className="text-[12px] py-1.5" onClick={openNewStructure}>
                <Plus size={14} /> Add Fee Structure
              </Button>
            )}
          </div>
        }
      >
        {filteredStructures.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-slate-text/60">
            No fee structures{activeSession ? ` for session ${activeSession}` : ""} configured yet
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[1120px] text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-slate-text/70">
                  <th className="px-4 py-3 font-semibold">Fee Type</th>
                  <th className="px-4 py-3 font-semibold">Class</th>
                  <th className="px-4 py-3 text-right font-semibold">Students</th>
                  <th className="px-4 py-3 text-right font-semibold">Paid</th>
                  <th className="px-4 py-3 text-right font-semibold">Pending</th>
                  <th className="px-4 py-3 text-right font-semibold">Not Invoiced</th>
                  <th className="px-4 py-3 text-right font-semibold">Pending Amount</th>
                  <th className="px-4 py-3 font-semibold">Session</th>
                  <th className="px-4 py-3 font-semibold">Fee Amount</th>
                  <th className="px-4 py-3 font-semibold">Frequency</th>
                  <th className="px-4 py-3 font-semibold">Due Date</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  {canStructure && (
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredStructures.slice(0, 50).map((structure) => {
                  const summary = feeStructureSummaries.get(String(structure._id));
                  const paidPercent = summary?.records.length
                    ? Math.round((summary.paidCount / summary.records.length) * 100)
                    : 0;
                  return (
                    <tr
                      key={structure._id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-3 font-semibold text-ink">
                        {structure.feeType}
                      </td>
                      <td className="px-4 py-3 text-slate-text">
                        {structure.class}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-text">
                        {summary?.records.length || 0}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="inline-flex min-w-10 items-center justify-center rounded-full bg-success/10 px-2.5 py-1 font-semibold tabular-nums text-success transition hover:bg-success/20 disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-text/40"
                          disabled={!summary?.paidCount}
                          onClick={() => setFeeStructureBreakdown({
                            structureId: String(structure._id),
                            feeType: structure.feeType,
                            className: structure.class,
                            status: "paid",
                          })}
                        >
                          {summary?.paidCount || 0}
                        </button>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-success transition-all"
                            style={{ width: `${paidPercent}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="inline-flex min-w-10 items-center justify-center rounded-full bg-alert/10 px-2.5 py-1 font-semibold tabular-nums text-alert transition hover:bg-alert/20 disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-text/40"
                          disabled={!summary?.pendingCount}
                          onClick={() => setFeeStructureBreakdown({
                            structureId: String(structure._id),
                            feeType: structure.feeType,
                            className: structure.class,
                            status: "pending",
                          })}
                        >
                          {summary?.pendingCount || 0}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="inline-flex min-w-10 items-center justify-center rounded-full bg-amber-50 px-2.5 py-1 font-semibold tabular-nums text-amber-700 transition hover:bg-amber-100 disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-text/40"
                          disabled={!summary?.notInvoicedCount}
                          onClick={() => setFeeStructureBreakdown({
                            structureId: String(structure._id),
                            feeType: structure.feeType,
                            className: structure.class,
                            status: "not-invoiced",
                          })}
                        >
                          {summary?.notInvoicedCount || 0}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink">
                        {inr(summary?.pendingAmount || 0)}
                      </td>
                      <td className="px-4 py-3 text-slate-text">
                        {structure.session}
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums text-slate-text">
                        ₹{Number(structure.amount).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3">
                        <Pill>{structure.frequency}</Pill>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-text">
                        {formatDate(structure.dueDate)}
                      </td>
                      <td className="px-4 py-3">
                        <Pill tone={structure.active !== false ? "success" : "neutral"}>
                          {structure.active !== false ? "Active" : "Inactive"}
                        </Pill>
                      </td>
                      {canStructure && (
                        <td className="px-4 py-3">
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
                              className="p-1.5 rounded-lg hover:bg-paper text-slate-text/60 hover:text-primary"
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {feeStructureBreakdown && (
        <Card
          title={`${feeStructureBreakdown.feeType} · Class ${feeStructureBreakdown.className} · ${
            feeStructureBreakdown.status === "paid"
              ? "Paid students"
              : feeStructureBreakdown.status === "pending"
                ? "Pending students"
                : "Students without invoices"
          }`}
          subtitle={`${activeSession} · ${selectedStructureRecords.length} student${selectedStructureRecords.length === 1 ? "" : "s"}${
            feeStructureBreakdown.status === "pending"
              ? ` · ${inr(selectedStructureRecords.reduce((total, record) => total + record.balance, 0))} outstanding`
              : ""
          }`}
          action={
            <Button variant="ghost" onClick={() => setFeeStructureBreakdown(null)}>
              <X size={15} /> Close
            </Button>
          }
        >
          {selectedStructureRecords.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-slate-text/70">
              {feeStructureBreakdown.status === "not-invoiced"
                ? "All active students in this class have an invoice for this fee."
                : `No ${feeStructureBreakdown.status} students found for this fee structure.`}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[760px] text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-slate-text/70">
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Admission No.</th>
                    <th className="px-4 py-3 font-semibold">Payment Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Billed</th>
                    <th className="px-4 py-3 text-right font-semibold">Paid</th>
                    <th className="px-4 py-3 text-right font-semibold">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedStructureRecords.map((record) => (
                    <tr
                      key={record.student.admissionNo || record.student.id || record.student._id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-3 font-medium text-ink">
                        {record.student.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-text">
                        {record.student.admissionNo || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Pill
                          tone={
                            record.paid
                              ? "success"
                              : record.invoice && record.paidAmount > 0
                                ? "warning"
                                : "alert"
                          }
                        >
                          {record.paid
                            ? "Paid"
                            : record.invoice
                              ? record.paidAmount > 0 ? "Partially Paid" : "Pending"
                              : "Invoice not generated"}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-text">
                        {inr(record.invoice ? record.amount : 0)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-text">
                        {inr(record.paidAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink">
                        {inr(record.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card
        title="Reconciliation"
        action={
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={reconFrom}
              onChange={(event) => setReconFrom(event.target.value)}
              className="w-36"
            />
            <span className="text-slate-text/50 text-[12px]">to</span>
            <Input
              type="date"
              value={reconTo}
              onChange={(event) => setReconTo(event.target.value)}
              className="w-36"
            />
          </div>
        }
      >
        {!recon ? (
          <p className="py-6 text-center text-[13px] text-slate-text/60">
            Reconciliation report unavailable (requires finance reports permission).
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-[11.5px] text-slate-text/60 uppercase tracking-wide font-semibold">Recorded</p>
                <p className="font-display text-[20px] font-bold text-ink mt-1">
                  ₹{Number(recon.totalRecorded || 0).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-[11.5px] text-slate-text/60 uppercase tracking-wide font-semibold">Bounced</p>
                <p className="font-display text-[20px] font-bold text-alert mt-1">
                  ₹{Number(recon.bouncedAmount || 0).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-[11.5px] text-slate-text/60 uppercase tracking-wide font-semibold">Net Collected</p>
                <p className="font-display text-[20px] font-bold text-success mt-1">
                  ₹{Number(recon.netCollected || 0).toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-slate-200">
                    <th className="px-5 py-2.5 font-semibold">Mode</th>
                    <th className="px-5 py-2.5 font-semibold text-right">Payments</th>
                    <th className="px-5 py-2.5 font-semibold text-right">Recorded</th>
                    <th className="px-5 py-2.5 font-semibold text-right">Bounced</th>
                    <th className="px-5 py-2.5 font-semibold text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {recon.modes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-5 text-center text-slate-text/60">
                        No payments in this period.
                      </td>
                    </tr>
                  ) : (
                    recon.modes.map((row) => (
                      <tr key={row.mode} className="border-b border-slate-100">
                        <td className="px-5 py-3 font-semibold text-ink">{row.mode}</td>
                        <td className="px-5 py-3 text-right text-slate-text">{row.count}</td>
                        <td className="px-5 py-3 text-right text-slate-text">
                          ₹{Number(row.amount).toLocaleString("en-IN")}
                        </td>
                        <td className="px-5 py-3 text-right text-alert">
                          {row.bouncedAmount
                            ? `₹${Number(row.bouncedAmount).toLocaleString("en-IN")}`
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-ink">
                          ₹{Number(row.amount - row.bouncedAmount).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {recon.chequeClearance.length > 0 && (
              <div>
                <p className="text-[12.5px] font-semibold text-ink mb-2">Cheque clearance</p>
                <div className="flex flex-wrap gap-2">
                  {recon.chequeClearance.map((row) => (
                    <span
                      key={row.status}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] text-slate-text"
                    >
                      <Pill tone={row.status === "Cleared" ? "success" : row.status === "Bounced" ? "alert" : "primary"}>
                        {row.status}
                      </Pill>
                      <span className="ml-2 font-semibold text-ink">
                        {row.count} · ₹{Number(row.amount).toLocaleString("en-IN")}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card
        title="Concessions & Scholarships"
        action={
          canStructure ? (
            <Button
              variant="outline"
              onClick={() => {
                setConcessionForm({ ...emptyConcessionForm(), session: activeSession || "" });
                setShowConcessionModal(true);
              }}
            >
              <Plus size={14} /> New Concession
            </Button>
          ) : null
        }
      >
        {concessions.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-slate-text/60">
            No concessions yet. Sibling discounts, scholarships and manual grants appear here
            after they are requested.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-slate-200">
                  <th className="px-5 py-2.5 font-semibold">Student</th>
                  <th className="px-5 py-2.5 font-semibold">Kind</th>
                  <th className="px-5 py-2.5 font-semibold">Name</th>
                  <th className="px-5 py-2.5 font-semibold">Value</th>
                  <th className="px-5 py-2.5 font-semibold">Scope</th>
                  <th className="px-5 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {concessions.map((concession) => {
                  const student = studentByAdmission.get(String(concession.studentId));
                  return (
                    <tr key={concession._id} className="border-b border-slate-100 hover:bg-paper/60">
                      <td className="px-5 py-3 font-semibold text-ink">
                        {student?.name || concession.studentId}
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={concession.kind === "Scholarship" ? "info" : "neutral"}>
                          {concession.kind}
                        </Pill>
                      </td>
                      <td className="px-5 py-3 text-slate-text">{concession.name}</td>
                      <td className="px-5 py-3 font-medium text-ink">
                        {concession.type === "percent" ? `${concession.value}%` : `₹${Number(concession.value).toLocaleString("en-IN")}`}
                      </td>
                      <td className="px-5 py-3 text-slate-text">
                        {concession.feeType || "All fees"} · {concession.session}
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={concessionTones[concession.status] || "neutral"}>
                          {concession.status}
                        </Pill>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {canStructure && concession.status === "Requested" && (
                            <>
                              <button
                                onClick={() => handleConcessionAction(concession, "approve")}
                                className="text-[12px] font-medium text-success hover:underline"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleConcessionAction(concession, "reject")}
                                className="text-[12px] font-medium text-alert hover:underline"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {canStructure && (
                            <button
                              onClick={() => handleConcessionAction(concession, "delete")}
                              className="text-[12px] font-medium text-slate-text hover:underline"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
            <Button variant="primary" className="mt-4" onClick={() => setShowModal(true)}>
              <Plus size={15} /> Record Payment
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-slate-200">
                  <th className="px-5 py-2.5 font-semibold">Receipt No.</th>
                  <th className="px-5 py-2.5 font-semibold">Student</th>
                  <th className="px-5 py-2.5 font-semibold">Class</th>
                  <th className="px-5 py-2.5 font-semibold">Fee Type</th>
                  <th className="px-5 py-2.5 font-semibold">Amount</th>
                  <th className="px-5 py-2.5 font-semibold">Mode</th>
                  <th className="px-5 py-2.5 font-semibold">Clearance</th>
                  <th className="px-5 py-2.5 font-semibold">Date</th>
                  <th className="px-5 py-2.5 font-semibold">Collected By</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-b border-slate-100 hover:bg-paper/60"
                  >
                    <td className="px-5 py-3">
                      <div className="font-mono text-[12px] text-slate-text">
                        {payment.receiptNo}
                      </div>
                      {/* Provenance: office receipt book vs minted, counter vs portal. */}
                      <div className="mt-0.5 flex items-center gap-1">
                        <span
                          className={`inline-block rounded px-1 py-px text-[10px] font-semibold uppercase tracking-wide ${
                            payment.receiptMode === "manual"
                              ? "bg-primary/10 text-primary"
                              : "bg-slate-100 text-slate-text/70"
                          }`}
                        >
                          {payment.receiptMode === "manual" ? "manual" : "auto"}
                        </span>
                        <span
                          className={`inline-block rounded px-1 py-px text-[10px] font-semibold uppercase tracking-wide ${
                            payment.source === "online"
                              ? "bg-success/10 text-success"
                              : "bg-slate-100 text-slate-text/70"
                          }`}
                        >
                          {payment.source === "online" ? "online" : "counter"}
                        </span>
                      </div>
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
                    <td className="px-5 py-3">
                      {payment.mode === "Cheque" ? (
                        <div className="flex items-center gap-1.5">
                          <Pill
                            tone={
                              payment.clearanceStatus === "Cleared"
                                ? "success"
                                : payment.clearanceStatus === "Bounced"
                                  ? "alert"
                                  : "primary"
                            }
                          >
                            {payment.clearanceStatus || "Pending"}
                          </Pill>
                          {canCollect && payment.clearanceStatus !== "Bounced" && (
                            <span className="flex items-center gap-1.5 text-[11.5px] font-semibold">
                              {payment.clearanceStatus !== "Cleared" && (
                                <button
                                  onClick={() => handleClearance(payment, "clear")}
                                  className="text-success hover:underline"
                                >
                                  Clear
                                </button>
                              )}
                              <button
                                onClick={() => handleClearance(payment, "bounce")}
                                className="text-alert hover:underline"
                              >
                                Bounce
                              </button>
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-text/40">—</span>
                      )}
                    </td>
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

      {/* New Concession Modal */}
      {showConcessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setShowConcessionModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">New Concession</h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  Requested concessions are applied to invoices only after approval.
                </p>
              </div>
              <button
                onClick={() => setShowConcessionModal(false)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">Student *</label>
                <Select
                  value={concessionForm.studentId}
                  onChange={(event) =>
                    setConcessionForm({ ...concessionForm, studentId: event.target.value })
                  }
                  className="w-full"
                >
                  <option value="">Select student…</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.admissionNo || ""}>
                      {student.name} · {student.admissionNo}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Kind *</label>
                  <Select
                    value={concessionForm.kind}
                    onChange={(event) =>
                      setConcessionForm({ ...concessionForm, kind: event.target.value })
                    }
                    className="w-full"
                  >
                    <option value="Sibling">Sibling Discount</option>
                    <option value="Scholarship">Scholarship</option>
                    {/* Statutory entitlements — government-backed quotas, not
                        discretionary discounts. */}
                    <option value="RTE">RTE Quota</option>
                    <option value="SC/ST">SC / ST Concession</option>
                    <option value="Manual">Manual</option>
                  </Select>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Name *</label>
                  <Input
                    placeholder={
                      concessionForm.kind === "Sibling"
                        ? "e.g. Second child 10% off"
                        : concessionForm.kind === "Scholarship"
                          ? "e.g. Merit scholarship"
                          : "e.g. Staff ward concession"
                    }
                    value={concessionForm.name}
                    onChange={(event) =>
                      setConcessionForm({ ...concessionForm, name: event.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Type *</label>
                  <Select
                    value={concessionForm.type}
                    onChange={(event) =>
                      setConcessionForm({ ...concessionForm, type: event.target.value })
                    }
                    className="w-full"
                  >
                    <option value="percent">Percent (%)</option>
                    <option value="flat">Flat (₹)</option>
                  </Select>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Value {concessionForm.type === "percent" ? "(%)" : "(₹)"} *
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={concessionForm.type === "percent" ? 100 : undefined}
                    value={concessionForm.value}
                    onChange={(event) =>
                      setConcessionForm({ ...concessionForm, value: event.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Session *</label>
                  <Select
                    value={activeSession}
                    disabled
                    className="w-full"
                  >
                    {activeSession ? (
                      <option value={activeSession}>{activeSession}</option>
                    ) : (
                      <option value="">No active session</option>
                    )}
                  </Select>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Fee Type</label>
                  <Select
                    value={concessionForm.feeType}
                    onChange={(event) =>
                      setConcessionForm({ ...concessionForm, feeType: event.target.value })
                    }
                    className="w-full"
                  >
                    <option value="">All fee types</option>
                    {distinctFeeTypes.map((feeType) => (
                      <option key={feeType} value={feeType}>
                        {feeType}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {concessionForm.kind === "Sibling" && (
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Elder Sibling (admission no.)
                  </label>
                  <Input
                    placeholder="e.g. ADM001"
                    value={concessionForm.siblingOf}
                    onChange={(event) =>
                      setConcessionForm({ ...concessionForm, siblingOf: event.target.value })
                    }
                  />
                </div>
              )}

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">Notes</label>
                <Input
                  placeholder="Optional justification / reference"
                  value={concessionForm.notes}
                  onChange={(event) =>
                    setConcessionForm({ ...concessionForm, notes: event.target.value })
                  }
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowConcessionModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveConcession}
                disabled={concessionBusy || !concessionForm.studentId || !concessionForm.session}
              >
                <Save size={15} /> {concessionBusy ? "Saving…" : "Request Concession"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
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
                    <option
                      key={student.id}
                      value={student.admissionNo || student.id}
                    >
                      {student.name} — Class {student.class}-{student.section}
                      {outstandingForStudent(student.admissionNo || student.id) > 0
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
                      Receipt No.{" "}
                      {(form.mode === "Cash" || form.mode === "Cheque") ? (
                        <span className="text-alert">*</span>
                      ) : (
                        <span className="font-normal text-slate-text/70">(optional)</span>
                      )}
                    </label>
                    <Input
                      placeholder={
                        form.mode === "Cash" || form.mode === "Cheque"
                          ? "Next number from your receipt book"
                          : "Leave blank to auto-generate RCPT-…"
                      }
                      value={form.receiptNo}
                      onChange={(event) =>
                        setForm({ ...form, receiptNo: event.target.value })
                      }
                    />
                    <p className="text-[11.5px] text-slate-text/70 mt-1">
                      {form.mode === "Cash" || form.mode === "Cheque"
                        ? "Offline payment — enter the printed receipt-book number (duplicates are rejected)."
                        : "Blank generates an automatic RCPT number; type one to use your receipt book instead."}
                    </p>
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

                  {form.mode === "Cheque" && (
                    <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-200 p-3">
                      <div>
                        <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                          Cheque No. *
                        </label>
                        <Input
                          placeholder="Cheque number"
                          value={form.chequeNo}
                          onChange={(event) =>
                            setForm({ ...form, chequeNo: event.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                          Cheque Date
                        </label>
                        <Input
                          type="date"
                          value={form.chequeDate}
                          onChange={(event) =>
                            setForm({ ...form, chequeDate: event.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                          Bank Name
                        </label>
                        <Input
                          placeholder="Issuing bank"
                          value={form.bankName}
                          onChange={(event) =>
                            setForm({ ...form, bankName: event.target.value })
                          }
                        />
                      </div>
                      <p className="col-span-3 text-[11.5px] text-slate-text/70 -mt-1">
                        Cheques start as Pending clearance — bounce reverses the payment from the
                        invoice.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={
                  busy ||
                  !form.studentId ||
                  !form.invoiceId ||
                  form.amount <= 0 ||
                  ((form.mode === "Cash" || form.mode === "Cheque") && !form.receiptNo.trim())
                }
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
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
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
                    value={activeSession}
                    disabled
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

            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
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
                variant="primary"
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
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
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
                        value={activeSession}
                        disabled
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
                      Total: <strong className="text-ink">{invoicePreview.preview?.length || 0}</strong>
                    </span>
                    <span>
                      Duplicates:{" "}
                      <strong className="text-primary-dark">
                        {invoicePreview.preview?.filter((r) => r.isDuplicate).length || 0}
                      </strong>
                    </span>
                    <span>
                      New invoices:{" "}
                      <strong className="text-success">
                        {invoicePreview.preview?.filter((r) => !r.isDuplicate).length || 0}
                      </strong>
                    </span>
                    <span>
                      Net total:{" "}
                      <strong className="text-ink">
                        ₹
                        {(invoicePreview.preview || [])
                          .filter((r) => !r.isDuplicate)
                          .reduce((sum, r) => sum + Number(r.amount || 0), 0)
                          .toLocaleString("en-IN")}
                      </strong>
                    </span>
                  </div>

                  {invoicePreview.preview && invoicePreview.preview.length > 0 && (
                    <div className="overflow-x-auto -mx-5">
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-slate-200">
                            <th className="px-5 py-2.5 font-semibold">Student</th>
                            <th className="px-5 py-2.5 font-semibold">ID</th>
                            <th className="px-5 py-2.5 font-semibold">Amount</th>
                            <th className="px-5 py-2.5 font-semibold">Concession</th>
                            <th className="px-5 py-2.5 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoicePreview.preview.map((row, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-slate-100 hover:bg-paper/60"
                            >
                              <td className="px-5 py-3 font-semibold text-ink">
                                {row.studentName || row.studentId}
                              </td>
                              <td className="px-5 py-3 text-slate-text font-mono text-[12px]">
                                {row.studentId}
                              </td>
                              <td className="px-5 py-3 text-slate-text font-medium">
                                ₹{Number(row.amount).toLocaleString("en-IN")}
                                {row.concessionAmount > 0 && (
                                  <span className="ml-2 text-[11.5px] text-slate-text/60 line-through">
                                    ₹{Number(row.grossAmount).toLocaleString("en-IN")}
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-3">
                                {row.concessionAmount > 0 ? (
                                  <Pill tone="info">
                                    −₹{Number(row.concessionAmount).toLocaleString("en-IN")} ·{" "}
                                    {row.concession?.name}
                                  </Pill>
                                ) : (
                                  <span className="text-slate-text/40">—</span>
                                )}
                              </td>
                              <td className="px-5 py-3">
                                {row.isDuplicate ? (
                                  <Pill tone="primary">Duplicate</Pill>
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

            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
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
                  variant="primary"
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
                  variant="primary"
                  onClick={handleConfirmInvoices}
                  disabled={
                    invoiceBusy ||
                    !invoicePreview?.preview?.filter((r) => !r.isDuplicate).length
                  }
                >
                  {invoiceBusy ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}{" "}
                  {invoiceBusy
                    ? "Generating..."
                    : `Confirm Generated ${
                        invoicePreview?.preview?.filter((r) => !r.isDuplicate).length || 0
                      } Invoices`}
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
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
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
                  <hr className="border-slate-300 my-3" />
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
                  <hr className="border-slate-300 my-3" />
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

            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowReceiptModal(false); setReceiptData(null); }}>
                Close
              </Button>
              {receiptData && (
                <Button variant="outline" onClick={handleDownloadReceiptPdf}>
                  <Download size={15} /> Download PDF
                </Button>
              )}
              {receiptData && (
                <Button variant="primary" onClick={handlePrintReceipt}>
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
