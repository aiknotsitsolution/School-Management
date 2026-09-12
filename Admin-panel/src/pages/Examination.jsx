import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  MapPin,
  Calendar,
  Clock,
  Search,
  X,
  Save,
  ClipboardList,
  BookOpen,
  Users,
  Pencil,
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
import { api } from "../lib/api";
import MasterSelect from "../components/MasterSelect";
import { invalidateMasterCache } from "../lib/masterCache";
import { usePermission } from "../lib/permissions";
import CustomMasterModal from "../components/CustomMasterModal";
import { useMasterOptions } from "../hooks/useMasterOptions";

const SYSTEM_CLASSES = [
  "Nursery",
  "LKG",
  "UKG",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11-Sci",
  "11-Com",
  "12-Sci",
  "12-Com",
];

const CLASS_OPTIONS_FALLBACK = ["All", ...SYSTEM_CLASSES];

const SECTION_OPTIONS_FALLBACK = ["All", "A", "B", "C"];

function formatClassLabel(c) {
  if (["Nursery", "LKG", "UKG"].includes(c)) return c;
  return `Class ${c}`;
}

function emptyForm() {
  return {
    examTypeId: "",
    exam: "",
    classId: "",
    class: "",
    sectionId: "",
    section: "",
    subjectId: "",
    subject: "",
    date: "",
    timeSlotId: "",
    startTime: "",
    endTime: "",
    roomId: "",
    room: "",
    maxMarks: 80,
  };
}

function normalizeExam(exam) {
  return {
    ...exam,
    id: exam._id || exam.id,
    exam: exam.examName || exam.exam || "Exam",
    status: exam.status || "draft",
    time:
      exam.time ||
      [exam.startTime, exam.endTime].filter(Boolean).join(" – ") ||
      "—",
    room: exam.room || "Room to be announced",
  };
}

const STATUS_CONFIG = {
  draft: { tone: "neutral", label: "Draft" },
  reviewed: { tone: "amber", label: "Reviewed" },
  published: { tone: "success", label: "Published" },
};

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    weekday: "short",
  });
}

function formatTimeSlot(item) {
  if (!item) return "";
  if (item.label) return item.label;
  const fmt = (t) => {
    if (!t) return "";
    const [hh, mm] = t.split(":").map(Number);
    const suffix = hh >= 12 ? "PM" : "AM";
    const hour = hh % 12 === 0 ? 12 : hh % 12;
    return `${hour}:${String(mm).padStart(2, "0")} ${suffix}`;
  };
  return [fmt(item.startTime), fmt(item.endTime)].filter(Boolean).join(" – ");
}

