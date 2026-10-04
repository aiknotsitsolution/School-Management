import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { api } from "../lib/api";
import { selectSchool } from "../store/selectors";
import { sessionLabel } from "../lib/session";
import {
  Plus,
  Briefcase,
  Search,
  Calendar,
  User,
  X,
  Save,
  CheckCircle2,
  Clock,
  ArrowUpCircle,
  Link2,
  Pencil,
  Trash2,
  GraduationCap,
  AlertCircle,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Select,
  Input,
  Pill,
  StatCard,
  toast,
} from "../components/UI";
import SearchableSelect from "../components/SearchableSelect";
import { SegmentedTabs } from "../components/Pagination";
import { useMasterOptions } from "../hooks/useMasterOptions";

const CLASS_OPTIONS_FALLBACK = [
  "Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11-Sci", "11-Com", "12-Sci", "12-Com",
];
const SECTION_OPTIONS_FALLBACK = ["A", "B", "C"];
const SUBJECT_SUGGESTIONS_FALLBACK = [
  "Mathematics", "English", "Science", "Hindi", "Social Science", "Computer Science",
  "Physics", "Chemistry", "Biology", "Accountancy", "Business Studies", "Economics", "Physical Education",
];

const ROLE_LABELS = { teacher: "Teacher", staff: "Staff" };

// Two audiences, one page. Duties (who teaches what) only exist for teachers;
// non-teaching staff only ever receive tasks. The field is `id`, not `key`:
// SegmentedTabs reads `tab.id` for both the active check and onChange, so a
// `key` here silently renders no active pill and writes `?tab=undefined`.
const TABS = [
  { id: "teacher", label: "Teacher", icon: GraduationCap },
  { id: "staff", label: "Other Staff", icon: Briefcase },
];

