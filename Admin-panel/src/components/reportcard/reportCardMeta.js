// Shared report-card constants and formatting helpers. Kept out of
// ReportCardSheet.jsx so that file exports exactly one component (fast refresh
// stays intact) while the staff page and the student view share the same rules.
export const ACCENT_RE = /^#[0-9a-fA-F]{6}$/;
export const DEFAULT_ACCENT = "#0C47CF";

// CCE co-scholastic (CLIENT-REQ-027): CBSE default areas + 6-point grade scale.
export const DEFAULT_CCE_AREAS = [
  "Work Education",
  "Art Education",
  "Health & Physical Education",
];

export const CCE_GRADE_OPTIONS = [
  { value: "", label: "—" },
  { value: "A1", label: "A1 · Outstanding" },
  { value: "A2", label: "A2 · Excellent" },
  { value: "B1", label: "B1 · Very Good" },
  { value: "B2", label: "B2 · Good" },
  { value: "C", label: "C · Satisfactory" },
  { value: "D", label: "D · Marginal" },
];

// DOB/date values arrive as ISO timestamps ("2019-07-08T00:00:00.000Z") — the
// card only needs the date, never the time component.
export function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function mergeCceAreas(saved) {
  const rows = Array.isArray(saved) ? saved : [];
  return [
    ...DEFAULT_CCE_AREAS.map((area) => {
      const row = rows.find((r) => r.area === area);
      return { area, grade: row?.grade || "", remark: row?.remark || "" };
    }),
    ...rows.filter((r) => !DEFAULT_CCE_AREAS.includes(r.area)),
  ];
}

export function formatClass(c) {
  if (!c) return "—";
  if (["Nursery", "LKG", "UKG"].includes(c)) return c;
  return `Class ${c}`;
}

export function getRemark(pct) {
  if (pct >= 90) return "Outstanding performance. Keep up the excellent work!";
  if (pct >= 80) return "Very good performance. Continue the hard work.";
  if (pct >= 70)
    return "Good performance. Focus on weaker subjects for better results.";
  if (pct >= 60)
    return "Satisfactory. Needs more regular practice and revision.";
  return "Needs significant improvement. Extra attention and support recommended.";
}

// No photo on file still needs a square on the card — initials keep the layout
// stable instead of leaving a broken image slot.
export function initialsOf(name) {
  return (
    String(name || "?")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?"
  );
}
