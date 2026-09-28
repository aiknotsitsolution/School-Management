import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { BookOpen, Plus, Save, X, Pencil, Trash2, ChevronLeft } from "lucide-react";
import { PageIntro, Card, Button, Input, Select, toast } from "../components/UI";
import { api } from "../lib/api";
import { selectUser } from "../store/selectors";

function fmtDate(value) {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

const emptyForm = () => ({
  title: "",
  body: "",
  class: "",
  section: "",
});

export default function Diary() {
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const role = user?.role;
  const canWrite = role === "school_admin" || role === "teacher";

  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const load = () => {
    setLoading(true);
    api.diary
      .list()
      .then(({ data }) => {
        setEntries(Array.isArray(data) ? data : []);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const classes = useMemo(
    () =>
      [...new Set(entries.map((e) => `${e.class ?? ""}-${e.section ?? ""}`).filter((c) => c !== "-"))].sort(),
    [entries],
  );

  const filtered = useMemo(() => {
    if (filterClass === "all") return entries;
    return entries.filter((e) => `${e.class}-${e.section}` === filterClass);
  }, [entries, filterClass]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (e) => {
    setEditId(e._id);
    setForm({
      title: e.title || "",
      body: e.body || "",
      class: e.class || "",
      section: e.section || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    const { class: cls, section } = form;
    if (!cls.trim()) {
      toast("Please specify the class", "error");
      return;
    }
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        class: cls.trim(),
        section: section.trim() || undefined,
      };
      const { data } = editId
        ? await api.diary.update(editId, payload)
        : await api.diary.create(payload);
      setEntries((prev) =>
        editId
          ? prev.map((e) => (e._id === editId ? data : e))
          : [data, ...prev],
      );
      setShowModal(false);
      setForm(emptyForm());
      setEditId(null);
      toast(editId ? "Diary entry updated" : "Diary entry posted");
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.diary.remove(id);
      setEntries((prev) => prev.filter((e) => e._id !== id));
      toast("Diary entry deleted");
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Class Communication"
        title="Class Diary"
        description="Daily updates shared with students and parents of each class."
        right={
          canWrite ? (
            <Button variant="primary" onClick={openAdd}>
              <Plus size={15} /> Add Entry
            </Button>
          ) : role === "parent" ? (
            <Button variant="outline" onClick={() => navigate("/messages")}>
              <ChevronLeft size={15} /> Message Teacher
            </Button>
          ) : undefined
        }
      />
      {error && <p className="text-alert text-[13px]">Backend unavailable: {error}</p>}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="sm:w-56"
          placeholder="All classes"
        >
          <option value="all">All classes</option>
          {classes.map((c) => (
            <option key={c} value={c}>
              Class {c}
            </option>
          ))}
        </Select>
        <span className="text-[12.5px] text-slate-text/60">
          {filtered.length} entr{filtered.length === 1 ? "y" : "ies"}
        </span>
      </div>

      {loading ? (
        <Card>
          <p className="text-[13px] text-slate-text py-10 text-center">Loading…</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="py-14 text-center">
            <BookOpen size={36} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[14px] font-medium text-ink">No diary entries yet</p>
            <p className="text-[13px] text-slate-text/60 mt-1">
              {canWrite ? "Post the first class entry." : "New entries will appear here."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((e) => (
            <Card key={e._id}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-lg bg-primary/10 text-primary-dark text-[11px] font-bold px-2 py-1">
                    {e.class}
                    {e.section ? `-${e.section}` : ""}
                  </span>
                  <span className="text-[11.5px] text-slate-text/60">{fmtDate(e.date)}</span>
                </div>
                {canWrite && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(e)}
                      className="p-1.5 rounded-lg hover:bg-paper text-slate-text/60 hover:text-info transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(e._id)}
                      className="p-1.5 rounded-lg hover:bg-paper text-slate-text/60 hover:text-alert transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              <h3 className="font-display font-bold text-ink text-[15.5px] leading-snug">{e.title}</h3>
              <p className="text-[13px] text-slate-text mt-2 leading-relaxed line-clamp-4">{e.body}</p>
              {e.postedBy && (
                <p className="text-[11px] text-slate-text/50 mt-3">Posted by {e.postedBy}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* ========== ADD / EDIT MODAL ========== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  {editId ? "Edit Diary Entry" : "Add Diary Entry"}
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  Shared with students and parents of the selected class.
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-paper text-slate-text">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">Title *</label>
                <Input placeholder="Entry title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Class *</label>
                  <Input placeholder="e.g. 5" value={form.class} onChange={(e) => setForm((f) => ({ ...f, class: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Section</label>
                  <Input placeholder="e.g. A" value={form.section} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">Body *</label>
                <textarea
                  rows={6}
                  placeholder="What happened in class today?"
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 p-3 text-[13px] outline-none focus:border-primary resize-none"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex justify-between gap-2">
              <div>
                {editId && (
                  <Button
                    variant="outline"
                    className="text-alert border-alert/30 hover:bg-alert/5"
                    onClick={() => {
                      handleDelete(editId);
                      setShowModal(false);
                    }}
                  >
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleSave} disabled={!form.title.trim() || !form.body.trim()}>
                  <Save size={15} /> {editId ? "Update" : "Post"} Entry
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}