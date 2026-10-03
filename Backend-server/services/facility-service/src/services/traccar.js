// Traccar GPS platform integration (telematics provider for bus tracking).
//
// Design constraints this file exists to satisfy:
//   * Credentials live ONLY in the backend env. The browser never talks to
//     Traccar and never sees a token — the frontend calls facility-service,
//     which calls Traccar.
//   * MongoDB stays the source of truth for school business data. Traccar is
//     the source of truth for *positions*. We mirror only the latest fix per
//     bound device onto BusRoute; the full position history is queried from
//     Traccar on demand and is deliberately NOT copied into Mongo.
//   * Everything is best-effort. If Traccar is unreachable, down, or
//     unconfigured, transport tracking keeps working exactly as before (manual
//     locations and cached OSRM plans).
//
// Auth follows the documented Traccar REST conventions: HTTP Basic with the
// account's username/password (Traccar derives the token itself), or a
// pre-issued token via Authorization: Bearer.

const BASE_URL = (process.env.TRACCAR_BASE_URL || "").replace(/\/+$/, "");
const USERNAME = process.env.TRACCAR_USERNAME || "";
const PASSWORD = process.env.TRACCAR_PASSWORD || "";
const TOKEN = process.env.TRACCAR_TOKEN || "";
const TIMEOUT_MS = Number(process.env.TRACCAR_TIMEOUT_MS || 12000);

// Off by default: an unconfigured deployment must behave exactly like today.
const ENABLED = () => process.env.TRACCAR_ENABLED === "true";

/**
 * Binding on `BusRoute.tracking.deviceId` is an explicit admin action, but the
 * API key must never be usable for arbitrary reads of the whole account. Every
 * request below therefore passes the concrete device/position ids that come
 * from our own stored bindings — no list-all-devices enumeration is exposed.
 */
const canQueryDevice = (deviceId) =>
  ENABLED() && typeof deviceId === "string" && deviceId.trim().length > 0 && deviceId.length <= 64;

function authHeaders() {
  if (TOKEN) return { Authorization: `Bearer ${TOKEN}` };
  if (USERNAME && PASSWORD) {
    const basic = Buffer.from(`${USERNAME}:${PASSWORD}`, "utf8").toString("base64");
    return { Authorization: `Basic ${basic}` };
  }
  return {};
}

// Small circuit breaker: after repeated failures we stop hammering a provider
// that is down and fail fast for a cool-down window, instead of adding latency
// to every tracking poll.
const FAILURES_BEFORE_BREAK = 3;
const BREAK_COOLDOWN_MS = 60 * 1000;
let consecutiveFailures = 0;
let openUntil = 0;

const circuitOpen = () => Date.now() < openUntil;
const noteFailure = () => {
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURES_BEFORE_BREAK) openUntil = Date.now() + BREAK_COOLDOWN_MS;
};
const noteSuccess = () => {
  consecutiveFailures = 0;
  openUntil = 0;
};

async function traccarGet(path, params = {}) {
  if (!ENABLED() || !BASE_URL || circuitOpen()) return null;
  const url = new URL(`${BASE_URL}/api/${path.replace(/^\/+/, "")}`);
  if (params instanceof URLSearchParams) {
    // Preserves repeated keys such as Traccar's `deviceId`.
    for (const [k, v] of params) url.searchParams.append(k, v);
  } else {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json", ...authHeaders() },
    });
    if (!res.ok) throw new Error(`traccar http ${res.status}`);
    const body = await res.json();
    noteSuccess();
    return body;
  } catch {
    noteFailure();
    return null;
  }
}

/**
 * Validate + normalise a position returned by Traccar into our BusRoute shape.
 * Returns null for anything unusable, so a malformed provider payload can never
 * write a bad coordinate onto a route.
 */
