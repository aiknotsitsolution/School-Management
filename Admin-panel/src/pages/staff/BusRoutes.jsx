import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  MapPin,
  Bus,
  Phone,
  Search,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Route as RouteIcon,
  Clock,
  Gauge,
  Link2,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Input,
  Button,
  StatCard,
  toast,
} from "../../components/UI";
import FleetMap from "../../components/FleetMap";
import { api } from "../../lib/api";

// Route planning workspace.
//
// Stops used to be typed as free text ("Andheri | 19.11, 72.84, Bandra, ...").
// That put the burden of ordering, coordinate entry and validation on whoever
// typed it, and silently produced coordinate-less stops with no ETA. The planner
// replaces it with: search a place, or click the map, then reorder. Every stop
// therefore carries real coordinates, which is what unlocks the OSRM distance
// and ETA readout on the tracking map.

const EMPTY_FORM = { routeNo: "", vehicleNo: "", driverName: "", driverContact: "" };

// Search-as-you-type would spam the geocoder on every keystroke. The backend
// also throttles and caches, but debouncing here keeps it to one request per
// pause in typing.
const SEARCH_DEBOUNCE_MS = 400;
const MIN_SEARCH_CHARS = 3;

const routable = (stop) =>
  Number.isFinite(Number(stop.lat)) && Number.isFinite(Number(stop.lng));

