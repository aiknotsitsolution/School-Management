import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Wallet,
  UserPlus,
  CalendarCheck,
  ArrowUpRight,
  Bus,
  Bell,
  ClipboardList,
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
import { StatCard, Card, Pill, statusTone, Avatar } from "../components/UI";

const PIE_COLORS = ["#16213E", "#E8A33D", "#3F8F5F", "#3B6FA0", "#D65A4A"];

function formatDate(value) {
  return value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      })
    : "—";
}

function monthKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}`;
}

export default function Dashboard() {
  const [data, setData] = useState({
    studentStats: { total: 0, active: 0, byClass: [] },
    students: [],
    attendance: [],
    invoices: [],
    payments: [],
    admissions: [],
    notices: [],
    busRoutes: [],
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
      api.notices.list(),
      api.transport.list(),
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
          notices: value(6).data || [],
          busRoutes: value(7).data || [],
        });
        if (failed.length === results.length) {
          setError("Dashboard data could not be loaded. Please try again.");
        } else if (failed.length > 0) {
          setError("Some dashboard data is temporarily unavailable.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const students = data.students;
  const attendance = data.attendance;
  const admissionEnquiries = data.admissions;
  const notices = data.notices;
  const busRoutes = data.busRoutes.map((route) => ({
    ...route,
    id: route.routeNo || route._id,
    route: route.stops?.length
      ? `${route.stops.length} stops`
      : "Route details unavailable",
    status: route.currentLocation ? "Live" : "Not tracking",
    occupied: route.assignedStudents?.length || 0,
    eta: route.currentLocation ? "Live" : "—",
  }));
  const studentStats = data.studentStats;
  const recentAdmissions = admissionEnquiries.slice(0, 4).map((item) => ({
    ...item,
    id: item._id,
    date: formatDate(item.createdAt),
  }));
  const pinnedNotices = notices.slice(0, 3).map((item) => ({
    ...item,
    id: item._id,
    category: Array.isArray(item.audience) ? item.audience[0] || "All" : "All",
    date: formatDate(item.createdAt),
  }));
  const classStrength = (studentStats.byClass || []).map((item) => ({
    name: item._id || "Unknown",
    value: item.count,
  }));
  const attendanceByStudent = students.map((student) => {
    const records = attendance.filter(
      (item) => String(item.studentId) === String(student._id),
    );
    const present = records.filter((item) => item.status === "Present").length;
    return {
      ...student,
      id: student._id,
      attendance: records.length
        ? Math.round((present / records.length) * 100)
        : 0,
      avatar: student.photoUrl,
    };
  });
  const lowAttendance = attendanceByStudent
    .filter((student) => student.attendance > 0)
    .sort((a, b) => a.attendance - b.attendance)
    .slice(0, 5);
  const attendanceTrend = useMemo(() => {
    const grouped = new Map();
    attendance.forEach((record) => {
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
      month: new Date(item.date).toLocaleDateString("en-IN", {
        month: "short",
      }),
      attendance: item.total
        ? Math.round((item.present / item.total) * 100)
        : 0,
    }));
  }, [attendance]);
  const feeCollectionTrend = useMemo(() => {
    const grouped = new Map();
    data.payments.forEach((payment) => {
      const key = monthKey(payment.paidOn);
      const current = grouped.get(key) || {
        month: formatDate(payment.paidOn),
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
  const today = new Date().toISOString().slice(0, 10);
  const todayAttendance = attendance.filter(
    (record) => new Date(record.date).toISOString().slice(0, 10) === today,
  );
  const presentToday = todayAttendance.filter(
    (record) => record.status === "Present",
  ).length;
  const attendancePercentage = todayAttendance.length
    ? ((presentToday / todayAttendance.length) * 100).toFixed(1)
    : "0.0";
  const feesCollected = data.payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
  const feesExpected = data.invoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount || 0),
    0,
  );
  const pendingEnquiries = admissionEnquiries.filter(
    (item) => item.status === "New",
  ).length;
  const currentUser =
    typeof window !== "undefined" && localStorage.getItem("erp_user")
      ? JSON.parse(localStorage.getItem("erp_user"))
      : { name: "Administrator" };
  const firstName = currentUser.name.split(" ")[0];

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="relative rounded-2xl overflow-hidden bg-ink">
        <img
          src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1600&h=400&q=80"
          alt="School campus"
          className="absolute inset-0 w-full h-full object-cover opacity-25"
        />
        <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-amber font-semibold text-[12.5px]">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <h2 className="font-display text-2xl sm:text-[28px] font-bold text-white mt-1">
              Good morning, {firstName} 👋
            </h2>
            <p className="text-white/60 text-[13.5px] mt-1.5">
              {studentStats.total.toLocaleString("en-IN")} students ·{" "}
              {studentStats.active.toLocaleString("en-IN")} active ·
              {loading
                ? " Loading live data..."
                : " Live school operations overview"}
            </p>
          </div>
          <div className="flex gap-3">
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 text-center">
              <p className="font-display text-xl font-bold text-white">
                {attendancePercentage}%
              </p>
              <p className="text-white/50 text-[11px]">Today's Attendance</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 text-center">
              <p className="font-display text-xl font-bold text-white">
                {
                  admissionEnquiries.filter((item) => item.status === "New")
                    .length
                }
              </p>
              <p className="text-white/50 text-[11px]">New Enquiries</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <Card>
          <p className="text-sm text-alert">{error}</p>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Students"
          value={studentStats.total.toLocaleString("en-IN")}
          sub={`${studentStats.active.toLocaleString("en-IN")} active students`}
          accent="amber"
        />
        <StatCard
          icon={CalendarCheck}
          label="Today's Attendance"
          value={`${attendancePercentage}%`}
          sub={`${presentToday} present of ${todayAttendance.length} marked`}
          accent="success"
        />
        <StatCard
          icon={Wallet}
          label="Fees Collected"
          value={`₹${(feesCollected / 100000).toFixed(1)}L`}
          sub={`of ₹${(feesExpected / 100000).toFixed(1)}L invoiced`}
          accent="info"
        />
        <StatCard
          icon={UserPlus}
          label="Admission Enquiries"
          value={admissionEnquiries.length}
          sub={`${pendingEnquiries} new enquiries`}
          accent="alert"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Attendance Trend" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={attendanceTrend} margin={{ left: -20, top: 5 }}>
              <defs>
                <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E8A33D" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#E8A33D" stopOpacity={0} />
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
                domain={["dataMin - 5", 100]}
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
                fill="url(#attGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Students by Section">
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie
                data={classStrength}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
              >
                {classStrength.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
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
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Fee Collection vs Pending" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={feeCollectionTrend}
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
        </Card>

        <Card
          title="Pinned Notices"
          action={<Bell size={16} className="text-slate-text/50" />}
        >
          <div className="space-y-3.5">
            {pinnedNotices.map((n) => (
              <div
                key={n.id}
                className="pb-3.5 border-b border-black/[0.06] last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Pill tone="amber">{n.category}</Pill>
                  <span className="text-[11px] text-slate-text/50">
                    {n.date}
                  </span>
                </div>
                <p className="text-[13px] font-semibold text-ink leading-snug">
                  {n.title}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card
          title="Recent Admission Enquiries"
          className="lg:col-span-2"
          action={
            <a
              href="/admission-enquiry"
              className="text-[12px] font-semibold text-info flex items-center gap-1"
            >
              View all <ArrowUpRight size={13} />
            </a>
          }
        >
          <div className="space-y-3">
            {recentAdmissions.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink truncate">
                    {a.childName}
                  </p>
                  <p className="text-[11.5px] text-slate-text/70">
                    {a.classApplied} · {a.date}
                  </p>
                </div>
                <Pill tone={statusTone(a.status)}>{a.status}</Pill>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Attendance Watchlist"
          action={<ClipboardList size={16} className="text-slate-text/50" />}
        >
          <div className="space-y-3">
            {lowAttendance.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5">
                <Avatar src={s.avatar} name={s.name} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-ink truncate">
                    {s.name}
                  </p>
                  <p className="text-[11px] text-slate-text/60">
                    Class {s.class}-{s.section}
                  </p>
                </div>
                <span className="text-[12.5px] font-bold text-alert">
                  {s.attendance}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card
        title="Bus Fleet Status"
        action={
          <a
            href="/bus-tracking"
            className="text-[12px] font-semibold text-info flex items-center gap-1"
          >
            Live tracking <ArrowUpRight size={13} />
          </a>
        }
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {busRoutes.map((b) => (
            <div
              key={b.id}
              className="rounded-xl border border-black/[0.06] p-3.5"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-info/10 text-info flex items-center justify-center">
                  <Bus size={15} />
                </div>
                <Pill tone={statusTone(b.status)}>{b.status}</Pill>
              </div>
              <p className="text-[12.5px] font-bold text-ink">{b.id}</p>
              <p className="text-[11px] text-slate-text/60 mt-0.5 line-clamp-1">
                {b.route}
              </p>
              <p className="text-[11px] text-slate-text/60 mt-1.5">
                {b.occupied} assigned · ETA {b.eta}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
