import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Save,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Input,
  Pill,
  toast,
} from "../components/UI";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../components/StateViews";
import { api } from "../lib/api";
import { usePermission } from "../lib/permissions";

const EMPTY = {
  name: "",
  code: "",
  isHeadOffice: false,
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
};

// Exactly 10 digits, nothing else — no +91, no spaces, no dashes. Matches the
// rule the branch form advertises in its placeholder.
const PHONE_RE = /^\d{10}$/;

// Live check while typing. A 3-digit value is still being entered, so it must
// NOT turn red mid-keystroke — only a value that is already too long or that
// contains something other than a digit does.
function phoneTypingProblem(value) {
  const v = String(value || "").trim();
  if (!v || PHONE_RE.test(v)) return null;
  if (/\D/.test(v)) return "Phone number must contain digits only";
  if (v.length > 10) return "Phone number must be exactly 10 digits";
  return null;
}

// Returns { field: message } rather than a single string so each field can show
// its own message directly beneath itself. One toast for the whole form left
// the user guessing which input was wrong, or scrolling to find it.
const validate = (form) => {
  const errors = {};

  const name = form.name.trim();
  if (!name) errors.name = "Branch name is required";
  else if (name.length > 80) errors.name = "Branch name is too long (max 80)";

  const code = form.code.trim();
  if (code && !/^[A-Za-z0-9-]{2,20}$/.test(code)) {
    errors.code = "Letters, numbers and hyphens only (2-20 chars)";
  }

  // On submit any deviation from 10 digits is final, including a short one.
  const phone = form.phone.trim();
  if (phone && !PHONE_RE.test(phone)) {
    errors.phone = /\D/.test(phone)
      ? "Phone number must contain digits only"
      : "Phone number must be exactly 10 digits";
  }

  const email = form.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address";
  }

  const pincode = form.pincode.trim();
  if (pincode && !/^\d{4,10}$/.test(pincode)) {
    errors.pincode = "PIN code must be 4-10 digits";
  }

  return errors;
};

// Local wrapper so every field gets the same label / required-marker / error
// markup instead of repeating it eight times inside the modal.
function Field({ label, required, error, children, className = "" }) {
  return (
    <div className={className}>
      <label className="text-sm text-slate-600">
        {label}
        {required ? <span className="ml-0.5 text-alert">*</span> : null}
      </label>
      {children}
      {error ? <p className="mt-1 text-[11.5px] text-alert">{error}</p> : null}
    </div>
  );
}

