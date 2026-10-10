const INDIA_TIME_ZONE = "Asia/Kolkata";
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_PREFIX_RE = /^(\d{4})-(\d{2})-(\d{2})T/i;

function validDateParts(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function indiaDateKey(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function dateKey(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return indiaDateKey(value);
  }

  const valueString = String(value);
  const dateOnlyMatch = DATE_ONLY_RE.exec(valueString);
  const match = dateOnlyMatch || DATE_PREFIX_RE.exec(valueString);
  if (match) {
    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (!validDateParts(year, month, day)) return "";
    if (dateOnlyMatch) return `${yearText}-${monthText}-${dayText}`;

    const parsed = new Date(valueString);
    if (Number.isNaN(parsed.getTime())) return "";
    // A date with an explicit offset is an instant: convert it to the school's
    // timezone. A timezone-free datetime is a local wall time, so keep its date.
    return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(valueString)
      ? indiaDateKey(parsed)
      : `${yearText}-${monthText}-${dayText}`;
  }

  const parsed = new Date(valueString);
  if (Number.isNaN(parsed.getTime())) return "";
  return indiaDateKey(parsed);
}

export function formatHolidayDate(dateString, options = {}) {
  const key = dateKey(dateString);
  if (!key) return dateString ? String(dateString) : "—";

  const match = DATE_ONLY_RE.exec(key);
  if (!match) return "—";
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!validDateParts(year, month, day)) return String(dateString);

  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
    ...options,
  });
}
