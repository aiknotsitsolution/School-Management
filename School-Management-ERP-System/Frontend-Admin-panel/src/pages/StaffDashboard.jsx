import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarCheck,
  CalendarClock,
  Banknote,
  FileText,
  UserRound,
  BriefcaseBusiness,
  ChevronRight,
} from "lucide-react";
import { api } from "../lib/api";
import {
  PageIntro,
  Card,
  StatCard,
  Pill,
  Avatar,
  Button,
  statusTone,
} from "../components/UI";
import { selectUser } from "../store/selectors";
import { useSelector } from "react-redux";
import { isPersonaStaff, resolvePersona } from "../lib/persona";

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

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function StaffDashboard() {
  const user = useSelector(selectUser);
  const [data, setData] = useState({ staff: null, leaves: [], payroll: [] });
  const [loading, setLoading] = useState(true);

  const persona = isPersonaStaff(user) ? resolvePersona(user) : null;

  useEffect(() => {
    if (persona) return;
    Promise.allSettled([
      api.staff.list(),
      api.leaves.list(),
      api.payroll.list(),
    ]).then((results) => {
      const value = (i) => (results[i].status === "fulfilled" ? results[i].value.data : null);
      const staff = Array.isArray(value(0)) ? value(0)[0] || null : value(0) || null;
      setData({
        staff,
        leaves: value(1) || [],
        payroll: value(2) || [],
      });
      setLoading(false);
    });
  }, [persona]);

  const { staff, leaves, payroll } = data;

  const leaveCounts = useMemo(() => {
    const byStatus = { Pending: 0, Approved: 0, Rejected: 0 };
    (leaves || []).forEach((l) => { if (byStatus[l.status] !== undefined) byStatus[l.status] += 1; });
    return byStatus;
  }, [leaves]);

  if (persona) {
    return (
      <Card>
        <div className="py-14 text-center">
          <BriefcaseBusiness size={44} className="mx-auto text-amber mb-4" />
          <p className="font-display text-xl font-bold text-ink">{persona.label} Workspace</p>
          <p className="text-[13px] text-slate-text/70 mt-1 mb-6">
            Your role has a dedicated workspace. Opening it now…
          </p>
          <Button variant="amber" onClick={() => (window.location.href = persona.landing)}>
            Open {persona.label} Workspace <ChevronRight size={15} />
          </Button>
        </div>
      </Card>
    );
  }

  const latestPay = payroll[0] || null;
  const firstName = (user?.name || staff?.name || "Staff Member").split(" ")[0];
  const displayName = staff?.name || user?.name || "Staff Member";
  const designation = staff?.designation || cap(user?.designation) || "Staff";

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="My Dashboard"
        title="Staff Overview"
        description={
          loading
            ? "Loading your workspace..."
            : "Your profile, leave applications and salary at a glance."
        }
        right={
          <Button variant="outline" onClick={() => (window.location.href = "/leave")}>
            <CalendarClock size={15} /> Apply for Leave
          </Button>
        }
      />

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden bg-ink">
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink-light to-ink opacity-90" />
        <div className="relative z-10 p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={displayName} size={54} />
            <div>
              <p className="text-amber font-semibold text-[12.5px]">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              <h2 className="font-display text-2xl sm:text-[26px] font-bold text-white mt-0.5">
                {greeting()}, {firstName} 👋
              </h2>
              <p className="text-white/60 text-[13.5px] mt-1">
                {designation} · {staff?.employeeId || cap(user?.designation) || "Team Member"}
              </p>
            </div>
          </div>
          {latestPay && (
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 text-center">
              <p className="font-display text-xl font-bold text-white">{fmtMoney(latestPay.netPay)}</p>
              <p className="text-white/50 text-[11px]">Latest take-home ({latestPay.month})</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={UserRound} label="Profile" value={staff ? "Linked" : "Not linked"} sub={staff?.status || "No staff record yet"} accent="info" />
        <StatCard icon={CalendarClock} label="My Leaves" value={`${leaveCounts.Approved}/${leaves.length}`} sub={`${leaveCounts.Pending} pending review`} accent="amber" />
        <StatCard icon={Banknote} label="Payslips" value={String(payroll.length)} sub={latestPay ? `${latestPay.month} ${latestPay.year}` : "No salary records"} accent="success" />
        <StatCard icon={BadgeCheck} label="Department" value={cap(staff?.department) || "—"} sub={staff?.role ? cap(staff.role) : "—"} accent="alert" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Profile */}
        <Card title="My Profile" action={<UserRound size={16} className="text-slate-text/50" />}>
          {staff ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              {[
                ["Employee ID", staff.employeeId],
                ["Designation", staff.designation],
                ["Department", cap(staff.department)],
                ["Joining Date", fmtDate(staff.joiningDate)],
                ["Contact", staff.contact || "—"],
                ["Email", staff.email || user?.email || "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[11px] text-slate-text/50 uppercase tracking-wide">{k}</p>
                  <p className="font-semibold text-ink mt-0.5 break-words">{v}</p>
                </div>
              ))}
              <div>
                <p className="text-[11px] text-slate-text/50 uppercase tracking-wide">Monthly Salary</p>
                <p className="font-semibold text-ink mt-0.5">{fmtMoney(staff.salary)}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-text/50 uppercase tracking-wide">Status</p>
                <Pill tone={statusTone(staff.status)}>{staff.status}</Pill>
              </div>
              {staff.classesAssigned?.length > 0 && (
                <div className="col-span-2">
                  <p className="text-[11px] text-slate-text/50 uppercase tracking-wide">Classes Assigned</p>
                  <p className="font-semibold text-ink mt-1">{staff.classesAssigned.map((c) => `Class ${c.class}-${c.section}`).join(" · ")}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-slate-text py-6 text-center">
              No staff record is linked to this account yet. Contact the school admin to link it.
            </p>
          )}
        </Card>

        {/* Leave applications */}
        <Card
          title="My Leave Applications"
          action={
            <a href="/leave" className="text-[12px] font-semibold text-info flex items-center gap-1">
              Manage <ChevronRight size={13} />
            </a>
          }
        >
          {leaves.length === 0 ? (
            <p className="text-[13px] text-slate-text py-6 text-center">No leave applications yet.</p>
          ) : (
            <div className="space-y-2.5">
              {leaves.slice(0, 5).map((l) => (
                <div key={l._id} className="flex items-center justify-between gap-3 py-2 border-b border-black/[0.06] last:border-0 last:pb-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-info/10 text-info flex items-center justify-center shrink-0">
                      <CalendarCheck size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-semibold text-ink">{l.leaveType} Leave</p>
                      <p className="text-[11px] text-slate-text/60 truncate">
                        {fmtDate(l.fromDate)} → {fmtDate(l.toDate)}
                      </p>
                    </div>
                  </div>
                  <Pill tone={statusTone(l.status)}>{l.status}</Pill>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Payroll history */}
      <Card title="Salary History" action={<BriefcaseBusiness size={16} className="text-slate-text/50" />}>
        {payroll.length === 0 ? (
          <p className="text-[13px] text-slate-text py-6 text-center">No salary records released yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                  <th className="px-5 py-2 font-semibold">Month</th>
                  <th className="px-5 py-2 font-semibold">Basic</th>
                  <th className="px-5 py-2 font-semibold">Allowances</th>
                  <th className="px-5 py-2 font-semibold">Deductions</th>
                  <th className="px-5 py-2 font-semibold">Net Pay</th>
                  <th className="px-5 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {payroll.slice(0, 8).map((p) => (
                  <tr key={p._id} className="border-t border-black/[0.06]">
                    <td className="px-5 py-3 font-semibold text-ink">{p.month} {p.year}</td>
                    <td className="px-5 py-3 text-slate-text">{fmtMoney(p.basic)}</td>
                    <td className="px-5 py-3 text-slate-text">{fmtMoney(p.allowances)}</td>
                    <td className="px-5 py-3 text-slate-text">{fmtMoney(p.deductions)}</td>
                    <td className="px-5 py-3 font-bold text-ink">{fmtMoney(p.netPay)}</td>
                    <td className="px-5 py-3"><Pill tone={statusTone(p.status)}>{p.status}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {payroll.length > 0 && (
          <p className="text-[12px] text-slate-text/60 mt-3 flex items-center gap-1.5">
            <FileText size={13} /> Payslips for the latest month are available in Payroll.
          </p>
        )}
      </Card>
    </div>
  );
}