export default function Examination() {
  const { options: masterClasses } = useMasterOptions("classes", CLASS_OPTIONS_FALLBACK);
  const { options: masterSections, rawItems: rawSections } = useMasterOptions("sections", SECTION_OPTIONS_FALLBACK);
  const CLASS_OPTIONS = ["All", ...masterClasses.filter((c) => c !== "All")];
  const SECTION_OPTIONS = ["All", ...masterSections.filter((s) => s !== "All")];
  const [exams, setExams] = useState([]);
  const [cls, setCls] = useState("All");
  const [sec, setSec] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [customModal, setCustomModal] = useState(null); // { kind, label, showDescription? } | null
  const filteredSections = useMemo(() => {
    if (cls === "All") return SECTION_OPTIONS;
    return ["All", ...[...new Set(rawSections.filter((s) => s.className === cls).map((s) => s.name))]];
  }, [cls, SECTION_OPTIONS, rawSections]);
  const canManageExams = usePermission("exams:write");

  useEffect(() => {
    api.exams
      .list()
      .then(({ data }) => setExams((data || []).map(normalizeExam)))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return exams.filter((e) => {
      const matchClass = cls === "All" || e.class === cls;
      const matchSection = sec === "All" || (e.section || "") === sec;
      const matchStatus =
        statusFilter === "All" || e.status === statusFilter;
      const q = query.toLowerCase();
      const matchQuery =
        !q ||
        e.subject.toLowerCase().includes(q) ||
        e.exam.toLowerCase().includes(q) ||
        e.room.toLowerCase().includes(q) ||
        e.class.toLowerCase().includes(q);
      return matchClass && matchSection && matchStatus && matchQuery;
    });
  }, [exams, cls, sec, statusFilter, query]);

  const grouped = useMemo(() => {
    return filtered.reduce((acc, e) => {
      const key = `${e.class}||${e.section || ""}||${e.exam}`;
      if (!acc[key])
        acc[key] = { class: e.class, section: e.section || "", exam: e.exam, items: [] };
      acc[key].items.push(e);
      return acc;
    }, {});
  }, [filtered]);

  const stats = useMemo(() => {
    const classes = new Set(exams.map((e) => `${e.class}|${e.section || ""}`));
    const subjects = new Set(exams.map((e) => e.subject));
    const upcoming = exams.filter((e) => new Date(e.date) >= new Date()).length;
    return {
      total: exams.length,
      classes: classes.size,
      subjects: subjects.size,
      upcoming,
    };
  }, [exams]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setForm({
      examTypeId: item.examTypeId || "",
      exam: item.exam,
      classId: item.classId || "",
      class: item.class,
      sectionId: item.sectionId || "",
      section: item.section || "A",
      subjectId: item.subjectId || "",
      subject: item.subject,
      date: item.date,
      timeSlotId: item.timeSlotId || "",
      startTime: item.startTime || "",
      endTime: item.endTime || "",
      roomId: item.roomId || "",
      room: item.room,
      maxMarks: item.maxMarks,
    });
    setShowModal(true);
  };

  const updateForm = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const updateFormFields = (fields) => {
    setForm((f) => ({ ...f, ...fields }));
  };

  const handleSave = async () => {
    if (!form.date || !form.subject) {
      toast("Fill all required exam fields", "error");
      return;
    }
    const [startTime, endTime] = form.startTime || form.endTime
      ? [form.startTime, form.endTime]
      : [undefined, undefined];
    const payload = {
      examName: form.exam,
      class: form.class,
      section: form.section,
      subject: form.subject,
      date: form.date,
      startTime,
      endTime,
      room: form.room,
      maxMarks: Number(form.maxMarks) || 80,
      ...(form.examTypeId ? { examTypeId: form.examTypeId } : {}),
      ...(form.classId ? { classId: form.classId } : {}),
      ...(form.sectionId ? { sectionId: form.sectionId } : {}),
      ...(form.subjectId ? { subjectId: form.subjectId } : {}),
      ...(form.roomId ? { roomId: form.roomId } : {}),
      ...(form.timeSlotId ? { timeSlotId: form.timeSlotId } : {}),
    };
    try {
      const response = editId
        ? await api.exams.update(editId, payload)
        : await api.exams.create(payload);
      const savedExam = normalizeExam(response.data);
      setExams((prev) =>
        editId
          ? prev.map((exam) => (exam.id === editId ? savedExam : exam))
          : [...prev, savedExam],
      );
      setShowModal(false);
      setForm(emptyForm());
      setEditId(null);
      toast(editId ? "Exam updated" : "Exam scheduled");
    } catch (requestError) {
      toast(requestError.message, "error");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.exams.remove(id);
      setExams((prev) => prev.filter((exam) => exam.id !== id));
    } catch (requestError) {
      window.alert(requestError.message);
    }
  };

  const handleStatusChange = async (exam, status) => {
    try {
      const { data } = await api.exams.updateStatus(exam.id, status);
      setExams((prev) =>
        prev.map((item) =>
          item.id === exam.id ? normalizeExam(data) : item,
        ),
      );
      toast(`Exam marked as ${STATUS_CONFIG[status]?.label || status}`);
    } catch (requestError) {
      toast(requestError.message, "error");
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="Examination"
        description="Schedule and manage term examinations across all classes."
        right={
          canManageExams ? (
            <Button variant="amber" onClick={openAdd}>
              <Plus size={15} /> Schedule Exam
            </Button>
          ) : null
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ClipboardList}
          label="Total Exams"
          value={String(stats.total)}
          sub="All scheduled papers"
          accent="info"
        />
        <StatCard
          icon={Users}
          label="Classes Covered"
          value={String(stats.classes)}
          sub="With active schedule"
          accent="amber"
        />
        <StatCard
          icon={BookOpen}
          label="Subjects"
          value={String(stats.subjects)}
          sub="Unique subjects"
          accent="success"
        />
        <StatCard
          icon={Calendar}
          label="Upcoming"
          value={String(stats.upcoming)}
          sub="From today onwards"
          accent="alert"
        />
      </div>

      {/* Filters */}
      <Card
        title="Exam Schedule"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
              />
              <Input
                placeholder="Search subject, exam, room..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 w-52"
              />
            </div>
            <SearchableSelect
              options={CLASS_OPTIONS}
              value={cls}
              onChange={(v) => { setCls(v); setSec("All"); }}
              renderLabel={(c) => (c === "All" ? "All Classes" : formatClassLabel(c))}
              placeholder="All Classes"
              className="min-w-[140px]"
            />
            <SearchableSelect
              options={filteredSections}
              value={sec}
              onChange={setSec}
              renderLabel={(s) => (s === "All" ? "All Sections" : `Section ${s}`)}
              placeholder="All Sections"
              className="min-w-[110px]"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-w-[120px]"
            >
              {["All", "draft", "reviewed", "published"].map((s) => (
                <option key={s} value={s}>
                  {s === "All" ? "All Statuses" : STATUS_CONFIG[s].label}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        {Object.keys(grouped).length === 0 ? (
          <div className="py-14 text-center">
            <ClipboardList
              size={36}
              className="mx-auto text-slate-text/30 mb-3"
            />
            <p className="text-[14px] font-medium text-ink">No exams found</p>
<p className="text-[13px] text-slate-text/60 mt-1">
                Try changing filters or schedule a new exam.
              </p>
              {canManageExams && (
                <Button variant="amber" className="mt-4" onClick={openAdd}>
                  <Plus size={15} /> Schedule Exam
                </Button>
              )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.values(grouped).map((group) => (
              <div key={`${group.class}-${group.section}-${group.exam}`}>
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="font-display font-semibold text-ink text-[14.5px]">
                    {formatClassLabel(group.class)}
                    {group.section ? ` · Section ${group.section}` : ""}
                  </h4>
                  <Pill tone="info">{group.exam}</Pill>
                  <span className="text-[12px] text-slate-text/50">
                    {group.items.length} paper
                    {group.items.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-black/[0.06]">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide bg-paper/80 border-b border-black/[0.06]">
                        <th className="px-4 py-2.5 font-semibold">Subject</th>
                        <th className="px-4 py-2.5 font-semibold">Date</th>
                        <th className="px-4 py-2.5 font-semibold">Time</th>
                        <th className="px-4 py-2.5 font-semibold">Room</th>
                        <th className="px-4 py-2.5 font-semibold">Max Marks</th>
                        <th className="px-4 py-2.5 font-semibold">Status</th>
                        <th className="px-4 py-2.5 font-semibold text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items
                        .sort((a, b) => new Date(a.date) - new Date(b.date))
                        .map((e) => (
                          <tr
                            key={e.id}
                            className="border-b border-black/[0.04] last:border-0 hover:bg-paper/40 transition-colors"
                          >
                            <td className="px-4 py-3 font-semibold text-ink">
                              {e.subject}
                            </td>
                            <td className="px-4 py-3 text-slate-text">
                              <span className="inline-flex items-center gap-1.5">
                                <Calendar
                                  size={13}
                                  className="text-slate-text/50"
                                />
                                {formatDate(e.date)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-text">
                              <span className="inline-flex items-center gap-1.5">
                                <Clock
                                  size={13}
                                  className="text-slate-text/50"
                                />
                                {e.time}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-text">
                              <span className="inline-flex items-center gap-1">
                                <MapPin
                                  size={13}
                                  className="text-slate-text/50"
                                />
                                {e.room}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Pill tone="info">{e.maxMarks} marks</Pill>
                            </td>
                            <td className="px-4 py-3">
                              <Pill tone={STATUS_CONFIG[e.status]?.tone}>
                                {STATUS_CONFIG[e.status]?.label || e.status}
                              </Pill>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {canManageExams ? (
                                <div className="inline-flex items-center justify-end gap-2 flex-wrap">
                                  {e.status === "draft" && (
                                    <>
                                      <button
                                        onClick={() =>
                                          handleStatusChange(e, "reviewed")
                                        }
                                        className="text-[12.5px] font-medium text-amber-dark hover:underline"
                                      >
                                        Mark Reviewed
                                      </button>
                                      <button
                                        onClick={() => openEdit(e)}
                                        className="text-[12.5px] font-medium text-info hover:underline inline-flex items-center gap-1"
                                      >
                                        <Pencil size={12} /> Edit
                                      </button>
                                      <button
                                        onClick={() => handleDelete(e.id)}
                                        className="text-[12.5px] font-medium text-alert hover:underline"
                                      >
                                        Delete
                                      </button>
                                    </>
                                  )}
                                  {e.status === "reviewed" && (
                                    <>
                                      <button
                                        onClick={() => handleStatusChange(e, "draft")}
                                        className="text-[12.5px] font-medium text-slate-text hover:underline"
                                      >
                                        Back to Draft
                                      </button>
                                      <button
                                        onClick={() => handleStatusChange(e, "published")}
                                        className="text-[12.5px] font-semibold text-success hover:underline"
                                      >
                                        Publish Results
                                      </button>
                                      <button
                                        onClick={() => openEdit(e)}
                                        className="text-[12.5px] font-medium text-info hover:underline inline-flex items-center gap-1"
                                      >
                                        <Pencil size={12} /> Edit
                                      </button>
                                    </>
                                  )}
                                  {e.status === "published" && (
                                    <button
                                      onClick={() => handleStatusChange(e, "reviewed")}
                                      className="text-[12.5px] font-medium text-amber-dark hover:underline"
                                    >
                                      Unpublish
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[12px] text-slate-text/40">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ========== SCHEDULE / EDIT MODAL ========== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  {editId ? "Edit Exam" : "Schedule Exam"}
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

            {/* Form */}
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Exam Type
                </label>
                <MasterSelect
                  kind="exam-types"
                  label="Exam Type"
                  placeholder="Select exam type"
                  value={form.examTypeId}
                  fallbackLabel={form.exam}
                  onChange={(id, item) =>
                    updateFormFields({ examTypeId: id, exam: item ? item.name : "" })
                  }
                  canAdd
                  onAdd={() => setCustomModal({ kind: "exam-types", label: "Exam Type" })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Class
                  </label>
                  <MasterSelect
                    kind="classes"
                    label="Class"
                    placeholder="Select class"
                    value={form.classId}
                    fallbackLabel={form.class ? formatClassLabel(form.class) : ""}
                    renderLabel={(item) => formatClassLabel(item.name)}
                    onChange={(id, item) =>
                      updateFormFields({ classId: id, class: item ? item.name : "" })
                    }
                    canAdd
                    onAdd={() => setCustomModal({ kind: "classes", label: "Class" })}
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Section
                  </label>
                  <MasterSelect
                    kind="sections"
                    label="Section"
                    placeholder="Select section"
                    value={form.sectionId}
                    fallbackLabel={form.section || ""}
                    filterItems={(rows) =>
                      Array.from(new Map(rows.map((r) => [r.name, r])).values())
                    }
                    onChange={(id, item) =>
                      updateFormFields({ sectionId: id, section: item ? item.name : "" })
                    }
                    canAdd
                    onAdd={() => setCustomModal({ kind: "sections", label: "Section" })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Subject
                  </label>
                  <MasterSelect
                    kind="subjects"
                    label="Subject"
                    placeholder="Select subject"
                    searchLabel="Search subjects..."
                    value={form.subjectId}
                    fallbackLabel={form.subject}
                    onChange={(id, item) =>
                      updateFormFields({ subjectId: id, subject: item ? item.name : "" })
                    }
                    canAdd
                    onAdd={() =>
                      setCustomModal({ kind: "subjects", label: "Subject", showDescription: true })
                    }
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Date
                  </label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => updateForm("date", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Time
                  </label>
                  <MasterSelect
                    kind="time-slots"
                    label="Time"
                    placeholder="Select time slot"
                    value={form.timeSlotId}
                    renderLabel={formatTimeSlot}
                    fallbackLabel={
                      form.startTime || form.endTime
                        ? [form.startTime, form.endTime].filter(Boolean).join(" – ")
                        : ""
                    }
                    onChange={(id, item) =>
                      updateFormFields({
                        timeSlotId: id,
                        startTime: item ? item.startTime : "",
                        endTime: item ? item.endTime : "",
                      })
                    }
                    canAdd
                    onAdd={() => setCustomModal({ kind: "time-slots", label: "Time Slot" })}
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Room
                  </label>
                  <MasterSelect
                    kind="rooms"
                    label="Room"
                    placeholder="Select room"
                    value={form.roomId}
                    fallbackLabel={form.room}
                    onChange={(id, item) =>
                      updateFormFields({ roomId: id, room: item ? item.name : "" })
                    }
                    canAdd
                    onAdd={() => setCustomModal({ kind: "rooms", label: "Room" })}
                  />
                </div>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Max Marks
                </label>
                <Input
                  type="number"
                  min="10"
                  max="100"
                  value={form.maxMarks}
                  onChange={(e) => updateForm("maxMarks", e.target.value)}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-black/[0.06] flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                variant="amber"
                onClick={handleSave}
                disabled={!form.date || !form.subject}
              >
                <Save size={15} /> {editId ? "Update" : "Schedule"} Exam
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========== ADD CUSTOM MASTER MODAL ========== */}
      {customModal && (
        <CustomMasterModal
          kind={customModal.kind}
          label={customModal.label}
          showDescription={customModal.showDescription}
          onClose={() => setCustomModal(null)}
          onCreated={(created) => {
            invalidateMasterCache(customModal.kind);
            if (customModal.kind === "subjects") {
              updateFormFields({ subjectId: created._id, subject: created.name });
            } else if (customModal.kind === "exam-types") {
              updateFormFields({ examTypeId: created._id, exam: created.name });
            } else if (customModal.kind === "rooms") {
              updateFormFields({ roomId: created._id, room: created.name });
            } else if (customModal.kind === "classes") {
              updateFormFields({ classId: created._id, class: created.name });
            } else if (customModal.kind === "sections") {
              updateFormFields({ sectionId: created._id, section: created.name });
            } else if (customModal.kind === "time-slots") {
              updateFormFields({
                timeSlotId: created._id,
                startTime: created.startTime || "",
                endTime: created.endTime || "",
              });
            }
          }}
        />
      )}
    </div>
  );
}

// import { Plus, MapPin } from "lucide-react";
// import { PageIntro, Card, Button, Pill } from "../components/UI";

// export default function Examination() {
//   const grouped = examSchedule.reduce((acc, e) => {
//     acc[e.class] = acc[e.class] || [];
//     acc[e.class].push(e);
//     return acc;
//   }, {});

//   return (
//     <div className="space-y-6">
//       <PageIntro
//         eyebrow="Academics"
//         title="Examination"
//         description="Term 2 mid-term examination schedule across classes."
//         right={<Button variant="amber"><Plus size={15} /> Schedule Exam</Button>}
//       />

//       {Object.entries(grouped).map(([cls, exams]) => (
//         <Card key={cls} title={`${cls} — ${exams[0].exam}`}>
//           <div className="overflow-x-auto -mx-5">
//             <table className="w-full text-[13px]">
//               <thead>
//                 <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/[0.06]">
//                   <th className="px-5 py-2.5 font-semibold">Subject</th>
//                   <th className="px-5 py-2.5 font-semibold">Date</th>
//                   <th className="px-5 py-2.5 font-semibold">Time</th>
//                   <th className="px-5 py-2.5 font-semibold">Room</th>
//                   <th className="px-5 py-2.5 font-semibold">Max Marks</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {exams.map((e) => (
//                   <tr key={e.id} className="border-b border-black/[0.04] last:border-0">
//                     <td className="px-5 py-3 font-semibold text-ink">{e.subject}</td>
//                     <td className="px-5 py-3 text-slate-text">{e.date}</td>
//                     <td className="px-5 py-3 text-slate-text">{e.time}</td>
//                     <td className="px-5 py-3 text-slate-text"><span className="inline-flex items-center gap-1"><MapPin size={12} />{e.room}</span></td>
//                     <td className="px-5 py-3"><Pill tone="info">{e.maxMarks} marks</Pill></td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </Card>
//       ))}
//     </div>
//   );
// }
