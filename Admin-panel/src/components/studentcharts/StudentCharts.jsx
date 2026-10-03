// Reusable chart + visual primitives for the student portal.
//
// These are presentation-only: every component takes already-computed data,
// renders nothing when that data is empty, and degrades to an inline empty
// state rather than a blank axis. Gradients and ids are generated per mount so
// several charts can share a page without colliding.

import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisTick, axisTickSm, C, resolveColor, SERIES, useChartTheme } from "./theme";

/** SERIES holds palette keys, not resolved colours, so it themes with the app. */
const seriesColor = (i) => C[SERIES[i % SERIES.length]];

/* ------------------------------------------------------------------ tooltip */

function TooltipCard({ title, rows, footer }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-lg">
      {title ? <p className="text-[12.5px] font-bold text-ink">{title}</p> : null}
      <div className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2 text-[12px]">
            {r.color ? (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: r.color }}
                aria-hidden="true"
              />
            ) : null}
            <span className="text-slate-text">{r.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-ink">{r.value}</span>
          </div>
        ))}
      </div>
      {footer ? <p className="mt-2 border-t border-slate-100 pt-2 text-[11.5px] text-slate-text/70">{footer}</p> : null}
    </div>
  );
}

/* --------------------------------------------------------------- empty slot */

function ChartEmpty({ height, message = "No data to chart yet" }) {
  return (
    <div className="flex items-center justify-center text-center" style={{ height }}>
      <p className="max-w-[30ch] text-[12.5px] leading-relaxed text-slate-text/60">{message}</p>
    </div>
  );
}

/* -------------------------------------------------------------- area trend */

/**
 * Smooth single-series trend with a soft gradient fill. Used for attendance %
 * over time and any other single metric that benefits from showing direction.
 */
export function TrendArea({ data = [], xKey = "label", yKey = "value", height = 220, color = "info", suffix = "%", max = 100, tooltipLabel, footerFor }) {
  useChartTheme();
  color = resolveColor(color);
  const gradientId = useId().replace(/:/g, "");
  if (!data.length) return <ChartEmpty height={height} message="No trend data yet" />;
  return (
    <div style={{ height }} className="min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id={`g-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="88%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.grid} />
          <XAxis
            dataKey={xKey}
            tick={axisTickSm()}
            axisLine={false}
            tickLine={false}
            minTickGap={16}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, max]}
            width={40}
            tick={axisTickSm()}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}${suffix}`}
          />
          <Tooltip
            cursor={{ stroke: color, strokeOpacity: 0.18, strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload;
              return (
                <TooltipCard
                  title={p.fullLabel || p[xKey]}
                  rows={[{ label: tooltipLabel || "Value", value: `${p[yKey]}${suffix}`, color }]}
                  footer={footerFor ? footerFor(p) : null}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey={yKey}
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#g-${gradientId})`}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0, fill: color }}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------------------------------------------------------- bar chart */

/**
 * Horizontal bars — ideal for subject names, which are long. Values are shown
 * as labels at the bar end so no axis digging is needed.
 */
