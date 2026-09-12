// Single frontend exit point for the active academic session label.
// Prefers AcademicSession.currentSession.name (the live source of truth) and
// only falls back to the School.session mirror for legacy/platform contexts.
// Handles the three payload shapes in the app:
//  - login/getMe:  school: { ..., session, currentSession }
//  - school/me:    { ...publicSchool, session, currentSession } (flat)
//  - redux wrapper: { user, school: {...}, currentSession } (setSchoolAction(data))
export function sessionLabel(school) {
  if (!school || typeof school !== "object") return null;
  const top = school.currentSession?.name || school.session;
  const inner = school.school
    ? school.school.currentSession?.name || school.school.session
    : null;
  return top || inner || null;
}

export function sessionFallbackYear() {
  return String(new Date().getFullYear());
}

// Read a school-level flag regardless of which payload shape redux holds
// (login-trimmed, school/me flat, or the { user, school } getMe wrapper).
export function schoolFlag(school, key) {
  if (!school || typeof school !== "object") return null;
  if (school[key] !== undefined) return school[key];
  if (school.school && typeof school.school === "object" && school.school[key] !== undefined) {
    return school.school[key];
  }
  return null;
}

// True when a logged-in school admin should be nudged to confirm the academic
// session calendar: a current session exists (usually the onboarding default)
// but the admin has not explicitly saved/created the configuration yet.
export function schoolNeedsConfig(school) {
  return Boolean(sessionLabel(school)) && !schoolFlag(school, "academicConfigConfirmed");
}