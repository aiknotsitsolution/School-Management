import { useEffect, useMemo, useRef, useState } from "react";
import {
  Save,
  X,
  User,
  Users,
  Info,
  AlertCircle,
  UserCheck,
  ClipboardList,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Select,
  Input,
  Avatar,
  Pill,
  toast,
} from "../components/UI";
import SearchableSelect from "../components/SearchableSelect";
import ProfilePhotoPicker from "../components/upload/ProfilePhotoPicker";
import { SegmentedTabs } from "../components/Pagination";
import { api } from "../lib/api";
import { useMasterOptions } from "../hooks/useMasterOptions";
import OnboardedStudentsSection from "../components/onboard/OnboardedStudentsSection";

const CLASS_OPTIONS_FALLBACK = [
  "Nursery",
  "LKG",
  "UKG",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11-Sci",
  "11-Com",
  "12-Sci",
  "12-Com",
];

const SECTION_OPTIONS_FALLBACK = ["A", "B", "C"];
const GENDER_OPTIONS = ["Male", "Female", "Other"];
const HOUSE_OPTIONS = ["Red", "Blue", "Green", "Yellow"];
const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const MEDIUM_OPTIONS = ["English", "Hindi"];

const EMPTY_FORM = {
  name: "",
  admissionNo: "",
  rollNo: "",
  class: "8",
  section: "A",
  gender: "Male",
  dob: "",
  house: "Red",
  bloodGroup: "O+",
  medium: "English",
  fatherName: "",
  motherName: "",
  phone: "",
  email: "",
  address: "",
};

