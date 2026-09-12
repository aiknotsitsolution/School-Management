import { useEffect, useState } from "react";
import {
  Building2,
  UserRound,
  CreditCard,
  Rocket,
  Check,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { api } from "../../lib/api";
import { Button, Card, Input, PageIntro, toast } from "../../components/UI";

const STEPS = [
  { key: "profile", label: "School profile", icon: Building2 },
  { key: "admin", label: "School admin", icon: UserRound },
  { key: "plan", label: "Subscription", icon: CreditCard },
  { key: "launch", label: "Launch", icon: Rocket },
];

const initialForm = {
  name: "",
  code: "",
  shortName: "",
  session: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
};

export default function SchoolOnboarding() {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [admin, setAdmin] = useState({ name: "", email: "", password: "" });
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.plans
      .list("status=active")
      .then(({ data }) => {
        setPlans(data || []);
        if (data?.length) setPlanId(data[0]._id);
      })
      .catch((err) => toast(err.message, "error"));
  }, []);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const goToStep1 = () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast("School name and code are required", "error");
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast("Please enter a valid school email", "error");
      return;
    }
    if (form.phone && !/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/.test(form.phone.trim())) {
      toast("Please enter a valid phone number", "error");
      return;
    }
    if (form.pincode && !/^[1-9][0-9]{5}$/.test(form.pincode.trim())) {
      toast("Please enter a valid 6-digit pincode", "error");
      return;
    }
    setStepIndex(1);
  };

  const goToStep2 = () => {
    if (!admin.name.trim() || !admin.email.trim() || !admin.password) {
      toast("Name, email and password are required", "error");
      return;
    }
    if (admin.password.length < 6) {
      toast("Password must be at least 6 characters", "error");
      return;
    }
    setStepIndex(2);
  };

  const goToStep3 = () => {
    if (!planId) {
      toast("Pick a plan first", "error");
      return;
    }
    setStepIndex(3);
  };

  const launch = async () => {
    setBusy(true);
    try {
      const { data: school } = await api.schools.create({
        ...form,
        code: form.code.trim(),
        name: form.name.trim(),
        shortName: form.shortName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        pincode: form.pincode.trim() || undefined,
      });

      await api.platform.schools.updateOnboarding(school._id, "configured");

      await api.users.create({
        schoolId: school._id,
        name: admin.name.trim(),
        email: admin.email.trim().toLowerCase(),
        password: admin.password,
        role: "school_admin",
      });

      await api.subscriptions.assign(school._id, planId, undefined);
      await api.platform.schools.updateOnboarding(school._id, "subscribed");

      await api.platform.schools.updateOnboarding(school._id, "live");

      api.platform.schools.sendWelcomeEmail(school._id).catch(() => {});

      setDone(true);
      toast("School is live — welcome email sent");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setForm(initialForm);
    setAdmin({ name: "", email: "", password: "" });
    setPlanId(plans[0]?._id || "");
    setStepIndex(0);
    setDone(false);
  };

  if (done) {
    return (
      <div className="w-full">
        <PageIntro
          eyebrow="Platform Owner · School Operations"
          title="School Onboarding"
          description="Provision a new tenant end-to-end."
        />
        <Card className="max-w-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-success/10 text-success flex items-center justify-center">
              <Check size={22} />
            </div>
            <div>
              <p className="font-display text-lg font-bold text-ink">School launched</p>
              <p className="text-[13px] text-slate-text/70">
                <span className="font-semibold text-ink">{form.name}</span> has been created, its admin onboarded and a live subscription assigned. It will appear under Schools Management.
              </p>
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <Button variant="outline" onClick={reset}>
              Onboard another school
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      <PageIntro
        eyebrow="Platform Owner · School Operations"
        title="School Onboarding"
        description="Guided wizard that provisions the school, its admin account, and its first subscription using real platform APIs."
      />

      <Card className="mb-5">
        <div className="flex items-center gap-2">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const active = index === stepIndex;
            const past = index < stepIndex;
            return (
              <div key={step.key} className="flex items-center gap-2 flex-1">
                <button
                  onClick={() => past && setStepIndex(index)}
                  className={`flex items-center gap-2 text-[12.5px] font-semibold ${
                    past ? "text-success cursor-pointer" : active ? "text-ink" : "text-slate-text/50"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                      past ? "bg-success/10 text-success" : active ? "bg-ink text-white" : "bg-paper text-slate-text/60"
                    }`}
                  >
                    {past ? <Check size={13} /> : active ? <Icon size={13} /> : index + 1}
                  </span>
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                {index < STEPS.length - 1 && <div className="h-px flex-1 bg-black/10" />}
              </div>
            );
          })}
        </div>
      </Card>

      {stepIndex === 0 && (
        <Card title="Step 1 · School profile">
          <div className="grid sm:grid-cols-2 gap-3.5">
            <Input required placeholder="School name" value={form.name} onChange={set("name")} />
            <div>
              <Input
                required
                placeholder="e.g. brightwood-academy"
                value={form.code}
                onChange={set("code")}
                className="font-mono"
              />
              <p className="text-[11px] text-slate-text/60 mt-1">
                Unique internal code for system identification, URLs and reports. Cannot be changed later.
              </p>
            </div>
            <Input placeholder="Short name" value={form.shortName} onChange={set("shortName")} />
            <Input placeholder="Session (e.g. 2026-2027)" value={form.session} onChange={set("session")} />
            <Input type="email" placeholder="School email" value={form.email} onChange={set("email")} />
            <Input placeholder="Phone" value={form.phone} onChange={set("phone")} />
            <Input placeholder="Address" value={form.address} onChange={set("address")} className="sm:col-span-2" />
            <Input placeholder="City" value={form.city} onChange={set("city")} />
            <Input placeholder="State" value={form.state} onChange={set("state")} />
            <Input placeholder="Enter 6-digit pincode" value={form.pincode} onChange={set("pincode")} />
          </div>
          <div className="flex justify-end mt-5">
            <Button variant="amber" onClick={goToStep1}>
              Next <ArrowRight size={15} />
            </Button>
          </div>
        </Card>
      )}

      {stepIndex === 1 && (
        <Card title="Step 2 · School admin account">
          <div className="grid sm:grid-cols-2 gap-3.5">
            <Input placeholder="Full name" value={admin.name} onChange={(e) => setAdmin({ ...admin, name: e.target.value })} />
            <Input
              type="email"
              placeholder="Email (login)"
              autoComplete="off"
              value={admin.email}
              onChange={(e) => setAdmin({ ...admin, email: e.target.value })}
            />
            <Input
              type="password"
              placeholder="Password (min 6 chars)"
              minLength={6}
              autoComplete="new-password"
              value={admin.password}
              onChange={(e) => setAdmin({ ...admin, password: e.target.value })}
              wrapperClassName="sm:col-span-2"
            />
          </div>
          <div className="flex justify-between mt-5">
            <Button variant="outline" onClick={() => setStepIndex(0)}>
              <ArrowLeft size={15} /> Back
            </Button>
            <Button variant="amber" onClick={goToStep2}>
              Next <ArrowRight size={15} />
            </Button>
          </div>
        </Card>
      )}

      {stepIndex === 2 && (
        <Card title="Step 3 · Subscription plan">
          {plans.length ? (
            <div className="space-y-2.5">
              {plans.map((plan) => (
                <button
                  key={plan._id}
                  onClick={() => setPlanId(plan._id)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-left transition-colors ${
                    planId === plan._id
                      ? "border-ink bg-ink/[0.03]"
                      : "border-black/10 hover:border-black/25"
                  }`}
                >
                  <div>
                    <p className="text-[14px] font-semibold text-ink">{plan.name}</p>
                    <p className="text-[12px] text-slate-text/70">{plan.description || plan.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[14px] font-bold text-ink">
                      ₹{Number(plan.price || 0).toLocaleString("en-IN")}
                      <span className="text-[11.5px] font-medium text-slate-text/70">
                        {plan.billingCycle === "yearly" ? "/yr" : "/mo"}
                      </span>
                    </p>
                    <p className="text-[11.5px] text-slate-text/60">{plan.trialDays ? `${plan.trialDays}-day trial` : "No trial"}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-slate-text/70">No active plans available yet.</p>
          )}
          <div className="flex justify-between mt-5">
            <Button variant="outline" onClick={() => setStepIndex(1)}>
              <ArrowLeft size={15} /> Back
            </Button>
            <Button variant="amber" onClick={goToStep3} disabled={!planId}>
              Next <ArrowRight size={15} />
            </Button>
          </div>
        </Card>
      )}

      {stepIndex === 3 && (
        <Card title="Step 4 · Launch">
          <div className="space-y-3 text-[13.5px]">
            <p className="text-slate-text">
              Everything is ready. Clicking <span className="font-semibold text-ink">Launch school</span> will create the
              school, set up the admin account, assign the subscription and make it live — all in one go.
            </p>
            <div className="rounded-xl bg-paper border border-black/[0.06] p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-text/70">School</span>
                <span className="font-semibold text-ink">{form.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-text/70">Code</span>
                <span className="font-mono text-ink">{form.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-text/70">Admin</span>
                <span className="text-ink">{admin.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-text/70">Plan</span>
                <span className="font-semibold text-ink">{plans.find((p) => p._id === planId)?.name || "—"}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-5">
            <Button variant="outline" onClick={() => setStepIndex(2)}>
              <ArrowLeft size={15} /> Back
            </Button>
            <Button variant="amber" onClick={launch} disabled={busy}>
              <Rocket size={15} /> {busy ? "Launching…" : "Launch school"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
