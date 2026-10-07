/**
 * Momentum — every value below is derived from real student data:
 * attendance records, homework submissions and published marks.
 * Nothing here is seeded, random or hard-coded per student.
 */

export const ATTENDANCE_XP = 10;
export const SUBMISSION_XP = 15;

export const LEVELS = [
  { level: 1, title: "Explorer", min: 0 },
  { level: 2, title: "Learner", min: 120 },
  { level: 3, title: "Achiever", min: 300 },
  { level: 4, title: "Scholar", min: 550 },
  { level: 5, title: "Topper", min: 900 },
  { level: 6, title: "Legend", min: 1400 },
];

const isPresent = (a) => a?.status === "Present";

function isoOf(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function submissionKey(s) {
  return String(s?.homeworkId ?? s?.homework ?? s?._id ?? "");
}

/** Consecutive present days, newest first. Breaks on the first absent/leave. */
export function attendanceStreak(attendance = []) {
  const rows = [...attendance]
    .filter((a) => isoOf(a?.date))
    .sort((a, b) => isoOf(b.date).localeCompare(isoOf(a.date)));
  let n = 0;
  for (const a of rows) {
    if (isPresent(a)) n += 1;
    else break;
  }
  return n;
}

/**
 * Consecutive submitted assignments, walking newest first. Assignments that
 * are not due yet are ignored so future work never breaks an honest streak.
 */
export function homeworkStreak(homework = [], submissions = []) {
  const done = new Set(submissions.map(submissionKey).filter(Boolean));
  const today = isoOf(new Date());
  const rows = [...homework]
    .filter((h) => {
      const id = String(h?._id ?? "");
      if (!id) return false;
      if (done.has(id)) return true;
      const due = String(h?.dueDate ?? "").slice(0, 10);
      return due ? due <= today : false;
    })
    .sort((a, b) => String(b?.dueDate ?? "").localeCompare(String(a?.dueDate ?? "")));
  let n = 0;
  for (const h of rows) {
    if (done.has(String(h._id))) n += 1;
    else break;
  }
  return n;
}

export function levelFor(xp) {
  const total = Math.max(0, Math.round(Number(xp) || 0));
  let i = 0;
  for (let k = 0; k < LEVELS.length; k += 1) if (total >= LEVELS[k].min) i = k;
  const current = LEVELS[i];
  const next = LEVELS[i + 1] || null;
  const span = next ? next.min - current.min : 1;
  const into = next ? total - current.min : span;
  return {
    level: current.level,
    title: current.title,
    xp: total,
    next,
    nextXp: next ? next.min : null,
    remaining: next ? Math.max(0, next.min - total) : 0,
    progressPct: next ? Math.min(100, Math.round((into / span) * 100)) : 100,
  };
}

export function momentumStats({ attendance = [], homework = [], submissions = [], marks } = {}) {
  const presentDays = attendance.filter(isPresent).length;
  const submittedCount = submissions.length;
  const percentage = Math.max(0, Number(marks?.percentage) || 0);
  const attXp = presentDays * ATTENDANCE_XP;
  const subXp = submittedCount * SUBMISSION_XP;
  const marksXp = Math.round(percentage / 2);
  return {
    attendanceStreak: attendanceStreak(attendance),
    homeworkStreak: homeworkStreak(homework, submissions),
    presentDays,
    submittedCount,
    percentage,
    attXp,
    subXp,
    marksXp,
    ...levelFor(attXp + subXp + marksXp),
    sources: [
      {
        key: "attendance",
        label: "Days present",
        detail: `${presentDays} × ${ATTENDANCE_XP} XP`,
        xp: attXp,
      },
      {
        key: "homework",
        label: "Homework submitted",
        detail: `${submittedCount} × ${SUBMISSION_XP} XP`,
        xp: subXp,
      },
      {
        key: "marks",
        label: "Report card",
        detail: percentage ? `${percentage}% → ${marksXp} XP` : "No marks published yet",
        xp: marksXp,
      },
    ],
  };
}

/** Last 7 calendar days with the real attendance status for each day. */
export function lastSevenDays(attendance = []) {
  const map = new Map();
  attendance.forEach((a) => {
    const key = isoOf(a?.date);
    if (key) map.set(key, a?.status || null);
  });
  const out = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = isoOf(d);
    const status = map.get(key) || null;
    out.push({
      key,
      status,
      label: d.toLocaleDateString("en-IN", { weekday: "narrow" }),
      day: d.getDate(),
      title: `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} · ${status || "No record"}`,
    });
  }
  return out;
}
