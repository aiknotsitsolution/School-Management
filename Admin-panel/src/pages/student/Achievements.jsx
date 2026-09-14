import { useEffect, useMemo, useState } from "react";
import { Trophy, Medal, Star, Award } from "lucide-react";
import { PageIntro, Card, Pill, StatCard } from "../../components/UI";
import { api } from "../../lib/api";
import useStudentContext from "./useStudentContext";

const CAT_TONES = {
  academic: "info", sports: "success", arts: "amber",
  citizenship: "success", attendance: "info", other: "neutral",
};

const CAT_ICONS = {
  academic: Star, sports: Medal, arts: Award,
  citizenship: Trophy, attendance: Trophy, other: Trophy,
};

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function StudentAchievements() {
  const { user } = useStudentContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.achievements.list("limit=200")
      .then(({ data }) => {
        const all = Array.isArray(data) ? data : data?.data || [];
        setItems(all.filter((r) => r.studentId === user?._id));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?._id]);

  const counts = useMemo(() => {
    const c = { total: items.length };
    items.forEach((r) => { c[r.category] = (c[r.category] || 0) + 1; });
    return c;
  }, [items]);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="My Profile"
        title="My Achievements"
        description="Track your accomplishments across academics, sports, arts and more."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Trophy} label="Total" value={String(counts.total)} sub="All achievements" accent="success" />
        <StatCard icon={Star} label="Academic" value={String(counts.academic || 0)} sub="Academic excellence" accent="info" />
        <StatCard icon={Medal} label="Sports" value={String(counts.sports || 0)} sub="Sports & games" accent="success" />
        <StatCard icon={Award} label="Arts" value={String(counts.arts || 0)} sub="Arts & culture" accent="amber" />
      </div>

      <Card title="Achievement Records">
        {loading ? (
          <div className="py-14 text-center text-[13px] text-slate-text/60">Loading...</div>
        ) : items.length === 0 ? (
          <div className="py-14 text-center text-[13px] text-slate-text/60">No achievements recorded yet.</div>
        ) : (
          <div className="space-y-3">
            {items.map((r) => {
              const Icon = CAT_ICONS[r.category] || Trophy;
              return (
                <div key={r._id} className="flex items-start gap-3 p-3 rounded-xl bg-paper/60 hover:bg-paper transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${(CAT_TONES[r.category] || "neutral") === "info" ? "bg-info/10" : (CAT_TONES[r.category]) === "success" ? "bg-success/10" : "bg-amber/10"}`}>
                    <Icon size={18} className={(CAT_TONES[r.category] || "neutral") === "info" ? "text-info" : (CAT_TONES[r.category]) === "success" ? "text-success" : "text-amber"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink">{r.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Pill tone={CAT_TONES[r.category] || "neutral"}>{r.category}</Pill>
                      <span className="text-[11px] text-slate-text/60">{fmtDate(r.date)}</span>
                    </div>
                    {r.description && <p className="text-[12px] text-slate-text/70 mt-1.5 line-clamp-2">{r.description}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
