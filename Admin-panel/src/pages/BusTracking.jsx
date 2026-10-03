import { useCallback, useEffect, useMemo, useState } from "react";
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
  Gauge,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Input,
  Select,
  Pill,
  StatCard,
  toast,
} from "../components/UI";
import { LoadingBlock, EmptyBlock, ErrorBlock } from "../components/StateViews";
import FleetMap, { hasFix } from "../components/FleetMap";
import { useSelector } from "react-redux";
import { selectSchool } from "../store/selectors";
import { api } from "../lib/api";

const STATUS_LIVE = "Live GPS";
const STATUS_NO_GPS = "No GPS signal";
const STATUS_FILTERS = ["All", STATUS_LIVE, STATUS_NO_GPS];
const STATUS_TONE = { [STATUS_LIVE]: "success", [STATUS_NO_GPS]: "neutral" };

// How often the fleet view re-polls for bus positions. Every poll is served from
// the cached OSRM route plan, so this stays cheap.
const LIVE_REFRESH_MS = 30000;

// Neutral fallback centre (geographic centre of India) and the Leaflet map itself
// now live in components/FleetMap.jsx, shared with the route planner and the
// student/parent bus view.

// Same wording as the student/parent bus view in pages/student/Transport.jsx, so
// a ping reads identically wherever it is shown. PlatformDashboard.jsx keeps its
// own "just now" variant for audit timelines.
const timeAgo = (value) => {
  if (!value) return "—";
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const formatPing = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
};

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

