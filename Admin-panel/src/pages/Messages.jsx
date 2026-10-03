import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import {
  Send,
  ChevronLeft,
  Plus,
  X,
  MessagesSquare,
  Search,
  Loader2,
} from "lucide-react";
import { PageIntro, Card, Button, Input, toast } from "../components/UI";
import { api } from "../lib/api";
import { onSocket, emitSocket } from "../lib/socket";
import { selectUser } from "../store/selectors";

function fmtTime(value) {
  return value
    ? new Date(value).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "—";
}

const ROLE_LABEL = {
  student: "Student",
  parent: "Parent",
  teacher: "Teacher",
  staff: "Staff",
  school_admin: "Admin",
  super_admin: "Platform",
};

export default function Messages() {
  const user = useSelector(selectUser);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState("");
  const [active, setActive] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [live, setLive] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);

  // New-conversation composer
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState([]);
  const [searching, setSearching] = useState(false);
  const [firstMessage, setFirstMessage] = useState("");

  const activeIdRef = useRef(null);
  useEffect(() => {
    activeIdRef.current = active?._id || null;
  }, [active]);

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.conversations.list();
      setConversations(Array.isArray(data) ? data : []);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  // The REST call above is the source of truth; the socket only tells us that
  // something changed. Merging by id keeps the open conversation's scroll
  // position and the composer's unsent text intact.
  /** Apply a pushed conversation to both the list and the open view. */
  const applyIncoming = useCallback(
    (incoming) => {
      const meId = String(user?.id || "");
      const other = (incoming.participants || []).find(
        (p) => String(p.userId) !== meId,
      );
      const mine = (incoming.participants || []).find((p) => String(p.userId) === meId);
      const unread = mine?.lastReadAt
        ? (incoming.messages || []).filter((m) => new Date(m.at) > new Date(mine.lastReadAt))
            .length
        : (incoming.messages || []).length;

      const view = {
        _id: incoming._id,
        lastMessage: incoming.lastMessage,
        lastMessageAt: incoming.lastMessageAt,
        lastSenderId: incoming.lastSenderId,
        unread,
        with: other
          ? { userId: other.userId, name: other.name, role: other.role }
          : { userId: null, name: "Unknown", role: "" },
      };

      setConversations((prev) => {
        const idx = prev.findIndex((c) => String(c._id) === String(incoming._id));
        const next = idx === -1 ? [view, ...prev] : prev.map((c, i) => (i === idx ? view : c));
        return next.sort(
          (a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0),
        );
      });

      // Only replace the open conversation when it is the one that moved, and
      // never clobber a reply the user is in the middle of typing.
      if (activeIdRef.current && String(activeIdRef.current) === String(incoming._id)) {
        setActive(incoming);
      }
    },
    [user?.id],
  );

  // Subscribe to pushes. The handlers are re-registered only when the identity
  // they close over changes, so switching conversations does not churn sockets.
  useEffect(() => {
    const handle = ({ conversation }) => {
      if (conversation) applyIncoming(conversation);
    };
    const offCreated = onSocket("conversation:created", handle);
    const offMessage = onSocket("conversation:message", handle);
    const offReady = onSocket("ready", () => setLive(true));
    const offLost = onSocket("disconnect", () => setLive(false));
    // The server never sends an explicit "stopped", so the indicator is
    // cleared by a local timeout as well — otherwise a closed tab would leave a
    // permanent "typing…" on the other side.
    let typingTimer = null;
    const offTyping = onSocket("conversation:typing", ({ conversationId, typing }) => {
      if (String(conversationId) !== String(activeIdRef.current)) return;
      setPeerTyping(Boolean(typing));
      if (typingTimer) clearTimeout(typingTimer);
      if (typing) typingTimer = setTimeout(() => setPeerTyping(false), 4000);
    });
    return () => {
      offCreated();
      offMessage();
      offReady();
      offLost();
      offTyping();
      if (typingTimer) clearTimeout(typingTimer);
    };
  }, [applyIncoming]);

  // Switching conversations must not leave the previous thread's indicator up.
  useEffect(() => {
    setPeerTyping(false);
  }, [active?._id]);

  // Scoped push: exactly one conversation room is joined at a time, so a
  // thread the user is not looking at never repaints the open view.
  useEffect(() => {
    const id = active?._id;
    if (!id) return undefined;
    emitSocket("conversation:join", { conversationId: id });
    return () => emitSocket("conversation:leave", { conversationId: id });
  }, [active?._id]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const openConversation = useCallback(async (id) => {
    try {
      const { data } = await api.conversations.get(id);
      setActive(data);
      setError("");
      // Opening clears this side's unread count.
      setConversations((prev) =>
        prev.map((c) => (String(c._id) === String(id) ? { ...c, unread: 0 } : c)),
      );
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const sendReply = async () => {
    if (!reply.trim() || !active || sending) return;
    setSending(true);
    try {
      const { data } = await api.conversations.reply(active._id, reply.trim());
      setActive(data);
      setReply("");
      applyIncoming(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  // Name search for a new conversation. Debounced so typing does not fire a
  // request per keystroke.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setPeople([]);
      return undefined;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      api.conversations
        .people(q)
        .then(({ data }) => setPeople(Array.isArray(data) ? data : []))
        .catch((e) => setError(e.message))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const startConversation = async (person) => {
    if (sending) return;
    setSending(true);
    try {
      const { data } = await api.conversations.open({
        participantId: person._id,
        body: firstMessage.trim(),
      });
      setShowNew(false);
      setQuery("");
      setFirstMessage("");
      setPeople([]);
      await loadConversations();
      setActive(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const messages = useMemo(() => active?.messages || [], [active]);
  const meId = String(user?.id || "");

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Communication"
        title="Messages"
        description="Live conversations with anyone in your school."
        right={
          <div className="flex items-center gap-3">
            {live ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            ) : null}
            <Button variant="primary" onClick={() => setShowNew(true)}>
              <Plus size={15} /> New Message
            </Button>
          </div>
        }
      />
      {error && <p className="text-alert text-[13px]">{error}</p>}

      <div className="grid lg:grid-cols-[320px_1fr] gap-5 items-start">
        {/* Inbox */}
        <Card className="lg:sticky lg:top-4">
          <div className="space-y-1 max-h-[62vh] overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="text-[13px] text-slate-text py-8 text-center">
                No conversations yet.
              </p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c._id}
                  onClick={() => openConversation(c._id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                    active?._id === c._id ? "bg-primary/10" : "hover:bg-paper"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-ink truncate flex-1">
                      {c.with?.name || "Unknown"}
                    </p>
                    {c.unread > 0 && active?._id !== c._id ? (
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                        {c.unread > 9 ? "9+" : c.unread}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11.5px] text-slate-text/60 truncate mt-0.5">
                    {c.lastMessage || "No messages yet"}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10.5px] font-medium text-slate-text/50">
                      {ROLE_LABEL[c.with?.role] || c.with?.role}
                    </span>
                    <span className="text-[10.5px] text-slate-text/40">
                      {fmtTime(c.lastMessageAt)}
                    </span>
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
                Pick someone from your inbox, or start a new message.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-ink truncate">
                    {(active.participants || [])
                      .find((p) => String(p.userId) !== meId)?.name || "Conversation"}
                  </p>
                  <p className="text-[11.5px] text-slate-text/60">
                    {messages.length} message{messages.length === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  onClick={() => setActive(null)}
                  className="p-2 rounded-lg hover:bg-paper text-slate-text/60 lg:hidden"
                  aria-label="Back to inbox"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>

              <div className="space-y-3 py-4 max-h-[46vh] overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-[13px] text-slate-text/60 py-6 text-center">
                    No messages yet. Say hello.
                  </p>
                ) : (
                  messages.map((m, i) => {
                    const mine = String(m.senderId) === meId;
                    return (
                      <div
                        key={m._id || i}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                            mine
                              ? "bg-primary text-white"
                              : "bg-paper border border-slate-200 text-ink"
                          }`}
                        >
                          <p className="text-[10.5px] opacity-70 mb-0.5">
                            {mine ? "You" : m.senderName || ROLE_LABEL[m.senderRole] || "User"} ·{" "}
                            {fmtTime(m.at)}
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
                  onChange={(e) => {
                    setReply(e.target.value);
                    // Fire-and-forget: the server relays it to the room and drops
                    // it if this user is not a member.
                    emitSocket("conversation:typing", {
                      conversationId: active._id,
                      typing: Boolean(e.target.value),
                    });
                  }}
                  onKeyDown={(e) => e.key === "Enter" && sendReply()}
                />
                <Button
                  variant="primary"
                  onClick={sendReply}
                  disabled={!reply.trim() || sending}
                >
                  <Send size={15} /> Send
                </Button>
              </div>
              {peerTyping ? (
                <p className="mt-1.5 text-[11.5px] italic text-slate-text/60">
                  Typing…
                </p>
              ) : null}
            </>
          )}
        </Card>
      </div>

      {/* New message — search a person by name */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setShowNew(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  New Message
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  Search anyone in your school by name.
                </p>
              </div>
              <button
                onClick={() => setShowNew(false)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/50 pointer-events-none"
                />
                <Input
                  placeholder="Search by name…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
                {searching ? (
                  <Loader2
                    size={15}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-text/50 animate-spin"
                  />
                ) : null}
              </div>

              {query.trim().length >= 2 ? (
                <div className="max-h-52 overflow-y-auto space-y-1 -mx-1">
                  {people.length === 0 && !searching ? (
                    <p className="text-[12.5px] text-slate-text/60 py-4 text-center">
                      No one found for “{query.trim()}”.
                    </p>
                  ) : (
                    people.map((p) => (
                      <button
                        key={p._id}
                        onClick={() => startConversation(p)}
                        disabled={sending}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-paper transition-colors disabled:opacity-60"
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-ink truncate">
                            {p.name}
                          </p>
                          {p.designation ? (
                            <p className="text-[11px] text-slate-text/60 truncate">
                              {p.designation}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-[10.5px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">
                          {ROLE_LABEL[p.role] || p.role}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <p className="text-[12px] text-slate-text/60">
                  Type at least two characters to search.
                </p>
              )}

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Message (optional)
                </label>
                <Input
                  placeholder="Add a first message…"
                  value={firstMessage}
                  onChange={(e) => setFirstMessage(e.target.value)}
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex justify-end">
              <Button variant="outline" onClick={() => setShowNew(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
