// Socket.IO transport for realtime delivery.
//
// Authentication reuses the same JWT the REST routes use, but is verified in the
// handshake (`auth.token`) because browsers cannot set headers on a WebSocket
// upgrade. The token is checked for `typ: "access"` exactly like verifyToken, so
// a refresh token cannot open a socket.
//
// Every connection joins two rooms:
//   user:{schoolId}:{userId}  — direct fan-out (notifications, new messages)
//   school:{schoolId}         — tenant broadcast (attendance marks, events)
//
// Tenancy is enforced at join time from the verified token, never from
// client-supplied data, so a socket cannot subscribe to another school's
// stream by asking for a different room name.
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { getJwtSecret } = require("@school-erp/shared/src/utils/jwtSecret");
const { getUserModel } = require("../models/userLite");

const JWT_SECRET = getJwtSecret();

const userRoom = (schoolId, userId) => `user:${String(schoolId)}:${String(userId)}`;
const schoolRoom = (schoolId) => `school:${String(schoolId)}`;
const conversationRoom = (schoolId, conversationId) =>
  `conversation:${String(schoolId)}:${String(conversationId)}`;

let io = null;

/** Verify a handshake token. Mirrors middleware/auth.js verifyToken. */
async function verifyHandshakeToken(token) {
  if (!token) throw new Error("No token provided");
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.typ !== "access") throw new Error("Invalid token type");

  // Confirm the account is still active when the User model is co-located
  // (every service but the auth service registers it). A token that outlived a
  // deactivation must not keep a live socket.
  const UserModel = mongoose.models.User;
  const tokenValidationOff =
    process.env.TOKEN_VALIDATION === "off" && process.env.NODE_ENV !== "production";
  if (!tokenValidationOff && UserModel) {
    const user = await UserModel.findById(decoded.id).select("isActive schoolId").lean();
    if (!user || !user.isActive) throw new Error("Account is inactive");
    if (user.schoolId && String(user.schoolId) !== String(decoded.schoolId || "")) {
      throw new Error("Token tenant mismatch");
    }
  }
  return decoded;
}

function attachSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
        : false,
      credentials: true,
    },
    // The client offers ["polling", "websocket"], so the upgrade happens only
    // after the long-poll handshake succeeds. That keeps restrictive proxies
    // working while still upgrading to a WebSocket on a normal network.
    transports: ["polling", "websocket"],
    pingTimeout: 30_000,
    pingInterval: 25_000,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      const user = await verifyHandshakeToken(token);
      socket.data.user = user;
      // super_admin carries no tenant of its own; it is placed in a tenant room
      // only once it switches school (the client re-joins on switch).
      socket.data.schoolId = user.schoolId ? String(user.schoolId) : null;
      next();
    } catch (err) {
      const error = new Error(err.message || "Socket authentication failed");
      error.data = { code: err.message };
      next(error);
    }
  });

  io.on("connection", (socket) => {
    const { user, schoolId } = socket.data;

    if (schoolId) {
      socket.join(userRoom(schoolId, user.id));
      socket.join(schoolRoom(schoolId));
    }

    socket.emit("ready", {
      userId: String(user.id),
      role: user.role,
      schoolId,
    });

    // A super_admin switching school re-joins without reconnecting.
    //
    // The requested school is NOT trusted: a client could otherwise name any
    // tenant and subscribe to its attendance and notification stream. The
    // switch is permitted only for a token that is not already bound to a
    // tenant (super_admin), and the account must still be active in that school.
    socket.on("switch:school", async (nextSchoolId, ack) => {
      const reply = (result) => {
        if (typeof ack === "function") ack(result);
      };
      const current = socket.data.schoolId;

      if (!nextSchoolId) {
        reply({ ok: false, reason: "School is required" });
        return;
      }
      if (current && String(current) === String(nextSchoolId)) {
        reply({ ok: true, schoolId: current });
        return;
      }
      if (current) {
        // A token already bound to one tenant can never move to another.
        reply({ ok: false, reason: "Token is bound to another school" });
        return;
      }
      try {
        const UserModel = mongoose.models.User || getUserModel();
        const account = await UserModel.findById(user.id).select("isActive schoolId").lean();
        if (!account || !account.isActive) {
          reply({ ok: false, reason: "Account is inactive" });
          return;
        }
        if (String(account.schoolId || "") !== String(nextSchoolId)) {
          reply({ ok: false, reason: "No access to that school" });
          return;
        }
      } catch (err) {
        reply({ ok: false, reason: err.message || "Switch rejected" });
        return;
      }

      socket.data.schoolId = String(nextSchoolId);
      socket.join(userRoom(nextSchoolId, user.id));
      socket.join(schoolRoom(nextSchoolId));
      socket.emit("ready", {
        userId: String(user.id),
        role: user.role,
        schoolId: socket.data.schoolId,
      });
      reply({ ok: true, schoolId: socket.data.schoolId });
    });

    // A client joins the room for a conversation it has just opened.
    //
    // Membership is verified against the database rather than trusted from the
    // REST response: a room name is guessable, so without this check any
    // authenticated user could subscribe to a stranger's transcript by
    // enumerating ids. A user may hold several rooms open, so the authorised
    // set is tracked per socket and the join is idempotent.
    socket.on("conversation:join", async ({ conversationId } = {}, ack) => {
      const reply = (result) => {
        if (typeof ack === "function") ack(result);
      };
      if (!conversationId || !socket.data.schoolId) {
        reply({ ok: false, reason: "Unknown conversation" });
        return;
      }
      // Cheap path: already authorised by an earlier successful join.
      if (socket.data.conversationRooms?.has(String(conversationId))) {
        reply({ ok: true });
        return;
      }
      try {
        const Conversation = mongoose.models.Conversation || require("../models/Conversation");
        const conversation = await Conversation.findOne({
          _id: conversationId,
          schoolId: socket.data.schoolId,
          "participants.userId": String(user.id),
        })
          .select("_id")
          .lean();
        if (!conversation) {
          reply({ ok: false, reason: "Not a participant" });
          return;
        }
        if (!socket.data.conversationRooms) socket.data.conversationRooms = new Set();
        socket.data.conversationRooms.add(String(conversationId));
        socket.join(conversationRoom(socket.data.schoolId, conversationId));
        reply({ ok: true });
      } catch {
        reply({ ok: false, reason: "Join rejected" });
      }
    });

    socket.on("conversation:leave", ({ conversationId } = {}) => {
      if (!conversationId || !socket.data.schoolId) return;
      socket.data.conversationRooms?.delete(String(conversationId));
      socket.leave(conversationRoom(socket.data.schoolId, conversationId));
    });

    // Typing indicators are relayed to the room and never stored. The sender is
    // excluded with `to()` so a client never renders its own indicator, and a
    // non-member cannot relay into a room it never joined.
    socket.on("conversation:typing", ({ conversationId, typing } = {}) => {
      if (!conversationId || !socket.data.schoolId) return;
      if (!socket.data.conversationRooms?.has(String(conversationId))) return;
      socket
        .to(conversationRoom(socket.data.schoolId, conversationId))
        .emit("conversation:typing", {
          conversationId: String(conversationId),
          userId: String(user.id),
          typing: Boolean(typing),
        });
    });
  });

  return io;
}

// ── Emitters used by the controllers ────────────────────────────────────────

/** Deliver to one user's devices. */
function emitToUser(schoolId, userId, event, payload) {
  if (!io || !schoolId || !userId) return;
  io.to(userRoom(schoolId, userId)).emit(event, payload);
}

/** Deliver to every socket in a school (clients filter by role/permission). */
function emitToSchool(schoolId, event, payload) {
  if (!io || !schoolId) return;
  io.to(schoolRoom(schoolId)).emit(event, payload);
}

/** Deliver to a set of users, de-duplicated. */
function emitToUsers(schoolId, userIds, event, payload) {
  if (!io || !schoolId) return;
  [...new Set(userIds.map(String))].forEach((id) => emitToUser(schoolId, id, event, payload));
}

/** Deliver to everyone currently viewing one conversation. */
function emitToConversation(schoolId, conversationId, event, payload) {
  if (!io || !schoolId || !conversationId) return;
  io.to(conversationRoom(schoolId, conversationId)).emit(event, payload);
}

function isReady() {
  return Boolean(io);
}

module.exports = {
  attachSocket,
  emitToUser,
  emitToUsers,
  emitToSchool,
  emitToConversation,
  isReady,
  userRoom,
  schoolRoom,
  conversationRoom,
};
