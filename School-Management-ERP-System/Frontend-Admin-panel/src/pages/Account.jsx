import { useSelector, useDispatch } from "react-redux";
import { Mail, Building2, CalendarDays, BadgeCheck } from "lucide-react";
import { PageIntro, Card, Avatar, Pill, toast } from "../components/UI";
import { selectSchool, selectUser } from "../store/selectors";
import { setUser } from "../store/authSlice";
import { api } from "../lib/api";
import ProfilePhotoPicker from "../components/upload/ProfilePhotoPicker";
import { useState } from "react";

const roleLabel = (role, designation) => {
  if (role === "super_admin") return "Platform Owner";
  if (role === "school_admin" || role === "admin") return "School Admin";
  if (role === "class_teacher" || role === "teacher") return "Class Teacher";
  if (role === "staff") return designation ? `Staff · ${designation}` : "Staff";
  if (role === "student" || role === "parent") return "Student / Parent";
  return "User";
};

export default function Account() {
  const user = useSelector(selectUser);
  const school = useSelector(selectSchool);
  const dispatch = useDispatch();
  const [photoFile, setPhotoFile] = useState(null);
  const [photoSaving, setPhotoSaving] = useState(false);

  const handlePhotoChange = async (file) => {
    if (!file) return;
    setPhotoSaving(true);
    try {
      const { data } = await api.users.uploadPhoto(file);
      const { data: updated } = await api.users.updateMe({ avatar: data.url });
      dispatch(setUser(updated));
      toast("Profile photo updated");
    } catch (err) {
      toast(err.message || "Photo upload failed", "error");
    } finally {
      setPhotoSaving(false);
    }
  };

  const joined =
    user?.createdAt
      ? new Date(user.createdAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="My Account"
        title="My Profile"
        description="Your account and organization details."
      />

      <div className="grid lg:grid-cols-3 gap-5">
        <Card>
          <div className="flex flex-col items-center text-center py-4">
<ProfilePhotoPicker
                name={user?.name || "User"}
                file={photoFile}
                initialSrc={user?.avatar}
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
              <Pill tone="info">{roleLabel(user?.role, user?.designation)}</Pill>
              {user?.isActive === false && <Pill tone="alert">Inactive</Pill>}
            </div>
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-5">
          <Card title="Account details">
            <div className="divide-y divide-black/[0.05]">
              <div className="flex items-center gap-3 py-3">
                <BadgeCheck size={16} className="text-slate-text/50" />
                <span className="text-[12px] text-slate-text/70 w-28 shrink-0">
                  Name
                </span>
                <span className="text-[13px] font-medium text-ink">
                  {user?.name || "—"}
                </span>
              </div>
              <div className="flex items-center gap-3 py-3">
                <Mail size={16} className="text-slate-text/50" />
                <span className="text-[12px] text-slate-text/70 w-28 shrink-0">
                  Email
                </span>
                <span className="text-[13px] font-medium text-ink">
                  {user?.email || "—"}
                </span>
              </div>
              <div className="flex items-center gap-3 py-3">
                <BadgeCheck size={16} className="text-slate-text/50" />
                <span className="text-[12px] text-slate-text/70 w-28 shrink-0">
                  Role
                </span>
                <span className="text-[13px] font-medium text-ink capitalize">
                  {roleLabel(user?.role, user?.designation)}
                </span>
              </div>
              <div className="flex items-center gap-3 py-3">
                <CalendarDays size={16} className="text-slate-text/50" />
                <span className="text-[12px] text-slate-text/70 w-28 shrink-0">
                  Joined
                </span>
                <span className="text-[13px] font-medium text-ink">
                  {joined}
                </span>
              </div>
            </div>
          </Card>

          {school && (
            <Card title="Organization">
              <div className="divide-y divide-black/[0.05]">
                <div className="flex items-center gap-3 py-3">
                  <Building2 size={16} className="text-slate-text/50" />
                  <span className="text-[12px] text-slate-text/70 w-28 shrink-0">
                    School
                  </span>
                  <span className="text-[13px] font-medium text-ink">
                    {school.name || "—"}
                  </span>
                </div>
                <div className="flex items-center gap-3 py-3">
                  <BadgeCheck size={16} className="text-slate-text/50" />
                  <span className="text-[12px] text-slate-text/70 w-28 shrink-0">
                    Code
                  </span>
                  <span className="text-[13px] font-medium text-ink">
                    {school.code || "—"}
                  </span>
                </div>
                <div className="flex items-center gap-3 py-3">
                  <CalendarDays size={16} className="text-slate-text/50" />
                  <span className="text-[12px] text-slate-text/70 w-28 shrink-0">
                    Session
                  </span>
                  <span className="text-[13px] font-medium text-ink">
                    {school.session || "—"}
                  </span>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <p className="text-[12.5px] text-slate-text/70">
              Click the photo above to upload or change your profile picture.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
