import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Save, BadgeCheck, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import {
  Button,
  Card,
  Input,
  PageIntro,
  Pill,
  Select,
  toast,
} from "../components/UI";
import { useMasterOptions } from "../hooks/useMasterOptions";

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
const HOUSE_OPTIONS = ["Aravali", "Nilgiri", "Shivalik", "Vindhya"];
const BLOOD_OPTIONS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const MEDIUM_OPTIONS = ["English", "Hindi"];

const REQUIRED_FIELDS = [
  "class",
  "section",
  "dob",
  "gender",
  "address",
  "parentName",
  "parentContact",
  "motherName",
];

const FIELD_LABELS = {
  class: "Class",
  section: "Section",
  dob: "Date of birth",
  gender: "Gender",
  address: "Address",
  parentName: "Parent name",
  parentContact: "Parent contact",
  motherName: "Mother name",
};

const empty = (student) => ({
  name: student?.name || "",
  class: student?.class || "",
  section: student?.section || "",
  rollNo: student?.rollNo || "",
  dob: student?.dob ? String(student.dob).slice(0, 10) : "",
  gender: student?.gender || "",
  bloodGroup: student?.bloodGroup || "",
  medium: student?.medium || "English",
  house: student?.house || "",
  address: student?.address || "",
  parentName: student?.parentName || "",
  parentContact: student?.parentContact || "",
  parentEmail: student?.parentEmail || "",
  motherName: student?.motherName || "",
});

export default function StudentCompleteProfile() {
  const { options: CLASS_OPTIONS } = useMasterOptions("classes", CLASS_OPTIONS_FALLBACK);
  const { options: SECTION_OPTIONS } = useMasterOptions("sections", SECTION_OPTIONS_FALLBACK);
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [form, setForm] = useState(empty());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.students
      .get(id)
      .then(({ data }) => {
        setStudent(data);
        setForm(empty(data));
      })
      .catch((err) => toast(err.message, "error"))
      .finally(() => setLoading(false));
  }, [id]);

  const missing = REQUIRED_FIELDS.filter(
    (field) => !String(form[field] || "").trim(),
  );

  const save = async (complete) => {
    setBusy(true);
    try {
      const updated = await api.students.update(id, {
        name: form.name.trim(),
        class: form.class || undefined,
        section: form.section || undefined,
        rollNo: form.rollNo || undefined,
        dob: form.dob || undefined,
        gender: form.gender || undefined,
        bloodGroup: form.bloodGroup || undefined,
        medium: form.medium || undefined,
        house: form.house || undefined,
        address: form.address || undefined,
        parentName: form.parentName || undefined,
        parentContact: form.parentContact || undefined,
        parentEmail: form.parentEmail || undefined,
        motherName: form.motherName || undefined,
      });
      if (complete) {
        await api.students.completeProfile(id);
        toast("Profile marked complete — student can now log in");
      } else {
        toast("Profile saved");
      }
      setStudent(updated.data);
      setForm(empty(updated.data));
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl">
        <p className="text-[13px] text-slate-text/70 py-10 text-center">
          Loading profile…
        </p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="max-w-3xl">
        <p className="text-[13px] text-slate-text/70 py-10 text-center">
          Student profile not found.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-text/70 hover:text-ink mb-3"
      >
        <ArrowLeft size={14} /> Back
      </button>
      <PageIntro
        eyebrow="Admission Counsellor · Student profile"
        title={form.name || "Student profile"}
        description={`Admission ID ${student.admissionNo} · created ${new Date(
          student.createdAt,
        ).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
        right={
          student.profileStatus === "complete" ? (
            <Pill tone="success">
              <CheckCircle2 size={11} className="inline mr-1" /> complete
            </Pill>
          ) : (
            <Pill tone="amber">incomplete</Pill>
          )
        }
      />

      {student.userId && student.profileStatus === "complete" && (
        <div className="rounded-xl border border-success/30 bg-success/5 text-[12.5px] text-ink px-4 py-3 mb-5 flex items-center gap-2">
          <CheckCircle2 size={15} className="text-success" />
          This profile is complete and linked to a working login. Nothing to do here.
        </div>
      )}

      <Card title="Required details" className="mb-5">
        <div className="grid sm:grid-cols-2 gap-3.5">
          <label className="block sm:col-span-2">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">
              Full name
            </span>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Class</span>
            <Select value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })}>
              <option value="">Select…</option>
              {CLASS_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Section</span>
            <Select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}>
              <option value="">Select…</option>
              {SECTION_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Date of birth</span>
            <Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Gender</span>
            <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">Select…</option>
              {GENDER_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Address</span>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Residential address" />
          </label>
          <label className="block">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Parent / guardian name</span>
            <Input value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Parent contact</span>
            <Input value={form.parentContact} onChange={(e) => setForm({ ...form, parentContact: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Mother's name</span>
            <Input value={form.motherName} onChange={(e) => setForm({ ...form, motherName: e.target.value })} />
          </label>
        </div>
      </Card>

      <Card title="Other details" className="mb-5">
        <div className="grid sm:grid-cols-2 gap-3.5">
          <label className="block">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Roll number</span>
            <Input value={form.rollNo} onChange={(e) => setForm({ ...form, rollNo: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Parent email</span>
            <Input type="email" value={form.parentEmail} onChange={(e) => setForm({ ...form, parentEmail: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Blood group</span>
            <Select value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}>
              <option value="">Select…</option>
              {BLOOD_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Medium</span>
            <Select value={form.medium} onChange={(e) => setForm({ ...form, medium: e.target.value })}>
              {MEDIUM_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">House</span>
            <Select value={form.house} onChange={(e) => setForm({ ...form, house: e.target.value })}>
              <option value="">Select…</option>
              {HOUSE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </label>
        </div>
      </Card>

      {missing.length > 0 && (
        <div className="rounded-xl border border-alert/30 bg-alert/5 px-4 py-3 mb-5 flex items-start gap-2.5 text-[13px] text-ink">
          <AlertTriangle size={16} className="text-alert shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Missing required detail{missing.length === 1 ? "" : "s"}</p>
            <p className="text-slate-text/80 mt-0.5">
              {missing.map((field) => FIELD_LABELS[field]).join(", ")} must be filled before the
              profile can be marked complete.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" disabled={busy} onClick={() => save(false)}>
          <Save size={15} /> Save changes
        </Button>
        <Button
          variant="amber"
          disabled={busy || missing.length > 0}
          onClick={() => save(true)}
          title={missing.length ? "Fill all required details first" : undefined}
        >
          <BadgeCheck size={15} /> Mark profile complete
        </Button>
      </div>
    </div>
  );
}