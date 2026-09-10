// In-process fan-out hub for realtime notifications. Each communication-service
// instance serves its own connected SSE clients, so an in-memory EventEmitter is
// sufficient (no external broker in this phase). Channels are keyed per
// school + user so tenant isolation is preserved.
const { EventEmitter } = require("node:events");

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

const keyFor = (schoolId, userId) => `${String(schoolId)}:${String(userId)}`;

function publish(schoolId, userId, payload) {
  emitter.emit(keyFor(schoolId, userId), payload);
}

function subscribe(schoolId, userId, handler) {
  const channel = keyFor(schoolId, userId);
  emitter.on(channel, handler);
  return () => emitter.off(channel, handler);
}

module.exports = { publish, subscribe };