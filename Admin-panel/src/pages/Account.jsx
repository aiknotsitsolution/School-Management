import { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import {
  User as UserIcon,
  Mail,
  Phone,
  Building2,
  CalendarDays,
  BadgeCheck,
  Globe,
  MapPin,
  Pencil,
  Shield,
  ArrowRight,
  Zap,
  Camera,
} from "lucide-react";
import { PageIntro, Card, Pill, Input, toast } from "../components/UI";
import { SegmentedTabs } from "../components/Pagination";
import { selectUser, selectSchool } from "../store/selectors";
import { setUser, setSchool as setSchoolAction } from "../store/authSlice";
import { api } from "../lib/api";
import ProfilePhotoPicker from "../components/upload/ProfilePhotoPicker";

const roleLabel = (role, designation) => {
  if (role === "super_admin") return "Platform Owner";
  if (role === "school_admin" || role === "admin") return "School Admin";
  if (role === "teacher") return "Teacher";
  if (role === "staff") return designation ? `Staff · ${designation}` : "Staff";
  if (role === "student" || role === "parent") return "Student / Parent";
  return "User";
};

const fmtDate = (v) =>
  v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const TABS = [
  { id: "profile", label: "My Profile", icon: UserIcon },
  { id: "organization", label: "Organization Profile", icon: Building2 },
];

export default function Account() {
  const reduxUser = useSelector(selectUser);
  const dispatch = useDispatch();

  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.configTab || "profile");

  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileEdit, setProfileEdit] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", phone: "" });
  const [profileSaving, setProfileSaving] = useState(false);

  const [schoolData, setSchoolData] = useState(null);
  const [schoolLoading, setSchoolLoading] = useState(true);
  const [schoolEdit, setSchoolEdit] = useState(false);
  const [schoolForm, setSchoolForm] = useState({});
  const [schoolSaving, setSchoolSaving] = useState(false);

  const [currentSession, setCurrentSession] = useState(null);
  const [sessionForm, setSessionForm] = useState({ name: "", startDate: "", endDate: "" });
  const [sessionSaving, setSessionSaving] = useState(false);

  const [logoSaving, setLogoSaving] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);

  const reduxSchool = useSelector(selectSchool);

  const confirmAcademicConfig = (session) => {
    const base = reduxSchool?.school || reduxSchool || {};
    const refreshed = {
      ...base,
      academicConfigConfirmed: true,
      session: session.name,
      currentSession: { name: session.name, startDate: session.startDate, endDate: session.endDate },
    };
    dispatch(setSchoolAction(refreshed));
    localStorage.setItem("erp_school", JSON.stringify(refreshed));
  };

  useEffect(() => {
    setProfileLoading(true);
    api
      .me()
      .then(({ data }) => setProfileData(data))
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab !== "organization") return;
    setSchoolLoading(true);
    api.school
      .me()
      .then(({ data }) => setSchoolData(data))
      .catch(() => {})
      .finally(() => setSchoolLoading(false));
    api.sessions
      .current()
      .then(({ data }) => {
        setCurrentSession(data);
        setSessionForm({
          name: data?.name || "",
          startDate: data?.startDate ? String(data.startDate).slice(0, 10) : "",
          endDate: data?.endDate ? String(data.endDate).slice(0, 10) : "",
        });
      })
      .catch(() => {});
  }, [activeTab]);

  const handlePhotoChange = async (file) => {
    if (!file) return;
    setPhotoSaving(true);
    try {
      const { data } = await api.users.uploadPhoto(file);
      const { data: updated } = await api.users.updateMe({ avatar: data.url });
      dispatch(setUser(updated));
      setProfileData((d) => (d ? { ...d, user: { ...d.user, ...updated } } : d));
      toast("Profile photo updated");
    } catch (err) {
      toast(err.message || "Photo upload failed", "error");
    } finally {
      setPhotoSaving(false);
    }
  };

  const handleLogoChange = async (file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      toast("Please choose an image file", "error");
      return;
    }
    if (file.size > 1024 * 1024) {
      toast("Logo should be smaller than 1MB", "error");
      return;
    }
    setLogoSaving(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data } = await api.school.update({ logo: base64 });
      dispatch(setSchoolAction(data));
      localStorage.setItem("erp_school", JSON.stringify(data));
      setSchoolData((d) => (d ? { ...d, logo: data.logo } : d));
      toast("School logo updated");
    } catch (err) {
      toast(err.message || "Logo upload failed", "error");
    } finally {
      setLogoSaving(false);
    }
  };

  const handleBannerChange = async (file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      toast("Please choose an image file", "error");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast("Banner image should be smaller than 2MB", "error");
      return;
    }
    setLogoSaving(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data } = await api.school.update({ bannerImage: base64 });
      dispatch(setSchoolAction(data));
      localStorage.setItem("erp_school", JSON.stringify(data));
      setSchoolData((d) => (d ? { ...d, settings: { ...d.settings, bannerImage: data.settings?.bannerImage } } : d));
      toast("Dashboard banner updated");
    } catch (err) {
      toast(err.message || "Banner upload failed", "error");
    } finally {
      setLogoSaving(false);
    }
  };

  const openProfileEdit = () => {
    setProfileForm({
      name: profileData?.user?.name || "",
      phone: profileData?.user?.phone || "",
    });
    setProfileEdit(true);
  };

  const saveProfile = async () => {
    if (!profileForm.name?.trim()) {
      toast("Name is required", "error");
      return;
    }
    setProfileSaving(true);
    try {
      const { data: updated } = await api.users.updateMe({
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
      });
      dispatch(setUser(updated));
      setProfileData((d) => (d ? { ...d, user: { ...d.user, ...updated } } : d));
      setProfileEdit(false);
      toast("Profile updated successfully");
    } catch (err) {
      toast(err.message || "Update failed", "error");
    } finally {
      setProfileSaving(false);
    }
  };

  const openSchoolEdit = () => {
    setSchoolForm({
      name: schoolData?.name || "",
      shortName: schoolData?.shortName || "",
      email: schoolData?.email || "",
      phone: schoolData?.phone || "",
      address: schoolData?.address || "",
      city: schoolData?.city || "",
      state: schoolData?.state || "",
      pincode: schoolData?.pincode || "",
      website: schoolData?.website || "",
    });
    setSchoolEdit(true);
  };

  const saveSchool = async () => {
    if (!schoolForm.name?.trim()) {
      toast("School name is required", "error");
      return;
    }
    setSchoolSaving(true);
    try {
      const { data: updated } = await api.school.update({
        name: schoolForm.name.trim(),
        shortName: schoolForm.shortName.trim(),
        email: schoolForm.email.trim(),
        phone: schoolForm.phone.trim(),
        address: schoolForm.address.trim(),
        city: schoolForm.city.trim(),
        state: schoolForm.state.trim(),
        pincode: schoolForm.pincode.trim(),
        website: schoolForm.website.trim(),
      });
      setSchoolData(updated);
      setSchoolEdit(false);
      toast("Organization profile updated successfully");
    } catch (err) {
      toast(err.message || "Update failed", "error");
    } finally {
      setSchoolSaving(false);
    }
  };

  const saveSessionConfig = async () => {
    if (!sessionForm.startDate || !sessionForm.endDate) {
      toast("Session start and end dates are required", "error");
      return;
    }
    if (new Date(sessionForm.endDate) <= new Date(sessionForm.startDate)) {
      toast("Session end date must be after the start date", "error");
      return;
    }
    if (
      currentSession?._id &&
      sessionForm.name &&
      sessionForm.name.trim() !== currentSession.name &&
      currentSession.status === "active"
    ) {
      toast("The live session's name is locked — adjust the dates instead", "error");
      return;
    }
    setSessionSaving(true);
    try {
      if (currentSession?._id) {
        const { data } = await api.sessions.update(currentSession._id, {
          name: sessionForm.name.trim() || undefined,
          startDate: sessionForm.startDate,
          endDate: sessionForm.endDate,
        });
        setCurrentSession(data);
        setSessionForm({
          name: data.name || "",
          startDate: String(data.startDate).slice(0, 10),
          endDate: String(data.endDate).slice(0, 10),
        });
        toast("Academic session updated");
        confirmAcademicConfig(data);
      } else {
        const { data } = await api.sessions.create({
          name: sessionForm.name.trim() || undefined,
          startDate: sessionForm.startDate,
          endDate: sessionForm.endDate,
        });
        setCurrentSession(data);
        setSessionForm({
          name: data.name || "",
          startDate: String(data.startDate).slice(0, 10),
          endDate: String(data.endDate).slice(0, 10),
        });
        toast("Academic session created");
        confirmAcademicConfig(data);
      }
    } catch (err) {
      toast(err.message || "Could not save academic session", "error");
    } finally {
      setSessionSaving(false);
    }
  };

  const user = profileData?.user || reduxUser;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="My Account"
        title="My Profile"
        description="Manage your account and organization details."
      />

      <SegmentedTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === "profile" && (
        <ProfileTab
          user={user}
          loading={profileLoading}
          editMode={profileEdit}
          form={profileForm}
          setForm={setProfileForm}
          onEdit={openProfileEdit}
          onSave={saveProfile}
          onCancel={() => setProfileEdit(false)}
          saving={profileSaving}
          onPhotoChange={handlePhotoChange}
        />
      )}

      {activeTab === "organization" && (
        <OrganizationTab
          school={schoolData}
          loading={schoolLoading}
          editMode={schoolEdit}
          form={schoolForm}
          setForm={setSchoolForm}
          onEdit={openSchoolEdit}
          onSave={saveSchool}
          onCancel={() => setSchoolEdit(false)}
          saving={schoolSaving}
          onLogoChange={handleLogoChange}
          logoSaving={logoSaving}
          onBannerChange={handleBannerChange}
          currentSession={currentSession}
          sessionForm={sessionForm}
          setSessionForm={setSessionForm}
          onSaveSession={saveSessionConfig}
          sessionSaving={sessionSaving}
        />
      )}
    </div>
  );
}

