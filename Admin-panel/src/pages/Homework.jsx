import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
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
  AlertCircle,
  ArrowUpCircle,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Select,
  Input,
  Pill,
  StatCard,
  statusTone,
  toast,
} from "../components/UI";
import SearchableSelect from "../components/SearchableSelect";

const STATUS_OPTIONS = ["All", "Pending", "In Progress", "Completed", "Overdue"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High"];
const ROLE_FILTER_OPTIONS = ["All", "Teacher", "Staff"];
const ROLE_API_MAP = { Teacher: "teacher", Staff: "staff" };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function normalizeItem(item) {
  const dueDate = item.dueDate;
  const isOverdue = dueDate && new Date(dueDate) < new Date() && item.status !== "Completed";
  return {
    ...item,
    id: item._id || item.id,
    assignedTo: item.assignedTo || "Unassigned",
    assignedToRole: item.assignedToRole || "",
    priority: item.priority || "Medium",
    status: item.status || (isOverdue ? "Overdue" : "Pending"),
  };
}

function emptyForm() {
  return {
    title: "",
    description: "",
    assignedTo: "",
    assignedToRole: "",
    priority: "Medium",
    dueDate: "",
    status: "Pending",
  };
}

const ROLE_LABELS = {
  teacher: "Teacher",
  staff: "Staff",
};

export default function Homework() {
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    api.homework
      .list("assignType=staff")
      .then(({ data }) => setItems((data || []).map(normalizeItem)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.users
      .list()
      .then(({ data }) => {
        const list = (data || []).filter(
          (u) => ["teacher", "staff"].includes(u.role) && u.isActive !== false
        );
        setUsers(list);
      })
      .catch(() => {});
  }, []);

  const userOptions = useMemo(
    () => users.map((u) => `${u.name} (${ROLE_LABELS[u.role] || u.role})`),
    [users]
  );

  const filtered = useMemo(() => {
    return items.filter((h) => {
      const matchStatus = statusFilter === "All" || h.status === statusFilter;
      const matchRole =
        roleFilter === "All" ||
        (h.assignedToRole && h.assignedToRole.toLowerCase() === ROLE_API_MAP[roleFilter]);
      const q = query.toLowerCase();
      const matchQuery =
        !q ||
        h.title.toLowerCase().includes(q) ||
        h.assignedTo.toLowerCase().includes(q);
      return matchStatus && matchRole && matchQuery;
    });
  }, [items, statusFilter, roleFilter, query]);

  const counts = useMemo(() => {
    const c = { total: items.length, Pending: 0, "In Progress": 0, Completed: 0, Overdue: 0 };
    items.forEach((h) => {
      if (c[h.status] !== undefined) c[h.status]++;
    });
    return c;
  }, [items]);

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
      assignedToRole: item.assignedToRole || "",
      priority: item.priority || "Medium",
      dueDate: item.dueDate ? item.dueDate.slice(0, 10) : "",
      status: item.status || "Pending",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.dueDate || !form.assignedTo.trim()) {
      toast("Title, due date and audience are required", "error");
      return;
    }

    const matchedUser = users.find(
      (u) => `${u.name} (${ROLE_LABELS[u.role] || u.role})` === form.assignedTo
    );
    const payload = {
      assignType: "staff",
      title: form.title.trim(),
      description: form.description.trim(),
      assignedTo: form.assignedTo.trim(),
      assignedToRole: matchedUser ? matchedUser.role : "",
      assignedToUserId: matchedUser ? (matchedUser.id || matchedUser._id) : "",
      priority: form.priority,
      dueDate: form.dueDate,
      status: form.status,
      class: "staff",
      section: form.assignedTo.trim(),
      subject: form.title.trim(),
    };
    try {
      const isEdit = !!editId;
      const response = editId
        ? await api.homework.update(editId, payload)
        : await api.homework.create(payload);
      const savedItem = normalizeItem(response.data);
      setItems((prev) =>
        editId
          ? prev.map((item) => (item.id === editId ? savedItem : item))
          : [savedItem, ...prev]
      );
      setShowModal(false);
      setForm(emptyForm());
      setEditId(null);
      toast(isEdit ? "Task updated successfully" : "Task assigned successfully");
    } catch (err) {
      toast(err.message || "Failed to save task", "error");
    }
  };

  const changeStatus = (id, newStatus) => {
    setItems((prev) =>
      prev.map((h) => (h.id === id ? { ...h, status: newStatus } : h))
    );
  };

  const updateForm = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Administration"
        title="Assign Work"
        description="Assign tasks and responsibilities to teachers and staff members."
        right={
          <Button variant="amber" onClick={openAdd}>
            <Plus size={15} /> Assign Task
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Briefcase}
          label="Total Tasks"
          value={String(counts.total)}
          sub="All assignments"
          accent="info"
        />
        <StatCard
          icon={Clock}
          label="Pending"
          value={String(counts.Pending)}
          sub="Not yet started"
          accent="amber"
        />
        <StatCard
          icon={ArrowUpCircle}
          label="In Progress"
          value={String(counts["In Progress"])}
          sub="Currently active"
          accent="info"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={String(counts.Completed + counts.Overdue)}
          sub={`${counts.Completed} done · ${counts.Overdue} overdue`}
          accent="success"
        />
      </div>

      <Card title="All Assigned Tasks">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
            />
            <Input
              placeholder="Search title, assignee..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="min-w-[130px]"
          >
            {ROLE_FILTER_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r === "All" ? "All Roles" : r}
              </option>
            ))}
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-w-[120px]"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All Status" : s}
              </option>
            ))}
          </Select>
        </div>
        {filtered.length === 0 ? (
          <div className="py-14 text-center">
            <Briefcase size={36} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[14px] font-medium text-ink">No tasks assigned yet</p>
            <p className="text-[13px] text-slate-text/60 mt-1">
              Assign tasks to teachers and staff to get started.
            </p>
            <Button variant="amber" className="mt-4" onClick={openAdd}>
              <Plus size={15} /> Assign Task
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((h) => (
              <div
                key={h.id}
                className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 rounded-xl border border-black/[0.06] hover:border-black/10 hover:bg-paper/40 transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-info/15 text-info flex items-center justify-center shrink-0">
                  <Briefcase size={20} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-semibold text-ink">{h.title}</p>
                    <Pill tone={statusTone(h.status)}>{h.status}</Pill>
                    <Pill tone={h.priority === "High" ? "alert" : h.priority === "Low" ? "success" : "info"}>
                      {h.priority}
                    </Pill>
                  </div>
                  {h.description && (
                    <p className="text-[13px] text-ink/70 mt-1 leading-snug line-clamp-2">
                      {h.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12px] text-slate-text/65">
                    <span className="inline-flex items-center gap-1">
                      <User size={12} /> {h.assignedTo}
                    </span>
                    {h.assignedToRole && (
                      <span className="inline-flex items-center gap-1 text-info">
                        {ROLE_LABELS[h.assignedToRole] || h.assignedToRole}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={12} /> Due {formatDate(h.dueDate)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 sm:flex-col sm:items-end">
                  <Select
                    value={h.status}
                    onChange={(e) => changeStatus(h.id, e.target.value)}
                    className="text-[12px] py-1.5 min-w-[110px]"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Overdue">Overdue</option>
                  </Select>
                  <button
                    onClick={() => openEdit(h)}
                    className="text-[12.5px] font-medium text-info hover:underline px-1"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  {editId ? "Edit Task" : "Assign Task"}
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  Fill the details and save.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Title *
                </label>
                <Input
                  placeholder="e.g. Prepare annual report, Conduct parent meeting..."
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                />
              </div>

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Optional details about the task..."
                  value={form.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] bg-paper px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-slate-text/40 focus:outline-none focus:ring-2 focus:ring-info/30 focus:border-info/50 resize-none"
                />
              </div>

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Assign To *
                </label>
                <SearchableSelect
                  options={userOptions}
                  value={form.assignedTo}
                  onChange={(val) => updateForm("assignedTo", val)}
                  placeholder="Select teacher or staff"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Priority
                  </label>
                  <Select
                    value={form.priority}
                    onChange={(e) => updateForm("priority", e.target.value)}
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Status
                  </label>
                  <Select
                    value={form.status}
                    onChange={(e) => updateForm("status", e.target.value)}
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Due Date *
                </label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => updateForm("dueDate", e.target.value)}
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-black/[0.06] flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                variant="amber"
                onClick={handleSave}
                disabled={!form.title.trim() || !form.dueDate || !form.assignedTo.trim()}
              >
                <Save size={15} /> {editId ? "Update" : "Assign"} Task
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
