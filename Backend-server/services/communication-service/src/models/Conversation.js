const mongoose = require("mongoose");

// A direct conversation between two users of one school.
//
// This is deliberately separate from Thread.js, which is anchored to a student
// and models the parent <-> class-teacher conversation. A conversation here has
// no student subject: it is person-to-person, which is what lets a student start
// a conversation with a teacher found by name.
//
// Participants are stored denormalised on the document so a single indexed
// query answers "every conversation I am part of" — the hot path for the inbox.
// Each entry keeps the display name captured at the time of the first message
// so a conversation list still renders if a user is later renamed or deactivated.
const participantSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, default: "" },
    role: { type: String, default: "" },
    // Set when this side has read up to lastReadAt. Per-participant rather than
    // a thread-level flag, because two people read at different times.
    lastReadAt: { type: Date, default: null },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    senderId: { type: String, required: true },
    senderName: { type: String, default: "" },
    senderRole: { type: String, default: "" },
    body: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const conversationSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    participants: { type: [participantSchema], required: true, validate: (v) => v.length === 2 },
    // The two participant ids, sorted and joined. Unique per school so the same
    // pair can never end up with two conversations when both sides start one at
    // the same moment; the create path catches the duplicate key and reuses the
    // existing thread.
    pairKey: { type: String, required: true },
    // Inline transcript. Person-to-person threads are short enough to keep on
    // the document, which means one query serves both the inbox and the open
    // conversation — the reader never waits on a second round trip.
    messages: { type: [messageSchema], default: [] },
    // Denormalised for the inbox list, so it renders without a second query.
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now },
    lastSenderId: { type: String, default: "" },
  },
  { timestamps: true },
);

// The inbox query: this user's conversations for this school, newest first.
conversationSchema.index({ schoolId: 1, "participants.userId": 1, lastMessageAt: -1 });

// One conversation per pair per school.
conversationSchema.index({ schoolId: 1, pairKey: 1 }, { unique: true });

conversationSchema.statics.buildPairKey = function buildPairKey(a, b) {
  return [String(a), String(b)].sort().join("|");
};

/** Mark one participant as having read everything up to `at`. */
conversationSchema.methods.markRead = function markRead(userId, at = new Date()) {
  const entry = this.participants.find((p) => String(p.userId) === String(userId));
  if (entry) entry.lastReadAt = at;
  return this;
};

module.exports = mongoose.model("Conversation", conversationSchema);
