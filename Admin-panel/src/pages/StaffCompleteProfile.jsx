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

const GENDER_OPTIONS = ["Male", "Female", "Other"];

const REQUIRED_FIELDS = ["dob", "gender", "contact", "address"];

const FIELD_LABELS = {
  dob: "Date of birth",
  gender: "Gender",
  contact: "Contact number",
  address: "Address",
};

const empty = (staff) => ({
  dob: staff?.dob ? String(staff.dob).slice(0, 10) : "",
  gender: staff?.gender || "",
  contact: staff?.contact || "",
  address: staff?.address || "",
});

export default function StaffCompleteProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [staff, setStaff] = useState(null);
  const [form, setForm] = useState(empty());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.staff
      .get(id)
      .then(({ data }) => {
        setStaff(data);
        setForm(empty(data));
      })
      .catch((err) => toast(err.message, "error"))
      .finally(() => setLoading(false));
  }, [id]);

  const missing = REQUIRED_FIELDS.filter(
    (field) => !String(form[field] || "").trim(),
  );

  const save = async (complete) => {
    if (complete && missing.length > 0) {
      const labels = missing.map((field) => FIELD_LABELS[field]);
      toast(`Please fill all required fields: ${labels.join(", ")}`, "error");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.staff.completeProfile(id, {
        dob: form.dob || undefined,
        gender: form.gender || undefined,
        contact: form.contact.trim(),
        address: form.address.trim(),
      });
      if (complete) {
        toast(data?.idCardNumber ? `Profile complete · ID card ${data.idCardNumber} issued` : "Profile complete");
      } else {
        toast("Profile saved");
      }
      setStaff(data);
      setForm(empty(data));
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

  if (!staff) {
    return (
      <div className="max-w-3xl">
        <p className="text-[13px] text-slate-text/70 py-10 text-center">
          Staff profile not found.
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
        eyebrow="Staff profile"
        title={staff.name || "Staff profile"}
        description={`${staff.employeeId ? `Employee ID ${staff.employeeId}` : ""}${staff.designation ? ` · ${staff.designation}` : ""}${staff.createdAt ? ` · created ${new Date(staff.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}`}
        right={
          staff.profileStatus === "complete" ? (
            <Pill tone="success">
              <CheckCircle2 size={11} className="inline mr-1" /> complete
            </Pill>
          ) : (
            <Pill tone="amber">incomplete</Pill>
          )
        }
      />

      {staff.profileStatus === "complete" && (
        <div className="rounded-xl border border-success/30 bg-success/5 text-[12.5px] text-ink px-4 py-3 mb-5 flex items-center gap-2">
          <CheckCircle2 size={15} className="text-success" />
          This profile is complete. ID card {staff.idCardNumber ? `${staff.idCardNumber} is issued.` : "will be issued on completion."}
        </div>
      )}

      <Card title="Required details" className="mb-5">
        <div className="grid sm:grid-cols-2 gap-3.5">
          <label className="block">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Date of birth *</span>
            <Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Gender *</span>
            <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">Select…</option>
              {GENDER_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Contact *</span>
            <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="Phone number" />
          </label>
          <label className="block">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Address *</span>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Residential address" />
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
