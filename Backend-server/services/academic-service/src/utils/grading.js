// ---------------------------------------------------------------------------
// Canonical grading scale. Single source of truth for the academic-service:
// the Marks pre-save hook, API mark entry, report cards, class summaries and
// promotion previews all derive grades/percentages/pass-fail here so the rules
// are never re-implemented per controller.
//
// The scale is preserved from the original implems (A+/A/B+/B/C/D/F by
// percentage) and the pass threshold is a PASS PERCENTAGE (default 33), which
// is how the legacy report card expressed "PASS iff pct >= 33".
// ---------------------------------------------------------------------------

const GRADE_THRESHOLDS = [
  { grade: "A+", minPct: 90 },
  { grade: "A", minPct: 80 },
  { grade: "B+", minPct: 70 },
  { grade: "B", minPct: 60 },
  { grade: "C", minPct: 50 },
  { grade: "D", minPct: 33 },
  { grade: "F", minPct: 0 },
];

function computeGrade(obtained, max) {
  if (!max || max <= 0 || obtained == null) return "N/A";
  const pct = (obtained / max) * 100;
  return GRADE_THRESHOLDS.find((t) => pct >= t.minPct).grade;
}

function computePercentage(obtained, max) {
  if (!max || max <= 0) return 0;
  return (obtained / max) * 100;
}

// passingMarks is the pass-threshold percentage (default 33).
function computeResult(obtained, max, passingMarks = 33) {
  const pct = computePercentage(obtained, max);
  return { pct, grade: computeGrade(obtained, max), passed: pct >= passingMarks };
}

// Promotion health-check. A student with no published marks for the session
// has no evidence to be detained, so the suggestion stays "Promoted".
// Accepts either { totalSubjects, failedSubjects } or the shape returned by
// computeStudentSummary ({ subjects: [], failedSubjects }).
function suggestPromotionStatus({ subjects, totalSubjects = 0, failedSubjects = 0 } = {}) {
  const total = Array.isArray(subjects) ? subjects.length : totalSubjects;
  if (total === 0) return "Promoted";
  if (failedSubjects >= 3) return "Detained";
  if (failedSubjects >= 1) return "Promoted with Conditions";
  return "Promoted";
}

module.exports = {
  GRADE_THRESHOLDS,
  computeGrade,
  computePercentage,
  computeResult,
  suggestPromotionStatus,
};