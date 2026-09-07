import { useEffect, useMemo, useState } from "react";
import { Plus, UserRound, Power, Trash2, Link2 } from "lucide-react";
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
import { useRole } from "../store/selectors";

const schoolAdminCreatable = ["class_teacher", "staff", "student"];
const platformCreatable = ["school_admin", "class_teacher", "staff", "student"];
const roleLabel = {
  super_admin: "Platform Owner",
  school_admin: "School Admin",
  class_teacher: "Class Teacher",
  staff: "Staff",
  student: "Student",
};

export default function Users() {
  const role = useRole();
  const creatable = role === "super_admin" ? platformCreatable : schoolAdminCreatable;

  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "class_teacher",
    designation: "",
    className: "",
    section: "",
    refId: "",
    linkStaff: false,
  });
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState("");

  const load = () =>
    api.users
      .list()
      .then(({ data }) => setUsers(data || []))
      .catch((err) => toast(err.message, "error"));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        (u.refId || "").toLowerCase().includes(q) ||
        (u.designation || "").toLowerCase().includes(q),
    );
  }, [users, query]);

  const createUser = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      let refId = form.refId.trim() || undefined;
      if ((form.role === "staff" || form.role === "class_teacher") && form.linkStaff) {
        const designation =
          form.role === "staff"
            ? form.designation.trim()
            : `Teacher - Class ${form.className.trim()} ${form.section.trim()}`.trim();
        const { data: staffDoc } = await api.staff.create({
          employeeId: `${form.email.trim().toLowerCase().split("@")[0]}-emp`,
          name: form.name.trim(),
          designation,
          email: form.email.trim().toLowerCase(),
          role: form.role === "class_teacher" ? "teacher" : "admin-staff",
          ...(form.role === "class_teacher"
            ? { classesAssigned: [{ class: form.className.trim(), section: form.section.trim() || null }] }
            : {}),
        });
        refId = String(staffDoc._id || staffDoc.id);
      }

      await api.users.create({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        designation:
          form.role === "staff" && form.designation.trim()
            ? form.designation.trim()
            : undefined,
        class: form.role === "class_teacher" || form.role === "student" ? form.className.trim() || undefined : undefined,
        section: form.section.trim() || undefined,
        refId,
      });
      toast("Account created");
      setForm({
        name: "",
        email: "",
        password: "",
        role: "class_teacher",
        designation: "",
        className: "",
        section: "",
        refId: "",
        linkStaff: false,
      });
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (user) => {
    setActionBusy(user.id);
    try {
      await api.users.updateStatus(user.id, !(user.isActive === false));
      toast(user.isActive === false ? "Account activated" : "Account suspended", "info");
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setActionBusy("");
    }
  };

  const removeUser = async (user) => {
    if (!window.confirm(`Delete account for ${user.name}?`)) return;
    setActionBusy(user.id);
    try {
      await api.users.remove(user.id);
      toast("Account deleted", "info");
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setActionBusy("");
    }
  };

  return (
    <div className="max-w-6xl">
      <PageIntro
        eyebrow={role === "super_admin" ? "Platform Owner" : "School Administration"}
        title="Users & Access"
        description="Create staff, teacher and student accounts, link them to their people-records (so self-service works), and suspend or remove access."
      />

      <div className="grid lg:grid-cols-5 gap-5">
        <Card
          title={`Accounts (${filtered.length})`}
          className="lg:col-span-3"
          bodyClassName="p-0"
          action={
            <Input
              placeholder="Search name, email, refId..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-52"
            />
          }
        >
          <div className="divide-y divide-black/[0.05]">
            {filtered.length === 0 && (
              <p className="p-6 text-[13px] text-slate-text/70">
                No accounts found.
              </p>
            )}
            {filtered.map((user) => {
              const active = user.isActive !== false;
              return (
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
                      {user.refId && (
                        <span className="ml-1.5 font-mono text-info">
                          · {user.refId.slice(-12)}
                        </span>
                      )}
                    </p>
                  </div>
                  <Pill tone="info">{roleLabel[user.role] || user.role}</Pill>
                  {user.designation && <Pill>{user.designation}</Pill>}
                  <Pill tone={active ? "success" : "alert"}>
                    {active ? "Active" : "Suspended"}
                  </Pill>
                  <div className="flex items-center gap-1">
                    <button
                      title={active ? "Suspend" : "Reactivate"}
                      disabled={actionBusy === user.id}
                      onClick={() => toggleStatus(user)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        active
                          ? "text-slate-text/60 hover:bg-paper hover:text-alert"
                          : "text-success bg-success/10 hover:bg-success hover:text-white"
                      }`}
                    >
                      <Power size={14} />
                    </button>
                    {role === "super_admin" && (
                      <button
                        title="Delete"
                        disabled={actionBusy === user.id}
                        onClick={() => removeUser(user)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-text/60 hover:bg-paper hover:text-alert transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Create an account" className="lg:col-span-2">
          <form className="space-y-3.5" onSubmit={createUser}>
            <div className="relative">
              <UserRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-text/40" />
              <Input
                required
                className="pl-9"
                placeholder="Full name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <Input
              required
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
            <Input
              required
              type="password"
              placeholder="Password (min 6 chars)"
              minLength={6}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
            <Select
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
            >
              {creatable.map((r) => (
                <option key={r} value={r}>
                  {roleLabel[r] || r}
                </option>
              ))}
            </Select>

            {form.role === "staff" && (
              <Input
                placeholder="Designation (accountant, librarian...)"
                value={form.designation}
                onChange={(event) =>
                  setForm({ ...form, designation: event.target.value })
                }
              />
            )}

            {form.role === "class_teacher" && (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Class"
                  value={form.className}
                  onChange={(event) =>
                    setForm({ ...form, className: event.target.value })
                  }
                />
                <Input
                  placeholder="Section"
                  value={form.section}
                  onChange={(event) =>
                    setForm({ ...form, section: event.target.value })
                  }
                />
              </div>
            )}

            {form.role === "student" && (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Class"
                  value={form.className}
                  onChange={(event) =>
                    setForm({ ...form, className: event.target.value })
                  }
                />
                <Input
                  placeholder="Section"
                  value={form.section}
                  onChange={(event) =>
                    setForm({ ...form, section: event.target.value })
                  }
                />
              </div>
            )}

            <Input
              placeholder={
                form.role === "student"
                  ? "Ref ID = admission no (e.g. STU-5A-001)"
                  : "Ref ID (optional, links to staff record)"
              }
              value={form.refId}
              onChange={(event) => setForm({ ...form, refId: event.target.value })}
            />

            {(form.role === "staff" || form.role === "class_teacher") && (
              <label className="flex items-center gap-2 text-[12.5px] text-slate-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.linkStaff}
                  onChange={(event) =>
                    setForm({ ...form, linkStaff: event.target.checked })
                  }
                  className="accent-amber"
                />
                <Link2 size={13} /> Create a linked staff record (enables self-service)
              </label>
            )}

            <Button
              type="submit"
              variant="amber"
              disabled={busy}
              className="w-full justify-center"
            >
              <Plus size={15} /> {busy ? "Creating..." : "Create account"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}