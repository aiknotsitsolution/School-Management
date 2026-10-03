import { useEffect, useMemo, useState } from "react";
import { FileText, Send, CheckCircle2 } from "lucide-react";
import { PageIntro, Card, Pill, Button, toast, Select } from "../../components/UI";
import PageArtwork from "../../components/PageArtwork";
import {
  BarRowChart,
  Donut,
  ProgressRing,
} from "../../components/studentcharts/StudentCharts";
import { toneFor } from "../../components/studentcharts/theme";
import FileDropzone from "../../components/upload/FileDropzone";
import UploadProgress from "../../components/upload/UploadProgress";
import AttachmentLinks from "../../components/upload/AttachmentLinks";
import { api } from "../../lib/api";
import { useCelebrate } from "../../components/celebration/CelebrationProvider";
import { SUBMISSION_XP } from "../../lib/momentum";
import useStudentContext, { fmtDate, dateOf } from "./useStudentContext";

const HW_MAX_SIZE = 10 * 1024 * 1024;
const HW_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf", ".docx", ".pptx"];
const HW_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export default function Homework() {
  const { user } = useStudentContext();
  const [items, setItems] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  // A rejected class-scoped fetch is not an empty list — see Timetable.jsx.
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("all");
  const [active, setActive] = useState(null); // homework being submitted
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const cls = user?.class || "";
    const section = user?.section || "";
    setLoading(true);
    setError("");
    Promise.all([
      api.homework
        .list(`class=${encodeURIComponent(cls)}&section=${encodeURIComponent(section)}`)
        .then(({ data }) => setItems(data || []))
        .catch((err) => {
          setError(err?.message || "We couldn't load your homework.");
          setItems([]);
        }),
      api.homework.submissions
        .myList()
        .then(({ data }) => setSubmissions(data || []))
        .catch(() => setSubmissions([])),
    ]).finally(() => setLoading(false));
  }, [user?.class, user?.section]);

  const subByHomework = useMemo(() => {
    const map = {};
    (submissions || []).forEach((s) => {
      map[String(s.homeworkId)] = s;
    });
    return map;
  }, [submissions]);

  const decorated = useMemo(() => {
    const today = dateOf(new Date());
    return items.map((h) => {
      const sub = subByHomework[String(h._id)];
      return {
        ...h,
        overdue: h.dueDate && dateOf(h.dueDate) < today,
        submission: sub || null,
      };
    });
  }, [items, subByHomework]);

  const subjects = useMemo(() => [...new Set(decorated.map((h) => h.subject).filter(Boolean))], [decorated]);
  const visible = useMemo(
    () => (subject === "all" ? decorated : decorated.filter((h) => h.subject === subject)),
    [decorated, subject],
  );
  const submittedCount = decorated.filter((h) => h.submission).length;

  /** Submission status split for the donut. */
  const statusSplit = useMemo(() => {
    const counts = { Submitted: 0, Reviewed: 0, Pending: 0, Overdue: 0 };
    decorated.forEach((h) => {
      if (h.submission) {
        if (h.submission.status === "Reviewed") counts.Reviewed += 1;
        else counts.Submitted += 1;
      } else if (h.overdue) {
        counts.Overdue += 1;
      } else {
        counts.Pending += 1;
      }
    });
    return [
      { name: "Reviewed", value: counts.Reviewed, color: "success" },
      { name: "Submitted", value: counts.Submitted, color: "info" },
      { name: "Pending", value: counts.Pending, color: "warning" },
      { name: "Overdue", value: counts.Overdue, color: "alert" },
    ].filter((d) => d.value > 0);
  }, [decorated]);

  /** Share of assignments handed in — the headline number for this page. */
  const submitRate = decorated.length ? Math.round((submittedCount / decorated.length) * 100) : 0;

  /** Per-subject completion, weakest first so it reads as "what's left". */
  const subjectProgress = useMemo(() => {
    const buckets = new Map();
    decorated.forEach((h) => {
      const key = h.subject || "General";
      if (!buckets.has(key)) buckets.set(key, { label: key, done: 0, total: 0 });
      const b = buckets.get(key);
      b.total += 1;
      if (h.submission) b.done += 1;
    });
    return [...buckets.values()]
      .map((b) => ({ ...b, value: b.total ? Math.round((b.done / b.total) * 100) : 0 }))
      .sort((a, b) => a.value - b.value);
  }, [decorated]);

  /** Average marks given on reviewed work, as a percentage of max marks. */
  const gradedPct = useMemo(() => {
    const graded = decorated.filter((h) => h.submission?.marks != null && h.maxMarks);
    if (!graded.length) return null;
    const sum = graded.reduce((s, h) => s + (h.submission.marks / h.maxMarks) * 100, 0);
    return Math.round(sum / graded.length);
  }, [decorated]);

  const sorted = useMemo(
    () => [...visible].sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")),
    [visible],
  );

  const celebrate = useCelebrate();

  const submit = async (hw) => {
    const text = draft.trim();
    if (!text && !file) {
      toast("Add a written answer or attach a file before submitting", "error");
      return;
    }
    setSaving(true);
    const dueMs = hw?.dueDate ? new Date(hw.dueDate).getTime() : NaN;
    const isLate = Number.isFinite(dueMs) && dueMs < Date.now();
    try {
      const { data } = await api.homework.submissions.submit(hw._id, { content: text, file });
      setSubmissions((prev) => [data, ...prev.filter((s) => String(s.homeworkId) !== String(hw._id))]);
      setActive(null);
      setDraft("");
      setFile(null);
      toast("Submitted successfully", "success");
      celebrate({
        title: "Homework submitted",
        message: `+${SUBMISSION_XP} XP · ${isLate ? "submitted, but late" : "submitted on time"} — streak safe`,
      });
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="Homework & Assignments" art="homework"
        description="View assignments for your class, submit your work online, and check teacher feedback."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="flex flex-col items-center gap-3 py-2">
            <ProgressRing
              value={submitRate}
              size={148}
              stroke={13}
              color={submitRate >= 75 ? "success" : submitRate >= 40 ? "warning" : "alert"}
              label="Submitted"
              sublabel={`of ${decorated.length} assignments`}
              ariaLabel={`${submitRate} percent of assignments submitted`}
            />
            {statusSplit.length > 0 && (
              <Donut data={statusSplit} height={124} centerValue={decorated.length} centerLabel="Tasks" />
            )}
          </div>
        </Card>

        <Card
          className="lg:col-span-2"
          title="Completion by Subject"
          subtitle="Percentage of assignments handed in, weakest subject first"
        >
            <BarRowChart
              data={subjectProgress}
              height={Math.max(170, subjectProgress.length * 34)}
              color="violet"
              colorFor={(d) => toneFor(d.value)}
              tooltipLabel="Submitted"
              footerFor={(d) => `${d.done} of ${d.total} submitted`}
            />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="p-1">
            <p className="font-display text-3xl font-bold text-ink">{decorated.length}</p>
            <p className="text-[11px] text-slate-text/60 mt-1">Assignments for your class</p>
          </div>
        </Card>
        <Card>
          <p className="font-display text-xl font-bold text-primary-dark">{submittedCount}</p>
          <p className="text-[11px] text-slate-text/60 mt-1">Submitted</p>
        </Card>
        <Card>
          <p className="font-display text-xl font-bold text-alert">
            {decorated.filter((h) => h.submission?.status === "Reviewed").length}
          </p>
          <p className="text-[11px] text-slate-text/60 mt-1">
            Reviewed{gradedPct != null ? ` · avg ${gradedPct}%` : ""}
          </p>
        </Card>
      </div>

      <Card
        title="Assignments"
        action={
          subjects.length > 1 ? (
            <Select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="all">All subjects</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          ) : undefined
        }
      >
        {loading ? (
          <p className="text-[13px] text-slate-text py-10 text-center">Loading…</p>
        ) : error ? (
          <div className="py-10 text-center">
            <p className="text-[15px] font-semibold text-ink">Couldn&apos;t load your homework</p>
            <p className="text-[13px] text-red-500 mt-1">{error}</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-10 text-center">
            <PageArtwork name="homework" size={64} className="mx-auto mb-4" />
            <p className="text-[15px] font-semibold text-ink">No homework assigned</p>
            <p className="text-[13px] text-slate-text/70 mt-1">New assignments from your teachers will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((h) => {
              const sub = h.submission;
              return (
                <div key={h._id} className="rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[14px] font-semibold text-ink">{h.title}</p>
                        <Pill tone="info">{h.subject}</Pill>
                      </div>
                      <p className="text-[12px] text-slate-text/70 mt-1.5 leading-relaxed">{h.description || "No description."}</p>
                      <div className="flex items-center gap-4 mt-2 text-[11.5px] text-slate-text/60 flex-wrap">
                        <span>Assigned {fmtDate(h.assignedDate)}</span>
                        <span>Due <strong className="text-ink">{fmtDate(h.dueDate)}</strong></span>
                        {h.assignedBy && <span>By {h.assignedBy}</span>}
                        <span>Max marks <strong className="text-ink">{h.maxMarks ?? 10}</strong></span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {sub ? (
                        sub.status === "Reviewed" ? (
                          <Pill tone="success">Reviewed · {sub.marks != null ? `${sub.marks}/${h.maxMarks ?? 10}` : "Graded"}</Pill>
                        ) : (
                          <Pill tone="primary">{sub.status}</Pill>
                        )
                      ) : h.overdue ? (
                        <Pill tone="alert">Overdue</Pill>
                      ) : (
                        <Pill tone="neutral">Pending</Pill>
                      )}
                    </div>
                  </div>

                  {sub && (
                    <div className="mt-3 rounded-lg bg-paper/70 p-3 text-[12px] space-y-1.5">
                      <div className="flex items-center gap-1.5 text-slate-text">
                        <CheckCircle2 size={13} className="text-emerald-500" /> Submitted {fmtDate(sub.createdAt)}
                      </div>
                      {sub.content && <p className="text-slate-text/80 whitespace-pre-wrap">{sub.content}</p>}
                      <AttachmentLinks attachments={sub.attachments} />
                      {sub.teacherFeedback && (
                        <div className="mt-1.5 border-t border-slate-200 pt-1.5 flex items-start gap-1.5">
                          <span className="text-primary-dark font-semibold">Teacher:</span>
                          <span className="text-ink">{sub.teacherFeedback}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {!sub && !h.overdue && (
                    <div className="mt-3 flex justify-end">
                      <Button onClick={() => { setActive(h); setDraft(""); }}>
                        <Send size={14} /> Submit
                      </Button>
                    </div>
                  )}
                  {active?._id === h._id && (
                    <div className="mt-3 rounded-xl border border-primary/40 bg-primary/[0.04] p-3 space-y-3">
                      <div>
                        <label className="text-[11px] font-semibold text-ink uppercase tracking-wide">Your response</label>
                        <textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          rows={4}
                          placeholder="Type your answer here… (optional if you attach a file)"
                          className="w-full mt-2 rounded-lg border border-slate-300 bg-white p-3 text-[13px] text-ink outline-none focus:border-primary resize-y"
                        />
                      </div>
                      <FileDropzone
                        value={file}
                        onChange={setFile}
                        accept={HW_EXTENSIONS}
                        mimeTypes={HW_MIME_TYPES}
                        maxSize={HW_MAX_SIZE}
                        label="Attachment (optional)"
                        disabled={saving}
                        helperText="JPG, JPEG, PNG, PDF, DOCX, PPTX · Max 10 MB"
                      />
                      {saving && <UploadProgress label="Submitting…" />}
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" onClick={() => { setActive(null); setDraft(""); setFile(null); }} disabled={saving}>Cancel</Button>
                        <Button onClick={() => submit(h)} disabled={saving || (!draft.trim() && !file)}>
                          {saving ? "Submitting…" : "Submit homework"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <p className="text-[12.5px] text-slate-text/80 flex items-center gap-2">
          <FileText size={14} className="text-slate-text/50" />
          Submissions are recorded for your account. Late submissions are marked automatically by the due date.
        </p>
      </Card>
    </div>
  );
}
