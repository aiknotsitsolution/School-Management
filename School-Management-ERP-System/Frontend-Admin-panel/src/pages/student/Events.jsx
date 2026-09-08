import { useEffect, useState } from "react";
import { PartyPopper, MapPin, Clock, CalendarDays } from "lucide-react";
import { PageIntro, Card, Pill } from "../../components/UI";
import { api } from "../../lib/api";
import { fmtDate } from "./useStudentContext";

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.events
      .list()
      .then(({ data }) => setEvents(data || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const past = events.filter((e) => (e.date ? new Date(e.date) < new Date() : false));
  const upcoming = events.filter((e) => !(e.date ? new Date(e.date) < new Date() : false));

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="School Activities"
        title="Events"
        description="Upcoming and recent events shared by the school."
      />

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 bg-white rounded-2xl border border-black/[0.06] animate-pulse" />)}</div>
      ) : events.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <PartyPopper size={40} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[15px] font-semibold text-ink">No events announced</p>
            <p className="text-[13px] text-slate-text/70 mt-1">School events and competitions will appear here.</p>
          </div>
        </Card>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-slate-text/50 uppercase tracking-wide">Upcoming</p>
              {upcoming.map((e) => (
                <Card key={e._id}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber/10 text-amber-dark flex items-center justify-center shrink-0">
                      <PartyPopper size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-[14.5px] font-semibold text-ink">{e.title}</h4>
                        {e.category && <Pill tone="info">{e.category}</Pill>}
                      </div>
                      {e.description && (
                        <p className="text-[13px] text-slate-text/80 leading-relaxed mt-1.5">{e.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-[11.5px] text-slate-text/60 flex-wrap">
                        <span className="flex items-center gap-1.5"><CalendarDays size={12} />{fmtDate(e.date)}</span>
                        {e.time && <span className="flex items-center gap-1.5"><Clock size={12} />{e.time}</span>}
                        {e.venue && <span className="flex items-center gap-1.5"><MapPin size={12} />{e.venue}</span>}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-slate-text/50 uppercase tracking-wide">Past events</p>
              {past.map((e) => (
                <Card key={e._id} className="opacity-70">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-paper text-slate-text/50 flex items-center justify-center shrink-0">
                      <PartyPopper size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[14.5px] font-semibold text-ink">{e.title}</h4>
                      {e.venue && <p className="text-[12.5px] text-slate-text/60 mt-0.5">{e.venue}</p>}
                      <p className="text-[11.5px] text-slate-text/50 mt-0.5">{fmtDate(e.date)}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Card>
        <p className="text-[12.5px] text-slate-text/80 flex items-center gap-2">
          <PartyPopper size={14} className="text-slate-text/50" />
          You see events meant for students and all-school audiences. Speak to your class teacher to register.
        </p>
      </Card>
    </div>
  );
}