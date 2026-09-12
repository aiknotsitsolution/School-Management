import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Power, Trash2, X, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import { Button, Card, Input, PageIntro, Pill, Select, toast } from "../components/UI";

const LIMIT_LABELS = {
  students: "Students",
  staff: "Staff",
  teachers: "Teachers",
  adminUsers: "Admin users",
  branches: "Branches",
  storageGB: "Storage (GB)",
};

const Field = ({ label, children }) => (
  <div>
    <label className="text-[12px] font-semibold text-slate-text mb-1.5 block">{label}</label>
    {children}
  </div>
);

const fmtMoney = (plan) => {
  const amount = plan.price ?? 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: plan.currency || "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const emptyForm = () => ({
  name: "",
  code: "",
  description: "",
  price: 0,
  currency: "INR",
  billingCycle: "monthly",
  trialDays: 0,
  features: "",
  limits: { students: "", staff: "", teachers: "", adminUsers: "", branches: "", storageGB: "" },
  isActive: true,
  isPublic: true,
  sortOrder: 0,
});

const parseForm = (form) => {
  const limits = {};
  for (const key of Object.keys(LIMIT_LABELS)) {
    const value = form.limits[key];
    limits[key] = value === "" || value === null || value === undefined ? null : Number(value);
  }
  return {
    ...form,
    price: Number(form.price),
    trialDays: Number(form.trialDays),
    sortOrder: Number(form.sortOrder),
    features: form.features
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean),
    limits,
  };
};

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () =>
    api.plans
      .list()
      .then(({ data }) => setPlans(data || []))
      .catch((err) => toast(err.message, "error"))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing("new");
    setForm(emptyForm());
  };

  const openEdit = (plan) => {
    setEditing(plan._id);
    setForm({
      name: plan.name || "",
      code: plan.code || "",
      description: plan.description || "",
      price: plan.price ?? 0,
      currency: plan.currency || "INR",
      billingCycle: plan.billingCycle || "monthly",
      trialDays: plan.trialDays ?? 0,
      features: (plan.features || []).join("\n"),
      limits: { ...emptyForm().limits, ...(plan.limits || {}) },
      isActive: plan.isActive !== false,
      isPublic: plan.isPublic !== false,
      sortOrder: plan.sortOrder ?? 0,
    });
  };

  const save = async (event) => {
    event.preventDefault();
    const payload = parseForm(form);
    try {
      if (editing === "new") {
        await api.plans.create(payload);
        toast("Plan created");
      } else {
        await api.plans.update(editing, payload);
        toast("Plan updated");
      }
      setEditing(null);
      setForm(emptyForm());
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const toggleActive = async (plan) => {
    try {
      await api.plans.update(plan._id, { isActive: !plan.isActive });
      toast(plan.isActive ? "Plan deactivated" : "Plan activated");
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.plans.remove(confirmDelete._id);
      toast("Plan deleted");
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full">
      <PageIntro
        eyebrow="Platform Owner · Billing"
        title="Plans & Pricing"
        description="Manage the SaaS catalog. Prices are snapshotted onto subscriptions, so later edits never rewrite existing billing."
        right={
          <Button variant="amber" onClick={openCreate}>
            <Plus size={15} /> New plan
          </Button>
        }
      />

      {editing && (
        <Card
          title={editing === "new" ? "Create plan" : "Edit plan"}
          action={
            <button onClick={() => setEditing(null)} className="text-slate-text/60 hover:text-ink">
              <X size={18} />
            </button>
          }
          className="mb-5"
        >
          <form onSubmit={save} className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Plan name">
                <Input required placeholder="e.g. Professional" className="w-full" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Code">
                <Input required placeholder="e.g. professional" className="w-full" value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </Field>
              <Field label="Description">
                <Input placeholder="Short description" className="w-full" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>

            <div className="grid sm:grid-cols-4 gap-3">
              <Field label="Price (₹)">
                <Input required type="number" min="0" step="1" className="w-full" value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </Field>
              <Field label="Currency">
                <Select className="w-full" value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                </Select>
              </Field>
              <Field label="Billing cycle">
                <Select className="w-full" value={form.billingCycle}
                  onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </Select>
              </Field>
              <Field label="Trial days">
                <Input required type="number" min="0" step="1" className="w-full" value={form.trialDays}
                  onChange={(e) => setForm({ ...form, trialDays: e.target.value })} />
              </Field>
            </div>

            <div>
              <p className="text-[12px] font-semibold text-slate-text mb-1.5">Feature limits (blank = unlimited)</p>
              <div className="grid sm:grid-cols-3 gap-3">
                {Object.entries(LIMIT_LABELS).map(([key, label]) => (
                  <Input key={key} type="number" min="0" step="1"
                    placeholder={label} value={form.limits[key]}
                    onChange={(e) =>
                      setForm({ ...form, limits: { ...form.limits, [key]: e.target.value } })}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-[12px] font-semibold text-slate-text mb-1.5 block">
                Features (one per line)
              </label>
              <textarea
                rows={4}
                className="w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-[13px] outline-none focus:border-ink/40"
                placeholder={"Up to 1000 students\nAll core modules\nPriority support"}
                value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-5 flex-wrap">
              <label className="flex items-center gap-2 text-[13px] text-slate-text">
                <input type="checkbox" checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active
              </label>
              <label className="flex items-center gap-2 text-[13px] text-slate-text">
                <input type="checkbox" checked={form.isPublic}
                  onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} /> Public
              </label>
              <div className="w-28">
                <Input className="w-full" type="number" step="1" placeholder="Sort" value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" variant="amber">{editing === "new" ? "Create plan" : "Save changes"}</Button>
              <Button type="button" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <p className="text-[13px] text-slate-text/70">Loading plans…</p>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {plans.map((plan) => (
            <Card key={plan._id} className="flex flex-col" bodyClassName="p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[15px] font-semibold text-ink">{plan.name}</p>
                  <p className="text-[11.5px] font-mono text-slate-text/60">{plan.code}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Pill tone={plan.isActive ? "success" : "alert"}>
                    {plan.isActive ? "active" : "inactive"}
                  </Pill>
                  <Pill tone={plan.isPublic ? "info" : "neutral"}>
                    {plan.isPublic ? "public" : "hidden"}
                  </Pill>
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-display font-bold text-ink">{fmtMoney(plan)}</span>
                <span className="text-[12px] text-slate-text/60">/ {plan.billingCycle}</span>
              </div>

              <p className="text-[12.5px] text-slate-text/80 leading-relaxed min-h-[36px]">
                {plan.description || "—"}
              </p>

              <ul className="space-y-1.5 flex-1">
                {(plan.features || []).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[12.5px] text-slate-text">
                    <Check size={14} className="text-success shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
                <li className="flex items-start gap-2 text-[12.5px] text-slate-text/80">
                  <span className="text-[11px] bg-paper text-slate-text/70 px-1.5 py-0.5 rounded shrink-0">
                    {plan.trialDays > 0 ? `${plan.trialDays}-day trial` : "No trial"}
                  </span>
                  <span className="text-[11.5px] text-slate-text/60">
                    {Object.entries(plan.limits || {})
                      .filter(([, v]) => v !== null && v !== undefined)
                      .map(([k, v]) => `${LIMIT_LABELS[k] || k}: ${v}`)
                      .join(" · ") || "Unlimited limits"}
                  </span>
                </li>
              </ul>

              <div className="flex items-center gap-2 pt-1">
                <Button variant="primary" className="flex-1 justify-center" onClick={() => openEdit(plan)}>
                  <Pencil size={14} /> Edit
                </Button>
<Button variant="outline" onClick={() => toggleActive(plan)} title={plan.isActive ? "Deactivate (archive) — no longer assignable" : "Activate (un-archive)"}
          style={plan.isActive ? { color: "#3F8F5F", borderColor: "rgba(63,143,95,0.3)" } : { color: "#D65A4A", borderColor: "rgba(214,90,74,0.3)" }}>
          <Power size={14} />
        </Button>
        <Button variant="outline" onClick={() => setConfirmDelete(plan)} title="Delete (only if never used)"> 
          <Trash2 size={14} />
        </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete plan confirm */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => !deleting && setConfirmDelete(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-alert/10 text-alert flex items-center justify-center">
                <AlertTriangle size={19} />
              </div>
              <div>
                <h3 className="font-display font-semibold text-ink text-[16px]">
                  Delete "{confirmDelete.name}"?
                </h3>
                <p className="text-[13px] text-slate-text/80 mt-1">
                  This plan will be permanently removed. This is only allowed when it
                  has no subscription history.
                </p>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-black/[0.06] flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                className="bg-alert text-rose-700 hover:bg-alert/90 border-alert"
                onClick={remove}
                disabled={deleting}
              >
                <Trash2 size={15} />
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}