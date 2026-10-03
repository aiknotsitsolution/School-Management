const Conversation = require("../models/Conversation");
const Notification = require("../models/Notification");
const { getUserModel } = require("../models/userLite");
const { paginate, pageInfo } = require("@school-erp/shared/src/utils/pagination");
const { emitToUser, emitToUsers } = require("../realtime/socket");

// ── Directory search ────────────────────────────────────────────────────────

// Find people this user is allowed to start a conversation with: any active
// user in the same school, except themselves. Deliberately school-wide rather
// than role-restricted, so a student can reach a teacher and staff can reach
// anyone; the tenant boundary is what actually protects data here.
const searchPeople = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    if (q.length < 2) {
      return res.json({ success: true, count: 0, data: [] });
    }
    const User = getUserModel();
    // Anchored, escaped regex: a name containing regex metacharacters must be
    // matched literally rather than blowing up or matching everything.
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter = {
      schoolId: req.tenantId,
      isActive: true,
      _id: { $ne: req.user.id },
      name: { $regex: safe, $options: "i" },
    };
    const data = await User.find(filter)
      .select("name role designation email")
      .sort({ name: 1 })
      .limit(limit)
      .lean();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const participantView = (conversation, userId) => {
  const me = conversation.participants.find((p) => String(p.userId) === String(userId));
  const other = conversation.participants.find((p) => String(p.userId) !== String(userId));
  return {
    _id: conversation._id,
    lastMessage: conversation.lastMessage,
    lastMessageAt: conversation.lastMessageAt,
    lastSenderId: conversation.lastSenderId,
    // Unread is derived from this participant's own receipt, so it is correct
    // per device-less user rather than a single shared flag.
    unread:
      me?.lastReadAt == null
        ? conversation.messages?.length || 0
        : (conversation.messages || []).filter((m) => new Date(m.at) > new Date(me.lastReadAt))
            .length,
    with: other
      ? { userId: other.userId, name: other.name, role: other.role }
      : { userId: null, name: "Unknown", role: "" },
  };
};

const isParticipant = (conversation, userId) =>
  conversation.participants.some((p) => String(p.userId) === String(userId));

// ── Inbox ───────────────────────────────────────────────────────────────────

