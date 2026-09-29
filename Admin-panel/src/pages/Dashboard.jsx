import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  Users,
  Wallet,
  UserPlus,
  CalendarCheck,
  Bus,
  Bell,
  ClipboardList,
  GraduationCap,
  CalendarDays,
  Megaphone,
  BookOpenCheck,
  CreditCard,
  BriefcaseBusiness,
  CheckCircle2,
  XCircle,
  Clock,
  UserRound,
  Building2,
  CalendarRange,
  PartyPopper,
  TrendingUp,
  Zap,
  MapPin,
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
import { Pill, statusTone, Avatar } from "../components/UI";
import AttendanceTrendChart from "../components/AttendanceTrendChart";
import {
  DashboardPagination,
  usePaged,
} from "../components/DashboardPagination";
import {
  HeroBanner,
  GlassStat,
  QuickActions,
  MetricGrid,
  MetricCard,
  Panel,
  ViewLink,
  EmptyPanel,
  ListRow,
  BarList,
  ACCENTS,
  greeting,
} from "../components/dashboard/DashKit";

const PIE_COLORS = ["#4F46E5", "#2563EB", "#0EA5E9", "#14B8A6", "#F59E0B", "#EC4899", "#8B5CF6"];

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

function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl shadow-black/8">
      {label && <p className="text-[12.5px] font-bold text-ink">{label}</p>}
      <div className="mt-2 space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2 text-[12px]">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: entry.color || entry.fill }}
            />
            <span className="flex-1 text-slate-text/70">{entry.name}</span>
            <span className="font-bold text-ink">{formatter ? formatter(entry.value) : entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const user = useSelector(selectUser);
  const school = useSelector(selectSchool);
  const [data, setData] = useState({
    studentStats: { total: 0, active: 0, byClass: [] },
    students: [],
    attendance: [],
    staffAttendance: [],
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
  const [staffAttendanceFailed, setStaffAttendanceFailed] = useState(false);
  const location = useLocation();
  const fetchCount = useRef(0);

  const fetchDashboardData = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
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
        api.staff.attendance.list("limit=5000"),
      ]);
      const value = (index) =>
        results[index].status === "fulfilled" ? results[index].value : {};
      const failed = results.filter((result) => result.status === "rejected");
      setAttendanceFailed(results[2].status === "rejected");
      setStaffAttendanceFailed(results[10].status === "rejected");
      setData({
        studentStats: value(0).data || { total: 0, active: 0, byClass: [] },
        students: value(1).data || [],
        attendance: value(2).data || [],
        staffAttendance: value(10).data || [],
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
    } catch {
      // network error
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Refresh data when user navigates back to dashboard
  useEffect(() => {
    if (fetchCount.current > 0) {
      fetchDashboardData();
    }
    fetchCount.current++;
  }, [location.pathname, fetchDashboardData]);

  // Refresh attendance data when user switches back to this tab (SSE fallback)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        Promise.allSettled([
          api.attendance.list(),
          api.staff.attendance.list("limit=5000"),
        ]).then(([attResult, staffAttResult]) => {
          if (attResult.status === "fulfilled") {
            setData((prev) => ({ ...prev, attendance: attResult.value.data || [] }));
            setAttendanceFailed(false);
          }
          if (staffAttResult.status === "fulfilled") {
            setData((prev) => ({ ...prev, staffAttendance: staffAttResult.value.data || [] }));
            setStaffAttendanceFailed(false);
          }
        });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Real-time attendance updates via SSE — replaces 30s polling
  useEffect(() => {
    const unsubscribe = api.attendanceStream.subscribe({
      onData: () => {
        if (document.visibilityState !== "visible") return;
        Promise.allSettled([
          api.attendance.list(),
          api.staff.attendance.list("limit=5000"),
        ]).then(([attResult, staffAttResult]) => {
          if (attResult.status === "fulfilled") {
            setData((prev) => ({ ...prev, attendance: attResult.value.data || [] }));
            setAttendanceFailed(false);
          }
          if (staffAttResult.status === "fulfilled") {
            setData((prev) => ({ ...prev, staffAttendance: staffAttResult.value.data || [] }));
            setStaffAttendanceFailed(false);
          }
        });
      },
      onStatus: () => {},
    });
    return unsubscribe;
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

  const retryStaffAttendance = () => {
    setStaffAttendanceFailed(false);
    setData((prev) => ({ ...prev, staffAttendance: [] }));
    api.staff.attendance
      .list("limit=5000")
      .then(({ data }) =>
        setData((prev) => ({ ...prev, staffAttendance: data || [] })),
      )
      .catch(() => setStaffAttendanceFailed(true));
  };

  const students = data.students;
  const attendance = data.attendance;
  const staffAttendance = data.staffAttendance;
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
  const feesOutstanding = data.invoices.reduce(
    (sum, invoice) =>
      sum + Math.max(0, Number(invoice.amount) - Number(invoice.paidAmount || 0)),
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

  // Staff attendance roll-up (was an inline IIFE before — same maths).
  const staffRollup = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayStaffAtt = staffAttendance.filter((r) => r.date === todayStr);
    const totalStaff = (data.staff || []).length;
    const teachers = (data.staff || []).filter((s) => s.role === "teacher");
    const present = todayStaffAtt.filter((r) => ["Present", "Late"].includes(r.status)).length;
    const absent = todayStaffAtt.filter((r) => r.status === "Absent").length;
    const notMarked = totalStaff - todayStaffAtt.length;
    const teacherPresent = todayStaffAtt.filter(
      (r) =>
        teachers.some((t) => String(t._id) === String(r.staffId)) &&
        ["Present", "Late"].includes(r.status),
    ).length;
    const teacherNotMarked =
      teachers.length -
      todayStaffAtt.filter((r) => teachers.some((t) => String(t._id) === String(r.staffId)))
        .length;
    return {
      totalStaff,
      present,
      absent,
      notMarked: Math.max(0, notMarked),
      teacherPresent,
      teacherNotMarked,
      pct: totalStaff > 0 ? Math.round((present / totalStaff) * 100) : 0,
    };
  }, [staffAttendance, data.staff]);

  const quickActions = [
    { to: "/users", icon: UserPlus, label: "Add Student", tone: ACCENTS.primary.icon, perm: "students:write" },
    { to: "/teachers", icon: GraduationCap, label: "Add Staff", tone: ACCENTS.violet.icon, perm: "staff:write" },
    { to: "/fees-collection", icon: CreditCard, label: "Fee Collection", tone: ACCENTS.success.icon, perm: "fees:collect" },
    { to: "/notice-board", icon: Megaphone, label: "Publish Notice", tone: ACCENTS.warn.icon, perm: "notices:publish" },
    { to: "/events", icon: CalendarDays, label: "New Event", tone: ACCENTS.alert.icon, perm: "events:publish" },
    { to: "/homework", icon: BookOpenCheck, label: "Homework", tone: ACCENTS.teal.icon, perm: "homework:read" },
  ].filter((item) => hasPermission(user, item.perm));

  const dateLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const sectionLegend = classStrength.map((c, i) => ({
    label: c.name,
    value: c.value,
    color: PIE_COLORS[i % PIE_COLORS.length],
    display: `${c.value} · ${classStrengthTotal ? Math.round((c.value / classStrengthTotal) * 100) : 0}%`,
  }));

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <HeroBanner
        gradient="indigo"
        eyebrow={greeting()}
        name={firstName}
        title={`${greeting()}, ${firstName}`}
        meta={
          `${studentStats.total.toLocaleString("en-IN")} students · ` +
          `${studentStats.active.toLocaleString("en-IN")} active · ` +
          `${teachersCount} teachers · ${staffCount} staff · ${classesCount} class sections` +
          (loading ? " · Loading live data…" : "")
        }
        dateLabel={dateLabel}
        image={
          school?.settings?.bannerImage ||
          "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1600&h=400&q=80"
        }
        quote="Great schools are built on great data."
        quoteTitle={school?.name || "School command centre"}
        right={
          <>
            <GlassStat value={`${attendancePercentage}%`} label="Attendance today" />
            <GlassStat value={pendingEnquiries} label="New enquiries" />
            <GlassStat value={studentStats.total.toLocaleString("en-IN")} label="Students" />
          </>
        }
      />

      {/* ── Quick actions ──────────────────────────────────────────── */}
      <QuickActions
        title="Quick Actions"
        icon={Zap}
        action={<ViewLink to="/students">Manage school</ViewLink>}
        items={quickActions}
        columns={6}
      />

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600"
        >
          {error}
        </div>
      )}

      {/* ── Primary metrics ────────────────────────────────────────── */}
      <MetricGrid columns={4}>
        <MetricCard
          icon={Users}
          label="Total Students"
          value={studentStats.total.toLocaleString("en-IN")}
          sub={`${studentStats.active.toLocaleString("en-IN")} active students`}
          accent="primary"
          to="/students"
        />
        <MetricCard
          icon={CalendarCheck}
          label="Today's Attendance"
          value={`${attendancePercentage}%`}
          sub={`${presentToday} present of ${todayAttendance.length} marked`}
          accent="success"
          progress={Number(attendancePercentage)}
          to="/attendance"
        />
        <MetricCard
          icon={Wallet}
          label="Fees Collected"
          value={`₹${(feesCollected / 100000).toFixed(1)}L`}
          sub={`of ₹${(feesExpected / 100000).toFixed(1)}L invoiced`}
          accent="warn"
          progress={feesExpected ? (feesCollected / feesExpected) * 100 : 0}
          to="/fees-collection"
        />
        <MetricCard
          icon={UserPlus}
          label="Admission Enquiries"
          value={admissionEnquiries.length}
          sub={
            pendingEnquiries ? (
              <span className="font-semibold text-rose-500">{pendingEnquiries} awaiting reply</span>
            ) : (
              "All enquiries handled"
            )
          }
          accent="alert"
          to="/admission-enquiry"
        />
      </MetricGrid>

      {/* ── School composition ─────────────────────────────────────── */}
      <MetricGrid columns={4}>
        <MetricCard
          icon={GraduationCap}
          label="Teachers"
          value={String(teachersCount)}
          sub={`${staffRollup.teacherPresent} present today`}
          accent="violet"
          to="/teachers"
        />
        <MetricCard
          icon={BriefcaseBusiness}
          label="Support Staff"
          value={String(staffCount)}
          sub={`${staffRollup.notMarked} check-ins pending`}
          accent="info"
          to="/users"
        />
        <MetricCard
          icon={ClipboardList}
          label="Class Sections"
          value={String(classesCount)}
          sub={`${classStrengthTotal} total students`}
          accent="teal"
          to="/students"
        />
        <MetricCard
          icon={CalendarDays}
          label="Upcoming Events"
          value={String(upcomingEvents.length)}
          sub={
            upcomingEvents.length
              ? `Next: ${upcomingEvents[0]?.title?.slice(0, 20) || "event"}`
              : "No events scheduled"
          }
          accent="neutral"
          to="/events"
        />
      </MetricGrid>

      <AttendanceTrendChart
        records={attendance}
        loading={loading}
        error={attendanceFailed ? "Attendance data could not be loaded." : ""}
        onRetry={retryAttendance}
        title="Attendance Trend"
        defaultRange="thisYear"
      />

      {/* ── Students by section + staff presence ───────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Students by Section"
          icon={Building2}
          iconTone={ACCENTS.violet.icon}
          subtitle="Live distribution of every enrolled student"
          action={<ViewLink to="/students">All students</ViewLink>}
        >
          {classStrength.length === 0 ? (
            <EmptyPanel
              icon={Building2}
              title="No students enrolled yet"
              text="Admissions will show up here as soon as students are enrolled into sections."
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 sm:items-center">
              <div className="relative">
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie
                      data={classStrength}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={88}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {classStrength.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${value} students`, ""]}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #E2E8F0",
                        fontSize: 12.5,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-[28px] font-bold leading-none text-ink">
                    {classStrengthTotal}
                  </span>
                  <span className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-text/60">
                    students
                  </span>
                </div>
              </div>
              <div className="scrollbar-thin max-h-[230px] space-y-2 overflow-y-auto pr-1">
                {sectionLegend.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-text"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: s.color }}
                    />
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    <span className="shrink-0 font-bold text-ink">{s.display}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="Staff Presence Today"
          icon={UserRound}
          iconTone={ACCENTS.success.icon}
          subtitle={new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          action={<ViewLink to="/staff/my-attendance">Details</ViewLink>}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="currentColor"
                  className="text-slate-100"
                  strokeWidth="12"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="currentColor"
                  className="text-success"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 52}
                  strokeDashoffset={
                    2 * Math.PI * 52 - (staffRollup.pct / 100) * 2 * Math.PI * 52
                  }
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-[27px] font-bold leading-none text-ink">
                  {staffRollup.pct}%
                </span>
                <span className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-text/60">
                  present
                </span>
              </div>
            </div>
            <div className="grid w-full grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
                  Teachers present
                </p>
                <p className="mt-1.5 font-display text-[20px] font-bold leading-none text-emerald-600">
                  {staffRollup.teacherPresent}
                </p>
                <p className="mt-1 text-[11px] text-slate-text/60">
                  {staffRollup.teacherNotMarked} not marked
                </p>
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50/70 px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
                  Absent today
                </p>
                <p className="mt-1.5 font-display text-[20px] font-bold leading-none text-rose-500">
                  {staffRollup.absent}
                </p>
                <p className="mt-1 text-[11px] text-slate-text/60">of {staffRollup.totalStaff} staff</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
                  Not marked
                </p>
                <p className="mt-1.5 font-display text-[20px] font-bold leading-none text-amber-600">
                  {staffRollup.notMarked}
                </p>
                <p className="mt-1 text-[11px] text-slate-text/60">pending check-in</p>
              </div>
              <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
                  Total present
                </p>
                <p className="mt-1.5 font-display text-[20px] font-bold leading-none text-sky-600">
                  {staffRollup.present}
                </p>
                <p className="mt-1 text-[11px] text-slate-text/60">across all staff</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <AttendanceTrendChart
        records={staffAttendance}
        loading={loading}
        error={staffAttendanceFailed ? "Staff attendance data could not be loaded." : ""}
        onRetry={retryStaffAttendance}
        title="Staff Attendance Trend"
        subtitle="Staff-wide attendance performance"
        defaultRange="thisYear"
      />

      {/* ── Money + notices ────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Fee Collection vs Pending"
          icon={TrendingUp}
          iconTone={ACCENTS.success.icon}
          subtitle="Realised collections against outstanding dues"
          action={<ViewLink to="/fees-collection">Fees</ViewLink>}
        >
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
                Collected
              </p>
              <p className="mt-1.5 font-display text-[20px] font-bold leading-none text-emerald-600">
                ₹{(feesCollected / 100000).toFixed(1)}L
              </p>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
                Outstanding
              </p>
              <p className="mt-1.5 font-display text-[20px] font-bold leading-none text-rose-500">
                ₹{(feesOutstanding / 100000).toFixed(1)}L
              </p>
            </div>
            <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 sm:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
                Invoiced
              </p>
              <p className="mt-1.5 font-display text-[20px] font-bold leading-none text-ink">
                ₹{(feesExpected / 100000).toFixed(1)}L
              </p>
            </div>
          </div>

          {pagedFeeTrend.length === 0 ? (
            <EmptyPanel
              icon={Wallet}
              title="No fee records yet"
              text="Raise invoices and record collections to see the monthly trend here."
            />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pagedFeeTrend} margin={{ left: -10, top: 5 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#475569" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `₹${v / 100000}L`}
                  tick={{ fontSize: 11, fill: "#475569" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(37,99,235,0.05)" }}
                  content={
                    <ChartTooltip formatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`} />
                  }
                />
                <Bar dataKey="collected" fill="#16A34A" radius={[6, 6, 0, 0]} name="Collected" />
                <Bar dataKey="pending" fill="#FCA5A5" radius={[6, 6, 0, 0]} name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          )}
          <DashboardPagination {...feePaged} unit="periods" />
        </Panel>

        <Panel
          title="Pinned Notices"
          icon={Bell}
          iconTone={ACCENTS.warn.icon}
          action={<ViewLink to="/notice-board">All</ViewLink>}
        >
          {pagedNotices.length === 0 ? (
            <EmptyPanel
              icon={Bell}
              iconTone={ACCENTS.warn.icon}
              title="No pinned notices"
              text="Circulars and announcements published to the school will show up here."
            />
          ) : (
            <div className="space-y-2.5">
              {pagedNotices.map((n) => (
                <ListRow
                  key={n.id}
                  icon={Megaphone}
                  iconTone={ACCENTS.warn.icon}
                  title={n.title}
                  meta={`${n.category} · ${n.date}`}
                />
              ))}
            </div>
          )}
          <DashboardPagination {...noticesPaged} />
        </Panel>
      </div>

      {/* ── Admissions + watchlist ────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Recent Admission Enquiries"
          icon={UserPlus}
          iconTone={ACCENTS.primary.icon}
          subtitle="Latest leads from the front desk and website"
          action={<ViewLink to="/admission-enquiry">View all</ViewLink>}
        >
          {pagedAdmissions.length === 0 ? (
            <EmptyPanel
              icon={UserPlus}
              title="No admission enquiries yet"
              text="New enquiries raised at reception will appear here instantly."
            />
          ) : (
            <div className="space-y-2.5">
              {pagedAdmissions.map((a) => (
                <ListRow
                  key={a.id}
                  icon={ClipboardList}
                  iconTone={ACCENTS.primary.icon}
                  title={a.childName}
                  meta={`Class ${a.classApplied || "—"} · ${a.date}`}
                  trailing={<Pill tone={statusTone(a.status)}>{a.status}</Pill>}
                />
              ))}
            </div>
          )}
          <DashboardPagination {...admissionsPaged} unit="enquiries" />
        </Panel>

        <Panel
          title="Attendance Watchlist"
          icon={XCircle}
          iconTone={ACCENTS.alert.icon}
          subtitle="Lowest attendance students"
          action={<ViewLink to="/students">All</ViewLink>}
        >
          {pagedWatchlist.length === 0 ? (
            <EmptyPanel
              icon={CheckCircle2}
              iconTone={ACCENTS.success.icon}
              title="No attendance concerns"
              text="Every student is comfortably above their attendance threshold."
            />
          ) : (
            <div className="space-y-3">
              {pagedWatchlist.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <Avatar src={s.avatar} name={s.name} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-bold text-ink">{s.name}</p>
                    <p className="text-[11px] text-slate-text/60">
                      Class {s.class}-{s.section}
                    </p>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${
                          s.attendance < 60
                            ? "bg-rose-500"
                            : s.attendance < 75
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.max(4, s.attendance)}%` }}
                      />
                    </div>
                  </div>
                  <span
                    className={`shrink-0 font-display text-[14px] font-bold ${
                      s.attendance < 60 ? "text-rose-500" : s.attendance < 75 ? "text-amber-600" : "text-emerald-600"
                    }`}
                  >
                    {s.attendance}%
                  </span>
                </div>
              ))}
            </div>
          )}
          <DashboardPagination {...watchlistPaged} unit="students" />
        </Panel>
      </div>

      {/* ── Bus fleet ─────────────────────────────────────────────── */}
      <Panel
        title="Bus Fleet Status"
        icon={Bus}
        iconTone={ACCENTS.info.icon}
        subtitle="Live location and load per route"
        action={<ViewLink to="/bus-tracking">Live tracking</ViewLink>}
      >
        {pagedBuses.length === 0 ? (
          <EmptyPanel
            icon={MapPin}
            iconTone={ACCENTS.info.icon}
            title="No buses configured yet"
            text="Add routes, drivers and vehicles to track your fleet live."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {pagedBuses.map((b) => (
              <div
                key={b.id}
                className="group rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_14px_28px_-20px_rgba(2,132,199,0.6)]"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      b.status === "Live" ? ACCENTS.success.icon : ACCENTS.neutral.icon
                    }`}
                  >
                    <Bus size={17} />
                  </span>
                  <Pill tone={statusTone(b.status)}>{b.status}</Pill>
                </div>
                <p className="mt-3 font-display text-[14px] font-bold text-ink">{b.id}</p>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-text/60">{b.route}</p>
                <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2.5 text-[11px] text-slate-text/65">
                  <Users size={12} aria-hidden="true" />
                  {b.occupied} assigned · ETA {b.eta}
                </div>
              </div>
            ))}
          </div>
        )}
        <DashboardPagination {...busPaged} unit="buses" />
      </Panel>

      {/* ── Events + growth mix ────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Upcoming Events"
          icon={PartyPopper}
          iconTone={ACCENTS.violet.icon}
          action={<ViewLink to="/events">All events</ViewLink>}
        >
          {upcomingEvents.length === 0 ? (
            <EmptyPanel
              icon={CalendarRange}
              iconTone={ACCENTS.violet.icon}
              title="No upcoming events"
              text="Plan a school event and it will surface here for the whole staff."
            />
          ) : (
            <div className="space-y-2.5">
              {upcomingEvents.map((ev) => (
                <ListRow
                  key={ev._id}
                  title={ev.title}
                  meta={`${formatDate(ev.date)}${ev.venue ? ` · ${ev.venue}` : ""}`}
                  icon={CalendarDays}
                  iconTone={ACCENTS.violet.icon}
                  trailing={
                    <Pill tone={statusTone(ev.category || "All")}>{ev.category || "General"}</Pill>
                  }
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Enrolment Mix"
          icon={Building2}
          iconTone={ACCENTS.teal.icon}
          subtitle="Active vs inactive roll"
        >
          {studentStats.total ? (
            <div className="space-y-4">
              <BarList
                accent="success"
                items={[
                  {
                    label: "Active students",
                    value: studentStats.active,
                    display: studentStats.active.toLocaleString("en-IN"),
                  },
                  {
                    label: "Inactive / alumni",
                    value: Math.max(0, studentStats.total - studentStats.active),
                    display: Math.max(0, studentStats.total - studentStats.active).toLocaleString("en-IN"),
                    barClass: "bg-slate-300",
                  },
                ]}
                showPct={false}
              />
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
                  Staff to student ratio
                </p>
                <p className="mt-1.5 font-display text-[20px] font-bold leading-none text-ink">
                  {studentStats.total && (data.staff || []).length
                    ? `1 : ${Math.round(studentStats.total / (data.staff || []).length)}`
                    : "—"}
                </p>
                <p className="mt-1.5 text-[11.5px] text-slate-text/65">
                  {teachersCount} teaching · {staffCount} support
                </p>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-slate-text/70">
                <Clock size={13} aria-hidden="true" />
                Last refreshed {new Date().toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ) : (
            <EmptyPanel icon={Building2} title="No enrolment data" text="Add students to see the roll mix." />
          )}
        </Panel>
      </div>

    </div>
  );
}