export function BarRowChart({
  data = [],
  xKey = "label",
  yKey = "value",
  height = 260,
  color = "info",
  suffix = "%",
  max = 100,
  colorFor,
  tooltipLabel,
  footerFor,
}) {
  useChartTheme();
  color = resolveColor(color);
  const gradientId = useId().replace(/:/g, "");
  if (!data.length) return <ChartEmpty height={height} message="Nothing to compare yet" />;

  return (
    <div style={{ height }} className="min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 34, left: 6, bottom: 4 }}>
          <defs>
            <linearGradient id={`b-${gradientId}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity={0.95} />
              <stop offset="100%" stopColor={color} stopOpacity={0.65} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={C.grid} />
          <XAxis type="number" domain={[0, max]} hide />
          <YAxis
            type="category"
            dataKey={xKey}
            width={104}
            tick={axisTick()}
            axisLine={false}
            tickLine={false}
            interval={0}
            tickFormatter={(v) => (String(v).length > 13 ? `${String(v).slice(0, 12)}…` : v)}
          />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload;
              const barColor = resolveColor(colorFor ? colorFor(p) : color);
              return (
                <TooltipCard
                  title={p[xKey]}
                  rows={[{ label: tooltipLabel || "Value", value: `${p[yKey]}${suffix}`, color: barColor }]}
                  footer={
                    footerFor ? footerFor(p) : p.maxMarks != null ? `${p.obtained} of ${p.maxMarks} marks` : null
                  }
                />
              );
            }}
          />
          <Bar dataKey={yKey} radius={[0, 7, 7, 0]} maxBarSize={22}>
            {data.map((d, i) => (
              <Cell
                key={d.id ?? `${d[xKey]}-${i}`}
                fill={colorFor ? resolveColor(colorFor(d)) : `url(#b-${gradientId})`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------- donut */

/**
 * Donut with a centred readout and a legend beneath. Falls back to a single
 * muted ring when every slice is zero so it never looks broken.
 */
export function Donut({ data = [], height = 210, centerValue, centerLabel, suffix = "" }) {
  useChartTheme();
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
  if (!total) return <ChartEmpty height={height} message="Nothing recorded yet" />;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ height, width: height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="94%"
              paddingAngle={data.length > 1 ? 2.5 : 0}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {data.map((d, i) => (
                <Cell key={d.name ?? i} fill={resolveColor(d.color) || seriesColor(i)} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0];
                return (
                  <TooltipCard
                    title={p.name}
                    rows={[
                      {
                        label: "Count",
                        value: p.value.toLocaleString("en-IN"),
                        color: p.payload?.fill || p.color,
                      },
                      {
                        label: "Share",
                        value: `${Math.round((p.value / total) * 100)}%`,
                      },
                    ]}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[26px] font-bold leading-none text-ink">
            {centerValue ?? total}
            {suffix}
          </span>
          {centerLabel ? (
            <span className="mt-1 px-3 text-center text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-text/55">
              {centerLabel}
            </span>
          ) : null}
        </div>
      </div>

      <ul className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
        {data.map((d, i) => (
          <li key={d.name ?? i} className="flex items-center gap-1.5 text-[12px]">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: resolveColor(d.color) || seriesColor(i) }}
              aria-hidden="true"
            />
            <span className="text-slate-text">{d.name}</span>
            <span className="font-semibold tabular-nums text-ink">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------- radar */

/** Subject-wise strength. Requires an axis array of at least 3 points. */
export function SubjectRadar({ data = [], dataKey = "value", height = 250, color = "primary", nameKey = "subject", max = 100 }) {
  useChartTheme();
  color = resolveColor(color);
  if (data.length < 3) return <ChartEmpty height={height} message="Need at least three subjects to compare" />;

  return (
    <div style={{ height }} className="min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke={C.grid} />
          <PolarAngleAxis dataKey={nameKey} tick={{ fontSize: 11, fill: C.slate }} />
          <PolarRadiusAxis domain={[0, max]} tick={false} axisLine={false} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload;
              return (
                <TooltipCard
                  title={p[nameKey]}
                  rows={[{ label: "Score", value: `${p[dataKey]}%`, color }]}
                  footer={p.grade ? `Grade ${p.grade}` : null}
                />
              );
            }}
          />
          <Radar dataKey={dataKey} stroke={color} strokeWidth={2} fill={color} fillOpacity={0.18} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------------------------------------------------------- sparkline */

/** Tiny inline trend for stat tiles. No axes, no tooltip — purely decorative. */
export function Sparkline({ data = [], dataKey = "value", color = "info", height = 34, width = "100%" }) {
  useChartTheme();
  color = resolveColor(color);
  const strokeId = useId().replace(/:/g, "");
  if (data.length < 2) return null;

  return (
    <div style={{ height, width }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <defs>
            <linearGradient id={`s-${strokeId}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity={0.55} />
              <stop offset="100%" stopColor={color} stopOpacity={1} />
            </linearGradient>
          </defs>
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={`url(#s-${strokeId})`}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------- progress ring */

/**
 * Radial progress with a soft track, a coloured arc and a centred readout.
 * `label` sits under the number; `tone` picks the arc colour.
 */
export function ProgressRing({
  value = 0,
  max = 100,
  size = 132,
  stroke = 11,
  color = "info",
  label,
  sublabel,
  ariaLabel,
}) {
  useChartTheme();
  color = resolveColor(color);
  const pct = Math.max(0, Math.min(100, max ? (Number(value) / max) * 100 : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const gradientId = useId().replace(/:/g, "");

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel || `${Math.round(pct)} percent`}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`r-${gradientId}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.7} />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#r-${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[27px] font-bold leading-none text-ink">{Math.round(pct)}%</span>
        {label ? <span className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-text/55">{label}</span> : null}
        {sublabel ? <span className="mt-0.5 text-[11px] text-slate-text/70">{sublabel}</span> : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- status dot strip */

/**
 * One pill per day showing status — a compact, colour-blind-safe alternative to
 * a stacked bar for short ranges.
 */
export function StatusStrip({ items = [], emptyText = "No recent records" }) {
  useChartTheme();
  if (!items.length) return <p className="py-6 text-center text-[12.5px] text-slate-text/60">{emptyText}</p>;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <li key={it.id ?? i}>
          <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11.5px] font-medium text-slate-text"
            title={it.title || it.label}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: resolveColor(it.color) }}
              aria-hidden="true"
            />
            {it.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------- monthly buckets */

/** Groups `{date, value, ...}` rows into month buckets for trend charts. */
export function bucketByMonth(rows = [], valueKey = "value") {
  return rows.reduce((acc, r) => {
    const d = new Date(r.date);
    if (Number.isNaN(d.getTime())) return acc;
    const key = d.toLocaleDateString("en-IN", { month: "short" });
    if (!acc[key]) acc[key] = { label: key, total: 0, count: 0 };
    acc[key].total += Number(r[valueKey]) || 0;
    acc[key].count += 1;
    return acc;
  }, {});
}

export function useMonthlySeries(rows = [], valueKey = "value", derive) {
  return useMemo(() => {
    const buckets = bucketByMonth(rows, valueKey);
    return Object.values(buckets)
      .map((b) => (derive ? derive(b) : { label: b.label, value: b.count, count: b.count }))
      .filter(Boolean);
  }, [rows, valueKey, derive]);
}
