import { useEffect, useState } from "react";
import { Bus, MapPin, Clock, User } from "lucide-react";
import { PageIntro, Card, Pill } from "../../components/UI";
import { api } from "../../lib/api";
import { fmtDate } from "./useStudentContext";

export default function Transport() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.transport
      .list()
      .then(({ data }) => setRoutes(data || []))
      .catch(() => setRoutes([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Transport"
        title="My Transport"
        description="The bus route assigned to you."
      />

      {loading ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-24 bg-white rounded-2xl border border-black/[0.06] animate-pulse" />)}</div>
      ) : routes.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <Bus size={40} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[15px] font-semibold text-ink">No transport route assigned</p>
            <p className="text-[13px] text-slate-text/70 mt-1">If you use school transport, contact the transport department.</p>
          </div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {routes.map((r) => (
            <Card key={r._id}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h4 className="text-[14.5px] font-semibold text-ink">{r.name}</h4>
                  {r.vehicleNo && <p className="text-[11.5px] text-slate-text/60 mt-0.5">{r.vehicleNo}</p>}
                </div>
                <Pill tone="success">Assigned</Pill>
              </div>

              <div className="space-y-1.5">
                {r.driverName && (
                  <p className="text-[12px] text-slate-text/80 flex items-center gap-2">
                    <User size={13} className="text-slate-text/50" />Driver: {r.driverName}
                  </p>
                )}
                {r.pickupTime && (
                  <p className="text-[12px] text-slate-text/80 flex items-center gap-2">
                    <Clock size={13} className="text-slate-text/50" />Pickup: {r.pickupTime}
                  </p>
                )}
                {r.dropTime && (
                  <p className="text-[12px] text-slate-text/80 flex items-center gap-2">
                    <Clock size={13} className="text-slate-text/50" />Drop: {r.dropTime}
                  </p>
                )}
              </div>

              {(r.route || []).length > 0 && (
                <div className="mt-4 pt-3 border-t border-black/[0.06]">
                  <p className="text-[11px] font-semibold text-slate-text/50 uppercase tracking-wide mb-2">Route Stops</p>
                  <div className="space-y-1.5">
                    {r.route.map((stop, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <div className="relative flex items-center justify-center shrink-0">
                          <span className="w-2 h-2 rounded-full bg-amber" />
                          <span className="w-px h-4 bg-slate-200 ml-[3px]" />
                        </div>
                        <p className="text-[12.5px] text-slate-text/90 flex items-center gap-1.5">
                          <MapPin size={12} className="text-slate-text/40" />
                          {typeof stop === "string" ? stop : stop.name || stop.stopName || ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-slate-text/50 mt-4">
                Route assigned as per your record ({fmtDate(new Date())}).
              </p>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <p className="text-[12.5px] text-slate-text/80 flex items-center gap-2">
          <Bus size={14} className="text-slate-text/50" />
          You can only see routes you have been assigned to. For changes, contact the transport department.
        </p>
      </Card>
    </div>
  );
}