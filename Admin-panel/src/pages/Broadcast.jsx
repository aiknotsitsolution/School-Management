import { useEffect, useState } from "react";
import { MessageSquareText, Mail, History, Send, ShieldAlert } from "lucide-react";
import { PageIntro, Card, Button, Input, Select, toast } from "../components/UI";
import { api } from "../lib/api";

const RECIPIENT_OPTIONS = [
  { value: "audience", label: "School roles" },
  { value: "studentIds", label: "Students (Admission IDs)" },
  { value: "classTags", label: "Classes (e.g. 5-A)" },
  { value: "explicit", label: "Explicit numbers / emails" },
];

const AUDIENCE_OPTIONS = [
  "all",
  "school_admin",
  "teacher",
  "staff",
  "student",
  "parent",
];

const emptyForm = (channel) => ({
  channel,
  subject: "",
  body: "",
  recipientType: "audience",
  audience: ["all"],
  studentIds: "",
  classTags: "",
  explicit: "",
});

function fmtTime(value) {
  return value ? new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) : "—";
}

export default function Broadcast() {
  const [tab, setTab] = useState("sms");
  const [form, setForm] = useState(() => emptyForm("sms"));
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const switchTab = (channel) => {
    setTab(channel);
    setForm((f) => ({ ...f, channel }));
  };

  const loadLogs = () => {
    api.broadcast
      .logs("limit=25")
      .then(({ data }) => {
        setLogs(Array.isArray(data) ? data : []);
        setError("");
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const toList = (raw) =>
    raw
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);

  const handleSend = async () => {
    if (!form.body.trim()) return;
    setSending(true);
    try {
      const payload = {
        subject: form.subject.trim() || undefined,
        body: form.body.trim(),
      };
      if (form.recipientType === "audience") {
        payload.audience = form.audience;
      } else if (form.recipientType === "studentIds") {
        payload.studentIds = toList(form.studentIds);
      } else if (form.recipientType === "classTags") {
        payload.classTags = toList(form.classTags);
      } else {
        if (form.channel === "sms") payload.phoneNumbers = toList(form.explicit);
        else payload.emails = toList(form.explicit);
      }
      const { data } =
        form.channel === "sms"
          ? await api.broadcast.sms(payload)
          : await api.broadcast.email(payload);
      toast(`Broadcast sent (${data.sent} delivered)`);
      loadLogs();
      setForm(emptyForm(form.channel));
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Outreach"
        title="Broadcast"
        description="Send SMS or email campaigns to parents, staff and students in bulk."
      />
      {error && <p className="text-alert text-[13px]">Backend unavailable: {error}</p>}

      <div className="flex gap-2">
        {[
          { key: "sms", icon: MessageSquareText, label: "SMS" },
          { key: "email", icon: Mail, label: "Email" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`px-4 py-2 rounded-full text-[12.5px] font-semibold border transition-colors flex items-center gap-2 ${
              tab === t.key
                ? "bg-primary text-white border-primary"
                : "bg-white text-slate-text border-slate-300 hover:border-ink/30"
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <Card
          title={tab === "sms" ? "Compose SMS" : "Compose Email"}
          action={tab === "sms" ? <MessageSquareText size={16} className="text-slate-text/50" /> : <Mail size={16} className="text-slate-text/50" />}
        >
          <div className="space-y-4">
            {tab === "email" && (
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">Subject</label>
                <Input
                  placeholder="Email subject"
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                />
              </div>
            )}

            <div>
              <label className="text-[12px] font-semibold text-ink mb-1.5 block">Recipients</label>
              <Select
                value={form.recipientType}
                onChange={(e) => setForm((f) => ({ ...f, recipientType: e.target.value }))}
                placeholder="Choose how to target recipients"
              >
                {RECIPIENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>

            {form.recipientType === "audience" && (
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">Roles</label>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCE_OPTIONS.map((r) => {
                    const active = form.audience.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            audience: active
                              ? f.audience.filter((x) => x !== r)
                              : [...f.audience, r],
                          }))
                        }
                        className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors capitalize ${
                          active
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-slate-text border-slate-300 hover:border-ink/30"
                        }`}
                      >
                        {r === "all" ? "Everyone" : r.replace(/_/g, " ")}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {form.recipientType === "studentIds" && (
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Admission IDs (comma separated)
                </label>
                <Input
                  placeholder="SM-2024-0001, SM-2024-0002"
                  value={form.studentIds}
                  onChange={(e) => setForm((f) => ({ ...f, studentIds: e.target.value }))}
                />
              </div>
            )}

            {form.recipientType === "classTags" && (
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Classes (e.g. 5-A, 6-B)
                </label>
                <Input
                  placeholder="5-A, 6-B"
                  value={form.classTags}
                  onChange={(e) => setForm((f) => ({ ...f, classTags: e.target.value }))}
                />
              </div>
            )}

            {form.recipientType === "explicit" && (
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  {tab === "sms" ? "Phone numbers (comma separated)" : "Email addresses (comma separated)"}
                </label>
                <Input
                  placeholder={tab === "sms" ? "+91 98765 43210, +91 98765 43211" : "a@school.com, b@school.com"}
                  value={form.explicit}
                  onChange={(e) => setForm((f) => ({ ...f, explicit: e.target.value }))}
                />
              </div>
            )}

            <div>
              <label className="text-[12px] font-semibold text-ink mb-1.5 block">Message *</label>
              <textarea
                rows={6}
                placeholder={tab === "sms" ? "SMS text (160-char messages recommended)…" : "Write the email body…"}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 p-3 text-[13px] outline-none focus:border-primary resize-none"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-[11.5px] text-slate-text/60 flex items-start gap-1.5">
                <ShieldAlert size={13} className="mt-0.5 shrink-0" />
                Admin actions only. Manual-broadcast cap is 500 recipients per call.
              </p>
              <Button
                variant="primary"
                onClick={handleSend}
                disabled={!form.body.trim() || sending}
              >
                <Send size={15} /> {sending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Recent Broadcasts" action={<History size={16} className="text-slate-text/50" />}>
          {logs.length === 0 ? (
            <p className="text-[13px] text-slate-text py-8 text-center">No broadcasts yet.</p>
          ) : (
            <div className="space-y-2.5 max-h-[52vh] overflow-y-auto">
              {logs.map((l) => (
                <div key={l._id} className="py-2 border-b border-slate-200 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {l.channel === "sms" ? (
                        <MessageSquareText size={13} className="text-primary shrink-0" />
                      ) : (
                        <Mail size={13} className="text-info shrink-0" />
                      )}
                      <span className="text-[13px] font-semibold text-ink truncate uppercase">{l.channel}</span>
                      <span className="text-[11.5px] text-slate-text/70 truncate">
                        {l.subject || l.body}
                      </span>
                    </div>
                    <span className="text-[10.5px] text-slate-text/50 shrink-0">{fmtTime(l.createdAt)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px]">
                    <span className="text-slate-text/70">
                      {l.recipients?.length || 0} recipients
                    </span>
                    <span className="text-success">sent {l.sent || 0}</span>
                    <span className="text-alert">failed {l.failed || 0}</span>
                    {l.skipped > 0 && <span className="text-slate-text/60">skipped {l.skipped}</span>}
                    {l.dryRun && <span className="text-info font-semibold">dry-run</span>}
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 font-semibold capitalize ${
                        l.status === "sent"
                          ? "bg-success/10 text-success"
                          : l.status === "partial"
                            ? "bg-info/10 text-info"
                            : "bg-alert/10 text-alert"
                      }`}
                    >
                      {l.status || "failed"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}