import { useEffect, useMemo, useState } from "react";
import {
  Bus,
  User,
  Car,
  MapPin,
  Gauge,
  ArrowRight,
  Users,
  Sparkles,
  Navigation,
  Route as RouteIcon,
  Radio,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "../../components/UI";
import { api } from "../../lib/api";
import useStaffContext, { dateOf } from "./useStaffContext";
import {
  HeroBanner,
  GlassStat,
  QuickActions,
  MetricGrid,
  MetricCard,
  Panel,
  Badge,
  ListRow,
  EmptyPanel,
  DashboardSkeleton,
  AlertStrip,
  ACCENTS,
  greeting,
} from "../../components/dashboard/DashKit";
import {
  BarRowChart,
  ProgressRing,
  StatusStrip,
} from "../../components/studentcharts/StudentCharts";

const FLEET_LINKS = [
  { to: "/transport/routes", icon: MapPin, label: "Add / update routes", tone: ACCENTS.primary.icon },
  { to: "/transport/allocations", icon: Gauge, label: "Allocate students", tone: ACCENTS.success.icon },
  { to: "/transport/routes", icon: RouteIcon, label: "Stops & timings", tone: ACCENTS.info.icon },
  { to: "/transport/allocations", icon: Users, label: "Route manifests", tone: ACCENTS.violet.icon },
];

export default function TransportDashboard() {
  const { school } = useStaffContext();
  const navigate = useNavigate();
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.transport
      .list()
      .then(({ data }) => setRoutes(data || []))
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const today = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const live = routes.filter((r) => {
      const updated = r.currentLocation?.updatedAt;
      return updated && today.getTime() - new Date(updated).getTime() < dayMs;
    });
    const drivers = {};
    routes.forEach((r) => {
      if (r.driverName) drivers[r.driverName] = true;
    });
    return {
      routes: routes.length,
      vehicles: routes.filter((r) => r.vehicleNo).length,
      drivers: Object.keys(drivers).length,
      students: routes.reduce((s, r) => s + (r.assignedStudents?.length || 0), 0),
      live: live.length,
      liveRouteIds: new Set(live.map((r) => r._id)),
      lastPing: routes.find((r) => r.currentLocation?.updatedAt)?.currentLocation?.updatedAt,
    };
  }, [routes]);

  const totalStops = routes.reduce((s, r) => s + (r.stops?.length || 0), 0);
  const liveRouteIds = stats.liveRouteIds;
  const lastPing = stats.lastPing;

  /** Share of the fleet currently reporting a GPS ping. */
  const livePct = stats.routes > 0 ? (stats.live / stats.routes) * 100 : 0;

  const trackedRoutes = useMemo(
    () => routes.filter((r) => r.tracking?.enabled).length,
    [routes],
  );

  /** Routes that are not yet operationally ready — the dispatcher's to-do list. */
  const readiness = useMemo(
    () => ({
      noVehicle: routes.filter((r) => !r.vehicleNo).length,
      noDriver: routes.filter((r) => !r.driverName).length,
      empty: routes.filter((r) => !(r.assignedStudents?.length || 0)).length,
      noStops: routes.filter((r) => !(r.stops?.length || 0)).length,
    }),
    [routes],
  );

  /** Students carried per route — shows load balance at a glance. */
  const routeLoads = useMemo(
    () =>
      routes
        .filter((r) => r.routeNo)
        .map((r) => ({ label: `Route ${r.routeNo}`, value: r.assignedStudents?.length || 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    [routes],
  );

  /** Mean speed across buses that are actually moving right now. */
  const movingBuses = useMemo(
    () => routes.filter((r) => liveRouteIds.has(r._id) && Number(r.currentLocation?.speedKmh) > 0),
    [routes, liveRouteIds],
  );
  const meanSpeed = movingBuses.length
    ? Math.round(
        movingBuses.reduce((s, r) => s + Number(r.currentLocation.speedKmh || 0), 0) /
          movingBuses.length,
      )
    : 0;

  /** Planned distance across the fleet, straight from each route's computed plan. */
  const plannedKm = useMemo(
    () =>
      Math.round(
        routes.reduce((s, r) => s + Number(r.tracking?.routePlan?.totalKm || 0), 0),
      ),
    [routes],
  );

  /** One pip per route so the whole fleet's heartbeat is visible at once. */
  const fleetHeartbeat = useMemo(
    () =>
      routes.map((r) => ({
        id: r._id,
        color: liveRouteIds.has(r._id) ? "success" : "slateLight",
        label: `Route ${r.routeNo}${r.vehicleNo ? ` · ${r.vehicleNo}` : ""}`,
      })),
    [routes, liveRouteIds],
  );

  /** Only actionable fleet gaps — silent when everything is configured. */
  const alerts = useMemo(() => {
    const list = [];
    if (stats.live === 0 && stats.routes > 0) {
      list.push({ label: "No route is reporting live", tone: "warning" });
    }
    if (readiness.noDriver > 0) {
      list.push({ label: `${readiness.noDriver} route${readiness.noDriver === 1 ? "" : "s"} without a driver`, tone: "alert" });
    }
    if (readiness.noVehicle > 0) {
      list.push({ label: `${readiness.noVehicle} route${readiness.noVehicle === 1 ? "" : "s"} without a vehicle`, tone: "warning" });
    }
    if (readiness.empty > 0) {
      list.push({ label: `${readiness.empty} route${readiness.empty === 1 ? "" : "s"} with no students`, tone: "info" });
    }
    if (stats.live > 0) {
      list.push({ label: `${stats.live} route${stats.live === 1 ? "" : "s"} live now`, tone: "success" });
    }
    return list;
  }, [stats.live, stats.routes, readiness]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        gradient="teal"
        eyebrow={`${greeting()} · Transport Workspace`}
        name="Fleet & Routes"
        title={school?.name || "Transport"}
        meta="Every bus, every stop, every child home safe — live fleet tracking and route planning in one view."
        dateLabel={new Date().toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        quote="The safest classroom for some children is the bus that brings them home."
        quoteTitle="Fleet operations"
        right={
          <>
            <GlassStat value={stats.routes} label="Routes" />
            <GlassStat value={stats.live} label="Live now" />
            <GlassStat value={stats.students} label="Students" />
          </>
        }
      />

      <QuickActions
        title="Fleet Shortcuts"
        icon={Sparkles}
          action={
            <button
            type="button"
            onClick={() => navigate("/transport/routes")}
            className="inline-flex items-center gap-2 rounded-xl bg-info px-3.5 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-blue-700"
          >
            Manage Routes <ArrowRight size={14} />
          </button>
        }
        items={FLEET_LINKS}
      />

      <AlertStrip items={alerts} />

      {loading ? (
        <DashboardSkeleton metricCols={4} />
      ) : (
        <>
          <MetricGrid columns={4}>
            <MetricCard
              icon={Bus}
              label="Routes"
              value={stats.routes}
              sub={`${totalStops} total stops`}
              accent="info"
            />
            <MetricCard
              icon={Car}
              label="Vehicles"
              value={stats.vehicles}
              sub="registered buses"
              accent="primary"
            />
            <MetricCard
              icon={User}
              label="Drivers"
              value={stats.drivers}
              sub="across routes"
              accent="success"
            />
            <MetricCard
              icon={Users}
              label="Students assigned"
              value={stats.students}
              sub={`${stats.live} route${stats.live === 1 ? "" : "s"} live`}
              accent={stats.live > 0 ? "alert" : "neutral"}
            />
          </MetricGrid>

          <div className="grid gap-5 lg:grid-cols-3">
            <Panel
              title="Students per route"
              icon={TrendingUp}
              iconTone={ACCENTS.violet.icon}
              subtitle="Load balance across the fleet"
              className="lg:col-span-2"
              decor="route"
              decorTone={ACCENTS.violet.text}
            >
              {routeLoads.length === 0 ? (
                <EmptyPanel
                  icon={TrendingUp}
                  iconTone={ACCENTS.neutral.icon}
                  title="No routes to compare"
                  text="Once students are allocated, each route's load is charted here."
                />
              ) : (
                <BarRowChart
                  data={routeLoads}
                  height={Math.max(150, routeLoads.length * 34)}
                  max={Math.max(1, ...routeLoads.map((r) => r.value))}
                  color="info"
                  suffix=""
                  tooltipLabel="Students"
                />
              )}
            </Panel>

            <Panel
              title="Fleet status"
              icon={Radio}
              iconTone={ACCENTS.success.icon}
              subtitle={`${trackedRoutes} of ${stats.routes} routes tracked`}
              decor="pin"
              decorTone={ACCENTS.success.text}
            >
              {stats.routes === 0 ? (
                <EmptyPanel
                  icon={Radio}
                  iconTone={ACCENTS.neutral.icon}
                  title="No fleet yet"
                  text="Add a route to start tracking vehicles live."
                />
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <ProgressRing
                    value={livePct}
                    size={140}
                    stroke={12}
                    color={livePct > 0 ? "success" : "neutral"}
                    label={`${Math.round(livePct)}%`}
                    ariaLabel={`${Math.round(livePct)} percent of routes reporting live`}
                  />
                  <div className="grid w-full grid-cols-2 gap-2.5">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5 text-center">
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-text/60">
                        Moving
                      </p>
                      <p className="mt-1 font-display text-[17px] font-bold text-emerald-600">
                        {movingBuses.length}
                      </p>
                    </div>
                    <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2.5 text-center">
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-text/60">
                        Avg speed
                      </p>
                      <p className="mt-1 font-display text-[17px] font-bold text-sky-600">
                        {meanSpeed} <span className="text-[11px] font-semibold">km/h</span>
                      </p>
                    </div>
                  </div>
                  {plannedKm > 0 && (
                    <p className="w-full text-center text-[12px] leading-relaxed text-slate-text/60">
                      {plannedKm} km of planned distance across all routes
                    </p>
                  )}
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Panel
              title="Route overview"
              icon={Bus}
              iconTone={ACCENTS.teal.icon}
              subtitle={`${stats.routes} route${stats.routes === 1 ? "" : "s"} configured`}
              className="lg:col-span-2"
              decor="route"
              decorTone={ACCENTS.info.text}
            >
              {routes.length === 0 ? (
                <EmptyPanel
                  icon={Bus}
                  iconTone={ACCENTS.neutral.icon}
                  title="No routes configured yet"
                  text="Add route numbers, stops, drivers and vehicles to start tracking the fleet."
                  action={
                    <button
                      type="button"
                      onClick={() => navigate("/transport/routes")}
                      className="rounded-xl bg-info px-3.5 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-blue-700"
                    >
                      Add a route
                    </button>
                  }
                />
              ) : (
                <div className="space-y-2.5">
                  {routes.slice(0, 6).map((r) => {
                    const isLive = liveRouteIds.has(r._id);
                    return (
                      <ListRow
                        key={r._id}
                        icon={Navigation}
                        iconTone={isLive ? ACCENTS.success.icon : ACCENTS.neutral.icon}
                        title={
                          <>
                            Route {r.routeNo}{" "}
                            <span className="font-medium text-slate-text/70">
                              · {r.vehicleNo || "no vehicle"}
                            </span>
                          </>
                        }
                        meta={`${r.driverName || "No driver assigned"} · ${r.stops?.length || 0} stops`}
                        trailing={
                          <>
                            <Badge tone="neutral">
                              {r.assignedStudents?.length || 0} students
                            </Badge>
                            {isLive ? <Badge tone="success">Live</Badge> : null}
                          </>
                        }
                      />
                    );
                  })}
                </div>
              )}
            </Panel>

            <div className="space-y-5">
              <Panel
                title="Fleet actions"
                icon={Gauge}
                iconTone={ACCENTS.violet.icon}
                subtitle="Common transport tasks"
                decor="tasks"
                decorTone={ACCENTS.violet.text}
              >
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => navigate("/transport/routes")}
                    className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ACCENTS.primary.icon}`}
                      aria-hidden="true"
                    >
                      <MapPin size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold text-ink">
                        Add / update routes
                      </span>
                      <span className="mt-0.5 block text-[12px] text-slate-text/70">
                        Numbers, stops, drivers, vehicles
                      </span>
                    </span>
                    <ArrowRight
                      size={16}
                      className="shrink-0 text-slate-text/40 transition-colors group-hover:text-info"
                      aria-hidden="true"
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/transport/allocations")}
                    className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ACCENTS.success.icon}`}
                      aria-hidden="true"
                    >
                      <Gauge size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold text-ink">
                        Allocate students
                      </span>
                      <span className="mt-0.5 block text-[12px] text-slate-text/70">
                        Assign children to routes
                      </span>
                    </span>
                    <ArrowRight
                      size={16}
                      className="shrink-0 text-slate-text/40 transition-colors group-hover:text-info"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </Panel>

              <Panel
                title="Live tracking"
                icon={Radio}
                iconTone={ACCENTS.success.icon}
                subtitle="GPS pings from the driver app"
                decor="pin"
                decorTone={ACCENTS.success.text}
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        stats.live > 0 ? ACCENTS.success.icon : ACCENTS.neutral.icon
                      }`}
                      aria-hidden="true"
                    >
                      <Radio size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-[20px] font-bold leading-none text-ink">
                        {stats.live}
                      </p>
                      <p className="mt-1 text-[11.5px] text-slate-text/70">
                        {stats.live === 1 ? "route is" : "routes are"} reporting live
                      </p>
                    </div>
                  </div>
                  <p className="text-[12px] leading-relaxed text-slate-text/60">
                    Last location received {dateOf(lastPing)} · tracks geolocation reported
                    by the driver app.
                  </p>
                  {readiness.noDriver + readiness.noVehicle + readiness.empty + readiness.noStops > 0 && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/70 px-3.5 py-2.5">
                      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
                      <p className="text-[12px] leading-relaxed text-amber-700">
                        {[
                          readiness.noDriver ? `${readiness.noDriver} missing a driver` : null,
                          readiness.noVehicle ? `${readiness.noVehicle} missing a vehicle` : null,
                          readiness.noStops ? `${readiness.noStops} with no stops` : null,
                          readiness.empty ? `${readiness.empty} with no students` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  )}
                </div>
              </Panel>
            </div>
          </div>

          <Panel
            title="Fleet heartbeat"
            icon={Navigation}
            iconTone={ACCENTS.neutral.icon}
            subtitle="Every route, live or idle"
            className="mt-5"
          >
            <StatusStrip
              items={fleetHeartbeat}
              emptyText="No routes configured yet"
            />
          </Panel>
        </>
      )}
    </div>
  );
}