function ProfileTab({
  user,
  loading,
  editMode,
  form,
  setForm,
  onEdit,
  onSave,
  onCancel,
  saving,
  onPhotoChange,
}) {
  if (loading) {
    return (
      <Card>
        <p className="text-[13px] text-slate-text/70">Loading profile…</p>
      </Card>
    );
  }

  const joined = fmtDate(user?.createdAt);

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <Card>
        <div className="flex flex-col items-center text-center py-4">
          <ProfilePhotoPicker
            name={user?.name || "User"}
            initialSrc={user?.avatar}
            onFileChange={onPhotoChange}
          />
          <h3 className="font-display font-bold text-ink text-[18px] mt-3">{user?.name || "—"}</h3>
          <p className="text-[12.5px] text-slate-text/70 mt-0.5">{user?.email || "—"}</p>
          <div className="flex items-center gap-2 mt-3">
            <Pill tone="info">{roleLabel(user?.role, user?.designation)}</Pill>
            {user?.isActive === false && <Pill tone="alert">Inactive</Pill>}
          </div>
        </div>
      </Card>

      <div className="lg:col-span-2 space-y-5">
        <Card
          title="Account details"
          action={
            !editMode ? (
              <button
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-info hover:text-ink transition-colors"
              >
                <Pencil size={13} /> Edit
              </button>
            ) : undefined
          }
        >
          <div className="divide-y divide-black/[0.05]">
            <div className="flex items-center gap-3 py-3">
              <UserIcon size={16} className="text-slate-text/50" />
              <span className="text-[12px] text-slate-text/70 w-32 shrink-0">Name</span>
              {editMode ? (
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="flex-1"
                />
              ) : (
                <span className="text-[13px] font-medium text-ink">{user?.name || "—"}</span>
              )}
            </div>
            <div className="flex items-center gap-3 py-3">
              <Mail size={16} className="text-slate-text/50" />
              <span className="text-[12px] text-slate-text/70 w-32 shrink-0">Email</span>
              <span className="text-[13px] font-medium text-ink">{user?.email || "—"}</span>
              <span className="text-[10px] text-slate-text/50 bg-paper px-1.5 py-0.5 rounded">Read only</span>
            </div>
            <div className="flex items-center gap-3 py-3">
              <Phone size={16} className="text-slate-text/50" />
              <span className="text-[12px] text-slate-text/70 w-32 shrink-0">Phone</span>
              {editMode ? (
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="Phone number"
                  className="flex-1"
                />
              ) : (
                <span className="text-[13px] font-medium text-ink">{user?.phone || "—"}</span>
              )}
            </div>
            <div className="flex items-center gap-3 py-3">
              <Shield size={16} className="text-slate-text/50" />
              <span className="text-[12px] text-slate-text/70 w-32 shrink-0">Role</span>
              <span className="text-[13px] font-medium text-ink">{roleLabel(user?.role, user?.designation)}</span>
              <span className="text-[10px] text-slate-text/50 bg-paper px-1.5 py-0.5 rounded">Read only</span>
            </div>
            <div className="flex items-center gap-3 py-3">
              <CalendarDays size={16} className="text-slate-text/50" />
              <span className="text-[12px] text-slate-text/70 w-32 shrink-0">Joined</span>
              <span className="text-[13px] font-medium text-ink">{joined}</span>
            </div>
          </div>

          {editMode && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-black/[0.06]">
              <button
                onClick={onCancel}
                disabled={saving}
                className="px-4 py-2 text-[13px] font-semibold text-slate-text hover:text-ink rounded-lg border border-black/[0.08] hover:bg-paper transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className="px-4 py-2 text-[13px] font-semibold text-amber bg-ink rounded-lg hover:bg-ink/90 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}
        </Card>

        <Card>
          <p className="text-[12.5px] text-slate-text/70">
            Click the photo above to upload or change your profile picture.
          </p>
        </Card>
      </div>
    </div>
  );
}

