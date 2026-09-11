import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import {
  ShieldCheck,
  Search,
  X,
  Receipt,
  FileClock,
  ExternalLink,
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

const ORDER_TONE = {
  pending: "amber",
  awaiting_confirmation: "amber",
  awaiting_manual_confirm: "amber",
  completed: "success",
  failed: "alert",
  cancelled: "neutral",
};

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

export default function OnlinePayment() {
  const { options: masterClasses } = useMasterOptions("classes", CLASS_OPTIONS_FALLBACK);
  const CLASS_OPTIONS = ["All", ...masterClasses.filter((c) => c !== "All")];
  const [students, setStudents] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("All");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [student, setStudent] = useState(null);
  const [creating, setCreating] = useState(false);
  const [orderNote, setOrderNote] = useState(null);

  useEffect(() => {
    Promise.all([
      api.students.list("limit=1000"),
      api.fees.invoices.list(),
      api.fees.orders.list(),
    ])
      .then(([studentResponse, invoiceResponse, orderResponse]) => {
        const loadedInvoices = invoiceResponse.data || [];
        const loadedStudents = (studentResponse.data || []).map((item) => {
          const studentInvoices = loadedInvoices.filter(
            (invoice) => String(invoice.studentId) === String(item.admissionNo),
          );
          const pendingAmount = studentInvoices.reduce(
            (sum, invoice) =>
              sum + Math.max(0, Number(invoice.amount) - Number(invoice.paidAmount || 0)),
            0,
          );
          return {
            ...item,
            id: item._id,
            displayId: item.admissionNo,
            avatar:
              item.photoUrl ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=16213E&color=fff&bold=true`,
            feeStatus: pendingAmount === 0 ? "Paid" : "Pending",
          };
        });
        setStudents(loadedStudents);
        setInvoices(loadedInvoices);
        setOrders(orderResponse.data || []);
        setStudent(loadedStudents[0] || null);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

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

  const studentOrders = useMemo(
    () => orders.filter((o) => String(o.studentId) === String(student?.displayId)),
    [orders, student],
  );

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
    if (!student || feeStructure.length === 0) return;
    setCreating(true);
    setError("");
    setOrderNote(null);
    try {
      const created = [];
      for (const invoice of feeStructure) {
        if (invoice.termAmount <= 0) continue;
        const { data } = await api.fees.orders.create({ invoiceId: invoice._id });
        created.push(data);
      }
      setOrders((prev) => [...created, ...prev]);
      setOrderNote(created);
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
        await api.payments.orders.confirm(orderId, payload);
        setOrders((prev) =>
          prev.map((x) =>
            x._id === orderId
              ? { ...x, status: "completed", confirmedAt: new Date().toISOString() }
              : x,
          ),
        );
        toast("Payment confirmed", "success");
      } else if (chk) {
        setOrders((prev) =>
          prev.map((x) =>
            x._id === orderId ? { ...x, status: "awaiting_manual_confirm" } : x,
          ),
        );
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
        eyebrow="Finance"
        title="Online Fees Payment"
        description="Generate payment orders for unpaid invoices. Provider checkout is enabled only after gateway configuration."
      />

      {error && (
        <Card>
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {orderNote && (
        <Card>
          <div className="flex items-start gap-3">
            <Receipt size={18} className="text-amber-dark mt-0.5 shrink-0" />
            <div>
              <p className="text-[13.5px] font-semibold text-ink">
                Payment {orderNote.length > 1 ? "orders" : "order"} created
              </p>
              <p className="text-[12.5px] text-slate-text/80 mt-1">
                Share the payment details with the parent — the order is confirmed once the office verifies
                the receipt (bank transfer / UPI reference). No fee is recorded as paid before that.
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

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card bodyClassName="p-5">
          <p className="text-[12.5px] text-slate-text/80 font-medium">Pending Students</p>
          <p className="font-display text-[28px] font-bold text-ink mt-1 leading-none">{pendingStudents}</p>
          <p className="text-[11.5px] text-slate-text/60 mt-2">Students with outstanding fees</p>
        </Card>
        <Card bodyClassName="p-5">
          <p className="text-[12.5px] text-slate-text/80 font-medium">This Student Dues</p>
          <p className="font-display text-[28px] font-bold text-ink mt-1 leading-none">₹{total.toLocaleString("en-IN")}</p>
          <p className="text-[11.5px] text-slate-text/60 mt-2">{student?.name || "—"} outstanding amount</p>
        </Card>
        <Card bodyClassName="p-5">
          <p className="text-[12.5px] text-slate-text/80 font-medium">Payment Orders</p>
          <p className="font-display text-[28px] font-bold text-ink mt-1 leading-none">{studentOrders.length}</p>
          <p className="text-[11.5px] text-slate-text/60 mt-2">Orders for this student</p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Fee Summary" className="lg:col-span-1 h-fit">
          <button
            onClick={() => { setPickerOpen(true); setQuery(""); }}
            className="flex items-center gap-3 pb-4 mb-4 border-b border-black/[0.06] w-full text-left hover:bg-paper/60 rounded-lg transition-colors"
          >
            <img src={student?.avatar} alt={student?.name} className="w-12 h-12 rounded-xl object-cover" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-ink text-[13.5px] truncate">{student?.name || "Select student"}</p>
              <p className="text-[11.5px] text-slate-text/60">
                {student?.displayId || ""} · Class {student?.class}-{student?.section}
              </p>
            </div>
            <span className="text-[11.5px] font-semibold text-info shrink-0">Change</span>
          </button>

          {feeStructure.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[13.5px] font-semibold text-ink">No invoices</p>
              <p className="text-[12.5px] text-slate-text/60 mt-1">Add a fee invoice for this student.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {feeStructure.map((f) => (
                  <div key={f._id} className="flex justify-between text-[13px]">
                    <span className="text-slate-text">{f.head}</span>
                    <span className="text-ink font-medium">₹{f.termAmount.toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-3 mt-3 border-t border-black/[0.06] font-bold text-ink">
                <span>Total (Current Dues)</span>
                <span className="font-display">₹{total.toLocaleString("en-IN")}</span>
              </div>
            </>
          )}

          {total > 0 ? (
            <Button
              variant="amber"
              className="w-full justify-center mt-4"
              disabled={creating}
              onClick={createOrder}
            >
              {creating ? "Creating order…" : `Create payment order · ₹${total.toLocaleString("en-IN")}`}
            </Button>
          ) : (
            <div className="text-center py-5 mt-2">
              <Pill tone="success">Fees paid</Pill>
            </div>
          )}
        </Card>

        <Card title="Payment Orders" className="lg:col-span-2">
          {studentOrders.length === 0 ? (
            <div className="py-12 text-center">
              <FileClock size={38} className="mx-auto text-slate-text/30 mb-3" />
              <p className="text-[14px] font-semibold text-ink">No orders for this student</p>
              <p className="text-[12.5px] text-slate-text/70 mt-1">
                Generate a payment order from the fee summary to begin.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {studentOrders.map((o) => (
                <div key={o._id} className="rounded-xl border border-black/[0.06] p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-ink truncate">{o.externalRef}</p>
                      <Pill tone={ORDER_TONE[o.status] || "neutral"}>{o.status}</Pill>
                    </div>
                    <p className="text-[11.5px] text-slate-text/60 mt-0.5">
                        ₹{o.amount.toLocaleString("en-IN")} · {o.gatewayMode || "—"} · {o.confirmedAt ? fmtDate(o.confirmedAt) : "Created " + fmtDate(o.createdAt)}
                      </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {o.status === "pending" && (
                      <Button variant="outline" onClick={() => initiateOrder(o._id)}>
                        <ExternalLink size={13} /> Initiate
                      </Button>
                    )}
                    {o.status === "pending" && (
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await api.fees.orders.cancel(o._id);
                            setOrders((prev) => prev.map((x) => (x._id === o._id ? { ...x, status: "cancelled" } : x)));
                          } catch (err) {
                            setError(err.message);
                          }
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
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

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setPickerOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
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
                <Input placeholder="Search by name or ID..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
              </div>
              <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="min-w-[120px]">
                {CLASS_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c === "All" ? "All Classes" : c}</option>
                ))}
              </Select>
            </div>

            <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <div className="py-12 text-center">
                  <Search size={30} className="mx-auto text-slate-text/30 mb-2" />
                  <p className="text-[13.5px] font-medium text-ink">No students found</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {filteredStudents.slice(0, 30).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => selectStudent(s)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                        student?.id === s.id ? "border-amber bg-amber/10" : "border-black/[0.06] hover:border-black/20"
                      }`}
                    >
                      <img src={s.avatar} alt={s.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-ink truncate">{s.name}</p>
                        <p className="text-[11.5px] text-slate-text/60">{s.displayId} · Class {s.class}-{s.section}</p>
                      </div>
                      <span className="shrink-0">
                        <Pill tone={s.feeStatus === "Paid" ? "success" : "amber"}>{s.feeStatus}</Pill>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}