function formatClassLabel(c) {
  if (["Nursery", "LKG", "UKG"].includes(c)) return c;
  return `Class ${c}`;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Field({ label, required, hint, className = "", children }) {
  return (
    <div className={className}>
      <label className="block text-[12px] font-semibold text-slate-text/75 mb-1.5 tracking-wide">
        {label}
        {required && <span className="text-alert"> *</span>}
      </label>
      {children}
      {hint && (
        <p className="text-[11.5px] text-slate-text/60 mt-1.5 leading-snug">
          {hint}
        </p>
      )}
    </div>
  );
}

function SectionHeading({ icon: Icon, title, subtitle }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="w-9 h-9 rounded-xl bg-amber/15 text-amber-dark flex items-center justify-center shrink-0">
        <Icon size={17} />
      </span>
      <span>
        <span className="block leading-tight">{title}</span>
        {subtitle && (
          <span className="block text-[12px] font-normal text-slate-text/60 mt-0.5">
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}

function PreviewRow({ label, value, className = "" }) {
  return (
    <div className={className}>
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-text/50">
        {label}
      </p>
      <p className="text-[13px] font-semibold text-ink mt-0.5 break-words">
        {value || "—"}
      </p>
    </div>
  );
}

export default function AddStudent() {
  const { options: CLASS_OPTIONS } = useMasterOptions("classes", CLASS_OPTIONS_FALLBACK);
  const { options: SECTION_OPTIONS, rawItems: rawSections } = useMasterOptions("sections", SECTION_OPTIONS_FALLBACK);
  const [tab, setTab] = useState("students");
  const [addedCount, setAddedCount] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [onboardingStudent, setOnboardingStudent] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const formRef = useRef(null);
  const filteredSections = useMemo(() => {
    if (!form.class) return SECTION_OPTIONS;
    return [...new Set(rawSections.filter((s) => s.className === form.class).map((s) => s.name))];
  }, [form.class, SECTION_OPTIONS, rawSections]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview("");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [photoFile]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setPhotoFile(null);
    setError("");
    setOnboardingStudent(null);
  };

  const startOnboarding = (student) => {
    const normalizeDate = (iso) => {
      if (!iso) return "";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    setForm({
      name: student.name || "",
      admissionNo: student.admissionNo || "",
      rollNo: student.rollNo || "",
      class: student.class || "8",
      section: student.section || "A",
      gender: student.gender || "Male",
      dob: normalizeDate(student.dob),
      house: student.house || "Red",
      bloodGroup: student.bloodGroup || "O+",
      medium: student.medium || "English",
      fatherName: student.parentName || student.fatherName || "",
      motherName: student.motherName || "",
      phone: student.parentContact || "",
      email: student.parentEmail || "",
      address: student.address || "",
    });
    setPhotoFile(null);
    setPhotoPreview(student.photoUrl || "");
    setError("");
    setOnboardingStudent(student);
    setTab("form");
    window.setTimeout(
      () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setError("Student name is required.");
      return;
    }
    if (!form.admissionNo.trim()) {
      setError("Admission ID is required.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Parent/Guardian phone number is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      let photoUrl;
      if (photoFile) {
        const uploadResponse = await api.students.uploadPhoto(photoFile);
        photoUrl = uploadResponse.data.url;
      }

      const payload = {
        name: form.name.trim(),
        admissionNo: form.admissionNo.trim(),
        rollNo: form.rollNo.trim() || undefined,
        class: form.class,
        section: form.section,
        gender: form.gender,
        dob: form.dob || undefined,
        house: form.house,
        bloodGroup: form.bloodGroup,
        medium: form.medium,
        fatherName: form.fatherName.trim() || undefined,
        motherName: form.motherName.trim() || undefined,
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        ...(photoUrl ? { photoUrl } : {}),
      };

      if (onboardingStudent) {
        await api.students.update(onboardingStudent._id, {
          name: payload.name,
          admissionNo: payload.admissionNo,
          rollNo: payload.rollNo,
          class: payload.class,
          section: payload.section,
          gender: payload.gender,
          dob: payload.dob,
          house: payload.house,
          bloodGroup: payload.bloodGroup,
          medium: payload.medium,
          parentName: payload.fatherName,
          parentContact: payload.phone,
          parentEmail: payload.email,
          motherName: payload.motherName,
          address: payload.address,
          ...(photoUrl ? { photoUrl } : {}),
        });
        setReloadToken((t) => t + 1);
        toast("Onboarding completed — student profile saved");
      } else {
        await api.students.create(payload);
        toast("Student added successfully");
      }
      resetForm();
    } catch (err) {
      setError(err.message || "Failed to save student. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="Onboard Student"
        description="New students added via Users & Access are listed in the first tab — start onboarding to pre-fill their profile, or use the Onboarding Form to register a new student directly. Once the mandatory fields are complete, issue their ID card."
        descriptionClassName="max-w-none"
      />

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-alert/10 border border-alert/20 px-4 py-3 text-[13px] text-alert">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <SegmentedTabs
        tabs={[
          { id: "students", label: "Students Added via User & Access", icon: UserCheck, count: addedCount },
          { id: "form", label: "Onboarding Form", icon: ClipboardList },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "students" && (
        <OnboardedStudentsSection
          onOnboardNow={startOnboarding}
          reloadToken={reloadToken}
          onTotalChange={setAddedCount}
        />
      )}

      {tab === "form" && (
        <>
      {onboardingStudent && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-info/10 border border-info/25 px-4 py-3 text-[13px] text-info">
          <p className="flex items-center gap-2">
            <UserCheck size={16} className="shrink-0" />
            Onboarding <strong>{onboardingStudent.name || "this student"}</strong> — fields below are pre-filled from
            the Users &amp; Access profile. Complete the remaining details and save.
          </p>
          <Button variant="ghost" className="!px-2 !py-1 shrink-0" onClick={() => setOnboardingStudent(null)}>
            <X size={15} /> Cancel
          </Button>
        </div>
      )}

      <form
        ref={formRef}
        id="onboard-student-form"
        onSubmit={handleSubmit}
        className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start scroll-mt-24"
      >
        <div className="space-y-6 min-w-0">
        {/* Basic Details */}
        <Card
          title={<SectionHeading icon={User} title="Basic Details" subtitle="Student identity & academics" />}
          bodyClassName="p-5 sm:p-6"
        >
          <div className="flex flex-col items-center gap-3 pb-6 mb-6 border-b border-black/[0.06]">
            <ProfilePhotoPicker
              name={form.name || "New Student"}
              file={photoFile}
              disabled={saving}
              onError={setError}
              onFileChange={(file) => {
                setPhotoFile(file);
                setError("");
              }}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Full Name" required className="lg:col-span-2">
              <Input
                placeholder="e.g. Aarav Sharma"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                required
              />
            </Field>

            <Field label="Roll Number" hint="Optional — you can assign it later.">
              <Input
                placeholder="e.g. 15"
                value={form.rollNo}
                onChange={(e) => update("rollNo", e.target.value)}
              />
            </Field>

            <Field
              label="Admission ID"
              required
              hint="Login ID issued at admission."
            >
              <Input
                placeholder="e.g. STU-5A-001"
                value={form.admissionNo}
                onChange={(e) => update("admissionNo", e.target.value)}
                required
              />
            </Field>

            <Field label="Class">
              <SearchableSelect
                options={CLASS_OPTIONS}
                value={form.class}
                onChange={(val) => { update("class", val); update("section", ""); }}
                renderLabel={(c) => formatClassLabel(c)}
                placeholder="Select class"
              />
            </Field>

            <Field label="Section">
              <SearchableSelect
                options={filteredSections}
                value={form.section}
                onChange={(val) => update("section", val)}
                renderLabel={(s) => `Section ${s}`}
                placeholder="Select section"
              />
            </Field>

            <Field label="Gender">
              <Select
                value={form.gender}
                onChange={(e) => update("gender", e.target.value)}
              >
                {GENDER_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Date of Birth">
              <Input
                type="date"
                value={form.dob}
                onChange={(e) => update("dob", e.target.value)}
              />
            </Field>

            <Field label="House">
              <Input
                list="house-options"
                placeholder="e.g. Red, Blue, or custom"
                value={form.house}
                onChange={(e) => update("house", e.target.value)}
              />
              <datalist id="house-options">
                {HOUSE_OPTIONS.map((h) => (
                  <option key={h} value={h} />
                ))}
              </datalist>
            </Field>

            <Field label="Blood Group">
              <Select
                value={form.bloodGroup}
                onChange={(e) => update("bloodGroup", e.target.value)}
              >
                {BLOOD_GROUP_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Medium">
              <Select
                value={form.medium}
                onChange={(e) => update("medium", e.target.value)}
              >
                {MEDIUM_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        {/* Parent / Guardian Details */}
        <Card
          title={<SectionHeading icon={Users} title="Parent / Guardian Details" subtitle="Contact details of the student's parents or guardians" />}
          bodyClassName="p-5 sm:p-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Father's Name">
              <Input
                placeholder="e.g. Rajesh Sharma"
                value={form.fatherName}
                onChange={(e) => update("fatherName", e.target.value)}
              />
            </Field>

            <Field label="Mother's Name">
              <Input
                placeholder="e.g. Priya Sharma"
                value={form.motherName}
                onChange={(e) => update("motherName", e.target.value)}
              />
            </Field>

            <Field label="Phone Number" required>
              <Input
                placeholder="e.g. 9876543210"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                required
              />
            </Field>

            <Field label="Email">
              <Input
                type="email"
                placeholder="parent@email.com"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </Field>

            <Field label="Address" className="lg:col-span-2">
              <Input
                placeholder="House no., Street, Area, City..."
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </Field>
          </div>
        </Card>

        </div>

        {/* Live Student Card — right column */}
        <div className="space-y-6 xl:sticky xl:top-20">
          <div className="rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden bg-white">
            <div className="relative bg-gradient-to-br from-ink via-[#33333c] to-ink text-white p-5 overflow-hidden">
              <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-amber/25 blur-2xl" aria-hidden="true" />
              <div className="absolute -bottom-12 -left-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4CC38A] inline-block animate-pulse" />
                      Student ID · Live Preview
                    </p>
                    <p className="font-display text-[19px] font-bold mt-1.5 truncate">
                      {form.name || "New Student"}
                    </p>
                  </div>
                  <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-white/25 shrink-0">
                    <Avatar
                      src={photoPreview || undefined}
                      name={form.name || "New Student"}
                      size={56}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {form.class && (
                    <Pill tone="amber">
                      {formatClassLabel(form.class)} · Section {form.section || "—"}
                    </Pill>
                  )}
                  {form.rollNo && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/15 text-white">
                      #{form.rollNo}
                    </span>
                  )}
                  {form.admissionNo && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/15 text-white">
                      {form.admissionNo}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <PreviewRow label="Gender" value={form.gender} />
                <PreviewRow label="Date of Birth" value={formatDate(form.dob)} />
                <PreviewRow label="Blood Group" value={form.bloodGroup} />
                <PreviewRow label="Medium" value={form.medium} />
                <PreviewRow label="House" value={form.house} />
                <PreviewRow label="Father's Name" value={form.fatherName} />
                <PreviewRow label="Mother's Name" value={form.motherName} />
                <PreviewRow label="Parent Phone" value={form.phone} />
                <PreviewRow label="Parent Email" value={form.email} />
                <PreviewRow label="Address" value={form.address} className="col-span-2" />
              </div>

              <div className="mt-6 pt-5 border-t border-black/[0.06] flex flex-col gap-2.5">
                <Button
                  type="submit"
                  variant="amber"
                  disabled={saving}
                  className="w-full justify-center !py-3 !text-[13.5px]"
                >
                  {saving ? (
                    "Saving..."
                  ) : (
                    <>
                      <Save size={16} /> {onboardingStudent ? "Complete Onboarding" : "Add Student"}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="w-full justify-center"
                >
                  <X size={15} /> Clear Form
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>

      <div className="flex items-start gap-2.5 rounded-xl bg-ink/[0.04] border border-ink/10 px-4 py-3.5 text-[13px] text-slate-text">
        <Info size={16} className="text-amber-dark shrink-0 mt-0.5" />
        <p>
          <strong className="text-ink">Tip:</strong> Fields marked with{" "}
          <span className="text-alert font-semibold">*</span> are required.
          {onboardingStudent
            ? " These fields are pre-filled from the Users & Access profile. Saving completes the student onboarding."
            : " After adding, the student will appear in the attendance register for their class & section."}
        </p>
      </div>
        </>
      )}
    </div>
  );
}