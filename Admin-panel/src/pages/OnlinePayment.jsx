import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { api } from "../lib/api";
import { deriveFeeStatus, groupInvoicesByStudent, loadAllInvoices } from "../lib/feeStatus";
import {
  ShieldCheck,
  Search,
  X,
  Receipt,
  ExternalLink,
  Eye,
  Download,
} from "lucide-react";
import { PageIntro, Card, Button, Input, Pill, Select, toast } from "../components/UI";
import { useMasterOptions } from "../hooks/useMasterOptions";
import { openRazorpayCheckout } from "../utils/razorpay";

const CLASS_OPTIONS_FALLBACK = [
  "All",
  "Nursery",
  "LKG",
  "UKG",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11-Sci",
  "11-Com",
  "12-Sci",
  "12-Com",
];

// Fee-invoice status → Transaction History pill tone.
const INVOICE_TONE = {
  Paid: "success",
  Partial: "primary",
  Overdue: "alert",
  Unpaid: "neutral",
};

// Actions column copy for invoices that aren't settled yet — the invoice has
// been raised, but View/Download only become available once it is Paid.
const INVOICE_HINT = {
  Unpaid: "Invoice generated · Pay this fee",
  Overdue: "Payment overdue · Pay this fee",
  Partial: "Part payment received · Pay the balance",
};

const PICKER_PAGE_SIZE = 12;

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

// Partial orders: whatever is typed is clamped to (0, invoiceOutstanding] so a
// stale/over-typed value can never reach the API unvalidated.
const clampAmount = (value, max) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(Math.round(n), 0), Number(max) || 0);
};

// Partial payments must be at least ₹1,000 and land on ₹100 denominations
// (1500, 2200, 3000 …) — ₹1,056 would be rejected. Paying the invoice's exact
// due amount is always allowed so "pay everything" never breaks, however odd
// the total is. Returns "" when the typed value is acceptable.
const amountError = (value, due) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "Enter an amount";
  if (n > due) return `Max ₹${Number(due).toLocaleString("en-IN")}`;
  if (n === due) return "";
  if (n < 1000) return "Minimum ₹1,000";
  if (n % 100 !== 0) return "Use ₹100 steps — 1000, 1500, 2200 …";
  return "";
};

// Only the Tuition invoice gets a custom (partial) amount box — every other
// fee type is always collected in full.
const isCustomAmountRow = (f) => /tuition/i.test(String(f?.head || f?.feeType || ""));

