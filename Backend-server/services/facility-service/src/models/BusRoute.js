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
  },
  { _id: false },
);

const busRouteSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    routeNo: { type: String, required: true },
    driverName: { type: String },
    driverContact: { type: String },
    vehicleNo: { type: String },
    stops: [stopSchema],
    assignedStudents: [{ type: String }],
    currentLocation: {
      lat: { type: Number },
      lng: { type: Number },
      updatedAt: { type: Date },
    },
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
      computedAt: { type: Date },
    },
  },
  { timestamps: true }
);

busRouteSchema.index({ schoolId: 1, routeNo: 1 }, { unique: true });

module.exports = mongoose.model("BusRoute", busRouteSchema);
