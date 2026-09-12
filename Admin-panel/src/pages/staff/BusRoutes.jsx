import { useEffect, useState } from "react";
import { Plus, MapPin, Bus, Phone } from "lucide-react";
import {
  PageIntro,
  Card,
  Input,
  Button,
  StatCard,
  toast,
} from "../../components/UI";
import { api } from "../../lib/api";
import useStaffContext from "./useStaffContext";

export default function BusRoutes() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const refresh = () => {
    setLoading(true);
    api.transport
      .list()
      .then(({ data }) => setRoutes(data || []))
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const stops = fd
      .get("stops")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
    if (stops.length < 2) {
      toast("Add at least two stops", "error");
      return;
    }
    const payload = {
      routeNo: fd.get("routeNo"),
      driverName: fd.get("driverName") || undefined,
      driverContact: fd.get("driverContact") || undefined,
      vehicleNo: fd.get("vehicleNo") || undefined,
      stops,
    };
    try {
      await api.transport.create(payload);
      toast(editing ? "Route updated" : "Route created", "success");
      setShowForm(false);
      setEditing(null);
      refresh();
    } catch (err) {
      toast(err.message, "error");
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

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Transport Workspace"
        title="Bus Routes"
        description="Route numbers, stops, drivers and vehicles."
        right={
          <Button variant="amber" onClick={() => setShowForm((v) => !v)}>
            <Plus size={15} /> Add Route
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Bus} label="Routes" value={String(routes.length)} accent="info" />
        <StatCard icon={MapPin} label="Stops" value={String(routes.reduce((s, r) => s + (r.stops?.length || 0), 0))} accent="amber" />
        <StatCard icon={Phone} label="Drivers" value={String(routes.filter((r) => r.driverName).length)} accent="success" />
        <StatCard icon={Bus} label="Students" value={String(routes.reduce((s, r) => s + (r.assignedStudents?.length || 0), 0))} accent="alert" />
      </div>

      {showForm && (
        <Card title={editing ? "Edit Route" : "Add Route"}>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Input name="routeNo" placeholder="Route No. (e.g. R-01)" defaultValue={editing?.routeNo} required />
            <Input name="vehicleNo" placeholder="Vehicle No." defaultValue={editing?.vehicleNo} />
            <Input name="driverName" placeholder="Driver Name" defaultValue={editing?.driverName} />
            <Input name="driverContact" placeholder="Driver Contact" defaultValue={editing?.driverContact} />
            <Input
              name="stops"
              placeholder="Stops (comma separated)"
              defaultValue={editing?.stops?.map((s) => s.name).join(", ")}
              className="sm:col-span-2 lg:col-span-2"
            />
            <div className="flex items-end gap-2">
              <Button type="submit">{editing ? "Save" : "Create Route"}</Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Button>
            </div>
          </form>
        </Card>
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
                  <th className="px-3 py-2 font-semibold">Students</th>
                  <th className="px-3 py-2 font-semibold">Live</th>
                  <th className="px-3 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => (
                  <tr key={r._id} className="border-t border-black/[0.06] hover:bg-paper/60">
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
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => handleLocation(r)} className="text-info hover:underline text-[12px] font-semibold mr-3">
                        Update Location
                      </button>
                      <button
                        onClick={() => {
                          setEditing(r);
                          setShowForm(true);
                        }}
                        className="text-info hover:underline text-[12px] font-semibold mr-3"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}