// Route planning helpers for the transport controller.
//
// OSRM (shared/src/utils/osrm.js) already knows how to drive between points;
// this module only maps its raw output onto the shape the UI renders, and adds
// the stop-sequence bookkeeping the planner needs.

const { routePlan } = require("@school-erp/shared/src/utils/osrm");

/** Normalise a client-supplied stop list into the model's stop shape. */
function normalizeStops(stops) {
  return (Array.isArray(stops) ? stops : [])
    .filter((s) => s && typeof s === "object")
    // Shape the stop first, then number it: numbering before filtering would
    // leave gaps in `sequence` whenever an unnamed stop is dropped.
    .map((s) => {
      const stop = { name: String(s.name || "").trim().slice(0, 160) };
      if (typeof s.time === "string" && s.time.trim()) stop.time = s.time.trim().slice(0, 40);
      if (Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng))) {
        stop.lat = Number(s.lat);
        stop.lng = Number(s.lng);
      }
      return stop;
    })
    .filter((s) => s.name)
    .map((stop, i) => ({ ...stop, sequence: i + 1 }));
}

const routable = (stops) => stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));

/**
 * Full stop-by-stop plan with cumulative arrival offsets.
 *
 * leg i covers stops[i] -> stops[i+1]; arrivalMinute is the cumulative driving
 * time from the first stop, so the UI can label each stop without a second
 * routing call.
 */
async function buildPreview(stops) {
  const plan = await routePlan(stops);

  let cumulative = 0;
  const legs = (plan.legs || []).map((leg, i) => {
    cumulative += leg.minutes || 0;
    return {
      ...leg,
      fromStop: stops[i]?.name || null,
      toStop: stops[i + 1]?.name || null,
      arrivalMinute: cumulative,
    };
  });

  return {
    stops,
    routableCount: routable(stops).length,
    totalKm: plan.totalKm,
    totalMinutes: plan.totalMinutes,
    source: plan.source,
    legs,
  };
}

module.exports = { normalizeStops, routable, buildPreview };