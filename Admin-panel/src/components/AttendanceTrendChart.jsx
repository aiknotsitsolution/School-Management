// Reusable school-wide attendance trend chart card. Used on the Attendance,
// Dashboard and Reports pages so every screen derives the trend from the same
// timezone-safe calculation and presents it consistently.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarCheck,
  CalendarRange,
  ChevronDown,
  Layers,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button, Card, Input } from "./UI";
import { api } from "../lib/api";
import {
  RANGE_OPTIONS,
  avgFromTrend,
  computeAttendanceTrend,
  niceYDomain,
  prevWindow,
  resolveRange,
} from "../utils/attendanceTrend";

const GRANULARITY_OPTIONS = [
  { id: "monthly", label: "Monthly" },
  { id: "weekly", label: "Weekly" },
];

const ATT_GREEN = "#3F8F5F";

/**
 * Compact styled dropdown with an icon tile on the left and a chevron on the
 * right. Options render in a floating panel with the active one highlighted.
 */
function ChartSelect({ options = [], value, onChange, icon: Icon, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = options.find((option) => option.id === value);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-[12.5px] font-medium transition-all ${
          open
            ? "border-success ring-4 ring-success/15"
            : "border-black/10 hover:border-black/20"
        }`}
      >
        {Icon && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
            <Icon size={13} strokeWidth={2.25} />
          </span>
        )}
        <span className="flex-1 truncate text-left text-ink">
          {active ? active.label : "Select"}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-text/50 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 top-full z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-black/10 bg-white p-1 shadow-lg shadow-black/5"
          style={{ minWidth: 168 }}
        >
          {options.map((option) => {
            const activeOption = option.id === value;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={activeOption}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] transition-colors ${
                  activeOption
                    ? "bg-success/10 font-semibold text-success"
                    : "text-slate-text hover:bg-paper hover:text-ink"
                }`}
              >
                {option.label}
                {activeOption && (
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TrendTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-black/[0.08] bg-white px-3.5 py-3 shadow-lg shadow-black/5">
      <p className="text-[12.5px] font-semibold text-ink">{point.fullLabel}</p>
      {point.missing ? (
        <p className="mt-1 text-[12px] text-slate-text/60">
          No attendance records for this period.
        </p>
      ) : (
        <div className="mt-2 space-y-1 text-[12px]">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ background: ATT_GREEN }}
            />
            <span className="flex-1 text-slate-text/70">Attendance</span>
            <span className="font-semibold text-ink">{point.attendance}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex-1 text-slate-text/70">Present</span>
            <span className="font-medium text-ink">
              {point.present.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex-1 text-slate-text/70">Absent</span>
            <span className="font-medium text-ink">
              {point.absent.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex items-center gap-2 border-t border-black/[0.05] pt-1">
            <span className="flex-1 text-slate-text/70">Total records</span>
            <span className="font-medium text-ink">
              {point.total.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function TrendSkeleton() {
  const bars = [30, 48, 36, 60, 42, 66, 38, 62];
  return (
    <div
      className="relative h-full w-full animate-pulse overflow-hidden rounded-xl bg-ink/[0.03]"
      role="status"
      aria-label="Loading attendance trend"
    >
      <div className="absolute inset-x-0 bottom-3 flex items-end gap-3 px-4">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-md bg-ink/[0.07]"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function TrendEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 px-6 text-center">
      <CalendarCheck size={30} className="text-slate-text/25" aria-hidden />
      <p className="text-[14px] font-medium text-ink">No attendance data yet</p>
      <p className="max-w-xs text-[12.5px] text-slate-text/60">
        Attendance trends will appear here once attendance records are
        available for the selected period.
      </p>
    </div>
  );
}

function TrendError({ message, onRetry }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <AlertCircle size={28} className="text-alert/70" aria-hidden />
      <p className="text-[14px] font-medium text-ink">
        Unable to load attendance trend
      </p>
      {message && <p className="max-w-xs text-[12.5px] text-slate-text/60">{message}</p>}
      {onRetry && (
        <Button
          variant="outline"
          className="mt-1 px-3 py-1.5 text-[12.5px]"
          onClick={onRetry}
        >
          Try again
        </Button>
      )}
    </div>
  );
}

export default function AttendanceTrendChart({
  records = [],
  loading = false,
  error = "",
  onRetry,
  title = "Attendance Trend",
  subtitle = "School-wide attendance performance",
  defaultRange = "6m",
  defaultGranularity = "monthly",
  height = 240,
  className = "",
}) {
  const [rangeId, setRangeId] = useState(defaultRange);
  const [granularity, setGranularity] = useState(defaultGranularity);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sessionRange, setSessionRange] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.sessions
      .list()
      .then(({ data }) => {
        if (cancelled) return;
        const current = (data || []).find(
          (s) => s.isCurrent || s.status === "active",
        );
        if (current) {
          setSessionRange({ start: current.startDate, end: current.endDate });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const bounds = useMemo(
    () =>
      resolveRange(rangeId, {
        sessionStart: sessionRange?.start,
        sessionEnd: sessionRange?.end,
        customFrom,
        customTo,
      }),
    [rangeId, sessionRange, customFrom, customTo],
  );

  const trend = useMemo(
    () =>
      computeAttendanceTrend(records, {
        fromDay: bounds?.fromDay ?? null,
        toDay: bounds?.toDay ?? null,
        granularity,
      }),
    [records, bounds, granularity],
  );

  const summary = useMemo(() => {
    const avg = avgFromTrend(records, {
      fromDay: bounds?.fromDay ?? null,
      toDay: bounds?.toDay ?? null,
      granularity,
    });
    let delta = null;
    if (avg != null && bounds) {
      const previousBounds = prevWindow(bounds.fromDay, bounds.toDay);
      const previousAvg = avgFromTrend(records, {
        fromDay: previousBounds?.fromDay ?? null,
        toDay: previousBounds?.toDay ?? null,
        granularity,
      });
      if (previousAvg != null) delta = avg - previousAvg;
    }
    return { avg, delta };
  }, [records, bounds, granularity]);

  const yDomain = useMemo(
    () => niceYDomain(trend.map((p) => p.attendance)),
    [trend],
  );

  const tickInterval = trend.length > 8 ? Math.ceil(trend.length / 8) - 1 : 0;
  const hasData = trend.some((p) => !p.missing);

  let charted;
  if (loading) {
    charted = <TrendSkeleton />;
  } else if (error) {
    charted = <TrendError message={error} onRetry={onRetry} />;
  } else if (!hasData) {
    charted = <TrendEmpty />;
  } else {
    charted = (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={trend} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="attendanceTrendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ATT_GREEN} stopOpacity={0.28} />
              <stop offset="100%" stopColor={ATT_GREEN} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEEAE0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11.5, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
            interval={tickInterval}
            minTickGap={14}
          />
          <YAxis
            domain={yDomain}
            allowDecimals={false}
            width={40}
            tick={{ fontSize: 11.5, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            content={<TrendTooltip />}
            cursor={{
              stroke: ATT_GREEN,
              strokeOpacity: 0.18,
              strokeDasharray: "3 3",
            }}
          />
          <Area
            type="monotone"
            dataKey="attendance"
            name="Attendance"
            stroke={ATT_GREEN}
            strokeWidth={2.5}
            fill="url(#attendanceTrendGradient)"
            connectNulls={false}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: ATT_GREEN }}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <Card
      className={className}
      title={
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-ink text-[15px]">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-[12px] text-slate-text/60">{subtitle}</p>
          )}
        </div>
      }
      action={
        <div className="shrink-0 text-right">
          {loading ? (
            <div className="ml-auto h-7 w-20 animate-pulse rounded-lg bg-ink/[0.05]" />
          ) : (
            <>
              <p className="font-display text-[20px] font-bold leading-none text-ink">
                {summary.avg != null ? `${summary.avg}%` : "—"}
              </p>
              <p className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-text/50">
                Average attendance
              </p>
              {summary.delta != null && (
                <p
                  className={`mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold ${
                    summary.delta > 0
                      ? "text-success"
                      : summary.delta < 0
                        ? "text-alert"
                        : "text-slate-text/60"
                  }`}
                >
                  {summary.delta > 0 ? (
                    <TrendingUp size={13} />
                  ) : summary.delta < 0 ? (
                    <TrendingDown size={13} />
                  ) : null}
                  {Math.abs(summary.delta).toFixed(1)}% vs previous
                </p>
              )}
            </>
          )}
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-[150px]">
          <ChartSelect
            options={RANGE_OPTIONS}
            value={rangeId}
            onChange={setRangeId}
            icon={CalendarRange}
            ariaLabel="Date range"
          />
        </div>
        <div className="w-[120px]">
          <ChartSelect
            options={GRANULARITY_OPTIONS}
            value={granularity}
            onChange={setGranularity}
            icon={Layers}
            ariaLabel="View"
          />
        </div>
        {rangeId === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-[145px]">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                aria-label="From date"
                className="px-3 py-2 text-[12.5px]"
              />
            </div>
            <span className="text-[12px] text-slate-text/60">to</span>
            <div className="w-[145px]">
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                aria-label="To date"
                className="px-3 py-2 text-[12.5px]"
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 min-w-0" style={{ height }}>
        {charted}
      </div>
    </Card>
  );
}