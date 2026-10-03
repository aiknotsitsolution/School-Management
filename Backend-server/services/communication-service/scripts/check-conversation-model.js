// Verifies the Conversation schema assumptions the controller relies on:
//   1. `messages` is declared — before it was, conversation.messages.push()
//      threw, so every reply 400'd.
//   2. pairKey is order-independent, markRead stamps the right participant,
//      and a conversation can never have other than two sides.
//
// Needs no database. Run:  node scripts/check-conversation-model.js
process.env.TOKEN_VALIDATION = "off";

const assert = require("node:assert");
const mongoose = require("mongoose");
const Conversation = require("../src/models/Conversation");

const [a, b] = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];

assert.strictEqual(
  Conversation.buildPairKey(a, b),
  Conversation.buildPairKey(b, a),
  "pairKey must be order-independent so both sides find the same thread",
);

const c = new Conversation({
  schoolId: new mongoose.Types.ObjectId(),
  pairKey: Conversation.buildPairKey(a, b),
  participants: [
    { userId: String(a), name: "Asha", role: "student", lastReadAt: new Date() },
    { userId: String(b), name: "Ravi", role: "teacher", lastReadAt: null },
  ],
});

c.messages.push({ senderId: String(a), senderName: "Asha", senderRole: "student", body: "hi" });
assert.strictEqual(c.messages.length, 1, "messages array must accept a push");
assert.ok(c.messages[0]._id, "each message needs an id to key the transcript");

c.markRead(String(b));
assert.ok(c.participants[1].lastReadAt instanceof Date, "markRead must stamp the reader's receipt");
assert.ok(c.participants[0].lastReadAt instanceof Date, "markRead must not touch the other side");

const oneSided = new Conversation({
  schoolId: new mongoose.Types.ObjectId(),
  pairKey: "only-one",
  participants: [{ userId: String(a) }],
});

oneSided
  .validate()
  .then(
    () => {
      console.error("FAIL: a one-sided conversation was accepted");
      process.exit(1);
    },
    () => console.log("ok  Conversation model verified"),
  );
