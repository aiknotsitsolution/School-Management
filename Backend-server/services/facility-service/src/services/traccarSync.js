// Polls Traccar for the latest position of every GPS-bound route and writes it
// onto BusRoute. This is the ONLY place provider telemetry enters Mongo, and it
// writes a strict subset (latest fix + fix time), never the position history.
//
// Started from src/index.js only when TRACCAR_ENABLED=true. If Traccar is
// unreachable the poller logs and backs off — routes keep their last known
// position and the UI shows it as stale rather than blank.
//
// Manual updates (PATCH /api/transport/:id/location) stay authoritative until
// the bound device reports a fresh fix, so a route with provider="manual" is
// never overwritten by telemetry.

const BusRoute = require("../models/BusRoute");
const { positionsForDevices } = require("./traccar");

const INTERVAL_MS = Number(process.env.TRACCAR_POLL_INTERVAL_MS || 30000);

// A fix older than this is not worth writing: it would only re-stamp a dead
// position and reset the "live" badge in the UI. Devices that report every
// 30-60s stay well inside this window.
const MAX_FIX_AGE_MS = 10 * 60 * 1000;

const isStale = (at) => {
  const t = new Date(at).getTime();
  return Number.isNaN(t) || Date.now() - t > MAX_FIX_AGE_MS;
};

let timer = null;
let running = false;

const log = (...args) => console.log("[traccar-sync]", ...args);

/**
 * Write one provider fix onto its route.
 *
 * Guarding on `currentLocation.updatedAt` (last write wins by fix time) means a
 * slow poll can never clobber a newer fix that a concurrent poll already stored,
 * and a manual update made after the provider fix keeps its newer timestamp.
 */
async function applyPosition(route, fix) {
  const fixAt = new Date(fix.updatedAt);
  if (isStale(fixAt)) return false;

  const current = route.currentLocation?.updatedAt
    ? new Date(route.currentLocation.updatedAt)
    : null;
  if (current && !Number.isNaN(current.getTime()) && current >= fixAt) return false;

  const updated = await BusRoute.updateOne(
    { _id: route._id, schoolId: route.schoolId, "tracking.deviceId": route.tracking.deviceId },
    {
      $set: {
        "currentLocation.lat": fix.lat,
        "currentLocation.lng": fix.lng,
        "currentLocation.updatedAt": fixAt,
        "currentLocation.source": "traccar",
        "currentLocation.speedKmh": fix.speedKmh,
        "currentLocation.headingDeg": fix.headingDeg,
        "lastSyncedAt": new Date(),
      },
    },
  );
  return updated.modifiedCount > 0;
}

/** Sync exactly one route's device. Used by the operator's "sync now" button so
 * a click on one route does not kick off a fleet-wide provider poll, and so a
 * tenant request only ever writes its own route. */
async function syncOneRoute(route) {
  const deviceId = route?.tracking?.deviceId;
  if (!deviceId || route?.tracking?.provider !== "traccar" || route.tracking.enabled === false) {
    return { updated: false, reason: "no device bound" };
  }
  const fix = (await positionsForDevices([deviceId]))[deviceId];
  if (!fix) return { updated: false, reason: "no fix returned" };
  if (isStale(fix.updatedAt)) return { updated: false, reason: "fix is stale" };
  const updated = await applyPosition(route, fix).catch(() => false);
  return { updated, fix };
}

/** One full sync pass across every school/campus, tenant-agnostic by design:
 * the poller is a system job, not a tenant request, so it does not go through
 * branch scoping. Each write is still keyed to the route's own schoolId. */
async function syncOnce() {
  const routes = await BusRoute.find({
    "tracking.provider": "traccar",
    "tracking.deviceId": { $exists: true, $ne: "" },
    "tracking.enabled": { $ne: false },
  })
    .select("_id schoolId tracking currentLocation")
    .lean();

  if (routes.length === 0) return { routes: 0, updated: 0 };

  const byDevice = new Map();
  for (const r of routes) {
    const id = String(r.tracking.deviceId);
    if (!byDevice.has(id)) byDevice.set(id, []);
    byDevice.get(id).push(r);
  }

  const positions = await positionsForDevices([...byDevice.keys()]);
  if (Object.keys(positions).length === 0) {
    log("no positions returned for", routes.length, "bound route(s)");
    return { routes: routes.length, updated: 0 };
  }

  let updated = 0;
  for (const [deviceId, bound] of byDevice.entries()) {
    const fix = positions[deviceId];
    if (!fix) continue;
    if (isStale(fix.updatedAt)) continue;
    // Two routes bound to one device is a misconfiguration; warn but keep the
    // last write so tracking still resolves.
    if (bound.length > 1) {
      log(`device ${deviceId} is bound to ${bound.length} routes — first wins`);
    }
    const result = await applyPosition(bound[0], fix).catch(() => false);
    if (result) updated += 1;
  }

  if (updated > 0) log(`updated ${updated}/${routes.length} route position(s)`);
  return { routes: routes.length, updated };
}

async function tick() {
  if (running) return; // never overlap passes on a slow provider
  running = true;
  try {
    await syncOnce();
  } catch (err) {
    // A DB hiccup must not kill the interval.
    log("sync failed:", err.message);
  } finally {
    running = false;
  }
}

function start() {
  if (timer) return;
  log(`started (every ${INTERVAL_MS}ms)`);
  // Delay the first pass slightly so it never competes with service startup.
  setTimeout(tick, 5000).unref?.();
  timer = setInterval(tick, INTERVAL_MS);
  timer.unref?.();
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = {
  start,
  stop,
  syncOnce,
  syncOneRoute,
  INTERVAL_MS,
  applyPosition,
  isStale,
  MAX_FIX_AGE_MS,
};