export default function Branches() {
  const canRead = usePermission("branches:read");
  const canWrite = usePermission("branches:write");

  const [branches, setBranches] = useState([]);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      // The list call already carries the plan limit, so the quota request is
      // only needed to stay fresh after a create/delete.
      const res = await api.branches.list();
      setBranches(res.data || []);
      setQuota(res.quota || null);
    } catch (err) {
      setError(err.message || "Could not load branches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canRead) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  const activeCount = useMemo(() => branches.filter((b) => b.isActive).length, [branches]);

  // Dropping the message the moment the field is edited keeps a stale error from
// sitting under a value the user has already corrected.
const set = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => {
      // Phone is judged on every keystroke: the moment an 11th digit lands the
      // field has to show it rather than wait for a submit. Every other field
      // only clears, and is judged when the form is submitted.
      const live = key === "phone" ? phoneTypingProblem(value) : null;
      if (live) return { ...prev, [key]: live };
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Red ring for whichever field currently holds a message.
  const ring = (key) => (errors[key] ? "ring-2 ring-alert/40 border-alert" : "");

  const openCreate = () => {
    setErrors({});
    setForm({ ...EMPTY, isHeadOffice: activeCount === 0 });
  };

  const openEdit = (branch) => {
    setErrors({});
    setForm({
      _id: branch._id,
      name: branch.name || "",
      code: branch.code || "",
      isHeadOffice: Boolean(branch.isHeadOffice),
      phone: branch.phone || "",
      email: branch.email || "",
      address: branch.address || "",
      city: branch.city || "",
      state: branch.state || "",
      pincode: branch.pincode || "",
    });
  };

  const save = async () => {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Kept alongside the inline messages: the modal scrolls, so a field near
      // the top can be off-screen when a field near the bottom fails.
      return toast("Please fix the highlighted fields", "error");
    }

    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      pincode: form.pincode.trim() || undefined,
    };

    setSaving(true);
    try {
      if (form._id) await api.branches.update(form._id, payload);
      else await api.branches.create(payload);
      toast(form._id ? "Branch updated" : "Branch created");
      setForm(null);
      await load();
    } catch (err) {
      toast(err.message || "Could not save branch", "error");
    } finally {
      setSaving(false);
    }
  };

  // Head office is a transfer, not an edit: the old one is demoted server-side
  // and the quota/unique indexes are unaffected, so it gets its own confirm.
  const makeHeadOffice = async (branch) => {
    setBusyId(branch._id);
    try {
      await api.branches.setHeadOffice(branch._id);
      toast(`${branch.name} is now the head office`);
      await load();
    } catch (err) {
      toast(err.message || "Could not update head office", "error");
    } finally {
      setBusyId("");
    }
  };

  const remove = async (branch) => {
    const isLast = activeCount <= 1;
    if (isLast) {
      return toast("A school must keep at least one branch", "error");
    }
    if (branch.isHeadOffice) {
      return toast("Make another branch the head office before deleting this one", "error");
    }
    if (
      !window.confirm(
        `Delete "${branch.name}"? Its students and staff stay, but the branch is archived and can no longer be selected.`,
      )
    ) {
      return;
    }
    setBusyId(branch._id);
    try {
      await api.branches.remove(branch._id);
      toast("Branch deleted");
      await load();
    } catch (err) {
      toast(err.message || "Could not delete branch", "error");
    } finally {
      setBusyId("");
    }
  };

  if (!canRead) {
    return (
      <div className="p-6">
        <EmptyBlock title="You do not have access to branch management." />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageIntro
        eyebrow="School setup"
        title="Branches"
        description="Every campus is a branch. Students, staff, classes and fees all belong to one, and the switcher in the top bar decides which one you are working in."
        right={
          canWrite ? (
            <Button onClick={openCreate}>
              <Plus size={16} /> Add branch
            </Button>
          ) : null
        }
      />

      {quota && (
        <p className="text-xs text-slate-500">
          {quota.limit === null
            ? `${quota.used} branch${quota.used === 1 ? "" : "es"} on an unlimited plan`
            : `${quota.used} of ${quota.limit} branch${quota.limit === 1 ? "" : "es"} used on the ${quota.planName} plan`}
        </p>
      )}

      {loading && <LoadingBlock label="Loading branches." />}
      {!loading && error && <ErrorBlock message={error} onRetry={load} />}

      {!loading && !error && branches.length === 0 && (
        <EmptyBlock title="No branches yet. Add your first campus to get started." />
      )}

      {!loading && !error && branches.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {branches.map((branch) => {
            const place = [branch.address, branch.city, branch.state, branch.pincode]
              .filter(Boolean)
              .join(", ");
            return (
              <Card key={branch._id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 size={18} className="shrink-0 text-slate-400" />
                    <h3 className="truncate font-semibold text-slate-800">
                      {branch.name}
                    </h3>
                  </div>
                  {branch.isHeadOffice ? (
                    <Pill tone="success">
                      <Star size={12} /> Head office
                    </Pill>
                  ) : branch.isActive ? null : (
                    <Pill tone="warning">Inactive</Pill>
                  )}
                </div>

                {branch.code && (
                  <p className="text-xs uppercase tracking-wide text-slate-400">{branch.code}</p>
                )}

                <div className="space-y-1 text-sm text-slate-600">
                  {place && (
                    <p className="flex items-start gap-2">
                      <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                      <span>{place}</span>
                    </p>
                  )}
                  {branch.phone && (
                    <p className="flex items-center gap-2">
                      <Phone size={14} className="shrink-0 text-slate-400" />
                      {branch.phone}
                    </p>
                  )}
                </div>

                {canWrite && (
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    <Button variant="ghost" onClick={() => openEdit(branch)}>
                      <Pencil size={14} /> Edit
                    </Button>
                    {!branch.isHeadOffice && (
                      <Button
                        variant="ghost"
                        disabled={busyId === branch._id}
                        onClick={() => makeHeadOffice(branch)}
                      >
                        <Star size={14} /> Make head office
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      disabled={busyId === branch._id}
                      onClick={() => remove(branch)}
                    >
                      <Trash2 size={14} /> Delete
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8">
          <Card className="w-full max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                {form._id ? `Edit ${form.name || "branch"}` : "Add branch"}
              </h2>
              <Button variant="ghost" onClick={() => setForm(null)} aria-label="Close">
                <X size={16} />
              </Button>
            </div>

            <div className="space-y-5">
              <section>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-text/50">
                  Campus
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name" required error={errors.name}>
                    <Input
                      className={`mt-1 ${ring("name")}`}
                      value={form.name}
                      onChange={set("name")}
                      placeholder="North Campus"
                      maxLength={80}
                      aria-invalid={Boolean(errors.name)}
                    />
                  </Field>
                  <Field label="Code" error={errors.code}>
                    <Input
                      className={`mt-1 ${ring("code")}`}
                      value={form.code}
                      onChange={set("code")}
                      placeholder="north"
                      maxLength={20}
                      aria-invalid={Boolean(errors.code)}
                    />
                    <p className="mt-1 text-[11px] text-slate-text/60">
                      Optional. Used by imports, exports and the campus switcher.
                    </p>
                  </Field>
                </div>
              </section>

              <section>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-text/50">
                  Contact
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Phone" error={errors.phone}>
                    <Input
                      className={`mt-1 ${ring("phone")}`}
                      type="tel"
                      inputMode="numeric"
                      value={form.phone}
                      onChange={set("phone")}
                      placeholder="9876543210"
                      aria-invalid={Boolean(errors.phone)}
                    />
                  </Field>
                  <Field label="Email" error={errors.email}>
                    <Input
                      className={`mt-1 ${ring("email")}`}
                      type="email"
                      value={form.email}
                      onChange={set("email")}
                      placeholder="campus@school.edu"
                      aria-invalid={Boolean(errors.email)}
                    />
                  </Field>
                </div>
              </section>

              <section>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-text/50">
                  Location
                </p>
                <div className="space-y-3">
                  <Field label="Address">
                    <Input
                      className="mt-1"
                      value={form.address}
                      onChange={set("address")}
                      placeholder="Street, area, landmark"
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="City">
                      <Input
                        className="mt-1"
                        value={form.city}
                        onChange={set("city")}
                        placeholder="Bhopal"
                      />
                    </Field>
                    <Field label="State">
                      <Input
                        className="mt-1"
                        value={form.state}
                        onChange={set("state")}
                        placeholder="Madhya Pradesh"
                      />
                    </Field>
                    <Field label="PIN code" error={errors.pincode}>
                      <Input
                        className={`mt-1 ${ring("pincode")}`}
                        inputMode="numeric"
                        value={form.pincode}
                        onChange={set("pincode")}
                        placeholder="462001"
                        maxLength={10}
                        aria-invalid={Boolean(errors.pincode)}
                      />
                    </Field>
                  </div>
                </div>
              </section>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                <Save size={15} /> {saving ? "Saving" : form._id ? "Save changes" : "Create branch"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
