// Student roster lookup for the transport module.
//
// BusRoute.assignedStudents stores admission numbers (that is the refId used by
// student and parent tokens), so rendering a route roster means resolving those
// numbers to names. Students live in student-service, so this goes over the
// existing internal channel — the same INTERNAL_NOTIFY_KEY-guarded path
// academic-service uses for notification rosters.
//
// Rules this helper must not break:
//   * schoolId is always passed, so an admission number from another tenant can
//     never resolve.
//   * It is best-effort: if student-service is unreachable the caller still
//     renders the raw admission numbers instead of failing the request.

const STUDENT_SERVICE_URL = (
  process.env.STUDENT_SERVICE_URL || "http://localhost:5002"
).replace(/\/+$/, "");

const INTERNAL_NOTIFY_KEY = process.env.INTERNAL_NOTIFY_KEY || "";

const TIMEOUT_MS = Number(process.env.ROSTER_TIMEOUT_MS || 5000);
const MAX_IDS = 200;

/**
 * Resolve admission numbers to { admissionNo, name, class, section }.
 * Resolves {} (never throws) when the internal channel is not configured.
 */
async function fetchStudentRoster(schoolId, admissionNos) {
  const ids = [...new Set((admissionNos || []).map(String).map((s) => s.trim()).filter(Boolean))];
  if (!schoolId || ids.length === 0) return {};
  if (!INTERNAL_NOTIFY_KEY || INTERNAL_NOTIFY_KEY.length < 32) return {};

  const query = new URLSearchParams({ schoolId: String(schoolId) });
  query.set("admissionNos", ids.slice(0, MAX_IDS).join(","));

  try {
    const res = await fetch(`${STUDENT_SERVICE_URL}/api/students/internal/by-admission?${query}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "X-Internal-Key": INTERNAL_NOTIFY_KEY, Accept: "application/json" },
    });
    if (!res.ok) return {};
    const body = await res.json();
    const list = Array.isArray(body?.students) ? body.students : [];

    const byAdmissionNo = {};
    for (const s of list) {
      const key = String(s.admissionNo || "").trim();
      if (!key) continue;
      byAdmissionNo[key] = {
        admissionNo: key,
        name: s.name || null,
        class: s.class || null,
        section: s.section || null,
      };
    }
    return byAdmissionNo;
  } catch {
    return {};
  }
}

module.exports = { fetchStudentRoster, STUDENT_SERVICE_URL, INTERNAL_NOTIFY_KEY };