const listConversations = async (req, res) => {
  try {
    const { page, limit, skip } = paginate(req.query, { fallback: 30, max: 100 });
    const filter = {
      schoolId: req.tenantId,
      "participants.userId": String(req.user.id),
    };
    const [docs, total] = await Promise.all([
      Conversation.find(filter)
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit),
      Conversation.countDocuments(filter),
    ]);
    const data = docs.map((c) => participantView(c.toObject(), req.user.id));
    res.json({ success: true, count: data.length, total, ...pageInfo(total, page, limit), data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Open / create a conversation with one person ────────────────────────────

const openConversation = async (req, res) => {
  try {
    const otherId = String(req.body.participantId || "").trim();
    const firstMessage = String(req.body.body || "").trim();
    if (!otherId) {
      return res.status(400).json({ success: false, message: "participantId is required" });
    }
    if (otherId === String(req.user.id)) {
      return res.status(400).json({ success: false, message: "You cannot message yourself" });
    }

    // The target must be an active user of this school. Checking here (rather
    // than trusting the client) is what stops cross-tenant conversations.
    const User = getUserModel();
    const other = await User.findOne({ _id: otherId, schoolId: req.tenantId, isActive: true })
      .select("name role")
      .lean();
    if (!other) {
      return res.status(404).json({ success: false, message: "That person is not available" });
    }

    const pairKey = Conversation.buildPairKey(req.user.id, otherId);
    const existing = await Conversation.findOne({ schoolId: req.tenantId, pairKey });
    if (existing) {
      // Reuse the thread instead of forking a second one for the same pair.
      if (firstMessage) {
        existing.messages.push({
          senderId: String(req.user.id),
          senderName: req.user.name || "",
          senderRole: req.user.role,
          body: firstMessage,
        });
        existing.lastMessage = firstMessage;
        existing.lastMessageAt = new Date();
        existing.lastSenderId = String(req.user.id);
        // The sender has read their own message by definition.
        existing.markRead(req.user.id);
        await existing.save();
        pushToBoth(existing, "conversation:message", { conversation: existing.toObject() });
        await notifyOther(existing, req.user.id);
      }
      return res.json({ success: true, created: false, data: existing });
    }

    const now = new Date();
    const conversation = await Conversation.create({
      schoolId: req.tenantId,
      pairKey,
      participants: [
        {
          userId: String(req.user.id),
          name: req.user.name || "",
          role: req.user.role,
          // Whoever opens the thread has, by definition, read it.
          lastReadAt: now,
        },
        { userId: String(other._id), name: other.name || "", role: other.role, lastReadAt: null },
      ],
      lastMessage: firstMessage,
      lastMessageAt: now,
      lastSenderId: String(req.user.id),
      messages: firstMessage
        ? [
            {
              senderId: String(req.user.id),
              senderName: req.user.name || "",
              senderRole: req.user.role,
              body: firstMessage,
            },
          ]
        : [],
    });

    pushToBoth(conversation, "conversation:created", { conversation: conversation.toObject() });
    if (firstMessage) await notifyOther(conversation, req.user.id);
    res.status(201).json({ success: true, created: true, data: conversation });
  } catch (err) {
    // Lost a race against a concurrent open: the unique pair index rejected the
    // second insert, so hand back the winner rather than a 400.
    if (err?.code === 11000) {
      const otherId = String(req.body.participantId || "");
      const pairKey = Conversation.buildPairKey(req.user.id, otherId);
      const winner = await Conversation.findOne({ schoolId: req.tenantId, pairKey });
      if (winner) return res.json({ success: true, created: false, data: winner });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── Read one conversation ───────────────────────────────────────────────────

const getConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      schoolId: req.tenantId,
    });
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });
    if (!isParticipant(conversation, req.user.id)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    conversation.markRead(req.user.id);
    await conversation.save();
    res.json({ success: true, data: conversation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Reply ───────────────────────────────────────────────────────────────────

const replyToConversation = async (req, res) => {
  try {
    const body = String(req.body.body || "").trim();
    if (!body) return res.status(400).json({ success: false, message: "body is required" });
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      schoolId: req.tenantId,
    });
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found" });
    if (!isParticipant(conversation, req.user.id)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    const now = new Date();
    conversation.messages.push({
      senderId: String(req.user.id),
      senderName: req.user.name || "",
      senderRole: req.user.role,
      body,
      at: now,
    });
    conversation.lastMessage = body;
    conversation.lastMessageAt = now;
    conversation.lastSenderId = String(req.user.id);
    // The sender has read their own message by definition.
    conversation.markRead(req.user.id, now);
    await conversation.save();

    pushToBoth(conversation, "conversation:message", { conversation: conversation.toObject() });
    await notifyOther(conversation, req.user.id);
    res.json({ success: true, data: conversation });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ── Fan-out ─────────────────────────────────────────────────────────────────

// Both participants get the socket event, plus a persisted notification so the
// message still shows up for a user who has the app closed.
//
// Fan-out targets the two user rooms only. Emitting to the conversation room
// as well would double-deliver, because a participant who has the thread open
// is in both rooms and Socket.IO does not de-duplicate across a union of them.
// The conversation room exists for typing relay, which needs peer-to-peer
// targeting rather than a broadcast.
function pushToBoth(conversation, event, payload) {
  const ids = conversation.participants.map((p) => p.userId);
  emitToUsers(conversation.schoolId, ids, event, payload);
}

const notifyOther = async (conversation, fromUserId) => {
  const other = conversation.participants.find(
    (p) => String(p.userId) !== String(fromUserId),
  );
  if (!other) return;
  try {
    const doc = await Notification.create({
      schoolId: conversation.schoolId,
      userId: other.userId,
      title: `New message from ${conversation.participants.find((p) => String(p.userId) === String(fromUserId))?.name || "someone"}`,
      message: String(conversation.lastMessage || "").slice(0, 500),
      kind: "message",
      link: "/messages",
    });
    emitToUser(conversation.schoolId, other.userId, "notification:new", doc);
  } catch (err) {
    console.error("[conversation notification skipped]", err.message);
  }
};

module.exports = {
  searchPeople,
  listConversations,
  openConversation,
  getConversation,
  replyToConversation,
  notifyOther,
};