// Live routing readout: OSRM driving distance + ETA to the next stop, or the
// full route plan when the bus is at the last stop.
function LiveProgress({ live, plan }) {
  if (!live) return null;
  const { nextStop, distanceKm, etaMinutes, routingSource, stale } = live;

  if (distanceKm === null && etaMinutes === null) {
    return (
      <div className="mt-3 rounded-lg bg-amber-50/70 border border-amber-200 px-3 py-2 text-[11.5px] text-amber-800">
        {nextStop
          ? `Heading to ${nextStop} — add coordinates to this stop for distance & ETA.`
          : "Add stops with coordinates to get live distance and ETA."}
      </div>
    );
  }

  return (
    <div
      className={`mt-3 rounded-lg px-3 py-2.5 border ${
        stale
          ? "bg-slate-50 border-slate-200"
          : "bg-emerald-50/70 border-emerald-200"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/60">
          {stale ? "Last known position" : "Live position"}
        </p>
        {plan?.totalKm ? (
          <p className="text-[10.5px] text-slate-text/50">
            Full route {plan.totalKm} km
            {plan.totalMinutes ? ` · ${plan.totalMinutes} min` : ""}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2">
        <div>
          <p className="text-[10.5px] text-slate-text/60">Next stop</p>
          <p className="text-[12.5px] font-semibold text-ink truncate">
            {nextStop || "—"}
          </p>
        </div>
        <div>
          <p className="text-[10.5px] text-slate-text/60">Distance</p>
          <p className="text-[12.5px] font-semibold text-ink">
            {distanceKm !== null ? `${distanceKm} km` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10.5px] text-slate-text/60">ETA</p>
          <p className="text-[12.5px] font-semibold text-ink">
            {etaMinutes !== null ? `${etaMinutes} min` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10.5px] text-slate-text/60">Stops left</p>
          <p className="text-[12.5px] font-semibold text-ink">
            {live.stopsRemaining ?? "—"}
          </p>
        </div>
      </div>

      {routingSource !== "osrm" ? (
        <p className="text-[10.5px] text-slate-text/50 mt-1.5">
          Straight-line estimate — routing service unavailable.
        </p>
      ) : null}
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
  const [providers, setProviders] = useState(null);

  // Which telematics providers the backend has configured. Fetched once and
  // only to decide whether the GPS controls are meaningful — it carries no
  // credentials, and the UI degrades to manual-only tracking when nothing is
  // configured rather than pretending live data exists.
  useEffect(() => {
    let cancelled = false;
    api.transport
      .trackingStatus()
      .then(({ data }) => {
        if (!cancelled) setProviders(data?.providers || null);
      })
      .catch(() => {
        if (!cancelled) setProviders(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
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
          live: route.live || null,
          routePlan: route.routePlan || null,
          // Provenance of the current fix: "traccar" (provider poll) or
          // "manual" (an operator used Update location). Shown so the operator
          // can tell a real device fix from a hand-entered one.
          fixSource: route.currentLocation?.source || null,
          speedKmh: route.live?.speedKmh ?? null,
        };
      });
      setRoutes(loaded);
      setSelected((prev) =>
        prev ? loaded.find((r) => r.id === prev.id) || loaded[0] || null : loaded[0] || null,
      );
    } catch (err) {
      // A failed poll must not wipe the last known positions — keep showing
      // stale data and only surface the error on an explicit (non-silent) load.
      if (!silent) {
        setError(err.message || "Could not load transport routes");
        setRoutes([]);
        setSelected(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live tracking: silent poll so markers, distance and ETA keep moving.
  // Paused while the tab is hidden and whenever the document is offline.
  useEffect(() => {
    let timer = null;
    const tick = () => {
      const visible = document.visibilityState === "visible";
      const online = typeof navigator.onLine === "undefined" || navigator.onLine;
      if (visible && online) load(true);
    };
    timer = setInterval(tick, LIVE_REFRESH_MS);
    return () => clearInterval(timer);
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

  // GPS provider wiring, surfaced honestly. When no provider is configured the
// fleet page must not imply live tracking: positions then come only from manual
// updates, and the map says so.
  const gpsState = (() => {
    const traccar = providers?.traccar;
    if (!traccar) return null;
    if (traccar.enabled && traccar.configured) {
      return { ok: true, label: "GPS provider connected", tone: "success" };
    }
    if (traccar.enabled && !traccar.configured) {
      return {
        ok: false,
        label: "GPS provider enabled but not configured — positions are manual only",
        tone: "alert",
      };
    }
    return { ok: false, label: "No GPS provider configured — manual positions only", tone: "neutral" };
  })();

  // On-demand sync for a route that has a device bound, so an operator does not
  // have to wait out the poll interval.
  const [syncing, setSyncing] = useState(false);
  const syncSelected = async () => {
    if (!selected?._id || syncing) return;
    setSyncing(true);
    try {
      await api.transport.sync(selected._id);
      await load(true);
    } catch (err) {
      toast(err.message || "Could not sync with the GPS provider", "error");
    } finally {
      setSyncing(false);
    }
  };

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
          <div className="flex items-center gap-2">
            {gpsState && (
              <Pill tone={gpsState.tone === "success" ? "success" : "neutral"}>
                {gpsState.label}
              </Pill>
            )}
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw size={14} /> Refresh
            </Button>
          </div>
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
                className="min-h-[520px]"
                routes={routes}
                selected={selected}
                onSelect={setSelected}
                schoolLocation={school?.location || null}
                schoolName={school?.name}
                stops={selected?.stops || []}
                activeStopIndex={selected?.live?.nextStopIndex ?? -1}
                overlay={
                  <>
                    <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur rounded-xl shadow px-3 py-2 text-[11px] font-semibold text-ink">
                      {stats.live > 0
                        ? `${stats.live} bus${stats.live === 1 ? "" : "es"} reporting GPS`
                        : "No GPS positions reported yet"}
                    </div>
                    <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur rounded-xl shadow px-3 py-2 text-[11px] space-y-1">
                      <div className="flex items-center gap-2 text-slate-text">
                        <span className="w-3 h-3 rounded-full inline-block" style={{ background: "#16A34A" }} />
                        Bus position
                      </div>
                      <div className="flex items-center gap-2 text-slate-text">
                        <span className="w-3 h-3 rounded-full inline-block bg-ink" />
                        Stop
                      </div>
                      <div className="text-slate-text/70">
                        Positions are shown as last reported by the vehicle.
                      </div>
                    </div>
                  </>
                }
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
                      <div className="flex items-center gap-2">
                        <Gauge size={13} className="text-slate-text/40 shrink-0" />
                        <span>
                          {selected.fixSource === "traccar"
                            ? `GPS device${selected.tracking?.deviceName ? ` · ${selected.tracking.deviceName}` : ""}`
                            : selected.fixSource === "manual"
                              ? "Entered manually by an operator"
                              : "Source unknown"}
                          {Number.isFinite(selected.speedKmh) && selected.speedKmh > 0
                            ? ` · ${selected.speedKmh} km/h`
                            : ""}
                        </span>
                      </div>
                    </div>

                    {selected.tracking?.deviceId ? (
                      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-paper px-3 py-2">
                        <span className="text-[11.5px] text-slate-text/70">
                          Device <span className="font-mono">{selected.tracking.deviceId}</span> bound
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={syncSelected}
                          disabled={syncing}
                        >
                          <RefreshCw size={12} /> {syncing ? "Syncing…" : "Sync now"}
                        </Button>
                      </div>
                    ) : null}

                    <LiveProgress live={selected.live} plan={selected.routePlan} />
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
                      <th className="px-5 py-2.5 font-semibold">Next Stop</th>
                      <th className="px-5 py-2.5 font-semibold">Distance</th>
                      <th className="px-5 py-2.5 font-semibold">ETA</th>
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
                        <td className="px-5 py-3 text-slate-text max-w-[180px] truncate">
                          {b.live?.nextStop || "—"}
                        </td>
                        <td className="px-5 py-3 text-slate-text font-medium">
                          {b.live?.distanceKm !== null && b.live?.distanceKm !== undefined
                            ? `${b.live.distanceKm} km`
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-slate-text font-medium">
                          {b.live?.etaMinutes ? `${b.live.etaMinutes} min` : "—"}
                        </td>
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
