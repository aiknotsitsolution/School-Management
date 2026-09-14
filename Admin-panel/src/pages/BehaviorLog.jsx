import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import {
  Plus,
  Search,
  X,
  Save,
  ShieldAlert,
  Filter,
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
import { LoadingBlock, EmptyBlock, ErrorBlock } from "../components/StateViews";

const TYPES = ["All", "incident", "positive", "warning", "detention", "suspension", "other"];
const SEVERITIES = ["All", "low", "medium", "high", "critical"];
const TYPE_TONES = {
  incident: "alert", positive: "success", warning: "amber",
  detention: "alert", suspension: "alert", other: "neutral",
};
const SEV_TONES = { low: "info", medium: "amber", high: "alert", critical: "alert" };

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm() {
  return {
    studentId: "",
    class: "",
    section: "",
    date: todayISO(),
    type: "incident",
    title: "",
    description: "",
    severity: "medium",
    actionTaken: "",
    followUpRequired: false,
    followUpNotes: "",
  };
}

export default function BehaviorLog() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sevFilter, setSevFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState([]);

  const fetchRecords = () => {
    setLoading(true);
    api.behavior
      .list("limit=200")
      .then(({ data }) => setItems(Array.isArray(data) ? data : data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRecords(); }, []);

  useEffect(() => {
    api.students.list("limit=1000")
      .then(({ data }) => setStudents(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter((r) => {
      const matchType = typeFilter === "All" || r.type === typeFilter;
      const matchSev = sevFilter === "All" || r.severity === sevFilter;
      const matchQ = !q || r.title?.toLowerCase().includes(q) || r.studentId?.toLowerCase().includes(q);
      return matchType && matchSev && matchQ;
    });
  }, [items, typeFilter, sevFilter, query]);

  const counts = useMemo(() => {
    const c = { total: items.length, incident: 0, positive: 0, warning: 0, detention: 0, suspension: 0, unresolved: 0 };
    items.forEach((r) => { if (c[r.type] !== undefined) c[r.type]++; if (!r.resolved) c.unresolved++; });
    return c;
  }, [items]);

  const openAdd = () => { setEditId(null); setForm(emptyForm()); setShowModal(true); };

  const openEdit = (item) => {
    setEditId(item._id);
    setForm({
      studentId: item.studentId || "",
      class: item.class || "",
      section: item.section || "",
      date: item.date ? item.date.slice(0, 10) : todayISO(),
      type: item.type || "incident",
      title: item.title || "",
      description: item.description || "",
      severity: item.severity || "medium",
      actionTaken: item.actionTaken || "",
      followUpRequired: item.followUpRequired || false,
      followUpNotes: item.followUpNotes || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.studentId.trim() || !form.class.trim()) {
      toast("Title, student ID, and class are required", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        studentId: form.studentId.trim(),
        class: form.class.trim(),
        section: form.section.trim() || undefined,
        date: form.date,
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim(),
        severity: form.severity,
        actionTaken: form.actionTaken.trim(),
        followUpRequired: form.followUpRequired,
        followUpNotes: form.followUpNotes.trim(),
      };
      if (editId) {
        await api.behavior.update(editId, payload);
        toast("Record updated");
      } else {
        await api.behavior.create(payload);
        toast("Record created");
      }
      setShowModal(false);
      fetchRecords();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this record?")) return;
    try {
      await api.behavior.remove(id);
      toast("Record deleted");
      fetchRecords();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const handleResolve = async (id) => {
    try {
      await api.behavior.update(id, { resolved: true, resolvedAt: new Date().toISOString() });
      toast("Marked as resolved");
      fetchRecords();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const set = (key) => (e) => {
    const val = e.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: val }));
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Student Welfare"
        title="Behavior Log"
        description="Track student conduct, incidents, and positive behavior."
        right={
          <Button onClick={openAdd}>
            <Plus size={15} /> Add Record
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ShieldAlert} label="Total Records" value={String(counts.total)} accent="info" />
        <StatCard icon={ShieldAlert} label="Incidents" value={String(counts.incident)} accent="alert" />
        <StatCard icon={ShieldAlert} label="Positive" value={String(counts.positive)} accent="success" />
        <StatCard icon={ShieldAlert} label="Unresolved" value={String(counts.unresolved)} accent="amber" />
      </div>

      <Card
        title="Records"
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40" />
              <Input placeholder="Search title / student..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8 w-48" />
            </div>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-28">
              {TYPES.map((t) => <option key={t} value={t}>{t === "All" ? "All Types" : t}</option>)}
            </Select>
            <Select value={sevFilter} onChange={(e) => setSevFilter(e.target.value)} className="w-28">
              {SEVERITIES.map((s) => <option key={s} value={s}>{s === "All" ? "All Severity" : s}</option>)}
            </Select>
          </div>
        }
      >
        {loading ? (
          <LoadingBlock />
        ) : filtered.length === 0 ? (
          <EmptyBlock message="No behavior records found." />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                  <th className="px-5 py-2 font-semibold">Student</th>
                  <th className="px-3 py-2 font-semibold">Title</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Severity</th>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r._id} className="border-t border-black/[0.06] hover:bg-paper/60">
                    <td className="px-5 py-2.5 font-semibold text-ink">{r.studentId}</td>
                    <td className="px-3 py-2.5 text-slate-text/80 max-w-[200px] truncate">{r.title}</td>
                    <td className="px-3 py-2.5"><Pill tone={TYPE_TONES[r.type] || "neutral"}>{r.type}</Pill></td>
                    <td className="px-3 py-2.5"><Pill tone={SEV_TONES[r.severity] || "neutral"}>{r.severity}</Pill></td>
                    <td className="px-3 py-2.5 text-slate-text/80">{fmtDate(r.date)}</td>
                    <td className="px-3 py-2.5">
                      <Pill tone={r.resolved ? "success" : "amber"}>{r.resolved ? "Resolved" : "Open"}</Pill>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!r.resolved && (
                          <button onClick={() => handleResolve(r._id)} className="text-[11px] font-semibold text-success hover:underline">Resolve</button>
                        )}
                        <button onClick={() => openEdit(r)} className="text-[11px] font-semibold text-info hover:underline">Edit</button>
                        <button onClick={() => handleDelete(r._id)} className="text-[11px] font-semibold text-alert hover:underline">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06]">
              <h3 className="font-display font-semibold text-ink text-[16px]">{editId ? "Edit Record" : "New Behavior Record"}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-paper"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-text/60 uppercase">Student *</label>
                <SearchableSelect
                  options={students.map((s) => String(s._id))}
                  value={form.studentId}
                  onChange={(sid) => {
                    const student = students.find((s) => String(s._id) === sid);
                    setForm((f) => ({
                      ...f,
                      studentId: sid,
                      class: student?.class || f.class,
                      section: student?.section || f.section,
                    }));
                  }}
                  placeholder="Search by name or admission no..."
                  renderLabel={(sid) => {
                    const s = students.find((st) => String(st._id) === sid);
                    return s ? `${s.name} (${s.admissionNo || "—"})` : sid;
                  }}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-text/60 uppercase">Class *</label>
                  <Input value={form.class} onChange={set("class")} placeholder="e.g. 10" className="mt-1" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-text/60 uppercase">Section</label>
                  <Input value={form.section} onChange={set("section")} placeholder="e.g. A" className="mt-1" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-text/60 uppercase">Date *</label>
                  <Input type="date" value={form.date} onChange={set("date")} className="mt-1" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-text/60 uppercase">Type</label>
                  <Select value={form.type} onChange={set("type")} className="mt-1">
                    {TYPES.slice(1).map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-text/60 uppercase">Title *</label>
                <Input value={form.title} onChange={set("title")} placeholder="Brief description" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-text/60 uppercase">Severity</label>
                  <Select value={form.severity} onChange={set("severity")} className="mt-1">
                    {SEVERITIES.slice(1).map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
                    <input type="checkbox" checked={form.followUpRequired} onChange={(e) => setForm((f) => ({ ...f, followUpRequired: e.target.checked }))} className="rounded" />
                    Follow-up required
                  </label>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-text/60 uppercase">Description</label>
                <textarea value={form.description} onChange={set("description")} rows={3} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-info/30 focus:border-info" placeholder="What happened..." />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-text/60 uppercase">Action Taken</label>
                <textarea value={form.actionTaken} onChange={set("actionTaken")} rows={2} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-info/30 focus:border-info" placeholder="What action was taken..." />
              </div>
              {form.followUpRequired && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-text/60 uppercase">Follow-up Notes</label>
                  <textarea value={form.followUpNotes} onChange={set("followUpNotes")} rows={2} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-info/30 focus:border-info" placeholder="Follow-up plan..." />
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/[0.06]">
              <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Record"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
