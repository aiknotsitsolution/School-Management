import { useEffect, useState } from "react";
import {
  UserRoundCog,
  Mail,
  BadgeCheck,
  Building2,
  Users,
  Phone,
  CalendarDays,
  Wallet,
  HeartPulse,
  CalendarCheck,
  BookOpen,
} from "lucide-react";
import { PageIntro, Card, Avatar, Pill, StatCard, toast } from "../../components/UI";
import { api } from "../../lib/api";
import useStaffContext, { fmtDate } from "./useStaffContext";

export default function MyProfile() {
  const { user, persona } = useStaffContext();
  const [staff, setStaff] = useState(null);

  useEffect(() => {
    api.staff
      .list()
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        const mine = list.find((s) => user?.id && String(s.userId) === String(user.id));
        setStaff(mine || list[0] || null);
      })
      .catch((e) => toast(e.message, "error"));
  }, [user?.id]);

  const designation = persona?.name || user?.designation || staff?.designation;
  const roleLabel = staff?.designation
    ? staff.designation
    : designation
      ? String(designation).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Staff";

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Staff Workspace"
        title="My Profile"
        description="Your account and staff record details."
      />

      <div className="grid lg:grid-cols-3 gap-5">
        <Card>
          <div className="flex flex-col items-center text-center py-4">
            <Avatar name={user?.name || "Staff"} size={72} />
            <h3 className="font-display font-bold text-ink text-[18px] mt-3">
              {user?.name || "—"}
            </h3>
            <p className="text-[12.5px] text-slate-text/70 mt-0.5">
              {user?.email || "—"}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Pill tone="info">{roleLabel}</Pill>
              {user?.isActive === false && <Pill tone="alert">Inactive</Pill>}
            </div>
            {staff?.employeeId && (
              <p className="text-[12px] text-slate-text/70 mt-3">
                Employee ID · {staff.employeeId}
              </p>
            )}
          </div>
        </Card>

        <Card title="Account Details" className="lg:col-span-2">
          <div className="grid sm:grid-cols-2 gap-4">
            <Detail icon={UserRoundCog} label="Role" value={roleLabel} />
            <Detail icon={Mail} label="Email" value={user?.email || "—"} />
            <Detail icon={BadgeCheck} label="Account Status" value={user?.isActive === false ? "Inactive" : "Active"} />
            <Detail icon={Building2} label="School" value={user?.schoolId ? "Linked school" : "—"} />
            <Detail icon={CalendarDays} label="Member Since" value={fmtDate(user?.createdAt)} />
            <Detail icon={Users} label="Designation" value={roleLabel} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={CalendarCheck} label="My Attendance" value="Track" sub="Open the attendance tool" accent="success" />
        <StatCard icon={HeartPulse} label="My Leave" value="Apply" sub="Open the leave tool" accent="amber" />
        <StatCard icon={Wallet} label="Payroll" value="View" sub="Slips and status" accent="info" />
      </div>

      <Card title="Staff Record">
        {!staff ? (
          <p className="text-[13px] text-slate-text py-6 text-center">
            No staff record linked to this account yet. Contact your school
            admin if you believe this is wrong.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <Detail icon={Users} label="Designation" value={staff.designation || "—"} />
            <Detail icon={Building2} label="Department" value={staff.department || "—"} />
            <Detail icon={Building2} label="Employee ID" value={staff.employeeId || "—"} />
            <Detail icon={BookOpen} label="Role Type" value={staff.role || "—"} />
            <Detail icon={Phone} label="Contact" value={staff.contact || "—"} />
            <Detail icon={Mail} label="Staff Email" value={staff.email || "—"} />
            <Detail icon={CalendarDays} label="Joining Date" value={fmtDate(staff.joiningDate)} />
            <Detail icon={Users} label="Qualification" value={staff.qualification || "—"} />
            <Detail icon={Users} label="Subjects" value={Array.isArray(staff.subjects) && staff.subjects.length ? staff.subjects.join(", ") : "—"} />
            <Detail icon={CalendarCheck} label="Classes Assigned" value={Array.isArray(staff.classesAssigned) && staff.classesAssigned.length ? staff.classesAssigned.map((c) => `Class ${c.class}${c.section ? `-${c.section}` : ""}`).join(", ") : "—"} />
            <Detail icon={Building2} label="Address" value={staff.address || "—"} />
            <Detail icon={BadgeCheck} label="Status" value={staff.status || "—"} />
          </div>
        )}
      </Card>

      <Card>
        <p className="text-[13px] text-slate-text leading-relaxed">
          <strong className="text-ink">Note:</strong> To update your
          designation, contact details or related records, ask the school admin.
        </p>
      </Card>
    </div>
  );
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-paper flex items-center justify-center text-slate-text shrink-0">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-text/60 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-[13.5px] font-medium text-ink mt-0.5 break-words">
          {value}
        </p>
      </div>
    </div>
  );
}