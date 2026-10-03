// Live Socket.IO smoke test. Boots the real attachSocket() on a bare HTTP
// server (no database) and exercises the handshake + room authorisation paths
// that the conversation UI depends on.
//
// Run from the communication service:  node scripts/tmp-socket-check.js
process.env.TOKEN_VALIDATION = "off"; // skip the User isActive re-check (no DB here)
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET = "tmp-smoke-test-secret-at-least-32-chars-long";

const assert = require("node:assert");
const http = require("node:http");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("@school-erp/shared/src/utils/jwtSecret");
const { attachSocket } = require("../src/realtime/socket");
const { io } = require("socket.io-client");

const SECRET = getJwtSecret();
const SCHOOL = new mongoose.Types.ObjectId().toHexString();
const OTHER_SCHOOL = new mongoose.Types.ObjectId().toHexString();
const ALICE = new mongoose.Types.ObjectId().toHexString();
const BOB = new mongoose.Types.ObjectId().toHexString();
const CONVO = new mongoose.Types.ObjectId().toHexString();

const accessToken = (over = {}) =>
  jwt.sign({ typ: "access", id: ALICE, name: "Alice", role: "student", schoolId: SCHOOL, ...over }, SECRET, { expiresIn: "5m" });

// Stands in for the Conversation model so the membership check resolves without
// a database. `member` decides whether ALICE is a participant.
let member = false;
mongoose.models.Conversation = {
  findOne: (filter) => ({
    select: () => ({
      lean: () =>
        Promise.resolve(
          member && String(filter.schoolId) === String(filter.schoolId)
            ? { _id: CONVO }
            : null,
        ),
    }),
  }),
};
// getUserModel() must not be reached for a tenant-bound token, but guard anyway.
mongoose.models.User = {
  findById: () => ({ select: () => ({ lean: () => Promise.resolve({ isActive: true, schoolId: OTHER_SCHOOL }) }) }),
};

const connect = (port, token, extra = {}) =>
  new Promise((resolve) =>
  {
    const socket = io(`http://127.0.0.1:${port}`, {
      auth: token ? { token } : {},
      transports: ["polling"],
      reconnection: false,
      timeout: 5000,
      ...extra,
    });
    socket.once("ready", (payload) => resolve({ socket, ready: payload }));
    socket.once("connect_error", (err) => resolve({ socket, error: err }));
  });

const once = (socket, event, ms = 3000) =>
  new Promise((resolve) =>
  {
    const t = setTimeout(() => resolve(null), ms);
    socket.once(event, (payload) => { clearTimeout(t); resolve(payload); });
  });

const emitAck = (socket, event, ...args) =>
  new Promise((resolve) => socket.emit(event, ...args, resolve));

(async () =>
{
  const server = http.createServer();
  attachSocket(server);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));

  // 1. No token is rejected.
  const port = server.address().port;
  const anon = await connect(port, null);
  assert.ok(anon.error, "anonymous connection must be refused");
  anon.socket.close();

  // 2. A refresh token cannot open a socket.
  const refresh = jwt.sign({ typ: "refresh", id: ALICE }, SECRET, { expiresIn: "5m" });
  const asRefresh = await connect(port, refresh);
  assert.ok(asRefresh.error, "refresh token must be refused");
  asRefresh.socket.close();

  // 3. A valid access token gets `ready` with its tenant.
  const session = await connect(port, accessToken());
  assert.ok(!session.error, `valid token rejected: ${session.error?.message}`);
  assert.strictEqual(session.ready.schoolId, SCHOOL, "ready must carry the token's school");
  assert.strictEqual(session.ready.userId, ALICE);
  const { socket } = session;

  // 4. A tenant-bound token cannot switch to another school.
  const denied = await emitAck(socket, "switch:school", OTHER_SCHOOL);
  assert.strictEqual(denied.ok, false, "switch to a foreign school must be refused");
  assert.match(denied.reason, /bound to another school/);

  // 5. Joining a conversation the user is not part of is refused.
  member = false;
  const rejected = await emitAck(socket, "conversation:join", { conversationId: CONVO });
  assert.strictEqual(rejected.ok, false, "non-member join must be refused");
  assert.match(rejected.reason, /Not a participant/);

  // 6. Joining as a participant succeeds, and re-join is idempotent.
  member = true;
  const allowed = await emitAck(socket, "conversation:join", { conversationId: CONVO });
  assert.strictEqual(allowed.ok, true, "participant join must succeed");
  const again = await emitAck(socket, "conversation:join", { conversationId: CONVO });
  assert.strictEqual(again.ok, true, "re-join must be idempotent");

  // 7. A member relays typing to the room but not back to itself.
  const peer = await connect(port, accessToken({ id: BOB, name: "Bob", role: "teacher" }));
  assert.ok(!peer.error, "peer rejected");
  await emitAck(peer.socket, "conversation:join", { conversationId: CONVO });
  const heard = once(peer.socket, "conversation:typing");
  socket.emit("conversation:typing", { conversationId: CONVO, typing: true });
  const relayed = await heard;
  assert.ok(relayed, "peer never received the typing relay");
  assert.strictEqual(relayed.userId, ALICE, "relay must identify the sender");
  assert.strictEqual(relayed.typing, true);

  // The sender must not see its own indicator.
  const echo = once(socket, "conversation:typing", 500);
  socket.emit("conversation:typing", { conversationId: CONVO, typing: true });
  assert.strictEqual(await echo, null, "sender must not receive its own typing event");

  // 8. A non-member cannot relay typing into a room it never joined.
  peer.socket.emit("conversation:typing", { conversationId: new mongoose.Types.ObjectId(), typing: true });
  await new Promise((r) => setTimeout(r, 300)); // must not throw

  socket.close();
  peer.socket.close();
  await new Promise((r) => server.close(r));
  console.log("ok  socket handshake, switch guard, join guard, typing relay");
  process.exit(0);
})().catch((err) =>
{
  console.error("FAIL", err.message);
  process.exit(1);
});
