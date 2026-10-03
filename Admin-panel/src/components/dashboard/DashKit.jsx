// Shared "dashboard language" used by every persona home screen.
//
// The StudentDashboard is the reference design; everything in here follows the
// same rules so admin / teacher / staff / parent / platform screens feel like
// one product: gradient hero, quick-action rail, tinted metric strip, icon-led
// panels, considered empty states and skeleton loading.
// Purely presentational — no data fetching lives in this file.

import { Children, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PageArtwork, { artworkForLucide } from "../PageArtwork";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Sun,
} from "lucide-react";

/* ── Accent system ─────────────────────────────────────────────────────── */

export const ACCENTS = {
  primary: {
    soft: "bg-indigo-50/80 border-indigo-100 hover:border-indigo-200",
    icon: "bg-white text-indigo-600 shadow-[0_4px_14px_rgba(79,70,229,0.14)]",
    bar: "bg-indigo-500",
    text: "text-indigo-600",
    chip: "bg-indigo-100 text-indigo-700",
    dot: "bg-indigo-500",
    tile: "bg-indigo-50 text-indigo-600",
    edge: "hover:border-indigo-300",
    glow: "hover:shadow-[0_22px_44px_-24px_rgba(79,70,229,0.55)]",
  },
  success: {
    soft: "bg-emerald-50/80 border-emerald-100 hover:border-emerald-200",
    icon: "bg-white text-emerald-600 shadow-[0_4px_14px_rgba(16,185,129,0.14)]",
    bar: "bg-emerald-500",
    text: "text-emerald-600",
    chip: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
    tile: "bg-emerald-50 text-emerald-600",
    edge: "hover:border-emerald-300",
    glow: "hover:shadow-[0_22px_44px_-24px_rgba(16,185,129,0.5)]",
  },
  info: {
    soft: "bg-sky-50/80 border-sky-100 hover:border-sky-200",
    icon: "bg-white text-sky-600 shadow-[0_4px_14px_rgba(14,165,233,0.14)]",
    bar: "bg-sky-500",
    text: "text-sky-600",
    chip: "bg-sky-100 text-sky-700",
    dot: "bg-sky-500",
    tile: "bg-sky-50 text-sky-600",
    edge: "hover:border-sky-300",
    glow: "hover:shadow-[0_22px_44px_-24px_rgba(14,165,233,0.5)]",
  },
  warn: {
    soft: "bg-amber-50/80 border-amber-100 hover:border-amber-200",
    icon: "bg-white text-amber-500 shadow-[0_4px_14px_rgba(245,158,11,0.16)]",
    bar: "bg-amber-500",
    text: "text-amber-600",
    chip: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
    tile: "bg-amber-50 text-amber-600",
    edge: "hover:border-amber-300",
    glow: "hover:shadow-[0_22px_44px_-24px_rgba(245,158,11,0.5)]",
  },
  alert: {
    soft: "bg-rose-50/80 border-rose-100 hover:border-rose-200",
    icon: "bg-white text-rose-500 shadow-[0_4px_14px_rgba(225,29,72,0.14)]",
    bar: "bg-rose-500",
    text: "text-rose-500",
    chip: "bg-rose-100 text-rose-600",
    dot: "bg-rose-500",
    tile: "bg-rose-50 text-rose-600",
    edge: "hover:border-rose-300",
    glow: "hover:shadow-[0_22px_44px_-24px_rgba(225,29,72,0.5)]",
  },
  neutral: {
    soft: "bg-slate-50/80 border-slate-200 hover:border-slate-300",
    icon: "bg-white text-slate-600 shadow-[0_4px_14px_rgba(15,23,42,0.1)]",
    bar: "bg-slate-400",
    text: "text-slate-600",
    chip: "bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
    tile: "bg-slate-100 text-slate-600",
    edge: "hover:border-slate-400",
    glow: "hover:shadow-[0_22px_44px_-24px_rgba(15,23,42,0.4)]",
  },
  violet: {
    soft: "bg-violet-50/80 border-violet-100 hover:border-violet-200",
    icon: "bg-white text-violet-600 shadow-[0_4px_14px_rgba(139,92,246,0.14)]",
    bar: "bg-violet-500",
    text: "text-violet-600",
    chip: "bg-violet-100 text-violet-700",
    dot: "bg-violet-500",
    tile: "bg-violet-50 text-violet-600",
    edge: "hover:border-violet-300",
    glow: "hover:shadow-[0_22px_44px_-24px_rgba(139,92,246,0.5)]",
  },
  teal: {
    soft: "bg-teal-50/80 border-teal-100 hover:border-teal-200",
    icon: "bg-white text-teal-600 shadow-[0_4px_14px_rgba(13,148,136,0.14)]",
    bar: "bg-teal-500",
    text: "text-teal-600",
    chip: "bg-teal-100 text-teal-700",
    dot: "bg-teal-500",
    tile: "bg-teal-50 text-teal-600",
    edge: "hover:border-teal-300",
    glow: "hover:shadow-[0_22px_44px_-24px_rgba(13,148,136,0.5)]",
  },
};

