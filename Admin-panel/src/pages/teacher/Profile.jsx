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
  Printer,
  CheckCircle2,
  AlertCircle,
  Save,
} from "lucide-react";
import { PageIntro, Card, Avatar, Pill, Button, Input, Select, toast } from "../../components/UI";
import { api } from "../../lib/api";
import { sessionLabel } from "../../lib/session";
import { useTeacherContext, fmtDate } from "./useTeacherContext";
import TeacherIdCard, { printTeacherIdCard } from "../../components/idcard/TeacherIdCard";
import ProfilePhotoPicker from "../../components/upload/ProfilePhotoPicker";

// The same profile-completion rule the admin + self-service UIs share with the
// backend (single source of truth is server-side; this mirrors it for the gate).
const REQUIRED = ["dob", "gender", "contact", "address"];

export default function Profile() {
  const { user, school, assignment, hasClassTeacher } = useTeacherContext();
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ dob: "", gender: "", contact: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoSaving, setPhotoSaving] = useState(false);

  const handlePhotoChange = async (file) => {
    if (!file || !staff) return;
    setPhotoSaving(true);
    try {
      const { data } = await api.staff.uploadPhoto(file);
      await api.staff.completeProfile(staff.id || staff._id, { photoUrl: data.url });
      setStaff((prev) => ({ ...prev, photoUrl: data.url }));
      toast("Profile photo updated");
    } catch (err) {
      toast(err.message || "Photo upload failed", "error");
    } finally {
      setPhotoSaving(false);
    }
  };

  const loadStaff = () => {
    setLoading(true);
    api.staff
      .me()
      .then(({ data }) => {
        setStaff(data || null);
        setForm({
          dob: data?.dob ? String(data.dob).slice(0, 10) : "",
          gender: data?.gender || "",
          contact: data?.contact || "",
          address: data?.address || "",
        });
      })
      .catch((e) => {
        // Fall back to the previous self-scoped list lookup (legacy refId).
        setStaff(null);
        toast(e.message, "error");
      })
      .finally(() => setLoading(false));
  };

  useEffect(loadStaff, []);

  const roleLabel = hasClassTeacher ? "Class Teacher" : "Teacher";
  const profileComplete = staff?.profileStatus === "complete";

  const handleComplete = async (event) => {
    event.preventDefault();
    if (!staff) return;
    const missing = REQUIRED.filter((f) => !String(form[f] || "").trim());
    if (missing.length) {
      toast(`Complete profile first — missing: ${missing.join(", ")}`, "error");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.staff.completeProfile(staff.id || staff._id, {
        dob: form.dob || undefined,
        gender: form.gender || undefined,
        contact: form.contact.trim(),
        address: form.address.trim(),
      });
      setStaff(data);
      setForm({
        dob: data?.dob ? String(data.dob).slice(0, 10) : "",
        gender: data?.gender || "",
        contact: data?.contact || "",
        address: data?.address || "",
      });
      toast(data?.idCardNumber ? `Profile complete · ID card ${data.idCardNumber} issued` : "Profile complete");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

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
            <ProfilePhotoPicker
              name={user?.name || "Teacher"}
              file={photoFile}
              initialSrc={staff?.photoUrl}
              disabled={photoSaving}
              onFileChange={handlePhotoChange}
            />
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
        {loading ? (
          <p className="text-[13px] text-slate-text py-6 text-center">
            Loading staff record…
          </p>
        ) : !staff ? (
          <p className="text-[13px] text-slate-text py-6 text-center">
            No staff record linked to this account yet. Contact your school
            admin if you believe this is wrong.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <Detail icon={GraduationCap} label="Designation" value={staff.designation || "—"} />
            <Detail icon={Users} label="Department" value={staff.department || "—"} />
            <Detail icon={Users} label="Employee ID" value={staff.employeeId || "—"} />
            <Detail
              icon={CalendarDays}
              label="Joining Date"
              value={fmtDate(staff.joiningDate)}
            />
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
              label="Profile Status"
              value={
                profileComplete
                  ? `Complete${staff.profileCompletedAt ? ` · ${fmtDate(staff.profileCompletedAt)}` : ""}`
                  : "Incomplete"
              }
            />
          </div>
        )}
      </Card>

      {staff && !profileComplete && (
        <Card title="Complete Profile">
          <form className="grid sm:grid-cols-2 gap-4" onSubmit={handleComplete}>
            <div className="flex items-start gap-2.5 rounded-xl bg-amber/10 border border-amber/25 px-4 py-3 text-[13px] text-amber-dark sm:col-span-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p>
                Your profile is incomplete. Fill in your date of birth, gender,
                contact and address — once ready your staff ID card is issued
                automatically.
              </p>
            </div>
            <div>
              <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                Date of Birth *
              </label>
              <Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                Gender *
              </label>
              <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="w-full">
                <option value="">Select gender…</option>
                {["Male", "Female", "Other"].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                Contact *
              </label>
              <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="Phone number" />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                Address *
              </label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Residential address" />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button variant="amber" type="submit" disabled={saving}>
                <Save size={15} /> {saving ? "Saving…" : "Complete Profile"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {staff && profileComplete && (
        <Card
          title="Staff ID Card"
          action={
            staff.idCardNumber ? (
              <div className="flex items-center gap-2">
                <Pill tone="success">issued</Pill>
                <Button
                  variant="outline"
                  className="!py-2 !px-3 !text-[12px]"
                  onClick={() => printTeacherIdCard({ teacher: staff, school })}
                >
                  <Printer size={14} /> Print
                </Button>
              </div>
            ) : (
              <Pill tone="amber">not issued</Pill>
            )
          }
        >
          <div className="flex items-start gap-2.5 rounded-xl bg-success/10 border border-success/25 px-4 py-3 text-[13px] text-success">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Profile complete</p>
              <p className="text-[12.5px] mt-0.5">
                {staff.idCardNumber
                  ? `${staff.idCardNumber} · issued ${fmtDate(staff.idCardIssuedAt)}`
                  : "Your staff ID card will be issued by the school admin."}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-black/[0.06] p-4 bg-warm">
            <TeacherIdCard teacher={staff} school={school} />
          </div>
        </Card>
      )}

      <Card>
        <p className="text-[13px] text-slate-text leading-relaxed">
          <strong className="text-ink">School:</strong> {school?.name || "—"} ·{" "}
          {school?.code || "—"} · Session {sessionLabel(school) || "—"}. To update
          your designation or class assignment, ask the school admin.
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