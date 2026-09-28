import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  Bus,
  Phone,
  MapPin,
  User,
  Users,
  Navigation,
  Search,
  RefreshCw,
  Headset,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Input,
  Select,
  Pill,
  StatCard,
} from "../components/UI";
import { LoadingBlock, EmptyBlock, ErrorBlock } from "../components/StateViews";
import { useSelector } from "react-redux";
import { selectSchool } from "../store/selectors";
import { api } from "../lib/api";

const STATUS_LIVE = "Live GPS";
const STATUS_NO_GPS = "No GPS signal";
const STATUS_FILTERS = ["All", STATUS_LIVE, STATUS_NO_GPS];
const STATUS_COLOR = { [STATUS_LIVE]: "#16A34A", [STATUS_NO_GPS]: "#94A3B8" };
const STATUS_TONE = { [STATUS_LIVE]: "success", [STATUS_NO_GPS]: "neutral" };

// Neutral fallback centre (geographic centre of India). Used only when the
// school profile carries no coordinates and no bus has reported a GPS fix yet —
// it is a map viewport default, not a claimed school location.
const FALLBACK_CENTER = { lat: 20.5937, lng: 78.9629 };

function makeBusIcon(color) {
  return L.divIcon({
    className: "",
    html: `
      <div class="bus-marker" style="--marker-color:${color}">
        <div class="bus-marker-dot"><span>🚌</span></div>
      </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function makeSchoolIcon() {
  return L.divIcon({
    className: "",
    html: `
      <div class="school-marker"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 22v-4a2 2 0 0 0-4 0v4"/><path d="m18 10 3.447 1.724a1 1 0 0 1-.553 1.895H.106a1 1 0 0 1-.553-1.895L3 10"/><path d="M5 17V9L12 4l7 5v8"/><path d="M9 17v-3.5a1.5 1.5 0 0 1 3 0V17"/></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function hasFix(route) {
  const loc = route?.currentLocation;
  return (
    !!loc && typeof loc.lat === "number" && typeof loc.lng === "number"
  );
}

function formatPing(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return null;
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function FleetMap({
  routes,
  selected,
  onSelect,
  schoolLocation = null,
  schoolName = "School",
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});

  const located = useMemo(
    () => routes.filter(hasFix).map((r) => [r.currentLocation.lat, r.currentLocation.lng]),
    [routes],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center = located[0] || [schoolLocation?.lat, schoolLocation?.lng] || [
      FALLBACK_CENTER.lat,
      FALLBACK_CENTER.lng,
    ];
    const map = L.map(containerRef.current, { center, zoom: 12 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    if (schoolLocation && typeof schoolLocation.lat === "number") {
      L.marker([schoolLocation.lat, schoolLocation.lng], {
        icon: makeSchoolIcon(),
        zIndexOffset: 1000,
      })
        .addTo(map)
        .bindTooltip(schoolName || "School", { direction: "top", offset: [0, -20] });
    }
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || located.length === 0) return;
    mapRef.current.fitBounds(located, { padding: [50, 50] });
  }, [located]);

  useEffect(() => {
    if (!mapRef.current) return;
    const seen = new Set();
    routes.forEach((r) => {
      if (!hasFix(r)) return;
      seen.add(r.id);
      const pos = [r.currentLocation.lat, r.currentLocation.lng];
      if (markersRef.current[r.id]) {
        markersRef.current[r.id].setLatLng(pos);
      } else {
        const marker = L.marker(pos, {
          icon: makeBusIcon(STATUS_COLOR[STATUS_LIVE]),
          riseOnHover: true,
        });
        marker.bindTooltip(`${r.id} · last ping ${timeAgo(r.currentLocation.updatedAt) || "—"}`, {
          direction: "top",
          offset: [0, -22],
        });
        marker.on("click", () => onSelect(r));
        marker.addTo(mapRef.current);
        markersRef.current[r.id] = marker;
      }
    });
    Object.keys(markersRef.current).forEach((id) => {
      if (!seen.has(id)) {
        mapRef.current.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });
  }, [routes, onSelect]);

  useEffect(() => {
    if (!mapRef.current) return;
    Object.entries(markersRef.current).forEach(([id, m]) => {
      const el = m.getElement();
      if (el) {
        const dot = el.querySelector(".bus-marker");
        if (dot) dot.classList.toggle("is-selected", !!selected && id === selected.id);
      }
    });
  }, [selected]);

  return (
    <div className="relative flex-1 min-h-[520px]">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur rounded-xl shadow px-3 py-2 text-[11px] font-semibold text-ink">
        {located.length > 0
          ? `${located.length} bus${located.length === 1 ? "" : "es"} reporting GPS`
          : "No GPS positions reported yet"}
      </div>
      <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur rounded-xl shadow px-3 py-2 text-[11px] space-y-1">
        <div className="flex items-center gap-2 text-slate-text">
          <span
            className="w-3 h-3 rounded-full inline-block"
            style={{ background: STATUS_COLOR[STATUS_LIVE] }}
          />
          Live GPS position
        </div>
        <div className="text-slate-text/70">
          Positions are shown as last reported by the vehicle.
        </div>
      </div>
    </div>
  );
}

function ContactRow({ icon: Icon, label, name, phone, highlighted }) {
  const tel = (phone || "").replace(/\s/g, "");
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${highlighted ? "bg-primary/15 text-primary-dark" : "bg-paper text-slate-text/70"}`}
      >
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-slate-text/60">{label}</p>
        <p className="text-[13px] font-semibold text-ink truncate">
          {name || "Not provided"}
        </p>
      </div>
      {tel ? (
        <a
          href={`tel:${tel}`}
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-success/10 text-success text-[11.5px] font-semibold hover:bg-success/20 transition-colors"
          title={`Call ${name}`}
        >
          <Phone size={12} /> {phone}
        </a>
      ) : (
        <span className="text-[11.5px] text-slate-text/50">No number</span>
      )}
    </div>
  );
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-lg bg-paper p-2.5">
      <p className="flex items-center gap-1 text-[10.5px] text-slate-text/60 font-medium">
        <Icon size={11} /> {label}
      </p>
      <p className="font-display font-bold text-ink text-[15px] mt-0.5">{value}</p>
    </div>
  );
}

export default function BusTracking() {
  const school = useSelector(selectSchool);

  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.transport.list();
      const loaded = (res?.data || []).map((route) => {
        const loc = hasFix(route) ? route.currentLocation : null;
        return {
          ...route,
          id: route.routeNo || route._id,
          routeText:
            route.stops?.map((stop) => stop.name).filter(Boolean).join(" — ") ||
            "Stops not configured",
          status: loc ? STATUS_LIVE : STATUS_NO_GPS,
          location: loc,
          assigned: route.assignedStudents?.length || 0,
          driver: route.driverName || "Driver not assigned",
          driverPhone: route.driverContact || "",
          vehicleNo: route.vehicleNo || "—",
          stopCount: route.stops?.length || 0,
        };
      });
      setRoutes(loaded);
      setSelected((prev) =>
        prev ? loaded.find((r) => r.id === prev.id) || loaded[0] || null : loaded[0] || null,
      );
    } catch (err) {
      setError(err.message || "Could not load transport routes");
      setRoutes([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return routes.filter((b) => {
      const matchStatus = statusFilter === "All" || b.status === statusFilter;
      const matchQuery =
        !q ||
        b.id.toLowerCase().includes(q) ||
        b.routeText.toLowerCase().includes(q) ||
        b.driver.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [routes, query, statusFilter]);

  const stats = useMemo(() => {
    const live = routes.filter(hasFix).length;
    const assigned = routes.reduce((a, b) => a + b.assigned, 0);
    const pings = routes
      .map((r) => r.location?.updatedAt)
      .filter(Boolean)
      .map((d) => new Date(d).getTime())
      .filter((t) => !Number.isNaN(t));
    const newest = pings.length ? new Date(Math.max(...pings)) : null;
    return {
      total: routes.length,
      live,
      assigned,
      lastPing: timeAgo(newest) || "—",
    };
  }, [routes]);

  const renderBody = () => {
    if (loading) return <LoadingBlock label="Loading transport routes…" />;
    if (error) return <ErrorBlock message={error} onRetry={load} />;
    if (routes.length === 0)
      return (
        <EmptyBlock title="No transport routes have been created yet" />
      );
    return null;
  };

  const empty = renderBody();

  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="Operations · Transport"
        title="Fleet Tracking"
        description="Route status, driver contacts and the last GPS position reported by each bus."
        right={
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </Button>
        }
      />

      {empty ? (
        <Card>{empty}</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Bus}
              label="Routes"
              value={`${stats.live} / ${stats.total}`}
              sub="with a live GPS fix"
              accent="success"
            />
            <StatCard
              icon={Users}
              label="Students Assigned"
              value={String(stats.assigned)}
              sub="across all routes"
              accent="primary"
            />
            <StatCard
              icon={Navigation}
              label="Reporting GPS"
              value={String(stats.live)}
              sub="buses with a position"
              accent="info"
            />
            <StatCard
              icon={MapPin}
              label="Last Ping"
              value={stats.lastPing}
              sub="most recent vehicle update"
              accent="alert"
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-5 items-start">
            <Card className="lg:col-span-2" bodyClassName="p-0">
              <FleetMap
                routes={routes}
                selected={selected}
                onSelect={setSelected}
                schoolLocation={school?.location || null}
                schoolName={school?.name}
              />
            </Card>

            <div className="space-y-4">
              <Card title={`${selected?.id || "Route"} · Details`} bodyClassName="p-4">
                {selected && (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <Pill tone={STATUS_TONE[selected.status] || "neutral"}>
                        {selected.status}
                      </Pill>
                      <span className="text-[11.5px] text-slate-text/60">
                        {selected.location
                          ? `Updated ${timeAgo(selected.location.updatedAt) || "—"}`
                          : "No position reported"}
                      </span>
                    </div>

                    <p className="text-[13px] font-semibold text-ink leading-snug">
                      {selected.routeText}
                    </p>

                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <Metric
                        label="Assigned"
                        value={String(selected.assigned)}
                        icon={Users}
                      />
                      <Metric label="Stops" value={String(selected.stopCount)} icon={MapPin} />
                      <Metric label="Vehicle" value={selected.vehicleNo} icon={Bus} />
                    </div>

                    <div className="mt-3 rounded-lg bg-paper px-3 py-2 text-[11.5px] text-slate-text/70 space-y-1">
                      <div className="flex items-center gap-2">
                        <MapPin size={13} className="text-slate-text/40 shrink-0" />
                        <span className="font-mono">
                          {selected.location
                            ? `${selected.location.lat.toFixed(5)}, ${selected.location.lng.toFixed(5)}`
                            : "No GPS fix"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Navigation size={13} className="text-slate-text/40 shrink-0" />
                        <span>
                          {selected.location
                            ? `Last reported ${formatPing(selected.location.updatedAt)}`
                            : "Waiting for the vehicle to report a position"}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </Card>

              <Card title="Contacts" bodyClassName="p-4 space-y-3">
                <ContactRow
                  icon={User}
                  label="Driver"
                  name={selected?.driver}
                  phone={selected?.driverPhone}
                  highlighted
                />
                <ContactRow
                  icon={Headset}
                  label="School Office"
                  name={school?.name}
                  phone={school?.phone}
                />
              </Card>
            </div>
          </div>

          <Card
            title="All Routes"
            action={
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
                  />
                  <Input
                    placeholder="Search route, driver..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-8 w-48"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="min-w-[140px]"
                >
                  {STATUS_FILTERS.map((s) => (
                    <option key={s} value={s}>
                      {s === "All" ? "All Status" : s}
                    </option>
                  ))}
                </Select>
              </div>
            }
          >
            {filtered.length === 0 ? (
              <EmptyBlock title="No routes match these filters" />
            ) : (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-slate-200">
                      <th className="px-5 py-2.5 font-semibold">Route No</th>
                      <th className="px-5 py-2.5 font-semibold">Stops</th>
                      <th className="px-5 py-2.5 font-semibold">Vehicle</th>
                      <th className="px-5 py-2.5 font-semibold">Driver</th>
                      <th className="px-5 py-2.5 font-semibold">Contact</th>
                      <th className="px-5 py-2.5 font-semibold">Assigned</th>
                      <th className="px-5 py-2.5 font-semibold">Last Ping</th>
                      <th className="px-5 py-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b) => (
                      <tr
                        key={b.id}
                        onClick={() => setSelected(b)}
                        className="border-b border-slate-100 hover:bg-paper/60 cursor-pointer"
                      >
                        <td className="px-5 py-3 font-semibold text-ink">{b.id}</td>
                        <td className="px-5 py-3 text-slate-text max-w-[240px] truncate">
                          {b.routeText}
                        </td>
                        <td className="px-5 py-3 text-slate-text">{b.vehicleNo}</td>
                        <td className="px-5 py-3 text-slate-text">{b.driver}</td>
                        <td className="px-5 py-3">
                          {b.driverPhone ? (
                            <a
                              href={`tel:${b.driverPhone.replace(/\s/g, "")}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-success text-[12px] font-semibold hover:underline"
                              title={`Call ${b.driver}`}
                            >
                              <Phone size={13} /> Call
                            </a>
                          ) : (
                            <span className="text-[12px] text-slate-text/50">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-text">{b.assigned}</td>
                        <td className="px-5 py-3 text-slate-text">
                          {b.location ? formatPing(b.location.updatedAt) : "—"}
                        </td>
                        <td className="px-5 py-3">
                          <Pill tone={STATUS_TONE[b.status] || "neutral"}>{b.status}</Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
