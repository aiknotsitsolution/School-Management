const {
  scopeQuery,
  branchIdForWrite,
} = require("@school-erp/shared/src/middleware/branchScope");
const BusRoute = require("../models/BusRoute");
const { paginate, pageInfo } = require("@school-erp/shared/src/utils/pagination");
const {
  routeBetween,
  routePlan,
  validCoord,
} = require("@school-erp/shared/src/utils/osrm");
const { normalizeStops, routable, buildPreview } = require("../utils/routePlan");
const { searchPlaces, reversePlace, geocoderStatus } = require("../services/geocoder");
const { fetchStudentRoster } = require("../utils/roster");
const { deviceInfo, deviceHistory, listDevices, traccarStatus } = require("../services/traccar");
const traccarSync = require("../services/traccarSync");

// Mass-assignment guard: only these fields may be set from the request body.
// `schoolId` / `branchId` are never here — they come from the verified tenant
// and the branch middleware, never from the client. `tracking` is handled by its
// own endpoint (bindDevice) because a device binding is a privileged action.
const ROUTE_FIELDS = [
  "routeNo", "driverName", "driverContact", "vehicleNo", "stops",
  "assignedStudents", "currentLocation", "nextStopIndex",
];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

// Stops are sparse — a stop without coordinates is legal, so keep only the
// ones that are actually routable instead of rejecting the whole save.
// `sequence` is normalised to the 1-based array position so a reordered stop
// list always produces a consistent plan and the UI can label legs.
const cleanStops = normalizeStops;

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
    source: loc?.source || null,
    speedKmh: loc?.speedKmh ?? null,
    headingDeg: loc?.headingDeg ?? null,
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
    return {
      totalKm: cached.totalKm,
      totalMinutes: cached.totalMinutes,
      source: "osrm",
      legs: cached.legs || [],
    };
  }

  const plan = await routePlan(route.stops);
  const summary = {
    totalKm: plan.totalKm,
    totalMinutes: plan.totalMinutes,
    source: plan.source,
    legs: plan.legs || [],
  };

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
          "routePlan.legs": plan.legs || [],
          "routePlan.computedAt": new Date(),
        },
      },
    ).catch(() => {});
  }

  return summary;
}

// ---------------------------------------------------------------------------
// GPS provider status
// ---------------------------------------------------------------------------

/** Non-secret provider capability flags, so the UI can hide GPS controls when
 * the deployment has no telematics provider configured. Never returns
 * credentials, and never reveals whether specific device ids exist. */
const trackingStatus = async (_req, res) => {
  res.json({
    success: true,
    data: {
      providers: {
        traccar: traccarStatus(),
      },
      geocoder: geocoderStatus(),
    },
  });
};

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