// Legacy `accent` names used by the old shared StatCard, mapped to the kit.
const LEGACY_ACCENT = {
  primary: "primary",
  success: "success",
  info: "warn",
  alert: "alert",
  neutral: "neutral",
};

export function accentOf(accent = "primary", tone) {
  if (tone && ACCENTS[tone]) return ACCENTS[tone];
  if (ACCENTS[accent]) return ACCENTS[accent];
  return ACCENTS[LEGACY_ACCENT[accent] || "primary"];
}

/* ── Hero gradients (one per persona) ──────────────────────────────────── */

export const HERO_GRADIENTS = {
  blue: "from-[#1B3FCB] via-[#2563EB] to-[#4F46E5]",
  indigo: "from-[#2B1E7A] via-[#4338CA] to-[#6D28D9]",
  emerald: "from-[#065F46] via-[#059669] to-[#0D9488]",
  slate: "from-[#0F1E33] via-[#1E3A5F] to-[#2F5D8F]",
  plum: "from-[#4C1D95] via-[#7E22CE] to-[#DB2777]",
  teal: "from-[#0B3B45] via-[#0E7490] to-[#0D9488]",
  amber: "from-[#7C2D12] via-[#C2410C] to-[#D97706]",
  rose: "from-[#7F1D1D] via-[#BE123C] to-[#E11D48]",
  sky: "from-[#0C4A6E] via-[#0284C7] to-[#0EA5E9]",
  ink: "from-[#0B192C] via-[#172033] to-[#1E3A5F]",
};

/* ── Data helpers ───────────────────────────────────────────────────────── */

// Month-by-month bucketing for sparklines and trend areas.
//
// Deliberately NOT `bucketByMonth` from studentcharts/theme: that one keys on the
// month NAME alone, so "Jan" from last year silently merges into this year's
// "Jan", it returns buckets in insertion order rather than chronological order,
// and it hardcodes a `date` field. The staff records that feed these dashboards
// are dated by `createdAt` / `paidOn` / `issuedOn` instead, so reusing it would
// have produced empty or scrambled charts.
//
// `value` is optional: omit it to count rows per month, or pass a mapper to sum
// an amount. Returns ascending by year+month, which the x-axis relies on.
export function monthlyTrend(rows = [], { dateKey = "date", value, label } = {}) {
  const buckets = new Map();
  (rows || []).forEach((r) => {
    const d = new Date(r[dateKey]);
    if (Number.isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        label: label ? label(r) : d.toLocaleDateString("en-IN", { month: "short" }),
        fullLabel: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
        order: d.getFullYear() * 12 + d.getMonth(),
        value: 0,
      });
    }
    buckets.get(key).value += value ? Number(value(r)) || 0 : 1;
  });
  return [...buckets.values()].sort((a, b) => a.order - b.order);
}

