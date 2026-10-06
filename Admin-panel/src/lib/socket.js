import { io } from "socket.io-client";
import { store } from "../store";
import { refreshAccessToken } from "./tokenRefresh";

// Single shared Socket.IO connection.
//
// One socket per tab, not per component: the server puts every authenticated
// user into their own rooms, so a second connection would receive the same
// events twice. Components subscribe through `onSocket` and get an unsubscribe
// function back.
//
// Auth is passed in the handshake (`auth.token`) because a browser cannot set
// headers on a WebSocket upgrade. The server verifies the same access token the
// REST calls use, so an expired token shows up as a `connect_error` and is
// retried once after the shared refresh helper has rotated it.
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "/api";

// The gateway serves REST under /api but the socket upgrade is a bare-origin
// path, so strip the /api suffix. VITE_SOCKET_URL overrides this for a split
// deployment where realtime lives on its own host.
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || API_BASE_URL.replace(/\/api\/?$/, "");

let socket = null;
let connecting = null;
let retryAfterRefresh = false;

const authState = () => store.getState().auth || {};

function currentToken() {
  const auth = authState();
  return auth.accessToken || localStorage.getItem("erp_access_token") || "";
}

function currentSchoolId() {
  const auth = authState();
  return auth.activeSchoolId || localStorage.getItem("erp_active_school") || "";
}

function build() {
  const instance = io(SOCKET_URL, {
    auth: { token: currentToken() },
    withCredentials: true,
    // Start on polling so a proxy that blocks the WS upgrade still connects,
    // then let socket.io upgrade on its own.
    transports: ["polling", "websocket"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: Infinity,
  });

  instance.on("connect_error", async (err) => {
    // An expired or rotated token is the one error worth retrying: refresh once
    // and rebuild the socket with the new credential. Anything else (gateway
    // down, CORS) is left to socket.io's own reconnect backoff.
    const message = String(err?.message || "");
    const authFailure =
      message.includes("token") ||
      message.includes("Token") ||
      message.includes("inactive");
    if (!authFailure || retryAfterRefresh) return;
    retryAfterRefresh = true;
    const ok = await refreshAccessToken();
    retryAfterRefresh = false;
    if (ok) {
      disconnect();
      socket = null;
      connect();
    }
  });

  instance.on("connect", () => {
    // A super_admin has no tenant in its token until it picks a school, so the
    // active school is (re)sent on every connect rather than trusted from the
    // handshake alone.
    const schoolId = currentSchoolId();
    if (schoolId) instance.emit("switch:school", String(schoolId));
  });

  return instance;
}

function connect() {
  if (socket) return socket;
  if (connecting) return connecting;
  if (!currentToken()) return null;
  connecting = build();
  socket = connecting;
  connecting = null;
  return socket;
}

function disconnect() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }
  socket = null;
}

/**
 * Subscribe to a server event. Returns an unsubscribe function; safe to call
 * even if the socket was never connected (for example on a public route).
 */
export function onSocket(event, handler) {
  const instance = connect();
  if (!instance) return () => {};
  instance.on(event, handler);
  return () => instance.off(event, handler);
}

/** Fire-and-forget emit, used for typing indicators and room joins. */
export function emitSocket(event, payload) {
  const instance = connect();
  if (!instance) return;
  instance.emit(event, payload);
}

export function socketStatus(onChange) {
  const instance = connect();
  if (!instance) return () => {};
  const handler = (state) => onChange(state);
  instance.on("connect", () => handler("connected"));
  instance.on("disconnect", () => handler("disconnected"));
  instance.on("connect_error", () => handler("error"));
  if (instance.connected) handler("connected");
  return () => {
    instance.off("connect", handler);
    instance.off("disconnect", handler);
    instance.off("connect_error", handler);
  };
}

// Keep the socket's tenant in step with a school switch. Subscribing to the
// store rather than to a component means the switch is handled even if no
// realtime consumer happens to be mounted at that moment.
let lastSchool = currentSchoolId();
store.subscribe(() => {
  const schoolId = currentSchoolId();
  if (!schoolId || schoolId === lastSchool) return;
  lastSchool = schoolId;
  if (socket?.connected) socket.emit("switch:school", String(schoolId));
});

export { connect, disconnect };
