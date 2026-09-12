import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Wallet,
  UserPlus,
  CalendarCheck,
  ArrowUpRight,
  Bus,
  Bell,
  ClipboardList,
  GraduationCap,
  CalendarDays,
  Megaphone,
  BookOpenCheck,
  CreditCard,
  BriefcaseBusiness,
} from "lucide-react";
import { api } from "../lib/api";
import { hasPermission } from "../lib/permissions";
import { useSelector } from "react-redux";
import { selectUser, selectSchool } from "../store/selectors";
import {
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
import {
  StatCard,
  Card,
  Pill,
  statusTone,
  Avatar,
} from "../components/UI";
import AttendanceTrendChart from "../components/AttendanceTrendChart";
import {
  DashboardPagination,
  usePaged,
} from "../components/DashboardPagination";

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
  const user = useSelector(selectUser);
  const school = useSelector(selectSchool);
  const [data, setData] = useState({
    studentStats: { total: 0, active: 0, byClass: [] },
    students: [],
    attendance: [],
    invoices: [],
    payments: [],
    admissions: [],
    notices: [],
    busRoutes: [],
    staff: [],
    events: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attendanceFailed, setAttendanceFailed] = useState(false);

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
      api.staff.list(),
      api.events.list(),
    ])
      .then((results) => {
        const value = (index) =>
          results[index].status === "fulfilled" ? results[index].value : {};
        const failed = results.filter((result) => result.status === "rejected");
        setAttendanceFailed(results[2].status === "rejected");
        setData({
          studentStats: value(0).data || { total: 0, active: 0, byClass: [] },
          students: value(1).data || [],
          attendance: value(2).data || [],
          invoices: value(3).data || [],
          payments: value(4).data || [],
          admissions: value(5).data || [],
          notices: value(6).data || [],
          busRoutes: value(7).data || [],
          staff: value(8).data || [],
          events: value(9).data || [],
        });
        if (failed.length === results.length) {
          setError("Dashboard data could not be loaded. Please try again.");
        } else if (failed.length > 0) {
          setError("Some dashboard data is temporarily unavailable.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const retryAttendance = () => {
    setAttendanceFailed(false);
    setData((prev) => ({ ...prev, attendance: [] }));
    api.attendance
      .list()
      .then(({ data }) =>
        setData((prev) => ({ ...prev, attendance: data || [] })),
      )
      .catch(() => setAttendanceFailed(true));
  };

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
  const admissionList = admissionEnquiries.map((item) => ({
    ...item,
    id: item._id,
    date: formatDate(item.createdAt),
  }));
  const noticesList = notices.map((item) => ({
    ...item,
    id: item._id,
    category: Array.isArray(item.audience) ? item.audience[0] || "All" : "All",
    date: formatDate(item.createdAt),
  }));
  // Breakdown is derived from the real student list (the same source that
  // drives the rest of the dashboard) so slice counts always reflect reality.
  const classStrength = useMemo(() => {
    const buckets = new Map();
    students.forEach((student) => {
      const cls = String(student.class || "").trim() || "Unassigned";
      const section = String(student.section || "").trim();
      const key = `${cls}|${section}`;
      const label = section ? `Class ${cls}-${section}` : `Class ${cls}`;
      buckets.set(key, {
        name: label,
        value: (buckets.get(key)?.value || 0) + 1,
      });
    });
    return [...buckets.values()].sort((a, b) => {
      const numA = Number.parseInt(a.name.match(/\d+/)?.[0] || "99999", 10);
      const numB = Number.parseInt(b.name.match(/\d+/)?.[0] || "99999", 10);
      return numA - numB || a.name.localeCompare(b.name);
    });
  }, [students]);
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
  const lowAttendanceAll = attendanceByStudent
    .filter((student) => student.attendance > 0)
    .sort((a, b) => a.attendance - b.attendance);
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
  // Pagination state for the paged widgets (one independent pager per widget).
  const feePaged = usePaged(feeCollectionTrend.length, 5);
  const noticesPaged = usePaged(noticesList.length, 5);
  const admissionsPaged = usePaged(admissionList.length, 5);
  const watchlistPaged = usePaged(lowAttendanceAll.length, 5);
  const busPaged = usePaged(busRoutes.length, 5);
  const pagedFeeTrend = feeCollectionTrend.slice(feePaged.start, feePaged.end);
  const pagedNotices = noticesList.slice(noticesPaged.start, noticesPaged.end);
  const pagedAdmissions = admissionList.slice(
    admissionsPaged.start,
    admissionsPaged.end,
  );
  const pagedWatchlist = lowAttendanceAll.slice(
    watchlistPaged.start,
    watchlistPaged.end,
  );
  const pagedBuses = busRoutes.slice(busPaged.start, busPaged.end);
  const classStrengthTotal = classStrength.reduce(
    (sum, bucket) => sum + bucket.value,
    0,
  );
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
  const firstName = (user?.name || "Administrator").split(" ")[0];
  const teachersCount = (data.staff || []).filter(
    (s) => s.role === "teacher",
  ).length;
  const staffCount = (data.staff || []).length - teachersCount;
  const classesCount = classStrength.length;
  const upcomingEvents = (data.events || [])
    .filter((e) => e.date && new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="relative rounded-2xl overflow-hidden bg-ink min-h-[200px] sm:min-h-[240px]">
        <img
          src={school?.settings?.bannerImage || "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1600&h=400&q=80"}
          alt="School campus"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/60 to-transparent" />
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
              {studentStats.active.toLocaleString("en-IN")} active ·{" "}
              {teachersCount} teachers ·{" "}
              {staffCount} staff ·{" "}
              {classesCount} class sections
              {loading
                ? " · Loading live data…"
                : ""}
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

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { to: "/users", icon: UserPlus, label: "Add Student", perm: "students:write" },
          { to: "/teachers", icon: GraduationCap, label: "Add Staff", perm: "staff:write" },
          { to: "/fees-collection", icon: CreditCard, label: "Fee Collection", perm: "fees:collect" },
          { to: "/notice-board", icon: Megaphone, label: "Publish Notice", perm: "notices:publish" },
          { to: "/events", icon: CalendarDays, label: "New Event", perm: "events:publish" },
          { to: "/homework", icon: BookOpenCheck, label: "Homework", perm: "homework:read" },
        ]
          .filter((item) => hasPermission(user, item.perm))
          .map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="flex items-center gap-2.5 rounded-xl border border-black/[0.06] bg-white px-3.5 py-3 hover:bg-amber/5 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-amber/12 text-amber-dark flex items-center justify-center shrink-0">
                <item.icon size={15} />
              </div>
              <span className="text-[12.5px] font-semibold text-ink">{item.label}</span>
            </Link>
          ))}
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={GraduationCap}
          label="Teachers"
          value={String(teachersCount)}
          sub={teachersCount === 1 ? "teaching staff" : "teaching staff"}
          accent="info"
        />
        <StatCard
          icon={BriefcaseBusiness}
          label="Other Staff"
          value={String(staffCount)}
          sub={staffCount === 1 ? "support staff" : "support staff"}
          accent="amber"
        />
        <StatCard
          icon={ClipboardList}
          label="Class Sections"
          value={String(classesCount)}
          sub={`${classStrengthTotal} total students`}
          accent="success"
        />
        <StatCard
          icon={CalendarDays}
          label="Upcoming Events"
          value={String(upcomingEvents.length)}
          sub={upcomingEvents.length ? `Next: ${upcomingEvents[0]?.title?.slice(0, 20) || "event"}` : "No events scheduled"}
          accent="alert"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <AttendanceTrendChart
          records={attendance}
          loading={loading}
          error={attendanceFailed ? "Attendance data could not be loaded." : ""}
          onRetry={retryAttendance}
          title="Attendance Trend"
          className="lg:col-span-2"
          defaultRange="thisYear"
        />

        <Card title="Students by Section">
          {classStrength.length === 0 ? (
            <div className="flex items-center justify-center h-[230px] text-[13px] text-slate-text/60">
              No students enrolled yet
            </div>
          ) : (
            <>
              <div className="relative">
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
                      formatter={(value) => [`${value} students`, ""]}
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid #eee",
                        fontSize: 12.5,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="font-display text-[26px] font-bold text-ink leading-none">
                    {classStrengthTotal}
                  </span>
                  <span className="text-[10.5px] text-slate-text/60 mt-1">
                    students
                  </span>
                </div>
              </div>
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
                    <span className="font-semibold text-ink">{c.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Fee Collection vs Pending" className="lg:col-span-2">
          {pagedFeeTrend.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-[13px] text-slate-text/60">
              No fee records yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={pagedFeeTrend}
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
          <DashboardPagination {...feePaged} unit="periods" />
        </Card>

        <Card
          title="Pinned Notices"
          action={<Bell size={16} className="text-slate-text/50" />}
        >
          {pagedNotices.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-[13px] text-slate-text/60">
              No pinned notices
            </div>
          ) : (
            <div className="space-y-3.5">
              {pagedNotices.map((n) => (
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
          )}
          <DashboardPagination {...noticesPaged} />
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
          {pagedAdmissions.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-[13px] text-slate-text/60">
              No admission enquiries yet
            </div>
          ) : (
            <div className="space-y-3">
              {pagedAdmissions.map((a) => (
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
          )}
          <DashboardPagination {...admissionsPaged} unit="enquiries" />
        </Card>

        <Card
          title="Attendance Watchlist"
          action={<ClipboardList size={16} className="text-slate-text/50" />}
        >
          {pagedWatchlist.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-[13px] text-slate-text/60">
              No attendance concerns right now
            </div>
          ) : (
            <div className="space-y-3">
              {pagedWatchlist.map((s) => (
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
          )}
          <DashboardPagination {...watchlistPaged} unit="students" />
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
        {pagedBuses.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-[13px] text-slate-text/60">
            No buses configured yet
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {pagedBuses.map((b) => (
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
        )}
        <DashboardPagination {...busPaged} unit="buses" />
      </Card>

      <Card
        title="Upcoming Events"
        action={
          <Link
            to="/events"
            className="text-[12px] font-semibold text-info flex items-center gap-1"
          >
            All events <ArrowUpRight size={13} />
          </Link>
        }
      >
        {upcomingEvents.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-[13px] text-slate-text/60">
            No upcoming events
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map((ev) => (
              <div
                key={ev._id}
                className="flex items-center justify-between gap-3 pb-3 border-b border-black/[0.06] last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink truncate">
                    {ev.title}
                  </p>
                  <p className="text-[11.5px] text-slate-text/70">
                    {formatDate(ev.date)}
                    {ev.venue ? ` · ${ev.venue}` : ""}
                  </p>
                </div>
                <Pill tone={statusTone(ev.category || "All")}>
                  {ev.category || "General"}
                </Pill>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