/* ── Small primitives ──────────────────────────────────────────────────── */

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function Skeleton({ className = "" }) {
  return (
    <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} aria-hidden="true" />
  );
}

export function PanelIcon({ tone = ACCENTS.primary.icon, children }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone}`}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

const BADGE = {
  success: "bg-emerald-100 text-emerald-700",
  alert: "bg-rose-100 text-rose-600",
  warning: "bg-amber-100 text-amber-700",
  info: "bg-sky-100 text-sky-700",
  neutral: "bg-slate-100 text-slate-600",
  primary: "bg-indigo-100 text-indigo-700",
  violet: "bg-violet-100 text-violet-700",
};

export function Badge({ tone = "neutral", children }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${BADGE[tone] || BADGE.neutral}`}
    >
      {children}
    </span>
  );
}

export function ViewLink({ to, children, onClick }) {
  const cls =
    "group/link inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-semibold text-info transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40 rounded";
  const inner = (
    <>
      {children}
      <ChevronRight
        size={14}
        className="transition-transform group-hover/link:translate-x-0.5"
        aria-hidden="true"
      />
    </>
  );
  if (!to) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  }
  return (
    <Link className={cls} to={to}>
      {inner}
    </Link>
  );
}

export function EmptyPanel({
  icon: Icon = Inbox,
  title = "Nothing here yet",
  text,
  action,
  tone = ACCENTS.neutral.icon,
}) {
  const art = artworkForLucide(Icon);
  return (
    <div className="px-4 py-10 text-center">
      {art ? (
        <PageArtwork name={art} size={56} className="mx-auto" />
      ) : (
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${tone}`}
          aria-hidden="true"
        >
          <Icon size={24} />
        </div>
      )}
      <p className="mt-4 text-[14.5px] font-bold text-ink">{title}</p>
      {text && (
        <p className="mx-auto mt-1.5 max-w-[36ch] text-[12.5px] leading-relaxed text-slate-text/70">
          {text}
        </p>
      )}
      {action && <div className="mt-3.5 flex justify-center">{action}</div>}
    </div>
  );
}

/* ── Hero banner ───────────────────────────────────────────────────────── */

export function GlassStat({ value, label, tone = "text-white" }) {
  return (
    <div className="rounded-2xl bg-white/12 px-4 py-3 text-center ring-1 ring-inset ring-white/20 backdrop-blur-md">
      <p className={`font-display text-[22px] font-bold leading-none tracking-tight tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/60">
        {label}
      </p>
    </div>
  );
}

export function HeroBanner({
  gradient = "blue",
  eyebrow,
  name,
  title,
  subtitle,
  meta,
  dateLabel,
  image,
  right,
  stats,
  children,
  className = "",
  showGreetingIcon = true,
}) {
  const grad = HERO_GRADIENTS[gradient] || HERO_GRADIENTS.blue;

  return (
    <section
      aria-label="Greeting"
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ring-1 ring-inset ring-white/15 ${grad} ${className}`}
    >
      {image && (
        <img
          src={image}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 h-full w-[52%] object-cover object-[68%_50%] saturate-[1.15] opacity-95 [mask-image:linear-gradient(to_right,transparent,black_55%)] sm:w-[58%] lg:w-[62%]"
        />
      )}
      <span
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full bg-white/10"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute -bottom-24 left-16 h-56 w-56 rounded-full bg-white/5"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute right-10 top-8 h-24 w-24 rounded-2xl bg-white/5 rotate-12"
        aria-hidden="true"
      />

      <div className="relative z-10 flex min-h-[200px] flex-col gap-4 p-6 sm:min-h-[216px] sm:flex-row sm:flex-wrap sm:items-center sm:px-8">
        <div className="min-w-0 max-w-full lg:max-w-[46%]">
          {(eyebrow || name) && (
            <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">
              {showGreetingIcon && <Sun size={15} className="text-amber-300" aria-hidden="true" />}
              {eyebrow}
            </p>
          )}
          {(title || name) && (
            <h1 className="mt-2 font-display text-[30px] font-bold leading-[1.06] tracking-tight text-white sm:text-[42px] lg:text-[46px]">
              {title || name}
            </h1>
          )}
          {subtitle && (
            <p className="mt-2 text-[13.5px] leading-relaxed text-white/85">{subtitle}</p>
          )}
          {meta && <p className="mt-1.5 text-[12.5px] font-medium tracking-wide text-white/70">{meta}</p>}
          {dateLabel && (
            <span className="mt-2.5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-[12.5px] font-medium text-white ring-1 ring-inset ring-white/20">
              <CalendarDays size={14} aria-hidden="true" />
              {dateLabel}
            </span>
          )}
        </div>

        {right && <div className="flex flex-wrap items-start gap-3 sm:ml-auto">{right}</div>}
        {children}
        {/*
          Stats get their own full-width row at the foot of the hero, content
          pushed right. They used to live in `right`, where `sm:ml-auto` put
          them top-right — directly over the banner image, which is absolutely
          positioned across the right 52-62% at full height. Wrapping them to
          their own line drops them clear of the greeting, and `justify-end`
          keeps them on the right where they read as a stat rail. `w-full` is
          what forces the wrap; `mt-auto` pins the row to the bottom when the
          hero is taller than its content.
        */}
        {stats && (
          <div className="flex w-full flex-wrap items-start justify-end gap-3 sm:mt-auto">
            {stats}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Quick actions ─────────────────────────────────────────────────────── */

function actionAccent(item) {
  if (item.accent) return ACCENTS[item.accent] || ACCENTS.primary;
  if (typeof item.tone === "string" && ACCENTS[item.tone]) return ACCENTS[item.tone];
  return ACCENTS.primary;
}

export function QuickActions({ title, icon: TitleIcon, action, items = [] }) {
  const headingId = useId();
  const rail = items.filter((item) => item && item.to && item.icon);
  if (!rail.length) return null;

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2
          id={headingId}
          className="flex items-center gap-2 font-display text-[16px] font-bold tracking-tight text-ink"
        >
          {TitleIcon && <TitleIcon size={18} className="text-info" aria-hidden="true" />}
          {title}
        </h2>
        {action}
      </div>

      {/* One row that fills the available width. `grow` shares leftover space
          equally, `shrink-0` + `basis-auto` keeps each pill at least as wide as
          its label, so a narrow screen scrolls instead of squashing text. */}
      <div
        role="list"
        className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1.5 [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.300)_transparent]"
      >
        {rail.map((item) => {
          const t = actionAccent(item);
          return (
            <Link
              key={item.to}
              to={item.to}
              role="listitem"
              className={`group flex grow shrink-0 basis-auto snap-start items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white py-2.5 px-3 transition-colors duration-200 hover:bg-slate-50 ${t.edge} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${t.tile}`}
                aria-hidden="true"
              >
                <item.icon size={16} strokeWidth={2.1} />
              </span>
              <span className="whitespace-nowrap text-[12.5px] font-semibold leading-none text-ink">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ── Metric cards ──────────────────────────────────────────────────────── */

export function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "primary",
  tone,
  progress,
  bars,
  chart,
  to,
  onClick,
  delay = 0,
}) {
  const t = accentOf(accent, tone);
  const Wrapper = to ? Link : onClick ? "button" : "div";
  const interactive = Boolean(to || onClick);
  const wrapperProps = to
    ? { to }
    : onClick
      ? { type: "button", onClick }
      : {};

  return (
    <Wrapper
      {...wrapperProps}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
      className={`group relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 ${t.edge} ${t.glow} ${
        interactive
          ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40"
          : ""
      }`}
    >
      {/* Decorative texture, right side, behind the content. */}
      <span
        className={`pointer-events-none absolute inset-y-0 right-0 w-[70%] opacity-[0.16] transition-all duration-500 group-hover:opacity-[0.26] ${t.text}`}
        aria-hidden="true"
      >
        <PageArtwork name="waves" className="h-full w-full" />
      </span>

      <div className="relative flex items-start gap-3">
        {Icon ? (
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${t.tile}`}
            aria-hidden="true"
          >
            <Icon size={19} strokeWidth={2.1} />
          </span>
        ) : (
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${t.dot}`} aria-hidden="true" />
        )}

        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-text/70">
            {label}
          </p>
          {interactive && (
            <ChevronRight
              size={15}
              className={`mt-1 shrink-0 text-slate-text/30 transition-all duration-200 group-hover:translate-x-0.5 ${t.text}`}
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      <p className="relative mt-3.5 font-display text-[32px] font-bold leading-none tracking-tight tabular-nums text-ink">
        {value}
      </p>

      {sub && <p className="relative mt-2.5 text-[11.5px] leading-snug text-slate-text/75">{sub}</p>}

      {typeof progress === "number" && (
        <div className="relative mt-4 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${t.bar}`}
            style={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
          />
        </div>
      )}

      {bars && bars.length > 0 && (
        <div className="relative mt-4 flex h-6 items-end gap-1" aria-hidden="true">
          {bars.map((b, i) => (
            <span
              key={`${b.color || t.bar}-${i}`}
              className={`w-2.5 rounded-sm ${b.color || t.bar}`}
              style={{ height: `${b.height}px` }}
            />
          ))}
        </div>
      )}

      {chart && <div className="relative mt-4">{chart}</div>}
    </Wrapper>
  );
}

