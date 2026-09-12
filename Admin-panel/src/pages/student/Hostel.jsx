import { useEffect, useState } from "react";
import { BedDouble, Building2, Hash, UserRound } from "lucide-react";
import { PageIntro, Card, Pill } from "../../components/UI";
import { api } from "../../lib/api";

export default function Hostel() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.hostel
      .list()
      .then(({ data }) => setRooms(data || []))
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, []);

  const room = rooms[0] || null;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Residence"
        title="My Hostel"
        description="Your room allotment as recorded by the hostel office."
      />

      {loading ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-24 bg-white rounded-2xl border border-black/[0.06] animate-pulse" />)}</div>
      ) : !room ? (
        <Card>
          <div className="py-10 text-center">
            <BedDouble size={40} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[15px] font-semibold text-ink">No hostel allotment</p>
            <p className="text-[13px] text-slate-text/70 mt-1">You are not currently allotted a hostel room.</p>
          </div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-[14.5px] font-semibold text-ink">Room {room.roomNo}</h4>
                <p className="text-[11.5px] text-slate-text/60 mt-0.5">{room.block} · Wing: {room.wing}</p>
              </div>
              <Pill tone="success">Allotted</Pill>
            </div>
            <div className="space-y-1.5">
              <p className="text-[12px] text-slate-text/80 flex items-center gap-2">
                <Building2 size={13} className="text-slate-text/50" />Block: {room.block}
              </p>
              <p className="text-[12px] text-slate-text/80 flex items-center gap-2">
                <Hash size={13} className="text-slate-text/50" />Floor: {room.floor}
              </p>
              {room.warden && (
                <p className="text-[12px] text-slate-text/80 flex items-center gap-2">
                  <UserRound size={13} className="text-slate-text/50" />Warden: {room.warden}
                </p>
              )}
              <p className="text-[12px] text-slate-text/80 flex items-center gap-2">
                <BedDouble size={13} className="text-slate-text/50" />Capacity: {room.capacity} · Occupied: {room.occupants?.length || 0}
              </p>
            </div>
          </Card>
        </div>
      )}

      <Card>
        <p className="text-[12.5px] text-slate-text/80 flex items-center gap-2">
          <BedDouble size={14} className="text-slate-text/50" />
          You can only see rooms you are allotted to. For changes, contact the hostel office.
        </p>
      </Card>
    </div>
  );
}