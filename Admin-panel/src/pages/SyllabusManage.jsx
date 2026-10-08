import { useCallback, useEffect, useState } from "react";
import { ClipboardList, ListPlus, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { PageIntro, Card, Button, Input, Select, toast } from "../components/UI";
import { LoadingBlock, EmptyBlock, ErrorBlock } from "../components/StateViews";
import { Pagination } from "../components/Pagination";
import { usePermission } from "../lib/permissions"; 
import { useMasterOptions } from "../hooks/useMasterOptions";
import { api } from "../lib/api";

const TERMS = ["Term 1", "Term 2", "Full Year"];
const STATUSES = ["pending", "in_progress", "completed"];

// Tab order for classes: Nursery/LKG/UKG first, then 1…10 numerically (not
// lexicographically, so 2 comes before 10), then the 11/12 streams.
const stageOrder = { nursery: 0, lkg: 1, ukg: 2 };
const classSortKey = (name) => {
  const raw = String(name || "").trim();
  const lower = raw.toLowerCase();
  if (lower in stageOrder) return [stageOrder[lower], 0, ""];
  const digits = raw.match(/^\d+/);
  if (digits) return [3, Number(digits[0]), raw];
  return [4, 0, raw];
};
const byClassOrder = (a, b) => {
  const ka = classSortKey(a);
  const kb = classSortKey(b);
  return ka[0] - kb[0] || ka[1] - kb[1] || ka[2].localeCompare(kb[2]);
};

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

export default function SyllabusManage({ embedded = false }) {
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

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // One unfiltered fetch: the class tabs need a per-class count (a class with
  // no syllabus yet must still appear as a 0 tab) and switching tabs should be
  // instant. The server still scopes the read — a student only ever gets their
  // own section, a teacher their assigned class.
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.syllabus.list();
      setRows(res?.data || []);
    } catch (err) {
      setError(err.message || "Could not load syllabus");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
  // Class tabs: every active class in teaching order, each carrying its row
  // count so a class that has no syllabus yet is still reachable and creatable.
  const classTabs = [...classOptions].sort(byClassOrder);
  const pickClass = (value) => {
    setPage(1);
    setFilters((current) => ({ ...current, class: value, sectionId: "", subject: "" }));
  };
  const countsByClass = rows.reduce((acc, row) => {
    const key = row.class || "";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const visibleRows = rows.filter(
    (row) =>
      (!filters.class || row.class === filters.class) &&
      (!filters.sectionId || String(row.sectionId) === String(filters.sectionId)) &&
      (!filters.subject || row.subject === filters.subject) &&
      (!filters.term || row.term === filters.term),
  );

  // Pagination. The table renders class → section → subject with rowSpan, so the
  // slice happens FIRST and the page is then re-grouped: a rowSpan can never
  // point at a row on another page. A class split across a page break simply
  // shows its class cell again at the top of the next page.
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = visibleRows.slice((safePage - 1) * pageSize, safePage * pageSize);

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
    setPage(1);
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "class" ? { sectionId: "", subject: "" } : {}),
      ...(key === "sectionId" ? { subject: "" } : {}),
    }));
  };

  const openCreate = () => {
    setEditing(null);
    // Start in the class whose tab is open, so "add here" lands on this class.
    setForm({ ...EMPTY_FORM, class: filters.class, sectionSubjects: {}, topics: [] });
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
  const groupedRows = pageRows.reduce((classes, row) => {
    let classGroup = classes.find((group) => group.name === row.class);
    if (!classGroup) {
      classGroup = { name: row.class, sections: [] };
      classes.push(classGroup);
    }
    const sectionKey = row.sectionId || row.sectionName || "unassigned";
    let sectionGroup = classGroup.sections.find((group) => group.key === sectionKey);
    if (!sectionGroup) {
      sectionGroup = {
        key: sectionKey,
        name: row.sectionName || "Unassigned",
        subjects: [],
      };
      classGroup.sections.push(sectionGroup);
    }
    sectionGroup.subjects.push(row);
    return classes;
  }, []);

  return (
    <div className="space-y-5">
      {embedded ? (
        canWrite && (
          <div className="flex justify-end">
            <Button variant="primary" onClick={openCreate}>
              <Plus size={15} /> Add Syllabus
            </Button>
          </div>
        )
      ) : (
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
      )}

      {/* Class tabs — the class selector for this page. Counts come from the
          one full fetch, so a class with no syllabus yet still shows 0 and can
          be opened to add its first rows. */}
      <div className="flex flex-wrap items-center gap-2">
        {[{ label: "All classes", value: "" }, ...classTabs.map((name) => ({ label: name, value: name }))].map(
          (tab) => {
            const active = filters.class === tab.value;
            const count = tab.value ? countsByClass[tab.value] || 0 : rows.length;
            return (
              <button
                key={tab.value || "__all__"}
                type="button"
                onClick={() => pickClass(tab.value)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] font-semibold transition-colors ${
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-slate-200 bg-white text-slate-text hover:border-primary/40 hover:text-ink"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? "bg-white/20 text-white" : "bg-paper text-slate-text/70"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          },
        )}
      </div>

      <Card
        title="Syllabus list"
        action={
          <div className="flex flex-wrap items-center gap-2">
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
        ) : visibleRows.length === 0 ? (
          <EmptyBlock
            title={
              filters.class || filters.subject || filters.term
                ? "No syllabus matches these filters"
                : "No syllabus has been planned yet"
            }
          />
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-y border-slate-200 bg-paper/70 text-[11px] uppercase tracking-wide text-slate-text/70">
                  <th className="px-5 py-3 font-semibold">Class</th>
                  <th className="px-4 py-3 font-semibold">Section</th>
                  <th className="px-4 py-3 font-semibold">Subject</th>
                  <th className="px-4 py-3 font-semibold">Term</th>
                  <th className="px-4 py-3 font-semibold">Topics Progress</th>
                  <th className="px-4 py-3 font-semibold">Planned Hours</th>
                  {canWrite && <th className="px-4 py-3 text-right font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {groupedRows.map((classGroup) => {
                  const classRowCount = classGroup.sections.reduce(
                    (total, section) => total + section.subjects.length,
                    0,
                  );
                  return classGroup.sections.flatMap((sectionGroup, sectionIndex) =>
                    sectionGroup.subjects.map((row, subjectIndex) => {
                      const totalTopics = (row.topics || []).length;
                      const done = doneCount(row);
                      return (
                        <tr
                          key={row._id}
                          className="border-b border-slate-100 transition-colors hover:bg-paper/40"
                        >
                          {sectionIndex === 0 && subjectIndex === 0 && (
                            <td
                              rowSpan={classRowCount}
                              className="border-r border-slate-100 bg-primary/[0.03] px-5 py-3 align-top font-semibold text-ink"
                            >
                              {classGroup.name || "—"}
                            </td>
                          )}
                          {subjectIndex === 0 && (
                            <td
                              rowSpan={sectionGroup.subjects.length}
                              className="border-r border-slate-100 bg-paper/40 px-4 py-3 align-top font-medium text-ink"
                            >
                              {sectionGroup.name}
                              <span className="ml-2 text-[10px] text-slate-text/50">
                                {sectionGroup.subjects.length}
                              </span>
                            </td>
                          )}
                          <td className="px-4 py-3 font-semibold text-ink">
                            {row.subject || "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-text">
                            {row.term || "Full Year"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex min-w-[130px] items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper">
                                <div
                                  className="h-full bg-success"
                                  style={{
                                    width: totalTopics
                                      ? `${Math.round((done / totalTopics) * 100)}%`
                                      : "0%",
                                  }}
                                />
                              </div>
                              <span className="whitespace-nowrap text-[11px] text-slate-text">
                                {done}/{totalTopics}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-text">
                            {row.totalHours || 0} hrs
                          </td>
                          {canWrite && (
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => openEdit(row)}
                                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-info hover:bg-info/10"
                                >
                                  <Pencil size={13} /> Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(row)}
                                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-alert hover:bg-alert/10"
                                >
                                  <Trash2 size={13} /> Delete
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    }),
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && visibleRows.length > 0 && (
          <>
            <div className="flex items-center justify-between pt-2">
              <p className="text-[12px] text-slate-text/55">
                Showing {visibleRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, visibleRows.length)} of {visibleRows.length}
              </p>
              <Select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="text-[12px]"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </Select>
            </div>
            <Pagination page={safePage} pages={totalPages} onPage={setPage} info={false} />
          </>
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
