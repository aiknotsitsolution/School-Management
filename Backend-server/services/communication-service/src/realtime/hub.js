// In-process fan-out hub for realtime notifications and events.
//
// Socket.IO is now the delivery transport (see realtime/socket.js). This module
// stays as the single fan-out point every controller already calls into, and
// forwards to Socket.IO rooms. The EventEmitter remains for the legacy SSE
// routes, which are still mounted for older clients; both transports therefore
// receive the same event from one call site.
//
// Channels are keyed per school + user for notifications, and per school +
// event type for broadcast channels (attendance, etc.).
const { EventEmitter } = require("node:events");
const { emitToUser, emitToSchool } = require("./socket");

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

// ── Per-user channels (notifications) ──────────────────────────────────────
const userKeyFor = (schoolId, userId) => `${String(schoolId)}:${String(userId)}`;

function publish(schoolId, userId, payload) {
  emitter.emit(userKeyFor(schoolId, userId), payload);
  emitToUser(schoolId, userId, "notification:new", payload);
}

function subscribe(schoolId, userId, handler) {
  const channel = userKeyFor(schoolId, userId);
  emitter.on(channel, handler);
  return () => emitter.off(channel, handler);
}

// ── School-wide broadcast channels (attendance, fees, etc.) ────────────────
// broadcast(schoolId, event, payload) — emits to every subscriber of
// school:{schoolId}:event:{event}. Subscribers must filter by role/permissions
// on the client side since the server broadcasts to the entire school.
const broadcastKeyFor = (schoolId, event) =>
  `school:${String(schoolId)}:event:${String(event)}`;

function broadcast(schoolId, event, payload) {
  const body = { event, ...payload };
  emitter.emit(broadcastKeyFor(schoolId, event), body);
  // The socket event name is the domain name itself, so a client subscribes to
  // "attendance:updated" rather than a generic envelope.
  emitToSchool(schoolId, event.replace(/\./g, ":"), body);
}

function subscribeBroadcast(schoolId, event, handler) {
  const channel = broadcastKeyFor(schoolId, event);
  emitter.on(channel, handler);
  return () => emitter.off(channel, handler);
}

module.exports = { publish, subscribe, broadcast, subscribeBroadcast };