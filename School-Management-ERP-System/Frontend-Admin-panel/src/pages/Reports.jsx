import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Wallet,
  CalendarCheck,
  GraduationCap,
} from "lucide-react";
import { api } from "../lib/api";
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
import { PageIntro, Card, StatCard } from "../components/UI";

const PIE_COLORS = ["#16213E", "#E8A33D", "#3F8F5F", "#3B6FA0", "#D65A4A"];

function monthKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function formatMonth(value) {
  return new Date(value).toLocaleDateString("en-IN", {
    month: "short",
  });
}

function formatDate(value) {
  return value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      })
    : "—";
}

export default function Reports() {
  const [data, setData] = useState({
    studentStats: { total: 0, active: 0, byClass: [] },
    students: [],
    attendance: [],
    invoices: [],
    payments: [],
    admissions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.allSettled([
      api.students.stats(),
      api.students.list("limit=1000"),
      api.attendance.list(),
      api.fees.invoices.list(),
      api.fees.payments.list(),
      api.admissions.list(),
    ])
      .then((results) => {
        const value = (index) =>
          results[index].status === "fulfilled" ? results[index].value : {};
        const failed = results.filter((result) => result.status === "rejected");
        setData({
          studentStats: value(0).data || { total: 0, active: 0, byClass: [] },
          students: value(1).data || [],
          attendance: value(2).data || [],
          invoices: value(3).data || [],
          payments: value(4).data || [],
          admissions: value(5).data || [],
        });
        if (failed.length === results.length) {
          setError("Analytics data could not be loaded. Please try again.");
        } else if (failed.length > 0) {
          setError("Some analytics data is temporarily unavailable.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const classStrength = useMemo(
    () =>
      (data.studentStats.byClass || []).map((item) => ({
        name: item._id || "Unknown",
        value: item.count,
      })),
    [data.studentStats],
  );

  const attendanceTrend = useMemo(() => {
    const grouped = new Map();
    data.attendance.forEach((record) => {
      const key = monthKey(record.date);
      const current = grouped.get(key) || {
        total: 0,
        present: 0,
        date: record.date,
      };
      current.total += 1;
      if (record.status === "Present") current.present += 1;
      grouped.set(key, current);
    });
    return [...grouped.values()].map((item) => ({
      month: formatMonth(item.date),
      attendance: item.total
        ? Math.round((item.present / item.total) * 100)
        : 0,
    }));
  }, [data.attendance]);

  const feeTrend = useMemo(() => {
    const grouped = new Map();
    data.payments.forEach((payment) => {
      const key = monthKey(payment.paidOn);
      const current = grouped.get(key) || {
        month: formatMonth(payment.paidOn),
        collected: 0,
        pending: 0,
      };
      current.collected += Number(payment.amount || 0);
      grouped.set(key, current);
    });
    const pending = data.invoices.reduce(
      (sum, invoice) =>
        sum +
        Math.max(0, Number(invoice.amount) - Number(invoice.paidAmount || 0)),
      0,
    );
    const trend = [...grouped.values()];
    if (trend.length === 0 && pending > 0) {
      trend.push({ month: "Current", collected: 0, pending });
    } else if (trend.length > 0) {
      trend[trend.length - 1].pending = pending;
    }
    return trend;
  }, [data.payments, data.invoices]);

  const enquiryFunnel = useMemo(() => {
    const byStatus = new Map();
    data.admissions.forEach((item) => {
      const status = item.status || "Unknown";
      byStatus.set(status, (byStatus.get(status) || 0) + 1);
    });
    return [...byStatus.entries()];
  }, [data.admissions]);

  const feesCollected = data.payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
  const feesInvoiced = data.invoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount || 0),
    0,
  );
  const feesPending = data.invoices.reduce(
    (sum, invoice) =>
      sum +
      Math.max(0, Number(invoice.amount) - Number(invoice.paidAmount || 0)),
    0,
  );
  const pendingInvoiceCount = data.invoices.filter(
    (invoice) =>
      Number(invoice.amount) - Number(invoice.paidAmount || 0) > 0,
  ).length;
  const collectionRate =
    feesInvoiced > 0
      ? Math.min(100, Math.round((feesCollected / feesInvoiced) * 100))
      : 0;
  const totalAttendanceRecords = data.attendance.length;
  const presentRecords = data.attendance.filter(
    (record) => record.status === "Present",
  ).length;
  const avgAttendance = totalAttendanceRecords
    ? Math.round((presentRecords / totalAttendanceRecords) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Insights"
        title="Reports & Analytics"
        description="Live school performance across academics and finance, computed from the current ERP data."
      />

      {loading ? (
        <Card>
          <p className="py-14 text-center text-[13px] text-slate-text/60">
            Loading live analytics...
          </p>
        </Card>
      ) : (
        <>
          {error && (
            <Card>
              <p className="text-sm text-alert">{error}</p>
            </Card>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Users}
              label="Total Enrollment"
              value={data.studentStats.total.toLocaleString("en-IN")}
              sub={`${data.studentStats.active.toLocaleString("en-IN")} active students`}
              accent="amber"
            />
            <StatCard
              icon={CalendarCheck}
              label="Avg. Attendance"
              value={`${avgAttendance}%`}
              sub={`${presentRecords.toLocaleString("en-IN")} of ${totalAttendanceRecords.toLocaleString("en-IN")} records marked present`}
              accent="success"
            />
            <StatCard
              icon={Wallet}
              label="Fee Collection Rate"
              value={`${collectionRate}%`}
              sub={`₹${(feesCollected / 100000).toFixed(1)}L collected of ₹${(feesInvoiced / 100000).toFixed(1)}L invoiced`}
              accent="info"
            />
            <StatCard
              icon={GraduationCap}
              label="Pending Dues"
              value={`₹${(feesPending / 100000).toFixed(1)}L`}
              sub={`${pendingInvoiceCount.toLocaleString("en-IN")} invoices partly or fully unpaid`}
              accent="alert"
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <Card title="Students by Section">
              {classStrength.length === 0 ? (
                <p className="py-14 text-center text-[13px] text-slate-text/60">
                  No enrollment data yet
                </p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={classStrength}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={95}
                        label={(d) => d.value}
                      >
                        {classStrength.map((_, i) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: 10,
                          border: "1px solid #eee",
                          fontSize: 12.5,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-2">
                    {classStrength.map((c, i) => (
                      <div
                        key={c.name}
                        className="flex items-center gap-1.5 text-[11px] text-slate-text"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: PIE_COLORS[i] }}
                        />
                        {c.name}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>

            <Card title="Attendance Trend">
              {attendanceTrend.length === 0 ? (
                <p className="py-14 text-center text-[13px] text-slate-text/60">
                  No attendance records yet
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart
                    data={attendanceTrend}
                    margin={{ left: -20, top: 5 }}
                  >
                    <defs>
                      <linearGradient
                        id="analyticsAttGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#E8A33D"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="100%"
                          stopColor="#E8A33D"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#EEEAE0"
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: "#475467" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#475467" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid #eee",
                        fontSize: 12.5,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="attendance"
                      stroke="#E8A33D"
                      strokeWidth={2.5}
                      fill="url(#analyticsAttGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <Card title="Fee Collection vs Pending">
              {feeTrend.length === 0 ? (
                <p className="py-14 text-center text-[13px] text-slate-text/60">
                  No fee payments yet
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={feeTrend}
                    margin={{ left: -10, top: 5 }}
                    barGap={4}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#EEEAE0"
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: "#475467" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => `₹${v / 100000}L`}
                      tick={{ fontSize: 11, fill: "#475467" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v) => `₹${v.toLocaleString("en-IN")}`}
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid #eee",
                        fontSize: 12.5,
                      }}
                    />
                    <Bar
                      dataKey="collected"
                      fill="#3F8F5F"
                      radius={[6, 6, 0, 0]}
                      name="Collected"
                    />
                    <Bar
                      dataKey="pending"
                      fill="#D65A4A"
                      radius={[6, 6, 0, 0]}
                      name="Pending"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card title="Admission Enquiry Funnel">
              {enquiryFunnel.length === 0 ? (
                <p className="py-14 text-center text-[13px] text-slate-text/60">
                  No admission enquiries yet
                </p>
              ) : (
                <div className="divide-y divide-black/[0.05]">
                  {enquiryFunnel.map(([status, count]) => (
                    <div
                      key={status}
                      className="flex items-center justify-between py-3"
                    >
                      <span className="text-[13px] font-medium text-ink">
                        {status}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-40 sm:w-56 h-2 rounded-full bg-paper overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${data.admissions.length ? Math.round((count / data.admissions.length) * 100) : 0}%`,
                              background:
                                PIE_COLORS[
                                  enquiryFunnel.findIndex(
                                    ([key]) => key === status,
                                  ) % PIE_COLORS.length
                                ],
                            }}
                          />
                        </div>
                        <span className="text-[13px] font-bold text-ink w-8 text-right">
                          {count}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-3">
                    <span className="text-[12.5px] text-slate-text/60">
                      Last updated {formatDate(new Date())}
                    </span>
                    <span className="text-[12.5px] font-semibold text-ink">
                      Total {data.admissions.length}
                    </span>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}