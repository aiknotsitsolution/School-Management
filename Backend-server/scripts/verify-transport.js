// Runtime verification for the transport integration.
//
// Boots the real Express routers against an in-memory Mongo substitute so the
// tenant/RBAC/branch chain, the new endpoints, and the tenant-isolation rules
// are exercised without a live database or a Traccar account.
//
// Run: node scripts/verify-transport.js

process.env.TOKEN_VALIDATION = "off";
process.env.BRANCH_SCOPE = "on";

// A fake Traccar account so the provider-facing code paths (device listing,
// device validation, position polling) run end to end. These values never leave
// this script — production reads them from the real environment.
process.env.TRACCAR_ENABLED = "true";
process.env.TRACCAR_BASE_URL = "https://traccar.invalid";
process.env.TRACCAR_TOKEN = "verify-token";

// Loading the auth middleware reads the signing secret at require time.
process.env.JWT_SECRET ||= "verify-only-secret-at-least-32-characters-long";

const assert = require("node:assert");
const fs = require("node:fs");

const ROOT = require("node:path").resolve(__dirname, "..");

// ---- fake provider --------------------------------------------------------
const PROVIDER_DEVICES = [
  { id: "dev-1234", name: "Bus 12", status: "active", lastMessage: "2026-01-01T00:00:00Z" },
  { id: "dev-5678", name: "Bus 13", status: "offline", lastMessage: null },
  { id: "../etc", name: "hostile name", status: null, lastMessage: null },
];

const providerCalls = [];
const providerStub = async (url) => {
  const href = String(url);
  providerCalls.push(href);
  const json = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

  const u = new URL(href);
  if (u.pathname === "/api/devices") return json(PROVIDER_DEVICES);
  const one = u.pathname.match(/^\/api\/devices\/(.+)$/);
  if (one) {
    const found = PROVIDER_DEVICES.find((d) => d.id === decodeURIComponent(one[1]));
    return found ? json(found) : json({ error: "not found" }, 404);
  }
  if (u.pathname === "/api/positions") return json([]);
  return json({ error: "unexpected path" }, 404);
};
global.fetch = providerStub;

// ---- tiny in-memory mongoose stand-in ------------------------------------
// BusRoute is the only model the transport router touches. Rather than pull in
// a real Mongo, we substitute the model's query surface with a plain array so
// the controller's filters can be asserted directly.
const seeded = [];
let lastUpdate = null;

function matches(doc, filter) {
  for (const [key, cond] of Object.entries(filter || {})) {
    const get = (d) =>
      key.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), d);
    const value = get(doc);
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      if ("$in" in cond) {
        const wanted = (cond.$in || []).map(String);
        // $in against an array field means "any element matches", as in mongo.
        const present = Array.isArray(value) ? value.map(String) : [String(value)];
        if (!present.some((v) => wanted.includes(v))) return false;
      }
      if ("$ne" in cond && String(value) === String(cond.$ne)) return false;
      if ("$exists" in cond && (value != null) !== cond.$exists) return false;
      continue;
    }
    if (String(value) !== String(cond)) return false;
  }
  return true;
}

// Applies $set/$unset/$pull including dotted paths, mirroring the subset of
// mongo update operators the controller actually uses.
function applyUpdate(doc, update) {
  const setPath = (target, path, value) => {
    const parts = path.split(".");
    let node = target;
    for (const part of parts.slice(0, -1)) {
      if (node[part] == null || typeof node[part] !== "object") node[part] = {};
      node = node[part];
    }
    node[parts[parts.length - 1]] = value;
  };
  for (const [path, value] of Object.entries(update.$set || {})) {
    setPath(doc, path, value);
  }
  for (const path of Object.keys(update.$unset || {})) {
    setPath(doc, path, undefined);
  }
  if (update.$pull) {
    for (const [path, values] of Object.entries(update.$pull)) {
      if (!Array.isArray(doc[path])) continue;
      doc[path] = doc[path].filter((v) => !values.includes(v));
    }
  }
}

