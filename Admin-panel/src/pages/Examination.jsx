import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
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
import { selectSchool } from "../store/selectors";

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

// Typed exam kinds (CLIENT-REQ-021) — mirrors the Exam.kind enum.
const KIND_OPTIONS = [
  { value: "unit_test", label: "Unit Test" },
  { value: "fa", label: "FA (Formative)" },
  { value: "sa", label: "SA (Summative)" },
  { value: "term", label: "Term" },
  { value: "quiz", label: "Quiz" },
  { value: "practical", label: "Practical" },
  { value: "other", label: "Other" },
];
const KIND_LABELS = Object.fromEntries(KIND_OPTIONS.map((k) => [k.value, k.label]));
const TERM_OPTIONS = ["Term 1", "Term 2", "Final"];

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
    passingMarks: 33,
    kind: "other",
    term: "",
    cceTool: "",
  };
}

function emptySubjectSchedule() {
  return {
    subjectId: "",
    subject: "",
    date: "",
    timeSlotId: "",
    startTime: "",
    endTime: "",
    roomId: "",
    room: "",
    maxMarks: 80,
    passingMarks: 33,
  };
}

function emptyBulkForm(school) {
  return {
    board: school?.board || "",
    examFormat: "",
    examFormatType: "",
    classId: "",
    class: "",
    sectionIds: [],
    schedules: [emptySubjectSchedule()],
  };
}

function normalizeExam(exam) {
  return {
    ...exam,
    id: exam._id || exam.id,
    exam: exam.examName || exam.exam || "Exam",
    status: exam.status || "draft",
    kind: exam.kind || "other",
    term: exam.term || "",
    time:
      exam.time ||
      [exam.startTime, exam.endTime].filter(Boolean).join(" – ") ||
      "—",
    // Store the raw value: the display placeholder must never be fed back into
    // the Edit form, otherwise saving an untouched room persists it as data.
    room: exam.room || "",
  };
}

