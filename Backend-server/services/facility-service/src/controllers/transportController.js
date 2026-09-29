const BusRoute = require("../models/BusRoute");
const { paginate, pageInfo } = require("@school-erp/shared/src/utils/pagination");
const {
  routeBetween,
  routePlan,
  validCoord,
} = require("@school-erp/shared/src/utils/osrm");

// Mass-assignment guard: only these fields may be set from the request body.
const ROUTE_FIELDS = [
  "routeNo", "driverName", "driverContact", "vehicleNo", "stops",
  "assignedStudents", "currentLocation",
];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

// Stops are sparse — a stop without coordinates is legal, so keep only the
// ones that are actually routable instead of rejecting the whole save.
const cleanStops = (stops) =>
  (Array.isArray(stops) ? stops : [])
    .filter((s) => s && typeof s === "object")
    .map((s) => {
      const stop = { name: s.name, time: s.time };
      if (Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng))) {
        stop.lat = Number(s.lat);
        stop.lng = Number(s.lng);
      }
      return stop;
    });

// A GPS fix older than this is shown as stale, not "live".
const STALE_AFTER_MS = 5 * 60 * 1000;
const PLAN_TTL_MS = 6 * 60 * 60 * 1000;

// Cheap fingerprint of the stop list so a cached OSRM plan is only reused while
// the stops are unchanged.
const stopsHash = (stops) =>
  (stops || [])
    .map((s) => `${s.name || ""}@${s.lat ?? ""},${s.lng ?? ""}`)
    .join("|");

/** Nearest not-yet-passed stop, used for the live "next stop" readout. */
const nextStopFor = (route) => {
  const stops = route.stops || [];
  if (!stops.length) return null;
  const idx = Math.min(
    Math.max(Number(route.nextStopIndex) || 0, 0),
    stops.length - 1,
  );
  return { stop: stops[idx], index: idx, remaining: stops.length - idx };
};

/** Distance + ETA from the bus to its next stop, via OSRM when possible. */
async function withLiveProgress(route) {
  const loc = route.currentLocation;
  const target = nextStopFor(route);
  const progress = {
    nextStop: target ? target.stop?.name || null : null,
    nextStopIndex: target ? target.index : null,
    stopsRemaining: target ? target.remaining : null,
    distanceKm: null,
    etaMinutes: null,
    routingSource: "unavailable",
  };

  if (validCoord(loc) && validCoord(target?.stop)) {
    const leg = await routeBetween(loc, target.stop);
    progress.distanceKm = leg.km;
    progress.etaMinutes = leg.minutes;
    progress.routingSource = leg.source;
  } else if (validCoord(loc)) {
    // Position known, next stop has no coordinates — at least show how far the
    // bus is from the school so the map is not blank.
    progress.distanceKm = null;
    progress.routingSource = "unavailable";
  }

  const updatedAt = loc?.updatedAt ? new Date(loc.updatedAt).getTime() : null;
  progress.stale =
    !updatedAt || Date.now() - updatedAt > STALE_AFTER_MS;
  progress.ageMinutes = updatedAt
    ? Math.max(0, Math.round((Date.now() - updatedAt) / 60000))
    : null;

  return progress;
}

/** Reuse the cached OSRM plan unless the stops changed or it went stale. */
async function withRoutePlan(route) {
  const hash = stopsHash(route.stops);
  const cached = route.routePlan;
  const fresh =
    cached?.stopsHash === hash &&
    cached?.source === "osrm" &&
    cached?.computedAt &&
    Date.now() - new Date(cached.computedAt).getTime() < PLAN_TTL_MS;

  if (fresh) {
    return { totalKm: cached.totalKm, totalMinutes: cached.totalMinutes, source: "osrm" };
  }

  const plan = await routePlan(route.stops);
  const summary = { totalKm: plan.totalKm, totalMinutes: plan.totalMinutes, source: plan.source };

  // Persist only successful OSRM plans (a transient outage shouldn't be cached).
  if (plan.source === "osrm") {
    await BusRoute.updateOne(
      { _id: route._id, schoolId: route.schoolId },
      {
        $set: {
          "routePlan.totalKm": plan.totalKm,
          "routePlan.totalMinutes": plan.totalMinutes,
          "routePlan.source": plan.source,
          "routePlan.stopsHash": hash,
          "routePlan.computedAt": new Date(),
        },
      },
    ).catch(() => {});
  }

  return summary;
}

const createRoute = async (req, res) => {
  try {
    const payload = pick(req.body, ROUTE_FIELDS);
    if (payload.stops !== undefined) payload.stops = cleanStops(payload.stops);
    const route = await BusRoute.create({ ...payload, schoolId: req.tenantId });
    res.status(201).json({ success: true, data: route });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "A record with these details already exists" });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

const getRoutes = async (req, res) => {
  try {
    const { studentId } = req.query;
    const filter = { schoolId: req.tenantId };
    if (studentId) filter.assignedStudents = studentId;
    const { page, limit, skip } = paginate(req.query);
    const [data, total] = await Promise.all([
      BusRoute.find(filter).skip(skip).limit(limit),
      BusRoute.countDocuments(filter),
    ]);

    // Live tracking enrichment: routing data is best-effort, so a routing
    // outage degrades the payload instead of failing the whole listing.
    const enriched = await Promise.all(
      data.map(async (route) => {
        const [progress, plan] = await Promise.all([
          withLiveProgress(route),
          withRoutePlan(route),
        ]);
        return {
          ...route.toObject(),
          live: progress,
          routePlan: plan,
        };
      }),
    );

    res.json({ success: true, count: enriched.length, total, ...pageInfo(total, page, limit), data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateRoute = async (req, res) => {
  try {
    const payload = pick(req.body, ROUTE_FIELDS);
    if (payload.stops !== undefined) payload.stops = cleanStops(payload.stops);
    // Stop edits invalidate the cached OSRM plan and reset the route pointer.
    const unset =
      payload.stops !== undefined
        ? { routePlan: 1, nextStopIndex: 1 }
        : {};
    const route = await BusRoute.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId },
      { $set: payload, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { new: true, runValidators: true },
    );
    if (!route) return res.status(404).json({ success: false, message: "Route not found" });
    res.json({ success: true, data: route });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const updateLocation = async (req, res) => {
  try {
    const { lat, lng, nextStopIndex } = req.body;
    const set = { currentLocation: { lat, lng, updatedAt: new Date() } };
    if (Number.isInteger(nextStopIndex) && nextStopIndex >= 0) {
      set.nextStopIndex = nextStopIndex;
    }
    const route = await BusRoute.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId },
      { $set: set },
      { new: true },
    );
    if (!route) return res.status(404).json({ success: false, message: "Route not found" });

    const [progress, plan] = await Promise.all([
      withLiveProgress(route),
      withRoutePlan(route),
    ]);
    res.json({
      success: true,
      data: { ...route.toObject(), live: progress, routePlan: plan },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const assignStudent = async (req, res) => {
  try {
    const { studentId } = req.body;
    const route = await BusRoute.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId },
      { $addToSet: { assignedStudents: studentId } },
      { new: true },
    );
    if (!route) return res.status(404).json({ success: false, message: "Route not found" });
    res.json({ success: true, data: route });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { createRoute, getRoutes, updateRoute, updateLocation, assignStudent };