// A query stub that is awaitable directly and also survives the
// .sort()/.select()/.lean()/.skip().limit() chains the controller uses.
function query(resultFn) {
  let rowsFn = resultFn;
  let offset = null;
  let max = null;
  const self = {
    sort() {
      return self;
    },
    select() {
      return self;
    },
    lean() {
      return self;
    },
    skip(n) {
      offset = n;
      return self;
    },
    limit(n) {
      max = n;
      return self;
    },
    exec: async () => selfSlice(),
    then: (onOk, onErr) => Promise.resolve().then(selfSlice).then(onOk, onErr),
  };
  const selfSlice = async () => {
    let rows = await rowsFn();
    if (offset != null) rows = rows.slice(offset);
    if (max != null) rows = rows.slice(0, max);
    return rows;
  };
  return self;
}

const BusRouteStub = {
  create: async (doc) => {
    const created = { _id: `new-${seeded.length + 1}`, ...doc };
    seeded.push(created);
    return created;
  },
  find: (filter) => query(() => seeded.filter((d) => matches(d, filter))),
  findOne: (filter) => query(() => seeded.find((d) => matches(d, filter)) || null),
  findOneAndUpdate: async (filter, update, opts = {}) => {
    lastUpdate = { filter, update };
    const doc = seeded.find((d) => matches(d, filter));
    if (!doc) return null;
    applyUpdate(doc, update);
    return opts.new === false ? null : doc;
  },
  updateOne: async (filter, update) => {
    lastUpdate = { filter, update };
    const doc = seeded.find((d) => matches(d, filter));
    if (!doc) return { modifiedCount: 0 };
    applyUpdate(doc, update);
    return { modifiedCount: 1 };
  },
  countDocuments: async (filter) => seeded.filter((d) => matches(d, filter)).length,
};

const Module = require("node:module");
const origResolve = Module._resolveFilename;
const origLoad = Module._load;
Module._load = function patched(request, parent) {
  // Both the controller and the sync poller require BusRoute by this path.
  if (request === "../models/BusRoute" && parent && /facility-service[\\/]src/.test(parent.filename)) {
    return BusRouteStub;
  }
  return origLoad.apply(this, arguments);
};

const ctrl = require(
  require("node:path").join(ROOT, "services/facility-service/src/controllers/transportController.js"),
);

// ---------------------------------------------------------------- fixtures
const SCHOOL_A = "schoolA";
const SCHOOL_B = "schoolB";

function route(over) {
  return {
    _id: over._id,
    schoolId: over.schoolId || SCHOOL_A,
    branchId: over.branchId ?? null,
    routeNo: over.routeNo,
    driverName: "Asha Verma",
    driverContact: "9876543210",
    vehicleNo: "MH-01-AB-1234",
    stops: over.stops || [
      { name: "School", lat: 19.1197, lng: 72.8464, sequence: 1 },
      { name: "Andheri", lat: 19.1136, lng: 72.8697, sequence: 2 },
      { name: "Bandra", lat: 19.0596, lng: 72.8295, sequence: 3 },
    ],
    assignedStudents: over.assignedStudents || [],
    currentLocation: over.currentLocation,
    tracking: over.tracking || { provider: "none", deviceId: null, enabled: false },
    nextStopIndex: over.nextStopIndex ?? 0,
    routePlan: over.routePlan,
    toObject() {
      return JSON.parse(JSON.stringify({ ...this, stops: this.stops }));
    },
  };
}

function ctx(user, extra = {}) {
  return {
    user,
    tenantId: extra.tenantId ?? user.schoolId,
    branchId: extra.branchId ?? null,
    params: extra.params || {},
    query: extra.query || {},
    body: extra.body || {},
  };
}

function res() {
  const r = { statusCode: 200, payload: null };
  r.status = (c) => {
    r.statusCode = c;
    return r;
  };
  r.json = (p) => {
    r.payload = p;
    return r;
  };
  return r;
}

const studentUser = { role: "student", schoolId: SCHOOL_A, refId: "ADM-1001" };
const parentUser = {
  role: "parent",
  schoolId: SCHOOL_A,
  linkedStudentIds: ["ADM-1001", "ADM-1002"],
};
const staffUser = { role: "staff", designation: "transport", schoolId: SCHOOL_A };
const otherTenantUser = { role: "staff", designation: "transport", schoolId: SCHOOL_B };

