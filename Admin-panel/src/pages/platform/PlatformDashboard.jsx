import { useEffect, useRef, useState } from "react";
import {
  Building2,
  Users,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Activity,
  CalendarClock,
  Sparkles,
  Server,
  Radio,
  CreditCard,
  FileClock,
  School,
  Layers,
  Route,
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
import { Pill } from "../../components/UI";
import { DashboardPagination } from "../../components/DashboardPagination";
import {
  HeroBanner,
  GlassStat,
  MetricGrid,
  MetricCard,
  Panel,
  EmptyPanel,
  ListRow,
  BarList,
  AlertStrip,
  ACCENTS,
  greeting,
} from "../../components/dashboard/DashKit";

const PIE_COLORS = ["#4F46E5", "#2563EB", "#0EA5E9", "#14B8A6", "#F59E0B", "#EC4899"];
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

function ChartTooltip({ active, payload, label, money = false }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl shadow-black/8">
      {label && <p className="text-[12.5px] font-bold text-ink">{label}</p>}
      <div className="mt-2 space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2 text-[12px]">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: entry.stroke || entry.fill || entry.color }}
            />
            <span className="flex-1 text-slate-text/70">{entry.name}</span>
            <span className="font-bold text-ink">
              {money ? inr(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
      <div className="space-y-5">
        <div className="h-[216px] animate-pulse rounded-3xl bg-slate-200/70" aria-hidden="true" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[132px] animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="h-[300px] animate-pulse rounded-2xl bg-slate-200/70" />
          <div className="h-[300px] animate-pulse rounded-2xl bg-slate-200/70" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-5">
        <HeroBanner
          gradient="ink"
          eyebrow="Platform Owner"
          name="Platform"
          title="Platform Dashboard"
          meta="Network analytics are unavailable right now"
        />
        <Panel>
          <EmptyPanel
            icon={AlertTriangle}
            iconTone={ACCENTS.alert.icon}
            title="Unable to load platform analytics"
            text={error || "The analytics service returned no data. Please retry in a moment."}
          />
        </Panel>
      </div>
    );
  }

  const ov = data.overview || {};
  const schools = ov.schools || {};
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
  const subDistribution = (data.subscriptionDistribution || []).filter((s) => s.count > 0);

  const freeTrialCount = planBars.find((p) => p.name === "TRIAL")?.count ?? 0;
  const paidCount = planBars.reduce((sum, p) => sum + (p.name !== "TRIAL" ? p.count : 0), 0);
  const totalSchools = schools.total ?? data.schools ?? 0;
  const collected = Number(revenue.collected || 0);
  const outstanding = Number(revenue.outstanding || 0);
  const collectionRate = collected + outstanding > 0 ? (collected / (collected + outstanding)) * 100 : 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <HeroBanner
        gradient="ink"
        eyebrow={greeting()}
        name="Platform Owner"
        title="Platform Dashboard"
        meta="Live snapshot across the entire multi-tenant network — growth, subscriptions, revenue, onboarding and operator attention items."
        dateLabel={new Date().toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        quote="Every school on the network is a relationship, not a row."
        quoteTitle="Multi-tenant command centre"
        right={
          <>
            <GlassStat value={totalSchools} label="Schools" />
            <GlassStat value={paidCount} label="Paying schools" />
            <GlassStat value={inr(ov.mrr ?? data.mrr ?? 0)} label="MRR" />
          </>
        }
      />

      {alerts.length > 0 && (
        <div
          className={`rounded-2xl border p-4 ${
            alerts.some((a) => a.severity === "warning")
              ? "border-amber-200 bg-amber-50/70"
              : "border-sky-200 bg-sky-50/70"
          }`}
        >
          <p className="mb-2.5 flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-[0.08em] text-slate-text/70">
            <AlertTriangle size={14} aria-hidden="true" /> Operator alerts
          </p>
          <AlertStrip
            items={alerts.map((alert) => ({
              label: alert.message,
              tone: alert.severity === "warning" ? "warning" : "info",
            }))}
          />
        </div>
      )}

      {/* ── Primary metrics ──────────────────────────────────────── */}
      <MetricGrid columns={3}>
        <MetricCard
          icon={Building2}
          label="Schools"
          value={totalSchools}
          sub={`${schools.active ?? data.activeSchools ?? 0} active`}
          accent="primary"
        />
        <MetricCard
          icon={Users}
          label="Users"
          value={(ov.users?.total ?? data.users ?? 0).toLocaleString("en-IN")}
          sub="excl. platform owner"
          accent="info"
        />
        <MetricCard
          icon={Sparkles}
          label="Free Trial Subscriptions"
          value={freeTrialCount}
          sub={`${freeTrialCount} schools on free trial`}
          accent="violet"
        />
        <MetricCard
          icon={TrendingUp}
          label="Paid Subscriptions"
          value={paidCount}
          sub={`${paidCount} paying schools`}
          accent="success"
        />
        <MetricCard
          icon={Wallet}
          label="Monthly Recurring Revenue"
          value={inr(ov.mrr ?? data.mrr ?? 0)}
          sub={`ARPU ${inr(ov.arpu ?? data.arpu ?? 0)}`}
          accent="warn"
        />
        <MetricCard
          icon={CreditCard}
          label="Revenue"
          value={inr(collected)}
          sub={`${inr(outstanding)} outstanding`}
          accent={outstanding > 0 ? "alert" : "success"}
          progress={collectionRate}
        />
      </MetricGrid>

      {/* ── Growth + subscription mix ────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="School growth"
          icon={TrendingUp}
          iconTone={ACCENTS.primary.icon}
          subtitle="New schools onboarded over the last 12 months"
        >
          {growth.length ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={growth} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#4F46E5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                  interval={1}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip cursor={{ stroke: "#4F46E5", strokeOpacity: 0.15 }} content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Schools"
                  fill="url(#growthFill)"
                  stroke="#4F46E5"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyPanel
              icon={School}
              title="No growth data yet"
              text="Once schools start onboarding, monthly growth will be charted here."
            />
          )}
        </Panel>

        <Panel
          title="Subscription status"
          icon={Layers}
          iconTone={ACCENTS.teal.icon}
          subtitle="Every school by lifecycle state"
        >
          {!subDistribution.length ? (
            <EmptyPanel
              icon={Layers}
              iconTone={ACCENTS.teal.icon}
              title="No subscriptions yet"
              text="Subscription states will appear here as schools sign up."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_150px] sm:items-center">
              <div className="relative">
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie
                      data={subDistribution}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={86}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {subDistribution.map((entry, index) => (
                        <Cell key={entry.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-[26px] font-bold leading-none text-ink">
                    {subDistribution.reduce((s, x) => s + x.count, 0)}
                  </span>
                  <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-text/60">
                    schools
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {subDistribution.map((entry, index) => (
                  <div
                    key={entry.status}
                    className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[12.5px]"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: PIE_COLORS[index % PIE_COLORS.length] }}
                    />
                    <span className="min-w-0 flex-1 truncate text-slate-text">{entry.label}</span>
                    <span className="font-bold text-ink">{entry.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* ── Plans + funnel + revenue ─────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="Plan distribution"
          icon={Route}
          iconTone={ACCENTS.violet.icon}
          subtitle="Schools per subscription plan"
        >
          {planBars.length ? (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={planBars} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip cursor={{ fill: "rgba(79,70,229,0.05)" }} content={<ChartTooltip />} />
                <Bar dataKey="count" name="Schools" fill="#4F46E5" radius={[6, 6, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyPanel
              icon={Layers}
              iconTone={ACCENTS.violet.icon}
              title="No plans assigned"
              text="Plan assignment will show once schools pick a subscription tier."
            />
          )}
        </Panel>

        <Panel
          title="Onboarding funnel"
          icon={Server}
          iconTone={ACCENTS.info.icon}
          subtitle="Where schools drop out during setup"
        >
          {funnel.length ? (
            <BarList
              accent="primary"
              showPct={false}
              items={funnel.map((step, index) => ({
                label: step.step,
                value: step.count,
                barColor: PIE_COLORS[index % PIE_COLORS.length],
              }))}
            />
          ) : (
            <EmptyPanel
              icon={Server}
              iconTone={ACCENTS.info.icon}
              title="No funnel data"
              text="Onboarding step completion will be charted here."
            />
          )}
        </Panel>

        <Panel
          title="Revenue"
          icon={CreditCard}
          iconTone={ACCENTS.success.icon}
          subtitle="Invoiced vs realised"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3.5">
                <p className="text-[11.5px] font-medium text-slate-text/70">Collected</p>
                <p className="mt-1 font-display text-[18px] font-bold text-emerald-600">
                  {inr(collected)}
                </p>
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-3.5">
                <p className="text-[11.5px] font-medium text-slate-text/70">Outstanding</p>
                <p className="mt-1 font-display text-[18px] font-bold text-rose-500">
                  {inr(outstanding)}
                </p>
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[12px]">
                <span className="text-slate-text/70">Collection rate</span>
                <span className="font-bold text-ink">{Math.round(collectionRate)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.max(2, collectionRate)}%` }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill tone="success">{invoiceCounts.paid || 0} paid</Pill>
              <Pill tone="primary">{invoiceCounts.issued || 0} issued</Pill>
              <Pill tone="alert">{invoiceCounts.overdue || 0} overdue</Pill>
              <Pill>{invoiceCounts.draft || 0} draft</Pill>
            </div>
          </div>
        </Panel>
      </div>

      {refreshing && (
        <div className="flex items-center gap-2 text-[12px] text-slate-text/70">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          Updating…
        </div>
      )}

      {/* ── Expiring + activity ──────────────────────────────────── */}
      <div className={`grid gap-5 lg:grid-cols-2 ${refreshing ? "opacity-70" : ""}`}>
        <Panel
          title="Expiring subscriptions"
          icon={CalendarClock}
          iconTone={ACCENTS.warn.icon}
          subtitle="Renewals due soon"
          action={
            <div className="flex gap-1.5">
              <Pill tone={exp.in7 > 0 ? "alert" : "success"}>{exp.in7 || 0} in 7d</Pill>
              <Pill tone={exp.in15 > 0 ? "primary" : "neutral"}>{exp.in15} in 15d</Pill>
              <Pill tone="info">{exp.in30} in 30d</Pill>
            </div>
          }
        >
          {exp.items?.length ? (
            <>
              <div className="space-y-2.5">
                {exp.items.map((item) => (
                  <ListRow
                    key={item._id}
                    icon={CalendarClock}
                    iconTone={ACCENTS.warn.icon}
                    title={item.school?.name || "Unknown school"}
                    meta={`${item.plan?.name || "—"} · ${SUB_LABELS[item.status] || item.status}`}
                    trailing={
                      <span className="whitespace-nowrap text-[12px] font-semibold text-slate-text/70">
                        {item.reference ? fmtDate(item.reference) : "—"}
                      </span>
                    }
                  />
                ))}
              </div>
              <div className="mt-4 border-t border-slate-100 pt-3">
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
            </>
          ) : (
            <EmptyPanel
              icon={CalendarClock}
              iconTone={ACCENTS.success.icon}
              title="No expiring subscriptions"
              text="Nothing is due for renewal in the current window. Enjoy the quiet."
            />
          )}
        </Panel>

        <Panel
          title="Recent platform activity"
          icon={Activity}
          iconTone={ACCENTS.info.icon}
          subtitle="Audit trail of operator actions"
        >
          {activity.length ? (
            <>
              <div className="space-y-2.5">
                {activity.map((entry) => (
                  <ListRow
                    key={entry._id}
                    icon={Activity}
                    iconTone={ACCENTS.info.icon}
                    title={
                      <>
                        <span className="font-bold">{entry.actorEmail || "system"}</span>{" "}
                        <span className="font-medium text-slate-text/70">
                          {entry.message || entry.action}
                        </span>
                      </>
                    }
                    meta={`${entry.action} · ${entry.actorRole || "—"} · ${timeAgo(entry.createdAt)}`}
                  />
                ))}
              </div>
              <div className="mt-4 border-t border-slate-100 pt-3">
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
            </>
          ) : (
            <EmptyPanel
              icon={FileClock}
              iconTone={ACCENTS.neutral.icon}
              title="No platform activity yet"
              text="Operator actions across the network will be recorded here."
            />
          )}
        </Panel>
      </div>

      {/* ── Live status strip ─────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Server, label: "Analytics", value: "Live", tone: "text-emerald-600" },
          { icon: Radio, label: "Realtime hub", value: "Connected", tone: "text-emerald-600" },
          { icon: Building2, label: "Active schools", value: `${schools.active ?? data.activeSchools ?? 0}`, tone: "text-ink" },
          { icon: Wallet, label: "ARPU", value: inr(ov.arpu ?? data.arpu ?? 0), tone: "text-ink" },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5"
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500`}>
              <item.icon size={17} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
                {item.label}
              </p>
              <p className={`mt-0.5 truncate font-display text-[16px] font-bold ${item.tone}`}>
                {item.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
