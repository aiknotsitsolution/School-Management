import { useEffect, useState } from "react";
import {
  Save,
  X,
  Camera,
  Pencil,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Select,
  Input,
  Avatar,
  Pill,
} from "../components/UI";
import AvatarEditor from "../components/upload/AvatarEditor";
import { api } from "../lib/api";

const CLASS_OPTIONS = [
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

const SECTION_OPTIONS = ["A", "B", "C"];
const GENDER_OPTIONS = ["Male", "Female", "Other"];
const HOUSE_OPTIONS = ["Red", "Blue", "Green", "Yellow"];
const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

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
  fatherName: "",
  motherName: "",
  phone: "",
  email: "",
  address: "",
  photoUrl: "",
};

function formatClassLabel(c) {
  if (["Nursery", "LKG", "UKG"].includes(c)) return c;
  if (c.startsWith("11") || c.startsWith("12")) return `Class ${c}`;
  return `Class ${c}`;
}

export default function AddStudent() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [avatarOpen, setAvatarOpen] = useState(false);

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
    setSaved(false);
    setError("");
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setPhotoFile(null);
    setSaved(false);
    setError("");
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
    if (!form.rollNo.trim()) {
      setError("Roll number is required.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Parent/Guardian phone number is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      let photoUrl = form.photoUrl.trim() || undefined;
      if (photoFile) {
        const uploadResponse = await api.students.uploadPhoto(photoFile);
        photoUrl = uploadResponse.data.url;
      }

      await api.students.create({
        name: form.name.trim(),
        admissionNo: form.admissionNo.trim(),
        rollNo: form.rollNo.trim(),
        class: form.class,
        section: form.section,
        gender: form.gender,
        dob: form.dob || undefined,
        house: form.house,
        bloodGroup: form.bloodGroup,
        fatherName: form.fatherName.trim() || undefined,
        motherName: form.motherName.trim() || undefined,
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        photoUrl,
      });

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        resetForm();
      }, 2500);
    } catch (err) {
      setError(err.message || "Failed to add student. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="Add Student"
        description="Register a new student into the school system."
        right={
          <Button variant="outline" onClick={resetForm}>
            <X size={15} /> Reset Form
          </Button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-alert/10 border border-alert/20 px-4 py-3 text-[13px] text-alert">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 rounded-xl bg-success/10 border border-success/20 px-4 py-3 text-[13px] text-success">
          <CheckCircle2 size={16} />
          Student added successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Details */}
        <Card title="Basic Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 flex items-center gap-4">
              <div className="relative">
                <Avatar
                  src={photoPreview || form.photoUrl || undefined}
                  name={form.name || "New Student"}
                  size={72}
                />
                {photoPreview && (
                  <button
                    type="button"
                    onClick={() => setAvatarOpen(true)}
                    aria-label="Edit photo"
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber text-ink flex items-center justify-center shadow-md hover:bg-amber-dark transition-colors"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                  Photo (optional)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => setAvatarOpen(true)} disabled={saving}>
                    <Camera size={15} />
                    {photoPreview ? "Change photo" : "Add photo"}
                  </Button>
                  {photoPreview && (
                    <Button type="button" variant="ghost" onClick={() => setPhotoFile(null)} disabled={saving}>
                      Remove
                    </Button>
                  )}
                </div>
                <Input
                  placeholder="…or paste a photo URL"
                  value={form.photoUrl}
                  onChange={(e) => update("photoUrl", e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                Full Name <span className="text-alert">*</span>
              </label>
              <Input
                placeholder="e.g. Aarav Sharma"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                Roll Number <span className="text-alert">*</span>
              </label>
              <Input
                placeholder="e.g. 15"
                value={form.rollNo}
                onChange={(e) => update("rollNo", e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                Admission ID <span className="text-alert">*</span>
              </label>
              <Input
                placeholder="e.g. STU-5A-001"
                value={form.admissionNo}
                onChange={(e) => update("admissionNo", e.target.value)}
                required
              />
              <p className="text-[11.5px] text-slate-text/60 mt-1">
                This is the student's login ID — it must match the ticket issued at admission.
              </p>
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                Class
              </label>
              <Select
                value={form.class}
                onChange={(e) => update("class", e.target.value)}
              >
                {CLASS_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {formatClassLabel(c)}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                Section
              </label>
              <Select
                value={form.section}
                onChange={(e) => update("section", e.target.value)}
              >
                {SECTION_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    Section {s}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                Gender
              </label>
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
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                Date of Birth
              </label>
              <Input
                type="date"
                value={form.dob}
                onChange={(e) => update("dob", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                House
              </label>
              <Select
                value={form.house}
                onChange={(e) => update("house", e.target.value)}
              >
                {HOUSE_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h} House
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                Blood Group
              </label>
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
            </div>
          </div>
        </Card>

        {/* Parent / Guardian Details */}
        <Card title="Parent / Guardian Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                Father's Name
              </label>
              <Input
                placeholder="e.g. Rajesh Sharma"
                value={form.fatherName}
                onChange={(e) => update("fatherName", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                Mother's Name
              </label>
              <Input
                placeholder="e.g. Priya Sharma"
                value={form.motherName}
                onChange={(e) => update("motherName", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                Phone Number <span className="text-alert">*</span>
              </label>
              <Input
                placeholder="e.g. 9876543210"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                Email
              </label>
              <Input
                type="email"
                placeholder="parent@email.com"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                Address
              </label>
              <Input
                placeholder="House no., Street, Area, City..."
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Preview + Actions */}
        <Card title="Preview">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-paper/60 border border-black/5">
            <Avatar
              src={photoPreview || form.photoUrl || undefined}
              name={form.name || "New Student"}
              size={52}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[15px] font-semibold text-ink">
                  {form.name || "Student Name"}
                </p>
                {form.rollNo && <Pill tone="neutral">#{form.rollNo}</Pill>}
              </div>
              <p className="text-[13px] text-slate-text/70 mt-0.5">
                {formatClassLabel(form.class)} · Section {form.section} ·{" "}
                {form.gender} · {form.house} House
              </p>
              {(form.phone || form.email) && (
                <p className="text-[12px] text-slate-text/55 mt-1">
                  {form.phone}
                  {form.phone && form.email ? " · " : ""}
                  {form.email}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mt-5 pt-4 border-t border-black/6">
            <Button type="button" variant="outline" onClick={resetForm}>
              <X size={15} /> Clear
            </Button>
            <Button type="submit" variant="amber" disabled={saving}>
              {saving ? (
                "Saving..."
              ) : (
                <>
                  <Save size={15} /> Add Student
                </>
              )}
            </Button>
          </div>
        </Card>
      </form>

      <div className="rounded-xl bg-ink/5 border border-ink/10 px-4 py-3.5 text-[13px] text-slate-text">
        <strong className="text-ink">Tip:</strong> Fields marked with{" "}
        <span className="text-alert">*</span> are required. After adding, the
        student will appear in the attendance register for their class &
        section.
      </div>

      <AvatarEditor
        open={avatarOpen}
        title="Student photo"
        currentSrc={form.photoUrl || undefined}
        name={form.name || "New Student"}
        onClose={() => setAvatarOpen(false)}
        onSave={(file) => {
          setPhotoFile(file);
          setSaved(false);
          setError("");
        }}
      />
    </div>
  );
}
