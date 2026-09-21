import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import {
  Plus,
  Search,
  X,
  Trophy,
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

const CATEGORIES = ["All", "academic", "sports", "arts", "citizenship", "attendance", "other"];
const CAT_TONES = {
  academic: "info", sports: "success", arts: "amber",
  citizenship: "success", attendance: "info", other: "neutral",
};

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
    title: "",
    category: "academic",
    description: "",
    date: todayISO(),
    year: new Date().getFullYear(),
  };
}

export default function Achievements() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState([]);

  const fetchRecords = () => {
    setLoading(true);
    api.achievements
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
      const matchCat = catFilter === "All" || r.category === catFilter;
      const matchQ = !q || r.title?.toLowerCase().includes(q) || r.studentId?.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [items, catFilter, query]);

  const counts = useMemo(() => {
    const c = { total: items.length };
    CATEGORIES.slice(1).forEach((cat) => { c[cat] = items.filter((r) => r.category === cat).length; });
    return c;
  }, [items]);

  const openAdd = () => { setEditId(null); setForm(emptyForm()); setShowModal(true); };

  const openEdit = (item) => {
    setEditId(item._id);
    setForm({
      studentId: item.studentId || "",
      class: item.class || "",
      section: item.section || "",
      title: item.title || "",
      category: item.category || "academic",
      description: item.description || "",
      date: item.date ? item.date.slice(0, 10) : todayISO(),
      year: item.year || new Date().getFullYear(),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.studentId.trim()) {
      toast("Title and student ID are required", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        studentId: form.studentId.trim(),
        class: form.class.trim() || undefined,
        section: form.section.trim() || undefined,
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim(),
        date: form.date,
        year: parseInt(form.year) || new Date().getFullYear(),
      };
      if (editId) {
        await api.achievements.update(editId, payload);
        toast("Achievement updated");
      } else {
        await api.achievements.create(payload);
        toast("Achievement recorded");
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
    if (!confirm("Delete this achievement?")) return;
    try {
      await api.achievements.remove(id);
      toast("Achievement deleted");
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
        title="Achievements & Recognition"
        description="Recognize and track student achievements across all categories."
        right={
          <Button onClick={openAdd}>
            <Plus size={15} /> Add Achievement
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Trophy} label="Total Achievements" value={String(counts.total)} accent="amber" />
        <StatCard icon={Trophy} label="Academic" value={String(counts.academic || 0)} accent="info" />
        <StatCard icon={Trophy} label="Sports" value={String(counts.sports || 0)} accent="success" />
        <StatCard icon={Trophy} label="Arts & Culture" value={String(counts.arts || 0)} accent="amber" />
      </div>

      <Card
        title="Achievements"
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40" />
              <Input placeholder="Search title / student..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8 w-48" />
            </div>
            <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="w-32">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c === "All" ? "All Categories" : c}</option>)}
            </Select>
          </div>
        }
      >
        {loading ? (
          <LoadingBlock />
        ) : filtered.length === 0 ? (
          <EmptyBlock message="No achievements recorded yet." />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                  <th className="px-5 py-2 font-semibold">Student</th>
                  <th className="px-3 py-2 font-semibold">Title</th>
                  <th className="px-3 py-2 font-semibold">Category</th>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Year</th>
                  <th className="px-3 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r._id} className="border-t border-black/[0.06] hover:bg-paper/60">
                    <td className="px-5 py-2.5 font-semibold text-ink">{r.studentId}</td>
                    <td className="px-3 py-2.5 text-slate-text/80 max-w-[250px] truncate">{r.title}</td>
                    <td className="px-3 py-2.5"><Pill tone={CAT_TONES[r.category] || "neutral"}>{r.category}</Pill></td>
                    <td className="px-3 py-2.5 text-slate-text/80">{fmtDate(r.date)}</td>
                    <td className="px-3 py-2.5 text-slate-text/80">{r.year || "—"}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
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
              <h3 className="font-display font-semibold text-ink text-[16px]">{editId ? "Edit Achievement" : "Record Achievement"}</h3>
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
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-text/60 uppercase">Class</label>
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-text/60 uppercase">Title *</label>
                  <Input value={form.title} onChange={set("title")} placeholder="Achievement title" className="mt-1" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-text/60 uppercase">Category</label>
                  <Select value={form.category} onChange={set("category")} className="mt-1">
                    {CATEGORIES.slice(1).map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-text/60 uppercase">Year</label>
                <Input type="number" value={form.year} onChange={set("year")} className="mt-1" placeholder="e.g. 2026" min="2000" max="2099" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-text/60 uppercase">Description</label>
                <textarea value={form.description} onChange={set("description")} rows={3} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-info/30 focus:border-info" placeholder="Details about the achievement..." />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/[0.06]">
              <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Achievement"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