const results = [];
const check = (name, fn) => {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, err: err.message });
  }
};

(async () => {
  // --- 1. myRoute only ever returns the viewer's own route ------------------
  seeded.length = 0;
  seeded.push(
    route({ _id: "r1", routeNo: "R-01", assignedStudents: ["ADM-1001", "ADM-1002"] }),
    route({ _id: "r2", routeNo: "R-02", assignedStudents: ["ADM-2001"] }),
    route({ _id: "r3", routeNo: "R-03", schoolId: SCHOOL_B, assignedStudents: ["ADM-1001"] }),
  );

  const studentRes = res();
  await ctrl.myRoute(ctx(studentUser), studentRes);
  check("student /me returns only their route", () => {
    assert.strictEqual(studentRes.payload.count, 1);
    assert.strictEqual(studentRes.payload.data[0].routeNo, "R-01");
  });

  const parentRes = res();
  await ctrl.myRoute(ctx(parentUser), parentRes);
  check("parent /me returns only linked children's route", () => {
    assert.strictEqual(parentRes.payload.count, 1);
    assert.strictEqual(parentRes.payload.data[0]._id, "r1");
  });

  // A parent cannot widen the scope with an arbitrary admissionNo: the
  // identity filter comes from the token, never from the query string.
  const parentSpoof = res();
  await ctrl.myRoute(ctx(parentUser, { query: { admissionNo: "ADM-2001" } }), parentSpoof);
  check("parent /me ignores a spoofed admissionNo", () => {
    assert.strictEqual(parentSpoof.payload.count, 1);
    assert.strictEqual(parentSpoof.payload.data[0]._id, "r1");
  });

  const staffNoParam = res();
  await ctrl.myRoute(ctx(staffUser), staffNoParam);
  check("staff /me without admissionNo returns nothing (no fleet leak)", () => {
    assert.strictEqual(staffNoParam.payload.count, 0);
  });

  // --- 2. tenant isolation on a read ---------------------------------------
  seeded.length = 0;
  seeded.push(
    route({ _id: "r1", routeNo: "R-01", schoolId: SCHOOL_A }),
    route({ _id: "r2", routeNo: "R-01", schoolId: SCHOOL_B }),
  );
  const listA = res();
  await ctrl.getRoutes(ctx(staffUser), listA);
  check("getRoutes is tenant-scoped", () => {
    assert.strictEqual(listA.payload.total, 1);
    assert.strictEqual(listA.payload.data[0].schoolId, SCHOOL_A);
  });

  // --- 3. updateLocation validates and stamps provenance --------------------
  seeded.length = 0;
  seeded.push(route({ _id: "r1", routeNo: "R-01" }));

  const badLoc = res();
  await ctrl.updateLocation(ctx(staffUser, { params: { id: "r1" }, body: { lat: "abc", lng: 1 } }), badLoc);
  check("updateLocation rejects non-numeric coordinates", () => {
    assert.strictEqual(badLoc.statusCode, 400);
  });

  const outOfRange = res();
  await ctrl.updateLocation(ctx(staffUser, { params: { id: "r1" }, body: { lat: 999, lng: 1 } }), outOfRange);
  check("updateLocation rejects out-of-range latitude", () => {
    assert.strictEqual(outOfRange.statusCode, 400);
  });

  const goodLoc = res();
  await ctrl.updateLocation(
    ctx(staffUser, { params: { id: "r1" }, body: { lat: 19.1, lng: 72.8 } }),
    goodLoc,
  );
  check("updateLocation stamps source=manual", () => {
    assert.strictEqual(goodLoc.payload.data.currentLocation.source, "manual");
    assert.ok(goodLoc.payload.data.currentLocation.updatedAt);
  });

  // A manual fix must not be clobbered by a provider fix that is older than it.
  const syncSvc = require(
    require("node:path").join(ROOT, "services/facility-service/src/services/traccarSync.js"),
  );
  const manualAt = seeded[0].currentLocation.updatedAt;
  const before = JSON.stringify(seeded[0].currentLocation);

  // The provider returns no positions in this pass, so the poller must leave the
  // manual fix exactly where it is.
  let writeAttempted = false;
  const realUpdateOne = BusRouteStub.updateOne;
  BusRouteStub.updateOne = async () => {
    writeAttempted = true;
    return { modifiedCount: 0 };
  };
  seeded[0].tracking = { provider: "traccar", deviceId: "dev-1234", enabled: true };
  await syncSvc.syncOnce();
  BusRouteStub.updateOne = realUpdateOne;
  check("a provider with no fixes leaves the manual fix untouched", () => {
    assert.strictEqual(writeAttempted, false);
    assert.strictEqual(JSON.stringify(seeded[0].currentLocation), before);
  });

  const traccarSvc = require(
    require("node:path").join(ROOT, "services/facility-service/src/services/traccar.js"),
  );
  check("normalizePosition rejects impossible coordinates", () => {
    assert.strictEqual(traccarSvc.normalizePosition({ latitude: 999, longitude: 1 }), null);
    assert.strictEqual(traccarSvc.normalizePosition({ latitude: "x", longitude: 1 }), null);
    assert.strictEqual(traccarSvc.normalizePosition({}), null);
  });
  check("normalizePosition converts Traccar speed m/s to km/h", () => {
    const fix = traccarSvc.normalizePosition({
      latitude: 19.1,
      longitude: 72.8,
      speed: 10,
      course: 275,
      fixTime: Date.now(),
    });
    assert.strictEqual(fix.speedKmh, 18);
    assert.strictEqual(fix.headingDeg, 275);
  });
  check("normalizePosition normalises course to 0-359", () => {
    const fix = traccarSvc.normalizePosition({
      latitude: 19.1,
      longitude: 72.8,
      course: -90,
      fixTime: Date.now(),
    });
    assert.strictEqual(fix.headingDeg, 270);
  });

  // --- 3b. the poller writes a fresh fix, and only that --------------------
  // Re-point the fake provider at a real fix for the bound device.
  const nowMs = Date.now();
  global.fetch = async (url) => {
    const u = new URL(String(url));
    if (u.pathname === "/api/positions") {
      // Older than the manual fix: the poller must not go backwards in time.
      if (global.__fixAge === "old") {
        return { ok: true, status: 200, json: async () => [{ deviceId: "dev-1234", latitude: 1, longitude: 1, fixTime: manualAt.getTime() - 60000 }] };
      }
      return {
        ok: true,
        status: 200,
        json: async () => [
          { deviceId: "dev-1234", latitude: 19.11, longitude: 72.81, speed: 5, course: 90, fixTime: nowMs },
        ],
      };
    }
    return { ok: true, status: 200, json: async () => [] };
  };
  global.__fixAge = "old";
  const appliedOld = await syncSvc.applyPosition(seeded[0], {
    lat: 1,
    lng: 1,
    updatedAt: new Date(manualAt.getTime() - 60000),
  });
  check("a provider fix older than the stored one is not applied", () => {
    assert.strictEqual(appliedOld, false);
  });

  global.__fixAge = "new";
  const appliedFresh = await syncSvc.applyPosition(seeded[0], {
    lat: 19.11,
    lng: 72.81,
    updatedAt: new Date(nowMs),
    speedKmh: 18,
    headingDeg: 90,
  });
  check("a fresh provider fix is applied and stamps source=traccar", () => {
    assert.strictEqual(appliedFresh, true);
    const loc = seeded[0].currentLocation;
    assert.strictEqual(loc.lat, 19.11);
    assert.strictEqual(loc.source, "traccar");
    assert.strictEqual(loc.speedKmh, 18);
    assert.ok(seeded[0].lastSyncedAt);
  });

  const appliedStale = await syncSvc.applyPosition(seeded[0], {
    lat: 5,
    lng: 5,
    updatedAt: new Date(Date.now() - 60 * 60 * 1000),
  });
  check("an hour-old fix is treated as stale and dropped", () => {
    assert.strictEqual(appliedStale, false);
    assert.strictEqual(seeded[0].currentLocation.lat, 19.11);
  });

  // restore the plain provider stub for the remaining checks
  global.fetch = providerStub;

  // --- 4. device binding is provider-owned ---------------------------------
  seeded.length = 0;
  seeded.push(route({ _id: "r1", routeNo: "R-01" }));

  const badDevice = res();
  await ctrl.bindDevice(
    ctx(staffUser, { params: { id: "r1" }, body: { deviceId: "../../etc/passwd" } }),
    badDevice,
  );
  check("bindDevice rejects a path-traversal-shaped deviceId", () => {
    assert.strictEqual(badDevice.statusCode, 400);
  });

  const emptyDevice = res();
  await ctrl.bindDevice(ctx(staffUser, { params: { id: "r1" }, body: {} }), emptyDevice);
  check("bindDevice requires a deviceId", () => {
    assert.strictEqual(emptyDevice.statusCode, 400);
  });

  // An id the provider does not know must not be stored: that is what used to
  // leave a route with a permanently blank map marker.
  const unknownDevice = res();
  await ctrl.bindDevice(
    ctx(staffUser, { params: { id: "r1" }, body: { deviceId: "dev-does-not-exist" } }),
    unknownDevice,
  );
  check("bindDevice refuses a device the provider does not know", () => {
    assert.strictEqual(unknownDevice.statusCode, 404);
    assert.strictEqual(seeded[0].tracking.deviceId, null);
  });

  const okDevice = res();
  await ctrl.bindDevice(
    ctx(staffUser, { params: { id: "r1" }, body: { deviceId: "dev-1234" } }),
    okDevice,
  );
  check("bindDevice saves a traccar binding, named from the provider", () => {
    assert.strictEqual(okDevice.payload.data.tracking.provider, "traccar");
    assert.strictEqual(okDevice.payload.data.tracking.deviceId, "dev-1234");
    assert.strictEqual(okDevice.payload.data.tracking.deviceName, "Bus 12");
  });

  // The device picker is fed by our backend, never by the provider credential.
  const picker = res();
  await ctrl.providerDevices(ctx(staffUser), picker);
  check("provider device list is served to staff from the backend", () => {
    const ids = picker.payload.data.devices.map((d) => d.id);
    assert.deepStrictEqual(ids, ["dev-1234", "dev-5678"]);
    assert.strictEqual(picker.payload.data.devices[0].name, "Bus 12");
  });
  check("device list drops provider entries with an unsafe id", () => {
    assert.ok(
      !picker.payload.data.devices.some((d) => d.id.includes("..")),
      "a device id with path characters must not be offered for binding",
    );
  });

  // One device cannot track two routes in the same school.
  seeded.push(route({ _id: "r2", routeNo: "R-02" }));
  const clash = res();
  await ctrl.bindDevice(
    ctx(staffUser, { params: { id: "r2" }, body: { deviceId: "dev-1234" } }),
    clash,
  );
  check("bindDevice refuses a device already bound to another route", () => {
    assert.strictEqual(clash.statusCode, 409);
  });

  const unbind = res();
  await ctrl.unbindDevice(ctx(staffUser, { params: { id: "r1" } }), unbind);
  check("unbindDevice clears the binding", () => {
    assert.strictEqual(unbind.payload.data.tracking.deviceId, null);
    assert.strictEqual(unbind.payload.data.tracking.enabled, false);
  });

  // --- 5. history / sync require a bound device ---------------------------
  const noDevice = res();
  await ctrl.routeHistory(ctx(staffUser, { params: { id: "r2" }, query: {} }), noDevice);
  check("routeHistory refuses an unbound route", () => {
    assert.strictEqual(noDevice.statusCode, 400);
  });

  const noDeviceSync = res();
  await ctrl.syncRoute(ctx(staffUser, { params: { id: "r2" } }), noDeviceSync);
  check("syncRoute refuses an unbound route", () => {
    assert.strictEqual(noDeviceSync.statusCode, 400);
  });

  // --- 5b. "sync now" touches only the requested route ---------------------
  seeded.length = 0;
  seeded.push(
    route({ _id: "r1", routeNo: "R-01" }),
    route({ _id: "r2", routeNo: "R-02" }),
  );
  seeded[0].tracking = { provider: "traccar", deviceId: "dev-1234", enabled: true };
  seeded[1].tracking = { provider: "traccar", deviceId: "dev-5678", enabled: true };
  providerCalls.length = 0;

  // A fleet-wide pass must touch only the route that was asked for.
  {
    const realUpdateOne = BusRouteStub.updateOne;
    const touched = [];
    BusRouteStub.updateOne = async (filter, update) => {
      touched.push(String(filter._id));
      return realUpdateOne(filter, update);
    };
    await syncSvc.syncOneRoute(seeded[0]);
    BusRouteStub.updateOne = realUpdateOne;
    check("syncRoute syncs a single device instead of the whole fleet", async () => {
      assert.deepStrictEqual(touched, ["r1"]);
      const posCall = providerCalls.find((u) => u.includes("/api/positions"));
      assert.deepStrictEqual(
        new URL(posCall).searchParams.getAll("deviceId"),
        ["dev-1234"],
        "only the requested device may be queried",
      );
    });
  }
  check("syncRoute is a no-op for a route with no device", async () => {
    const out = await syncSvc.syncOneRoute(route({ _id: "r3", routeNo: "R-03" }));
    assert.strictEqual(out.updated, false);
    assert.strictEqual(out.reason, "no device bound");
  });

  const futureWindow = res();
  seeded[0].tracking = { provider: "traccar", deviceId: "dev-1234", enabled: true };
  await ctrl.routeHistory(
    ctx(staffUser, { params: { id: "r1" }, query: { from: String(Date.now() + 864e5) } }),
    futureWindow,
  );
  check("routeHistory rejects a window that ends in the future", () => {
    assert.strictEqual(futureWindow.statusCode, 400);
  });

  // --- 6. history window cap ----------------------------------------------
  seeded[1].tracking = { provider: "traccar", deviceId: "dev-9999", enabled: true };
  const tooWide = res();
  await ctrl.routeHistory(
    ctx(staffUser, { params: { id: "r2" }, query: { from: String(Date.now() - 30 * 864e5) } }),
    tooWide,
  );
  check("routeHistory caps the window at 7 days", () => {
    assert.strictEqual(tooWide.statusCode, 400);
  });

  // --- 6b. repeated deviceId params reach Traccar correctly ----------------
  // Regression guard: the query was once nested under a `params` key, which
  // silently produced `?params=deviceId%3D1` and returned no rows at all.
  check("positions query uses repeated deviceId params, not a nested key", async () => {
    const src = fs.readFileSync(
      require("node:path").join(ROOT, "services/facility-service/src/services/traccar.js"),
      "utf8",
    );
    assert.ok(
      src.includes("params instanceof URLSearchParams"),
      "traccarGet must handle URLSearchParams so repeated keys survive",
    );
    assert.ok(
      !/traccarGet\("positions",\s*\{\s*params:/.test(src),
      "positions must not pass a nested params object",
    );
  });

  // Behavioural version of the same guard: watch the real outgoing URL.
  {
    providerCalls.length = 0;
    await traccarSvc.positionsForDevices(["dev-1234", "dev-5678"]);
    const call = providerCalls.find((u) => u.includes("/api/positions"));
    assert.ok(call, "positionsForDevices must call the provider");
    const qs = new URL(call).searchParams;
    assert.deepStrictEqual(qs.getAll("deviceId"), ["dev-1234", "dev-5678"]);
    assert.strictEqual(qs.get("params"), null);
  }

  check("provider calls carry the bearer token, never credentials in the URL", () => {
    assert.ok(
      providerCalls.every((u) => !u.includes("verify-token")),
      "the Traccar token must not appear in a request URL",
    );
  });

  // --- 6c. fleet endpoints are staff-only ---------------------------------
  const { authorizeRoles } = require(
    require("node:path").join(ROOT, "services/facility-service/src/middleware/auth.js"),
  );
  const staffOnly = authorizeRoles("school_admin", "super_admin", "staff");

  const gate = (role) => {
    const r = { statusCode: 200 };
    r.status = (c) => {
      r.statusCode = c;
      return r;
    };
    r.json = () => r;
    let passed = false;
    staffOnly({ user: { role } }, r, () => {
      passed = true;
    });
    return passed;
  };
  check("fleet endpoints admit staff", () => {
    assert.strictEqual(gate("staff"), true);
  });
  check("fleet endpoints admit a school admin", () => {
    assert.strictEqual(gate("school_admin"), true);
  });
  check("fleet endpoints admit a super admin", () => {
    assert.strictEqual(gate("super_admin"), true);
  });
  check("fleet endpoints refuse a parent, even with transport:read", () => {
    assert.strictEqual(gate("parent"), false);
  });
  check("fleet endpoints refuse a student", () => {
    assert.strictEqual(gate("student"), false);
  });

  // --- 6d. draft plan preview is reachable without a route id -------------
  const routesSrc = fs.readFileSync(
    require("node:path").join(ROOT, "services/facility-service/src/routes/transportRoutes.js"),
    "utf8",
  );
  check("draft plan preview has a static path, so no ObjectId is required", () => {
    assert.ok(
      routesSrc.includes('router.post("/plan/preview"'),
      "POST /plan/preview must exist for a route that has not been created yet",
    );
    assert.ok(
      routesSrc.indexOf('router.post("/plan/preview"') <
        routesSrc.indexOf('router.post("/:id/plan/preview"'),
      "the static draft path must be registered first",
    );
  });
  check("fleet list and device endpoints are behind the staff guard", () => {
    assert.ok(/router\.get\("\/", requirePermission\("transport:read"\), staffOnly/.test(routesSrc));
    assert.ok(/router\.get\("\/devices".*staffOnly/.test(routesSrc));
    assert.ok(/router\.get\("\/tracking\/status".*staffOnly/.test(routesSrc));
  });
  check("the viewer route stays open to students and parents", () => {
    const viewer = routesSrc.match(/router\.get\("\/me"[^;]*;/)[0];
    assert.ok(!viewer.includes("staffOnly"), "/me must remain reachable for students and parents");
  });

  // --- 6e. geocoding is opt-in and never leaks traffic to a public instance
  const geocoder = require(
    require("node:path").join(ROOT, "services/facility-service/src/services/geocoder.js"),
  );
  const status = geocoder.geocoderStatus();
  check("geocoding is off unless explicitly enabled", () => {
    assert.strictEqual(status.enabled, false);
  });
  check("the planner still works with geocoding off (map pins + manual stops)", async () => {
    assert.deepStrictEqual((await geocoder.searchPlaces("andheri")).results, []);
    assert.strictEqual(await geocoder.reversePlace(19.1, 72.8), null);
  });

  check("stale-fix guard drops old fixes and keeps fresh ones", () => {
    assert.strictEqual(syncSvc.isStale(new Date(Date.now() - 30 * 60 * 1000)), true);
    assert.strictEqual(syncSvc.isStale(new Date(Date.now() - 5000)), false);
    assert.strictEqual(syncSvc.isStale("not-a-date"), true);
  });

  // --- 7. stop normalisation ----------------------------------------------
  seeded.length = 0;
  const created = res();
  await ctrl.createRoute(
    ctx(staffUser, {
      body: {
        routeNo: "R-09",
        schoolId: SCHOOL_B, // must be ignored: tenant comes from the token
        branchId: "forged-branch",
        routeNo: "R-09",
        stops: [
          { name: "  Gate  " },
          { name: "Zoo", lat: "19.1", lng: "72.8" },
          { name: "" },
          { name: "Bad", lat: "abc", lng: 5 },
        ],
        tracking: { deviceId: "attacker-device" },
      },
    }),
    created,
  );
  check("createRoute ignores client-supplied schoolId/branchId/tracking", () => {
    const d = created.payload.data;
    assert.strictEqual(d.schoolId, SCHOOL_A);
    assert.strictEqual(d.tracking?.deviceId ?? null, null);
  });
  check("createRoute trims names, drops empty stops, keeps sparse stops", () => {
    const d = created.payload.data;
    assert.strictEqual(d.stops.length, 3);
    assert.strictEqual(d.stops[0].name, "Gate");
    assert.strictEqual(d.stops[0].lat, undefined);
    assert.strictEqual(d.stops[1].lat, 19.1);
    assert.strictEqual(d.stops[2].lat, undefined, "non-numeric coords must not be stored");
  });
  check("createRoute assigns a 1-based sequence", () => {
    assert.deepStrictEqual(created.payload.data.stops.map((s) => s.sequence), [1, 2, 3]);
  });

  // --- 8. geocoding validation --------------------------------------------
  const shortQuery = res();
  await ctrl.searchPlacesFor(ctx(staffUser, { query: { q: "ab" } }), shortQuery);
  check("place search ignores queries under 3 chars", () => {
    assert.deepStrictEqual(shortQuery.payload.data.results, []);
  });

  const badReverse = res();
  await ctrl.reversePlaceFor(ctx(staffUser, { query: { lat: "x", lng: "y" } }), badReverse);
  check("reverse geocode rejects invalid coordinates", () => {
    assert.strictEqual(badReverse.statusCode, 400);
  });

  // --- 9. plan preview needs 2 routable stops ------------------------------
  const thinPlan = res();
  await ctrl.previewPlan(
    ctx(staffUser, { params: { id: "draft" }, body: { stops: [{ name: "A" }] } }),
    thinPlan,
  );
  check("plan preview returns unavailable for <2 routable stops", () => {
    assert.strictEqual(thinPlan.payload.data.source, "unavailable");
    assert.strictEqual(thinPlan.payload.data.totalKm, null);
  });

  // --- 10. cross-tenant writes are refused --------------------------------
  seeded.length = 0;
  seeded.push(route({ _id: "rB", routeNo: "R-B", schoolId: SCHOOL_B }));
  const crossWrite = res();
  await ctrl.updateRoute(
    ctx(otherTenantUser, { params: { id: "rB" }, body: { routeNo: "hijacked" } }),
    crossWrite,
  );
  check("a school-B user can update its own route", () => {
    assert.strictEqual(crossWrite.statusCode, 200);
  });

  const crossRead = res();
  await ctrl.updateRoute(
    ctx(staffUser, { params: { id: "rB" }, body: { routeNo: "stolen" } }),
    crossRead,
  );
  check("a school-A user cannot touch school-B's route", () => {
    assert.strictEqual(crossRead.statusCode, 404);
  });

  const missing = res();
  await ctrl.updateRoute(ctx(staffUser, { params: { id: "rB" }, body: {} }), missing);
  check("updateRoute 404s rather than leaking existence", () => {
    assert.strictEqual(missing.payload.message, "Route not found");
  });

  // --- 11. unassign --------------------------------------------------------
  seeded.length = 0;
  seeded.push(route({ _id: "r1", routeNo: "R-01", assignedStudents: ["ADM-1", "ADM-2"] }));
  const unassigned = res();
  BusRouteStub.findOneAndUpdate = async (filter, update) => {
    const doc = seeded.find((d) => matches(d, filter));
    if (!doc) return null;
    if (update.$pull) {
      doc.assignedStudents = doc.assignedStudents.filter(
        (v) => !update.$pull.assignedStudents.includes(v),
      );
    }
    Object.assign(doc, update.$set || {});
    return doc;
  };
  await ctrl.unassignStudent(
    ctx(staffUser, { params: { id: "r1" }, body: { studentId: "ADM-1" } }),
    unassigned,
  );
  check("unassign removes only the requested student", () => {
    assert.deepStrictEqual(unassigned.payload.data.assignedStudents, ["ADM-2"]);
  });

  const noStudent = res();
  await ctrl.unassignStudent(ctx(staffUser, { params: { id: "r1" }, body: {} }), noStudent);
  check("unassign requires a studentId", () => {
    assert.strictEqual(noStudent.statusCode, 400);
  });

  // ---------------------------------------------------------------- report
  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `\n      ${r.err}`}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((err) => {
  console.error("verification crashed:", err);
  process.exit(1);
});