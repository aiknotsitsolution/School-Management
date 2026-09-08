import { useEffect, useState } from "react";
import {
  GraduationCap,
  Building2,
  CalendarDays,
  Phone,
  Mail,
  Tag,
  Users,
  HeartPulse,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { PageIntro, Card, Avatar, Pill, toast } from "../../components/UI";
import { api } from "../../lib/api";
import useStudentContext, { fmtDate } from "./useStudentContext";

export default function Profile() {
  const { user, school } = useStudentContext();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    api.students
      .me()
      .then(({ data }) => setProfile(data || null))
      .catch((e) => toast(e.message, "error"));
  }, []);

  const admissionNo = profile?.admissionNo || user?.refId || "—";

  return (
    <div className="space-y-6">
      <PageIntro eyebrow="Student Portal" title="My Profile" description="Your account and student record." />

      <div className="grid lg:grid-cols-3 gap-5">
        <Card>
          <div className="flex flex-col items-center text-center py-4">
            <Avatar name={profile?.name || user?.name || "Student"} size={72} />
            <h3 className="font-display font-bold text-ink text-[18px] mt-3">
              {profile?.name || user?.name || "—"}
            </h3>
            <p className="text-[12.5px] text-slate-text/70 mt-0.5">{user?.email || "—"}</p>
            <div className="flex items-center gap-2 mt-3">
              <Pill tone="info">Student</Pill>
              {profile?.status === "Active" ? <Pill tone="success">Active</Pill> : <Pill tone="amber">{profile?.status || "—"}</Pill>}
            </div>
            <p className="text-[12px] text-slate-text/70 mt-3">
              Admission ID · {admissionNo}
            </p>
          </div>
        </Card>

        <Card title="Academic Details" className="lg:col-span-2">
          <div className="grid sm:grid-cols-2 gap-4">
            <Detail icon={GraduationCap} label="Class" value={profile?.class ? `Class ${profile.class}${profile.section ? `-${profile.section}` : ""}` : "—"} />
            <Detail icon={Tag} label="Roll Number" value={profile?.rollNo || "—"} />
            <Detail icon={Building2} label="House" value={profile?.house || "—"} />
            <Detail icon={CalendarDays} label="Admission Date" value={fmtDate(profile?.admissionDate)} />
            <Detail icon={ShieldCheck} label="Status" value={profile?.status || "—"} />
            <Detail icon={Users} label="Fee Category" value={profile?.feeCategory || "—"} />
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Personal Information">
          <div className="grid sm:grid-cols-2 gap-4">
            <Detail icon={CalendarDays} label="Date of Birth" value={fmtDate(profile?.dob)} />
            <Detail icon={Users} label="Gender" value={profile?.gender || "—"} />
            <Detail icon={HeartPulse} label="Blood Group" value={profile?.bloodGroup || "—"} />
            <Detail icon={MapPin} label="Address" value={profile?.address || "—"} />
          </div>
        </Card>

        <Card title="Parent / Guardian">
          <div className="grid sm:grid-cols-2 gap-4">
            <Detail icon={Users} label="Parent / Guardian" value={profile?.parentName || "—"} />
            <Detail icon={Phone} label="Contact" value={profile?.parentContact || "—"} />
            <Detail icon={Mail} label="Parent Email" value={profile?.parentEmail || "—"} />
            <Detail icon={Users} label="Mother's Name" value={profile?.motherName || "—"} />
          </div>
        </Card>
      </div>

      <Card>
        <p className="text-[13px] text-slate-text leading-relaxed">
          <strong className="text-ink">School:</strong> {school?.name || "—"} ·{" "}
          {school?.code || "—"} · Session {school?.session || "—"}. Your profile is
          read-only — to update personal details, contact the school office.
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
        <p className="text-[11px] font-semibold text-slate-text/60 uppercase tracking-wide">{label}</p>
        <p className="text-[13.5px] font-medium text-ink mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}