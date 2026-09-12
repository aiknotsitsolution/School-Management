import { useEffect, useRef, useState } from "react";
import {
  Building2,
  Users,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Activity,
  CalendarClock,
  Layers,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { api } from "../../lib/api";
import { Card, PageIntro, Pill, StatCard } from "../../components/UI";
import { DashboardPagination } from "../../components/DashboardPagination";

const PIE_COLORS = ["#16213E", "#E8A33D", "#3F8F5F", "#3B6FA0", "#D65A4A"];
const SUB_LABELS = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  suspended: "Suspended",
  cancelled: "Cancelled",
  expired: "Expired",
};

const inr = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

const timeAgo = (value) => {
  if (!value) return "—";
  const seconds = Math.floor((Date.now() - new Date(value)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function PlatformDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [params, setParams] = useState({ expPage: 1, expLimit: 5, actPage: 1, actLimit: 5 });
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current) setRefreshing(true);
    else setLoading(true);
    api.analytics
      .summary(new URLSearchParams(params).toString())
      .then(({ data: raw }) => setData(raw))
      .catch((err) => setError(err.message))
      .finally(() => {
        hasLoadedRef.current = true;
        setLoading(false);
        setRefreshing(false);
      });
  }, [params]);

  if (loading) {
    return (
      <div className="w-full">
        <PageIntro eyebrow="Platform Owner" title="Platform Dashboard" />
        <Card>
          <p className="text-[13px] text-slate-text/70">Loading platform overview…</p>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full">
        <PageIntro eyebrow="Platform Owner" title="Platform Dashboard" />
        <Card>
          <p className="text-[13px] text-alert">Unable to load platform analytics: {error || "no data"}</p>
        </Card>
      </div>
    );
  }

  const ov = data.overview || {};
  const schools = ov.schools || {};
  const subs = ov.subscriptions || {};
  const exp = data.expiringSubscriptions || { in7: 0, in15: 0, in30: 0, total: 0, page: 1, pageSize: 5, items: [] };
  const planBars = (data.planDistribution || [])
    .filter((p) => p.count > 0)
    .map((p) => ({ name: String(p.plan).toUpperCase(), count: p.count }));
  const funnel = (data.onboarding?.funnel || []).map((f) => ({
    step: f.step.charAt(0).toUpperCase() + f.step.slice(1),
    count: f.count,
  }));
  const revenue = data.revenue || {};
  const invoiceCounts = revenue.invoices || {};
  const alerts = data.alerts || [];
  const activity = Array.isArray(data.recentActivity) ? data.recentActivity : data.recentActivity?.items || [];
  const activityTotal = data.recentActivityTotal ?? activity.length;
  const growth = data.schoolGrowth || [];

  return (
    <div className="w-full">
      <PageIntro
        eyebrow="Platform Owner"
        title="Platform Dashboard"
        description="Live snapshot across the entire multi-tenant network: growth, subscriptions, revenue, onboarding and operator attention items."
      />

      {alerts.length > 0 && (
        <div className="mb-5 space-y-2">
          {alerts.map((alert, index) => (
            <div
              key={`${alert.type}-${index}`}
              className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-[13px] border ${
                alert.severity === "warning"
                  ? "bg-alert/5 border-alert/20 text-alert-dark"
                  : "bg-info/5 border-info/20 text-info-dark"
              }`}
            >
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <StatCard
          icon={Building2}
          label="Schools"
          value={schools.total ?? data.schools ?? 0}
          sub={`${schools.active ?? data.activeSchools ?? 0} active`}
          accent="amber"
        />
        <StatCard
          icon={Users}
          label="Users"
          value={(ov.users?.total ?? data.users ?? 0).toLocaleString("en-IN")}
          sub="excl. platform owner"
          accent="info"
        />
        <StatCard
          icon={Layers}
          label="Current Subscriptions"
          value={subs.current ?? data.subscriptions?.current ?? 0}
          sub={`trialing ${subs.byStatus?.trialing ?? 0} · past due ${subs.byStatus?.past_due ?? 0}`}
          accent="success"
        />
        <StatCard
          icon={TrendingUp}
          label="MRR"
          value={inr(ov.mrr ?? data.mrr ?? 0)}
          sub={`ARPU ${inr(ov.arpu ?? data.arpu ?? 0)}`}
          accent="info"
        />
        <StatCard
          icon={Wallet}
          label="Revenue"
          value={inr(revenue.collected ?? data.revenue?.collected)}
          sub={`${inr(revenue.outstanding ?? data.revenue?.outstanding)} outstanding`}
          accent={Number(revenue.outstanding || 0) > 0 ? "alert" : "success"}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <Card title="School growth (12 months)">
          {growth.length ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={growth} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E8A33D" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#E8A33D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAE8E2" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B6B6B" }} interval={1} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6B6B6B" }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)" }} />
                <Area type="monotone" dataKey="count" name="Schools" fill="url(#growthFill)" stroke="#E8A33D" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[13px] text-slate-text/70">No school growth data yet.</p>
          )}
        </Card>

        <Card title="Subscription status" bodyClassName="flex items-center gap-2 p-5">
          <div className="flex-1">
            {(data.subscriptionDistribution || []).filter((s) => s.count > 0).length ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={(data.subscriptionDistribution || []).filter((s) => s.count > 0)}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {(data.subscriptionDistribution || []).map((entry, index) => (
                      <Cell key={entry.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-[13px] text-slate-text/70 p-5">No subscriptions yet.</p>
            )}
          </div>
          <div className="space-y-2 w-40 shrink-0">
            {(data.subscriptionDistribution || [])
              .filter((s) => s.count > 0)
              .map((entry, index) => (
                <div key={entry.status} className="flex items-center gap-2 text-[12.5px]">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ background: PIE_COLORS[index % PIE_COLORS.length] }}
                  />
                  <span className="flex-1 text-slate-text">{entry.label}</span>
                  <span className="font-semibold text-ink">{entry.count}</span>
                </div>
              ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        <Card title="Plan distribution">
          {planBars.length ? (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={planBars} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAE8E2" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B6B6B" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6B6B6B" }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)" }} />
                <Bar dataKey="count" name="Schools" fill="#16213E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[13px] text-slate-text/70">No plans assigned yet.</p>
          )}
        </Card>

        <Card title="Onboarding funnel">
          <div className="space-y-3">
            {funnel.map((step, index) => {
              const max = Math.max(1, ...funnel.map((f) => f.count));
              const width = Math.round((step.count / max) * 100);
              return (
                <div key={step.step}>
                  <div className="flex items-center justify-between text-[12.5px] mb-1">
                    <span className="text-slate-text">{step.step}</span>
                    <span className="font-semibold text-ink">{step.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-paper overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${width}%`, background: PIE_COLORS[index % PIE_COLORS.length] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Revenue" bodyClassName="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-success/5 border border-success/15 p-3.5">
              <p className="text-[11.5px] text-slate-text/70 font-medium">Collected</p>
              <p className="font-display text-[18px] font-bold text-success">{inr(revenue.collected)}</p>
            </div>
            <div className="rounded-xl bg-alert/5 border border-alert/15 p-3.5">
              <p className="text-[11.5px] text-slate-text/70 font-medium">Outstanding</p>
              <p className="font-display text-[18px] font-bold text-alert">{inr(revenue.outstanding)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill tone="success">{invoiceCounts.paid || 0} paid</Pill>
            <Pill tone="amber">{invoiceCounts.issued || 0} issued</Pill>
            <Pill tone="alert">{invoiceCounts.overdue || 0} overdue</Pill>
            <Pill>{invoiceCounts.draft || 0} draft</Pill>
          </div>
        </Card>
      </div>

      {refreshing && (
        <div className="flex items-center gap-2 mb-3 text-[12px] text-slate-text/70 animate-pulse">
          <span className="w-2.5 h-2.5 rounded-full bg-amber/60" />
          Updating…
        </div>
      )}

      <div className={`grid lg:grid-cols-2 gap-5 mb-5 ${refreshing ? "opacity-60 pointer-events-none" : ""}`}>
        <Card
          title="Expiring subscriptions"
          action={
            <div className="flex gap-1.5">
              <Pill tone={exp.in7 > 0 ? "alert" : "success"}>{exp.in7 || 0} in 7d</Pill>
              <Pill tone={exp.in15 > 0 ? "amber" : "neutral"}>{exp.in15} in 15d</Pill>
              <Pill tone="info">{exp.in30} in 30d</Pill>
            </div>
          }
          bodyClassName="p-0"
        >
          {exp.items?.length ? (
            <div className="divide-y divide-black/[0.05]">
              {exp.items.map((item) => (
                <div key={item._id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber/15 text-amber-dark flex items-center justify-center shrink-0">
                    <CalendarClock size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-ink truncate">
                      {item.school?.name || "Unknown school"}
                    </p>
                    <p className="text-[11.5px] text-slate-text/70">
                      {item.plan?.name || "—"} · {SUB_LABELS[item.status] || item.status}
                    </p>
                  </div>
                  <span className="text-[12px] text-slate-text/70 whitespace-nowrap">
                    {item.reference ? fmtDate(item.reference) : "—"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="p-5 text-[13px] text-slate-text/70">No expiring subscriptions.</p>
          )}
          <div className="px-5 pb-2">
            <DashboardPagination
              total={exp.total}
              page={params.expPage}
              pageSize={params.expLimit}
              onPageChange={(p) => setParams((s) => ({ ...s, expPage: p }))}
              onPageSizeChange={(n) => setParams((s) => ({ ...s, expLimit: n, expPage: 1 }))}
              unit="subscriptions"
              compact
            />
          </div>
        </Card>

        <Card title="Recent platform activity" bodyClassName="p-0">
          {activity.length ? (
            <div className="divide-y divide-black/[0.05]">
              {activity.map((entry) => (
                <div key={entry._id} className="px-5 py-3 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-ink text-amber flex items-center justify-center mt-0.5 shrink-0">
                    <Activity size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-ink">
                      <span className="font-semibold">{entry.actorEmail || "system"}</span>{" "}
                      <span className="text-slate-text/70">{entry.message || entry.action}</span>
                    </p>
                    <p className="text-[11.5px] text-slate-text/60 mt-0.5">
                      {entry.action} · {entry.actorRole || "—"} · {timeAgo(entry.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="p-5 text-[13px] text-slate-text/70">No platform activity recorded yet.</p>
          )}
          <div className="px-5 pb-2">
            <DashboardPagination
              total={activityTotal}
              page={params.actPage}
              pageSize={params.actLimit}
              onPageChange={(p) => setParams((s) => ({ ...s, actPage: p }))}
              onPageSizeChange={(n) => setParams((s) => ({ ...s, actLimit: n, actPage: 1 }))}
              unit="events"
              compact
            />
          </div>
        </Card>
      </div>
    </div>
  );
}