// OSRM (Open Source Routing Machine) helper for live transport tracking.
//
// Real-road distance/duration between the bus position and a stop, instead of
// a straight-line guess.  Backed by the public demo server by default; point
// OSRM_BASE_URL at your own instance for production traffic.
//
// Every call is best-effort: if OSRM is unreachable, slow or misconfigured the
// helpers resolve to `null` and the caller falls back to haversine, so live
// tracking keeps working without routing data.

const OSRM_BASE_URL = (process.env.OSRM_BASE_URL || "http://router.project-osrm.org").replace(/\/+$/, "");
const OSRM_TIMEOUT_MS = Number(process.env.OSRM_TIMEOUT_MS || 15000);

const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Straight-line distance in km — the fallback when OSRM cannot answer. */
function haversineKm(a, b) {
  if (!validCoord(a) || !validCoord(b)) return null;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(s));
}

function validCoord(c) {
  return (
    !!c &&
    Number.isFinite(Number(c.lat)) &&
    Number.isFinite(Number(c.lng)) &&
    Number(c.lat) >= -90 &&
    Number(c.lat) <= 90 &&
    Number(c.lng) >= -180 &&
    Number(c.lng) <= 180
  );
}

const round1 = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : null);
const roundMinutes = (sec) =>
  Number.isFinite(sec) ? Math.max(1, Math.round(sec / 60)) : null;

/**
 * Driving distance + ETA between two points.
 * Resolves { km, minutes, source } — source is "osrm" or "straight-line".
 */
async function routeBetween(from, to) {
  const fallbackKm = haversineKm(from, to);
  if (!validCoord(from) || !validCoord(to)) {
    return { km: null, minutes: null, source: "unknown" };
  }

  const url =
    `${OSRM_BASE_URL}/route/v1/driving/` +
    `${Number(from.lng)},${Number(from.lat)};${Number(to.lng)},${Number(to.lat)}` +
    `?overview=false&alternatives=false&steps=false`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(OSRM_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`osrm http ${res.status}`);

    const body = await res.json();
    if (body?.code !== "Ok" || !body.routes?.length) {
      throw new Error(`osrm code ${body?.code ?? "unknown"}`);
    }

    const leg = body.routes[0];
    return {
      km: round1(leg.distance / 1000),
      minutes: roundMinutes(leg.duration),
      source: "osrm",
    };
  } catch {
    // OSRM down / slow / no route — keep tracking alive on straight-line data.
    return {
      km: round1(fallbackKm),
      minutes: fallbackKm === null ? null : Math.max(1, Math.round((fallbackKm / 25) * 60)),
      source: "straight-line",
    };
  }
}

/**
 * Full stop-to-stop plan for a route, fetched in ONE OSRM round trip
 * (table service). Returns a leg per consecutive pair, so the UI can show
 * per-stop arrival times and remaining distance.
 */
async function routePlan(stops) {
  const points = (stops || []).filter(validCoord);
  if (points.length < 2) {
    return { legs: [], totalKm: null, totalMinutes: null, source: "unknown" };
  }

  const coords = points.map((p) => `${Number(p.lng)},${Number(p.lat)}`).join(";");
  const url =
    `${OSRM_BASE_URL}/table/v1/driving/${coords}` +
    `?annotations=distance,duration&sources=all&destinations=all`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(OSRM_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`osrm http ${res.status}`);

    const body = await res.json();
    if (body?.code !== "Ok" || !body.distances?.length) {
      throw new Error(`osrm code ${body?.code ?? "unknown"}`);
    }

    // `sources=all` yields one snapped source per input coordinate, so the
    // matrix is square and diagonal-aligned: leg i is [i] -> [i+1].
    const legs = [];
    let totalKm = 0;
    let totalMinutes = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const km = round1((body.distances[i]?.[i + 1] ?? 0) / 1000);
      const minutes = roundMinutes(body.durations?.[i]?.[i + 1]);
      legs.push({ km, minutes });
      totalKm += km ?? 0;
      totalMinutes += minutes ?? 0;
    }

    if (totalKm <= 0) throw new Error("osrm returned no usable distance");

    return {
      legs,
      totalKm: round1(totalKm),
      totalMinutes: totalMinutes || null,
      source: "osrm",
    };
  } catch {
    return { legs: [], totalKm: null, totalMinutes: null, source: "unavailable" };
  }
}

module.exports = {
  OSRM_BASE_URL,
  OSRM_TIMEOUT_MS,
  haversineKm,
  routeBetween,
  routePlan,
  validCoord,
};
