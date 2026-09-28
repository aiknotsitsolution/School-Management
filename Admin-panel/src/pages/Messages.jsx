import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { CalendarDays, Send, ChevronLeft, Plus, X, MessagesSquare } from "lucide-react";
import { PageIntro, Card, Button, Input, toast } from "../components/UI";
import { api } from "../lib/api";
import { selectUser } from "../store/selectors";

function fmtTime(value) {
  return value ? new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) : "—";
}

export default function Messages() {
  const user = useSelector(selectUser);
  const [threads, setThreads] = useState([]);
  const [error, setError] = useState("");
  const [active, setActive] = useState(null);
  const [reply, setReply] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ subject: "", studentId: "" });
  const [sending, setSending] = useState(false);

  const loadThreads = () => {
    api.messages
      .list()
      .then(({ data }) => {
        setThreads(Array.isArray(data) ? data : []);
        setError("");
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openThread = (id) => {
    api.messages
      .get(id)
      .then(({ data }) => {
        setActive(data);
        setThreads((prev) => prev.map((t) => (t._id === id ? data : t)));
      })
      .catch((e) => {
        setError(e.message);
        setActive(null);
      });
  };

  const sendReply = async () => {
    if (!reply.trim() || !active) return;
    setSending(true);
    try {
      const { data } = await api.messages.reply(active._id, reply.trim());
      setActive(data);
      setThreads((prev) => prev.map((t) => (t._id === data._id ? data : t)));
      setReply("");
      toast("Reply sent");
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const createThread = async () => {
    if (!newForm.subject.trim() || !newForm.studentId.trim()) return;
    setSending(true);
    try {
      const { data } = await api.messages.create({
        subject: newForm.subject.trim(),
        studentId: newForm.studentId.trim(),
      });
      setThreads((prev) => [data, ...prev]);
      setShowNew(false);
      setNewForm({ subject: "", studentId: "" });
      openThread(data._id);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const messages = useMemo(() => active?.messages || [], [active]);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Communication"
        title="Message Teacher"
        description="Parent and teacher conversations about a student's progress."
        right={
          <Button variant="primary" onClick={() => setShowNew(true)}>
            <Plus size={15} /> New Thread
          </Button>
        }
      />
      {error && <p className="text-alert text-[13px]">Backend unavailable: {error}</p>}

      <div className="grid lg:grid-cols-[320px_1fr] gap-5 items-start">
        {/* Thread list */}
        <Card className="lg:sticky lg:top-4">
          <div className="space-y-1 max-h-[62vh] overflow-y-auto">
            {threads.length === 0 ? (
              <p className="text-[13px] text-slate-text py-8 text-center">No conversations yet.</p>
            ) : (
              threads.map((t) => (
                <button
                  key={t._id}
                  onClick={() => openThread(t._id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                    active?._id === t._id ? "bg-primary/10" : "hover:bg-paper"
                  }`}
                >
                  <p className="text-[13px] font-semibold text-ink truncate">{t.subject}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-[11px] text-slate-text/60 truncate">
                      Student: {t.studentId}
                    </p>
                    <p className="text-[10.5px] text-slate-text/40 shrink-0 ml-2">
                      {t.messages?.length || 0} msg
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Conversation */}
        <Card>
          {!active ? (
            <div className="py-16 text-center">
              <MessagesSquare size={40} className="mx-auto text-slate-text/30 mb-3" />
              <p className="text-[14px] font-semibold text-ink">Select a conversation</p>
              <p className="text-[13px] text-slate-text/70 mt-1">
                Messages with parents and teachers about a student appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-ink truncate">{active.subject}</p>
                  <p className="text-[11.5px] text-slate-text/60">
                    Student: {active.studentId} · {messages.length} message{messages.length === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  onClick={() => setActive(null)}
                  className="p-2 rounded-lg hover:bg-paper text-slate-text/60 lg:hidden"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>

              <div className="space-y-3 py-4 max-h-[46vh] overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-[13px] text-slate-text/60 py-6 text-center">
                    No messages yet. Start the conversation.
                  </p>
                ) : (
                  messages.map((m, i) => {
                    const mine = String(m.senderId) === String(user?.id);
                    return (
                      <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                            mine ? "bg-primary text-white" : "bg-paper border border-slate-200 text-ink"
                          }`}
                        >
                          <p className="text-[10.5px] opacity-70 mb-0.5">
                            {m.senderName || m.senderRole || "User"} · {fmtTime(m.at)}
                          </p>
                          <p className="whitespace-pre-wrap">{m.body}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-200">
                <Input
                  placeholder="Type a reply…"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendReply()}
                />
                <Button variant="primary" onClick={sendReply} disabled={!reply.trim() || sending}>
                  <Send size={15} /> Send
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* New thread modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setShowNew(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">New Conversation</h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  Parents: your child&apos;s Admission ID. Teachers: the student you teach.
                </p>
              </div>
              <button onClick={() => setShowNew(false)} className="p-2 rounded-lg hover:bg-paper text-slate-text">
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">Subject *</label>
                <Input
                  placeholder="e.g. Progress check for Arya"
                  value={newForm.subject}
                  onChange={(e) => setNewForm((f) => ({ ...f, subject: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">Student Admission ID *</label>
                <Input
                  placeholder="e.g. SM-2024-0001"
                  value={newForm.studentId}
                  onChange={(e) => setNewForm((f) => ({ ...f, studentId: e.target.value }))}
                />
              </div>
              <p className="text-[11.5px] text-slate-text/60 flex items-start gap-1.5">
                <CalendarDays size={13} className="mt-0.5 shrink-0" />
                Parents start with their own children; class teachers reach their class students.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={createThread}
                disabled={!newForm.subject.trim() || !newForm.studentId.trim() || sending}
              >
                <Plus size={15} /> Start
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}