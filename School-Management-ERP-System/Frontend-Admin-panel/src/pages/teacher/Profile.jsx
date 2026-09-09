import { useEffect, useState } from "react";
import {
  UserRoundCog,
  Mail,
  GraduationCap,
  BadgeCheck,
  Building2,
  BookOpen,
  Users,
  Phone,
  CalendarDays,
} from "lucide-react";
import { PageIntro, Card, Avatar, Pill, toast } from "../../components/UI";
import { api } from "../../lib/api";
import { useTeacherContext, fmtDate } from "./useTeacherContext";

export default function Profile() {
  const { user, school, assignment, hasClassTeacher } = useTeacherContext();
  const [staff, setStaff] = useState(null);

  useEffect(() => {
    api.staff
      .list()
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        setStaff(list[0] || null);
      })
      .catch((e) => toast(e.message, "error"));
  }, []);

  const roleLabel = hasClassTeacher ? "Class Teacher" : "Teacher";

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="My Teaching"
        title="My Profile"
        description="Your account and staff details."
      />

      <div className="grid lg:grid-cols-3 gap-5">
        <Card>
          <div className="flex flex-col items-center text-center py-4">
            <Avatar name={user?.name || "Teacher"} size={72} />
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
            <p className="text-[12px] text-slate-text/70 mt-3">
              {assignment}
            </p>
          </div>
        </Card>

        <Card title="Account Details" className="lg:col-span-2">
          <div className="grid sm:grid-cols-2 gap-4">
            <Detail icon={UserRoundCog} label="Role" value={roleLabel} />
            <Detail icon={Mail} label="Email" value={user?.email || "—"} />
            <Detail
              icon={GraduationCap}
              label="Class"
              value={user?.class ? `Class ${user.class}` : "—"}
            />
            <Detail
              icon={Building2}
              label="Section"
              value={user?.section ? `Section ${user.section}` : "—"}
            />
            <Detail icon={BadgeCheck} label="Account Status" value={user?.isActive === false ? "Inactive" : "Active"} />
            <Detail
              icon={CalendarDays}
              label="Member Since"
              value={fmtDate(user?.createdAt)}
            />
          </div>
        </Card>
      </div>

      <Card title="Staff Record">
        {!staff ? (
          <p className="text-[13px] text-slate-text py-6 text-center">
            No staff record linked to this account yet. Contact your school
            admin if you believe this is wrong.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <Detail icon={GraduationCap} label="Designation" value={staff.designation || "—"} />
            <Detail icon={Users} label="Department" value={staff.department || "—"} />
            <Detail
              icon={BookOpen}
              label="Subjects"
              value={Array.isArray(staff.subjects) && staff.subjects.length ? staff.subjects.join(", ") : "—"}
            />
            <Detail
              icon={Users}
              label="Classes Assigned"
              value={
                Array.isArray(staff.classesAssigned) && staff.classesAssigned.length
                  ? staff.classesAssigned
                      .map((c) => `Class ${c.class}${c.section ? `-${c.section}` : ""}`)
                      .join(", ")
                  : "—"
              }
            />
            <Detail icon={Phone} label="Contact" value={staff.contact || "—"} />
            <Detail
              icon={CalendarDays}
              label="Joining Date"
              value={fmtDate(staff.joiningDate)}
            />
            <Detail icon={Mail} label="Staff Email" value={staff.email || "—"} />
            <Detail icon={Building2} label="Employee ID" value={staff.employeeId || "—"} />
          </div>
        )}
      </Card>

      <Card>
        <p className="text-[13px] text-slate-text leading-relaxed">
          <strong className="text-ink">School:</strong> {school?.name || "—"} ·{" "}
          {school?.code || "—"} · Session {school?.session || "—"}. To update
          your class assignment, designation or contact details, ask the school
          admin.
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