// Frontend mirror of the academic-service canonical grading scale
// (services/academic-service/src/utils/grading.js). The backend is the source
// of truth; keep both in sync. Grades/percentages/pass-fail are used for
// client-side display only — the server recomputes and snapshots on entry.

export const GRADE_THRESHOLDS = [
  { grade: "A+", minPct: 90 },
  { grade: "A", minPct: 80 },
  { grade: "B+", minPct: 70 },
  { grade: "B", minPct: 60 },
  { grade: "C", minPct: 50 },
  { grade: "D", minPct: 33 },
  { grade: "F", minPct: 0 },
];

export function computeGrade(obtained, max) {
  if (!max || max <= 0 || obtained == null) return "N/A";
  const pct = (obtained / max) * 100;
  return GRADE_THRESHOLDS.find((t) => pct >= t.minPct).grade;
}

export function computePercentage(obtained, max) {
  if (!max || max <= 0) return 0;
  return (obtained / max) * 100;
}

// passingMarks is the pass-threshold percentage (default 33).
export function computeResult(obtained, max, passingMarks = 33) {
  const pct = computePercentage(obtained, max);
  return { pct, grade: computeGrade(obtained, max), passed: pct >= passingMarks };
}

// Promotion health-check (mirror of the backend util). Accepts either
// { totalSubjects, failedSubjects } or { subjects: [], failedSubjects }.
export function suggestPromotionStatus({ subjects, totalSubjects = 0, failedSubjects = 0 } = {}) {
  const total = Array.isArray(subjects) ? subjects.length : totalSubjects;
  if (total === 0) return "Promoted";
  if (failedSubjects >= 3) return "Detained";
  if (failedSubjects >= 1) return "Promoted with Conditions";
  return "Promoted";
}

export const PROMOTION_STATUSES = [
  "Promoted",
  "Promoted with Conditions",
  "Detained",
  "Transferred",
  "Graduated",
];