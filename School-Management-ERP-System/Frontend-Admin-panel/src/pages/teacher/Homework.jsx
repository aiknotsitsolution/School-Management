import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  X,
  Save,
  Pencil,
  Trash2,
  BookOpenCheck,
  Search,
  AlarmClock,
  ClipboardCheck,
  CheckCircle2,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Input,
  Select,
  Pill,
  StatCard,
  toast,
} from "../../components/UI";
import { api } from "../../lib/api";
import { useTeacherContext, fmtDate } from "./useTeacherContext";

const SUBJECTS = ["English", "Maths", "Science", "Social Studies", "Hindi", "Computer", "General Knowledge"];

export default function Homework() {
  const { cls, section, assignment, query } = useTeacherContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ subject: "English", title: "", description: "", dueDate: "" });

  const [submissions, setSubmissions] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [reviewTarget, setReviewTarget] = useState(null); // { submission, homework }
  const [rMarks, setRMarks] = useState("");
  const [rFeedback, setRFeedback] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setLoadingSubs(true);
    Promise.all([
      api.homework
        .list(query)
        .then(({ data }) => setItems(data || []))
        .catch((e) => toast(e.message, "error")),
      api.homework.submissions
        .classList()
        .then(({ data }) => setSubmissions(data || []))
        .catch(() => setSubmissions([])),
    ]).finally(() => {
      setLoading(false);
      setLoadingSubs(false);
    });
  }, [query]);

  const homeworkById = useMemo(() => {
    const map = {};
    (items || []).forEach((h) => {
      map[String(h._id)] = h;
      map[String(h._id?.$oid || h._id)] = h;
    });
    return map;
  }, [items]);

  const openReview = (sub) => {
    const hw = homeworkById[String(sub.homeworkId)] || homeworkById[String(sub.homeworkId?.$oid)] || null;
    setReviewTarget({ submission: sub, homework: hw });
    setRMarks(sub.marks != null ? String(sub.marks) : "");
    setRFeedback(sub.teacherFeedback || "");
  };

  const saveReview = async () => {
    const { submission, homework } = reviewTarget;
    const max = homework?.maxMarks ?? 100;
    const val = Number(rMarks);
    if (rMarks === "" || isNaN(val) || val < 0 || val > max) {
      toast(`Marks must be between 0 and ${max}`, "error");
      return;
    }
    setSavingReview(true);
    try {
      const { data } = await api.homework.submissions.review(submission._id, {
        marks: Number(rMarks),
        teacherFeedback: rFeedback.trim(),
      });
      setSubmissions((prev) => prev.map((s) => (s._id === data._id ? data : s)));
      setReviewTarget(null);
      toast("Submission reviewed");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSavingReview(false);
    }
  };

  const pendingCount = (submissions || []).filter((s) => s.status !== "Reviewed").length;
  const reviewedCount = (submissions || []).filter((s) => s.status === "Reviewed").length;

  const list = useMemo(() => {
    const q = search.toLowerCase();
    return (items || [])
      .filter(
        (h) =>
          !q ||
          h.title?.toLowerCase().includes(q) ||
          h.subject?.toLowerCase().includes(q),
      )
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }, [items, search]);

  const openAdd = () => {
    setEditId(null);
    setForm({ subject: "English", title: "", description: "", dueDate: "" });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditId(item._id);
    setForm({
      subject: item.subject || "English",
      title: item.title || "",
      description: item.description || "",
      dueDate: item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : "",
    });
    setShowModal(true);
  };

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.dueDate || !form.subject) return;
    const payload = {
      class: cls,
      section,
      subject: form.subject,
      title: form.title.trim(),
      description: form.description.trim(),
      dueDate: form.dueDate,
    };
    try {
      if (editId) {
        const { data } = await api.homework.update(editId, payload);
        setItems((prev) => prev.map((i) => (i._id === editId ? data : i)));
        toast("Homework updated");
      } else {
        const { data } = await api.homework.create(payload);
        setItems((prev) => [data, ...prev]);
        toast("Homework assigned to " + assignment);
      }
      setShowModal(false);
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this homework?")) return;
    try {
      await api.homework.remove(id);
      setItems((prev) => prev.filter((h) => h._id !== id));
      toast("Homework deleted");
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const open = (items || []).filter((h) => new Date(h.dueDate) >= new Date());
  const overdue = (items || []).filter((h) => new Date(h.dueDate) < new Date());

  if (!cls) {
    return (
      <Card>
        <div className="py-16 text-center">
          <BookOpenCheck size={40} className="mx-auto text-slate-text/30 mb-3" />
          <p className="text-[15px] font-semibold text-ink">
            No class assigned yet
          </p>
          <p className="text-[13px] text-slate-text/70 mt-1">
            Contact your school admin to link your class and section.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="My Teaching"
        title="Homework & Assignments"
        description={`Assignments set for ${assignment}.`}
        right={
          <Button variant="amber" onClick={openAdd}>
            <Plus size={15} /> Assign Homework
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={BookOpenCheck}
          label="Total"
          value={String((items || []).length)}
          sub="All assignments"
          accent="info"
        />
        <StatCard
          icon={BookOpenCheck}
          label="Open"
          value={String(open.length)}
          sub="Due in future"
          accent="success"
        />
        <StatCard
          icon={AlarmClock}
          label="Overdue"
          value={String(overdue.length)}
          sub="Past due date"
          accent="alert"
        />
        <StatCard
          icon={BookOpenCheck}
          label="Subjects"
          value={String(new Set((items || []).map((h) => h.subject)).size)}
          sub="Active subjects"
          accent="amber"
        />
      </div>

      <Card
        title="Assignments"
        action={
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
            />
            <Input
              placeholder="Search assignments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-56"
            />
          </div>
        }
      >
        {loading ? (
          <p className="text-[13px] text-slate-text py-10 text-center">
            Loading homework…
          </p>
        ) : list.length === 0 ? (
          <p className="text-[13px] text-slate-text py-10 text-center">
            No homework assigned yet for {assignment}.
          </p>
        ) : (
          <div className="space-y-2.5">
            {list.map((h) => {
              const isOverdue = new Date(h.dueDate) < new Date();
              return (
                <div
                  key={h._id}
                  className="flex items-start gap-3 p-3 rounded-xl border border-black/[0.06] hover:bg-paper/60"
                >
                  <div className="w-9 h-9 rounded-lg bg-amber/12 text-amber-dark flex items-center justify-center shrink-0">
                    <BookOpenCheck size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14px] font-semibold text-ink">
                        {h.title}
                      </p>
                      <Pill tone="info">{h.subject}</Pill>
                      {isOverdue && <Pill tone="alert">Overdue</Pill>}
                    </div>
                    {h.description && (
                      <p className="text-[12.5px] text-slate-text mt-1 leading-relaxed line-clamp-2">
                        {h.description}
                      </p>
                    )}
                    <p className="text-[11.5px] text-slate-text/60 mt-1.5">
                      Due {fmtDate(h.dueDate)} · set by {h.assignedBy || "—"} ·{" "}
                      Class {h.class}
                      {h.section ? `-${h.section}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(h)}
                      className="p-2 rounded-lg hover:bg-paper text-slate-text/60 hover:text-info transition-colors"
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(h._id)}
                      className="p-2 rounded-lg hover:bg-paper text-slate-text/60 hover:text-alert transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card
        title="Submissions to review"
        action={
          <div className="flex items-center gap-2 text-[12px] text-slate-text/70">
            <Pill tone={pendingCount > 0 ? "amber" : "success"}>
              {pendingCount} pending
            </Pill>
            <Pill tone="neutral">{reviewedCount} reviewed</Pill>
          </div>
        }
      >
        {loadingSubs ? (
          <p className="text-[13px] text-slate-text py-10 text-center">
            Loading submissions…
          </p>
        ) : submissions.length === 0 ? (
          <p className="text-[13px] text-slate-text py-10 text-center">
            No student submissions yet for {assignment}. They will appear here as
            students submit their work online.
          </p>
        ) : (
          <div className="space-y-2.5">
            {submissions.map((sub) => {
              const hw =
                homeworkById[String(sub.homeworkId)] ||
                homeworkById[String(sub.homeworkId?.$oid)];
              const reviewed = sub.status === "Reviewed";
              return (
                <div
                  key={sub._id}
                  className="flex items-start gap-3 p-3 rounded-xl border border-black/[0.06] hover:bg-paper/60"
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      reviewed ? "bg-emerald-500/10 text-emerald-600" : "bg-amber/12 text-amber-dark"
                    }`}
                  >
                    {reviewed ? <CheckCircle2 size={16} /> : <ClipboardCheck size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14px] font-semibold text-ink">
                        {sub.studentName || sub.admissionNo || sub.studentId}
                      </p>
                      <Pill tone="neutral">{sub.admissionNo || sub.studentId}</Pill>
                      {hw && <Pill tone="info">{hw.title}</Pill>}
                      {!reviewed && <Pill tone="amber">{sub.status || "Submitted"}</Pill>}
                    </div>
                    {sub.content && (
                      <p className="text-[12.5px] text-slate-text mt-1 leading-relaxed line-clamp-2">
                        {sub.content}
                      </p>
                    )}
                    <p className="text-[11.5px] text-slate-text/60 mt-1.5">
                      Submitted {fmtDate(sub.createdAt)}
                      {reviewed && sub.marks != null && (
                        <> · <strong className="text-ink">Grade {sub.marks}/{hw?.maxMarks ?? 100}</strong></>
                      )}
                      {reviewed && sub.reviewedBy && ` · reviewed by ${sub.reviewedBy}`}
                    </p>
                    {reviewed && sub.teacherFeedback && (
                      <p className="text-[12.5px] text-ink mt-1 bg-paper/70 rounded-lg px-2.5 py-1.5">
                        Feedback: {sub.teacherFeedback}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <Button variant={reviewed ? "outline" : "amber"} onClick={() => openReview(sub)}>
                      {reviewed ? "Re-review" : "Review"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  {editId ? "Edit Homework" : "Assign Homework"}
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  For {assignment}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Subject *
                </label>
                <Select
                  value={form.subject}
                  onChange={(e) => update("subject", e.target.value)}
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Title *
                </label>
                <Input
                  placeholder="e.g. Chapter 4 — Fractions worksheet"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Instructions
                </label>
                <textarea
                  rows={4}
                  placeholder="Details for students..."
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  className="w-full rounded-lg border border-black/10 p-3 text-[13px] outline-none focus:border-ink/40 resize-none"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Due Date *
                </label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => update("dueDate", e.target.value)}
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
                disabled={!form.title.trim() || !form.dueDate}
              >
                <Save size={15} /> {editId ? "Update" : "Assign"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setReviewTarget(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">Review submission</h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  {reviewTarget.submission.studentName || reviewTarget.submission.admissionNo}
                  {reviewTarget.homework ? ` · ${reviewTarget.homework.title}` : ""}
                </p>
              </div>
              <button
                onClick={() => setReviewTarget(null)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[50vh] overflow-y-auto">
              {reviewTarget.submission.content && (
                <div>
                  <label className="text-[11px] font-semibold text-ink uppercase tracking-wide block">
                    Student's response
                  </label>
                  <p className="mt-1.5 rounded-lg bg-paper/70 p-3 text-[13px] text-ink whitespace-pre-wrap">
                    {reviewTarget.submission.content}
                  </p>
                </div>
              )}
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Marks out of {reviewTarget.homework?.maxMarks ?? 100} *
                </label>
                <Input
                  type="number"
                  min="0"
                  max={reviewTarget.homework?.maxMarks ?? 100}
                  placeholder="e.g. 9"
                  value={rMarks}
                  onChange={(e) => setRMarks(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Feedback for student
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Great work, watch the units column…"
                  value={rFeedback}
                  onChange={(e) => setRFeedback(e.target.value)}
                  className="w-full rounded-lg border border-black/10 p-3 text-[13px] outline-none focus:border-ink/40 resize-none"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-black/[0.06] flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReviewTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="amber"
                onClick={saveReview}
                disabled={savingReview || rMarks === ""}
              >
                <CheckCircle2 size={15} /> {savingReview ? "Saving…" : "Save review"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}