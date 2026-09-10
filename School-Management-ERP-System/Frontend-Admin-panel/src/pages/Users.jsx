import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  X,
  Trash2,
  RotateCcw,
  Ban,
  CheckCircle2,
  Eye,
  FilterX,
  Link2,
  KeyRound,
  Users as UsersIcon,
  UserRound,
  GraduationCap,
} from "lucide-react";
import { api } from "../lib/api";
import { Button, Card, Input, PageIntro, Pill, Select, toast } from "../components/UI";
import { SegmentedTabs, Pagination } from "../components/Pagination";
import SearchableSelect from "../components/SearchableSelect";
import { useMasterOptions } from "../hooks/useMasterOptions";

const ROLE_LABELS = {
  super_admin: "Platform Owner",
  school_admin: "School Admin",
  class_teacher: "Class Teacher",
  teacher: "Teacher",
  staff: "Staff",
  student: "Student",
};

// A school admin can create accounts for every school role EXCEPT admins —
// privilege escalation is deliberately blocked (enforced server-side too).
const CREATABLE_ROLES = ["class_teacher", "teacher", "staff", "student"];

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
// Beyond the common choices, staffing is free-form: the "Other / Custom" entry
// reveals a free-text field so any designation can be typed (the platform
// treats designation as text, never a closed enum).
const DESIGNATION_CUSTOM = "__custom__";

const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

const initials = (name) =>
  (name || "")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

// Reports & Analytics-style segmented tabs: the account directory is the main
// surface; the pending-student and pending-teacher queues sit behind their own
// tabs (each with a live count badge) instead of stacked cards.
const TABS = (counts) => [
  { id: "accounts", label: "Accounts", icon: UsersIcon, count: counts.total },
  { id: "students", label: "Pending Students", icon: UserRound, count: counts.pendingTotal },
  { id: "teachers", label: "Pending Teachers", icon: GraduationCap, count: counts.pendingStaffTotal },
];

