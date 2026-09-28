// Frontend mirror of the academic-service grading utilities. The backend is
// the source of truth: it snapshots grade/pct/passed on entry against the
// school's ACTIVE GradingScale. This module keeps a client-side copy of the
// active scale (fetched once at app start via loadActiveGradingScale) so live
// previews (marks entry typing, report fallbacks) match the configured scale.
// Until the scale loads — and whenever the fetch fails — the built-in default
// bands apply, which are byte-identical to the legacy hardcoded rules.

import { api } from "./api";

// Built-in default scale (fallback = legacy behaviour).
export const GRADE_THRESHOLDS = [
  { grade: "A+", minPct: 90 },
  { grade: "A", minPct: 80 },
  { grade: "B+", minPct: 70 },
  { grade: "B", minPct: 60 },
  { grade: "C", minPct: 50 },
  { grade: "D", minPct: 33 },
  { grade: "F", minPct: 0 },
];

const DEFAULT_PASS_PCT = 33;

let activeScale = null;

export function setActiveScale(scale) {
  activeScale =
    scale && Array.isArray(scale.bands) && scale.bands.length ? scale : null;
  return activeScale;
}

export function getActiveScale() {
  return activeScale;
}

// Fetches the school's active scale. Fail-soft: returns null and keeps the
// fallback in place (logged-out users, network errors).
export async function loadActiveGradingScale() {
  try {
    const { data } = await api.gradingScales.active();
    return setActiveScale(data);
  } catch {
    return null;
  }
}

function currentBands() {
  return activeScale && activeScale.bands ? activeScale.bands : GRADE_THRESHOLDS;
}

function currentPassPct() {
  if (activeScale && activeScale.passPct != null) return activeScale.passPct;
  return DEFAULT_PASS_PCT;
}

export function computeGrade(obtained, max) {
  if (!max || max <= 0 || obtained == null) return "N/A";
  const pct = (obtained / max) * 100;
  const bands = currentBands();
  const band = bands.find((t) => pct >= t.minPct) || bands[bands.length - 1];
  return band.grade;
}

export function computePercentage(obtained, max) {
  if (!max || max <= 0) return 0;
  return (obtained / max) * 100;
}

// passingMarks is the pass-threshold percentage; when omitted the active
// scale's passPct applies (legacy default 33).
export function computeResult(obtained, max, passingMarks = null) {
  const pct = computePercentage(obtained, max);
  const passPct = passingMarks == null ? currentPassPct() : passingMarks;
  return { pct, grade: computeGrade(obtained, max), passed: pct >= passPct };
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
