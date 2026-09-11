import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Building2,
  Plus,
  Users,
  CheckCircle2,
  Eye,
  TrendingUp,
} from "lucide-react";
import { api } from "../lib/api";
import { Button, Card, Input, PageIntro, Pill, Select, StatCard, toast } from "../components/UI";

const roleOptions = ["school_admin", "teacher", "staff", "student"];
const fmtDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const tabFromParams = (searchParams) =>
  searchParams.get("tab") === "users" ? "users" : "schools";

export default function Platform() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFromParams(searchParams);
  const [schools, setSchools] = useState([]);
  const [users, setUsers] = useState([]);
  const [schoolForm, setSchoolForm] = useState({
    name: "",
    code: "",
    shortName: "",
    session: String(new Date().getFullYear()),
    plan: "trial",
  });
  const [userForm, setUserForm] = useState({
    schoolId: "",
    name: "",
    email: "",
    password: "",
    role: "school_admin",
    designation: "",
    className: "",
    section: "",
    refId: "",
  });
  const [gridSchoolId, setGridSchoolId] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [availablePlans, setAvailablePlans] = useState([]);

  useEffect(() => {
    api.schools
      .list()
      .then(({ data }) => {
        setSchools(data || []);
        if (data?.length) {
          setGridSchoolId(data[0]._id || data[0].id);
        }
      })
      .catch((err) => toast(err.message, "error"));
  }, []);

  useEffect(() => {
    if (tab !== "users" || !gridSchoolId) return;
    api.users
      .list(gridSchoolId)
      .then(({ data }) => setUsers(data || []))
      .catch((err) => toast(err.message, "error"));
  }, [tab, gridSchoolId]);

  useEffect(() => {
    api.analytics.summary().then(({ data }) => setStats(data)).catch(() => {});
  }, []);
  useEffect(() => {
    api.plans.list().then(({ data }) => setAvailablePlans(data || [])).catch(() => {});
  }, []);

  const createSchool = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.schools.create({
        name: schoolForm.name.trim(),
        code: schoolForm.code.trim(),
        shortName: schoolForm.shortName.trim() || undefined,
        session: schoolForm.session || undefined,
        plan: schoolForm.plan,
      });
      setSchools((prev) => [data, ...prev]);
      toast("School created");
      setSchoolForm({
        name: "",
        code: "",
        shortName: "",
        session: String(new Date().getFullYear()),
        plan: "trial",
      });
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await api.users.create({
        schoolId: userForm.schoolId,
        name: userForm.name.trim(),
        email: userForm.email.trim().toLowerCase(),
        password: userForm.password,
        role: userForm.role,
        designation: userForm.role === "staff" ? userForm.designation || undefined : undefined,
        class: userForm.role === "teacher" ? userForm.className || undefined : undefined,
        section: userForm.section || undefined,
        refId: userForm.refId.trim() || undefined,
      });
      toast("User created");
      setUserForm((prev) => ({ ...prev, name: "", email: "", password: "", refId: "" }));
      setUsers(await api.users.list(userForm.schoolId).then((r) => r.data));
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const activeSchoolForTab = schools.find(
    (s) => String(s._id || s.id) === String(gridSchoolId),
  );

  const switchTab = (next) => {
    setSearchParams(next === "users" ? { tab: "users" } : { tab: "schools" }, {
      replace: true,
    });
  };

  return (
    <div className="max-w-6xl">
      <PageIntro
        eyebrow="Platform Owner"
        title="Super Admin Platform"
        description="Provision tenant schools and their admin accounts. Use the school switcher in the top bar to impersonate a school and see exactly what its team sees."
        right={
          <div className="flex gap-2">
            {activeSchoolForTab && (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-info bg-info/10 px-3 py-1.5 rounded-lg">
                <Eye size={13} /> Topbar switcher ≈ impersonation
              </span>
            )}
          </div>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <StatCard
            label="Schools"
            value={stats.schools}
            sub={`${stats.activeSchools} active`}
            accent="amber"
          />
          <StatCard
            label="Current Subscriptions"
            value={stats.subscriptions.current}
            sub={`${stats.subscriptions.trialing} trialing · ${stats.subscriptions.cancelled} cancelled`}
            accent="success"
          />
          <StatCard
            icon={TrendingUp}
            label="MRR"
            value={`₹${Math.round(stats.mrr).toLocaleString("en-IN")}`}
            sub={`ARPU ₹${Math.round(stats.arpu).toLocaleString("en-IN")}`}
            accent="info"
          />
          <StatCard
            label="Expiring in 14 days"
            value={stats.expiringSoon.length}
            sub={
              stats.expiringSoon.length > 0
                ? `${stats.revenue.collected.toLocaleString("en-IN")} collected`
                : "All clear"
            }
            accent={stats.expiringSoon.length > 0 ? "alert" : "success"}
          />
        </div>
      )}

      <div className="flex gap-2 mb-5">
        <button
          onClick={() => switchTab("schools")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
            tab === "schools"
              ? "bg-ink text-white"
              : "bg-white text-ink border border-black/10 hover:bg-paper"
          }`}
        >
          <Building2 size={15} /> Schools ({schools.length})
        </button>
        <button
          onClick={() => switchTab("users")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
            tab === "users"
              ? "bg-ink text-white"
              : "bg-white text-ink border border-black/10 hover:bg-paper"
          }`}
        >
          <Users size={15} /> Tenant Users
        </button>
      </div>

      {tab === "schools" ? (
        <div className="grid lg:grid-cols-5 gap-5">
          <Card title="Registered Schools" className="lg:col-span-3" bodyClassName="p-0">
            <div className="divide-y divide-black/[0.05]">
              {schools.length === 0 && (
                <p className="p-6 text-[13px] text-slate-text/70">
                  No schools yet. Create the first tenant on the right.
                </p>
              )}
              {schools.map((school) => (
                <div key={school._id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber/15 text-amber-dark flex items-center justify-center shrink-0">
                    <Building2 size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-ink truncate">
                      {school.name}
                    </p>
                    <p className="text-[11.5px] text-slate-text/70">
                      {school.shortName || "—"} · Session {school.session || "—"}
                    </p>
                  </div>
                  <Pill tone={school.status === "active" ? "success" : "alert"}>
                    {school.status}
                  </Pill>
                  <Pill tone="info">{school.plan}</Pill>
                  <span className="text-[11.5px] font-mono text-slate-text/60 bg-paper px-2 py-0.5 rounded">
                    {school.code}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Onboard a new school" className="lg:col-span-2">
            <form className="space-y-3.5" onSubmit={createSchool}>
              <Input
                required
                placeholder="School name"
                value={schoolForm.name}
                onChange={(event) =>
                  setSchoolForm({ ...schoolForm, name: event.target.value })
                }
              />
              <Input
                required
                placeholder="Code (slug, e.g. brightwood)"
                value={schoolForm.code}
                onChange={(event) =>
                  setSchoolForm({ ...schoolForm, code: event.target.value })
                }
              />
              <Input
                placeholder="Short name"
                value={schoolForm.shortName}
                onChange={(event) =>
                  setSchoolForm({ ...schoolForm, shortName: event.target.value })
                }
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Session (2026-27)"
                  value={schoolForm.session}
                  onChange={(event) =>
                    setSchoolForm({ ...schoolForm, session: event.target.value })
                  }
                />
                <Select
                  value={schoolForm.plan}
                  onChange={(event) =>
                    setSchoolForm({ ...schoolForm, plan: event.target.value })
                  }
                >
                  {availablePlans.map((plan) => (
                    <option key={plan.code} value={plan.code}>
                      {plan.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" variant="amber" disabled={loading} className="w-full justify-center">
                <Plus size={15} /> {loading ? "Creating..." : "Create school"}
              </Button>
              <p className="text-[11.5px] text-slate-text/60 leading-relaxed">
                  After creating a school, select it in the top-bar switcher, then
                  create its admin account in the Tenant Users tab.
                </p>
              </form>
            </Card>

            {stats?.expiringSoon?.length > 0 && (
              <Card title="Expiring soon" className="lg:col-span-2 mt-0">
                <div className="divide-y divide-black/[0.06]">
                  {stats.expiringSoon.map((sub) => (
                    <div key={sub._id} className="flex items-center justify-between gap-2 text-[12.5px] py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink truncate">{sub.school?.name || "—"}</p>
                        <p className="text-slate-text/70">{sub.plan?.name} · {sub.status}</p>
                      </div>
                      <span className="text-slate-text/60 whitespace-nowrap">{fmtDate(sub.nextBillingDate)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-5">
          <Card title={`Accounts — ${activeSchoolForTab?.name || "pick a school"}`} className="lg:col-span-3" bodyClassName="p-0">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-black/[0.05]">
              <Select
                className="flex-1"
                value={gridSchoolId}
                onChange={(event) => setGridSchoolId(event.target.value)}
              >
                {schools.map((school) => (
                  <option key={school._id} value={school._id}>
                    {school.name} ({school.code})
                  </option>
                ))}
              </Select>
            </div>
            <div className="divide-y divide-black/[0.05]">
              {users.length === 0 && (
                <p className="p-6 text-[13px] text-slate-text/70">
                  No accounts for this school yet.
                </p>
              )}
              {users.map((user) => (
                <div key={user.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-ink text-amber flex items-center justify-center text-[12px] font-semibold shrink-0">
                    {user.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-ink truncate">
                      {user.name}
                    </p>
                    <p className="text-[11.5px] text-slate-text/70 truncate">
                      {user.email}
                    </p>
                  </div>
                  <Pill tone="info">{user.role}</Pill>
                  {user.designation && <Pill>{user.designation}</Pill>}
                  <CheckCircle2
                    size={15}
                    className={user.active === false ? "text-slate-300" : "text-success"}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Create an account" className="lg:col-span-2">
            <form className="space-y-3.5" onSubmit={createUser}>
              <Select
                required
                value={userForm.schoolId}
                onChange={(event) =>
                  setUserForm({ ...userForm, schoolId: event.target.value })
                }
              >
                <option value="">Select school...</option>
                {schools.map((school) => (
                  <option key={school._id} value={school._id}>
                    {school.name}
                  </option>
                ))}
              </Select>
              <Input
                required
                placeholder="Full name"
                value={userForm.name}
                onChange={(event) =>
                  setUserForm({ ...userForm, name: event.target.value })
                }
              />
              <Input
                required
                type="email"
                placeholder="Email"
                value={userForm.email}
                onChange={(event) =>
                  setUserForm({ ...userForm, email: event.target.value })
                }
              />
              <Input
                required
                type="password"
                placeholder="Password (min 6 chars)"
                minLength={6}
                value={userForm.password}
                onChange={(event) =>
                  setUserForm({ ...userForm, password: event.target.value })
                }
              />
              <Select
                value={userForm.role}
                onChange={(event) =>
                  setUserForm({ ...userForm, role: event.target.value })
                }
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </Select>
              {userForm.role === "staff" && (
                <Input
                  placeholder="Designation (accountant, librarian...)"
                  value={userForm.designation}
                  onChange={(event) =>
                    setUserForm({ ...userForm, designation: event.target.value })
                  }
                />
              )}
              {!["staff", "school_admin"].includes(userForm.role) && (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Class"
                    value={userForm.className}
                    onChange={(event) =>
                      setUserForm({
                        ...userForm,
                        className: event.target.value,
                      })
                    }
                  />
                  <Input
                    placeholder="Section"
                    value={userForm.section}
                    onChange={(event) =>
                      setUserForm({ ...userForm, section: event.target.value })
                    }
                  />
                </div>
              )}
              <Input
                placeholder="Ref ID (admission/employee no, optional)"
                value={userForm.refId}
                onChange={(event) =>
                  setUserForm({ ...userForm, refId: event.target.value })
                }
              />
              <Button type="submit" variant="amber" disabled={loading} className="w-full justify-center">
                <Plus size={15} /> {loading ? "Creating..." : "Create user"}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}