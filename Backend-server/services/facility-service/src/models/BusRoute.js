const mongoose = require("mongoose");

// Stops carry optional coordinates: they drive the OSRM stop-to-stop plan and
// the live "distance / ETA to next stop" shown on the tracking map. Stops saved
// without coordinates still work — those legs simply fall back to straight-line.
const stopSchema = new mongoose.Schema(
  {
    name: String,
    time: String,
    lat: { type: Number },
    lng: { type: Number },
    // Position in the served order (1-based). The array order is authoritative
    // for routing, but an explicit number lets the planner reorder a stop
    // without shifting every downstream index, and lets the UI label legs.
    sequence: { type: Number },
  },
  { _id: false },
);

const busRouteSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    // Campus this route serves. Two branches can each run their own "R1", so
    // branchId is part of the unique key below.
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    routeNo: { type: String, required: true },
    driverName: { type: String },
    driverContact: { type: String },
    vehicleNo: { type: String },
    stops: [stopSchema],
    // Admission numbers of the students riding this route. Admission numbers
    // are the refId used by student/parent tokens, which is what makes the
    // "My School Bus" lookup a server-side join rather than a client guess.
    assignedStudents: [{ type: String }],
    currentLocation: {
      lat: { type: Number },
      lng: { type: Number },
      updatedAt: { type: Date },
      // Where this fix came from: "traccar" (provider poll) or "manual" (the
      // PATCH /:id/location endpoint). Lets the UI be honest about provenance
      // and stops telemetry overwriting an operator's manual update.
      source: { type: String },
      speedKmh: { type: Number },
      headingDeg: { type: Number },
    },
    // GPS binding. `deviceId` is an opaque Traccar identifier, so it is never
    // accepted from a client as an arbitrary write target: the device lookup
    // and the position fetch are both done server-side against this binding.
    tracking: {
      provider: { type: String, default: "none" }, // "none" | "traccar"
      deviceId: { type: String, default: null },
      deviceName: { type: String, default: null },
      enabled: { type: Boolean, default: false },
      boundAt: { type: Date },
    },
    // When this route last received a provider fix (differs from
    // currentLocation.updatedAt, which is the fix time itself).
    lastSyncedAt: { type: Date },
    // Monotonic pointer to the stop the bus is heading towards (0 = first
    // stop). Lets tracking show forward progress without a timetable engine.
    nextStopIndex: { type: Number, default: 0 },
    // Cached OSRM plan for this stop list, so repeated tracking polls don't
    // re-query the routing service. Invalidated whenever `stops` changes.
    routePlan: {
      totalKm: { type: Number },
      totalMinutes: { type: Number },
      source: { type: String },
      stopsHash: { type: String },
      // Per-leg distance/time between consecutive stops, so the UI can show
      // stop-by-stop arrivals without another routing round trip.
      legs: [
        {
          km: { type: Number },
          minutes: { type: Number },
          fromStop: { type: String },
          toStop: { type: String },
          arrivalMinute: { type: Number },
        },
      ],
      computedAt: { type: Date },
    },
  },
  { timestamps: true }
);

// branchId in the key: route numbers are per campus. Requires dropping the old
// `{ schoolId, routeNo }` index on an existing deployment — see
// scripts/backfill-branches.js.
busRouteSchema.index({ schoolId: 1, branchId: 1, routeNo: 1 }, { unique: true });

module.exports = mongoose.model("BusRoute", busRouteSchema);
