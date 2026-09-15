// Shared attendance trend helpers.
//
// Attendance records represent calendar dates (the API stores them as
// midnight-UTC Dates). Timezone-safe grouping therefore reads the calendar
// date components directly instead of converting through UTC, so a record for
// `2026-02-01` always stays in February regardless of the viewer's timezone.

const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const RANGE_OPTIONS = [
  { id: "3m", label: "Last 3 Months" },
  { id: "6m", label: "Last 6 Months" },
  { id: "12m", label: "Last 12 Months" },
  { id: "thisYear", label: "This Academic Year" },
  { id: "custom", label: "Custom Range" },
];

const pad2 = (n) => String(n).padStart(2, "0");

export function dayNumOf({ year, month, day }) {
  return year * 10000 + (month + 1) * 100 + day;
}

function partsFromDayNum(n) {
  return {
    year: Math.floor(n / 10000),
    month: Math.floor((n % 10000) / 100) - 1,
    day: n % 100,
  };
}

/**
 * Extracts calendar date components (year, 0-based month, day) from a record
 * date value. Handles "YYYY-MM-DD" strings and full ISO datetimes by using the
 * calendar date part directly, and falls back to local components for any
 * other Date-like value. Returns null for invalid/missing dates.
 */
export function calendarParts(value) {
  if (value == null || value === "") return null;
  const text = typeof value === "string" ? value.trim() : "";
  if (text) {
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
        return { year, month, day };
      }
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function addDays({ year, month, day }, amount) {
  const date = new Date(year, month, day + amount);
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
}

function mondayOnOrBefore({ year, month, day }) {
  const date = new Date(year, month, day);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
}

function weekKeyOf({ year, month, day }) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function weekKeyToParts(key) {
  const [y, m, d] = key.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

function monthKeyOf(year, month) {
  return `${year}-${pad2(month + 1)}`;
}

function keyToMonth(key) {
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m - 1 };
}

function shortMonth(year, month) {
  const label = MONTHS_FULL[month].slice(0, 3);
  return label;
}

function monthLabel(year, month) {
  return `${MONTHS_FULL[month]} ${year}`;
}

/**
 * Dynamic Y-axis domain derived from the actual data so low attendance is
 * never visually flattened against a fixed 80-100% band.
 */
export function niceYDomain(values) {
  const usable = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (usable.length === 0) return [0, 100];
  const min = Math.min(...usable);
  const max = Math.max(...usable);
  if (min === max) {
    const lo = Math.max(0, Math.floor((min - 2) / 5) * 5);
    const hi = Math.min(100, Math.max(min + 10, Math.ceil((min + 8) / 5) * 5));
    return [lo, hi];
  }
  const pad = Math.max(2, Math.ceil((max - min) * 0.2));
  const lo = Math.max(0, Math.floor((min - pad) / 5) * 5);
  const hi = Math.min(100, Math.ceil((max + pad) / 5) * 5);
  return [lo, Math.max(lo + 5, hi)];
}

/**
 * Builds the attendance trend for a date window.
 *
 * `fromDay`/`toDay` are optional calendar day numbers (see `dayNumOf`).
 * When omitted the whole dataset is used. Months/weeks with no records are
 * included as `missing` points (attendance: null) rather than interpolated.
 */
export function computeAttendanceTrend(
  records,
  { fromDay = null, toDay = null, granularity = "monthly" } = {},
) {
  const list = Array.isArray(records) ? records : [];
  const buckets = new Map();

  list.forEach((record) => {
    const parts = record == null ? null : calendarParts(record.date);
    if (!parts) return;
    const day = dayNumOf(parts);
    if (fromDay != null && day < fromDay) return;
    if (toDay != null && day > toDay) return;
    const key =
      granularity === "weekly"
        ? weekKeyOf(mondayOnOrBefore(parts))
        : monthKeyOf(parts.year, parts.month);
    const bucket = buckets.get(key) || { total: 0, present: 0 };
    bucket.total += 1;
    if (record.status === "Present") bucket.present += 1;
    buckets.set(key, bucket);
  });

  return buildPoints(buckets, { fromDay, toDay, granularity });
}

function buildPoints(buckets, { fromDay, toDay, granularity }) {
  if (granularity === "weekly") return buildWeeklyPoints(buckets, fromDay, toDay);
  return buildMonthlyPoints(buckets, fromDay, toDay);
}

function buildMonthlyPoints(buckets, fromDay, toDay) {
  let start;
  let end;
  if (fromDay != null && toDay != null) {
    start = partsFromDayNum(fromDay);
    end = partsFromDayNum(toDay);
    start = { year: start.year, month: start.month };
    end = { year: end.year, month: end.month };
  } else {
    const keys = [...buckets.keys()].sort();
    if (keys.length === 0) return [];
    const first = keyToMonth(keys[0]);
    const last = keyToMonth(keys[keys.length - 1]);
    start = { year: first.year, month: first.month };
    end = { year: last.year, month: last.month };
  }

  const points = [];
  let year = start.year;
  let month = start.month;
  const multiYear = end.year > start.year;
  while (year < end.year || (year === end.year && month <= end.month)) {
    const bucket = buckets.get(monthKeyOf(year, month));
    if (!bucket) {
      points.push({
        key: monthKeyOf(year, month),
        label: `${shortMonth(year, month)}${multiYear ? ` '${String(year).slice(2)}` : ""}`,
        fullLabel: monthLabel(year, month),
        attendance: null,
        present: 0,
        total: 0,
        absent: 0,
        missing: true,
      });
    } else {
      points.push({
        key: monthKeyOf(year, month),
        label: `${shortMonth(year, month)}${multiYear ? ` '${String(year).slice(2)}` : ""}`,
        fullLabel: monthLabel(year, month),
        attendance: Math.round((bucket.present / bucket.total) * 100),
        present: bucket.present,
        total: bucket.total,
        absent: bucket.total - bucket.present,
        missing: false,
      });
    }
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return points;
}

function buildWeeklyPoints(buckets, fromDay, toDay) {
  let current;
  let done;
  if (fromDay != null && toDay != null) {
    current = mondayOnOrBefore(partsFromDayNum(fromDay));
    done = (parts) => dayNumOf(parts) > toDay;
  } else {
    const keys = [...buckets.keys()].sort();
    if (keys.length === 0) return [];
    current = mondayOnOrBefore(weekKeyToParts(keys[0]));
    const lastKey = keys[keys.length - 1];
    done = (parts) => weekKeyOf(parts) > lastKey;
  }

  const points = [];
  let iterated = 0;
  while (!done(current)) {
    const key = weekKeyOf(current);
    const bucket = buckets.get(key);
    if (bucket) {
      points.push({
        key,
        label: `${current.day} ${shortMonth(current.year, current.month)}`,
        fullLabel: `Week of ${current.day} ${MONTHS_FULL[current.month]} ${current.year}`,
        attendance: Math.round((bucket.present / bucket.total) * 100),
        present: bucket.present,
        total: bucket.total,
        absent: bucket.total - bucket.present,
        missing: false,
      });
    } else {
      points.push({
        key,
        label: `${current.day} ${shortMonth(current.year, current.month)}`,
        fullLabel: `Week of ${current.day} ${MONTHS_FULL[current.month]} ${current.year}`,
        attendance: null,
        present: 0,
        total: 0,
        absent: 0,
        missing: true,
      });
    }
    current = addDays(current, 7);
    iterated += 1;
    if (iterated > 4000) break; // safety net for malformed ranges
  }
  return points;
}

/**
 * Average attendance percentage (mean of the period percentages) for the
 * given window, or null when the window has no data-bearing period.
 */
export function avgFromTrend(
  records,
  { fromDay = null, toDay = null, granularity = "monthly" } = {},
) {
  const points = computeAttendanceTrend(records, { fromDay, toDay, granularity });
  const values = points
    .filter((p) => !p.missing && p.attendance != null)
    .map((p) => p.attendance);
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

/**
 * The window of equal length immediately preceding a given calendar-day
 * window, computed with calendar arithmetic (numeric day-number subtraction
 * can borrow across months and produce invalid dates).
 */
export function prevWindow(fromDay, toDay) {
  if (fromDay == null || toDay == null) return null;
  const from = partsFromDayNum(fromDay);
  const to = partsFromDayNum(toDay);
  const days =
    Math.round(
      (new Date(to.year, to.month, to.day) -
        new Date(from.year, from.month, from.day)) /
        86400000,
    ) + 1;
  if (days <= 0) return null;
  const prevEnd = addDays(from, -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  return { fromDay: dayNumOf(prevStart), toDay: dayNumOf(prevEnd) };
}

/**
 * Resolves a range option into calendar-day boundaries.
 * Returns null when the range cannot be determined (e.g. no academic session
 * configured, or an incomplete custom range).
 */
export function resolveRange(
  rangeId,
  { today = new Date(), sessionStart, sessionEnd, customFrom, customTo } = {},
) {
  if (rangeId === "custom") {
    const fromParts = calendarParts(customFrom);
    const toParts = calendarParts(customTo);
    if (!fromParts || !toParts) return null;
    if (dayNumOf(fromParts) > dayNumOf(toParts)) return null;
    return { fromDay: dayNumOf(fromParts), toDay: dayNumOf(toParts) };
  }
  if (rangeId === "thisYear") {
    const start = calendarParts(sessionStart);
    const end = calendarParts(sessionEnd);
    if (!start || !end) return null;
    return { fromDay: dayNumOf(start), toDay: dayNumOf(end) };
  }
  const offset = { "3m": -2, "6m": -5, "12m": -11 }[rangeId];
  if (offset == null) return null;
  const start = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const endYear = today.getFullYear();
  const endMonth = today.getMonth();
  return {
    fromDay: dayNumOf({ year: start.getFullYear(), month: start.getMonth(), day: 1 }),
    toDay: dayNumOf({
      year: endYear,
      month: endMonth,
      day: daysInMonth(endYear, endMonth),
    }),
  };
}