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
  ACCENTS,
  greeting,
} from "../../components/dashboard/DashKit";

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
        columns={4}
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
              title="Route overview"
              icon={Bus}
              iconTone={ACCENTS.teal.icon}
              subtitle={`${stats.routes} route${stats.routes === 1 ? "" : "s"} configured`}
              className="lg:col-span-2"
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
                </div>
              </Panel>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
