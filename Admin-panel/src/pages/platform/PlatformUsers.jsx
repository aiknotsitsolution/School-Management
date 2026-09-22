import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  RotateCcw,
  Ban,
  CheckCircle2,
  Eye,
  FilterX,
  Building2,
  KeyRound,
  AlertTriangle,
} from "lucide-react";
import { api } from "../../lib/api";
import { Button, Card, Input, PageIntro, Pill, Select, toast } from "../../components/UI";

const ROLE_LABELS = {
  super_admin: "Platform Owner",
  school_admin: "School Admin",
  teacher: "Teacher",
  staff: "Staff",
  student: "Student",
};

const DESIGNATION_OPTIONS = [
  "admission_counsellor",
  "accountant",
  "librarian",
  "receptionist",
  "transport",
];
const DESIGNATION_LABELS = {
  admission_counsellor: "Admission Counsellor",
  accountant: "Accountant",
  librarian: "Librarian",
  receptionist: "Receptionist",
  transport: "Transport Coordinator",
};

const fmtDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const initials = (name) =>
  name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const emptyForm = () => ({
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

// refId (kept as refId in the API payload) maps to a role-specific identity
// field: Admission ID for students, Staff ID for staff/teachers, and nothing
// needed for school admins / platform owner.
const REF_ID_FIELDS = {
  student: { label: "Admission ID", placeholder: "Enter Admission ID", required: true },
  staff: { label: "Staff ID", placeholder: "Enter Staff ID", required: false },
  school_admin: { label: "Ref ID", disabled: true, placeholder: "Not required for this role" },
  super_admin: null,
};

const refIdFieldFor = (role) => REF_ID_FIELDS[role] || null;

function RefIdField({ field, value, onChange, withLabel = true }) {
  if (!field) return null;
  const input = (
    <Input
      required={field.disabled ? undefined : field.required}
      disabled={field.disabled}
      readOnly={field.disabled}
      placeholder={field.placeholder}
      autoComplete="off"
      className={field.disabled ? "bg-paper cursor-not-allowed" : undefined}
      value={value || ""}
      onChange={onChange}
    />
  );
  if (!withLabel) return input;
  if (field.disabled) {
    return (
      <div>
        <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">
          {field.label}
        </span>
        {input}
      </div>
    );
  }
  return (
    <div>
      <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">
        {field.label}
        {!field.required && (
          <span className="normal-case font-medium text-slate-text/40"> · optional</span>
        )}
      </span>
      {input}
    </div>
  );
}

export default function PlatformUsers() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [role, setRole] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const [createdCredential, setCreatedCredential] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [userTab, setUserTab] = useState("active");

  useEffect(() => {
    api.schools
      .list()
      .then(({ data }) => setSchools(data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
    if (role) params.set("role", role);
    if (schoolId) params.set("schoolId", schoolId);
    if (userTab === "removed") params.set("includeDeleted", "true");
    params.set("page", String(page));
    params.set("limit", "20");

    api.platform.users
      .list(params.toString())
      .then((result) => {
        setRows(result.data || []);
        setTotal(result.total || 0);
        setPages(result.pages || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [debouncedQ, role, schoolId, userTab, page, refreshKey]);

  const schoolNameOf = (id) => schools.find((s) => String(s._id || s.id) === String(id))?.name || "—";

  const refField = refIdFieldFor(form.role);

  const refresh = () => setRefreshKey((key) => key + 1);
  const resetForm = () => setForm(emptyForm());

  const open360 = async (userId) => {
    setBusy(true);
    try {
      const { data } = await api.platform.users.get360(userId);
      setSelected(data);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (user) => {
    setConfirmModal({
      type: "toggle",
      title: user.isActive ? "Deactivate User" : "Activate User",
      message: `${user.isActive ? "Deactivate" : "Activate"} ${user.name}?`,
      confirmLabel: user.isActive ? "Deactivate" : "Activate",
      variant: user.isActive ? "danger" : "success",
      onConfirm: async () => {
        try {
          await api.platform.users.setStatus(user._id, !user.isActive);
          toast(user.isActive ? "User deactivated" : "User activated");
          refresh();
          if (selected?.user?._id === user._id) open360(user._id);
        } catch (err) {
          toast(err.message, "error");
        }
      },
    });
  };

  const removeUser = async (user) => {
    setConfirmModal({
      type: "remove",
      title: "Remove User",
      message: `Remove ${user.name} (${user.email})? Access is revoked and history is preserved — it can be restored later.`,
      confirmLabel: "Remove",
      variant: "danger",
      onConfirm: async () => {
        try {
          await api.platform.users.remove(user._id);
          toast("User removed");
          refresh();
          if (selected?.user?._id === user._id) setSelected(null);
        } catch (err) {
          toast(err.message, "error");
        }
      },
    });
  };

  const restoreUser = async (user) => {
    try {
      await api.platform.users.restore(user._id);
      toast("User restored");
      refresh();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const hardDeleteUser = async (user) => {
    setConfirmModal({
      type: "hardDelete",
      title: "Permanently Delete User",
      message: `Permanently delete ${user.name} (${user.email})? This action cannot be undone. All data will be lost.`,
      confirmLabel: "Delete Permanently",
      variant: "danger",
      onConfirm: async () => {
        try {
          await api.platform.users.hardDelete(user._id);
          toast("User permanently deleted");
          refresh();
        } catch (err) {
          toast(err.message, "error");
        }
      },
    });
  };

  const sendOtp = async (user) => {
    try {
      const { data } = await api.users.sendResetOtp(user._id);
      toast(
        data?.maskedEmail
          ? `OTP sent to ${data.maskedEmail} — valid for 10 minutes`
          : "OTP sent to the user's email — valid for 10 minutes",
      );
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const createUser = async (event) => {
    event.preventDefault();
    if (!form.schoolId && form.role !== "super_admin") {
      toast("Pick a school for school-scoped roles", "error");
      return;
    }
    if (form.role === "student" && !form.refId.trim()) {
      toast("Admission ID is required for student accounts", "error");
      return;
    }
    setBusy(true);
    try {
      await api.users.create({
        schoolId: form.role === "super_admin" ? undefined : form.schoolId,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        designation: form.role === "staff" ? form.designation || undefined : undefined,
        class: form.role === "teacher" ? form.className || undefined : undefined,
        section: form.section || undefined,
        refId: form.refId.trim() || undefined,
      });
      toast("User created");
      // Credentials are only shareable at creation time — the API never
      // returns the password again, so surface them in a copy dialog now.
      setCreatedCredential({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        admissionId: form.role === "student" ? form.refId.trim() : null,
        password: form.password,
      });
      setCreating(false);
      resetForm();
      refresh();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const editSelected = async (patch) => {
    const userId = selected.user._id;
    try {
      await api.platform.users.update(userId, patch);
      toast("User updated");
      open360(userId);
    } catch (err) {
      toast(err.message, "error");
    }
  };

  return (
    <div className="w-full">
      <PageIntro
        eyebrow="Platform Owner · Access & Security"
        title="Users & Access"
        description={`${total} user${total === 1 ? "" : "s"} platform-wide. Create accounts, manage status, inspect a User 360°, and restore removed users.`}
        right={
          <Button variant="amber" onClick={() => { setCreating(true); resetForm(); }}>
            <Plus size={15} /> New user
          </Button>
        }
      />

      {creating && (
        <Card title="Create a platform user" className="mb-5" action={<X size={15} className="cursor-pointer text-slate-text/60" onClick={() => setCreating(false)} />}>
          <form className="space-y-3.5" onSubmit={createUser}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <Input required placeholder="Full name" autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input required type="email" placeholder="Email (login)" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input required type="password" placeholder="Password (min 8 chars)" autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <Select required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
              {form.role !== "super_admin" ? (
                <Select required value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })}>
                  <option value="">Select school…</option>
                  {schools.map((school) => (
                    <option key={school._id || school.id} value={school._id || school.id}>
                      {school.name} ({school.code})
                    </option>
                  ))}
                </Select>
              ) : (
                <Input disabled placeholder="Platform-owner has no school" className="bg-paper" />
              )}
              {form.role === "staff" && (
                <Select
                  placeholder="Select designation"
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                >
                  <option value="">Select designation…</option>
                  {DESIGNATION_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {DESIGNATION_LABELS[value]}
                    </option>
                  ))}
                </Select>
              )}
              {form.role === "teacher" && (
                <Input placeholder="Class" autoComplete="off" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} />
              )}
              {refField && (
                <RefIdField withLabel={false} field={refField} value={form.refId} onChange={(e) => setForm({ ...form, refId: e.target.value })} />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
              <Button variant="amber" type="submit" disabled={busy}>{busy ? "Creating…" : "Create user"}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card bodyClassName="p-5">
        <div className="flex items-center gap-1 mb-4 border-b border-black/[0.06]">
          <button
            onClick={() => { setUserTab("active"); setPage(1); }}
            className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
              userTab === "active"
                ? "border-ink text-ink"
                : "border-transparent text-slate-text/60 hover:text-ink"
            }`}
          >
            Active Users
          </button>
          <button
            onClick={() => { setUserTab("removed"); setPage(1); }}
            className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
              userTab === "removed"
                ? "border-alert text-alert"
                : "border-transparent text-slate-text/60 hover:text-ink"
            }`}
          >
            Removed Users
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/50" />
            <Input
              placeholder="Search name or email"
              className="pl-9"
              value={q}
              onChange={(event) => { setQ(event.target.value); setPage(1); }}
            />
          </div>
          <Select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }} className="w-44">
            <option value="">All roles</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <div className="relative">
            <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/50 pointer-events-none" />
            <Select value={schoolId} onChange={(event) => { setSchoolId(event.target.value); setPage(1); }} className="pl-9 w-64">
              <option value="">All schools</option>
              {schools.map((item) => (
                <option key={item._id || item.id} value={item._id || item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </div>
          {(q.trim() || role || schoolId) && (
            <button
              onClick={() => { setQ(""); setRole(""); setSchoolId(""); setUserTab("active"); setPage(1); }}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink bg-paper px-3 py-2 rounded-lg border border-black/[0.06] hover:bg-alert/10 hover:text-alert transition-colors"
            >
              <FilterX size={13} /> Reset filters
            </button>
          )}
        </div>

        {!loading && (
          <p className="text-[12px] text-slate-text/60 mb-3">
            Showing {rows.length} of {total} user{total === 1 ? "" : "s"}
            {schoolId ? ` · ${schoolNameOf(schoolId)}` : ""}
            {role ? ` · ${(ROLE_LABELS[role] || role).toLowerCase()}` : ""}
            {userTab === "removed" ? " · removed" : ""}
          </p>
        )}

        {loading ? (
          <p className="text-[13px] text-slate-text/70 py-8 text-center">Loading users…</p>
        ) : rows.length === 0 ? (
          <p className="text-[13px] text-slate-text/70 py-8 text-center">No users match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[11.5px] uppercase tracking-wide text-slate-text/60 border-b border-black/[0.06]">
                  <th className="py-2.5 pr-4 font-semibold">User</th>
                  <th className="py-2.5 pr-4 font-semibold">Role</th>
                  <th className="py-2.5 pr-4 font-semibold">School</th>
                  <th className="py-2.5 pr-4 font-semibold">Last login</th>
                  <th className="py-2.5 pr-4 font-semibold">Status</th>
                  <th className="py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05]">
                {rows.map((user) => (
                  <tr key={user._id} className={user.deletedAt ? "opacity-60" : "hover:bg-paper/60"}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-ink text-amber flex items-center justify-center text-[11px] font-semibold shrink-0">
                          {initials(user.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-ink truncate">{user.name}</p>
                          <p className="text-[11.5px] text-slate-text/60 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4"><Pill tone="info">{ROLE_LABELS[user.role] || user.role}</Pill></td>
                    <td className="py-3 pr-4 text-slate-text/80">{user.schoolId ? schoolNameOf(user.schoolId) : "—"}</td>
                    <td className="py-3 pr-4 text-slate-text/70 whitespace-nowrap">{fmtDate(user.lastLogin)}</td>
                    <td className="py-3 pr-4">
                      {user.deletedAt ? (
                        <Pill tone="alert">removed</Pill>
                      ) : user.isActive ? (
                        <Pill tone="success">active</Pill>
                      ) : (
                        <Pill tone="amber">inactive</Pill>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => open360(user._id)}
                          disabled={busy}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-info bg-info/10 px-2.5 py-1.5 rounded-lg hover:bg-info/20"
                          title="User 360°"
                        >
                          <Eye size={13} /> 360°
                        </button>
                        {user.deletedAt ? (
                          <>
                            <button
                              onClick={() => restoreUser(user)}
                              className="inline-flex items-center text-[12px] font-semibold text-ink bg-paper px-2.5 py-1.5 rounded-lg hover:bg-black/5"
                            >
                              <RotateCcw size={13} /> Restore
                            </button>
                            <button
                              onClick={() => hardDeleteUser(user)}
                              className="inline-flex items-center text-[12px] font-semibold text-alert bg-alert/10 px-2.5 py-1.5 rounded-lg hover:bg-alert/20"
                              title="Permanently delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => toggleActive(user)}
                              className="inline-flex items-center text-[12px] font-semibold text-ink bg-paper px-2.5 py-1.5 rounded-lg hover:bg-black/5"
                            >
                              {user.isActive ? <Ban size={13} /> : <CheckCircle2 size={13} />}
                              {user.isActive ? " Deactivate" : " Activate"}
                            </button>
                            <button
                              onClick={() => sendOtp(user)}
                              className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink bg-paper px-2.5 py-1.5 rounded-lg hover:bg-black/5"
                              title="Send password reset OTP to the user's email"
                            >
                              <KeyRound size={13} /> Send OTP
                            </button>
                            <button
                              onClick={() => removeUser(user)}
                              className="inline-flex items-center text-[12px] font-semibold text-alert bg-paper px-2.5 py-1.5 rounded-lg hover:bg-alert/10"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-black/[0.06] mt-4">
            <p className="text-[12px] text-slate-text/60">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                <ChevronLeft size={15} /> Prev
              </Button>
              <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={page >= pages}>
                Next <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {createdCredential && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5">
            <h3 className="font-display font-bold text-ink text-lg">Account created</h3>
            <p className="text-[12.5px] text-slate-text/70 mt-1">
              Share these sign-in details with {createdCredential.name} now. The password is
              shown only at creation time and cannot be retrieved later.
            </p>
            <div className="mt-4 space-y-2.5 text-[13px]">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-black/10 px-3.5 py-2.5">
                <div>
                  <p className="text-[11px] text-slate-text/60 font-semibold uppercase">Email</p>
                  <p className="text-ink font-medium break-all">{createdCredential.email}</p>
                </div>
                <button
                  onClick={() => { navigator.clipboard?.writeText(createdCredential.email); toast("Email copied"); }}
                  className="text-[12px] font-semibold text-info bg-info/10 px-2.5 py-1.5 rounded-lg hover:bg-info/20 shrink-0"
                >
                  Copy
                </button>
              </div>
              {createdCredential.admissionId && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-black/10 px-3.5 py-2.5">
                  <div>
                    <p className="text-[11px] text-slate-text/60 font-semibold uppercase">Admission ID</p>
                    <p className="text-ink font-medium">{createdCredential.admissionId}</p>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(createdCredential.admissionId); toast("Admission ID copied"); }}
                    className="text-[12px] font-semibold text-info bg-info/10 px-2.5 py-1.5 rounded-lg hover:bg-info/20 shrink-0"
                  >
                    Copy
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-black/10 px-3.5 py-2.5">
                <div>
                  <p className="text-[11px] text-slate-text/60 font-semibold uppercase">Password</p>
                  <p className="text-ink font-medium break-all">{createdCredential.password}</p>
                </div>
                <button
                  onClick={() => { navigator.clipboard?.writeText(createdCredential.password); toast("Password copied"); }}
                  className="text-[12px] font-semibold text-info bg-info/10 px-2.5 py-1.5 rounded-lg hover:bg-info/20 shrink-0"
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button variant="amber" onClick={() => setCreatedCredential(null)}>Done</Button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-40 bg-black/30 flex justify-end" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-md bg-white h-full overflow-y-auto scrollbar-thin p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <User360
              data={selected}
              schoolName={schoolNameOf(selected.user?.schoolId)}
              onClose={() => setSelected(null)}
              onChanged={refresh}
              onEdit={editSelected}
              onToggleActive={toggleActive}
              onRemove={removeUser}
              onRestore={restoreUser}
              busy={busy}
            />
          </div>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmModal(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                confirmModal.variant === "danger" ? "bg-red-100" : "bg-green-100"
              }`}>
                <AlertTriangle size={20} className={confirmModal.variant === "danger" ? "text-red-600" : "text-green-600"} />
              </div>
              <h3 className="font-display font-bold text-ink text-lg">{confirmModal.title}</h3>
            </div>
            <p className="text-[13.5px] text-slate-text/80 mb-6">{confirmModal.message}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmModal(null)}>Cancel</Button>
              <Button
                variant={confirmModal.variant === "danger" ? "danger" : "amber"}
                onClick={async () => {
                  await confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
              >
                {confirmModal.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function User360({ data, schoolName, onClose, onChanged, onEdit, onToggleActive, onRemove, onRestore, busy }) {
  const user = data.user;
  const refField = refIdFieldFor(user.role);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState({
    name: user.name,
    phone: user.phone || "",
    designation: user.designation || "",
    class: user.class || "",
    section: user.section || "",
    refId: user.refId || "",
  });

  const saved = () => {
    setEdit(false);
    onChanged();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-ink text-lg">User 360°</h3>
        <button onClick={onClose} className="text-slate-text/60 hover:text-ink">
          <X size={18} />
        </button>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 rounded-full bg-ink text-amber flex items-center justify-center font-bold shrink-0">
          {initials(user.name)}
        </div>
        <div className="min-w-0">
          <p className="font-display font-bold text-ink truncate">{user.name}</p>
          <p className="text-[12.5px] text-slate-text/70 truncate">{user.email}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <Pill tone="info">{ROLE_LABELS[user.role] || user.role}</Pill>
        {user.deletedAt ? (
          <Pill tone="alert">removed {fmtDate(user.deletedAt)}</Pill>
        ) : user.isActive ? (
          <Pill tone="success">active</Pill>
        ) : (
          <Pill tone="amber">inactive</Pill>
        )}
        {user.emailVerified === false && <Pill>unverified email</Pill>}
      </div>

      {edit ? (
        <div className="space-y-3 mb-5">
          <label className="block">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Full name</span>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Phone</span>
            <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Designation</span>
            <Input value={draft.designation} onChange={(e) => setDraft({ ...draft, designation: e.target.value })} />
          </label>
          {refField && (
            <RefIdField field={refField} value={draft.refId} onChange={(e) => setDraft({ ...draft, refId: e.target.value })} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Class</span>
              <Input value={draft.class} onChange={(e) => setDraft({ ...draft, class: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[11.5px] font-semibold text-slate-text/60 uppercase block mb-1">Section</span>
              <Input value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })} />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setEdit(false)}>Cancel</Button>
            <Button
              variant="amber"
              disabled={busy}
              onClick={() => onEdit({ name: draft.name, phone: draft.phone || undefined, designation: draft.designation || undefined, class: draft.class || undefined, section: draft.section || undefined, refId: refField && !refField.disabled ? draft.refId || undefined : undefined }).then(saved)}
            >
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 text-[13px] mb-5">
          <div>
            <p className="text-[11.5px] text-slate-text/60 font-semibold uppercase">School</p>
            <p className="text-ink">{schoolName}</p>
          </div>
          <div>
            <p className="text-[11.5px] text-slate-text/60 font-semibold uppercase">Role</p>
            <p className="text-ink capitalize">{user.role}</p>
          </div>
          <div>
            <p className="text-[11.5px] text-slate-text/60 font-semibold uppercase">Last login</p>
            <p className="text-ink">{fmtDate(user.lastLogin)}</p>
          </div>
          <div>
            <p className="text-[11.5px] text-slate-text/60 font-semibold uppercase">Last activity</p>
            <p className="text-ink">{fmtDate(user.lastActivity)}</p>
          </div>
          <div>
            <p className="text-[11.5px] text-slate-text/60 font-semibold uppercase">Created</p>
            <p className="text-ink">{fmtDate(user.createdAt)}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {!edit && !user.deletedAt && (
          <Button variant="outline" onClick={() => setEdit(true)}>Edit profile</Button>
        )}
        {user.deletedAt ? (
          <Button variant="amber" disabled={busy} onClick={() => onRestore(user).then(onChanged)}>
            <RotateCcw size={15} /> Restore
          </Button>
        ) : (
          <>
            <Button variant="outline" disabled={busy} onClick={() => onToggleActive(user)}>
              {user.isActive ? <Ban size={15} /> : <CheckCircle2 size={15} />} {user.isActive ? "Deactivate" : "Activate"}
            </Button>
            <Button variant="outline" className="text-alert hover:bg-alert/10" disabled={busy} onClick={() => onRemove(user)}>
              <Trash2 size={15} /> Remove
            </Button>
          </>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-[11.5px] text-slate-text/60 font-semibold uppercase mb-2">Current subscription</p>
          {data.subscription ? (
            <div className="rounded-xl border border-black/10 p-3.5">
              <p className="text-[13.5px] font-semibold text-ink">{data.subscription.plan?.name || "—"}</p>
              <p className="text-[12px] text-slate-text/70 capitalize">{data.subscription.status} · renews {fmtDate(data.subscription.nextBillingDate)}</p>
            </div>
          ) : (
            <p className="text-[12.5px] text-slate-text/70">No current subscription for this school.</p>
          )}
        </div>

        <div>
          <p className="text-[11.5px] text-slate-text/60 font-semibold uppercase mb-2">Recent activity</p>
          {data.recentAudits?.length ? (
            <div className="space-y-2">
              {data.recentAudits.slice(0, 6).map((entry) => (
                <div key={entry._id} className="text-[12.5px]">
                  <p className="text-ink">{entry.message || entry.action}</p>
                  <p className="text-[11px] text-slate-text/60">
                    {entry.action.replace(".", " · ")} — {fmtDate(entry.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-slate-text/70">No activity recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
}