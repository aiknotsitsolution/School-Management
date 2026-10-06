import { useCallback, useEffect, useState } from "react";
import { ClipboardList, ListPlus, Pencil, Plus, RefreshCw, Trash2, X, CheckCircle2 } from "lucide-react";
import { PageIntro, Card, Button, Input, Select, Pill, toast } from "../components/UI";
import { LoadingBlock, EmptyBlock, ErrorBlock } from "../components/StateViews";
import { usePermission } from "../lib/permissions"; 
import { useMasterOptions } from "../hooks/useMasterOptions";
import { api } from "../lib/api";

const TERMS = ["Term 1", "Term 2", "Full Year"];
const STATUSES = ["pending", "in_progress", "completed"];

const EMPTY_FORM = {
  class: "",
  sectionId: "",
  subject: "",
  sectionSubjects: {},
  term: "Full Year",
  totalHours: "",
  topics: [],
};
const isActiveMaster = (item) =>
  item && ("status" in item ? item.status === "active" : item.active !== false);

export default function SyllabusManage() {
  const canWrite = usePermission("homework:write");

  const { rawItems: classMasters } = useMasterOptions("classes", []);
  const { rawItems: sectionMasters } = useMasterOptions("sections", []);
  const { rawItems: subjectMasters } = useMasterOptions("subjects", []);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    class: "",
    sectionId: "",
    subject: "",
    term: "",
  });

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filters.class) params.set("class", filters.class);
      if (filters.sectionId) params.set("sectionId", filters.sectionId);
      if (filters.subject) params.set("subject", filters.subject);
      if (filters.term) params.set("term", filters.term);
      const res = await api.syllabus.list(params.toString());
      setRows(res?.data || []);
    } catch (err) {
      setError(err.message || "Could not load syllabus");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const activeSections = sectionMasters.filter(isActiveMaster);
  const activeSubjects = subjectMasters.filter(isActiveMaster);
  const classOptions = classMasters.filter(isActiveMaster).map((item) => item.name);
  const sectionsForClass = (className) => {
    const schoolClass = classMasters.find((item) => item.name === className);
    return activeSections.filter(
      (section) =>
        (schoolClass && String(section.classId) === String(schoolClass._id)) ||
        (!section.classId && section.className === className),
    );
  };
  const formSections = sectionsForClass(form.class);
  const filterSections = sectionsForClass(filters.class);
  const subjectsForSection = (sectionId) =>
    activeSubjects.filter((subject) => String(subject.sectionId) === String(sectionId));
  const formSubjects = subjectsForSection(form.sectionId);
  const filterSubjects = subjectsForSection(filters.sectionId);
  const toggleSectionSubject = (sectionId, subjectName) => {
    setForm((current) => {
      const selected = current.sectionSubjects[sectionId] || [];
      const nextSelected = selected.includes(subjectName)
        ? selected.filter((name) => name !== subjectName)
        : [...selected, subjectName];
      return {
        ...current,
        sectionSubjects: { ...current.sectionSubjects, [sectionId]: nextSelected },
      };
    });
  };

  const setFilter = (key) => (e) => {
    const value = e.target.value;
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "class" ? { sectionId: "", subject: "" } : {}),
      ...(key === "sectionId" ? { subject: "" } : {}),
    }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sectionSubjects: {}, topics: [] });
    setShowForm(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      class: row.class || "",
      sectionId: row.sectionId || "",
      subject: row.subject || "",
      sectionSubjects: {},
      term: row.term || "Full Year",
      totalHours: row.totalHours != null ? String(row.totalHours) : "",
      topics: (row.topics || []).map((t) => ({
        title: t.title || "",
        description: t.description || "",
        status: t.status || "pending",
      })),
    });
    setShowForm(true);
  };

  const setFormValue = (key) => (e) => {
    const value = e.target.value;
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "class" ? { sectionId: "", subject: "", sectionSubjects: {} } : {}),
      ...(key === "sectionId" ? { subject: "" } : {}),
    }));
  };

  const setTopic = (index, key) => (e) =>
    setForm((f) => ({
      ...f,
      topics: f.topics.map((t, i) => (i === index ? { ...t, [key]: e.target.value } : t)),
    }));

  const addTopic = () =>
    setForm((f) => ({ ...f, topics: [...f.topics, { title: "", description: "", status: "pending" }] }));

  const removeTopic = (index) =>
    setForm((f) => ({ ...f, topics: f.topics.filter((_, i) => i !== index) }));

  const handleSubmit = async () => {
    if (!form.class) return toast("Class is required", "error");
    const selectedRows = editing
      ? form.sectionId && form.subject
        ? [{ sectionId: form.sectionId, subjects: [form.subject] }]
        : []
      : Object.entries(form.sectionSubjects)
          .filter(([, subjects]) => subjects.length > 0)
          .map(([sectionId, subjects]) => ({
            class: form.class,
            section: formSections.find((item) => item._id === sectionId)?.name,
            sectionId,
            subjects,
          }));
    if (selectedRows.length === 0) {
      return toast(
        editing ? "Select a section and subject" : "Select at least one subject",
        "error",
      );
    }
    const topics = form.topics
      .map((t) => ({ ...t, title: t.title.trim(), description: (t.description || "").trim() }))
      .filter((t) => t.title);
    if (form.topics.length && topics.length === 0)
      return toast("Every topic needs a title", "error");

    setSaving(true);
    try {
      const details = {
        class: form.class,
        term: form.term,
        topics,
        totalHours: Number(form.totalHours) || 0,
      };
      if (editing) {
        await api.syllabus.update(editing._id, {
          ...details,
          sectionId: selectedRows[0].sectionId,
          subject: selectedRows[0].subjects[0],
        });
        toast("Syllabus updated", "success");
      } else {
        const { data } = await api.syllabus.createBulk({
          ...details,
          sections: selectedRows,
        });
        toast(`${data.length} syllabus${data.length === 1 ? "" : "es"} created`, "success");
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast(err.message || "Could not save syllabus", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete the ${row.subject} syllabus for ${row.class}?`)) return;
    try {
      await api.syllabus.remove(row._id);
      toast("Syllabus deleted", "success");
      load();
    } catch (err) {
      toast(err.message || "Could not delete syllabus", "error");
    }
  };

  const doneCount = (row) =>
    (row.topics || []).filter((t) => t.status === "completed").length;

  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="Academics"
        title="Syllabus"
        description="Plan the term-wise syllabus for every class and subject."
        right={
          canWrite && (
            <Button variant="primary" onClick={openCreate}>
              <Plus size={15} /> Add Syllabus
            </Button>
          )
        }
      />

      <Card
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filters.class} onChange={setFilter("class")} className="w-32">
              <option value="">All classes</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select
              value={filters.sectionId}
              onChange={setFilter("sectionId")}
              className="w-36"
              disabled={!filters.class}
            >
              <option value="">{filters.class ? "All sections" : "Select class first"}</option>
              {filterSections.map((section) => (
                <option key={section._id} value={section._id}>
                  {section.name}
                </option>
              ))}
            </Select>
            <Select
              value={filters.subject}
              onChange={setFilter("subject")}
              className="w-36"
              disabled={!filters.sectionId}
            >
              <option value="">{filters.sectionId ? "All subjects" : "Select section first"}</option>
              {filterSubjects.map((subject) => (
                <option key={subject._id} value={subject.name}>
                  {subject.name}
                </option>
              ))}
            </Select>
            <Select value={filters.term} onChange={setFilter("term")} className="w-32">
              <option value="">All terms</option>
              {TERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Button variant="ghost" onClick={load} title="Refresh">
              <RefreshCw size={14} />
            </Button>
          </div>
        }
      >
        {loading ? (
          <LoadingBlock label="Loading syllabus…" />
        ) : error ? (
          <ErrorBlock message={error} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyBlock
            title={
              filters.class || filters.subject || filters.term
                ? "No syllabus matches these filters"
                : "No syllabus has been planned yet"
            }
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((row) => {
              const totalTopics = (row.topics || []).length;
              const done = doneCount(row);
              return (
                <div
                  key={row._id}
                  className="rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink text-[14px] truncate">
                        {row.class}
                        {row.sectionName ? ` · ${row.sectionName}` : ""}
                        {" · "}
                        {row.subject}
                      </p>
                      <p className="text-[12px] text-slate-text/70 mt-0.5">{row.term}</p>
                    </div>
                    <Pill tone="neutral">{totalTopics} topics</Pill>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-paper overflow-hidden">
                      <div
                        className="h-full bg-success transition-all"
                        style={{
                          width: totalTopics ? `${Math.round((done / totalTopics) * 100)}%` : "0%",
                        }}
                      />
                    </div>
                    <span className="text-[11.5px] font-semibold text-slate-text">
                      {done}/{totalTopics}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[12px] text-slate-text/70">
                    <span>{row.totalHours || 0} hours planned</span>
                    {done === totalTopics && totalTopics > 0 && (
                      <span className="inline-flex items-center gap-1 text-success font-semibold">
                        <CheckCircle2 size={12} /> Complete
                      </span>
                    )}
                  </div>

                  {canWrite && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        onClick={() => openEdit(row)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[12px] font-semibold text-info hover:bg-info/10 transition-colors"
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(row)}
                        className="px-2 py-1.5 rounded-lg text-[12px] font-semibold text-slate-text/70 hover:bg-alert/10 hover:text-alert transition-colors"
                        title="Delete syllabus"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => !saving && setShowForm(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ClipboardList size={18} className="text-primary" />
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  {editing ? "Edit Syllabus" : "Add Syllabus"}
                </h3>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
                disabled={saving}
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className={`grid ${editing ? "grid-cols-3" : "grid-cols-1"} gap-3`}>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Class *
                  </label>
                  <Select value={form.class} onChange={setFormValue("class")}>
                    <option value="">Select class</option>
                    {classOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                {editing && (
                  <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Section *
                  </label>
                  <Select
                    value={form.sectionId}
                    onChange={setFormValue("sectionId")}
                    disabled={!form.class}
                  >
                    <option value="">
                      {form.class ? "Select section" : "Select class first"}
                    </option>
                    {formSections.map((section) => (
                      <option key={section._id} value={section._id}>
                        {section.name}
                      </option>
                    ))}
                  </Select>
                  </div>
                )}
                {editing && (
                  <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Subject *
                  </label>
                  <Select
                    value={form.subject}
                    onChange={setFormValue("subject")}
                    disabled={!form.sectionId}
                  >
                    <option value="">
                      {form.sectionId ? "Select subject" : "Select section first"}
                    </option>
                    {formSubjects.map((subject) => (
                      <option key={subject._id} value={subject.name}>
                        {subject.name}
                      </option>
                    ))}
                  </Select>
                  </div>
                )}
              </div>

              {!editing && form.class && (
                <div className="space-y-3">
                  <div>
                    <p className="text-[12px] font-semibold text-ink">
                      Sections and subjects for {form.class}
                    </p>
                    <p className="mt-1 text-[11.5px] text-slate-text/60">
                      Choose subjects for each section. Term, topics and planned hours below
                      will apply to every selected subject.
                    </p>
                  </div>
                  {formSections.length === 0 ? (
                    <p className="rounded-lg bg-paper px-3 py-3 text-[12.5px] text-slate-text/70">
                      No sections are configured for this class yet.
                    </p>
                  ) : (
                    formSections.map((section) => {
                      const sectionSubjects = subjectsForSection(section._id);
                      const selectedSubjects = form.sectionSubjects[section._id] || [];
                      return (
                        <div
                          key={section._id}
                          className="rounded-lg border border-slate-200 p-3"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-[13px] font-semibold text-ink">
                              Section {section.name}
                            </p>
                            <span className="text-[11.5px] text-slate-text/60">
                              {selectedSubjects.length} selected
                            </span>
                          </div>
                          {sectionSubjects.length === 0 ? (
                            <p className="text-[12px] text-slate-text/60">
                              No subjects are configured for this section.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                              {sectionSubjects.map((subject) => (
                                <label
                                  key={subject._id}
                                  className="inline-flex items-center gap-2 text-[12.5px] text-slate-text"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedSubjects.includes(subject.name)}
                                    onChange={() =>
                                      toggleSectionSubject(section._id, subject.name)
                                    }
                                  />
                                  {subject.name}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Term
                  </label>
                  <Select value={form.term} onChange={setFormValue("term")}>
                    {TERMS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Planned hours
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={form.totalHours}
                    onChange={setFormValue("totalHours")}
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[12px] font-semibold text-ink">Topics</label>
                  <button
                    type="button"
                    onClick={addTopic}
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-info hover:text-ink"
                  >
                    <ListPlus size={13} /> Add topic
                  </button>
                </div>

                {form.topics.length === 0 ? (
                  <p className="text-[12.5px] text-slate-text/70 rounded-lg bg-paper px-3 py-3">
                    No topics yet. Add the chapters or units covered in this term.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.topics.map((topic, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-slate-200 p-3 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <Input
                            value={topic.title}
                            onChange={setTopic(index, "title")}
                            placeholder={`Topic ${index + 1} title`}
                            className="flex-1"
                          />
                          <Select
                            value={topic.status}
                            onChange={setTopic(index, "status")}
                            className="w-32"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s.replace("_", " ")}
                              </option>
                            ))}
                          </Select>
                          <button
                            type="button"
                            onClick={() => removeTopic(index)}
                            className="p-1.5 rounded-lg hover:bg-alert/10 text-slate-text/60 hover:text-alert"
                            title="Remove topic"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <Input
                          value={topic.description}
                          onChange={setTopic(index, "description")}
                          placeholder="Optional description"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSubmit} disabled={saving}>
                {saving ? "Saving…" : editing ? "Save Changes" : "Create Syllabus"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
