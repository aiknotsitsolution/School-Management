import { useCallback, useEffect, useMemo, useState } from "react";
import { Bus, MapPin, Clock, User, Navigation, RefreshCw, AlertTriangle } from "lucide-react";
import { PageIntro, Card, Button, Pill, StatCard } from "../../components/UI";
import FleetMap, { hasFix } from "../../components/FleetMap";
import { api } from "../../lib/api";

// "My School Bus" for a student or a parent.
//
// It previously called api.transport.list() and rendered r.name, r.pickupTime,
// r.dropTime and r.route — none of which exist on a BusRoute (the real fields
// are routeNo, stops[] and currentLocation), so the page showed empty values for
// every route, and it listed the WHOLE fleet instead of the viewer's own bus.
//
// The fix is api.transport.mine(), which scopes the query server-side from the
// token: a student gets their own admission number, a parent gets their linked
// children. Neither can widen it by passing an id.

const LIVE_REFRESH_MS = 30000;

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
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function Transport() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.transport.mine();
      setRoutes(res?.data || []);
      setError("");
    } catch (err) {
      // Keep the last known data on a failed background refresh rather than
      // blanking a screen a parent may be relying on.
      if (!silent) setError(err.message || "Could not load your bus details");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      const visible = document.visibilityState === "visible";
      const online = typeof navigator.onLine === "undefined" || navigator.onLine;
      if (visible && online) load(true);
    }, LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const primary = useMemo(() => routes[0] || null, [routes]);
  const others = useMemo(() => routes.slice(1), [routes]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-24 bg-white rounded-2xl border border-slate-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="School Bus" title="My School Bus" />
        <Card>
          <div className="py-8 text-center">
            <p className="text-[13px] text-slate-text/80">{error}</p>
            <Button variant="outline" className="mt-3" onClick={() => load()}>
              <RefreshCw size={14} /> Try again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!primary) {
    return (
      <div className="space-y-6">
        <PageIntro
          eyebrow="School Bus"
          title="My School Bus"
          description="The bus route assigned to you."
        />
        <Card>
          <div className="py-10 text-center">
            <Bus size={40} className="mx-auto mb-4 text-slate-text/30" />
            <p className="text-[15px] font-semibold text-ink">No transport route assigned</p>
            <p className="text-[13px] text-slate-text/70 mt-1">
              If you use school transport, contact the transport department.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const live = primary.live || {};
  const located = hasFix(primary);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="School Bus"
        title="My School Bus"
        description="Your assigned route, live position and pickup details."
        right={
          <Button variant="outline" onClick={() => load()}>
            <RefreshCw size={14} /> Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Bus}
          label="Route"
          value={primary.routeNo || "—"}
          sub={primary.vehicleNo ? `Vehicle ${primary.vehicleNo}` : "No vehicle recorded"}
          accent="info"
        />
        <StatCard
          icon={Navigation}
          label="Bus Status"
          value={located ? (live.stale ? "Last known" : "On the way") : "No signal"}
          sub={located ? `Updated ${timeAgo(primary.currentLocation.updatedAt)}` : "Awaiting a GPS fix"}
          accent={located && !live.stale ? "success" : "alert"}
        />
        <StatCard
          icon={Clock}
          label="ETA to next stop"
          value={live.etaMinutes != null ? `${live.etaMinutes} min` : "—"}
          sub={live.nextStop || "No stops with coordinates"}
          accent="primary"
        />
        <StatCard
          icon={MapPin}
          label="Stops Left"
          value={live.stopsRemaining != null ? String(live.stopsRemaining) : "—"}
          sub={`${primary.stops?.length || 0} stops on this route`}
          accent="success"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 items-start">
        <Card className="lg:col-span-2" bodyClassName="p-0">
          <FleetMap
            className="min-h-[420px]"
            routes={located ? [primary] : []}
            stops={primary.stops || []}
            activeStopIndex={live.nextStopIndex ?? -1}
            overlay={
              <>
                <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur rounded-xl shadow px-3 py-2 text-[11px] font-semibold text-ink">
                  {!located
                    ? "Your bus has not reported a position yet"
                    : live.stale
                      ? "Last known position"
                      : "Live bus position"}
                </div>
                {live.routingSource && live.routingSource !== "osrm" && located ? (
                  <div className="absolute bottom-3 left-3 z-[400] bg-amber-50/95 backdrop-blur rounded-xl shadow px-3 py-2 text-[11px] text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle size={12} />
                    Distance is a straight-line estimate
                  </div>
                ) : null}
              </>
            }
          />
        </Card>

        <div className="space-y-4">
          <Card title="Bus & Driver" bodyClassName="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/15 text-primary-dark shrink-0">
                <User size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-text/60">Driver</p>
                <p className="text-[13px] font-semibold text-ink truncate">
                  {primary.driverName || "Not assigned"}
                </p>
              </div>
              {primary.driverContact ? (
                <a
                  href={`tel:${primary.driverContact.replace(/\s/g, "")}`}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg bg-success/10 text-success text-[11.5px] font-semibold hover:bg-success/20"
                >
                  Call
                </a>
              ) : null}
            </div>
            <div className="rounded-lg bg-paper px-3 py-2 text-[11.5px] text-slate-text/70 space-y-1">
              <p className="font-mono">
                {located
                  ? `${primary.currentLocation.lat.toFixed(5)}, ${primary.currentLocation.lng.toFixed(5)}`
                  : "No position reported"}
              </p>
              <p>Last report {formatPing(primary.currentLocation?.updatedAt)}</p>
              {primary.currentLocation?.source === "manual" ? (
                <p className="text-slate-text/50">Position entered by the transport department</p>
              ) : null}
            </div>
          </Card>

          {located && live.distanceKm != null ? (
            <Card title="Next Stop" bodyClassName="p-4">
              <p className="text-[14px] font-semibold text-ink">{live.nextStop || "—"}</p>
              <p className="text-[12.5px] text-slate-text/75 mt-1">
                {live.distanceKm} km away · about {live.etaMinutes} minutes
              </p>
            </Card>
          ) : null}
        </div>
      </div>

      <Card title="Your Stops">
        {!primary.stops?.length ? (
          <p className="text-[13px] text-slate-text/70 py-6 text-center">
            Stops have not been published for this route yet.
          </p>
        ) : (
          <ol className="space-y-2">
            {primary.stops.map((stop, i) => {
              const isNext = live.nextStopIndex === i;
              const leg = primary.routePlan?.legs?.[i - 1];
              return (
                <li
                  key={`${stop.sequence ?? i}-${stop.name}-${i}`}
                  className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ${
                    isNext ? "bg-primary/10 border border-primary/25" : "bg-paper"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                      isNext ? "bg-primary" : "bg-ink"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-ink flex items-center gap-2">
                      {stop.name}
                      {isNext ? <Pill tone="info">Next</Pill> : null}
                    </p>
                    {stop.time ? (
                      <p className="text-[11.5px] text-slate-text/60 flex items-center gap-1.5 mt-0.5">
                        <Clock size={11} /> {stop.time}
                      </p>
                    ) : null}
                  </div>
                  {leg?.arrivalMinute != null ? (
                    <span className="text-[11.5px] text-slate-text/60 shrink-0">
                      +{leg.arrivalMinute} min
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {others.length > 0 && (
        <Card title="Also assigned to you">
          <div className="space-y-2">
            {others.map((r) => (
              <div
                key={r._id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5"
              >
                <span className="text-[13px] font-semibold text-ink">Route {r.routeNo}</span>
                <span className="text-[12px] text-slate-text/60">
                  {r.vehicleNo || "No vehicle recorded"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <p className="text-[12.5px] text-slate-text/80 flex items-center gap-2">
          <Bus size={14} className="text-slate-text/50" />
          You only see routes assigned to you. For changes, contact the transport department.
        </p>
      </Card>
    </div>
  );
}