const formatClock = (seconds) => {
  if (!Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
};

export default function BusRoutes() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [stops, setStops] = useState([]);
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [attribution, setAttribution] = useState(null);

  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);

  const [providers, setProviders] = useState(null);
  const [bindId, setBindId] = useState("");
  const [bindBusy, setBindBusy] = useState(false);
  const [devices, setDevices] = useState(null);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState("");

  const searchSeq = useRef(0);

  const refresh = () => {
    setLoading(true);
    api.transport
      .list()
      .then(({ data }) => setRoutes(data || []))
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  useEffect(() => {
    api.transport
      .trackingStatus()
      .then(({ data }) => setProviders(data || null))
      .catch(() => setProviders(null));
  }, []);

  // The picker's options come from the provider account via our backend. Only
  // fetched when the provider is actually usable, so an unconfigured server
  // costs no request.
  const gpsUsable = Boolean(
    providers?.providers?.traccar?.enabled && providers?.providers?.traccar?.configured,
  );
  useEffect(() => {
    if (!gpsUsable) {
      setDevices({ list: [], boundIds: [] });
      return;
    }
    setDevicesLoading(true);
    setDevicesError("");
    api.transport
      .devices()
      .then(({ data }) => setDevices({ list: data?.devices || [], boundIds: [] }))
      .catch((e) => setDevicesError(e.message || "Could not load GPS devices"))
      .finally(() => setDevicesLoading(false));
  }, [gpsUsable]);

  // Devices already bound to another route are hidden from every picker, so
  // the operator is not offered a choice the backend will reject with a 409.
  const boundIds = useMemo(
    () => routes.filter((r) => r.tracking?.deviceId).map((r) => r.tracking.deviceId),
    [routes],
  );
  const deviceOptions = useMemo(
    () => (devices ? { ...devices, boundIds } : devices),
    [devices, boundIds],
  );

  // --- place search ---------------------------------------------------------

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_SEARCH_CHARS) {
      setResults([]);
      return undefined;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = setTimeout(() => {
      api.transport
        .searchPlaces(q)
        .then(({ data }) => {
          // Ignore a response that arrived after a newer query was issued.
          if (seq !== searchSeq.current) return;
          setResults(data?.results || []);
          setAttribution(data?.attribution || null);
        })
        .catch(() => {
          if (seq === searchSeq.current) setResults([]);
        })
        .finally(() => {
          if (seq === searchSeq.current) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const addStop = (stop) => {
    setStops((prev) => [
      ...prev,
      { name: stop.name || stop.label, lat: stop.lat, lng: stop.lng, time: "" },
    ]);
    setQuery("");
    setResults([]);
  };

  // Clicking the map drops a stop at that point. The label comes from the
  // backend's reverse geocoder; if it cannot resolve, the stop stays
  // coordinate-only with a generated name rather than being rejected.
  const [pinPending, setPinPending] = useState(false);
  const onMapClick = async ({ lat, lng }) => {
    if (pinPending) return;
    setPinPending(true);
    let name = `Pinned stop ${stops.length + 1}`;
    try {
      const { data } = await api.transport.reversePlace(lat, lng);
      if (data?.label) name = data.label.split(",")[0] || name;
    } catch {
      // Reverse geocoding is best effort; keep the pinned stop.
    } finally {
      setPinPending(false);
    }
    setStops((prev) => [...prev, { name, lat, lng, time: "" }]);
  };

  const removeStop = (index) => setStops((prev) => prev.filter((_, i) => i !== index));

  // Reordering is explicit rather than drag-only: up/down buttons are
  // keyboard accessible and work on touch, which a drag handle alone does not.
  const moveStop = (index, delta) => {
    setStops((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const setStopTime = (index, value) =>
    setStops((prev) => prev.map((s, i) => (i === index ? { ...s, time: value } : s)));

  // --- OSRM preview --------------------------------------------------------

  // Preview the draft stop list as it changes. The backend is the only thing
  // that talks to OSRM, so this is a plain request against our own API.
  useEffect(() => {
    if (stops.filter(routable).length < 2) {
      setPlan(null);
      return undefined;
    }
    let cancelled = false;
    setPlanLoading(true);
    const timer = setTimeout(() => {
      api.transport
        .previewPlan(editing?._id || null, stops)
        .then(({ data }) => {
          if (!cancelled) setPlan(data);
        })
        .catch(() => {
          if (!cancelled) setPlan(null);
        })
        .finally(() => {
          if (!cancelled) setPlanLoading(false);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [stops, editing]);

  // --- form lifecycle ------------------------------------------------------

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setStops([]);
    setPlan(null);
    setShowForm(true);
  };

  const openEdit = (route) => {
    setEditing(route);
    setForm({
      routeNo: route.routeNo || "",
      vehicleNo: route.vehicleNo || "",
      driverName: route.driverName || "",
      driverContact: route.driverContact || "",
    });
    setStops(
      (route.stops || []).map((s) => ({
        name: s.name || "",
        lat: s.lat ?? null,
        lng: s.lng ?? null,
        time: s.time || "",
      })),
    );
    setPlan(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setStops([]);
    setQuery("");
    setResults([]);
    setPlan(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (stops.length < 2) {
      toast("Add at least two stops", "error");
      return;
    }
    const withoutCoords = stops.filter((s) => !routable(s));
    if (withoutCoords.length > 0) {
      toast(
        `${withoutCoords.length} stop(s) have no coordinates — place them on the map or via search`,
        "error",
      );
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, stops };
      if (editing) await api.transport.update(editing._id, payload);
      else await api.transport.create(payload);
      toast(editing ? "Route updated" : "Route created", "success");
      closeForm();
      refresh();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // --- device binding ------------------------------------------------------

  const bindDevice = async (route, deviceId) => {
    setBindId(route._id);
    setBindBusy(true);
    try {
      const res = await api.transport.bindDevice(route._id, { deviceId });
      toast(`GPS device bound: ${res.data?.tracking?.deviceName || deviceId}`, "success");
      refresh();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBindBusy(false);
      setBindId("");
    }
  };

  const unbindDevice = async (route) => {
    setBindId(route._id);
    setBindBusy(true);
    try {
      await api.transport.unbindDevice(route._id);
      toast("GPS device removed", "success");
      refresh();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBindBusy(false);
      setBindId("");
    }
  };

  const handleLocation = async (route) => {
    const lat = window.prompt(`Live latitude for Route ${route.routeNo}`, route.currentLocation?.lat || "");
    const lng = window.prompt(`Live longitude for Route ${route.routeNo}`, route.currentLocation?.lng || "");
    if (lat === null || lng === null) return;
    const numLat = Number(lat);
    const numLng = Number(lng);
    if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) {
      toast("Enter a valid latitude/longitude", "error");
      return;
    }
    try {
      await api.transport.updateLocation(route._id, { lat: numLat, lng: numLng });
      toast("Location updated", "success");
      refresh();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const stats = useMemo(
    () => ({
      total: routes.length,
      stops: routes.reduce((s, r) => s + (r.stops?.length || 0), 0),
      drivers: routes.filter((r) => r.driverName).length,
      students: routes.reduce((s, r) => s + (r.assignedStudents?.length || 0), 0),
      tracked: routes.filter((r) => r.tracking?.deviceId).length,
    }),
    [routes],
  );

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Transport Workspace"
        title="Bus Routes"
        description="Plan stops on the map, reorder them, and see the real driving distance and time."
        right={
          showForm ? (
            <Button variant="outline" onClick={closeForm}>
              Cancel
            </Button>
          ) : (
            <Button variant="primary" onClick={openCreate}>
              <Plus size={15} /> Plan Route
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Bus} label="Routes" value={String(stats.total)} accent="info" />
        <StatCard icon={MapPin} label="Stops" value={String(stats.stops)} accent="primary" />
        <StatCard icon={Phone} label="Drivers" value={String(stats.drivers)} accent="success" />
        <StatCard icon={RouteIcon} label="Students" value={String(stats.students)} accent="alert" />
        <StatCard icon={Gauge} label="GPS Tracked" value={String(stats.tracked)} accent="info" />
      </div>

      {showForm && (
        <>
          <Card title={editing ? `Edit Route ${editing.routeNo}` : "Plan a new route"}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Input
                  name="routeNo"
                  placeholder="Route No. (e.g. R-01)"
                  value={form.routeNo}
                  onChange={(e) => setForm({ ...form, routeNo: e.target.value })}
                  required
                />
                <Input
                  name="vehicleNo"
                  placeholder="Vehicle No."
                  value={form.vehicleNo}
                  onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })}
                />
                <Input
                  name="driverName"
                  placeholder="Driver Name"
                  value={form.driverName}
                  onChange={(e) => setForm({ ...form, driverName: e.target.value })}
                />
                <Input
                  name="driverContact"
                  placeholder="Driver Contact"
                  value={form.driverContact}
                  onChange={(e) => setForm({ ...form, driverContact: e.target.value })}
                />
              </div>
            </form>
          </Card>

          <div className="grid lg:grid-cols-5 gap-5 items-start">
            <Card className="lg:col-span-2" title="Stops in order" bodyClassName="p-4 space-y-3">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search a place (min ${MIN_SEARCH_CHARS} characters)…`}
                  className="pl-8 w-full"
                />
              </div>

              {searching && (
                <p className="text-[11.5px] text-slate-text/60">Searching…</p>
              )}

              {results.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  {results.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => addStop(r)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-paper flex items-start gap-2"
                    >
                      <Plus size={13} className="text-primary mt-0.5 shrink-0" />
                      <span className="text-[12.5px] text-ink leading-snug">{r.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {attribution && (
                <p className="text-[10.5px] text-slate-text/50">{attribution}</p>
              )}

              <p className="text-[11.5px] text-slate-text/70">
                Search for a stop, or click the map to drop a pin.
              </p>

              {stops.length === 0 ? (
                <p className="text-[12.5px] text-slate-text/60 py-4 text-center">
                  No stops yet.
                </p>
              ) : (
                <ol className="space-y-2">
                  {stops.map((stop, i) => (
                    <li
                      key={`${i}-${stop.name}`}
                      className="rounded-xl border border-slate-200 px-3 py-2.5 space-y-2"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-ink leading-snug">
                            {stop.name || "Unnamed stop"}
                          </p>
                          <p className="text-[11px] text-slate-text/60 font-mono">
                            {routable(stop)
                              ? `${Number(stop.lat).toFixed(5)}, ${Number(stop.lng).toFixed(5)}`
                              : "No coordinates"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveStop(i, -1)}
                            disabled={i === 0}
                            className="p-1 text-slate-text/60 hover:text-ink disabled:opacity-30"
                            title="Move up"
                            aria-label={`Move ${stop.name} up`}
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveStop(i, 1)}
                            disabled={i === stops.length - 1}
                            className="p-1 text-slate-text/60 hover:text-ink disabled:opacity-30"
                            title="Move down"
                            aria-label={`Move ${stop.name} down`}
                          >
                            <ArrowDown size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeStop(i)}
                            className="p-1 text-slate-text/50 hover:text-alert"
                            title="Remove stop"
                            aria-label={`Remove ${stop.name}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <Input
                        value={stop.time || ""}
                        onChange={(e) => setStopTime(i, e.target.value)}
                        placeholder="Scheduled time (optional, e.g. 07:30)"
                        className="text-[12px]"
                      />
                    </li>
                  ))}
                </ol>
              )}

              <Button onClick={handleSubmit} disabled={saving} className="w-full">
                <Save size={14} /> {saving ? "Saving…" : editing ? "Save route" : "Create route"}
              </Button>
            </Card>

            <Card className="lg:col-span-3" bodyClassName="p-0" title={null}>
              <div className="relative">
                <FleetMap
                  className="min-h-[460px]"
                  routes={[]}
                  stops={stops}
                  onMapClick={onMapClick}
                  overlay={
                    <>
                      {plan && (
                        <div className="absolute top-3 right-3 z-[400] bg-white/95 backdrop-blur rounded-xl shadow px-3 py-2 text-[11px] space-y-0.5">
                          <p className="font-semibold text-ink">
                            {plan.totalKm != null ? `${plan.totalKm} km` : "Distance unavailable"}
                          </p>
                          <p className="text-slate-text/70">
                            {plan.totalMinutes != null
                              ? formatClock(plan.totalMinutes)
                              : "Routing unavailable"}
                          </p>
                          {planLoading && (
                            <p className="text-slate-text/50">Calculating…</p>
                          )}
                        </div>
                      )}
                      {pinPending && (
                        <div className="absolute bottom-3 right-3 z-[400] bg-white/95 backdrop-blur rounded-xl shadow px-3 py-2 text-[11px] text-slate-text/70">
                          Labelling pin…
                        </div>
                      )}
                      {!stops.length && (
                        <div className="absolute inset-0 z-[300] flex items-start justify-center pt-6 pointer-events-none">
                          <p className="bg-white/90 backdrop-blur rounded-xl shadow px-3 py-2 text-[11.5px] text-slate-text/70">
                            Click anywhere on the map to add the first stop
                          </p>
                        </div>
                      )}
                    </>
                  }
                />
              </div>
            </Card>
          </div>

          {plan?.legs?.length > 0 && (
            <Card title="Driving plan">
              <div className="space-y-1.5">
                {plan.legs.map((leg, i) => (
                  <div
                    key={`${leg.fromStop}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2"
                  >
                    <span className="text-[12.5px] text-ink truncate">
                      {leg.fromStop} <span className="text-slate-text/50">→</span> {leg.toStop}
                    </span>
                    <span className="text-[11.5px] text-slate-text/70 shrink-0 flex items-center gap-1">
                      {leg.km != null ? `${leg.km} km` : "—"}
                      <span className="text-slate-text/40">·</span>
                      <Clock size={11} />
                      {leg.minutes != null ? `${leg.minutes} min` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <Card title="All Routes">
        {loading ? (
          <p className="text-[13px] text-slate-text py-10 text-center">Loading routes…</p>
        ) : routes.length === 0 ? (
          <p className="text-[13px] text-slate-text py-10 text-center">No routes configured yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                  <th className="px-5 py-2 font-semibold">Route</th>
                  <th className="px-3 py-2 font-semibold">Vehicle</th>
                  <th className="px-3 py-2 font-semibold">Driver</th>
                  <th className="px-3 py-2 font-semibold">Stops</th>
                  <th className="px-3 py-2 font-semibold">Distance</th>
                  <th className="px-3 py-2 font-semibold">Students</th>
                  <th className="px-3 py-2 font-semibold">Live</th>
                  <th className="px-3 py-2 font-semibold">GPS</th>
                  <th className="px-3 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => (
                  <tr key={r._id} className="border-t border-slate-200 hover:bg-paper/60">
                    <td className="px-5 py-2.5 font-semibold text-ink">Route {r.routeNo}</td>
                    <td className="px-3 py-2.5">{r.vehicleNo || "—"}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-ink">{r.driverName || "—"}</p>
                      <p className="text-[12px] text-slate-text/60">{r.driverContact || ""}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="max-w-[180px] truncate text-slate-text/80">
                        {(r.stops || []).map((s) => s.name).join(" → ") || "—"}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-slate-text/80">
                      {r.routePlan?.totalKm != null ? `${r.routePlan.totalKm} km` : "—"}
                    </td>
                    <td className="px-3 py-2.5">{r.assignedStudents?.length || 0}</td>
                    <td className="px-3 py-2.5">
                      {r.currentLocation?.updatedAt ? (
                        <span className="inline-flex items-center gap-1.5 text-success text-[12px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-success" /> Live
                        </span>
                      ) : (
                        <span className="text-slate-text/50 text-[12px]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.tracking?.deviceId ? (
                        <span
                          className="inline-flex items-center gap-1 text-[11.5px] text-slate-text/70 font-mono"
                          title={`${r.tracking.provider} device`}
                        >
                          <Link2 size={11} /> {r.tracking.deviceName || r.tracking.deviceId}
                        </span>
                      ) : (
                        <span className="text-slate-text/50 text-[12px]">Not bound</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {gpsUsable && (
                        <div className="inline-flex items-center gap-1 mr-3">
                          {r.tracking?.deviceId ? (
                            <>
<button
                            onClick={() => unbindDevice(r)}
                            disabled={bindBusy && bindId === r._id}
                            className="text-slate-text/60 hover:text-alert text-[12px] font-semibold disabled:opacity-40"
                          >
                            Unbind
                          </button>
                            </>
                          ) : (
                            <BindControl
                            onBind={(id) => bindDevice(r, id)}
                            busy={bindBusy && bindId === r._id}
                            devices={deviceOptions}
                            loading={devicesLoading}
                            error={devicesError}
                          />
                          )}
                        </div>
                      )}
                      <button onClick={() => handleLocation(r)} className="text-info hover:underline text-[12px] font-semibold mr-3">
                        Update Location
                      </button>
                      <button
                        onClick={() => openEdit(r)}
                        className="text-info hover:underline text-[12px] font-semibold"
                      >
                        Plan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!gpsUsable && (
        <Card>
          <p className="text-[12.5px] text-slate-text/80">
            <b className="text-ink">GPS tracking is not configured.</b> Bus positions currently come
            only from manual updates. Set <span className="font-mono">TRACCAR_ENABLED=true</span>{" "}
            plus <span className="font-mono">TRACCAR_BASE_URL</span> and the provider credentials in
            the backend environment to bind devices. The provider is only ever reached from the
            server, so no provider credentials are sent to the browser.
          </p>
        </Card>
      )}
    </div>
  );
}

/** Inline control for binding a GPS device.
 *
 * The operator picks from the devices the provider account actually has — the
 * list comes from our backend, never a free-typed id. That keeps a typo from
 * becoming a permanently blank marker, and the provider credential never
 * reaches the browser. */
function BindControl({ onBind, busy, devices, loading, error }) {
  const [value, setValue] = useState("");

  const options = useMemo(() => {
    const taken = devices?.boundIds || [];
    return (devices?.list || []).filter((d) => !taken.includes(d.id));
  }, [devices]);

  if (loading) {
    return <span className="text-[12px] text-slate-text/50">Loading devices…</span>;
  }
  if (error) {
    return <span className="text-[12px] text-alert">{error}</span>;
  }
  if (options.length === 0) {
    return (
      <span className="text-[12px] text-slate-text/50">
        No unbound devices on the GPS account
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-36 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[12px] focus:outline-none focus:border-primary"
        aria-label="GPS device"
      >
        <option value="">Select device…</option>
        {options.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name ? `${d.name} (${d.id})` : d.id}
          </option>
        ))}
      </select>
      <button
        onClick={() => value.trim() && onBind(value.trim())}
        disabled={busy || !value.trim()}
        className="inline-flex items-center gap-1 text-info text-[12px] font-semibold disabled:opacity-40"
      >
        <Link2 size={11} /> {busy ? "Binding…" : "Bind"}
      </button>
    </span>
  );
}