const STATUS_OPTIONS = ["All", "Pending", "In Progress", "Completed", "Overdue"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High"];
const DUE_OPTIONS = ["All", "Overdue", "Next 7 days"];

// Work statuses only — `statusTone` in UI.jsx doesn't cover these, and mapping
// them locally keeps the shared helper untouched for every other page.
const WORK_TONES = {
  Pending: "warning",
  "In Progress": "info",
  Completed: "success",
  Overdue: "alert",
};
const workTone = (status) => WORK_TONES[status] || "neutral";

// Filter value -> label. "duty" is only offerable on the Teacher tab.
const TYPE_LABELS = { duty: "Academic duty", teaching: "Teaching", external: "External" };
const TYPE_TONES = { duty: "primary", teaching: "info", external: "warning" };

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function subLabel(sub) {
  if (["Nursery", "LKG", "UKG"].includes(sub)) return sub;
  return `Class ${sub}`;
}

function normalizeItem(item) {
  const dueDate = item.dueDate;
  const isOverdue = dueDate && new Date(dueDate) < new Date() && item.status !== "Completed";
  const base = item.status || "Pending";
  return {
    ...item,
    id: item._id || item.id,
    assignedTo: item.assignedTo || "Unassigned",
    assignedToRole: item.assignedToRole || "",
    priority: item.priority || "Medium",
    // Rows written before teaching/external was split carry no category; they
    // land in the neutral bucket rather than being guessed into either.
    category: item.category || "external",
    status: isOverdue && base === "Pending" ? "Overdue" : base,
  };
}

function emptyForm() {
  return {
    title: "",
    description: "",
    assignedTo: "",
    category: "teaching",
    priority: "Medium",
    dueDate: "",
    status: "Pending",
  };
}

function emptyDutyForm(session) {
  return {
    staffId: "",
    staffName: "",
    session: session || "",
    type: "teaching",
    subject: "",
    class: "",
    section: "A",
  };
}

// Both kinds of work collapse into ONE row shape, so a single filter bar can
// search, narrow and count them together. A duty simply has no due date,
// priority or progress status — it is Active or Ended.
function taskRow(h) {
  return {
    key: `task-${h.id}`,
    kind: "task",
    id: h.id,
    category: h.category,
    title: h.title,
    description: h.description || "",
    assignee: h.assignedTo,
    role: h.assignedToRole,
    detail: h.dueDate ? `Due ${formatDate(h.dueDate)}` : "No deadline",
    dueDate: h.dueDate || null,
    priority: h.priority,
    status: h.status,
    raw: h,
  };
}

function dutyRow(a) {
  const scope = `${subLabel(a.class)}-${a.section}`;
  return {
    key: `duty-${a._id}`,
    kind: "duty",
    id: a._id,
    category: "duty",
    title:
      a.type === "class_teacher"
        ? `${scope} · Class Teacher`
        : `${a.subject || "Teaching"} · ${scope}`,
    description: "",
    assignee: a.staffName || "",
    role: "teacher",
    detail: `Session ${a.session || "—"}`,
    dueDate: null,
    priority: null,
    status: a.status === "active" ? "Active" : "Ended",
    raw: a,
  };
}

export default function Homework() {
  const school = useSelector(selectSchool);
  const session = sessionLabel(school) || String(new Date().getFullYear());
  const { options: CLASS_OPTIONS } = useMasterOptions("classes", CLASS_OPTIONS_FALLBACK);
  const { options: SECTION_OPTIONS, rawItems: rawSections } = useMasterOptions(
    "sections",
    SECTION_OPTIONS_FALLBACK
  );
  const { options: SUBJECT_SUGGESTIONS } = useMasterOptions("subjects", SUBJECT_SUGGESTIONS_FALLBACK);

  // The active tab lives in the URL so the Add Staff assign icon can deep-link
  // straight into it (?tab=teacher&staff=<id>) instead of opening a blank form.
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "staff" ? "staff" : "teacher";

  const [items, setItems] = useState([]);
  const [duties, setDuties] = useState([]);
  const [users, setUsers] = useState([]);
  const [staffList, setStaffList] = useState([]);

  // One filter bar drives both kinds of work.
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [dueFilter, setDueFilter] = useState("All");

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);

  const [showDutyModal, setShowDutyModal] = useState(false);
  const [dutyForm, setDutyForm] = useState(emptyDutyForm(session));
  const [dutyError, setDutyError] = useState("");

  const reload = () => {
    api.homework
      .list("assignType=staff")
      .then(({ data }) => setItems((data || []).map(normalizeItem)))
      .catch((err) => toast(err.message || "Couldn't load assigned work", "error"));
    api.assignments
      .list()
      .then(({ data }) => setDuties(data || []))
      .catch(() => {});
  };

  useEffect(() => {
    reload();
    api.users
      .list()
      .then(({ data }) => {
        const list = (data || []).filter(
          (u) => ["teacher", "staff"].includes(u.role) && u.isActive !== false
        );
        setUsers(list);
      })
      .catch(() => {});
    api.staff
      .list()
      .then(({ data }) =>
        setStaffList((data || []).map((s) => ({ ...s, id: s._id || s.id })))
      )
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userOptions = useMemo(
    () => users.map((u) => `${u.name} (${ROLE_LABELS[u.role] || u.role})`),
    [users]
  );

  // Only teachers can hold an academic duty, so the duty picker is teacher-only.
  const teacherStaff = useMemo(() => staffList.filter((s) => s.role === "teacher"), [staffList]);
  const dutyLabel = (s) => `${s.name} (${s.employeeId || s.designation || "Teacher"})`;
  const dutyOptions = useMemo(() => teacherStaff.map(dutyLabel), [teacherStaff]);

  const selectTab = (key) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", key);
    next.delete("staff");
    setSearchParams(next, { replace: true });
    // "Academic duty" doesn't exist off the Teacher tab — carrying it over
    // would leave the staff list with nothing in it.
    if (typeFilter === "duty") setTypeFilter("All");
  };

  const openDuty = (person) => {
    setDutyError("");
    setDutyForm({
      ...emptyDutyForm(session),
      staffId: person ? person.id : "",
      staffName: person ? dutyLabel(person) : "",
    });
    setShowDutyModal(true);
  };

  // Add Staff's assign icon lands here as ?tab=teacher&staff=<id>. The param is
  // consumed after a successful open so a refresh doesn't re-open the modal.
  useEffect(() => {
    const staffId = searchParams.get("staff");
    if (!staffId || !staffList.length) return;
    const person = staffList.find((s) => String(s.id) === String(staffId));
    if (!person) return;
    openDuty(person);
    const next = new URLSearchParams(searchParams);
    next.delete("staff");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, staffList]);

  const tabTasks = useMemo(
    () =>
      items.filter((h) =>
        tab === "teacher" ? h.assignedToRole === "teacher" : h.assignedToRole !== "teacher"
      ),
    [items, tab]
  );

  const tabDuties = useMemo(
    () => (tab === "teacher" ? duties : []),
    [duties, tab]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    const soon = now + 7 * 864e5;
    return [...tabDuties.map(dutyRow), ...tabTasks.map(taskRow)]
      .filter((r) => {
        if (typeFilter !== "All" && r.category !== typeFilter) return false;
        // Status, priority and deadline only describe TASKS. Choosing any of
        // them narrows the view to tasks alone — a duty has none of those
        // fields, and pretending otherwise would mean showing empty columns.
        if (statusFilter !== "All" && (r.kind !== "task" || r.status !== statusFilter)) return false;
        if (priorityFilter !== "All" && (r.kind !== "task" || r.priority !== priorityFilter))
          return false;
        if (dueFilter !== "All") {
          if (r.kind !== "task" || !r.dueDate) return false;
          const t = new Date(r.dueDate).getTime();
          if (dueFilter === "Overdue" && !(t < now && r.status !== "Completed")) return false;
          if (dueFilter === "Next 7 days" && !(t >= now && t <= soon)) return false;
        }
        if (q) {
          const hay = [r.title, r.description, r.assignee, r.detail, TYPE_LABELS[r.category]]
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "duty" ? -1 : 1;
        if (a.kind === "task" && b.kind === "task") {
          return new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
        }
        return 0;
      });
  }, [tabTasks, tabDuties, query, typeFilter, statusFilter, priorityFilter, dueFilter]);

  const counts = useMemo(() => {
    const c = { total: tabTasks.length, Pending: 0, "In Progress": 0, Completed: 0, Overdue: 0 };
    tabTasks.forEach((h) => {
      if (c[h.status] !== undefined) c[h.status]++;
    });
    return c;
  }, [tabTasks]);

  const activeDuties = useMemo(() => tabDuties.filter((d) => d.status === "active").length, [tabDuties]);

  const filtersActive =
    query.trim() !== "" ||
    typeFilter !== "All" ||
    statusFilter !== "All" ||
    priorityFilter !== "All" ||
    dueFilter !== "All";

  const clearFilters = () => {
    setQuery("");
    setTypeFilter("All");
    setStatusFilter("All");
    setPriorityFilter("All");
    setDueFilter("All");
  };

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setForm({
      title: item.title || "",
      description: item.description || "",
      assignedTo: item.assignedTo || "",
      category: item.category || "external",
      priority: item.priority || "Medium",
      dueDate: item.dueDate ? item.dueDate.slice(0, 10) : "",
      status: ["Pending", "In Progress", "Completed"].includes(item.status) ? item.status : "Pending",
    });
    setShowModal(true);
  };

  const updateForm = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const selectedUser = useMemo(
    () => users.find((u) => `${u.name} (${ROLE_LABELS[u.role] || u.role})` === form.assignedTo),
    [users, form.assignedTo]
  );
  const assigneeIsTeacher = selectedUser?.role === "teacher";

  const handleSave = async () => {
    if (!form.title.trim() || !form.dueDate || !form.assignedTo.trim()) {
      toast("Title, due date and assignee are required", "error");
      return;
    }
    const payload = {
      assignType: "staff",
      title: form.title.trim(),
      description: form.description.trim(),
      assignedTo: form.assignedTo.trim(),
      assignedToRole: selectedUser ? selectedUser.role : "",
      assignedToUserId: selectedUser ? selectedUser.id || selectedUser._id : "",
      // "Teaching" only means anything for a teacher; work handed to
      // non-teaching staff is external by definition.
      category: assigneeIsTeacher ? form.category : "external",
      priority: form.priority,
      dueDate: form.dueDate,
      status: form.status,
      class: "staff",
      section: form.assignedTo.trim(),
      subject: form.title.trim(),
    };
    try {
      const isEdit = !!editId;
      const response = isEdit
        ? await api.homework.update(editId, payload)
        : await api.homework.create(payload);
      const savedItem = normalizeItem(response.data);
      setItems((prev) =>
        isEdit ? prev.map((item) => (item.id === editId ? savedItem : item)) : [savedItem, ...prev]
      );
      setShowModal(false);
      setForm(emptyForm());
      setEditId(null);
      toast(isEdit ? "Task updated successfully" : "Task assigned successfully");
    } catch (err) {
      toast(err.message || "Failed to save task", "error");
    }
  };

  const changeStatus = async (id, newStatus) => {
    const oldStatus = items.find((h) => h.id === id)?.status;
    setItems((prev) => prev.map((h) => (h.id === id ? { ...h, status: newStatus } : h)));
    try {
      await api.homework.update(id, { status: newStatus });
    } catch (err) {
      setItems((prev) =>
        prev.map((h) => (h.id === id ? { ...h, status: oldStatus ?? h.status } : h))
      );
      toast(err.message || "Failed to update status", "error");
    }
  };

  const removeTask = async (id) => {
    const backup = items;
    setItems((prev) => prev.filter((h) => h.id !== id));
    try {
      await api.homework.remove(id);
      toast("Task removed");
    } catch (err) {
      setItems(backup);
      toast(err.message || "Failed to remove task", "error");
    }
  };

  const handleCreateDuty = async () => {
    const { staffId, type, subject, class: cls, section: sec } = dutyForm;
    if (!staffId) {
      setDutyError("Select a teacher");
      return;
    }
    if (!dutyForm.session || !cls) {
      setDutyError("Session, class and section are required");
      return;
    }
    if (type === "teaching" && !subject.trim()) {
      setDutyError("Subject is required for a teaching assignment");
      return;
    }
    try {
      await api.assignments.create({
        staffId,
        session: dutyForm.session.trim(),
        type,
        ...(type === "teaching" ? { subject: subject.trim() } : {}),
        class: cls,
        section: sec,
      });
      toast("Academic duty assigned");
      setShowDutyModal(false);
      setDutyError("");
      setDutyForm(emptyDutyForm(session));
      reload();
    } catch (error) {
      setDutyError(error.message);
    }
  };

  const endDuty = async (assignment) => {
    try {
      await api.assignments.end(assignment._id);
      toast("Duty ended; history preserved");
      reload();
    } catch (error) {
      toast(error.message, "error");
    }
  };

  const filteredSections = useMemo(() => {
    if (!dutyForm.class) return SECTION_OPTIONS;
    return [...new Set(rawSections.filter((s) => s.className === dutyForm.class).map((s) => s.name))];
  }, [dutyForm.class, SECTION_OPTIONS, rawSections]);

  const typeOptions =
    tab === "teacher"
      ? [
          ["All", "All types"],
          ["duty", "Academic duty"],
          ["teaching", "Teaching"],
          ["external", "External"],
        ]
      : [
          ["All", "All types"],
          ["teaching", "Teaching"],
          ["external", "External"],
        ];

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Human Resources"
        title="Assign Work"
        description="Teaching duties, external work and day-to-day tasks — assigned to teachers and staff from one place."
        right={
          <div className="flex flex-wrap gap-2">
            {tab === "teacher" && (
              <Button variant="outline" onClick={() => openDuty(null)}>
                <Link2 size={15} /> Academic duty
              </Button>
            )}
            <Button variant="primary" onClick={openAdd}>
              <Plus size={15} /> Assign work
            </Button>
          </div>
        }
      />

      <SegmentedTabs
        tabs={TABS.map((t) => ({
          ...t,
          count:
            t.id === "teacher"
              ? items.filter((h) => h.assignedToRole === "teacher").length + duties.length
              : items.filter((h) => h.assignedToRole !== "teacher").length,
        }))}
        active={tab}
        onChange={selectTab}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Briefcase} label="Total Tasks" value={String(counts.total)} sub="All assignments" accent="info" />
        <StatCard icon={Clock} label="Pending" value={String(counts.Pending)} sub="Not yet started" accent="primary" />
        <StatCard icon={ArrowUpCircle} label="In Progress" value={String(counts["In Progress"])} sub="Currently active" accent="info" />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={String(counts.Completed + counts.Overdue)}
          sub={
            tab === "teacher"
              ? `${counts.Completed} done · ${activeDuties} active duties`
              : `${counts.Completed} done · ${counts.Overdue} overdue`
          }
          accent="success"
        />
      </div>

      <Card title={tab === "teacher" ? "Teacher Work" : "Other Staff Work"}>
        {/* Smart filter — one bar narrows both work kinds at once. */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40" />
            <Input
              placeholder="Search work, person, class..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="min-w-[140px]">
            {typeOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="min-w-[125px]">
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === "All" ? "All Status" : s}</option>
            ))}
          </Select>
          <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="min-w-[120px]">
            {["All", ...PRIORITY_OPTIONS].map((p) => (
              <option key={p} value={p}>{p === "All" ? "All Priority" : p}</option>
            ))}
          </Select>
          <Select value={dueFilter} onChange={(e) => setDueFilter(e.target.value)} className="min-w-[130px]">
            {DUE_OPTIONS.map((d) => (
              <option key={d} value={d}>{d === "All" ? "Any Deadline" : d}</option>
            ))}
          </Select>
          {filtersActive && (
            <button
              onClick={clearFilters}
              className="text-[12.5px] font-semibold text-info hover:underline px-1"
            >
              Clear
            </button>
          )}
          <span className="text-[12.5px] text-slate-text/60 ml-auto">
            {filtered.length} {filtered.length === 1 ? "item" : "items"}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-14 text-center">
            <Briefcase size={36} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[14px] font-medium text-ink">
              {filtersActive ? "Nothing matches these filters" : "No work assigned yet"}
            </p>
            <p className="text-[13px] text-slate-text/60 mt-1">
              {filtersActive
                ? "Try widening the search or clearing the filters."
                : tab === "teacher"
                ? "Assign a teaching duty or a task to a teacher to get started."
                : "Assign tasks to your support staff to get started."}
            </p>
            {!filtersActive && (
              <Button variant="primary" className="mt-4" onClick={openAdd}>
                <Plus size={15} /> Assign work
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <div
                key={r.key}
                className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-paper/40 transition-colors"
              >
                <div
                  className={
                    r.kind === "duty"
                      ? "w-11 h-11 rounded-xl bg-primary/10 text-primary-dark flex items-center justify-center shrink-0"
                      : "w-11 h-11 rounded-xl bg-info/15 text-info flex items-center justify-center shrink-0"
                  }
                >
                  {r.kind === "duty" ? <Link2 size={20} /> : <Briefcase size={20} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-semibold text-ink">{r.title}</p>
                    <Pill tone={TYPE_TONES[r.category] || "neutral"}>{TYPE_LABELS[r.category]}</Pill>
                    <Pill tone={workTone(r.status)}>{r.status}</Pill>
                    {r.kind === "task" && (
                      <Pill tone={r.priority === "High" ? "alert" : r.priority === "Low" ? "success" : "info"}>
                        {r.priority}
                      </Pill>
                    )}
                  </div>
                  {r.description && (
                    <p className="text-[13px] text-ink/70 mt-1 leading-snug line-clamp-2">{r.description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12px] text-slate-text/65">
                    <span className="inline-flex items-center gap-1">
                      <User size={12} /> {r.assignee || "Unassigned"}
                    </span>
                    {r.role && (
                      <span className="inline-flex items-center gap-1 text-info">
                        {ROLE_LABELS[r.role] || r.role}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      {r.kind === "duty" ? <Link2 size={12} /> : <Calendar size={12} />}
                      {r.detail}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 sm:flex-col sm:items-end">
                  {r.kind === "task" ? (
                    <>
                      <Select
                        value={r.status}
                        onChange={(e) => changeStatus(r.id, e.target.value)}
                        className="text-[12px] py-1.5 min-w-[110px]"
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Overdue">Overdue</option>
                      </Select>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(r.raw)}
                          className="p-1.5 rounded-lg hover:bg-paper text-slate-text/60 hover:text-info transition-colors"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => removeTask(r.id)}
                          className="p-1.5 rounded-lg hover:bg-paper text-slate-text/60 hover:text-alert transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </>
                  ) : r.raw.status === "active" ? (
                    <Button
                      variant="outline"
                      className="px-3 py-1.5 text-[12px]"
                      onClick={() => endDuty(r.raw)}
                    >
                      End duty
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Task assignment ─────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  {editId ? "Edit Task" : "Assign Work"}
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  {tab === "teacher"
                    ? "Hand a teacher a teaching or external task."
                    : "Hand a staff member a task."}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-paper text-slate-text">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">Assign To *</label>
                <SearchableSelect
                  options={userOptions}
                  value={form.assignedTo}
                  onChange={(val) => updateForm("assignedTo", val)}
                  placeholder="Select teacher or staff"
                />
              </div>

              {assigneeIsTeacher && (
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Work type</label>
                  <Select value={form.category} onChange={(e) => updateForm("category", e.target.value)}>
                    <option value="teaching">Teaching — part of their regular subject/class load</option>
                    <option value="external">External — anything beyond teaching</option>
                  </Select>
                  <p className="text-[11.5px] text-slate-text/60 mt-1.5">
                    Pick External for duties like admissions desk, events, inspection prep.
                  </p>
                </div>
              )}

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">Title *</label>
                <Input
                  placeholder="e.g. Prepare annual report, Conduct parent meeting..."
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                />
              </div>

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">Description</label>
                <textarea
                  rows={3}
                  placeholder="Optional details about the task..."
                  value={form.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-paper px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-slate-text/40 focus:outline-none focus:ring-2 focus:ring-info/30 focus:border-info/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Priority</label>
                  <Select value={form.priority} onChange={(e) => updateForm("priority", e.target.value)}>
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Status</label>
                  <Select value={form.status} onChange={(e) => updateForm("status", e.target.value)}>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">Due Date *</label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => updateForm("dueDate", e.target.value)}
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={!form.title.trim() || !form.dueDate || !form.assignedTo.trim()}
              >
                <Save size={15} /> {editId ? "Update" : "Assign"} Task
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Academic duty (moved here from the Add Staff row icon) ──────── */}
      {showDutyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setShowDutyModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">Academic Duty</h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  Who teaches what, and who owns a homeroom.
                </p>
              </div>
              <button onClick={() => setShowDutyModal(false)} className="p-2 rounded-lg hover:bg-paper text-slate-text">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {dutyError && (
                <p className="flex items-center gap-2 text-[13px] text-alert">
                  <AlertCircle size={15} /> {dutyError}
                </p>
              )}

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">Teacher *</label>
                <SearchableSelect
                  options={dutyOptions}
                  value={dutyForm.staffName}
                  onChange={(val) =>
                    setDutyForm((f) => ({
                      ...f,
                      staffName: val,
                      staffId: (teacherStaff.find((s) => dutyLabel(s) === val) || {}).id || "",
                    }))
                  }
                  placeholder="Select teacher"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Session</label>
                  <Input
                    value={dutyForm.session}
                    onChange={(e) => setDutyForm((f) => ({ ...f, session: e.target.value }))}
                    placeholder="e.g. 2026-27"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Type</label>
                  <Select
                    value={dutyForm.type}
                    onChange={(e) => setDutyForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full"
                  >
                    <option value="teaching">Teaching</option>
                    <option value="class_teacher">Class Teacher</option>
                  </Select>
                </div>
                {dutyForm.type === "teaching" && (
                  <div className="col-span-2">
                    <label className="text-[12px] font-semibold text-ink mb-1.5 block">Subject *</label>
                    <Input
                      list="subject-suggestions-duty"
                      value={dutyForm.subject}
                      onChange={(e) => setDutyForm((f) => ({ ...f, subject: e.target.value }))}
                      placeholder="e.g. Mathematics"
                    />
                    <datalist id="subject-suggestions-duty">
                      {SUBJECT_SUGGESTIONS.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>
                )}
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Class *</label>
                  <SearchableSelect
                    options={CLASS_OPTIONS}
                    value={dutyForm.class}
                    onChange={(val) => setDutyForm((f) => ({ ...f, class: val, section: "" }))}
                    renderLabel={(c) => subLabel(c)}
                    placeholder="Select class"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Section *</label>
                  <SearchableSelect
                    options={filteredSections}
                    value={dutyForm.section}
                    onChange={(val) => setDutyForm((f) => ({ ...f, section: val }))}
                    renderLabel={(s) => `Section ${s}`}
                    placeholder="Select section"
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDutyModal(false)}>Close</Button>
              <Button variant="primary" onClick={handleCreateDuty}>
                <Plus size={15} /> Add Duty
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
