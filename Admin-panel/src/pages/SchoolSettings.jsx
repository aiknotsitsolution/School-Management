import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Building2, Save } from "lucide-react";
import { PageIntro, Card, Button, Input, Pill, toast } from "../components/UI";
import { selectSchool, selectUser } from "../store/selectors";
import { setSchool as setSchoolAction } from "../store/authSlice";
import { hasPermission } from "../lib/permissions";
import { sessionLabel } from "../lib/session";
import { api } from "../lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;
const PINCODE_RE = /^[1-9][0-9]{5}$/;

const roleLabel = (role, designation) => {
  if (role === "super_admin") return "Platform Owner";
  if (role === "school_admin" || role === "admin") return "School Admin";
  if (role === "teacher") return "Teacher";
  if (role === "staff") return designation ? `Staff · ${designation}` : "Staff";
  if (role === "student" || role === "parent") return "Student / Parent";
  return "User";
};

export default function SchoolSettings() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const school = useSelector(selectSchool);
  const canManageSchool = hasPermission(user, "school:settings");

  const [form, setForm] = useState({
    name: school?.name || "",
    shortName: school?.shortName || "",
    email: school?.email || "",
    phone: school?.phone || "",
    address: school?.address || "",
    city: school?.city || "",
    state: school?.state || "",
    pincode: school?.pincode || "",
    board: school?.board || "",
    recognitionNumber: school?.recognitionNumber || "",
    recognitionAuthority: school?.recognitionAuthority || "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: school?.name || "",
      shortName: school?.shortName || "",
      email: school?.email || "",
      phone: school?.phone || "",
      address: school?.address || "",
      city: school?.city || "",
      state: school?.state || "",
      pincode: school?.pincode || "",
      board: school?.board || "",
      recognitionNumber: school?.recognitionNumber || "",
      recognitionAuthority: school?.recognitionAuthority || "",
    });
  }, [school?.name, school?.shortName, school?.email, school?.phone, school?.address, school?.city, school?.state, school?.pincode, school?.board, school?.recognitionNumber, school?.recognitionAuthority]);

  const save = async () => {
    if (form.email && !EMAIL_RE.test(form.email.trim())) {
      toast("Please enter a valid school email", "error");
      return;
    }
    if (form.phone && !PHONE_RE.test(form.phone.trim())) {
      toast("Please enter a valid phone number", "error");
      return;
    }
    if (form.pincode && !PINCODE_RE.test(form.pincode.trim())) {
      toast("Please enter a valid 6-digit pincode", "error");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.school.update({
        name: form.name.trim() || school?.name,
        shortName: form.shortName.trim() || school?.shortName,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        pincode: form.pincode.trim() || undefined,
        board: form.board.trim() || undefined,
        recognitionNumber: form.recognitionNumber.trim() || undefined,
        recognitionAuthority: form.recognitionAuthority.trim() || undefined,
      });
      dispatch(setSchoolAction(data));
      localStorage.setItem("erp_school", JSON.stringify(data));
      setForm({
        name: data.name || "",
        shortName: data.shortName || "",
        email: data.email || "",
        phone: data.phone || "",
        address: data.address || "",
        city: data.city || "",
        state: data.state || "",
        pincode: data.pincode || "",
        board: data.board || "",
        recognitionNumber: data.recognitionNumber || "",
        recognitionAuthority: data.recognitionAuthority || "",
      });
      toast("School settings saved");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Administration"
        title="Settings"
        description="Organization configuration scoped to your current account."
      />

      {!canManageSchool ? (
        <Card>
          <p className="text-[13px] text-slate-text/70">
            Settings for this workspace are managed by your school
            administrator. To update your password, photo or role, contact the
            administrator responsible for your account.
          </p>
        </Card>
      ) : (
        <>
          <Card
            title="School Settings"
            action={
              <Button variant="amber" onClick={save} disabled={saving}>
                <Save size={15} />
                {saving ? "Saving…" : "Save"}
              </Button>
            }
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  School Name
                </label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="School name"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Short Name
                </label>
                <Input
                  value={form.shortName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, shortName: e.target.value }))
                  }
                  placeholder="Short name used in the sidebar"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  School Code
                </label>
                <Input
                  value={school?.code || ""}
                  disabled
                  className="font-mono opacity-60 cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-text/60 mt-1">
                  Internal identifier. Cannot be changed.
                </p>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Session
                </label>
                <div className="flex items-center h-[38px]">
                  <Pill tone="neutral">{sessionLabel(school) || "—"}</Pill>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mt-5">
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  School Email
                </label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="School email"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Phone
                </label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="Phone number"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Address
                </label>
                <Input
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                  placeholder="Address"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  City
                </label>
                <Input
                  value={form.city}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, city: e.target.value }))
                  }
                  placeholder="City"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  State
                </label>
                <Input
                  value={form.state}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, state: e.target.value }))
                  }
                  placeholder="State"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Pincode
                </label>
                <Input
                  value={form.pincode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, pincode: e.target.value }))
                  }
                  placeholder="6-digit pincode"
                />
              </div>
            </div>

            <div className="border-t border-black/5 pt-4 mt-4">
              <h4 className="text-[13px] font-bold text-ink mb-3">Affiliation & Recognition</h4>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Board</label>
                  <select
                    value={form.board}
                    onChange={(e) => setForm((f) => ({ ...f, board: e.target.value }))}
                    className="w-full h-[38px] rounded-lg border border-black/10 bg-white px-3 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-amber/40"
                  >
                    <option value="">Select board</option>
                    <option value="CBSE">CBSE</option>
                    <option value="ICSE">ICSE</option>
                    <option value="State Board">State Board</option>
                    <option value="IGCSE">IGCSE</option>
                    <option value="IB">IB (International Baccalaureate)</option>
                    <option value="NIOS">NIOS</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Recognition / Affiliation No.</label>
                  <Input
                    value={form.recognitionNumber}
                    onChange={(e) => setForm((f) => ({ ...f, recognitionNumber: e.target.value }))}
                    placeholder="e.g. 2730456 / UGC-12345"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Issuing Authority</label>
                  <select
                    value={form.recognitionAuthority}
                    onChange={(e) => setForm((f) => ({ ...f, recognitionAuthority: e.target.value }))}
                    className="w-full h-[38px] rounded-lg border border-black/10 bg-white px-3 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-amber/40"
                  >
                    <option value="">Select authority</option>
                    <option value="CBSE">CBSE, New Delhi</option>
                    <option value="CISCE">CISCE (ICSE), New Delhi</option>
                    <option value="State Education Dept">State Education Department</option>
                    <option value="UGC">UGC (University Grants Commission)</option>
                    <option value="AICTE">AICTE</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              {school?.recognitionVerified && (
                <div className="mt-2 flex items-center gap-2 text-[12px] text-success font-medium">
                  <span className="w-2 h-2 rounded-full bg-success inline-block" />
                  Verified on {new Date(school.recognitionVerifiedAt).toLocaleDateString("en-IN")}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <Building2 size={14} className="text-slate-text/50 shrink-0 mt-0.5" />
              <span className="text-[12.5px] text-slate-text/70">
                Branding like the report-card logo lives under{" "}
                <span className="text-ink font-medium">Report Card</span>.
              </span>
            </div>
          </Card>

          <Card title="Account context">
            <div className="flex items-center gap-3">
              <Pill tone="info">{roleLabel(user?.role, user?.designation)}</Pill>
              <span className="text-[12.5px] text-slate-text/70">
                {user?.name} · {user?.email || "—"}
              </span>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}