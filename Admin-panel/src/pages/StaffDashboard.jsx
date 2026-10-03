import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  CalendarCheck,
  CalendarClock,
  Banknote,
  FileText,
  UserRound,
  BriefcaseBusiness,
  Clock,
  UserCog,
  Wallet,
  CheckCircle2,
  Megaphone,
  Cake,
  ShieldCheck,
  Sparkles,
  Zap,
  MapPin,
  Mail,
  Phone,
  Hash,
  Building2,
  TrendingUp,
} from "lucide-react";
import { api } from "../lib/api";
import {
  Card,
  StatCard,
  Pill,
  Avatar,
  Button,
  statusTone,
} from "../components/UI";
import { selectUser, selectSchool } from "../store/selectors";
import { useSelector } from "react-redux";
import { isPersonaStaff, resolvePersona } from "../lib/persona";
import {
  HeroBanner,
  GlassStat,
  QuickActions,
  MetricGrid,
  Panel,
  ViewLink,
  EmptyPanel,
  ListRow,
  StatTile,
  BarList,
  DashboardSkeleton,
  ACCENTS,
  greeting,
} from "../components/dashboard/DashKit";

function cap(value) {
  if (!value) return "—";
  return String(value).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(value) {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function fmtMoney(value) {
  const n = Number(value || 0);
  return n ? `₹${n.toLocaleString("en-IN")}` : "—";
}

const PROFILE_FIELDS = [
  { key: "employeeId", label: "Employee ID", icon: Hash },
  { key: "designation", label: "Designation", icon: BriefcaseBusiness },
  { key: "department", label: "Department", icon: Building2, transform: cap },
  { key: "joiningDate", label: "Joining Date", icon: Cake, transform: fmtDate },
  { key: "contact", label: "Contact", icon: Phone },
  { key: "email", label: "Email", icon: Mail, fallbackFromUser: "email" },
];

export default function StaffDashboard() {
  const user = useSelector(selectUser);
  const school = useSelector(selectSchool);
  const navigate = useNavigate();
  const [data, setData] = useState({ staff: null, leaves: [], payroll: [], attendance: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const persona = isPersonaStaff(user) ? resolvePersona(user) : null;

  useEffect(() => {
    if (persona) return;
    Promise.allSettled([
      api.staff.list(),
      api.leaves.list(),
      api.payroll.list(),
      api.staff.attendance.list("limit=10"),
    ]).then((results) => {
      const failed = results.some((r) => r.status === "rejected");
      const value = (i) => (results[i].status === "fulfilled" ? results[i].value.data : null);
      const staff = Array.isArray(value(0)) ? value(0)[0] || null : value(0) || null;
      setData({
        staff,
        leaves: value(1) || [],
        payroll: value(2) || [],
        attendance: value(3) || [],
      });
      if (failed && results[0].status === "rejected") {
        setError("Some data could not be loaded. Please try again.");
      }
      setLoading(false);
    });
  }, [persona]);

  const { staff, leaves, payroll, attendance } = data;

  const leaveCounts = useMemo(() => {
    const byStatus = { Pending: 0, Approved: 0, Rejected: 0 };
    (leaves || []).forEach((l) => { if (byStatus[l.status] !== undefined) byStatus[l.status] += 1; });
    return byStatus;
  }, [leaves]);

  if (persona) {
    return (
      <Card>
        <div className="py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BriefcaseBusiness size={28} />
          </div>
          <p className="mt-5 font-display text-xl font-bold text-ink">{persona.label} Workspace</p>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-slate-text/70">
            Your role has a dedicated workspace with tools built for it. Opening it now…
          </p>
          <Button variant="primary" className="mt-6" onClick={() => navigate(persona.landing)}>
            Open {persona.label} Workspace
          </Button>
        </div>
      </Card>
    );
  }

  const latestPay = payroll[0] || null;
  const firstName = (user?.name || staff?.name || "Staff Member").split(" ")[0];
  const displayName = staff?.name || user?.name || "Staff Member";
  const designation = staff?.designation || cap(user?.designation) || "Staff";

  const attendancePresent = (attendance || []).filter((a) =>
    ["Present", "Late"].includes(a.status),
  ).length;
  const attendancePct = attendance.length
    ? Math.round((attendancePresent / attendance.length) * 100)
    : null;

  const totalPayroll = payroll.reduce((s, p) => s + Number(p.netPay || 0), 0);

  const quickActions = [
    { to: "/leave", icon: CalendarClock, label: "Apply for Leave", accent: "warn" },
    { to: "/staff/my-attendance", icon: Clock, label: "My Attendance", accent: "info" },
    { to: "/staff/profile", icon: UserCog, label: "My Profile", accent: "violet" },
    { to: "/payroll", icon: Banknote, label: "My Payslips", accent: "success" },
    { to: "/notice-board", icon: Megaphone, label: "Notice Board", accent: "alert" },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <HeroBanner
        gradient="slate"
        eyebrow={greeting()}
        name={firstName}
        title={firstName}
        meta={`${designation}${staff?.employeeId ? ` · ${staff.employeeId}` : " · Team Member"}`}
        dateLabel={new Date().toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        image={school?.settings?.bannerImage}
        stats={
          <>
            <GlassStat value={fmtMoney(latestPay?.netPay) || "—"} label="Latest take-home" />
            <GlassStat value={`${leaveCounts.Approved}/${leaves.length}`} label="Leaves approved" />
            <GlassStat
              value={attendancePct != null ? `${attendancePct}%` : "—"}
              label="My attendance"
            />
          </>
        }
      />

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600"
        >
          {error}
        </div>
      )}

      <QuickActions
        title="Quick Actions"
        icon={Zap}
        items={quickActions}
      />

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* ── Metric strip ───────────────────────────────────────── */}
          <MetricGrid columns={4}>
            <StatCard
              icon={UserRound}
              label="Profile"
              value={staff ? "Linked" : "Not linked"}
              sub={staff?.status || "No staff record yet"}
              accent="info"
            />
            <StatCard
              icon={CalendarClock}
              label="My Leaves"
              value={`${leaveCounts.Approved}/${leaves.length}`}
              sub={
                leaveCounts.Pending ? (
                  <span className="font-semibold text-amber-600">
                    {leaveCounts.Pending} pending review
                  </span>
                ) : (
                  "Nothing pending"
                )
              }
              accent="primary"
            />
            <StatCard
              icon={Banknote}
              label="Payslips"
              value={String(payroll.length)}
              sub={latestPay ? `${latestPay.month} ${latestPay.year}` : "No salary records"}
              accent="success"
            />
            <StatCard
              icon={BadgeCheck}
              label="Department"
              value={cap(staff?.department) || "—"}
              sub={staff?.role ? cap(staff.role) : "—"}
              accent="alert"
            />
          </MetricGrid>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* ── Profile ─────────────────────────────────────────── */}
            <Panel
              className="lg:col-span-2"
              title="My Profile"
              icon={UserRound}
              iconTone={ACCENTS.info.icon}
              subtitle="Employment details from the school records"
              action={<ViewLink to="/staff/profile">Edit profile</ViewLink>}
              decor="people"
              decorTone={ACCENTS.violet.text}
            >
              {staff ? (
                <div>
                  <div className="flex flex-col items-start gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 sm:flex-row sm:items-center">
                    <Avatar src={staff.photoUrl} name={displayName} size={64} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[17px] font-bold text-ink">
                        {displayName}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-slate-text/70">
                        {designation}
                        {staff?.department ? ` · ${cap(staff.department)}` : ""}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <Pill tone={statusTone(staff.status)}>{staff.status || "Active"}</Pill>
                        {staff.employeeId && (
                          <span className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-600">
                            {staff.employeeId}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-full rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 sm:w-auto">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
                        Monthly salary
                      </p>
                      <p className="mt-1 font-display text-[20px] font-bold leading-none text-emerald-600">
                        {fmtMoney(staff.salary)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {PROFILE_FIELDS.map(({ key, label, icon: Icon, transform, fallbackFromUser }) => {
                      const raw = staff[key] || (fallbackFromUser ? user?.[fallbackFromUser] : "");
                      const value = transform ? transform(raw) : raw;
                      return (
                        <div
                          key={key}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                              <Icon size={12} />
                            </span>
                            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
                              {label}
                            </p>
                          </div>
                          <p className="mt-2 break-words text-[13.5px] font-bold text-ink">
                            {value || "—"}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {staff.classesAssigned?.length > 0 && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
                        Classes assigned
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {staff.classesAssigned.map((c) => (
                          <span
                            key={`${c.class}-${c.section}`}
                            className="rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-bold text-ink shadow-sm ring-1 ring-inset ring-slate-200"
                          >
                            Class {c.class}-{c.section}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyPanel
                  icon={UserRound}
                  iconTone={ACCENTS.info.icon}
                  title="No staff record linked"
                  text="No staff record is linked to this account yet. Contact the school admin to link it."
                />
              )}
            </Panel>

            {/* ── Attendance + leave split ────────────────────────── */}
            <div className="space-y-5">
              <Panel
                title="My Attendance"
                icon={Clock}
                iconTone={ACCENTS.teal.icon}
                subtitle="Recent check-ins"
                action={<ViewLink to="/staff/my-attendance">All</ViewLink>}
                decor="attend"
                decorTone={ACCENTS.info.text}
              >
                {attendance.length === 0 ? (
                  <EmptyPanel
                    icon={Clock}
                    iconTone={ACCENTS.teal.icon}
                    title="No attendance records"
                    text="Check in daily to build your attendance history."
                  />
                ) : (
                  <div className="space-y-2.5">
                    {attendance.slice(0, 5).map((a) => (
                      <ListRow
                        key={a._id}
                        icon={Clock}
                        iconTone={
                          a.status === "Present"
                            ? ACCENTS.success.icon
                            : a.status === "Absent"
                              ? ACCENTS.alert.icon
                              : ACCENTS.warn.icon
                        }
                        title={fmtDate(a.date)}
                        meta={a.checkIn ? `In: ${a.checkIn}${a.checkOut ? ` · Out: ${a.checkOut}` : ""}` : "No check-in recorded"}
                        trailing={<Pill tone={statusTone(a.status)}>{a.status}</Pill>}
                      />
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                title="Leave Balance"
                icon={CalendarCheck}
                iconTone={ACCENTS.warn.icon}
                action={<ViewLink to="/leave">Manage</ViewLink>}
              >
                <BarList
                  accent="primary"
                  showPct={false}
                  items={[
                    { label: "Approved", value: leaveCounts.Approved, barClass: "bg-emerald-500" },
                    { label: "Pending", value: leaveCounts.Pending, barClass: "bg-amber-500" },
                    { label: "Rejected", value: leaveCounts.Rejected, barClass: "bg-rose-400" },
                  ]}
                />
              </Panel>
            </div>
          </div>

          {/* ── Leave applications ─────────────────────────────────── */}
          <Panel
            title="My Leave Applications"
            icon={CalendarClock}
            iconTone={ACCENTS.warn.icon}
            subtitle={`${leaves.length} application${leaves.length === 1 ? "" : "s"} on record`}
            action={<ViewLink to="/leave">Manage</ViewLink>}
          >
            {leaves.length === 0 ? (
              <EmptyPanel
                icon={CalendarClock}
                iconTone={ACCENTS.warn.icon}
                title="No leave applications"
                text="Apply for leave and track its approval status right here."
                action={<ViewLink to="/leave">Apply for leave</ViewLink>}
              />
            ) : (
              <div className="grid gap-2.5 md:grid-cols-2">
                {leaves.slice(0, 6).map((l) => (
                  <ListRow
                    key={l._id}
                    icon={CalendarCheck}
                    iconTone={ACCENTS.warn.icon}
                    title={`${l.leaveType} Leave`}
                    meta={`${fmtDate(l.fromDate)} → ${fmtDate(l.toDate)}`}
                    trailing={<Pill tone={statusTone(l.status)}>{l.status}</Pill>}
                  />
                ))}
              </div>
            )}
          </Panel>

          {/* ── Payroll history ────────────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel
              className="lg:col-span-2"
              title="Salary History"
              icon={Wallet}
              iconTone={ACCENTS.success.icon}
              subtitle={payroll.length ? `${payroll.length} payslips released` : "No payslips yet"}
              action={<ViewLink to="/payroll">All payslips</ViewLink>}
              decor="coins"
              decorTone={ACCENTS.success.text}
            >
              {payroll.length === 0 ? (
                <EmptyPanel
                  icon={Wallet}
                  iconTone={ACCENTS.success.icon}
                  title="No salary records released"
                  text="Your payslips will appear here as soon as payroll is processed."
                />
              ) : (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
                        Latest net pay
                      </p>
                      <p className="mt-1.5 font-display text-[20px] font-bold leading-none text-emerald-600">
                        {fmtMoney(latestPay?.netPay)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
                        Total earned
                      </p>
                      <p className="mt-1.5 font-display text-[20px] font-bold leading-none text-ink">
                        {fmtMoney(totalPayroll)}
                      </p>
                    </div>
                    <div className="col-span-2 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:col-span-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
                        Payslips
                      </p>
                      <p className="mt-1.5 font-display text-[20px] font-bold leading-none text-ink">
                        {payroll.length}
                      </p>
                    </div>
                  </div>

                  <div className="-mx-5 overflow-x-auto sm:-mx-6">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-slate-text/50">
                          <th className="px-5 py-2 font-semibold sm:px-6">Month</th>
                          <th className="px-5 py-2 font-semibold">Basic</th>
                          <th className="px-5 py-2 font-semibold">Allowances</th>
                          <th className="px-5 py-2 font-semibold">Deductions</th>
                          <th className="px-5 py-2 font-semibold">Net Pay</th>
                          <th className="px-5 py-2 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payroll.slice(0, 8).map((p) => (
                          <tr key={p._id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
                            <td className="px-5 py-3 font-bold text-ink sm:px-6">
                              {p.month} {p.year}
                            </td>
                            <td className="px-5 py-3 tabular-nums text-slate-text">{fmtMoney(p.basic)}</td>
                            <td className="px-5 py-3 tabular-nums text-slate-text">{fmtMoney(p.allowances)}</td>
                            <td className="px-5 py-3 tabular-nums text-rose-500">{fmtMoney(p.deductions)}</td>
                            <td className="px-5 py-3 font-display font-bold tabular-nums text-ink">
                              {fmtMoney(p.netPay)}
                            </td>
                            <td className="px-5 py-3">
                              <Pill tone={statusTone(p.status)}>{p.status}</Pill>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-[12px] text-slate-text/60">
                    <FileText size={13} aria-hidden="true" /> Payslips for the latest month are
                    available in Payroll.
                  </p>
                </>
              )}
            </Panel>

            {/* ── At a glance ─────────────────────────────────────── */}
            <Panel
              title="At a Glance"
              icon={Sparkles}
              iconTone={ACCENTS.violet.icon}
              subtitle="Your work summary"
            >
              <div className="grid grid-cols-2 gap-2.5">
                <StatTile
                  label="Attendance"
                  value={attendancePct != null ? `${attendancePct}%` : "—"}
                  dot={attendancePct != null && attendancePct >= 75 ? "bg-emerald-500" : "bg-amber-500"}
                  tone={attendancePct != null && attendancePct >= 75 ? "text-emerald-600" : "text-amber-600"}
                />
                <StatTile label="Leaves approved" value={leaveCounts.Approved} dot="bg-emerald-500" tone="text-emerald-600" />
                <StatTile label="Payslips" value={payroll.length} dot="bg-indigo-500" tone="text-ink" />
                <StatTile
                  label="Classes"
                  value={staff?.classesAssigned?.length || 0}
                  dot="bg-teal-500"
                  tone="text-ink"
                />
              </div>

              <div className="mt-4 space-y-2.5 rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50/70 to-white p-4">
                {[
                  {
                    icon: CheckCircle2,
                    label: "Profile status",
                    value: staff ? "Linked & active" : "Not linked",
                    tone: staff ? "text-emerald-600" : "text-rose-500",
                  },
                  {
                    icon: TrendingUp,
                    label: "Latest payout",
                    value: fmtMoney(latestPay?.netPay),
                    tone: "text-ink",
                  },
                  {
                    icon: ShieldCheck,
                    label: "Employee ID",
                    value: staff?.employeeId || "—",
                    tone: "text-ink",
                  },
                  {
                    icon: MapPin,
                    label: "Work location",
                    value: school?.name || "—",
                    tone: "text-ink",
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
                      <row.icon size={14} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-slate-text/70">
                      {row.label}
                    </span>
                    <span className={`shrink-0 text-[12.5px] font-bold ${row.tone}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