export function MetricGrid({ children, columns = 4, className = "" }) {
  const cols =
    columns === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : columns === 3
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : columns === 6
          ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
  return <div className={`grid gap-4 ${cols} ${className}`}>{children}</div>;
}

/* ── Panels ────────────────────────────────────────────────────────────── */

export function Panel({
  title,
  subtitle,
  icon: Icon,
  iconTone,
  action,
  children,
  className = "",
  bodyClassName = "px-5 sm:px-6 pb-5 pt-4",
  footer,
  flush = false,
  decor,
  decorTone = ACCENTS.teal.text,
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {/* Optional texture from PageArtwork's vector decorations, tinted by
          decorTone. Sits behind the header and body, clipped by the section. */}
      {decor && (
        <span
          className={`pointer-events-none absolute inset-y-0 right-0 w-[42%] opacity-[0.13] ${decorTone}`}
          aria-hidden="true"
        >
          <PageArtwork name={decor} className="h-full w-full" />
        </span>
      )}
      {(title || action) && (
        <div className="relative flex items-center justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-5">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && <PanelIcon tone={iconTone || ACCENTS.primary.icon}>{<Icon size={15} />}</PanelIcon>}
            <div className="min-w-0">
              <h3 className="truncate font-display text-[15.5px] font-bold tracking-tight text-ink">{title}</h3>
              {subtitle && <p className="mt-0.5 text-[12px] text-slate-text/60">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={`relative ${flush ? "" : bodyClassName}`}>{children}</div>
      {footer && (
        <div className="relative border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:px-6">{footer}</div>
      )}
    </section>
  );
}

export function SectionHeading({ title, icon: Icon, action, sub }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-bold tracking-tight text-ink">
          {Icon && <Icon size={18} className="text-info" aria-hidden="true" />}
          {title}
        </h2>
        {sub && <p className="mt-0.5 text-[12.5px] text-slate-text/60">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/* ── Data visuals ──────────────────────────────────────────────────────── */

export function Donut({
  value,
  size = 112,
  stroke = 11,
  color = "text-success",
  track = "text-slate-100",
  label,
  sublabel,
  className = "",
}) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label || `${pct}%`}
    >
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="currentColor"
          className={track}
          strokeWidth={stroke}
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="currentColor"
          className={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[26px] font-bold leading-none text-ink">
          {label ?? `${pct}%`}
        </span>
        {sublabel && (
          <span className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-text/60">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

export function ProgressBar({ value, accent = "primary", className = "", height = "h-1.5" }) {
  const t = accentOf(accent);
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={`w-full overflow-hidden rounded-full bg-slate-100 ${height} ${className}`}>
      <div
        className={`h-full rounded-full ${t.bar} transition-all duration-500`}
        style={{ width: `${Math.max(2, pct)}%` }}
      />
    </div>
  );
}

export function BarList({ items = [], accent = "primary", showPct = true }) {
  const t = accentOf(accent);
  const max = Math.max(1, ...items.map((i) => Number(i.value) || 0));
  if (!items.length) return null;
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pct = Math.round(((Number(item.value) || 0) / max) * 100);
        return (
          <div key={item.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-[12.5px]">
              <span className="flex min-w-0 items-center gap-2 text-slate-text">
                {item.color && (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: item.color }}
                  />
                )}
                <span className="truncate">{item.label}</span>
              </span>
              <span className="shrink-0 font-bold text-ink">
                {item.display ?? item.value}
                {showPct && item.suffix ? item.suffix : ""}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${item.barClass || t.bar}`}
                style={{
                  width: `${Math.max(2, pct)}%`,
                  ...(item.barColor ? { background: item.barColor } : null),
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StatTile({ label, value, dot, tone = "text-ink", hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300">
      <div className="flex items-center gap-2">
        {dot && <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />}
        <span className="truncate text-[12px] font-medium text-slate-text/80">{label}</span>
      </div>
      <p className={`mt-2 font-display text-[22px] font-bold leading-none ${tone}`}>{value}</p>
      {hint && <p className="mt-1.5 text-[11px] text-slate-text/60">{hint}</p>}
    </div>
  );
}

export function DateTile({ value, tone = "border-blue-100 bg-blue-50 text-blue-700", className = "" }) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return (
    <div className={`w-11 shrink-0 rounded-lg border py-1.5 text-center ${tone} ${className}`} aria-hidden="true">
      <p className="font-display text-[15px] font-bold leading-none">{d.getDate()}</p>
      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide">
        {d.toLocaleDateString("en-IN", { month: "short" })}
      </p>
    </div>
  );
}

export function ListRow({
  icon: Icon,
  iconTone = ACCENTS.primary.icon,
  title,
  meta,
  description,
  trailing,
  to,
  href,
  onClick,
  className = "",
  bodyClassName = "",
}) {
  const inner = (
    <>
      {Icon && (
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconTone}`}
          aria-hidden="true"
        >
          <Icon size={16} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {title && (
          <p className="truncate text-[13.5px] font-bold leading-snug text-ink">{title}</p>
        )}
        {meta && <p className="mt-1 truncate text-[11.5px] text-slate-text/70">{meta}</p>}
        {description && (
          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-slate-text/70">
            {description}
          </p>
        )}
      </div>
      {trailing && <div className="flex shrink-0 flex-col items-end gap-1.5">{trailing}</div>}
    </>
  );

  const cls = `flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-blue-200 hover:bg-blue-50/40 ${className}`;
  const body = bodyClassName || "items-center";

  if (to) {
    return (
      <Link to={to} className={`group/row ${cls} ${body}`}>
        {inner}
        <ChevronRight
          size={15}
          className="mt-1 shrink-0 self-center text-slate-text/30 transition-colors group-hover/row:text-info"
          aria-hidden="true"
        />
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`w-full text-left ${cls} ${body}`}>
        {inner}
      </button>
    );
  }
  return <div className={`${cls} ${body}`}>{inner}</div>;
}

/* ── Segmented control (class/scope switcher) ──────────────────────────── */

export function SegmentedControl({ options = [], value, onChange, ariaLabel = "Options" }) {
  if (options.length < 2) return null;
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all ${
              active
                ? "bg-white text-ink shadow-[0_2px_6px_-2px_rgba(15,23,42,0.25)]"
                : "text-slate-text hover:text-ink"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Horizontal rail with arrows + progress ────────────────────────────── */

export function Rail({ children, ariaLabel, step = 280, className = "" }) {
  const ref = useRef(null);
  const [pct, setPct] = useState(0);
  const [can, setCan] = useState({ left: false, right: true });

  const sync = () => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const overflow = max > 4;
    setPct(overflow ? (el.scrollLeft / max) * 100 : 100);
    setCan({ left: overflow && el.scrollLeft > 4, right: overflow && el.scrollLeft < max - 4 });
  };

  const count = Children.count(children);

  useEffect(() => {
    const frame = requestAnimationFrame(sync);
    window.addEventListener("resize", sync);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", sync);
    };
  }, [count]);

  const scroll = (dir) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      scroll(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      scroll(-1);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div
        role="list"
        aria-label={ariaLabel}
        tabIndex={0}
        ref={ref}
        onScroll={sync}
        onKeyDown={onKeyDown}
        className="scrollbar-thin flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40 rounded-xl"
      >
        {children}
      </div>

      {count > 1 && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 hidden h-full w-10 bg-gradient-to-r from-white to-transparent sm:block"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 hidden h-full w-14 bg-gradient-to-l from-white via-white/80 to-transparent sm:block"
          />
          <button
            type="button"
            onClick={() => scroll(-1)}
            disabled={!can.left}
            aria-label="Scroll left"
            className="absolute -left-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-text shadow-md transition hover:text-info disabled:cursor-not-allowed disabled:opacity-40 sm:flex"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            disabled={!can.right}
            aria-label="Scroll right"
            className="absolute -right-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-info text-white shadow-[0_10px_24px_-10px_rgba(37,99,235,0.9)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex"
          >
            <ChevronRight size={18} />
          </button>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <div
              className="h-full rounded-full bg-info transition-all duration-300"
              style={{ width: `${Math.max(14, pct)}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

/* ── Attention / alert strip ───────────────────────────────────────────── */

export function AlertStrip({ items = [], className = "" }) {
  if (!items.length) return null;
  const styles = {
    alert: "border-rose-200 bg-rose-50/80 text-rose-700",
    warning: "border-amber-200 bg-amber-50/80 text-amber-700",
    info: "border-sky-200 bg-sky-50/80 text-sky-700",
    success: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
  };
  return (
    <div className={`flex flex-wrap gap-2.5 ${className}`}>
      {items.map((item, i) => (
        <div
          key={`${item.label}-${i}`}
          className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[12.5px] font-bold ${
            styles[item.tone] || styles.info
          }`}
        >
          {item.icon ? <item.icon size={14} aria-hidden="true" /> : null}
          {item.label}
        </div>
      ))}
    </div>
  );
}

/* ── Loading skeletons ─────────────────────────────────────────────────── */

export function DashboardSkeleton({ metricCols = 4, className = "" }) {
  return (
    <div className={`space-y-5 ${className}`} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your dashboard…</span>
      <div
        className={`grid gap-4 ${
          metricCols === 6
            ? "grid-cols-2 lg:grid-cols-6"
            : "grid-cols-2 lg:grid-cols-4"
        }`}
      >
        {Array.from({ length: metricCols }).map((_, i) => (
          <Skeleton key={i} className="h-[132px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[300px] rounded-2xl" />
      <Skeleton className="h-[230px] rounded-2xl" />
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-[240px] rounded-2xl lg:col-span-2" />
        <Skeleton className="h-[240px] rounded-2xl" />
      </div>
    </div>
  );
}

export function InlineLoader({ label = "Loading…", className = "" }) {
  return (
    <div className={`flex items-center justify-center gap-2 py-12 text-[13px] text-slate-text/70 ${className}`}>
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-info"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
      {label}
    </div>
  );
}
