import { useEffect, useRef, useState } from "react";
import { Award, ChevronLeft, ChevronRight, Sparkles, Users } from "lucide-react";

const CATEGORY = {
  academic: { label: "Academic", color: "#0C47CF" },
  sports: { label: "Sports", color: "#16A34A" },
  arts: { label: "Arts", color: "#E9424E" },
  citizenship: { label: "Citizenship", color: "#F59E0B" },
  attendance: { label: "Attendance", color: "#14B8A6" },
  other: { label: "Recognition", color: "#64748B" },
};

function toneFor(category) {
  return CATEGORY[category] || CATEGORY.other;
}

function fmtDate(d) {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function Stat({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-[20px] font-bold leading-none text-ink">{value}</p>
        <p className="mt-1 truncate text-[11.5px] font-medium text-slate-text/80">{label}</p>
      </div>
    </div>
  );
}

export default function RecognitionBand({ achievements = [], students = [], className = "" }) {
  const scroller = useRef(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  const nameById = (id) => {
    if (!id) return "";
    const match = students.find((s) => String(s._id) === String(id));
    return match?.name || "";
  };

  const items = achievements
    .filter((a) => a && (a.title || a.description))
    .slice()
    .sort((a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")));

  const recognised = new Set(items.map((a) => String(a.studentId || a.student || ""))).size;
  const categories = new Set(items.map((a) => a.category || "other")).size;

  const sync = () => {
    const el = scroller.current;
    if (!el) return;
    setCanScroll({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  };

  useEffect(() => {
    sync();
    const el = scroller.current;
    if (!el) return undefined;
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [items.length]);

  const nudge = (dir) => {
    const el = scroller.current;
    if (!el) return;
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.7), behavior: prefersReduced ? "auto" : "smooth" });
  };

  return (
    <section
      aria-label="Recognition"
      className={`overflow-hidden rounded-3xl border border-ink/10 bg-white p-5 shadow-[0_18px_44px_-38px_rgba(11,25,44,0.6)] sm:p-6 ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            Recognition
          </p>
          <h2 className="mt-2 font-display text-[22px] font-bold leading-tight tracking-tight text-ink sm:text-[26px]">
            Celebrating what students achieve
          </h2>
          <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-slate-text">
            Every record below is pulled live from the school achievement register.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => nudge(-1)}
            disabled={!canScroll.left}
            aria-label="Previous recognitions"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/12 text-ink transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-ink/12 disabled:hover:text-ink"
          >
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => nudge(1)}
            disabled={!canScroll.right}
            aria-label="Next recognitions"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/12 text-ink transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-ink/12 disabled:hover:text-ink"
          >
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-1 gap-4 border-y border-ink/8 py-4 sm:grid-cols-3">
        <Stat icon={Sparkles} value={items.length} label="Recognitions recorded" />
        <Stat icon={Users} value={recognised} label="Students recognised" />
        <Stat icon={Award} value={categories} label="Categories covered" />
      </div>

      {items.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-[13.5px] font-semibold text-ink">No recognitions yet</p>
          <p className="mx-auto mt-1.5 max-w-[42ch] text-[12.5px] text-slate-text/80">
            As soon as achievements are recorded for students, they will appear here.
          </p>
        </div>
      ) : (
        <div
          ref={scroller}
          role="list"
          tabIndex={0}
          aria-label="Recognition list"
          className="scrollbar-thin mt-5 flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl"
        >
          {items.map((a) => {
            const t = toneFor(a.category);
            const student = nameById(a.studentId || a.student);
            return (
              <article
                key={a._id || a.title}
                role="listitem"
                className="w-[268px] shrink-0 snap-start rounded-2xl border border-ink/10 bg-paper/60 p-4 transition-colors hover:border-primary/35 hover:bg-paper"
              >
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide"
                  style={{ background: `${t.color}16`, color: t.color }}
                >
                  {t.label}
                </span>
                <p className="mt-2.5 line-clamp-2 font-display text-[15px] font-bold leading-snug text-ink">
                  {a.title || a.description}
                </p>
                {a.description && a.title ? (
                  <p className="mt-1 line-clamp-2 text-[12px] text-slate-text/85">{a.description}</p>
                ) : null}
                <div className="mt-3.5 flex items-center gap-2.5 border-t border-ink/8 pt-3">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold"
                    style={{ background: `${t.color}1A`, color: t.color }}
                    aria-hidden="true"
                  >
                    {student ? initials(student) : "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-ink">
                      {student || "Recorded achievement"}
                    </p>
                    <p className="truncate text-[11px] text-slate-text/70">{fmtDate(a.date || a.createdAt)}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