// refId maps to a role-specific identity field: Admission ID for students,
// Staff ID for staff/teachers (manual, must match a Teachers & Staff record
// created earlier — never generated here), and nothing for school admins.
const REF_ID_FIELDS = {
  student: { label: "Admission ID", placeholder: "Enter Admission ID", required: true },
  staff: { label: "Staff ID", placeholder: "Staff ID from Teachers & Staff", required: true },
  class_teacher: { label: "Staff ID", placeholder: "Staff ID from Teachers & Staff", required: true },
  teacher: { label: "Staff ID", placeholder: "Staff ID from Teachers & Staff", required: true },
  school_admin: { label: "Ref ID", disabled: true, placeholder: "Not required for this role" },
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

const emptyForm = () => ({
  name: "",
  email: "",
  password: "",
  role: "class_teacher",
  designation: "",
  customDesignation: "",
  className: "",
  section: "",
  refId: "",
  lockedRefId: false,
});

const toUserPayload = (form) => ({
  name: form.name.trim(),
  email: form.email.trim().toLowerCase(),
  password: form.password,
  role: form.role,
  designation:
    form.role === "staff"
      ? (form.designation === DESIGNATION_CUSTOM
          ? (form.customDesignation || "").trim() || undefined
          : form.designation || undefined)
      : undefined,
  class:
    form.role === "class_teacher" || form.role === "teacher" || form.role === "student"
      ? form.className.trim() || undefined
      : undefined,
  section: form.section.trim() || undefined,
  refId: form.refId.trim() || undefined,
});

export default function Users() {
  const { options: CLASS_OPTIONS } = useMasterOptions("classes", ["Nursery","LKG","UKG","1","2","3","4","5","6","7","8","9","10","11-Sci","11-Com","12-Sci","12-Com"]);
  const { options: SECTION_OPTIONS, rawItems: rawSections } = useMasterOptions("sections", ["A","B","C"]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState("accounts");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [role, setRole] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const filteredSections = useMemo(() => {
    if (!form.className) return SECTION_OPTIONS;
    return [...new Set(rawSections.filter((s) => s.className === form.className).map((s) => s.name))];
  }, [form.className, SECTION_OPTIONS, rawSections]);
  const [busy, setBusy] = useState(false);
  const [createdCredential, setCreatedCredential] = useState(null);
  // Pending student registrations queue: confirmed admissions produce Student
  // shells (userId null) that await an account via Register User.
  const [pendingRows, setPendingRows] = useState([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPages, setPendingPages] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [viewingPending, setViewingPending] = useState(null);
  // Pending teacher registrations queue: teachers/class-teacher person records
  // created in Teachers & Staff (userId null) await a login account here.
  const [pendingStaff, setPendingStaff] = useState([]);
  const [pendingStaffTotal, setPendingStaffTotal] = useState(0);
  const [pendingStaffPages, setPendingStaffPages] = useState(0);
  const [pendingStaffPage, setPendingStaffPage] = useState(1);
  const [pendingStaffLoading, setPendingStaffLoading] = useState(true);
  const [viewingStaffPending, setViewingStaffPending] = useState(null);

  useEffect(() => {
    setPendingLoading(true);
    api.students
      .pendingRegistrations(`page=${pendingPage}&limit=10`)
      .then((result) => {
        setPendingRows(result.data || []);
        setPendingTotal(result.total || 0);
        setPendingPages(result.pages || 0);
        setPendingLoading(false);
      })
      .catch(() => setPendingLoading(false));
  }, [refreshKey, pendingPage]);

  useEffect(() => {
    setPendingStaffLoading(true);
    api.staff
      .pendingRegistrations(`role=teacher&page=${pendingStaffPage}&limit=10`)
      .then((result) => {
        setPendingStaff(result.data || []);
        setPendingStaffTotal(result.total || 0);
        setPendingStaffPages(result.pages || 0);
        setPendingStaffLoading(false);
      })
      .catch(() => setPendingStaffLoading(false));
  }, [refreshKey, pendingStaffPage]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
    if (role) params.set("role", role);
    if (includeDeleted) params.set("includeDeleted", "true");
    params.set("page", String(page));
    params.set("limit", "20");

    api.users
      .list(params.toString())
      .then((result) => {
        setRows(result.data || []);
        setTotal(result.total || 0);
        setPages(result.pages || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [debouncedQ, role, includeDeleted, page, refreshKey]);

  // School admins can view other admins but never manage/deactivate them —
  // privilege hierarchy is enforced server-side (loadManageableUser).
  const canManage = (user) => user.role !== "school_admin";
  // Register User locks the Admission ID + role to the confirmed shell.
  const refField =
    form.lockedRefId && refIdFieldFor(form.role)
      ? { ...refIdFieldFor(form.role), disabled: true }
      : refIdFieldFor(form.role);

  const refresh = () => setRefreshKey((key) => key + 1);
  const resetForm = () => setForm(emptyForm());

  // Register User: opens the create-account card pre-loaded from the confirmed
  // admission shell. The Admission ID and role are locked — the account must
  // link to this shell (never a new student record).
  const registerPending = (shell) => {
    setForm({
      name: shell.name || "",
      email: "",
      password: "",
      role: "student",
      designation: "",
      customDesignation: "",
      className: shell.class || "",
      section: shell.section || "",
      refId: shell.admissionNo || "",
      lockedRefId: true,
    });
    setCreating(true);
  };

  // Register Teacher (shared Register User form, context-aware): locks the
  // role to teacher and the Staff ID to the record's employeeId. The account
  // must link to this person record — never creates a new Staff record.
  const registerPendingStaff = (teacher) => {
    const first =
      Array.isArray(teacher.classesAssigned) && teacher.classesAssigned.length
        ? teacher.classesAssigned[0]
        : {};
    setForm({
      name: teacher.name || "",
      email: "",
      password: "",
      role: "teacher",
      designation: "",
      customDesignation: "",
      className: first.class || "",
      section: first.section || "",
      refId: teacher.employeeId || "",
      lockedRefId: true,
    });
    setCreating(true);
  };

  const toggleActive = async (user) => {
    if (window.confirm(`${user.isActive ? "Deactivate" : "Activate"} ${user.name}?`)) {
      try {
        await api.users.updateStatus(user.id, !user.isActive);
        toast(user.isActive ? "User deactivated" : "User activated");
        refresh();
      } catch (err) {
        toast(err.message, "error");
      }
    }
  };

  const removeUser = async (user) => {
    if (
      window.confirm(
        `Remove ${user.name} (${user.email})? Access is revoked and history is preserved — it can be restored later.`,
      )
    ) {
      try {
        await api.users.remove(user.id);
        toast("User removed");
        refresh();
        if (selected?.id === user.id) setSelected(null);
      } catch (err) {
        toast(err.message, "error");
      }
    }
  };

  const restoreUser = async (user) => {
    try {
      await api.users.restore(user.id);
      toast("User restored");
      refresh();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const resetPassword = async (user) => {
    try {
      const { data } = await api.users.sendResetOtp(user.id);
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
    if (form.role === "student" && !form.refId.trim()) {
      toast("Admission ID is required for student accounts", "error");
      return;
    }
    if (
      (form.role === "staff" ||
        form.role === "class_teacher" ||
        form.role === "teacher") &&
      !form.refId.trim()
    ) {
      toast("Staff ID is required — enter the Staff ID created in Teachers & Staff", "error");
      return;
    }
    setBusy(true);
    try {
      // refId for staff-like roles is the manual Staff ID (Staff.employeeId) —
      // the server resolves it to the existing person record and links it.
      await api.users.create(toUserPayload(form));
      toast("User created");
      // Credentials are only shareable at creation time — the API never
      // returns the password again, so surface them in a copy dialog now.
      setCreatedCredential({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        admissionId: form.role === "student" ? form.refId.trim() : null,
        staffId:
          form.role === "staff" || form.role === "class_teacher" || form.role === "teacher"
            ? form.refId.trim()
            : null,
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
    try {
      await api.users.update(selected.id, patch);
      toast("User updated");
      setSelected((prev) => (prev ? { ...prev, ...patch } : prev));
      refresh();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  return (
    <div className="w-full">
      <PageIntro
        eyebrow="School Administration · Access & Security"
        title="Users & Access"
        description={`${total} account${total === 1 ? "" : "s"} in this school. Create accounts, manage status, inspect a User 360°, and restore removed users.`}
        right={
          <Button
            variant="amber"
            onClick={() => {
              setCreating(true);
              resetForm();
            }}
          >
            <Plus size={15} /> New user
          </Button>
        }
      />

      {creating && (
        <Card
          title="Create a school user"
          className="mb-5"
          action={
            <X size={15} className="cursor-pointer text-slate-text/60" onClick={() => setCreating(false)} />
          }
        >
          <form className="space-y-3.5" onSubmit={createUser}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <Input
                required
                placeholder="Full name"
                autoComplete="off"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                required
                type="email"
                placeholder="Email (login)"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Input
                required
                type="password"
                placeholder="Password (min 6 chars)"
                autoComplete="new-password"
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <Select
                required
                value={form.role}
                disabled={form.lockedRefId}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {CREATABLE_ROLES.map((value) => (
                  <option key={value} value={value}>
                    {ROLE_LABELS[value]}
                  </option>
                ))}
              </Select>
              {form.role === "staff" && (
                <>
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
                    <option value={DESIGNATION_CUSTOM}>Other / Custom</option>
                  </Select>
                  {form.designation === DESIGNATION_CUSTOM && (
                    <Input
                      required
                      placeholder="Type custom designation"
                      autoComplete="off"
                      value={form.customDesignation}
                      onChange={(e) => setForm({ ...form, customDesignation: e.target.value })}
                    />
                  )}
                </>
              )}
              {(form.role === "class_teacher" ||
                form.role === "teacher" ||
                form.role === "student") && (
                <>
                   <SearchableSelect
                     options={CLASS_OPTIONS}
                     value={form.className}
                     onChange={(val) => setForm({ ...form, className: val, section: "" })}
                     placeholder="Select class"
                   />
                   <SearchableSelect
                     options={filteredSections}
                     value={form.section}
                     onChange={(val) => setForm({ ...form, section: val })}
                     placeholder="Select section"
                   />
                </>
              )}
              {refField && (
                <RefIdField
                  withLabel={false}
                  field={refField}
                  value={form.refId}
                  onChange={(e) => setForm({ ...form, refId: e.target.value })}
                />
              )}
            </div>
            {form.lockedRefId && (
              <p className="text-[12px] text-slate-text/70 bg-paper border border-black/[0.06] rounded-lg px-3 py-2">
                This account is locked to the pre-created person record —{" "}
                {form.role === "student"
                  ? `Admission ID "${form.refId}" and role`
                  : `Staff ID "${form.refId}" and role`}{" "}
                cannot be changed here.
              </p>
            )}
            {(form.role === "staff" ||
              form.role === "class_teacher" ||
              form.role === "teacher") &&
              !form.lockedRefId && (
                <p className="text-[12px] text-slate-text/70 bg-paper border border-black/[0.06] rounded-lg px-3 py-2">
                  <Link2 size={12} className="inline -mt-0.5 mr-1" />
                  Enter the Staff ID created in{" "}
                  <span className="font-medium text-ink">Teachers &amp; Staff</span>. This
                  links the account to that person record — no staff record is
                  created here. If you don't have one yet, add the staff member
                  there first.
                </p>
              )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button variant="amber" type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create user"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <SegmentedTabs
        tabs={TABS({ total, pendingTotal, pendingStaffTotal })}
        active={tab}
        onChange={(next) => {
          setTab(next);
          setPage(1);
          setPendingPage(1);
          setPendingStaffPage(1);
        }}
      />

      {tab === "students" && (
      <Card
        title="Pending student registrations"
        className="mb-5"
        action={
          pendingTotal > 0 ? (
            <Pill tone="amber">{pendingTotal} awaiting an account</Pill>
          ) : (
            <Pill tone="success">queue clear</Pill>
          )
        }
      >
        {pendingLoading ? (
          <p className="text-[13px] text-slate-text/70 py-6 text-center">
            Loading pending registrations…
          </p>
        ) : pendingRows.length === 0 ? (
          <div className="py-4">
            <p className="text-[13px] text-slate-text/70">
              Every confirmed admission produces a student shell here. Register a
              user to link the shell to a login account — afterwards it moves to
              the onboarding queue on the Students page.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[11.5px] uppercase tracking-wide text-slate-text/60 border-b border-black/[0.06]">
                  <th className="py-2.5 pr-4 font-semibold">Student</th>
                  <th className="py-2.5 pr-4 font-semibold">Admission ID</th>
                  <th className="py-2.5 pr-4 font-semibold">Class / Section</th>
                  <th className="py-2.5 pr-4 font-semibold">Profile</th>
                  <th className="py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05]">
                {pendingRows.map((shell) => (
                  <tr key={shell._id} className="hover:bg-paper/60">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-ink">{shell.name}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="font-mono text-[12.5px] text-slate-text/80">
                        {shell.admissionNo}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-text/80">
                      {shell.class ? `${shell.class}${shell.section ? `-${shell.section}` : ""}` : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <Pill tone="amber">awaiting registration</Pill>
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => setViewingPending(shell)}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-info bg-info/10 px-2.5 py-1.5 rounded-lg hover:bg-info/20"
                        >
                          <Eye size={13} /> View
                        </button>
                        <button
                          onClick={() => registerPending(shell)}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink bg-paper px-2.5 py-1.5 rounded-lg hover:bg-black/5"
                        >
                          <Plus size={13} /> Register User
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={pendingPage} pages={pendingPages} onPage={setPendingPage} />
      </Card>
      )}

      {tab === "teachers" && (
      <Card
        title="Pending teacher registrations"
        className="mb-5"
        action={
          pendingStaffTotal > 0 ? (
            <Pill tone="amber">{pendingStaffTotal} awaiting an account</Pill>
          ) : (
            <Pill tone="success">queue clear</Pill>
          )
        }
      >
        {pendingStaffLoading ? (
          <p className="text-[13px] text-slate-text/70 py-6 text-center">
            Loading pending teacher registrations…
          </p>
        ) : pendingStaff.length === 0 ? (
          <div className="py-4">
            <p className="text-[13px] text-slate-text/70">
              Teachers are created in{" "}
              <span className="font-medium text-ink">Teachers &amp; Staff</span>{" "}
              (Staff ID is entered manually there — never generated). They
              appear here until you register their login. Registering a user
              links the person record to an account; afterwards the profile
              completion and ID card flow is two-way — from this page or the
              teacher's My Profile.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[11.5px] uppercase tracking-wide text-slate-text/60 border-b border-black/[0.06]">
                  <th className="py-2.5 pr-4 font-semibold">Teacher</th>
                  <th className="py-2.5 pr-4 font-semibold">Staff ID</th>
                  <th className="py-2.5 pr-4 font-semibold">Class / Section</th>
                  <th className="py-2.5 pr-4 font-semibold">Profile</th>
                  <th className="py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05]">
                {pendingStaff.map((teacher) => {
                  const first =
                    Array.isArray(teacher.classesAssigned) && teacher.classesAssigned.length
                      ? teacher.classesAssigned[0]
                      : {};
                  return (
                    <tr key={teacher._id || teacher.id} className="hover:bg-paper/60">
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-ink">{teacher.name}</p>
                        {teacher.designation && (
                          <p className="text-[11.5px] text-slate-text/55">{teacher.designation}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-[12.5px] text-slate-text/80">
                          {teacher.employeeId}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-text/80">
                        {first.class
                          ? `${first.class}${first.section ? `-${first.section}` : ""}`
                          : "—"}
                      </td>
                      <td className="py-3 pr-4">
                        {teacher.profileStatus === "complete" ? (
                          <Pill tone="success">complete</Pill>
                        ) : (
                          <Pill tone="neutral">awaits completion</Pill>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setViewingStaffPending(teacher)}
                            className="inline-flex items-center gap-1 text-[12px] font-semibold text-info bg-info/10 px-2.5 py-1.5 rounded-lg hover:bg-info/20"
                          >
                            <Eye size={13} /> View
                          </button>
                          <button
                            onClick={() => registerPendingStaff(teacher)}
                            className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink bg-paper px-2.5 py-1.5 rounded-lg hover:bg-black/5"
                          >
                            <Plus size={13} /> Register User
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={pendingStaffPage} pages={pendingStaffPages} onPage={setPendingStaffPage} />
      </Card>
      )}

      {tab === "accounts" && (
      <Card bodyClassName="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_11rem] lg:grid-cols-[1fr_11rem_auto] items-center gap-3 mb-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/50" />
            <Input
              placeholder="Search name, email or ID"
              className="pl-9"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }} className="w-full">
            <option value="">All roles</option>
            {Object.entries(ROLE_LABELS)
              .filter(([value]) => value !== "super_admin")
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </Select>
          <div className="flex items-center gap-3 justify-between sm:justify-end">
            <label className="flex items-center gap-2 text-[13px] text-slate-text cursor-pointer select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(event) => {
                  setIncludeDeleted(event.target.checked);
                  setPage(1);
                }}
                className="accent-ink"
              />
              Include removed
            </label>
            {(q.trim() || role || includeDeleted) && (
              <button
                onClick={() => {
                  setQ("");
                  setRole("");
                  setIncludeDeleted(false);
                  setPage(1);
                }}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink bg-paper px-3 py-2 rounded-lg border border-black/[0.06] hover:bg-alert/10 hover:text-alert transition-colors whitespace-nowrap"
              >
                <FilterX size={13} /> Reset
              </button>
            )}
          </div>
        </div>

        {!loading && (
          <p className="text-[12px] text-slate-text/60 mb-3">
            Showing {rows.length} of {total} account{total === 1 ? "" : "s"}
            {role ? ` · ${(ROLE_LABELS[role] || role).toLowerCase()}` : ""}
            {includeDeleted ? " · incl. removed" : ""}
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
                  <th className="py-2.5 pr-4 font-semibold">Class / Section</th>
                  <th className="py-2.5 pr-4 font-semibold">Last login</th>
                  <th className="py-2.5 pr-4 font-semibold">Status</th>
                  <th className="py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05]">
                {rows.map((user) => (
                  <tr key={user.id} className={user.deletedAt ? "opacity-60" : "hover:bg-paper/60"}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-ink text-amber flex items-center justify-center text-[11px] font-semibold shrink-0">
                          {initials(user.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-ink truncate">{user.name}</p>
                          <p className="text-[11.5px] text-slate-text/60 truncate">
                            {user.email}
                            {user.designation && (
                              <span className="text-slate-text/45">
                                {" "}· {DESIGNATION_LABELS[user.designation] || user.designation}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <Pill tone="info">{ROLE_LABELS[user.role] || user.role}</Pill>
                    </td>
                    <td className="py-3 pr-4 text-slate-text/80">
                      {user.class ? `${user.class}${user.section ? `-${user.section}` : ""}` : "—"}
                    </td>
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
                          onClick={() => setSelected(user)}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-info bg-info/10 px-2.5 py-1.5 rounded-lg hover:bg-info/20"
                          title="User 360°"
                        >
                          <Eye size={13} /> 360°
                        </button>
                        {canManage(user) &&
                          (user.deletedAt ? (
                            <button
                              onClick={() => restoreUser(user)}
                              className="inline-flex items-center text-[12px] font-semibold text-ink bg-paper px-2.5 py-1.5 rounded-lg hover:bg-black/5"
                            >
                              <RotateCcw size={13} /> Restore
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => resetPassword(user)}
                                className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink bg-paper px-2.5 py-1.5 rounded-lg hover:bg-black/5"
                                title="Generate one-time password reset link"
                              >
                                <KeyRound size={13} /> Reset password
                              </button>
                              <button
                                onClick={() => toggleActive(user)}
                                className="inline-flex items-center text-[12px] font-semibold text-ink bg-paper px-2.5 py-1.5 rounded-lg hover:bg-black/5"
                              >
                                {user.isActive ? <Ban size={13} /> : <CheckCircle2 size={13} />}
                                {user.isActive ? " Deactivate" : " Activate"}
                              </button>
                              <button
                                onClick={() => removeUser(user)}
                                className="inline-flex items-center text-[12px] font-semibold text-alert bg-paper px-2.5 py-1.5 rounded-lg hover:bg-alert/10"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={page} pages={pages} onPage={setPage} />
      </Card>
      )}

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
                  onClick={() => {
                    navigator.clipboard?.writeText(createdCredential.email);
                    toast("Email copied");
                  }}
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
                    onClick={() => {
                      navigator.clipboard?.writeText(createdCredential.admissionId);
                      toast("Admission ID copied");
                    }}
                    className="text-[12px] font-semibold text-info bg-info/10 px-2.5 py-1.5 rounded-lg hover:bg-info/20 shrink-0"
                  >
                    Copy
                  </button>
                </div>
              )}
              {createdCredential.staffId && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-black/10 px-3.5 py-2.5">
                  <div>
                    <p className="text-[11px] text-slate-text/60 font-semibold uppercase">Staff ID</p>
                    <p className="text-ink font-medium">{createdCredential.staffId}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(createdCredential.staffId);
                      toast("Staff ID copied");
                    }}
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
                  onClick={() => {
                    navigator.clipboard?.writeText(createdCredential.password);
                    toast("Password copied");
                  }}
                  className="text-[12px] font-semibold text-info bg-info/10 px-2.5 py-1.5 rounded-lg hover:bg-info/20 shrink-0"
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button variant="amber" onClick={() => setCreatedCredential(null)}>
                Done
              </Button>
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
              user={selected}
              canManage={canManage(selected)}
              onClose={() => setSelected(null)}
              onToggleActive={toggleActive}
              onRemove={removeUser}
              onRestore={restoreUser}
              onReset={resetPassword}
              onEdit={editSelected}
              busy={busy}
            />
          </div>
        </div>
      )}

      {viewingPending && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
          onClick={() => setViewingPending(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-ink text-lg">
                Pending student
              </h3>
              <button
                onClick={() => setViewingPending(null)}
                className="text-slate-text/60 hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-[12.5px] text-slate-text/70 mb-4">
              Created when this admission was confirmed. Registering a user links
              this shell to a login account; until then it cannot sign in.
            </p>
            <div className="space-y-2.5 text-[13px]">
              <div className="rounded-xl border border-black/10 px-3.5 py-2.5">
                <p className="text-[11px] text-slate-text/60 font-semibold uppercase">Student</p>
                <p className="text-ink font-medium">{viewingPending.name}</p>
              </div>
              <div className="rounded-xl border border-black/10 px-3.5 py-2.5">
                <p className="text-[11px] text-slate-text/60 font-semibold uppercase">Admission ID</p>
                <p className="font-mono text-ink font-medium">{viewingPending.admissionNo}</p>
              </div>
              <div className="rounded-xl border border-black/10 px-3.5 py-2.5">
                <p className="text-[11px] text-slate-text/60 font-semibold uppercase">Class / Section</p>
                <p className="text-ink font-medium">
                  {viewingPending.class
                    ? `${viewingPending.class}${viewingPending.section ? `-${viewingPending.section}` : ""}`
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-black/10 px-3.5 py-2.5">
                <p className="text-[11px] text-slate-text/60 font-semibold uppercase">Status</p>
                <Pill tone="amber">awaiting registration</Pill>
              </div>
              <div className="rounded-xl border border-black/10 px-3.5 py-2.5">
                <p className="text-[11px] text-slate-text/60 font-semibold uppercase">Confirmed on</p>
                <p className="text-ink font-medium">{fmtDate(viewingPending.createdAt)}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setViewingPending(null)}>
                Close
              </Button>
              <Button variant="amber" onClick={() => { setViewingPending(null); registerPending(viewingPending); }}>
                Register User
              </Button>
            </div>
          </div>
        </div>
      )}

      {viewingStaffPending && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
          onClick={() => setViewingStaffPending(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-ink text-lg">
                Pending teacher
              </h3>
              <button
                onClick={() => setViewingStaffPending(null)}
                className="text-slate-text/60 hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-[12.5px] text-slate-text/70 mb-4">
              Created on the Teachers &amp; Staff page. Registering a user links
              this person record to a login account; until then it cannot sign in.
            </p>
            <div className="space-y-2.5 text-[13px]">
              <div className="rounded-xl border border-black/10 px-3.5 py-2.5">
                <p className="text-[11px] text-slate-text/60 font-semibold uppercase">Teacher</p>
                <p className="text-ink font-medium">{viewingStaffPending.name}</p>
              </div>
              <div className="rounded-xl border border-black/10 px-3.5 py-2.5">
                <p className="text-[11px] text-slate-text/60 font-semibold uppercase">Staff ID</p>
                <p className="font-mono text-ink font-medium">{viewingStaffPending.employeeId}</p>
              </div>
              {viewingStaffPending.designation && (
                <div className="rounded-xl border border-black/10 px-3.5 py-2.5">
                  <p className="text-[11px] text-slate-text/60 font-semibold uppercase">Designation</p>
                  <p className="text-ink font-medium">{viewingStaffPending.designation}</p>
                </div>
              )}
              <div className="rounded-xl border border-black/10 px-3.5 py-2.5">
                <p className="text-[11px] text-slate-text/60 font-semibold uppercase">Class / Section</p>
                <p className="text-ink font-medium">
                  {(() => {
                    const c =
                      Array.isArray(viewingStaffPending.classesAssigned) &&
                      viewingStaffPending.classesAssigned.length
                        ? viewingStaffPending.classesAssigned[0]
                        : {};
                    return c.class
                      ? `${c.class}${c.section ? `-${c.section}` : ""}`
                      : "—";
                  })()}
                </p>
              </div>
              <div className="rounded-xl border border-black/10 px-3.5 py-2.5">
                <p className="text-[11px] text-slate-text/60 font-semibold uppercase">Profile</p>
                {viewingStaffPending.profileStatus === "complete" ? (
                  <Pill tone="success">complete</Pill>
                ) : (
                  <Pill tone="neutral">awaits completion</Pill>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setViewingStaffPending(null)}>
                Close
              </Button>
              <Button
                variant="amber"
                onClick={() => {
                  setViewingStaffPending(null);
                  registerPendingStaff(viewingStaffPending);
                }}
              >
                Register User
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function User360({ user, canManage, onClose, onToggleActive, onRemove, onRestore, onReset, onEdit, busy }) {
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
            <Button variant="outline" onClick={() => setEdit(false)}>
              Cancel
            </Button>
            <Button
              variant="amber"
              disabled={busy}
              onClick={() =>
                onEdit({
                  name: draft.name,
                  phone: draft.phone || undefined,
                  designation: draft.designation || undefined,
                  class: draft.class || undefined,
                  section: draft.section || undefined,
                  refId: refField && !refField.disabled ? draft.refId || undefined : undefined,
                }).then(saved)
              }
            >
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 text-[13px] mb-5">
          <div>
            <p className="text-[11.5px] text-slate-text/60 font-semibold uppercase">Role</p>
            <p className="text-ink capitalize">{user.role.replace("_", " ")}</p>
          </div>
          <div>
            <p className="text-[11.5px] text-slate-text/60 font-semibold uppercase">Designation</p>
            <p className="text-ink">{DESIGNATION_LABELS[user.designation] || user.designation || "—"}</p>
          </div>
          {user.class && (
            <div>
              <p className="text-[11.5px] text-slate-text/60 font-semibold uppercase">Class</p>
              <p className="text-ink">
                {user.class}
                {user.section ? `-${user.section}` : ""}
              </p>
            </div>
          )}
          {refField && user.refId && (
            <div>
              <p className="text-[11.5px] text-slate-text/60 font-semibold uppercase">{refField.label}</p>
              <p className="text-ink">{user.refId}</p>
            </div>
          )}
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
        {canManage && !edit && !user.deletedAt && (
          <Button variant="outline" onClick={() => setEdit(true)}>
            Edit profile
          </Button>
        )}
        {canManage &&
          (user.deletedAt ? (
            <Button variant="amber" disabled={busy} onClick={() => onRestore(user).then(onClose)}>
              <RotateCcw size={15} /> Restore
            </Button>
          ) : (
            <>
              <Button variant="outline" disabled={busy} onClick={() => onToggleActive(user)}>
                {user.isActive ? <Ban size={15} /> : <CheckCircle2 size={15} />} {user.isActive ? "Deactivate" : "Activate"}
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => onReset(user)}>
                <KeyRound size={15} /> Reset password
              </Button>
              <Button variant="outline" className="text-alert hover:bg-alert/10" disabled={busy} onClick={() => onRemove(user)}>
                <Trash2 size={15} /> Remove
              </Button>
            </>
          ))}
        {!canManage && (
          <p className="text-[12px] text-slate-text/60">
            Other school admins are read-only — only a Platform Owner can manage them.
          </p>
        )}
      </div>
    </div>
  );
}