function normalizePosition(p) {
  const lat = Number(p?.latitude ?? p?.lat);
  const lng = Number(p?.longitude ?? p?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  // Traccar reports fixTime as epoch millis; attributes.ignored / old fixTime
  // mean the platform has nothing current for this device.
  const fixMs = Number(p?.fixTime ?? p?.fixTimestamp);
  const deviceTime = Number(p?.deviceTime);
  const at = Number.isFinite(fixMs) && fixMs > 0
    ? new Date(fixMs)
    : Number.isFinite(deviceTime) && deviceTime > 0
      ? new Date(deviceTime)
      : new Date();

  const speedKmh = Number(p?.speed);
  const course = Number(p?.course);

  return {
    lat,
    lng,
    // `updatedAt` is the existing field the UI already renders as "last ping",
    // so it carries the provider's fix time rather than our sync time.
    updatedAt: at,
    speedKmh: Number.isFinite(speedKmh) && speedKmh >= 0 ? Math.round(speedKmh * 1.8) : null,
    headingDeg: Number.isFinite(course) ? Math.round(((course % 360) + 360) % 360) : null,
    altitude: Number.isFinite(Number(p?.altitude)) ? Number(p.altitude) : null,
    address: typeof p.address === "string" && p.address.trim() ? p.address.trim() : null,
  };
}

/**
 * Latest position for a set of already-bound device ids.
 * Traccar's /api/positions accepts repeated `deviceId` params.
 */
async function positionsForDevices(deviceIds) {
  const ids = [...new Set((deviceIds || []).filter(canQueryDevice))];
  if (ids.length === 0) return {};

  // Repeated params, so the query is built with URLSearchParams and handed to
  // traccarGet directly rather than nested under an object key.
  const params = new URLSearchParams();
  for (const id of ids) params.append("deviceId", id);
  const body = await traccarGet("positions", params);
  if (!Array.isArray(body)) return {};

  const out = {};
  for (const p of body) {
    const id = String(p?.deviceId ?? "");
    if (!id) continue;
    const fix = normalizePosition(p);
    if (!fix) continue;
    // Traccar can return several rows per device (filter/history enabled);
    // keep the newest fix only.
    const prev = out[id];
    if (!prev || new Date(fix.updatedAt) > new Date(prev.updatedAt)) out[id] = fix;
  }
  return out;
}

/**
 * Raw position history for one device over a time window. Read straight from
 * Traccar for the UI on demand — never persisted into Mongo.
 */
async function deviceHistory(deviceId, fromMs, toMs, limit = 500) {
  if (!canQueryDevice(deviceId)) return null;
  const body = await traccarGet(
    "positions",
    {
      deviceId,
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString(),
      limit: Math.min(Math.max(Number(limit) || 500, 1), 5000),
    },
  );
  if (!Array.isArray(body)) return null;
  return body
    .map((p) => {
      const fix = normalizePosition(p);
      return fix ? { lat: fix.lat, lng: fix.lng, at: fix.updatedAt, speedKmh: fix.speedKmh } : null;
    })
    .filter(Boolean);
}

/** Device metadata for a bound device, used to validate/label a binding. */
async function deviceInfo(deviceId) {
  if (!canQueryDevice(deviceId)) return null;
  const body = await traccarGet(`devices/${encodeURIComponent(deviceId)}`);
  if (!body || typeof body !== "object") return null;
  return {
    id: String(body.id ?? deviceId),
    name: typeof body.name === "string" ? body.name : null,
    status: body.status || null,
    lastMessage: body.lastMessage || null,
  };
}

// Hard cap on how many devices we are willing to page in; the picker is a
// convenience for the operator, not a full account dump.
const MAX_DEVICE_LIST = 200;

/**
 * Devices the provider account knows about, for the route-planner's device
 * picker. Only staff can reach the caller of this function, so the API key is
 * never used to enumerate devices for an end user.
 *
 * Returns { devices, truncated } or null when the provider cannot be reached.
 */
async function listDevices({ limit = MAX_DEVICE_LIST } = {}) {
  if (!ENABLED() || !BASE_URL) return null;
  const body = await traccarGet("devices", { limit: MAX_DEVICE_LIST });
  if (!Array.isArray(body)) return null;

  const devices = [];
  for (const d of body) {
    const id = String(d?.id ?? "");
    if (!id || !/^[\w.:-]+$/.test(id)) continue;
    devices.push({
      id,
      name: typeof d.name === "string" ? d.name : null,
      status: d.status || null,
      lastMessage: d.lastMessage || null,
    });
  }
  return { devices: devices.slice(0, limit), truncated: devices.length > limit };
}

function traccarStatus() {
  return {
    enabled: ENABLED(),
    configured: Boolean(BASE_URL && (TOKEN || (USERNAME && PASSWORD))),
    authMode: TOKEN ? "token" : USERNAME && PASSWORD ? "basic" : "none",
    circuitOpen: circuitOpen(),
  };
}

module.exports = {
  positionsForDevices,
  deviceHistory,
  deviceInfo,
  listDevices,
  normalizePosition,
  traccarStatus,
  TRACCAR_ENABLED: ENABLED,
};