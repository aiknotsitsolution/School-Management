import { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  TrendingUp,
  AlertCircle,
  Receipt,
  ArrowRight,
  ArrowDownCircle,
  CircleDollarSign,
  Banknote,
  Printer,
  CreditCard,
  Sparkles,
  Inbox,
  BanknoteIcon,
  Landmark,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "../../components/UI";
import { api } from "../../lib/api";
import useStaffContext, { fmtMoney, fmtDate, todayISO, dateOf } from "./useStaffContext";
import {
  HeroBanner,
  GlassStat,
  QuickActions,
  MetricGrid,
  MetricCard,
  Panel,
  BarList,
  Badge,
  ListRow,
  EmptyPanel,
  DashboardSkeleton,
  ACCENTS,
  greeting,
} from "../../components/dashboard/DashKit";

const STATUS_TONE = {
  Paid: "success",
  Partial: "primary",
  Unpaid: "neutral",
  Overdue: "alert",
};

const MODE_ICON = {
  cash: BanknoteIcon,
  Cash: BanknoteIcon,
  upi: CreditCard,
  UPI: CreditCard,
  card: CreditCard,
  Card: CreditCard,
  bank: Landmark,
  Bank: Landmark,
  transfer: Landmark,
  cheque: Receipt,
  Cheque: Receipt,
};

const QUICK_LINKS = [
  { to: "/accountant/fees", icon: Receipt, label: "Fee management", tone: ACCENTS.primary.icon },
  { to: "/accountant/fees", icon: Banknote, label: "Collect payment", tone: ACCENTS.success.icon },
  { to: "/accountant/fees", icon: CreditCard, label: "Online payments", tone: ACCENTS.info.icon },
  { to: "/accountant/fees", icon: Printer, label: "Print receipts", tone: ACCENTS.violet.icon },
  { to: "/fees-collection", icon: Inbox, label: "Fee collection", tone: ACCENTS.warn.icon },
];

export default function AccountantDashboard() {
  const { school } = useStaffContext();
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([api.fees.payments.list(), api.fees.invoices.list()])
      .then(([p, i]) => {
        setPayments(p.status === "fulfilled" ? p.value.data || [] : []);
        setInvoices(i.status === "fulfilled" ? i.value.data || [] : []);
        if (p.status === "rejected") toast(p.value?.message, "error");
        if (i.status === "rejected") toast(i.value?.message, "error");
      })
      .finally(() => setLoading(false));
  }, []);

  const today = todayISO();
  const monthPrefix = today.slice(0, 7);

  const stats = useMemo(() => {
    const todayPaid = payments
      .filter((p) => dateOf(p.paidOn) === today)
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const monthPaid = payments
      .filter((p) => dateOf(p.paidOn).startsWith(monthPrefix))
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const due = invoices.filter((i) => i.status !== "Paid");
    const outstanding = due.reduce(
      (s, i) => s + (Number(i.amount || 0) - Number(i.paidAmount || 0)),
      0,
    );
    const byStatus = {};
    invoices.forEach((i) => {
      byStatus[i.status] = (byStatus[i.status] || 0) + 1;
    });
    const byMode = {};
    payments.forEach((p) => {
      byMode[p.mode] = (byMode[p.mode] || 0) + 1;
    });
    return {
      todayPaid,
      monthPaid,
      outstanding,
      dueCount: due.length,
      byStatus,
      byMode,
      totalCollected: payments.reduce((s, p) => s + Number(p.amount || 0), 0),
    };
  }, [payments, invoices, today, monthPrefix]);

  const invoicedTotal = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const collectionRate =
    invoicedTotal > 0 ? (stats.totalCollected / invoicedTotal) * 100 : 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        gradient="emerald"
        eyebrow={`${greeting()} · Accountant Workspace`}
        name="Fees & Collections"
        title={school?.name || "Fee Collection"}
        meta="Every rupee in, every receipt out — track collections, chase overdue invoices and keep the ledger clean."
        dateLabel={new Date().toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        quote="A clean ledger is the quiet foundation of a trusted school."
        quoteTitle="Accounts desk"
        right={
          <>
            <GlassStat value={fmtMoney(stats.todayPaid)} label="Today" />
            <GlassStat value={fmtMoney(stats.monthPaid)} label="This month" />
            <GlassStat value={fmtMoney(stats.outstanding)} label="Outstanding" />
          </>
        }
      />

      <QuickActions
        title="Fee Desk Shortcuts"
        icon={Sparkles}
        columns={5}
        action={
          <button
            type="button"
            onClick={() => navigate("/accountant/fees")}
            className="inline-flex items-center gap-2 rounded-xl bg-info px-3.5 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-blue-700"
          >
            Manage Fees <ArrowRight size={14} />
          </button>
        }
        items={QUICK_LINKS}
      />

      {loading ? (
        <DashboardSkeleton metricCols={4} />
      ) : (
        <>
          <MetricGrid columns={4}>
            <MetricCard
              icon={TrendingUp}
              label="Today's collection"
              value={fmtMoney(stats.todayPaid)}
              sub="payments logged today"
              accent="success"
            />
            <MetricCard
              icon={CircleDollarSign}
              label="This month"
              value={fmtMoney(stats.monthPaid)}
              sub={`${monthPrefix.slice(5, 7)}/${monthPrefix.slice(0, 4)} period`}
              accent="primary"
            />
            <MetricCard
              icon={Wallet}
              label="Lifetime collected"
              value={fmtMoney(stats.totalCollected)}
              sub={`${payments.length} transactions`}
              accent="info"
              progress={Math.min(100, collectionRate)}
            />
            <MetricCard
              icon={AlertCircle}
              label="Outstanding"
              value={fmtMoney(stats.outstanding)}
              sub={`${stats.dueCount} unpaid invoice${stats.dueCount === 1 ? "" : "s"}`}
              accent={stats.outstanding > 0 ? "alert" : "success"}
            />
          </MetricGrid>

          <div className="grid gap-5 lg:grid-cols-3">
            <Panel
              title="Recent transactions"
              icon={Receipt}
              iconTone={ACCENTS.success.icon}
              subtitle="Latest payments recorded"
              className="lg:col-span-2"
              action={
                <button
                  type="button"
                  onClick={() => navigate("/accountant/fees")}
                  className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-semibold text-info transition-colors hover:text-blue-700"
                >
                  Manage fees <ArrowRight size={14} />
                </button>
              }
            >
              {payments.length === 0 ? (
                <EmptyPanel
                  icon={Receipt}
                  iconTone={ACCENTS.neutral.icon}
                  title="No payments recorded yet"
                  text="Fee payments you log will appear here, newest first."
                />
              ) : (
                <div className="space-y-2.5">
                  {payments.slice(0, 7).map((p) => {
                    const ModeIcon = MODE_ICON[p.mode] || CreditCard;
                    return (
                      <ListRow
                        key={p._id}
                        icon={ModeIcon}
                        iconTone={ACCENTS.success.icon}
                        title={
                          <span className="text-emerald-600">{fmtMoney(p.amount)}</span>
                        }
                        meta={`${p.studentId || "—"} · ${p.mode || "mode not set"}`}
                        trailing={
                          <span className="whitespace-nowrap font-mono text-[11.5px] text-slate-text/70">
                            {p.receiptNo || fmtDate(p.paidOn)}
                          </span>
                        }
                      />
                    );
                  })}
                </div>
              )}
            </Panel>

            <div className="space-y-5">
              <Panel
                title="Invoice status"
                icon={Receipt}
                iconTone={ACCENTS.violet.icon}
                subtitle={`${invoices.length} invoice${invoices.length === 1 ? "" : "s"} on record`}
              >
                {invoices.length === 0 ? (
                  <EmptyPanel
                    icon={Receipt}
                    iconTone={ACCENTS.neutral.icon}
                    title="No invoices yet"
                    text="Generate fee invoices to start tracking collections."
                  />
                ) : (
                  <div className="space-y-2.5">
                    {["Paid", "Partial", "Unpaid", "Overdue"].map((s) => (
                      <div
                        key={s}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5"
                      >
                        <Badge tone={STATUS_TONE[s]}>{s}</Badge>
                        <span className="font-display text-[15px] font-bold text-ink">
                          {stats.byStatus[s] || 0}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                title="Payment modes"
                icon={CreditCard}
                iconTone={ACCENTS.info.icon}
                subtitle="How families pay"
              >
                {Object.keys(stats.byMode).length === 0 ? (
                  <EmptyPanel
                    icon={CreditCard}
                    iconTone={ACCENTS.neutral.icon}
                    title="No payment data"
                    text="Modes will be summarised once payments are recorded."
                  />
                ) : (
                  <BarList
                    accent="primary"
                    showPct={false}
                    items={Object.entries(stats.byMode).map(([mode, count]) => ({
                      label: mode,
                      value: count,
                    }))}
                  />
                )}
              </Panel>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => navigate("/accountant/fees")}
              className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_14px_30px_-20px_rgba(16,185,129,0.5)]"
            >
              <span className="flex items-center gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ACCENTS.success.icon}`}
                  aria-hidden="true"
                >
                  <ArrowDownCircle size={19} />
                </span>
                <span>
                  <span className="block font-display text-[15px] font-bold text-ink">
                    Collect payment
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-slate-text/70">
                    Record a fee payment against an invoice
                  </span>
                </span>
              </span>
              <ArrowRight
                size={18}
                className="shrink-0 text-slate-text/40 transition-colors group-hover:text-emerald-500"
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              onClick={() => navigate("/accountant/fees")}
              className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-[0_14px_30px_-20px_rgba(79,70,229,0.5)]"
            >
              <span className="flex items-center gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ACCENTS.primary.icon}`}
                  aria-hidden="true"
                >
                  <Wallet size={19} />
                </span>
                <span>
                  <span className="block font-display text-[15px] font-bold text-ink">
                    Fee structure
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-slate-text/70">
                    Define or update fee types per class
                  </span>
                </span>
              </span>
              <ArrowRight
                size={18}
                className="shrink-0 text-slate-text/40 transition-colors group-hover:text-info"
                aria-hidden="true"
              />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
