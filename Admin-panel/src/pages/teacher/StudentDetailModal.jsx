import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  UserRound,
  FileText,
  ClipboardList,
  GraduationCap,
  Users,
  BarChart3,
  Heart,
  ShieldAlert,
  Trophy,
} from "lucide-react";
import { Avatar, Pill, Card, toast } from "../../components/UI";
import { LoadingBlock, EmptyBlock, ErrorBlock } from "../../components/StateViews";
import { api } from "../../lib/api";
import { fmtDate } from "./useTeacherContext";

const TABS = [
  { key: "profile", label: "Profile", icon: UserRound },
  { key: "attendance", label: "Attendance", icon: BarChart3 },
  { key: "academic", label: "Academic", icon: GraduationCap },
  { key: "homework", label: "Homework", icon: ClipboardList },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "health", label: "Health", icon: Heart },
  { key: "behavior", label: "Behavior", icon: ShieldAlert },
  { key: "achievements", label: "Achievements", icon: Trophy },
  { key: "teachers", label: "Teachers", icon: Users },
];

export default function StudentDetailModal({ studentId, onClose }) {
  const [tab, setTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [student, setStudent] = useState(null);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    api.students
      .get(studentId)
      .then(({ data }) => setStudent(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (!studentId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {loading ? (
          <div className="p-10">
            <LoadingBlock />
          </div>
        ) : error ? (
          <div className="p-10">
            <ErrorBlock message={error} />
            <button onClick={onClose} className="mt-4 text-[13px] font-semibold text-info hover:underline mx-auto block">
              Close
            </button>
          </div>
        ) : student ? (
          <>
            {/* Header */}
            <div className="bg-ink px-6 py-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3.5">
                <Avatar src={student.photoUrl} name={student.name} size={48} />
                <div>
                  <h3 className="font-display font-semibold text-white text-[17px]">
                    {student.name}
                  </h3>
                  <p className="text-white/60 text-[12.5px]">
                    {student.admissionNo} · Class {student.class}-{student.section}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 text-white/70"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-black/[0.06] shrink-0 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-[12.5px] font-semibold whitespace-nowrap border-b-2 transition-colors ${
                    tab === t.key
                      ? "border-info text-info"
                      : "border-transparent text-slate-text/60 hover:text-ink"
                  }`}
                >
                  <t.icon size={14} />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6">
              {tab === "profile" && <ProfileTab student={student} />}
              {tab === "attendance" && <AttendanceTab studentId={student.admissionNo || studentId} />}
              {tab === "academic" && <AcademicTab studentId={student.admissionNo || studentId} student={student} />}
              {tab === "homework" && <HomeworkTab student={student} />}
              {tab === "documents" && <DocumentsTab studentId={student.admissionNo || studentId} />}
              {tab === "health" && <HealthTab studentId={student.admissionNo || studentId} />}
              {tab === "behavior" && <BehaviorTab student={student} />}
              {tab === "achievements" && <AchievementsTab student={student} />}
              {tab === "teachers" && <TeachersTab student={student} />}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Profile Tab                                                        */
/* ------------------------------------------------------------------ */
function ProfileTab({ student }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Row label="Roll No" value={student.rollNo || "—"} />
        <Row label="Date of Birth" value={fmtDate(student.dob)} />
        <Row label="Gender" value={student.gender || "—"} />
        <Row label="Blood Group" value={student.bloodGroup || "—"} />
        <Row label="Admission Date" value={fmtDate(student.admissionDate)} />
        <Row label="Status" value={student.status || "—"} />
      </div>
      <Row label="Address" value={student.address || "—"} />
      <div className="border-t border-black/[0.06] pt-4 mt-4">
        <p className="text-[11px] font-semibold text-slate-text/50 uppercase tracking-wide mb-3">
          Parent / Guardian
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Row label="Father's Name" value={student.parentName || "—"} />
          <Row label="Contact" value={student.parentContact || "—"} />
          <Row label="Mother's Name" value={student.motherName || "—"} />
          <Row label="Guardian Contact" value={student.guardianContact || "—"} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Attendance Tab                                                      */
/* ------------------------------------------------------------------ */
function AttendanceTab({ studentId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.attendance
      .list(`studentId=${studentId}`)
      .then(({ data }) => setData(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;

  const records = Array.isArray(data) ? data : [];
  const present = records.filter((r) => r.status === "Present").length;
  const absent = records.filter((r) => r.status === "Absent").length;
  const leave = records.filter((r) => r.status === "Leave").length;
  const total = records.length;
  const pct = total > 0 ? ((present / total) * 100).toFixed(1) : "—";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <MiniStat label="Present" value={present} tone="success" />
        <MiniStat label="Absent" value={absent} tone="alert" />
        <MiniStat label="Leave" value={leave} tone="amber" />
        <MiniStat label="Attendance %" value={`${pct}%`} tone="info" />
      </div>
      {records.length === 0 ? (
        <EmptyBlock message="No attendance records found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                <th className="pb-2 font-semibold">Date</th>
                <th className="pb-2 font-semibold">Status</th>
                <th className="pb-2 font-semibold">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 30).map((r, i) => (
                <tr key={i} className="border-t border-black/[0.04]">
                  <td className="py-2 text-slate-text/80">{fmtDate(r.date)}</td>
                  <td className="py-2">
                    <Pill tone={r.status === "Present" ? "success" : r.status === "Absent" ? "alert" : "amber"}>
                      {r.status}
                    </Pill>
                  </td>
                  <td className="py-2 text-slate-text/60">{r.remarks || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Academic Tab                                                        */
/* ------------------------------------------------------------------ */
function AcademicTab({ studentId, student }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [marks, setMarks] = useState([]);

  useEffect(() => {
    setLoading(true);
    api.marks
      .reportCard(`studentId=${studentId}`)
      .then(({ data }) => setMarks(Array.isArray(data) ? data : data?.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  if (marks.length === 0) return <EmptyBlock message="No marks records found." />;

  const subjects = {};
  marks.forEach((m) => {
    if (!subjects[m.subject]) subjects[m.subject] = [];
    subjects[m.subject].push(m);
  });

  return (
    <div className="space-y-4">
      {Object.entries(subjects).map(([subject, records]) => (
        <Card key={subject} title={subject}>
          <div className="space-y-2">
            {records.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-[12.5px] py-1.5 border-b border-black/[0.04] last:border-0">
                <span className="text-slate-text/80">{r.examName || r.exam || "—"}</span>
                <span className="font-semibold text-ink">
                  {r.marksObtained}/{r.maxMarks}
                  {r.marksObtained != null && r.maxMarks
                    ? ` (${((r.marksObtained / r.maxMarks) * 100).toFixed(0)}%)`
                    : ""}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Homework Tab                                                        */
/* ------------------------------------------------------------------ */
function HomeworkTab({ student }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!student) return;
    setLoading(true);
    const q = `class=${student.class}&section=${student.section}`;
    Promise.all([
      api.homework.list(q).then(({ data }) => Array.isArray(data) ? data : data?.data || []),
      api.homework.submissions.classList(q).then(({ data }) => Array.isArray(data) ? data : data?.data || []),
    ])
      .then(([homeworks, subs]) => {
        const subMap = {};
        subs.forEach((s) => {
          const hwId = String(s.homeworkId || s.homework || "");
          const isThisStudent = String(s.admissionNo || "") === String(student.admissionNo || "")
            || String(s.studentId || "") === String(student.admissionNo || "");
          if (isThisStudent && hwId) {
            subMap[hwId] = s;
          }
        });
        setItems(homeworks.map((h) => ({
          ...h,
          submission: subMap[String(h._id)] || null,
        })));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [student]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  if (items.length === 0) return <EmptyBlock message="No homework records found." />;

  return (
    <div className="space-y-3">
      {items.slice(0, 20).map((h) => {
        const sub = h.submission;
        const tone = sub
          ? sub.status === "Submitted" || sub.status === "Graded"
            ? "success"
            : "amber"
          : "alert";
        return (
          <div
            key={h._id}
            onClick={() => navigate("/teacher/homework")}
            className="flex items-center justify-between px-4 py-3 rounded-xl bg-paper/60 border border-black/[0.04] cursor-pointer hover:bg-paper transition-colors"
          >
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink truncate">
                {h.title || "Untitled"}
              </p>
              <p className="text-[11.5px] text-slate-text/60 mt-0.5">
                {fmtDate(h.dueDate || h.createdAt)}
                {h.subject ? ` · ${h.subject}` : ""}
              </p>
            </div>
            <Pill tone={tone}>
              {sub ? sub.status || "Submitted" : "Not Submitted"}
            </Pill>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Documents Tab                                                       */
/* ------------------------------------------------------------------ */
function DocumentsTab({ studentId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    setLoading(true);
    api.documents
      .list(`studentId=${studentId}`)
      .then(({ data }) => setDocs(Array.isArray(data) ? data : data?.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  if (docs.length === 0) return <EmptyBlock message="No documents uploaded." />;

  return (
    <div className="space-y-3">
      {docs.map((d) => (
        <div
          key={d._id}
          className="flex items-center justify-between px-4 py-3 rounded-xl bg-paper/60 border border-black/[0.04]"
        >
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink truncate">{d.title}</p>
            <p className="text-[11.5px] text-slate-text/60 mt-0.5">
              {d.category || "other"} · {fmtDate(d.createdAt)}
            </p>
          </div>
          {d.url && (
            <a
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-semibold text-info hover:underline"
            >
              Open
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Teachers Tab                                                        */
/* ------------------------------------------------------------------ */
function TeachersTab({ student }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teachers, setTeachers] = useState([]);

  useEffect(() => {
    if (!student) return;
    setLoading(true);
    api.assignments
      .list(`class=${student.class}&section=${student.section}`)
      .then(({ data }) => setTeachers(Array.isArray(data) ? data : data?.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [student]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  if (teachers.length === 0) return <EmptyBlock message="No teacher assignments found." />;

  return (
    <div className="space-y-3">
      {teachers.map((a, i) => (
        <div
          key={a._id || i}
          className="flex items-center justify-between px-4 py-3 rounded-xl bg-paper/60 border border-black/[0.04]"
        >
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink truncate">
              {a.teacherName || a.name || "—"}
            </p>
            <p className="text-[11.5px] text-slate-text/60 mt-0.5">
              {a.type === "class_teacher" ? "Class Teacher" : "Subject Teacher"}
              {a.subject ? ` · ${a.subject}` : ""}
            </p>
          </div>
          <Pill tone={a.type === "class_teacher" ? "info" : "neutral"}>
            {a.type === "class_teacher" ? "Class Teacher" : a.type || "Teaching"}
          </Pill>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Health Tab                                                          */
/* ------------------------------------------------------------------ */
function HealthTab({ studentId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.health
      .get(studentId)
      .then(({ data }) => { setHealth(data); setForm(data || {}); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  const startEdit = () => { setForm(health || {}); setEditing(true); };
  const cancelEdit = () => { setForm(health || {}); setEditing(false); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.health.upsert({ studentId, ...form });
      setHealth({ ...form });
      setEditing(false);
      toast("Health record saved");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const set = (key) => (e) => {
    const val = e.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: val }));
  };

  const setArray = (key) => (e) => {
    const val = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
    setForm((f) => ({ ...f, [key]: val }));
  };

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-ink">Edit Health Record</p>
          <div className="flex gap-2">
            <button onClick={cancelEdit} className="text-[12px] font-semibold text-slate-text/60 hover:text-ink">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="text-[12px] font-semibold text-white bg-info px-3 py-1.5 rounded-lg hover:bg-info/90 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-slate-text/50 uppercase">Blood Group</label>
            <input value={form.bloodGroup || ""} onChange={set("bloodGroup")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px]" placeholder="O+, A-, etc." />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-text/50 uppercase">Height (cm)</label>
            <input type="number" value={form.heightCm || ""} onChange={set("heightCm")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px]" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-text/50 uppercase">Weight (kg)</label>
            <input type="number" value={form.weightKg || ""} onChange={set("weightKg")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px]" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-text/50 uppercase">Emergency Medical Contact</label>
            <input value={form.emergencyMedicalContact || ""} onChange={set("emergencyMedicalContact")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px]" />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-text/50 uppercase">Allergies (comma separated)</label>
          <input value={(form.allergies || []).join(", ")} onChange={setArray("allergies")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px]" placeholder="e.g. Peanuts, Penicillin" />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-text/50 uppercase">Chronic Conditions (comma separated)</label>
          <input value={(form.chronicConditions || []).join(", ")} onChange={setArray("chronicConditions")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px]" placeholder="e.g. Asthma, Diabetes" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-slate-text/50 uppercase">Vision Notes</label>
            <input value={form.visionNotes || ""} onChange={set("visionNotes")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px]" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-text/50 uppercase">Hearing Notes</label>
            <input value={form.hearingNotes || ""} onChange={set("hearingNotes")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px]" />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-text/50 uppercase">Notes</label>
          <textarea value={form.notes || ""} onChange={set("notes")} rows={3} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-ink">Health Record</p>
        <button onClick={startEdit} className="text-[12px] font-semibold text-info hover:underline">Edit</button>
      </div>
      {!health ? (
        <EmptyBlock message="No health records on file." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Row label="Blood Group" value={health.bloodGroup || "—"} />
            <Row label="Height" value={health.heightCm ? `${health.heightCm} cm` : "—"} />
            <Row label="Weight" value={health.weightKg ? `${health.weightKg} kg` : "—"} />
            <Row label="Emergency Contact" value={health.emergencyMedicalContact || "—"} />
          </div>
          {health.allergies?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-text/50 uppercase tracking-wide mb-1.5">Allergies</p>
              <div className="flex flex-wrap gap-1.5">
                {health.allergies.map((a, i) => <Pill key={i} tone="alert">{a}</Pill>)}
              </div>
            </div>
          )}
          {health.chronicConditions?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-text/50 uppercase tracking-wide mb-1.5">Chronic Conditions</p>
              <div className="flex flex-wrap gap-1.5">
                {health.chronicConditions.map((c, i) => <Pill key={i} tone="amber">{c}</Pill>)}
              </div>
            </div>
          )}
          {health.medications?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-text/50 uppercase tracking-wide mb-1.5">Medications</p>
              <div className="space-y-1.5">
                {health.medications.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12.5px]">
                    <Pill tone="info">{m.name}</Pill>
                    <span className="text-slate-text/60">{m.dosage} · {m.frequency}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Row label="Vision" value={health.visionNotes || "—"} />
            <Row label="Hearing" value={health.hearingNotes || "—"} />
          </div>
          {health.notes && <Row label="Notes" value={health.notes} />}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Behavior Tab                                                        */
/* ------------------------------------------------------------------ */
function BehaviorTab({ student }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [records, setRecords] = useState([]);

  useEffect(() => {
    if (!student) return;
    setLoading(true);
    api.behavior
      .list(`studentId=${student.admissionNo}`)
      .then(({ data }) => setRecords(Array.isArray(data) ? data : data?.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [student]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  if (records.length === 0) return <EmptyBlock message="No behavior records found." />;

  const typeTone = {
    incident: "alert", positive: "success", warning: "amber",
    detention: "alert", suspension: "alert", other: "neutral",
  };
  const severityTone = { low: "info", medium: "amber", high: "alert", critical: "alert" };

  return (
    <div className="space-y-3">
      {records.map((r) => (
        <div key={r._id} className="px-4 py-3 rounded-xl bg-paper/60 border border-black/[0.04]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-[13px] font-semibold text-ink">{r.title}</p>
            <div className="flex gap-1.5 shrink-0">
              <Pill tone={typeTone[r.type] || "neutral"}>{r.type}</Pill>
              <Pill tone={severityTone[r.severity] || "neutral"}>{r.severity}</Pill>
            </div>
          </div>
          <p className="text-[11.5px] text-slate-text/60">{fmtDate(r.date)}</p>
          {r.description && <p className="text-[12px] text-slate-text/80 mt-1">{r.description}</p>}
          {r.actionTaken && <p className="text-[12px] text-slate-text/80 mt-1"><span className="font-semibold">Action:</span> {r.actionTaken}</p>}
          {r.resolved && <Pill tone="success">Resolved</Pill>}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Achievements Tab                                                    */
/* ------------------------------------------------------------------ */
function AchievementsTab({ student }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!student) return;
    setLoading(true);
    api.achievements
      .list(`studentId=${student.admissionNo}`)
      .then(({ data }) => setItems(Array.isArray(data) ? data : data?.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [student]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  if (items.length === 0) return <EmptyBlock message="No achievements recorded." />;

  const catTone = {
    academic: "info", sports: "success", arts: "amber",
    citizenship: "success", attendance: "info", other: "neutral",
  };

  return (
    <div className="space-y-3">
      {items.map((a) => (
        <div key={a._id} className="flex items-start justify-between gap-3 px-4 py-3 rounded-xl bg-paper/60 border border-black/[0.04]">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink">{a.title}</p>
            <p className="text-[11.5px] text-slate-text/60 mt-0.5">{fmtDate(a.date)}</p>
            {a.description && <p className="text-[12px] text-slate-text/80 mt-1">{a.description}</p>}
          </div>
          <Pill tone={catTone[a.category] || "neutral"}>{a.category}</Pill>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                      */
/* ------------------------------------------------------------------ */
function Row({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-text/50 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-[13px] font-medium text-ink mt-0.5 break-words">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, tone = "info" }) {
  const tones = {
    success: "bg-success/10 text-success",
    alert: "bg-alert/10 text-alert",
    amber: "bg-amber/15 text-amber-dark",
    info: "bg-info/10 text-info",
  };
  return (
    <div className={`rounded-xl px-3 py-2.5 ${tones[tone] || tones.info}`}>
      <p className="text-[22px] font-bold font-display leading-none">{value}</p>
      <p className="text-[11px] font-medium mt-1 opacity-80">{label}</p>
    </div>
  );
}