const ORG_SECTIONS = [
  {
    title: "Basic Information",
    fields: [
      { key: "name", label: "School Name", required: true },
      { key: "code", label: "School Code", readOnly: true },
      { key: "shortName", label: "Short Name" },
      { key: "session", label: "Session", readOnly: true },
      { key: "plan", label: "Plan", readOnly: true },
    ],
  },
  {
    title: "Contact Information",
    fields: [
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone" },
      { key: "website", label: "Website" },
    ],
  },
  {
    title: "Address",
    fields: [
      { key: "address", label: "Address" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "pincode", label: "Pincode" },
    ],
  },
];

const orgFieldIcons = {
  name: Building2,
  code: BadgeCheck,
  shortName: Building2,
  session: CalendarDays,
  plan: Shield,
  email: Mail,
  phone: Phone,
  website: Globe,
  address: MapPin,
  city: MapPin,
  state: MapPin,
  pincode: MapPin,
};

const orgFieldRender = {
  plan: (v) => <Pill tone="info">{v}</Pill>,
};

function OrganizationTab({ school, loading, editMode, form, setForm, onEdit, onSave, onCancel, saving, onLogoChange, logoSaving, onBannerChange, currentSession, sessionForm, setSessionForm, onSaveSession, sessionSaving }) {
  const logoInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  if (loading) {
    return (
      <Card>
        <p className="text-[13px] text-slate-text/70">Loading organization profile…</p>
      </Card>
    );
  }

  if (!school) {
    return (
      <Card>
        <p className="text-[13px] text-slate-text/70">No organization data available.</p>
      </Card>
    );
  }

  const schoolLogo = school?.logo || "";
  const schoolInitial = (school?.shortName || school?.name || "S").slice(0, 1).toUpperCase();

  const handleLogoPick = (e) => {
    const file = e.target.files?.[0];
    if (file) onLogoChange(file);
    e.target.value = "";
  };

  const handleBannerPick = (e) => {
    const file = e.target.files?.[0];
    if (file) onBannerChange(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center gap-5">
          <div className="relative group">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-ink flex items-center justify-center shrink-0">
              {schoolLogo ? (
                <img src={schoolLogo} alt="School logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-amber text-3xl font-display font-bold">{schoolInitial}</span>
              )}
            </div>
            <label className="absolute inset-0 rounded-full bg-ink/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer">
              <Camera size={18} className="text-white" />
              <span className="text-[10px] font-semibold text-white">Change</span>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={handleLogoPick}
              />
            </label>
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-ink">Organization Profile</h3>
            <p className="text-[12.5px] text-slate-text/60 mt-0.5">
              School details captured during onboarding.
            </p>
            <p className="text-[11px] text-slate-text/50 mt-1">
              {logoSaving ? "Uploading logo…" : "Hover over the logo to change it."}
            </p>
          </div>
          {!editMode && (
            <button
              onClick={onEdit}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold text-info hover:text-ink border border-info/20 hover:border-info/40 rounded-lg transition-colors"
            >
              <Pencil size={13} /> Edit
            </button>
          )}
        </div>
      </Card>

      <Card title="Dashboard Banner">
        <div className="relative rounded-xl overflow-hidden bg-ink group cursor-pointer" style={{ height: 140 }}>
          <img
            src={school?.settings?.bannerImage || "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1600&h=400&q=80"}
            alt="Dashboard banner"
            className="absolute inset-0 w-full h-full object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-ink/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white">
            <Camera size={20} />
            <span className="text-[12px] font-semibold">Change Banner Image</span>
          </div>
          <label className="absolute inset-0 cursor-pointer">
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={handleBannerPick}
            />
          </label>
        </div>
        <p className="text-[11px] text-slate-text/50 mt-2">
          This image appears as the background on the Admin Dashboard.
        </p>
      </Card>

      <Card title="Academic Configuration">
        <p className="text-[12.5px] text-slate-text/60 mb-4">
          Defines the school year calendar. The session label is derived from the
          dates (e.g. 01 Apr 2026 – 31 Mar 2027 → "2026-27"). Once a session is
          live its name is locked because fees, assignments and marks reference
          it — you can still adjust the dates.
        </p>
        {currentSession ? (
          <div className="space-y-3.5">
            <div>
              <label className="block text-[12px] font-medium text-slate-text/70 mb-1">Session name</label>
              <Input
                value={sessionForm.name}
                onChange={(e) => setSessionForm((f) => ({ ...f, name: e.target.value }))}
                disabled={currentSession.status === "active"}
                placeholder="Derived from dates"
                className="w-full sm:w-1/2"
              />
              <p className="text-[11px] text-slate-text/50 mt-1">
                {currentSession.status === "active"
                  ? "Locked — derived from start/end dates once live. Use Academic Sessions to roll over to the next year."
                  : "Leave blank to derive from the dates."}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[12px] font-medium text-slate-text/70 mb-1">Start date *</label>
                <Input
                  type="date"
                  value={sessionForm.startDate}
                  onChange={(e) => setSessionForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-slate-text/70 mb-1">End date *</label>
                <Input
                  type="date"
                  value={sessionForm.endDate}
                  onChange={(e) => setSessionForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <button
              onClick={onSaveSession}
              disabled={sessionSaving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold text-amber bg-ink rounded-lg hover:bg-ink/90 transition-colors disabled:opacity-50"
            >
              {sessionSaving ? "Saving…" : "Save Session"}
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            <p className="text-[12.5px] text-slate-text/70">
              No academic session defined yet. Set the school year dates to create the first session — it becomes the current session automatically.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[12px] font-medium text-slate-text/70 mb-1">Start date *</label>
                <Input
                  type="date"
                  value={sessionForm.startDate}
                  onChange={(e) => setSessionForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-slate-text/70 mb-1">End date *</label>
                <Input
                  type="date"
                  value={sessionForm.endDate}
                  onChange={(e) => setSessionForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <button
              onClick={onSaveSession}
              disabled={sessionSaving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold text-amber bg-ink rounded-lg hover:bg-ink/90 transition-colors disabled:opacity-50"
            >
              {sessionSaving ? "Saving…" : "Create Session"}
            </button>
          </div>
        )}
      </Card>

      {ORG_SECTIONS.map((section) => (
        <Card key={section.title} title={section.title}>
          <div className="divide-y divide-black/[0.05]">
            {section.fields.map(({ key, label, type, required, readOnly }) => {
              const Icon = orgFieldIcons[key] || BadgeCheck;
              const value = school[key];

              return (
                <div key={key} className="flex items-center gap-3 py-3">
                  <Icon size={16} className="text-slate-text/50 shrink-0" />
                  <span className="text-[12px] text-slate-text/70 w-32 shrink-0">{label}</span>
                  {editMode && !readOnly ? (
                    <Input
                      type={type || "text"}
                      value={form[key] || ""}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={label}
                      className="flex-1"
                    />
                  ) : orgFieldRender[key] ? (
                    <span className="text-[13px] font-medium text-ink">{value ? orgFieldRender[key](value) : "—"}</span>
                  ) : (
                    <span className="text-[13px] font-medium text-ink break-words">{value || "—"}</span>
                  )}
                  {key === "plan" && !editMode && (
                    <Link
                      to="/subscription"
                      className={`inline-flex items-center gap-1.5 ml-auto text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
                        value === "premium"
                          ? "text-slate-text/60 bg-paper hover:bg-paper/80"
                          : "text-amber bg-ink hover:bg-ink/90"
                      }`}
                    >
                      {value === "trial" ? (
                        <><Zap size={13} /> Upgrade Now</>
                      ) : value === "premium" ? (
                        <><ArrowRight size={13} /> View Plans</>
                      ) : (
                        <><ArrowRight size={13} /> Upgrade</>
                      )}
                    </Link>
                  )}
                  {readOnly && key !== "plan" && (
                    <span className="text-[10px] text-slate-text/50 bg-paper px-1.5 py-0.5 rounded shrink-0">
                      Read only
                    </span>
                  )}
                  {required && editMode && !readOnly && (
                    <span className="text-[10px] text-alert">*</span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {editMode && (
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-[13px] font-semibold text-slate-text hover:text-ink rounded-lg border border-black/[0.08] hover:bg-paper transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 text-[13px] font-semibold text-amber bg-ink rounded-lg hover:bg-ink/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
