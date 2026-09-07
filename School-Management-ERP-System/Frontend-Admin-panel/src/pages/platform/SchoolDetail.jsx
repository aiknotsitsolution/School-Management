import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Users, CreditCard, FileText } from "lucide-react";
import { api } from "../../lib/api";
import { Button, Card, PageIntro, Pill, toast } from "../../components/UI";

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

export default function SchoolDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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

  if (loading) {
    return (
      <div className="max-w-6xl">
        <PageIntro title="School 360°" />
        <Card>
          <p className="text-[13px] text-slate-text/70">Loading school…</p>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-6xl">
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
    <div className="max-w-6xl">
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
          <Card title="Profile">
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-[13.5px]">
              <div>
                <p className="text-[11.5px] text-slate-text/60 font-semibold uppercase">Code</p>
                <p className="font-mono text-ink">{school.code}</p>
              </div>
              <div>
                <p className="text-[11.5px] text-slate-text/60 font-semibold uppercase">Plan</p>
                <Pill tone="info">{school.plan}</Pill>
              </div>
              <div>
                <p className="text-[11.5px] text-slate-text/60 font-semibold uppercase">Status</p>
                <Pill tone={school.status === "active" ? "success" : "alert"}>{school.status}</Pill>
              </div>
              <div>
                <p className="text-[11.5px] text-slate-text/60 font-semibold uppercase">City</p>
                <p className="text-ink">{school.city || "—"}</p>
              </div>
              <div>
                <p className="text-[11.5px] text-slate-text/60 font-semibold uppercase">Created</p>
                <p className="text-ink">{fmtDate(school.createdAt)}</p>
              </div>
              <div>
                <p className="text-[11.5px] text-slate-text/60 font-semibold uppercase">Last update</p>
                <p className="text-ink">{fmtDate(school.updatedAt)}</p>
              </div>
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
    </div>
  );
}