const searchPlacesFor = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 3) {
      return res.json({ success: true, data: { results: [], attribution: null } });
    }
    const out = await searchPlaces(q);
    res.json({
      success: true,
      data: {
        results: out.results,
        attribution: out.attribution,
        cached: !!out.cached,
        // Lets the UI say "search is switched off" / "add an API key" instead of
        // rendering an empty dropdown that looks broken.
        disabled: !!out.disabled,
        reason: out.reason || null,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/** Reverse-geocode a dropped map pin into a suggested stop label. Separate from
 * search because it is a single explicit user action rather than keystroke
 * traffic, and it is still proxied so the provider's rate policy stays in one
 * place. Returns null when the provider cannot resolve the point, and the
 * planner then keeps a coordinate-only stop. */
const reversePlaceFor = async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!validCoord({ lat, lng })) {
      return res.status(400).json({ success: false, message: "A valid lat and lng are required" });
    }
    const place = await reversePlace(lat, lng);
    res.json({ success: true, data: place, attribution: geocoderStatus().attribution });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// Route CRUD
// ---------------------------------------------------------------------------

const createRoute = async (req, res) => {
  try {
    const payload = pick(req.body, ROUTE_FIELDS);
    if (payload.stops !== undefined) payload.stops = cleanStops(payload.stops);
      const route = await BusRoute.create({
        ...payload,
        schoolId: req.tenantId,
        branchId: branchIdForWrite(req),
      });
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
    const filter = scopeQuery(BusRoute, req, { schoolId: req.tenantId });
    if (studentId) filter.assignedStudents = studentId;
    const { page, limit, skip } = paginate(req.query);
    const [data, total] = await Promise.all([
      BusRoute.find(filter).skip(skip).limit(limit),
      BusRoute.countDocuments(filter),
    ]);

    // Resolve admission numbers to names for the allocations roster. One
    // internal call for the whole page, not one per route, and best-effort so a
    // student-service outage degrades to showing admission numbers.
    const rosterById = await fetchStudentRoster(
      req.tenantId,
      data.flatMap((r) => r.assignedStudents || []),
    );

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
          roster: (route.assignedStudents || []).map(
            (id) => rosterById[String(id)] || { admissionNo: id, name: null },
          ),
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
    const route = await BusRoute.findOneAndUpdate(scopeQuery(BusRoute, req, 
      { _id: req.params.id, schoolId: req.tenantId }),
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
    if (!validCoord({ lat, lng })) {
      return res.status(400).json({ success: false, message: "A valid latitude and longitude are required" });
    }
    const set = {
      currentLocation: { lat: Number(lat), lng: Number(lng), updatedAt: new Date(), source: "manual" },
    };
    if (Number.isInteger(nextStopIndex) && nextStopIndex >= 0) {
      set.nextStopIndex = nextStopIndex;
    }
    const route = await BusRoute.findOneAndUpdate(scopeQuery(BusRoute, req, 
      { _id: req.params.id, schoolId: req.tenantId }),
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
    if (!studentId || typeof studentId !== "string") {
      return res.status(400).json({ success: false, message: "studentId is required" });
    }
    const route = await BusRoute.findOneAndUpdate(scopeQuery(BusRoute, req, 
      { _id: req.params.id, schoolId: req.tenantId }),
      { $addToSet: { assignedStudents: studentId } },
      { new: true },
    );
    if (!route) return res.status(404).json({ success: false, message: "Route not found" });
    res.json({ success: true, data: route });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Unassign is a separate verb rather than reusing assign: an operator must be
// able to remove a student, and $addToSet alone can never express that.
const unassignStudent = async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId || typeof studentId !== "string") {
      return res.status(400).json({ success: false, message: "studentId is required" });
    }
    const route = await BusRoute.findOneAndUpdate(scopeQuery(BusRoute, req, 
      { _id: req.params.id, schoolId: req.tenantId }),
      { $pull: { assignedStudents: studentId } },
      { new: true },
    );
    if (!route) return res.status(404).json({ success: false, message: "Route not found" });
    res.json({ success: true, data: route });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// Device binding (Traccar)
// ---------------------------------------------------------------------------

/**
 * Bind a route to a GPS device.
 *
 * The deviceId arrives from an operator, so it is treated as untrusted input:
 * it must be a short opaque string, and the route it is written to is resolved
 * through the tenant + branch scoped query. The provider is contacted
 * server-side only to confirm the device exists and to cache a display name —
 * the browser never receives provider credentials or a device list.
 */
/** Devices the provider account knows about, for the binding picker.
 * Staff-only at the route level, so the API key is never used to enumerate
 * devices for a student or parent. */
const providerDevices = async (_req, res) => {
  const status = traccarStatus();
  if (!status.enabled || !status.configured) {
    return res.json({
      success: true,
      data: { devices: [], truncated: false, provider: status },
    });
  }
  const out = await listDevices();
  if (!out) {
    return res.status(503).json({
      success: false,
      message: "GPS provider is unreachable; try again shortly.",
    });
  }
  res.json({ success: true, data: { ...out, provider: status } });
};

const bindDevice = async (req, res) => {
  try {
    const { deviceId, deviceName, enabled } = req.body;
    const id = typeof deviceId === "string" ? deviceId.trim() : "";

    if (!id || id.length > 64 || !/^[\w.:-]+$/.test(id)) {
      return res.status(400).json({ success: false, message: "A valid deviceId is required" });
    }

    // A binding is only meaningful if the provider is actually configured, so
    // an unbound provider cannot silently accumulate dead device references.
    const status = traccarStatus();
    if (!status.enabled || !status.configured) {
      return res.status(400).json({
        success: false,
        message: "GPS tracking is not configured on this server",
      });
    }

    const route = await BusRoute.findOne(scopeQuery(BusRoute, req, {
      _id: req.params.id,
      schoolId: req.tenantId,
    }));
    if (!route) return res.status(404).json({ success: false, message: "Route not found" });

    // One device per route: refuse to silently steal a device that is already
    // tracking another route in this school.
    const clash = await BusRoute.findOne({
      schoolId: route.schoolId,
      _id: { $ne: route._id },
      "tracking.deviceId": id,
      "tracking.enabled": true,
    }).select("_id routeNo schoolId");
    if (clash) {
      return res.status(409).json({
        success: false,
        message: `That device is already bound to route ${clash.routeNo}`,
      });
    }

    // The device must exist in the provider account. Bindings are otherwise an
    // arbitrary id we would keep polling forever, and a typo would only show up
    // as a permanently blank map marker.
    const info = await deviceInfo(id);
    if (!info) {
      return res.status(404).json({
        success: false,
        message: "That device does not exist in the GPS provider",
      });
    }

    const tracking = {
      provider: "traccar",
      deviceId: info.id,
      deviceName: (typeof deviceName === "string" && deviceName.trim()) || info.name || null,
      enabled: enabled !== false,
      boundAt: new Date(),
    };

    const updated = await BusRoute.findOneAndUpdate(
      { _id: route._id, schoolId: route.schoolId },
      { $set: { tracking } },
      { new: true },
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const unbindDevice = async (req, res) => {
  try {
    const route = await BusRoute.findOneAndUpdate(
      scopeQuery(BusRoute, req, { _id: req.params.id, schoolId: req.tenantId }),
      { $set: { "tracking.enabled": false, "tracking.deviceId": null } },
      { new: true },
    );
    if (!route) return res.status(404).json({ success: false, message: "Route not found" });
    res.json({ success: true, data: route });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/** Immediate on-demand sync of one route, so an operator does not have to wait
 * up to a full poll interval to see a bound device's position. */
const syncRoute = async (req, res) => {
  try {
    const route = await BusRoute.findOne(scopeQuery(BusRoute, req, {
      _id: req.params.id,
      schoolId: req.tenantId,
    }));
    if (!route) return res.status(404).json({ success: false, message: "Route not found" });

    const deviceId = route.tracking?.deviceId;
    if (!deviceId || route.tracking?.provider !== "traccar") {
      return res.status(400).json({ success: false, message: "This route has no GPS device bound" });
    }

    const result = await traccarSync.syncOneRoute(route);
    const fresh = await BusRoute.findById(route._id)
      .select("currentLocation tracking")
      .lean();

    const [progress, plan] = await Promise.all([
      withLiveProgress(fresh),
      withRoutePlan(fresh),
    ]);
    res.json({
      success: true,
      data: { ...fresh, live: progress, routePlan: plan },
      meta: { sync: result },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/** Position history read live from the provider for one bound route.
 * Served from Traccar, never persisted to Mongo. */
const routeHistory = async (req, res) => {
  try {
    const route = await BusRoute.findOne(scopeQuery(BusRoute, req, {
      _id: req.params.id,
      schoolId: req.tenantId,
    }))
      .select("tracking")
      .lean();
    if (!route) return res.status(404).json({ success: false, message: "Route not found" });

    const deviceId = route.tracking?.deviceId;
    if (!deviceId || route.tracking?.provider !== "traccar") {
      return res.status(400).json({ success: false, message: "This route has no GPS device bound" });
    }

    const toMs = Date.now();
    const fromMs = Number(req.query.from) || toMs - 6 * 60 * 60 * 1000;
    const limit = Number(req.query.limit) || 500;
    if (!Number.isFinite(fromMs) || fromMs > toMs) {
      return res.status(400).json({ success: false, message: "Invalid history window" });
    }
    if (toMs - fromMs > 7 * 24 * 60 * 60 * 1000) {
      return res.status(400).json({ success: false, message: "History window too large (max 7 days)" });
    }

    const points = await deviceHistory(deviceId, fromMs, toMs, limit);
    if (points === null) {
      return res.status(503).json({
        success: false,
        message: "GPS provider is unavailable right now",
      });
    }
    res.json({
      success: true,
      count: points.length,
      data: points,
      meta: { source: "traccar", persisted: false },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/** Full stop-by-stop OSRM plan for a route, including per-stop arrival times
 * estimated from the current position. Used by the planner preview and the
 * student/parent bus view. */
const previewPlan = async (req, res) => {
  try {
    // Plan for a not-yet-saved stop list (planner preview) when supplied,
    // otherwise plan the stored route.
    const hasDraft = Array.isArray(req.body?.stops);
    const route = hasDraft
      ? null
      : await BusRoute.findOne(scopeQuery(BusRoute, req, {
          _id: req.params.id,
          schoolId: req.tenantId,
        }));

    if (!hasDraft && !route) {
      return res.status(404).json({ success: false, message: "Route not found" });
    }

    const stops = hasDraft ? cleanStops(req.body.stops) : route.stops;
    if (routable(stops).length < 2) {
      return res.json({
        success: true,
        data: {
          stops,
          routableCount: routable(stops).length,
          totalKm: null,
          totalMinutes: null,
          legs: [],
          source: "unavailable",
        },
      });
    }

    res.json({ success: true, data: await buildPreview(stops) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// Student's own bus (and any linked child, for a parent)
// ---------------------------------------------------------------------------

/**
 * The "My School Bus" view.
 *
 * Role scoping is deliberately explicit rather than trusting the query string:
 *   * student -> their own refId (admission number)
 *   * parent  -> their linkedStudentIds
 *   * staff/admin -> only with an explicit admission number they are entitled to
 *
 * `assignedStudents` stores admission numbers, so those are the join key. A
 * student/parent never sees the whole fleet through this endpoint even if they
 * guess a route id.
 */
const myRoute = async (req, res) => {
  try {
    const role = req.user?.role;
    let admissionNos = [];

    if (role === "student") {
      admissionNos = req.user.refId ? [String(req.user.refId)] : [];
    } else if (role === "parent") {
      // `linkedStudentIds` is stamped on the parent token by auth-service, so
      // this cannot be widened by the client.
      admissionNos = (req.user.linkedStudentIds || []).map(String).filter(Boolean);
    } else {
      const requested = String(req.query.admissionNo || "").trim();
      if (!requested) {
        return res.json({ success: true, count: 0, data: [] });
      }
      admissionNos = [requested];
    }

    if (admissionNos.length === 0) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const routes = await BusRoute.find(
      scopeQuery(BusRoute, req, { schoolId: req.tenantId, assignedStudents: { $in: admissionNos } }),
    ).sort({ routeNo: 1 });

    // Resolve admission numbers to names for the roster chips. Best-effort: a
    // student-service outage degrades to showing the admission number, which
    // the UI already handles.
    const rosterById = await fetchStudentRoster(
      req.tenantId,
      routes.flatMap((r) => r.assignedStudents || []),
    );

    const enriched = await Promise.all(
      routes.map(async (route) => {
        const [progress, plan] = await Promise.all([
          withLiveProgress(route),
          withRoutePlan(route),
        ]);
        return {
          ...route.toObject(),
          live: progress,
          routePlan: plan,
          roster: (route.assignedStudents || []).map((id) => rosterById[String(id)] || { admissionNo: id, name: null }),
        };
      }),
    );

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createRoute,
  getRoutes,
  updateRoute,
  updateLocation,
  assignStudent,
  unassignStudent,
  myRoute,
  searchPlacesFor,
  reversePlaceFor,
  previewPlan,
  bindDevice,
  unbindDevice,
  providerDevices,
  syncRoute,
  routeHistory,
  trackingStatus,
};
