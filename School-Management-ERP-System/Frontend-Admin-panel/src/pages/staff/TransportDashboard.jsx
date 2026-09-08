import { useEffect, useMemo, useState } from "react";
import {
  Bus,
  User,
  Car,
  MapPin,
  Gauge,
  ArrowRight,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageIntro, Card, StatCard, Pill, Button, toast } from "../../components/UI";
import { api } from "../../lib/api";
import useStaffContext, { dateOf } from "./useStaffContext";

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
    };
  }, [routes]);

  const totalStops = routes.reduce((s, r) => s + (r.stops?.length || 0), 0);

  if (loading) {
    return <p className="text-[13px] text-slate-text py-10 text-center">Loading transport…</p>;
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Transport Workspace"
        title="Fleet & Routes"
        description={`Bus operations at ${school?.name || "your school"}.`}
        right={
          <Button variant="amber" onClick={() => navigate("/transport/routes")}>
            Manage Routes <ArrowRight size={15} />
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Bus} label="Routes" value={String(stats.routes)} sub={`${totalStops} total stops`} accent="info" />
        <StatCard icon={Car} label="Vehicles" value={String(stats.vehicles)} sub="Registered buses" accent="amber" />
        <StatCard icon={User} label="Drivers" value={String(stats.drivers)} sub="Across routes" accent="success" />
        <StatCard icon={Users} label="Students Assigned" value={String(stats.students)} sub={`${stats.live} routes live`} accent="alert" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Route Overview">
          {routes.length === 0 ? (
            <p className="text-[13px] text-slate-text py-8 text-center">No routes configured yet.</p>
          ) : (
            <div className="space-y-3">
              {routes.slice(0, 6).map((r) => (
                <div key={r._id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink">
                      Route {r.routeNo} <span className="font-normal text-slate-text/70">· {r.vehicleNo || "no vehicle"}</span>
                    </p>
                    <p className="text-[12px] text-slate-text/60 truncate">
                      {r.driverName || "No driver"} · {r.stops?.length || 0} stops
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Pill tone="neutral">{r.assignedStudents?.length || 0} students</Pill>
                    {r.currentLocation?.updatedAt && (
                      <Pill tone="success">Live</Pill>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Quick Actions">
          <div className="grid gap-3">
            <button
              onClick={() => navigate("/transport/routes")}
              className="flex items-center gap-3 bg-white rounded-xl border border-black/[0.06] p-4 hover:border-amber/40 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-amber/10 text-amber flex items-center justify-center"><MapPin size={17} /></div>
              <div className="flex-1">
                <p className="text-[13.5px] font-semibold text-ink">Add / Update Routes</p>
                <p className="text-[12px] text-slate-text/70">Route numbers, stops, drivers and vehicles</p>
              </div>
              <ArrowRight size={16} className="text-slate-text/40" />
            </button>
            <button
              onClick={() => navigate("/transport/allocations")}
              className="flex items-center gap-3 bg-white rounded-xl border border-black/[0.06] p-4 hover:border-success/40 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-success/10 text-success flex items-center justify-center"><Gauge size={17} /></div>
              <div className="flex-1">
                <p className="text-[13.5px] font-semibold text-ink">Allocate Students</p>
                <p className="text-[12px] text-slate-text/70">Assign students to routes</p>
              </div>
              <ArrowRight size={16} className="text-slate-text/40" />
            </button>
          </div>
          <div className="mt-4 pt-4 border-t border-black/[0.06]">
            <p className="text-[12px] text-slate-text/60">
              Location last updated: {dateOf(routes.filter((r) => r.currentLocation?.updatedAt)[0]?.currentLocation?.updatedAt)} ·
              tracks geolocation reported by the driver app.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}