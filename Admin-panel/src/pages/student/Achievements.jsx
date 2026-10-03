import { useEffect, useMemo, useState } from "react";
import { Trophy, Medal, Star, Award, CalendarCheck, Target } from "lucide-react";
import { PageIntro, Card, Pill } from "../../components/UI";
import PageArtwork from "../../components/PageArtwork";
import { api } from "../../lib/api";
import useStudentContext from "./useStudentContext";

const CAT_TONES = {
  academic: "info", sports: "success", arts: "primary",
  citizenship: "success", attendance: "info", other: "neutral",
};

const CAT_ICONS = {
  academic: Star, sports: Medal, arts: Award,
  citizenship: Trophy, attendance: Trophy, other: Trophy,
};

const SKILLS = [
  { key: "academic", label: "Academic", icon: Star, color: "#0C47CF" },
  { key: "sports", label: "Sports", icon: Medal, color: "#16A34A" },
  { key: "arts", label: "Arts", icon: Award, color: "#E9424E" },
  { key: "citizenship", label: "Citizenship", icon: Trophy, color: "#F59E0B" },
  { key: "attendance", label: "Attendance", icon: CalendarCheck, color: "#14B8A6" },
];

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
        title="My Achievements" art="achievements"
        description="Track your accomplishments across academics, sports, arts and more."
      />

      <section aria-label="Skill areas">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
              <Target size={13} aria-hidden="true" />
              Skill areas
            </p>
            <h2 className="mt-1.5 font-display text-[19px] font-bold leading-tight tracking-tight text-ink sm:text-[21px]">
              Where your strengths are showing
            </h2>
          </div>
          <Pill tone={counts.total ? "success" : "neutral"}>
            {counts.total} {counts.total === 1 ? "record" : "records"}
          </Pill>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {SKILLS.map((s) => {
            const n = counts[s.key] || 0;
            const share = counts.total ? Math.round((n / counts.total) * 100) : 0;
            const Icon = s.icon;
            return (
              <div
                key={s.key}
                className="group flex flex-col items-center rounded-3xl border border-ink/10 bg-white px-4 py-6 text-center transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_20px_44px_-32px_rgba(11,25,44,0.75)]"
              >
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-105"
                  style={{ background: `${s.color}14`, color: s.color }}
                  aria-hidden="true"
                >
                  <Icon size={22} strokeWidth={2} />
                </span>
                <p className="mt-3 font-display text-[26px] font-bold leading-none text-ink">{n}</p>
                <p className="mt-1.5 text-[11.5px] font-bold uppercase tracking-wide text-slate-text">
                  {s.label}
                </p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink/8">
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-out"
                    style={{ width: `${n ? Math.max(6, share) : 0}%`, background: s.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

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
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${(CAT_TONES[r.category] || "neutral") === "info" ? "bg-info/10" : (CAT_TONES[r.category]) === "success" ? "bg-success/10" : "bg-primary/10"}`}>
                    <Icon size={18} className={(CAT_TONES[r.category] || "neutral") === "info" ? "text-info" : (CAT_TONES[r.category]) === "success" ? "text-success" : "text-primary"} />
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
