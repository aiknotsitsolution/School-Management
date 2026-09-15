import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
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
  CreditCard,
  Printer,
} from "lucide-react";
import { PageIntro, Card, Avatar, Pill, toast } from "../../components/UI";
import { api } from "../../lib/api";
import { sessionLabel } from "../../lib/session";
import { setUser } from "../../store/authSlice";
import useStudentContext, { fmtDate } from "./useStudentContext";
import ProfilePhotoPicker from "../../components/upload/ProfilePhotoPicker";
import StudentIdCard, { printIdCard } from "../../components/idcard/StudentIdCard";

const TABS = [
  { key: "profile", label: "Profile", icon: Users },
  { key: "id-card", label: "ID Card", icon: CreditCard },
];

const MAX_DIMENSION = 800;
const QUALITY = 0.8;

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Image compression failed"));
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg", lastModified: Date.now() }));
          },
          "image/jpeg",
          QUALITY
        );
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Profile() {
  const { user, school } = useStudentContext();
  const dispatch = useDispatch();
  const [profile, setProfile] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  useEffect(() => {
    api.students
      .me()
      .then(({ data }) => setProfile(data || null))
      .catch((e) => toast(e.message, "error"));
  }, []);

  const handlePhotoChange = async (file) => {
    if (!file) return;
    setPhotoSaving(true);
    try {
      const compressed = await compressImage(file);
      const { data } = await api.users.uploadPhoto(compressed);
      const { data: updated } = await api.users.updateMe({ avatar: data.url });
      dispatch(setUser(updated));
      toast("Profile photo updated");
    } catch (err) {
      toast(err.message || "Photo upload failed", "error");
    } finally {
      setPhotoSaving(false);
    }
  };

  const admissionNo = profile?.admissionNo || user?.refId || "—";

  const studentForCard = {
    ...profile,
    id: profile?._id,
    admissionNo,
    name: profile?.name || user?.name || "—",
    class: profile?.class || "",
    section: profile?.section || "",
    rollNo: profile?.rollNo || "",
    gender: profile?.gender || "",
    dob: profile?.dob || "",
    bloodGroup: profile?.bloodGroup || "",
    parentName: profile?.parentName || "",
    parentContact: profile?.parentContact || "",
    house: profile?.house || "",
    avatar: user?.avatar || "",
    idCardNumber: profile?.idCardNumber || "",
    idCardIssuedAt: profile?.idCardIssuedAt || null,
  };

  return (
    <div className="space-y-6">
      <PageIntro eyebrow="Student Portal" title="My Profile" description="Your account, student record and ID card." />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-black/[0.06] pb-px">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold rounded-t-lg transition-colors -mb-px ${
              activeTab === tab.key
                ? "bg-white border border-black/[0.06] border-b-white text-ink"
                : "text-slate-text/60 hover:text-ink hover:bg-paper/50"
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "profile" && (
        <>
          <div className="grid lg:grid-cols-3 gap-5">
            <Card>
              <div className="flex flex-col items-center text-center py-4">
                <ProfilePhotoPicker
                  name={profile?.name || user?.name || "Student"}
                  file={photoFile}
                  initialSrc={user?.avatar}
                  disabled={photoSaving}
                  onFileChange={handlePhotoChange}
                />
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
              {school?.code || "—"} · Session {sessionLabel(school) || "—"}. Click the
              photo above to upload your profile picture. To update personal details,
              contact the school office.
            </p>
          </Card>
        </>
      )}

      {activeTab === "id-card" && (
        <Card bodyClassName="p-0">
          <div className="p-6">
            {profile?.idCardNumber ? (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="font-display font-semibold text-ink text-[15px]">Your Student ID Card</h3>
                    <p className="text-[12px] text-slate-text/60 mt-0.5">
                      Card No. <span className="font-mono font-semibold text-ink">{profile.idCardNumber}</span>
                      {profile.idCardIssuedAt && <span className="ml-2">· Issued {fmtDate(profile.idCardIssuedAt)}</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => printIdCard({ student: studentForCard, school })}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-black/[0.1] text-[12.5px] font-semibold text-ink hover:bg-paper transition-colors"
                  >
                    <Printer size={14} /> Print ID Card
                  </button>
                </div>
                <div className="flex justify-center">
                  <StudentIdCard student={studentForCard} school={school} />
                </div>
              </>
            ) : (
              <div className="py-16 text-center">
                <CreditCard size={40} className="mx-auto text-slate-text/25 mb-3" />
                <p className="text-[14px] font-medium text-ink">No ID Card Issued Yet</p>
                <p className="text-[12.5px] text-slate-text/60 mt-1 max-w-sm mx-auto">
                  Your ID card will appear here once the school admin issues it after completing your profile.
                </p>
              </div>
            )}
          </div>
        </Card>
      )}
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
