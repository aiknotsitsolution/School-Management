import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Building2, Palette, Save } from "lucide-react";
import { PageIntro, Card, Button, Input, Pill, toast } from "../components/UI";
import { selectSchool, selectUser } from "../store/selectors";
import { setSchool as setSchoolAction } from "../store/authSlice";
import { hasPermission } from "../lib/permissions";
import { api } from "../lib/api";

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
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: school?.name || "",
      shortName: school?.shortName || "",
    });
  }, [school?.name, school?.shortName]);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.school.update({
        name: form.name.trim() || school?.name,
        shortName: form.shortName.trim() || school?.shortName,
      });
      dispatch(setSchoolAction(data));
      localStorage.setItem("erp_school", JSON.stringify(data));
      setForm({ name: data.name || "", shortName: data.shortName || "" });
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
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <Building2 size={14} className="text-slate-text/50 shrink-0 mt-0.5" />
              <span className="text-[12.5px] text-slate-text/70">
                Session: <Pill tone="neutral">{school?.session || "—"}</Pill>
              </span>
              <Palette size={14} className="text-slate-text/50 shrink-0 mt-0.5 ml-2" />
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