const STATUS_CONFIG = {
  draft: { tone: "neutral", label: "Draft" },
  reviewed: { tone: "primary", label: "Reviewed" },
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
  const school = useSelector(selectSchool);
  const { options: masterClasses, rawItems: rawClasses } = useMasterOptions("classes", CLASS_OPTIONS_FALLBACK);
  const { rawItems: rawSections } = useMasterOptions("sections", SECTION_OPTIONS_FALLBACK);
  const { rawItems: rawSubjects } = useMasterOptions("subjects", []);
  const CLASS_OPTIONS = useMemo(
    () => ["All", ...masterClasses.filter((c) => c !== "All")],
    [masterClasses],
  );
  const [exams, setExams] = useState([]);
  const [cls, setCls] = useState("All");
  const [sec, setSec] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [kindFilter, setKindFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [rollupCls, setRollupCls] = useState("");
  const [rollupTerm, setRollupTerm] = useState("Term 1");
  const [rollup, setRollup] = useState(null);
  const [rollupLoading, setRollupLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [bulkForm, setBulkForm] = useState(() => emptyBulkForm(school));
  const [bulkSaving, setBulkSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [selectedStat, setSelectedStat] = useState(null);
  const [customModal, setCustomModal] = useState(null); // { kind, label, showDescription? } | null
  const selectedClassSections = useMemo(() => {
    const selectedClass = rawClasses.find(
      (item) => String(item._id) === String(form.classId),
    );
    if (!selectedClass) return [];
    return rawSections.filter(
      (section) =>
        String(section.classId || "") === String(selectedClass._id) ||
        (!section.classId && section.className === selectedClass.name),
    );
  }, [form.classId, rawClasses, rawSections]);
  const schoolExamFormats = useMemo(() => {
    if (school?.examFormats?.length) return school.examFormats;
    return school?.examFormat
      ? [{ name: school.examFormat, types: school.examFormatType ? [school.examFormatType] : [] }]
      : [];
  }, [school]);
  const selectedExamFormat = useMemo(
    () => schoolExamFormats.find((item) => item.name === bulkForm.examFormat),
    [schoolExamFormats, bulkForm.examFormat],
  );
  const bulkClassSections = useMemo(() => {
    const selectedClass = rawClasses.find((item) => String(item._id) === String(bulkForm.classId));
    if (!selectedClass) return [];
    return rawSections.filter(
      (section) =>
        String(section.classId || "") === String(selectedClass._id) ||
        (!section.classId && section.className === selectedClass.name),
    );
  }, [bulkForm.classId, rawClasses, rawSections]);
  const bulkClassSubjects = useMemo(() => {
    const sectionIds = new Set(bulkClassSections.map((section) => String(section._id)));
    const uniqueSubjects = new Map();
    rawSubjects
      .filter((subject) => sectionIds.has(String(subject.sectionId || "")))
      .forEach((subject) => {
        const key = String(subject.name || "").trim().toLowerCase();
        if (key && !uniqueSubjects.has(key)) uniqueSubjects.set(key, subject);
      });
    return [...uniqueSubjects.values()];
  }, [bulkClassSections, rawSubjects]);
  const filteredExamSections = useMemo(() => {
    const sections =
      cls === "All"
        ? rawSections
        : rawSections.filter((section) => {
            const selectedClass = rawClasses.find((item) => item.name === cls);
            return selectedClass
              ? String(section.classId || "") === String(selectedClass._id) ||
                  (!section.classId && section.className === selectedClass.name)
              : section.className === cls;
          });
    return [
      "All",
      ...new Set(sections.map((section) => section.name).filter(Boolean)),
    ];
  }, [cls, rawClasses, rawSections]);
  const filteredSubjects = useMemo(
    () =>
      form.sectionId
        ? rawSubjects.filter(
            (subject) =>
              String(subject.sectionId || "") === String(form.sectionId),
          )
        : [],
    [form.sectionId, rawSubjects],
  );
  const modalParentFields =
    customModal?.kind === "sections"
      ? [
          {
            name: "classId",
            label: "Class",
            required: true,
            options: rawClasses
              .filter((item) => item.active !== false)
              .map((item) => ({ value: item._id, label: formatClassLabel(item.name) })),
          },
        ]
      : customModal?.kind === "subjects"
        ? [
            {
              name: "sectionId",
              label: "Section",
              required: true,
              options: selectedClassSections
                .filter((item) => item.active !== false)
                .map((item) => ({ value: item._id, label: item.name })),
            },
          ]
        : [];
  const modalParentDefaults =
    customModal?.kind === "sections"
      ? { classId: form.classId }
      : customModal?.kind === "subjects"
        ? { sectionId: form.sectionId }
        : {};
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
      const matchKind = kindFilter === "All" || (e.kind || "other") === kindFilter;
      const q = query.toLowerCase();
      const matchQuery =
        !q ||
        e.subject.toLowerCase().includes(q) ||
        e.exam.toLowerCase().includes(q) ||
        e.room.toLowerCase().includes(q) ||
        e.class.toLowerCase().includes(q);
      return matchClass && matchSection && matchStatus && matchKind && matchQuery;
    });
  }, [exams, cls, sec, statusFilter, kindFilter, query]);

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
  const statDetails = useMemo(() => {
    if (selectedStat === "classes") {
      const classes = new Map();
      exams.forEach((exam) => {
        const key = `${exam.class}||${exam.section || ""}`;
        const current = classes.get(key) || {
          class: exam.class,
          section: exam.section || "",
          exams: 0,
          subjects: new Set(),
        };
        current.exams += 1;
        current.subjects.add(exam.subject);
        classes.set(key, current);
      });
      return [...classes.values()].sort((a, b) =>
        `${a.class}${a.section}`.localeCompare(`${b.class}${b.section}`, undefined, {
          numeric: true,
        }),
      );
    }
    if (selectedStat === "subjects") {
      const subjects = new Map();
      exams.forEach((exam) => {
        const current = subjects.get(exam.subject) || {
          subject: exam.subject,
          exams: 0,
          classes: new Set(),
        };
        current.exams += 1;
        current.classes.add(
          `${formatClassLabel(exam.class)}${exam.section ? ` · Section ${exam.section}` : ""}`,
        );
        subjects.set(exam.subject, current);
      });
      return [...subjects.values()].sort((a, b) =>
        a.subject.localeCompare(b.subject),
      );
    }
    const rows =
      selectedStat === "upcoming"
        ? exams.filter((exam) => new Date(exam.date) >= new Date())
        : exams;
    return [...rows].sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [exams, selectedStat]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm());
    setBulkForm(emptyBulkForm(school));
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
      // Keep the stored value as-is: defaulting an empty section to "A" would
      // silently attach the exam to a section the user never picked.
      section: item.section || "",
      subjectId: item.subjectId || "",
      subject: item.subject,
      // <input type="date"> only accepts YYYY-MM-DD, but the API returns an
      // ISO datetime — feeding that straight in leaves the field blank.
      date: item.date ? new Date(item.date).toISOString().slice(0, 10) : "",
      timeSlotId: item.timeSlotId || "",
      startTime: item.startTime || "",
      endTime: item.endTime || "",
      roomId: item.roomId || "",
      room: item.room,
      maxMarks: item.maxMarks,
      passingMarks: item.passingMarks ?? 33,
      kind: item.kind || "other",
      term: item.term || "",
      cceTool: item.cceTool || "",
    });
    setShowModal(true);
  };

  const updateForm = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const updateFormFields = (fields) => {
    setForm((f) => ({ ...f, ...fields }));
  };

  const handleSaveBulk = async () => {
    if (bulkSaving) return;
    if (!bulkForm.board || !bulkForm.examFormat || !bulkForm.examFormatType) {
      toast("Select the school board, exam format, and format type", "error");
      return;
    }
    if (!bulkForm.classId || bulkForm.sectionIds.length === 0) {
      toast("Select a class and at least one section", "error");
      return;
    }
    const schedules = bulkForm.schedules.filter((item) => item.subjectId);
    if (!schedules.length) {
      toast("Add at least one subject schedule", "error");
      return;
    }
    const invalidSchedule = schedules.find((item) =>
      !item.date ||
      !item.startTime ||
      !item.endTime ||
      item.endTime <= item.startTime ||
      Number(item.maxMarks) <= 0 ||
      Number(item.passingMarks) < 0 ||
      Number(item.passingMarks) > 100,
    );
    if (invalidSchedule) {
      toast("Each subject needs a date, valid start/end times, positive max marks, and a pass percentage from 0 to 100", "error");
      return;
    }
    if (new Set(schedules.map((item) => String(item.subjectId))).size !== schedules.length) {
      toast("A subject can only be scheduled once per exam format", "error");
      return;
    }

    const selectedClass = rawClasses.find((item) => String(item._id) === String(bulkForm.classId));
    if (!selectedClass) {
      toast("Selected class is no longer available", "error");
      return;
    }

    const selectedSections = bulkForm.sectionIds.map((sectionId) =>
      bulkClassSections.find((item) => String(item._id) === String(sectionId)),
    );
    if (selectedSections.some((section) => !section)) {
      toast("One or more selected sections are no longer available. Please review your selection.", "error");
      return;
    }
    const requests = selectedSections.flatMap((section) => {
      const sectionId = String(section._id);
      return schedules.map((schedule) => {
        const sectionSubject = rawSubjects.find(
          (item) =>
            String(item.sectionId || "") === String(sectionId) &&
            String(item.name || "").trim().toLowerCase() === String(schedule.subject || "").trim().toLowerCase(),
        );
        if (!sectionSubject) {
          return { error: `Subject "${schedule.subject}" is not configured for section ${section.name}.` };
        }
        return {
          examName: bulkForm.examFormatType,
          board: bulkForm.board,
          examFormat: bulkForm.examFormat,
          examFormatType: bulkForm.examFormatType,
          class: selectedClass.name,
          classId: selectedClass._id,
          section: section.name,
          sectionId: section._id,
          subject: schedule.subject,
          subjectId: sectionSubject._id,
          date: schedule.date,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          room: schedule.room,
          ...(schedule.roomId ? { roomId: schedule.roomId } : {}),
          ...(schedule.timeSlotId ? { timeSlotId: schedule.timeSlotId } : {}),
          maxMarks: Number(schedule.maxMarks),
          passingMarks: Number(schedule.passingMarks),
          kind: form.kind || "other",
          term: form.term || "",
          cceTool: form.kind === "fa" || form.kind === "sa" ? form.cceTool || "" : "",
        };
      });
    });
    const subjectMismatch = requests.find((request) => request.error);
    if (subjectMismatch) {
      toast(subjectMismatch.error, "error");
      return;
    }

    const created = [];
    const failures = [];
    setBulkSaving(true);
    try {
      for (const payload of requests) {
        try {
          const response = await api.exams.create(payload);
          created.push(normalizeExam(response.data));
        } catch (error) {
          failures.push({ payload, message: error.message || "Request failed" });
        }
      }

      if (created.length) {
        setExams((previous) => [...previous, ...created]);
      }
      if (failures.length) {
        setShowModal(false);
        toast(
          `${created.length} exam(s) scheduled; ${failures.length} failed. First error: ${failures[0].message}`,
          "error",
        );
        return;
      }

      setShowModal(false);
      setBulkForm(emptyBulkForm(school));
      toast(`${created.length} exam(s) scheduled across ${bulkForm.sectionIds.length} section(s)`);
    } finally {
      setBulkSaving(false);
    }
  };

  const handleSave = async () => {
    if (!editId) {
      await handleSaveBulk();
      return;
    }
    if (!form.exam || !form.class || !form.subject || !form.date) {
      toast("Exam type, class, subject and date are required", "error");
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
      passingMarks: Number(form.passingMarks),
      kind: form.kind || "other",
      term: form.term || "",
      cceTool: form.kind === "fa" || form.kind === "sa" ? form.cceTool || "" : "",
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

  const handleDelete = async (id, label) => {
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    try {
      await api.exams.remove(id);
      setExams((prev) => prev.filter((exam) => exam.id !== id));
      toast("Exam deleted");
    } catch (requestError) {
      toast(requestError.message, "error");
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

  // Term rollup (CLIENT-REQ-021): cross-exam standings for one class+term.
  const loadRollup = async () => {
    if (!rollupCls) {
      toast("Pick a class for the term rollup", "error");
      return;
    }
    setRollupLoading(true);
    try {
      const params = new URLSearchParams({ class: rollupCls, term: rollupTerm });
      if (sec !== "All") params.set("section", sec);
      const { data } = await api.exams.termRollup(params.toString());
      setRollup(data);
    } catch (requestError) {
      toast(requestError.message || "Could not load term rollup", "error");
    } finally {
      setRollupLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="Examination"
        art="exams"
        description="Schedule and manage term examinations across all classes."
        right={
          canManageExams ? (
            <Button variant="primary" onClick={openAdd}>
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
          onClick={() => setSelectedStat("total")}
          className={selectedStat === "total" ? "ring-2 ring-info/40" : ""}
        />
        <StatCard
          icon={Users}
          label="Classes Covered"
          value={String(stats.classes)}
          sub="With active schedule"
          accent="primary"
          onClick={() => setSelectedStat("classes")}
          className={selectedStat === "classes" ? "ring-2 ring-primary/40" : ""}
        />
        <StatCard
          icon={BookOpen}
          label="Subjects"
          value={String(stats.subjects)}
          sub="Unique subjects"
          accent="success"
          onClick={() => setSelectedStat("subjects")}
          className={selectedStat === "subjects" ? "ring-2 ring-success/40" : ""}
        />
        <StatCard
          icon={Calendar}
          label="Upcoming"
          value={String(stats.upcoming)}
          sub="From today onwards"
          accent="alert"
          onClick={() => setSelectedStat("upcoming")}
          className={selectedStat === "upcoming" ? "ring-2 ring-alert/40" : ""}
        />
      </div>

      {selectedStat && (
        <Card
          title={
            {
              total: "All Exam Details",
              classes: "Classes Covered Details",
              subjects: "Subject Details",
              upcoming: "Upcoming Exam Details",
            }[selectedStat]
          }
          subtitle={
            selectedStat === "classes"
              ? `${statDetails.length} class and section combinations`
              : selectedStat === "subjects"
                ? `${statDetails.length} unique subjects`
                : `${statDetails.length} exams`
          }
          action={
            <Button variant="outline" onClick={() => setSelectedStat(null)}>
              <X size={14} /> Close
            </Button>
          }
        >
          {statDetails.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-slate-text/60">
              No data available for this card yet.
            </p>
          ) : selectedStat === "classes" ? (
            <div className="divide-y divide-slate-100">
              {statDetails.map((item) => (
                <button
                  key={`${item.class}-${item.section}`}
                  type="button"
                  onClick={() => {
                    setCls(item.class);
                    setSec(item.section || "All");
                    setSelectedStat(null);
                  }}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-paper/50"
                >
                  <span>
                    <span className="block text-[13px] font-semibold text-ink">
                      {formatClassLabel(item.class)}
                      {item.section ? ` · Section ${item.section}` : ""}
                    </span>
                    <span className="text-[11.5px] text-slate-text/60">
                      {item.subjects.size} subjects
                    </span>
                  </span>
                  <Pill tone="primary">
                    {item.exams} exam{item.exams === 1 ? "" : "s"}
                  </Pill>
                </button>
              ))}
            </div>
          ) : selectedStat === "subjects" ? (
            <div className="divide-y divide-slate-100">
              {statDetails.map((item) => (
                <button
                  key={item.subject}
                  type="button"
                  onClick={() => {
                    setQuery(item.subject);
                    setSelectedStat(null);
                  }}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-paper/50"
                >
                  <span>
                    <span className="block text-[13px] font-semibold text-ink">
                      {item.subject}
                    </span>
                    <span className="text-[11.5px] text-slate-text/60">
                      {[...item.classes].join(", ")}
                    </span>
                  </span>
                  <Pill tone="success">
                    {item.exams} exam{item.exams === 1 ? "" : "s"}
                  </Pill>
                </button>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11.5px] uppercase tracking-wide text-slate-text/60">
                    <th className="py-2.5 pr-3 font-semibold">Exam</th>
                    <th className="py-2.5 pr-3 font-semibold">Class / Section</th>
                    <th className="py-2.5 pr-3 font-semibold">Subject</th>
                    <th className="py-2.5 pr-3 font-semibold">Date</th>
                    <th className="py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {statDetails.map((exam) => (
                    <tr key={exam.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-3 font-medium text-ink">{exam.exam}</td>
                      <td className="py-3 pr-3 text-slate-text">
                        {formatClassLabel(exam.class)}
                        {exam.section ? ` · Section ${exam.section}` : ""}
                      </td>
                      <td className="py-3 pr-3 text-slate-text">{exam.subject}</td>
                      <td className="py-3 pr-3 text-slate-text">{formatDate(exam.date)}</td>
                      <td className="py-3">
                        <Pill tone={STATUS_CONFIG[exam.status]?.tone || "neutral"}>
                          {STATUS_CONFIG[exam.status]?.label || exam.status}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

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
              options={filteredExamSections}
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
            <Select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              className="min-w-[130px]"
            >
              <option value="All">All Kinds</option>
              {KIND_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
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
                <Button variant="primary" className="mt-4" onClick={openAdd}>
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
                  {group.items[0]?.kind && group.items[0].kind !== "other" && (
                    <Pill tone="primary">
                      {KIND_LABELS[group.items[0].kind] || group.items[0].kind}
                    </Pill>
                  )}
                  {group.items[0]?.term && (
                    <Pill tone="neutral">{group.items[0].term}</Pill>
                  )}
                  <span className="text-[12px] text-slate-text/50">
                    {group.items.length} paper
                    {group.items.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide bg-paper/80 border-b border-slate-200">
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
                            className="border-b border-slate-100 last:border-0 hover:bg-paper/40 transition-colors"
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
                                {e.room || "Room to be announced"}
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
                                        className="text-[12.5px] font-medium text-primary-dark hover:underline"
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
                                        onClick={() =>
                                          handleDelete(
                                            e.id,
                                            `${e.exam} — ${e.subject}`,
                                          )
                                        }
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
                                      className="text-[12.5px] font-medium text-primary-dark hover:underline"
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

      {/* ========== TERM ROLLUP ========== */}
      <Card
        title="Term Rollup"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchableSelect
              options={CLASS_OPTIONS.filter((c) => c !== "All")}
              value={rollupCls}
              onChange={setRollupCls}
              renderLabel={(c) => formatClassLabel(c)}
              placeholder="Select class"
              className="min-w-[140px]"
            />
            <Select
              value={rollupTerm}
              onChange={(e) => setRollupTerm(e.target.value)}
              className="min-w-[120px]"
            >
              {TERM_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Button
              variant="outline"
              onClick={loadRollup}
              disabled={rollupLoading}
            >
              {rollupLoading ? "Loading..." : "Load Rollup"}
            </Button>
          </div>
        }
      >
        {!rollup ? (
          <p className="text-[13px] text-slate-text/60">
            Pick a class and term to see cross-exam standings: aggregate
            percentage, grade and rank across every exam tagged with that term
            (respects the section filter above).
          </p>
        ) : rollup.students.length === 0 ? (
          <p className="text-[13px] text-slate-text/60">
            No {rollup.term} exams with marks found for {formatClassLabel(rollup.class)}
            {rollup.section ? ` - ${rollup.section}` : ""}.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide bg-paper/80 border-b border-slate-200">
                  <th className="px-4 py-2.5 font-semibold">Rank</th>
                  <th className="px-4 py-2.5 font-semibold">Student</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Score</th>
                  <th className="px-4 py-2.5 font-semibold text-right">%</th>
                  <th className="px-4 py-2.5 font-semibold text-center">Grade</th>
                  <th className="px-4 py-2.5 font-semibold text-center">Failed</th>
                </tr>
              </thead>
              <tbody>
                {rollup.students.map((row, idx) => (
                  <tr
                    key={row.studentId}
                    className={`border-b border-slate-100 last:border-0 ${idx % 2 ? "bg-paper/40" : ""}`}
                  >
                    <td className="px-4 py-3 font-semibold text-ink">
                      {row.rank}
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink">
                      {row.studentId}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-text">
                      {row.obtained} / {row.max}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">
                      {row.pct}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Pill tone="info">{row.grade}</Pill>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.failedSubjects > 0 ? (
                        <Pill tone="alert">{row.failedSubjects}</Pill>
                      ) : (
                        <span className="text-[12px] text-success font-semibold">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-ink/5 border-t-2 border-ink/20 font-semibold">
                  <td className="px-4 py-3 text-ink" colSpan={6}>
                    Class average: {rollup.classAveragePct ?? "—"}% · {rollup.totalStudents} student
                    {rollup.totalStudents === 1 ? "" : "s"} · {rollup.exams.length} exam
                    {rollup.exams.length === 1 ? "" : "s"}
                    {rollup.session ? ` · ${rollup.session}` : ""}
                  </td>
                </tr>
              </tfoot>
            </table>
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
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  {editId ? "Edit Exam" : "Schedule Exam"}
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  {editId
                    ? "Update this scheduled subject exam."
                    : "Select the exam structure, then add subject schedules for one or more sections."}
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
              {editId ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-[12px] font-semibold text-ink">Exam Type</label>
                    <MasterSelect
                      kind="exam-types"
                      label="Exam Type"
                      placeholder="Select exam type"
                      value={form.examTypeId}
                      fallbackLabel={form.exam}
                      onChange={(id, item) => updateFormFields({ examTypeId: id, exam: item ? item.name : "" })}
                      canAdd
                      onAdd={() => setCustomModal({ kind: "exam-types", label: "Exam Type" })}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[12px] font-semibold text-ink">Class</label>
                      <MasterSelect
                        kind="classes"
                        label="Class"
                        placeholder="Select class"
                        value={form.classId}
                        fallbackLabel={form.class ? formatClassLabel(form.class) : ""}
                        renderLabel={(item) => formatClassLabel(item.name)}
                        onChange={(id, item) => updateFormFields({ classId: id, class: item?.name || "", sectionId: "", section: "", subjectId: "", subject: "" })}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[12px] font-semibold text-ink">Section</label>
                      <MasterSelect
                        kind="sections"
                        label="Section"
                        placeholder="Select section"
                        value={form.sectionId}
                        fallbackLabel={form.section}
                        disabled={!form.classId}
                        filterItems={() => selectedClassSections}
                        onChange={(id, item) => updateFormFields({ sectionId: id, section: item?.name || "", subjectId: "", subject: "" })}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[12px] font-semibold text-ink">Subject</label>
                      <MasterSelect
                        kind="subjects"
                        label="Subject"
                        placeholder="Select subject"
                        value={form.subjectId}
                        fallbackLabel={form.subject}
                        disabled={!form.sectionId}
                        filterItems={() => filteredSubjects}
                        onChange={(id, item) => updateFormFields({ subjectId: id, subject: item?.name || "" })}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[12px] font-semibold text-ink">Exam Day</label>
                      <Input type="date" value={form.date} onChange={(event) => updateForm("date", event.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[12px] font-semibold text-ink">Start Time</label>
                      <Input type="time" value={form.startTime} onChange={(event) => updateForm("startTime", event.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[12px] font-semibold text-ink">End Time</label>
                      <Input type="time" value={form.endTime} onChange={(event) => updateForm("endTime", event.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[12px] font-semibold text-ink">Room</label>
                      <MasterSelect
                        kind="rooms"
                        label="Room"
                        placeholder="Select room"
                        value={form.roomId}
                        fallbackLabel={form.room}
                        onChange={(id, item) => updateFormFields({ roomId: id, room: item?.name || "" })}
                        canAdd
                        onAdd={() => setCustomModal({ kind: "rooms", label: "Room" })}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[12px] font-semibold text-ink">Maximum Marks</label>
                      <Input type="number" min="1" value={form.maxMarks} onChange={(event) => updateForm("maxMarks", event.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[12px] font-semibold text-ink">Passing Percentage (%)</label>
                      <Input type="number" min="0" max="100" value={form.passingMarks ?? 33} onChange={(event) => updateForm("passingMarks", event.target.value)} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-[12px] font-semibold text-ink">Board</label>
                      <Select value={bulkForm.board} disabled={!school?.board} onChange={(event) => setBulkForm((current) => ({ ...current, board: event.target.value, examFormat: "", examFormatType: "" }))}>
                        <option value="">{school?.board ? "Select board" : "Configure board first"}</option>
                        {school?.board && <option value={school.board}>{school.board}</option>}
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[12px] font-semibold text-ink">Category · Exam Format</label>
                      <Select value={bulkForm.examFormat} disabled={!bulkForm.board || !schoolExamFormats.length} onChange={(event) => setBulkForm((current) => ({ ...current, examFormat: event.target.value, examFormatType: "" }))}>
                        <option value="">Select exam format</option>
                        {schoolExamFormats.map((format, index) => <option key={`${format.name}-${index}`} value={format.name}>{format.name}</option>)}
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[12px] font-semibold text-ink">Subcategory · Format Type</label>
                      <Select value={bulkForm.examFormatType} disabled={!bulkForm.examFormat} onChange={(event) => setBulkForm((current) => ({ ...current, examFormatType: event.target.value }))}>
                        <option value="">Select format type</option>
                        {(selectedExamFormat?.types || []).map((type, index) => <option key={`${type}-${index}`} value={type}>{type}</option>)}
                      </Select>
                    </div>
                  </div>
                  {!schoolExamFormats.length && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">Add an exam format and format type in Manage School → School Board before scheduling.</p>}

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[12px] font-semibold text-ink">Class</label>
                      <MasterSelect kind="classes" label="Class" placeholder="Select class" value={bulkForm.classId} fallbackLabel={bulkForm.class ? formatClassLabel(bulkForm.class) : ""} renderLabel={(item) => formatClassLabel(item.name)} onChange={(id, item) => setBulkForm((current) => ({ ...current, classId: id, class: item?.name || "", sectionIds: [], schedules: [emptySubjectSchedule()] }))} />
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <label className="text-[12px] font-semibold text-ink">Sections · Select multiple</label>
                        <div className="flex gap-2">
                          <button type="button" disabled={!bulkClassSections.length} className="text-[11px] font-semibold text-primary hover:underline disabled:opacity-40" onClick={() => setBulkForm((current) => ({ ...current, sectionIds: bulkClassSections.filter((section) => section.active !== false).map((section) => String(section._id)) }))}>Select all</button>
                          <button type="button" className="text-[11px] font-semibold text-slate-text hover:underline" onClick={() => setBulkForm((current) => ({ ...current, sectionIds: [] }))}>Clear</button>
                        </div>
                      </div>
                      {!bulkForm.classId ? <p className="text-[12px] text-slate-text/60">Select a class first.</p> : !bulkClassSections.length ? <p className="text-[12px] text-slate-text/60">No sections configured for this class.</p> : (
                        <div className="flex flex-wrap gap-2">
                          {bulkClassSections.filter((section) => section.active !== false).map((section) => {
                            const sectionId = String(section._id);
                            return <label key={sectionId} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] text-ink hover:bg-slate-50"><input type="checkbox" checked={bulkForm.sectionIds.includes(sectionId)} onChange={() => setBulkForm((current) => ({ ...current, sectionIds: current.sectionIds.includes(sectionId) ? current.sectionIds.filter((id) => id !== sectionId) : [...current.sectionIds, sectionId] }))} />{section.name}</label>;
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><h4 className="text-[13px] font-semibold text-ink">Subject schedules</h4><p className="text-[11.5px] text-slate-text/60">Set day, time, room, and marks separately for each subject. Schedules are copied to every selected section.</p></div>
                      <Button variant="outline" className="text-[11px]" disabled={!bulkForm.classId} onClick={() => setBulkForm((current) => ({ ...current, schedules: [...current.schedules, emptySubjectSchedule()] }))}><Plus size={13} /> Add Subject</Button>
                    </div>
                    {bulkForm.schedules.map((schedule, index) => (
                      <div key={`schedule-${index}`} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                        <div className="mb-3 flex items-center justify-between"><p className="text-[12px] font-semibold text-ink">Subject {index + 1}</p>{bulkForm.schedules.length > 1 && <button type="button" onClick={() => setBulkForm((current) => ({ ...current, schedules: current.schedules.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded-lg p-1.5 text-alert hover:bg-alert/10" aria-label={`Remove subject ${index + 1}`}><X size={14} /></button>}</div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <div><label className="mb-1 block text-[11px] font-semibold text-ink">Subject</label><Select value={schedule.subjectId} disabled={!bulkForm.classId} onChange={(event) => { const subject = bulkClassSubjects.find((item) => String(item._id) === event.target.value); setBulkForm((current) => ({ ...current, schedules: current.schedules.map((row, rowIndex) => rowIndex === index ? { ...row, subjectId: event.target.value, subject: subject?.name || "" } : row) })); }}><option value="">Select subject</option>{bulkClassSubjects.map((subject) => <option key={subject._id} value={subject._id}>{subject.name}</option>)}</Select></div>
                          <div><label className="mb-1 block text-[11px] font-semibold text-ink">Exam Day</label><Input type="date" value={schedule.date} onChange={(event) => setBulkForm((current) => ({ ...current, schedules: current.schedules.map((row, rowIndex) => rowIndex === index ? { ...row, date: event.target.value } : row) }))} /></div>
                          <div><label className="mb-1 block text-[11px] font-semibold text-ink">Room</label><MasterSelect kind="rooms" label="Room" placeholder="Select room" value={schedule.roomId} fallbackLabel={schedule.room} onChange={(id, item) => setBulkForm((current) => ({ ...current, schedules: current.schedules.map((row, rowIndex) => rowIndex === index ? { ...row, roomId: id, room: item?.name || "" } : row) }))} canAdd onAdd={() => setCustomModal({ kind: "rooms", label: "Room", bulk: true, scheduleIndex: index })} /></div>
                          <div><label className="mb-1 block text-[11px] font-semibold text-ink">Start Time</label><Input type="time" value={schedule.startTime} onChange={(event) => setBulkForm((current) => ({ ...current, schedules: current.schedules.map((row, rowIndex) => rowIndex === index ? { ...row, startTime: event.target.value } : row) }))} /></div>
                          <div><label className="mb-1 block text-[11px] font-semibold text-ink">End Time</label><Input type="time" value={schedule.endTime} onChange={(event) => setBulkForm((current) => ({ ...current, schedules: current.schedules.map((row, rowIndex) => rowIndex === index ? { ...row, endTime: event.target.value } : row) }))} /></div>
                          <div><label className="mb-1 block text-[11px] font-semibold text-ink">Maximum Marks</label><Input type="number" min="1" value={schedule.maxMarks} onChange={(event) => setBulkForm((current) => ({ ...current, schedules: current.schedules.map((row, rowIndex) => rowIndex === index ? { ...row, maxMarks: event.target.value } : row) }))} /></div>
                          <div><label className="mb-1 block text-[11px] font-semibold text-ink">Passing Percentage (%)</label><Input type="number" min="0" max="100" value={schedule.passingMarks} onChange={(event) => setBulkForm((current) => ({ ...current, schedules: current.schedules.map((row, rowIndex) => rowIndex === index ? { ...row, passingMarks: event.target.value } : row) }))} /></div>
                        </div>
                      </div>
                    ))}
                  </div>

                </>
              )}
            </div>
            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="outline" disabled={bulkSaving} onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={
                  bulkSaving ||
                  (editId
                    ? !form.exam || !form.class || !form.subject || !form.date
                    : !bulkForm.board ||
                      !bulkForm.examFormat ||
                      !bulkForm.examFormatType ||
                      !bulkForm.classId ||
                      bulkForm.sectionIds.length === 0 ||
                      !bulkForm.schedules.some((schedule) =>
                        schedule.subjectId &&
                        schedule.date &&
                        schedule.startTime &&
                        schedule.endTime &&
                        Number(schedule.maxMarks) > 0 &&
                        Number(schedule.passingMarks) >= 0 &&
                        Number(schedule.passingMarks) <= 100,
                      ))
                }
              >
                <Save size={15} /> {bulkSaving ? "Scheduling..." : editId ? "Update Exam" : "Schedule Exams"}
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
          parentFields={modalParentFields}
          defaultParentValues={modalParentDefaults}
          onClose={() => setCustomModal(null)}
          onCreated={(created) => {
            invalidateMasterCache(customModal.kind);
            if (customModal.kind === "rooms" && customModal.bulk) {
              setBulkForm((current) => ({
                ...current,
                schedules: current.schedules.map((schedule, index) =>
                  index === customModal.scheduleIndex
                    ? { ...schedule, roomId: created._id, room: created.name }
                    : schedule,
                ),
              }));
            } else if (customModal.kind === "subjects") {
              updateFormFields({ subjectId: created._id, subject: created.name });
            } else if (customModal.kind === "exam-types") {
              updateFormFields({ examTypeId: created._id, exam: created.name });
            } else if (customModal.kind === "rooms") {
              updateFormFields({ roomId: created._id, room: created.name });
            } else if (customModal.kind === "classes") {
              updateFormFields({ classId: created._id, class: created.name });
            } else if (customModal.kind === "sections") {
              updateFormFields({
                ...(created.classId
                  ? {
                      classId: created.classId,
                      class:
                        rawClasses.find(
                          (item) => String(item._id) === String(created.classId),
                        )?.name || form.class,
                    }
                  : {}),
                sectionId: created._id,
                section: created.name,
                subjectId: "",
                subject: "",
              });
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
//         right={<Button variant="primary"><Plus size={15} /> Schedule Exam</Button>}
//       />

//       {Object.entries(grouped).map(([cls, exams]) => (
//         <Card key={cls} title={`${cls} — ${exams[0].exam}`}>
//           <div className="overflow-x-auto -mx-5">
//             <table className="w-full text-[13px]">
//               <thead>
//                 <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-slate-200">
//                   <th className="px-5 py-2.5 font-semibold">Subject</th>
//                   <th className="px-5 py-2.5 font-semibold">Date</th>
//                   <th className="px-5 py-2.5 font-semibold">Time</th>
//                   <th className="px-5 py-2.5 font-semibold">Room</th>
//                   <th className="px-5 py-2.5 font-semibold">Max Marks</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {exams.map((e) => (
//                   <tr key={e.id} className="border-b border-slate-100 last:border-0">
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
