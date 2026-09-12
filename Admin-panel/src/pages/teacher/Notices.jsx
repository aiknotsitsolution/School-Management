import { useEffect, useMemo, useState } from "react";
import { Pin, Bell, Search } from "lucide-react";
import { PageIntro, Card, Input, Pill, toast } from "../../components/UI";
import { api } from "../../lib/api";
import { fmtDate } from "./useTeacherContext";

const categoryTone = {
  Academic: "info",
  Holiday: "success",
  Sports: "amber",
  Fees: "alert",
  Event: "info",
  Transport: "neutral",
  General: "neutral",
};

export default function Notices() {
  const [notices, setNotices] = useState([]);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.notices
      .list()
      .then(({ data }) => setNotices(data || []))
      .catch((e) => toast(e.message, "error"));
  }, []);

  const cats = useMemo(
    () => ["All", ...new Set(notices.map((n) => n.category || "General"))],
    [notices],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return (notices || [])
      .filter((n) => {
        const matchCat = filter === "All" || n.category === filter;
        const body = n.description || n.body || "";
        const matchQuery =
          !q ||
          n.title?.toLowerCase().includes(q) ||
          body.toLowerCase().includes(q);
        return matchCat && matchQuery;
      })
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  }, [notices, filter, query]);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="My Teaching"
        title="Notices"
        description="Official circulars and announcements for students, parents and staff."
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
          />
          <Input
            placeholder="Search notices..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors ${
                filter === c
                  ? "bg-ink text-white border-ink"
                  : "bg-white text-slate-text border-black/10 hover:border-ink/30"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <div className="py-14 text-center">
            <Bell size={36} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[14px] font-medium text-ink">No notices found</p>
            <p className="text-[13px] text-slate-text/60 mt-1">
              Try a different category or search term.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((n) => {
            const body = n.description || n.body || "";
            const audience = Array.isArray(n.audience)
              ? n.audience.join(", ")
              : n.audience || "All";
            return (
              <Card key={n._id} className={n.pinned ? "ring-1 ring-amber/30" : ""}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Pill tone={categoryTone[n.category] || "neutral"}>
                      {n.category || "General"}
                    </Pill>
                    {n.pinned && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-dark">
                        <Pin size={12} fill="#E8A33D" /> Pinned
                      </span>
                    )}
                  </div>
                </div>
                <h3 className="font-display font-bold text-ink text-[15.5px] leading-snug">
                  {n.title}
                </h3>
                <p className="text-[13px] text-slate-text mt-2 leading-relaxed line-clamp-4">
                  {body}
                </p>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-black/[0.06] text-[11.5px] text-slate-text/60">
                  <span>For: {audience}</span>
                  <span>{fmtDate(n.expiryDate || n.createdAt)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}