export default function OnlinePayment() {
  const { options: masterClasses } = useMasterOptions("classes", CLASS_OPTIONS_FALLBACK);
  const CLASS_OPTIONS = ["All", ...masterClasses.filter((c) => c !== "All")];
  // The portal pays only for itself: students are deliberately not granted
  // students:read (the directory call below would 403), and the fee service
  // already pins every invoice/order to their refId server-side.
  const user = useSelector((state) => state.auth.user);
  const isSelf = user?.role === "student";
  const [students, setStudents] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("All");
  const [pickerOpen, setPickerOpen] = useState(false);
  // Select Student modal: page size for the (client-side) student list so a
  // 1000-student directory never renders as one long scroll.
  const [pickerPage, setPickerPage] = useState(0);
  const [student, setStudent] = useState(null);
  const [creating, setCreating] = useState(false);
  const [orderNote, setOrderNote] = useState(null);
  // Payment mode dropdown is hidden in the Fee Summary card for now, so orders
  // always go out as "auto" (school default). Setter kept so the dropdown can
  // simply be uncommented again.
  // eslint-disable-next-line no-unused-vars -- setPayMode used by the commented-out <Select>
  const [payMode, setPayMode] = useState("auto");
  const [upiCheckout, setUpiCheckout] = useState(null);
  // Transaction History → "View invoice": the PDF is fetched with the auth
  // token and shown in a modal (a plain /fees/:id/pdf URL can't carry it).
  const [invoicePreview, setInvoicePreview] = useState(null);
  // invoiceId -> { on, amount }: which fees go into the next order and for how
  // much. Defaults to "everything, full outstanding" so one click still pays
  // all dues; untick a row or trim its amount to pay only a part.
  const [selection, setSelection] = useState({});

  useEffect(() => {
    // Fee collectors browse the whole school; a student reads only their own
    // profile (/students/me is self-scoped by gateOwnProfile) and is fed into
    // the same shape below, so the rest of the page runs unchanged.
    const studentsRequest = isSelf
      ? api.students.me().then((res) => ({ data: res?.data ? [res.data] : [] }))
      : api.students.list("limit=1000");
    Promise.all([
      studentsRequest,
      // Paginated on purpose: a single page can miss invoices and misreport a
      // student as "Pending". Same loader the Student Database uses.
      loadAllInvoices(),
    ])
      .then(([studentResponse, loadedInvoices]) => {
        const invoicesByStudent = groupInvoicesByStudent(loadedInvoices);
        const loadedStudents = (studentResponse.data || []).map((item) => ({
          ...item,
          id: item._id,
          displayId: item.admissionNo,
          avatar:
            item.photoUrl ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=172033&color=fff&bold=true`,
          // Same derivation the Student Database runs — no invoice raised yet
          // keeps the record's own status ("Pending" from onboarding) instead
          // of inventing a payment that never happened.
          feeStatus: deriveFeeStatus(
            invoicesByStudent.get(String(item.admissionNo)) || [],
            item.feeStatus,
          ),
        }));
        setStudents(loadedStudents);
        setInvoices(loadedInvoices);
        setStudent(loadedStudents[0] || null);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [isSelf]);

  const feeStructure = useMemo(
    () =>
      invoices
        .filter((invoice) => String(invoice.studentId) === String(student?.displayId))
        .map((invoice) => ({
          ...invoice,
          head: invoice.feeType,
          termAmount: Math.max(0, Number(invoice.amount) - Number(invoice.paidAmount || 0)),
        })),
    [invoices, student],
  );

  const total = useMemo(
    () => feeStructure.reduce((sum, invoice) => sum + invoice.termAmount, 0),
    [feeStructure],
  );

  // Every invoice starts ticked at its full outstanding, so one click still
  // pays all dues; untick a row — or trim its amount — to pay a part of it.
  useEffect(() => {
    const next = {};
    feeStructure.forEach((f) => {
      next[f._id] = { on: f.termAmount > 0, amount: String(f.termAmount) };
    });
    setSelection(next);
  }, [feeStructure]);

  const selectedLines = feeStructure
    .filter((f) => f.termAmount > 0 && selection[f._id]?.on)
    .map((f) => {
      const raw = String(selection[f._id]?.amount ?? "");
      return {
        invoice: f,
        amount: clampAmount(raw, f.termAmount),
        error: amountError(raw, f.termAmount),
      };
    });

  const orderTotal = selectedLines.reduce((sum, line) => sum + (line.error ? 0 : line.amount), 0);
  const hasInvalidAmount = selectedLines.some((line) => Boolean(line.error));

  // Rows that can actually be ordered (still have dues) + select-all helpers.
  const payable = feeStructure.filter((f) => f.termAmount > 0);
  const allSelected = payable.length > 0 && payable.every((f) => Boolean(selection[f._id]?.on));
  const toggleAll = (on) =>
    setSelection((prev) => {
      const next = { ...prev };
      payable.forEach((f) => {
        next[f._id] = { ...(next[f._id] || { amount: String(f.termAmount) }), on };
      });
      return next;
    });

  // Exactly one ticked → the Actions column stays, but only that row carries a
  // Pay now button; two or more ticked → the whole Actions column disappears
  // and only the big bottom button (Pay now · ₹total) shows.
  const selectedCount = selectedLines.length;
  const showRowActions = selectedCount === 1;

  const filteredStudents = useMemo(() => {
    const q = query.toLowerCase();
    return students.filter((s) => {
      const matchClass = classFilter === "All" || s.class === classFilter;
      const matchQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        String(s.displayId || s.id).toLowerCase().includes(q);
      return matchClass && matchQuery;
    });
  }, [query, classFilter, students]);

  // Clamp the page so narrowing the search can never leave the index past the
  // end of the (client-side) list.
  const pickerPages = Math.max(1, Math.ceil(filteredStudents.length / PICKER_PAGE_SIZE));
  const pickerPageIndex = Math.min(pickerPage, pickerPages - 1);
  const pickerSlice = filteredStudents.slice(
    pickerPageIndex * PICKER_PAGE_SIZE,
    pickerPageIndex * PICKER_PAGE_SIZE + PICKER_PAGE_SIZE,
  );

  const pendingStudents = useMemo(
    () => new Set(students.map((s) => (s.feeStatus !== "Paid" ? s.id : null)).filter(Boolean)).size,
    [students],
  );

  const selectStudent = (s) => {
    setStudent(s);
    setPickerOpen(false);
    setOrderNote(null);
  };

  const createOrder = async () => {
    if (!student || selectedLines.length === 0 || orderTotal <= 0 || hasInvalidAmount) return;
    setCreating(true);
    setError("");
    setOrderNote(null);
    try {
      const created = [];
      for (const line of selectedLines) {
        // One order per ticked invoice, each carrying its own (possibly
        // partial) amount — the server re-validates against the outstanding
        // and resumes a live order with the same amount instead of erroring.
        const payload = { invoiceId: line.invoice._id, amount: line.amount };
        if (payMode !== "auto") payload.mode = payMode;
        const { data } = await api.fees.orders.create(payload);
        // Create returns `_id`; normalize anyway so initiate always gets an id.
        created.push({ ...data, _id: data._id || data.id });
      }
      setOrderNote(created);
      // Pay now must open the gateway straight away. Several fees selected →
      // the first order is paid now, the rest are picked up by the next click
      // (their dues are still open, so they become the next order to resume).
      // Not awaited on purpose: initiate resolves only once the payer finishes
      // checkout, and `creating` must not stay latched on the button for that
      // whole time. Errors surface through initiateOrder's own catch.
      if (created.length > 0) initiateOrder(created[0]._id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCreating(false);
    }
  };

  const initiateOrder = async (orderId) => {
    try {
      const { data } = await api.fees.orders.initiate(orderId);
      if (data?.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
        return;
      }
      const chk = data?.checkout;
      if (chk?.keyId && chk?.providerOrderId) {
        const payload = await openRazorpayCheckout({
          keyId: chk.keyId,
          orderId: chk.providerOrderId,
          amount: chk.amount,
          currency: chk.currency,
          description: "School fee payment",
        });
        await api.fees.orders.confirm(orderId, payload);
        toast("Payment confirmed", "success");
      } else if (chk) {
        if (chk.upiIntent || chk.upiId) setUpiCheckout({ ...chk, orderId });
        setOrderNote([
          { id: orderId, externalRef: orderId, amount: chk.amount || 0, status: "awaiting_manual_confirm" },
        ]);
      } else {
        setError("Payment gateway is not configured for this school yet.");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // One click on a row: build an order for just that invoice (Tuition uses the
  // typed amount, everything else pays its full dues) and open checkout.
  const payNow = async (f) => {
    // Unchecked row = not part of this payment, so no order may be raised.
    if (creating || f.termAmount <= 0 || !selection[f._id]?.on) return;
    const due = f.termAmount;
    const raw = isCustomAmountRow(f) ? String(selection[f._id]?.amount ?? "") : String(due);
    const amount = clampAmount(raw, due);
    const validationError = amountError(raw, due);
    if (validationError) {
      setError(validationError);
      return;
    }
    setCreating(true);
    setError("");
    setOrderNote(null);
    try {
      const payload = { invoiceId: f._id, amount };
      if (payMode !== "auto") payload.mode = payMode;
      const { data } = await api.fees.orders.create(payload);
      const order = { ...data, _id: data._id || data.id };
      setOrderNote([order]);
      // Deliberately not awaited — see createOrder. The button re-enables once
      // the order exists; checkout keeps running on its own.
      initiateOrder(order._id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCreating(false);
    }
  };

  // Transaction History actions — both PDF endpoints need the Bearer token, so
  // "View" fetches a blob and previews it in-page, "Download" saves it.
  const viewInvoice = async (inv) => {
    setInvoicePreview({ inv, url: "", loading: true });
    try {
      const url = await api.fees.invoices.previewUrl(inv._id);
      setInvoicePreview({ inv, url, loading: false });
    } catch (requestError) {
      setInvoicePreview(null);
      setError(requestError.message);
    }
  };

  const closeInvoicePreview = () => {
    setInvoicePreview((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  const downloadInvoice = async (inv) => {
    try {
      await api.fees.invoices.downloadPdf(inv._id);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Finance" title="Online Fees Payment" description="Loading fee invoices…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow={isSelf ? "My Fees" : "Finance"}
        title={isSelf ? "Pay Fees Online" : "Online Fees Payment"}
        description={
          isSelf
            ? "Pay your outstanding fee invoices online. An order is confirmed only once the school office verifies the payment."
            : "Generate payment orders for unpaid invoices. Provider checkout is enabled only after gateway configuration."
        }
      />

      {error && (
        <Card>
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {orderNote && (
        <Card>
          <div className="flex items-start gap-3">
            <Receipt size={18} className="text-primary-dark mt-0.5 shrink-0" />
            <div>
              <p className="text-[13.5px] font-semibold text-ink">
                Payment {orderNote.length > 1 ? "orders" : "order"} created
              </p>
              <p className="text-[12.5px] text-slate-text/80 mt-1">
                Share the payment details with {isSelf ? "the school office" : "the parent"} — the order is
                confirmed once the office verifies the receipt (bank transfer / UPI reference). No fee is
                recorded as paid before that.
              </p>
              <div className="mt-2 space-y-1">
                {orderNote.map((o) => (
                  <p key={o.id} className="text-[12px] font-mono text-slate-text/70">
                    {o.externalRef} · ₹{o.amount.toLocaleString("en-IN")} · {o.status}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {upiCheckout && (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13.5px] font-semibold text-ink">Pay by UPI</p>
              {upiCheckout.upiId && (
                <p className="text-[12.5px] text-slate-text/80 mt-1">
                  UPI ID: <span className="font-mono font-semibold text-ink">{upiCheckout.upiId}</span>
                </p>
              )}
              <p className="text-[12px] text-slate-text/70 mt-1">
                Open the UPI app to pay ₹{Number(upiCheckout.amount).toLocaleString("en-IN")}, then share the
                transaction reference with the school office for verification.
              </p>
              <div className="flex items-center gap-2 mt-3">
                {upiCheckout.upiIntent && (
                  <Button variant="primary" onClick={() => { window.location.href = upiCheckout.upiIntent; }}>
                    <ExternalLink size={13} /> Open UPI app
                  </Button>
                )}
                {upiCheckout.upiId && (
                  <Button
                    variant="outline"
                    onClick={() => { navigator.clipboard?.writeText(upiCheckout.upiId); toast("UPI ID copied"); }}
                  >
                    Copy UPI ID
                  </Button>
                )}
              </div>
            </div>
            <button onClick={() => setUpiCheckout(null)} className="p-2 rounded-lg hover:bg-paper text-slate-text">
              <X size={16} />
            </button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card bodyClassName="p-5">
          <p className="text-[12.5px] text-slate-text/80 font-medium">
            {isSelf ? "My Fee Invoices" : "Pending Students"}
          </p>
          <p className="font-display text-[28px] font-bold text-ink mt-1 leading-none">
            {isSelf ? feeStructure.length : pendingStudents}
          </p>
          <p className="text-[11.5px] text-slate-text/60 mt-2">
            {isSelf ? "Invoices raised for you" : "Students with outstanding fees"}
          </p>
        </Card>
        <Card bodyClassName="p-5">
          <p className="text-[12.5px] text-slate-text/80 font-medium">This Student Dues</p>
          <p className="font-display text-[28px] font-bold text-ink mt-1 leading-none">₹{total.toLocaleString("en-IN")}</p>
          <p className="text-[11.5px] text-slate-text/60 mt-2">{student?.name || "—"} outstanding amount</p>
        </Card>
        <Card bodyClassName="p-5">
          <p className="text-[12.5px] text-slate-text/80 font-medium">Paid Invoices</p>
          <p className="font-display text-[28px] font-bold text-ink mt-1 leading-none">
            {feeStructure.filter((f) => f.status === "Paid").length}
          </p>
          <p className="text-[11.5px] text-slate-text/60 mt-2">
            of {feeStructure.length} invoices for this student
          </p>
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="Fee Summary">
          {/* One student only for the portal account — there is nobody to
              switch to, so the header is static instead of a picker trigger. */}
          {isSelf ? (
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-200">
              <img src={student?.avatar} alt={student?.name} className="w-12 h-12 rounded-xl object-cover" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink text-[13.5px] truncate">{student?.name || "—"}</p>
                <p className="text-[11.5px] text-slate-text/60">
                  {student?.displayId || ""} · Class {student?.class}-{student?.section}
                </p>
              </div>
              <Pill tone="primary">My account</Pill>
            </div>
          ) : (
          <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-200 w-full text-left">
            <img src={student?.avatar} alt={student?.name} className="w-12 h-12 rounded-xl object-cover" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-ink text-[13.5px] truncate">{student?.name || "Select student"}</p>
              <p className="text-[11.5px] text-slate-text/60">
                {student?.displayId || ""} · Class {student?.class}-{student?.section}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setPickerOpen(true); setQuery(""); setPickerPage(0); }}
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-slate-700 hover:border-primary hover:text-primary-dark transition-colors"
            >
              Select Another Student
            </button>
          </div>
          )}

          {feeStructure.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[13.5px] font-semibold text-ink">No invoices</p>
              <p className="text-[12.5px] text-slate-text/60 mt-1">
                {isSelf ? "No fee invoice has been raised for you yet." : "Add a fee invoice for this student."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-text/70">
                      <th className="py-2 pr-3 w-9">
                        <input
                          type="checkbox"
                          aria-label="Select all dues"
                          checked={allSelected}
                          disabled={payable.length === 0}
                          onChange={(e) => toggleAll(e.target.checked)}
                          className="w-4 h-4 accent-primary align-middle"
                        />
                      </th>
                      <th className="py-2 pr-3 font-semibold">Fee Type</th>
                      <th className="py-2 pr-3 font-semibold text-right">Total Amount</th>
                      <th className="py-2 pr-3 font-semibold text-right">Amount to Pay</th>
                      {showRowActions && (
                        <th className="py-2 font-semibold text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {feeStructure.map((f) => {
                      const line = selection[f._id] || { on: false, amount: "" };
                      const due = f.termAmount;
                      const paid = Number(f.paidAmount || 0);
                      const customAmount = isCustomAmountRow(f);
                      const error =
                        line.on && due > 0 && customAmount ? amountError(line.amount, due) : "";
                      return (
                        <tr key={f._id} className="border-b border-slate-100 last:border-b-0 align-top">
                          <td className="py-2.5 pr-3">
                            <input
                              type="checkbox"
                              aria-label={`Select ${f.head}`}
                              checked={Boolean(line.on)}
                              disabled={due <= 0}
                              onChange={(e) =>
                                setSelection((prev) => ({
                                  ...prev,
                                  [f._id]: { ...(prev[f._id] || { amount: "" }), on: e.target.checked },
                                }))
                              }
                              className="w-4 h-4 accent-primary align-middle"
                            />
                          </td>
                          <td className="py-2.5 pr-3">
                            <span
                              className={`text-[13px] ${
                                due > 0 ? "text-ink font-medium" : "text-slate-text/40 line-through"
                              }`}
                            >
                              {f.head}
                            </span>
                            {due > 0 && (
                              <p className="text-[11px] text-slate-text/60 mt-0.5">
                                ₹{due.toLocaleString("en-IN")} outstanding
                                {paid > 0 ? ` · ₹${paid.toLocaleString("en-IN")} paid` : ""}
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 text-right text-[13px] text-ink font-medium whitespace-nowrap">
                            ₹{Number(f.amount || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2.5 pr-3 text-right">
                            {due <= 0 ? (
                              <span className="text-[13px] text-slate-text/70">Fully paid</span>
                            ) : !customAmount ? (
                              // No custom box outside Tuition — this fee always pays in full.
                              <span className="text-[13px] text-ink font-medium whitespace-nowrap">
                                ₹{due.toLocaleString("en-IN")}
                              </span>
                            ) : line.on ? (
                              <>
                                <span className="flex items-center justify-end gap-1.5">
                                  <span className="text-[12px] text-slate-text/60">₹</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={line.amount}
                                    aria-label={`Amount for ${f.head}`}
                                    onChange={(e) =>
                                      setSelection((prev) => ({
                                        ...prev,
                                        [f._id]: {
                                          ...(prev[f._id] || { on: true }),
                                          amount: e.target.value.replace(/[^\d]/g, "").slice(0, 7),
                                        },
                                      }))
                                    }
                                    className={`w-28 rounded-lg border px-2 py-1 text-right text-[12.5px] text-ink outline-none transition-colors ${
                                      error
                                        ? "border-alert ring-2 ring-alert/20"
                                        : "border-slate-300 focus:border-primary"
                                    }`}
                                  />
                                  <span className="text-[11px] text-slate-text/50 whitespace-nowrap">
                                    of ₹{due.toLocaleString("en-IN")}
                                  </span>
                                </span>
                                {error && <p className="text-[11px] text-alert mt-1">{error}</p>}
                              </>
                            ) : (
                              <span className="text-[13px] text-slate-text/70">—</span>
                            )}
                          </td>
                          {showRowActions ? (
                            due > 0 ? (
                              line.on ? (
                                <td className="py-2.5 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    disabled={creating || Boolean(error)}
                                    title={
                                      error
                                        ? "Fix the amount first"
                                        : "Create an order for this fee and open checkout"
                                    }
                                    onClick={() => payNow(f)}
                                    className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed"
                                  >
                                    {creating ? "Working…" : "Pay now"}
                                  </button>
                                </td>
                              ) : (
                                // This row isn't the selected one — keep the cell so the
                                // single Actions column stays aligned.
                                <td className="py-2.5" />
                              )
                            ) : (
                              <td className="py-2.5 text-right">
                                <Pill tone="success">Paid</Pill>
                              </td>
                            )
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between pt-3 mt-3 border-t border-slate-200 font-bold text-ink">
                <span>Total (Current Dues)</span>
                <span className="font-display">₹{total.toLocaleString("en-IN")}</span>
              </div>
              {selectedCount > 0 && orderTotal !== total && (
                <div className="flex justify-between text-[12.5px] font-semibold text-primary-dark">
                  <span>Order amount ({selectedLines.length} fee{selectedLines.length === 1 ? "" : "s"} selected)</span>
                  <span>₹{orderTotal.toLocaleString("en-IN")}</span>
                </div>
              )}
            </>
          )}

          {total > 0 ? (
            <>
              {/* Payment mode picker hidden for now — "Auto (school default)"
                  stays selected (payMode state is still "auto"). Uncomment to
                  bring the dropdown back.
              <label className="block text-[11.5px] font-semibold text-ink uppercase tracking-wide mt-4 mb-1">
                Payment mode
              </label>
              <Select value={payMode} onChange={(e) => setPayMode(e.target.value)} className="w-full">
                <option value="auto">Auto (school default)</option>
                <option value="upi">UPI (pay by app / QR)</option>
              </Select>
              */}
              {selectedLines.length === 0 ? (
                <p className="text-[12px] text-slate-text/70 mt-3 text-center">
                  Tick at least one fee to create a payment order.
                </p>
              ) : showRowActions ? (
                // Exactly one fee ticked — its row-level Pay now button does the job.
                null
              ) : (
                <Button
                  variant="primary"
                  className="w-full justify-center mt-3"
                  disabled={creating || hasInvalidAmount || orderTotal <= 0}
                  onClick={createOrder}
                >
                  {creating ? "Creating…" : `Pay now · ₹${orderTotal.toLocaleString("en-IN")}`}
                </Button>
              )}
              {hasInvalidAmount && (
                <p className="text-[11.5px] text-alert mt-2 text-center">
                  Fix the highlighted amount — partials start at ₹1,000 in ₹100 steps (1000, 1500, 2200 …),
                  or pay the full due.
                </p>
              )}
            </>
          ) : feeStructure.length === 0 ? (
            <div className="text-center py-5 mt-2">
              {/* Nothing raised yet, so nothing is paid — never "Fees paid". */}
              <Pill tone="neutral">Pending</Pill>
            </div>
          ) : (
            <div className="text-center py-5 mt-2">
              <Pill tone="success">Fees paid</Pill>
            </div>
          )}
        </Card>

        <Card title="Transaction History">
          {feeStructure.length === 0 ? (
            <div className="py-12 text-center">
              <Receipt size={38} className="mx-auto text-slate-text/30 mb-3" />
              <p className="text-[14px] font-semibold text-ink">
                {isSelf ? "No invoices yet" : "No fee invoices for this student"}
              </p>
              <p className="text-[12.5px] text-slate-text/70 mt-1">
                {isSelf
                  ? "Invoices raised for you will be listed here."
                  : "Generate a fee invoice to see it here."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-text/70">
                    <th className="py-2 pr-3 font-semibold">Fee Type</th>
                    <th className="py-2 pr-3 font-semibold text-right">Total Amount</th>
                    <th className="py-2 pr-3 font-semibold text-right">Paid</th>
                    <th className="py-2 pr-3 font-semibold text-right">Outstanding</th>
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 pr-3 font-semibold">Due Date</th>
                    <th className="py-2 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {feeStructure.map((f) => {
                    const paid = Number(f.paidAmount || 0);
                    return (
                      <tr key={f._id} className="border-b border-slate-100 last:border-b-0 align-top">
                        <td className="py-2.5 pr-3">
                          <p className="text-[13px] font-medium text-ink">{f.feeType}</p>
                          <p className="text-[11px] text-slate-text/60 mt-0.5">
                            {f.session}
                            {f.receiptNo ? ` · Receipt ${f.receiptNo}` : ""}
                          </p>
                        </td>
                        <td className="py-2.5 pr-3 text-right text-[13px] text-ink whitespace-nowrap">
                          ₹{Number(f.amount || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 pr-3 text-right text-[13px] text-slate-text whitespace-nowrap">
                          ₹{paid.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 pr-3 text-right text-[13px] font-medium text-ink whitespace-nowrap">
                          ₹{f.termAmount.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 pr-3">
                          <Pill tone={INVOICE_TONE[f.status] || "neutral"}>{f.status || "Unpaid"}</Pill>
                        </td>
                        <td className="py-2.5 pr-3 text-[12.5px] text-slate-text whitespace-nowrap">
                          {fmtDate(f.dueDate)}
                        </td>
                        <td className="py-2.5 text-right whitespace-nowrap">
                          {f.status === "Paid" ? (
                            <span className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => viewInvoice(f)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
                              >
                                <Eye size={13} /> View invoice
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadInvoice(f)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
                              >
                                <Download size={13} /> Download invoice
                              </button>
                            </span>
                          ) : (
                            // Not settled yet — the invoice exists, but there is
                            // nothing to keep until the fee is actually paid.
                            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-text/70">
                              <Receipt size={13} className="text-primary-dark/70 shrink-0" />
                              {INVOICE_HINT[f.status] || INVOICE_HINT.Unpaid}
                            </span>
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
      </div>

      <Card>
        <p className="text-[12.5px] text-slate-text/80 flex items-center gap-2">
          <ShieldCheck size={15} className="text-success" />
          Payment orders are confirmed only through the configured provider webhook. Until then they remain
          pending and no fee is recorded as paid.
        </p>
      </Card>

      {invoicePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => !invoicePreview.loading && closeInvoicePreview()}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">Fee invoice</h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  {invoicePreview.inv.feeType} · {invoicePreview.inv.session}
                </p>
              </div>
              <button
                onClick={closeInvoicePreview}
                className="text-slate-text/40 hover:text-ink disabled:opacity-50"
                disabled={invoicePreview.loading}
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 min-h-0 bg-slate-100">
              {invoicePreview.loading || !invoicePreview.url ? (
                <div className="h-full flex items-center justify-center text-[13px] text-slate-text/70">
                  Loading invoice…
                </div>
              ) : (
                <iframe src={invoicePreview.url} title="Fee invoice" className="w-full h-full" />
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200">
              <Button variant="outline" onClick={closeInvoicePreview}>Close</Button>
              <Button
                variant="primary"
                onClick={() => downloadInvoice(invoicePreview.inv)}
              >
                Download invoice
              </Button>
            </div>
          </div>
        </div>
      )}

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setPickerOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">Select Student</h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">Choose the student to create a payment order for.</p>
              </div>
              <button onClick={() => setPickerOpen(false)} className="p-2 rounded-lg hover:bg-paper text-slate-text">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 pt-4 flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40" />
                <Input
                  placeholder="Search by name or ID..."
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPickerPage(0); }}
                  className="pl-8"
                />
              </div>
              <Select
                value={classFilter}
                onChange={(e) => { setClassFilter(e.target.value); setPickerPage(0); }}
                className="min-w-[120px]"
              >
                {CLASS_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c === "All" ? "All Classes" : c}</option>
                ))}
              </Select>
            </div>

            <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <div className="py-12 text-center">
                  <Search size={30} className="mx-auto text-slate-text/30 mb-2" />
                  <p className="text-[13.5px] font-medium text-ink">No students found</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {pickerSlice.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => selectStudent(s)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                        student?.id === s.id ? "border-primary bg-primary/10" : "border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      <img src={s.avatar} alt={s.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-ink truncate">{s.name}</p>
                        <p className="text-[11.5px] text-slate-text/60">{s.displayId} · Class {s.class}-{s.section}</p>
                      </div>
                      <span className="shrink-0">
                        <Pill tone={s.feeStatus === "Paid" ? "success" : "primary"}>{s.feeStatus}</Pill>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {filteredStudents.length > 0 && (
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 bg-paper/60">
                <p className="text-[12px] text-slate-text/70">
                  Showing {pickerPageIndex * PICKER_PAGE_SIZE + 1}–
                  {Math.min((pickerPageIndex + 1) * PICKER_PAGE_SIZE, filteredStudents.length)} of{" "}
                  {filteredStudents.length} students
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pickerPageIndex === 0}
                    onClick={() => setPickerPage(pickerPageIndex - 1)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:border-slate-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-[12px] text-slate-text/70 whitespace-nowrap">
                    Page {pickerPageIndex + 1} of {pickerPages}
                  </span>
                  <button
                    type="button"
                    disabled={pickerPageIndex >= pickerPages - 1}
                    onClick={() => setPickerPage(pickerPageIndex + 1)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:border-slate-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}