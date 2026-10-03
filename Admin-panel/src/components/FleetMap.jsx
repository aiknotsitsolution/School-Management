import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";

// Shared Leaflet map for every transport surface (Fleet Tracking, the route
// planner, and the student/parent "My School Bus" view).
//
// It was extracted from BusTracking.jsx, which had the map inline and could not
// be reused. Keeping it as one component is what stops three slightly different
// copies of marker/cleanup logic from drifting apart.
//
// OpenStreetMap tiles are used, consistent with the existing tracking map; the
// attribution string is required by the tile usage policy.

const FALLBACK_CENTER = { lat: 20.5937, lng: 78.9629 }; // geographic centre of India

export const hasFix = (item) => {
  const loc = item?.currentLocation ?? item?.location;
  return !!loc && typeof loc.lat === "number" && typeof loc.lng === "number";
};

const coordOf = (item) => {
  const loc = item?.currentLocation ?? item?.location;
  return [loc.lat, loc.lng];
};

const stopCoord = (stop) =>
  stop && Number.isFinite(Number(stop.lat)) && Number.isFinite(Number(stop.lng))
    ? [Number(stop.lng), Number(stop.lat)] // GeoJSON order
    : null;

function makeBusIcon(color, heading) {
  const rotate = Number.isFinite(heading) ? `transform:rotate(${heading}deg);` : "";
  return L.divIcon({
    className: "",
    html: `
      <div class="bus-marker" style="--marker-color:${color}">
        <div class="bus-marker-dot" style="${rotate}"><span>🚌</span></div>
      </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function makeSchoolIcon() {
  return L.divIcon({
    className: "",
    html: `<div class="school-marker"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 22v-4a2 2 0 0 0-4 0v4"/><path d="m18 10 3.447 1.724a2 2 0 0 1-.553 1.895H.106a2 2 0 0 1-.553-1.895L3 10"/><path d="M5 17V9L12 4l7 5v8"/><path d="M9 17v-3.5a1.5 1.5 0 0 1 3 0V17"/></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function makeStopIcon(index, active) {
  const bg = active ? "#4F46E5" : "#0F172A";
  return L.divIcon({
    className: "",
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${bg};color:#fff;font:700 11px/24px system-ui,sans-serif;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.35)">${index + 1}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

/**
 * @param routes        routes to plot (each needs currentLocation for a bus marker)
 * @param selected      currently selected route id/object, for highlight
 * @param onSelect      click handler for a bus marker
 * @param schoolLocation  optional { lat, lng } campus marker
 * @param schoolName
 * @param stops         optional [{ name, lat, lng, sequence }] to draw as numbered pins
 * @param activeStopIndex  which stop pin is highlighted (planner)
 * @param onMapClick    optional map click handler (planner: drop a stop)
 * @param polyline      optional [[lat,lng], ...] to draw as the route shape
 * @param className     extra classes on the wrapper
 */
export default function FleetMap({
  routes = [],
  selected = null,
  onSelect,
  schoolLocation = null,
  schoolName = "School",
  stops = [],
  activeStopIndex = -1,
  onMapClick,
  polyline = null,
  className = "",
  overlay = null,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const stopMarkersRef = useRef([]);
  const lineRef = useRef(null);
  // Keep the newest callback reachable without re-creating the map: the map is
  // built once and then mutated, so changing onSelect must not tear it down.
  // Written in an effect (not during render) so the refs stay consistent even
  // if the compiler skips an optimization pass.
  const onSelectRef = useRef(onSelect);
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onMapClickRef.current = onMapClick;
  });

  const located = useMemo(
    () => routes.filter(hasFix).map(coordOf),
    [routes],
  );

  const stopPoints = useMemo(
    () =>
      (stops || [])
        .map((s) => stopCoord(s))
        .filter(Boolean)
        .map(([lng, lat]) => [lat, lng]),
    [stops],
  );

  // Create the map once. The initial centre is only a viewport default: it is
  // deliberately never treated as a claimed location (the School model has no
  // coordinates, and a route may not have reported a fix yet).
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const hasSchoolFix =
      schoolLocation &&
      typeof schoolLocation.lat === "number" &&
      typeof schoolLocation.lng === "number";
    const center =
      located[0] ||
      (hasSchoolFix
        ? [schoolLocation.lat, schoolLocation.lng]
        : [FALLBACK_CENTER.lat, FALLBACK_CENTER.lng]);

    const map = L.map(containerRef.current, { center, zoom: 13 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    if (hasSchoolFix) {
      L.marker([schoolLocation.lat, schoolLocation.lng], {
        icon: makeSchoolIcon(),
        zIndexOffset: 1000,
      })
        .addTo(map)
        .bindTooltip(schoolName || "School", { direction: "top", offset: [0, -20] });
    }

    // Attached unconditionally and dispatched through the ref, so a caller that
    // enables onMapClick after mount still works without rebuilding the map.
    map.on("click", (e) =>
      onMapClickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
    );

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
      stopMarkersRef.current = [];
      lineRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the viewport on the buses without fighting the user's own panning:
  // only refit when the set of reported positions actually changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const points = [...located, ...stopPoints];
    if (points.length === 0) return;
    map.fitBounds(points, { padding: [50, 50], maxZoom: 15 });
  }, [located, stopPoints]);

  // Bus markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set();
    routes.filter(hasFix).forEach((r) => {
      const id = r._id ?? r.id ?? r.routeNo;
      if (id === undefined || id === null) return;
      seen.add(String(id));
      const [lat, lng] = coordOf(r);
      const existing = markersRef.current[String(id)];
      if (existing) {
        existing.setLatLng([lat, lng]);
      } else {
        const marker = L.marker([lat, lng], { icon: makeBusIcon("#16A34A", r.currentLocation?.headingDeg) });
        marker.on("click", () => onSelectRef.current?.(r));
        marker.addTo(map);
        markersRef.current[String(id)] = marker;
      }
    });
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      if (!seen.has(id)) {
        map.removeLayer(marker);
        delete markersRef.current[id];
      }
    });
  }, [routes]);

  // Highlight the selected bus without rebuilding its marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const selectedId = selected?._id ?? selected?.id ?? selected?.routeNo;
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const el = marker.getElement();
      const dot = el?.querySelector?.(".bus-marker");
      if (dot) dot.classList.toggle("is-selected", selectedId != null && String(selectedId) === id);
    });
  }, [selected]);

  // Numbered stop pins for the planner / route detail.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    stopMarkersRef.current.forEach((m) => map.removeLayer(m));
    stopMarkersRef.current = [];
    (stops || []).forEach((stop, i) => {
      const c = stopCoord(stop);
      if (!c) return;
      const marker = L.marker(c, { icon: makeStopIcon(i, i === activeStopIndex) }).addTo(map);
      marker.bindTooltip(stop.name || `Stop ${i + 1}`, { direction: "top", offset: [0, -14] });
      stopMarkersRef.current.push(marker);
    });
  }, [stops, activeStopIndex]);

  // Optional route shape (e.g. an OSRM geometry, or a simple stop-to-stop line).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lineRef.current) {
      map.removeLayer(lineRef.current);
      lineRef.current = null;
    }
    const points = polyline?.length >= 2 ? polyline : stopPoints;
    if (points.length < 2) return;
    lineRef.current = L.polyline(points, {
      color: "#4F46E5",
      weight: 3,
      opacity: 0.75,
    }).addTo(map);
  }, [polyline, stopPoints]);

  return (
    <div className={`relative min-h-[420px] ${className}`}>
      <div ref={containerRef} className="absolute inset-0" />
      {overlay}
    </div>
  );
}