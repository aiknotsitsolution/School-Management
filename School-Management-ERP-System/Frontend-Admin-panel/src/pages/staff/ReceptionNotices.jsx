import { useEffect, useState } from "react";
import { Megaphone, Pin, CalendarDays } from "lucide-react";
import { PageIntro, Card, Pill, toast } from "../../components/UI";
import { api } from "../../lib/api";
import { fmtDate } from "./useStaffContext";

export default function ReceptionNotices() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.notices
      .list()
      .then(({ data }) => setNotices(data || []))
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...(notices || [])].sort(
    (a, b) => Number(b.pinned || 0) - Number(a.pinned || 0),
  );

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Reception Workspace"
        title="Notice Board"
        description="Notices published to the school community."
      />

      {loading ? (
        <p className="text-[13px] text-slate-text py-10 text-center">Loading notices…</p>
      ) : sorted.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <Megaphone size={40} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[15px] font-semibold text-ink">No notices yet</p>
          </div>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {sorted.map((n) => (
            <Card key={n._id} className={n.pinned ? "border-amber" : ""}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {n.pinned && <Pin size={16} className="text-amber shrink-0" />}
                  <h3 className="font-display font-semibold text-ink text-[15px] truncate">{n.title}</h3>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Pill tone="neutral">{n.category || "General"}</Pill>
                </div>
              </div>
              <p className="text-[13px] text-slate-text mt-2 whitespace-pre-line">{n.description}</p>
              <div className="flex items-center gap-3 mt-3 text-[12px] text-slate-text/60">
                <span className="flex items-center gap-1.5"><CalendarDays size={12} /> {fmtDate(n.createdAt)}</span>
                {n.postedBy && <span>by {n.postedBy}</span>}
                {(n.audience || []).map((a) => (
                  <Pill key={a} tone="neutral">{a}</Pill>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}