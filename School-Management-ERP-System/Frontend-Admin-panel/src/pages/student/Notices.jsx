import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { PageIntro, Card, Pill } from "../../components/UI";
import { api } from "../../lib/api";
import { fmtDate } from "./useStudentContext";

export default function Notices() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.notices
      .list()
      .then(({ data }) =>
        setNotices(
          [...(data || [])].sort((a, b) => (a.createdAt || "") < (b.createdAt || "") ? 1 : -1),
        ),
      )
      .catch(() => setNotices([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Updates"
        title="Notices"
        description="Announcements from the school office and your teachers."
      />

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 bg-white rounded-2xl border border-black/[0.06] animate-pulse" />)}</div>
      ) : notices.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <Megaphone size={40} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[15px] font-semibold text-ink">No notices right now</p>
            <p className="text-[13px] text-slate-text/70 mt-1">School announcements will appear here.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {notices.map((n) => (
            <Card key={n._id} className="flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber/10 text-amber flex items-center justify-center shrink-0">
                <Megaphone size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-[14.5px] font-semibold text-ink">{n.title}</h4>
                  <Pill tone={n.audience === "student" ? "info" : "success"}>{n.targetClass || n.audience || "All"}</Pill>
                </div>
                {n.description && (
                  <p className="text-[13px] text-slate-text/80 leading-relaxed mt-2">{n.description}</p>
                )}
                <p className="text-[11.5px] text-slate-text/50 mt-2">
                  {n.senderName ? `${n.senderName} · ` : ""}{fmtDate(n.createdAt)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <p className="text-[12.5px] text-slate-text/80 flex items-center gap-2">
          <Megaphone size={14} className="text-slate-text/50" />
          You see notices meant for your class and for all students. For immediate concerns, contact the school office.
        </p>
      </Card>
    </div>
  );
}