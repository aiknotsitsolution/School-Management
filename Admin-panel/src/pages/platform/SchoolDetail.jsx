import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Users, CreditCard, FileText, Pencil } from "lucide-react";
import { api } from "../../lib/api";
import { Button, Card, Input, PageIntro, Pill, toast } from "../../components/UI";

const onboardingTone = (status) => {
  const map = { live: "success", subscribed: "success", configured: "amber", created: "info" };
  return map[status] || "neutral";
};

const ONBOARDING_FLOW = ["created", "configured", "subscribed", "live"];
const nextStepOf = (current) => {
  const index = ONBOARDING_FLOW.indexOf(current);
  return index >= 0 && index < ONBOARDING_FLOW.length - 1 ? ONBOARDING_FLOW[index + 1] : null;
};

const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

const PROFILE_FIELDS = [
  { key: "code", label: "Code", className: "font-mono text-ink" },
  { key: "shortName", label: "Short Name" },
  { key: "plan", label: "Plan", render: (v) => <Pill tone="info">{v}</Pill> },
  { key: "status", label: "Status", render: (v) => <Pill tone={v === "active" ? "success" : "alert"}>{v}</Pill> },
  { key: "session", label: "Session" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address", span: true },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "pincode", label: "Pincode" },
  { key: "website", label: "Website" },
  { key: "createdAt", label: "Created", render: (v) => fmtDate(v) },
  { key: "updatedAt", label: "Last update", render: (v) => fmtDate(v) },
];

const EDIT_FIELDS = [
  { key: "name", label: "School Name", required: true },
  { key: "shortName", label: "Short Name" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "pincode", label: "Pincode" },
  { key: "website", label: "Website" },
];

export default function SchoolDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editBusy, setEditBusy] = useState(false);

  useEffect(() => {
    api.platform.schools
      .get360(id)
      .then(({ data: raw }) => setData(raw))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, refreshKey]);

  const advance = async () => {
    const school = data?.school;
    if (!school) return;
    const next = nextStepOf(school.onboarding?.status);
    if (!next) return;
    setBusy(true);
    try {
      await api.platform.schools.updateOnboarding(school._id, next);
      toast(`Onboarding advanced to ${next}`);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = () => {
    const s = data?.school || {};
    setEditForm({
      name: s.name || "",
      shortName: s.shortName || "",
      email: s.email || "",
      phone: s.phone || "",
      address: s.address || "",
      city: s.city || "",
      state: s.state || "",
      pincode: s.pincode || "",
      website: s.website || "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editForm.name?.trim()) {
      toast("School name is required", "error");
      return;
    }
    setEditBusy(true);
    try {
      await api.platform.schools.update(id, editForm);
      toast("School updated");
      setEditOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setEditBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full">
        <PageIntro title="School 360°" />
        <Card>
          <p className="text-[13px] text-slate-text/70">Loading school…</p>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full">
        <PageIntro title="School 360°" />
        <Card>
          <p className="text-[13px] text-alert">{error || "School not found"}</p>
          <Link to="/platform/schools" className="text-[13px] font-semibold text-info inline-block mt-3">
            ← Back to Schools Management
          </Link>
        </Card>
      </div>
    );
  }

  const school = data.school;
  const next = nextStepOf(school.onboarding?.status);
  const subscription = data.subscription;
  const admins = data.admins || [];

  return (
    <div className="w-full">
      <PageIntro
        eyebrow="Platform Owner · School Operations"
        title={`${school.name} — 360°`}
        description="Full context on this tenant: profile, onboarding, admins, subscription and recent invoices."
        right={
          <Link to="/platform/schools">
            <Button variant="outline">
              <ArrowLeft size={15} /> Schools
            </Button>
          </Link>
        }
      />

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card
            title="Profile"
            action={
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Pencil size={13} /> Edit
              </Button>
            }
          >
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-[13.5px]">
              {PROFILE_FIELDS.map(({ key, label, render, className, span }) => {
                const value = key === "session" ? data?.currentSession?.name || school.session || "" : school[key];
                const isEmpty = !value && value !== 0;
                return (
                  <div key={key} className={span ? "sm:col-span-2" : ""}>
                    <p className="text-[11.5px] text-slate-text/60 font-semibold uppercase">{label}</p>
                    {render ? (
                      <div className="mt-0.5">{isEmpty ? <span className="text-slate-text/50">—</span> : render(value)}</div>
                    ) : (
                      <p className={`mt-0.5 ${className || "text-ink"}`}>
                        {isEmpty ? <span className="text-slate-text/50">—</span> : value}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="School admins" bodyClassName="p-0">
            {admins.length ? (
              <div className="divide-y divide-black/[0.05]">
                {admins.map((admin) => (
                  <div key={admin._id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-ink text-amber flex items-center justify-center text-[11px] font-semibold shrink-0">
                      {admin.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-ink truncate">{admin.name}</p>
                      <p className="text-[11.5px] text-slate-text/70 truncate">{admin.email}</p>
                    </div>
                    <span className="text-[11.5px] text-slate-text/60 whitespace-nowrap">
                      {admin.lastLogin ? `last login ${fmtDate(admin.lastLogin)}` : "never logged in"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-5 text-[13px] text-slate-text/70">
                No school admin yet. Onboard one from{" "}
                <Link to="/platform/users" className="font-semibold text-info">
                  Users & Access
                </Link>
                .
              </p>
            )}
            <div className="px-5 py-3 border-t border-black/[0.05]">
              <p className="text-[12.5px] text-slate-text/70">
                <Users size={13} className="inline mr-1" />
                {data.activeUsers || 0} active user{data.activeUsers === 1 ? "" : "s"} across roles in this school
              </p>
            </div>
          </Card>

          <Card title="Recent invoices" bodyClassName="p-0">
            {data.recentInvoices?.length ? (
              <div className="divide-y divide-black/[0.05]">
                {data.recentInvoices.map((invoice) => (
                  <div key={invoice._id} className="px-5 py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-ink truncate">{invoice.invoiceNumber}</p>
                      <p className="text-[11.5px] text-slate-text/70">due {fmtDate(invoice.dueDate)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] font-semibold text-ink">
                        ₹{Number(invoice.amount || 0).toLocaleString("en-IN")}
                      </span>
                      <Pill tone={invoice.status === "paid" ? "success" : invoice.status === "overdue" ? "alert" : "amber"}>
                        {invoice.status}
                      </Pill>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-5 text-[13px] text-slate-text/70">No invoices yet.</p>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Onboarding">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] text-slate-text/70">Current stage</p>
              <Pill tone={onboardingTone(school.onboarding?.status)}>{school.onboarding?.status || "created"}</Pill>
            </div>
            <div className="space-y-2.5">
              {ONBOARDING_FLOW.map((step) => {
                const stage = school.onboarding?.status || "created";
                const index = ONBOARDING_FLOW.indexOf(step);
                const currentIndex = ONBOARDING_FLOW.indexOf(stage);
                const reached = index <= currentIndex;
                return (
                  <div key={step} className="flex items-center gap-2.5">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                        reached ? "bg-success/10 text-success" : "bg-paper text-slate-text/50"
                      }`}
                    >
                      {reached ? "✓" : index + 1}
                    </span>
                    <span className={`capitalize text-[13px] ${reached ? "text-ink font-semibold" : "text-slate-text/60"}`}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
            {next && (
              <Button className="mt-4 w-full justify-center" onClick={advance} disabled={busy}>
                {busy ? "Updating…" : `Advance to ${next}`}
              </Button>
            )}
          </Card>

          <Card title="Current subscription">
            {subscription ? (
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center shrink-0">
                    <CreditCard size={15} />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-ink">{subscription.plan?.name || "—"}</p>
                    <p className="text-[11.5px] text-slate-text/70 capitalize">{subscription.status}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[12.5px]">
                  <div>
                    <p className="text-slate-text/60">Renews</p>
                    <p className="font-semibold text-ink">{fmtDate(subscription.nextBillingDate)}</p>
                  </div>
                  <div>
                    <p className="text-slate-text/60">Amount</p>
                    <p className="font-semibold text-ink">
                      ₹{Number(subscription.price || 0).toLocaleString("en-IN")}/{subscription.billingCycle === "yearly" ? "yr" : "mo"}
                    </p>
                  </div>
                </div>
                <Link
                  to="/platform/subscriptions"
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-info mt-4"
                >
                  <FileText size={13} /> Manage in Subscriptions
                </Link>
              </div>
            ) : (
              <p className="text-[13px] text-slate-text/70">
                No current subscription. Assign one from{" "}
                <Link to="/platform/subscriptions" className="font-semibold text-info">
                  Subscriptions
                </Link>
                .
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* Edit School Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => !editBusy && setEditOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-black/[0.06] px-5 py-4 flex items-center justify-between rounded-t-xl">
              <h3 className="text-[15px] font-semibold text-ink">Edit School Profile</h3>
              <button
                onClick={() => setEditOpen(false)}
                disabled={editBusy}
                className="w-7 h-7 flex items-center justify-center rounded-md text-slate-text/60 hover:bg-paper transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-4">
              {EDIT_FIELDS.map(({ key, label, type, required }) => (
                <div key={key}>
                  <label className="block text-[11.5px] font-semibold text-slate-text/60 uppercase mb-1">
                    {label}{required && <span className="text-alert ml-0.5">*</span>}
                  </label>
                  <Input
                    type={type || "text"}
                    value={editForm[key] || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={label}
                  />
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 bg-white border-t border-black/[0.06] px-5 py-3 flex items-center justify-end gap-2 rounded-b-xl">
              <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={editBusy}>
                Cancel
              </Button>
              <Button onClick={saveEdit} disabled={editBusy}>
                {editBusy ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
