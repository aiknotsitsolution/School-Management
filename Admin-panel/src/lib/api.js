import { store } from "../store";
import { logout } from "../store/authSlice";
import { onSocket } from "./socket";
import { refreshAccessToken, scheduleRefresh } from "./tokenRefresh";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "https://school-management-production-e239.up.railway.app/api";

const json = (method, body) => ({ method, body: JSON.stringify(body) });

async function request(path, options = {})
{
  const isFormData = options.body instanceof FormData;
  const { auth } = store.getState();
  const token = auth.accessToken || localStorage.getItem("erp_access_token");
  const user =
    auth.user || JSON.parse(localStorage.getItem("erp_user") || "null");
  const passiveSchoolId =
    auth.activeSchoolId || localStorage.getItem("erp_active_school");

  // Public auth endpoints return 401 for bad credentials / expired reset tokens —
  // never try to refresh for those.
  const PUBLIC_PATHS = [
    "/auth/login",
    "/auth/refresh-token",
    "/auth/forgot-password",
    "/auth/verify-reset-otp",
    "/auth/reset-password",
    "/auth/reset-password-otp",
  ];
  const isPublicPath = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(`${p}?`),
  );

  // super_admin impersonates a school via X-School-Id; everyone else's tenant
  // comes from their JWT.
  const includeSchoolHeader = user?.role === "super_admin" && passiveSchoolId;
  // Campus scope for the whole session. The backend only narrows queries once
  // BRANCH_SCOPE=on; until then the header is accepted and ignored.
  const activeBranchId =
    auth.activeBranchId || localStorage.getItem("erp_active_branch");
  // While impersonating a tenant the server blocks writes unless this header
  // says "write" — see resolveTenant in shared/src/middleware/tenant.js. Absent
  // impersonation the header is not sent at all, so a normal admin or teacher
  // request path is byte-for-byte unchanged.
  const impersonateMode =
    includeSchoolHeader && auth.impersonateReadOnly === false ? "write" : "read";
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(includeSchoolHeader ? { "X-School-Id": passiveSchoolId } : {}),
      ...(includeSchoolHeader ? { "X-Impersonate-Mode": impersonateMode } : {}),
      ...(activeBranchId ? { "X-Branch-Id": activeBranchId } : {}),
      ...options.headers,
    },
  });
  if (response.status === 401 && !options._retry && !isPublicPath)
  {
    // Wait for any in-flight refresh first (doRefresh deduplicates).
    for (let attempt = 0; attempt < 5; attempt++)
    {
      const ok = await refreshAccessToken();
      if (ok) return request(path, { ...options, _retry: true });
      const delay = Math.min(2000 * Math.pow(1.5, attempt), 15_000);
      await new Promise((r) => setTimeout(r, delay));
    }
    store.dispatch(logout());
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false)
  {
    const err = new Error(body.message || "Request failed");
    err.data = body.data || null;
    err.status = response.status;
    if (Array.isArray(body.conflicts)) err.conflicts = body.conflicts;
    throw err;
  }
  return body;
}

export { scheduleRefresh, refreshAccessToken };

export const api = {
  login: (credentials) => request("/auth/login", json("POST", credentials)),
  me: () => request("/auth/me"),
  school: {
    me: () => request("/auth/school/me"),
    update: (payload) => request("/auth/school/me", json("PATCH", payload)),
    paymentGateway: {
      get: () => request("/auth/school/me/payment-gateway"),
      update: (payload) =>
        request("/auth/school/me/payment-gateway", json("PATCH", payload)),
      test: (payload) =>
        request("/auth/school/me/payment-gateway/test", json("POST", payload)),
    },
  },
  changePassword: (payload) =>
    request("/auth/change-password", json("POST", payload)),
  resetPassword: (token, newPassword) =>
    request("/auth/reset-password", json("POST", { token, newPassword })),
  forgotPassword: (email) =>
    request("/auth/forgot-password", json("POST", { email })),
  verifyResetOtp: (email, otp) =>
    request("/auth/verify-reset-otp", json("POST", { email, otp })),
  resetPasswordOtp: (token, newPassword) =>
    request("/auth/reset-password-otp", json("POST", { token, newPassword })),
  users: {
    list: (params = "") =>
      request(`/auth/users${params ? `?${params}` : ""}`),
    create: (user) => request("/auth/users", json("POST", user)),
    update: (id, user) => request(`/auth/users/${id}`, json("PATCH", user)),
    updateStatus: (id, isActive) =>
      request(`/auth/users/${id}/status`, json("PATCH", { isActive })),
    remove: (id) => request(`/auth/users/${id}`, { method: "DELETE" }),
    restore: (id) =>
      request(`/auth/users/${id}/restore`, { method: "POST" }),
    resetPassword: (id) =>
      request(`/auth/users/${id}/reset-password`, { method: "POST" }),
    sendResetOtp: (id) =>
      request(`/auth/users/${id}/send-reset-otp`, { method: "POST" }),
    updateMe: (patch) => request("/auth/me", json("PATCH", patch)),
    uploadPhoto: (file) =>
    {
      const formData = new FormData();
      formData.append("photo", file);
      return request("/auth/upload-photo", { method: "POST", body: formData });
    },
  },
  schools: {
    list: () => request("/auth/schools"),
    create: (school) => request("/auth/schools", json("POST", school)),
  },
  // Campus / branch management. `mine` is the switcher's data source and only
  // returns branches the caller may act in; `quota` drives the "x of y used"
  // hint on the Branches page.
  branches: {
    list: () => request("/branches"),
    mine: () => request("/branches/mine"),
    quota: () => request("/branches/quota"),
    get: (id) => request(`/branches/${id}`),
    create: (branch) => request("/branches", json("POST", branch)),
    update: (id, branch) => request(`/branches/${id}`, json("PATCH", branch)),
    setHeadOffice: (id) =>
      request(`/branches/${id}/head-office`, json("POST", {})),
    remove: (id) => request(`/branches/${id}`, { method: "DELETE" }),
  },
  // Feature-neutral place search, used by the branch form to turn a typed place
  // name into coordinates. Separate from transport.searchPlaces so a school
  // admin can locate a campus without holding a transport permission.
  places: {
    search: (q) => request(`/places/search?q=${encodeURIComponent(q)}`),
    reverse: (lat, lng) =>
      request(`/places/reverse?lat=${lat}&lng=${lng}`),
  },
  sessions: {
    list: () => request("/auth/sessions"),
    get: (id) => request(`/auth/sessions/${id}`),
    current: () => request("/auth/sessions/current"),
    create: (item) => request("/auth/sessions", json("POST", item)),
    update: (id, item) => request(`/auth/sessions/${id}`, json("PATCH", item)),
    activate: (id) =>
      request(`/auth/sessions/${id}/activate`, json("POST", {})),
    end: (id) => request(`/auth/sessions/${id}/end`, json("POST", {})),
    remove: (id) => request(`/auth/sessions/${id}`, { method: "DELETE" }),
  },
  plans: {
    list: (params = "") => request(`/platform/plans${params ? `?${params}` : ""}`),
    get: (id) => request(`/platform/plans/${id}`),
    create: (plan) => request("/platform/plans", json("POST", plan)),
    update: (id, plan) => request(`/platform/plans/${id}`, json("PATCH", plan)),
    remove: (id) => request(`/platform/plans/${id}`, { method: "DELETE" }),
  },
  analytics: {
    summary: (query = "") => request(`/platform/analytics${query ? `?${query}` : ""}`),
  },
  platform: {
    settings: {
      get: () => request("/platform/settings"),
      update: (payload) => request("/platform/settings", { method: "PATCH", body: JSON.stringify(payload) }),
    },
    reports: {
      catalog: () => request("/platform/reports"),
      generate: (type, params = "") => request(`/platform/reports/${type}${params ? `?${params}` : ""}`),
    },
    auditLogs: (params = "") => request(`/platform/audit-logs${params ? `?${params}` : ""}`),
    recordImpersonation: (action, schoolId) =>
      request("/platform/audit/impersonation", json("POST", { action, schoolId })),
    schools: {
      list: (params = "") => request(`/platform/schools${params ? `?${params}` : ""}`),
      get360: (id) => request(`/platform/schools/${id}`),
      update: (id, payload) => request(`/platform/schools/${id}`, json("PATCH", payload)),
      setStatus: (id, status, reason) =>
        request(`/platform/schools/${id}/status`, json("PATCH", { status, reason })),
      softDelete: (id, reason) =>
        request(`/platform/schools/${id}/soft-delete`, json("PATCH", { reason })),
      restore: (id) =>
        request(`/platform/schools/${id}/restore`, json("PATCH", {})),
      hardDelete: (id) =>
        request(`/platform/schools/${id}`, { method: "DELETE" }),
      updateOnboarding: (id, status, notes) =>
        request(`/platform/schools/${id}/onboarding`, json("PATCH", { status, notes })),
      sendWelcomeEmail: (id) =>
        request(`/platform/schools/${id}/welcome-email`, { method: "POST" }),
    },
    referenceData: {
      list: (category) => request(`/platform/reference-data/${category}`),
      add: (category, value) =>
        request(`/platform/reference-data/${category}`, json("POST", { value })),
    },
    users: {
      list: (params = "") => request(`/platform/users${params ? `?${params}` : ""}`),
      get360: (id) => request(`/platform/users/${id}`),
      update: (id, user) => request(`/auth/users/${id}`, json("PATCH", user)),
      setStatus: (id, isActive) =>
        request(`/auth/users/${id}/status`, json("PATCH", { isActive })),
      remove: (id) => request(`/auth/users/${id}`, { method: "DELETE" }),
      hardDelete: (id) => request(`/auth/users/${id}/permanent`, { method: "DELETE" }),
      restore: (id) =>
        request(`/auth/users/${id}/restore`, { method: "POST" }),
    },
  },
  subscriptions: {
    list: (params = "") => request(`/platform/subscriptions${params ? `?${params}` : ""}`),
    get: (id) => request(`/platform/subscriptions/${id}`),
    assign: (schoolId, planId, effectiveDate) =>
      request(
        "/platform/subscriptions",
        json("POST", { schoolId, planId, effectiveDate }),
      ),
    act: (id, action, extra = {}) =>
      request(`/platform/subscriptions/${id}`, json("PATCH", { action, ...extra })),
  },
  billing: {
    invoices: {
      list: (params = "") => request(`/platform/invoices${params ? `?${params}` : ""}`),
      get: (id) => request(`/platform/invoices/${id}`),
      generate: (subscriptionId, period = {}) =>
        request(
          "/platform/invoices/generate",
          json("POST", { subscriptionId, ...period }),
        ),
      updateStatus: (id, status) =>
        request(`/platform/invoices/${id}`, json("PATCH", { status })),
    },
  },
  // School-facing (own tenant only) subscription/plan self-service.
  subscription: {
    me: () => request("/auth/school/me/subscription"),
    scheduled: () => request("/auth/school/me/subscription/scheduled"),
    plans: () => request("/auth/school/me/plans"),
    usage: () => request("/auth/school/me/usage"),
    upgrade: (planId, durationPeriods = 1, switchMode = "immediate") => request("/auth/school/me/upgrade", json("POST", { planId, durationPeriods, switchMode })),
  },
  invoices: {
    list: (params = "") => request(`/auth/school/me/invoices${params ? `?${params}` : ""}`),
    get: (id) => request(`/auth/school/me/invoices/${id}`),
    pdfUrl: (id) => `${API_BASE_URL}/auth/school/me/invoices/${id}/pdf`,
    downloadPdf: async (id) =>
    {
      const { auth } = store.getState();
      const token = auth.accessToken || localStorage.getItem("erp_access_token");
      const response = await fetch(`${API_BASE_URL}/auth/school/me/invoices/${id}/pdf`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!response.ok)
      {
        const body = await response.json().catch(() => ({}));
        const err = new Error(body.message || "Download failed");
        err.status = response.status;
        throw err;
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match ? match[1] : `invoice-${id}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
  },
  students: {
    list: (params = "") => request(`/students${params ? `?${params}` : ""}`),
    get: (id) => request(`/students/${id}`),
    create: (student) => request("/students", json("POST", student)),
    me: () => request("/students/me"),
    counsellorStats: () => request("/students/counsellor/stats"),
    // Student shells (userId null, produced by every confirmed admission)
    // awaiting a Platform User account. Admin-only surface (users:manage).
    pendingRegistrations: (params = "") =>
      request(`/students/pending-registrations${params ? `?${params}` : ""}`),
    completeProfile: (id) =>
      request(`/students/${id}/complete-profile`, { method: "POST" }),
    uploadPhoto: (file) =>
    {
      const formData = new FormData();
      formData.append("photo", file);
      return request("/students/upload-photo", {
        method: "POST",
        body: formData,
      });
    },
    update: (id, student) => request(`/students/${id}`, json("PUT", student)),
    issueIdCard: (id) => request(`/students/${id}/issue-id-card`, { method: "POST" }),
    remove: (id) => request(`/students/${id}`, { method: "DELETE" }),
    // Undo a soft-delete (Phase 2) within the purge retention window.
    restore: (id) => request(`/students/${id}/restore`, { method: "POST" }),
    stats: () => request("/students/stats/summary"),
  },
  admissions: {
    list: (status = "") =>
      request(
        `/admissions${status ? `?status=${encodeURIComponent(status)}` : ""}`,
      ),
    create: (item) => request("/admissions", json("POST", item)),
    update: (id, item) => request(`/admissions/${id}`, json("PUT", item)),
    remove: (id) => request(`/admissions/${id}`, { method: "DELETE" }),
  },
  documents: {
    list: (params = "") => request(`/documents${params ? `?${params}` : ""}`),
    upload: (file, item) =>
    {
      const formData = new FormData();
      formData.append("file", file);
      if (item?.title) formData.append("title", item.title);
      if (item?.category) formData.append("category", item.category);
      if (item?.studentId) formData.append("studentId", item.studentId);
      return request("/documents", { method: "POST", body: formData });
    },
    remove: (id) => request(`/documents/${id}`, { method: "DELETE" }),
  },
  health: {
    get: (studentId) => request(`/health?studentId=${studentId}`),
    upsert: (data) => request("/health", json("PUT", data)),
  },
  achievements: {
    list: (params = "") => request(`/achievements${params ? `?${params}` : ""}`),
    create: (item) => request("/achievements", json("POST", item)),
    update: (id, item) => request(`/achievements/${id}`, json("PUT", item)),
    remove: (id) => request(`/achievements/${id}`, { method: "DELETE" }),
  },
  studyMaterials: {
    list: (params = "") => request(`/study-materials${params ? `?${params}` : ""}`),
    create: (item) => request("/study-materials", json("POST", item)),
    remove: (id) => request(`/study-materials/${id}`, { method: "DELETE" }),
  },
  syllabus: {
    list: (params = "") => request(`/syllabus${params ? `?${params}` : ""}`),
    create: (item) => request("/syllabus", json("POST", item)),
    update: (id, item) => request(`/syllabus/${id}`, json("PATCH", item)),
    remove: (id) => request(`/syllabus/${id}`, { method: "DELETE" }),
  },
  attendance: {
    list: (params = "") => request(`/attendance${params ? `?${params}` : ""}`),
    mark: (records) => request("/attendance/mark", json("POST", { records })),
    report: (params = "") =>
      request(`/attendance/report${params ? `?${params}` : ""}`),
  },
  timetable: {
    list: (params = "") => request(`/timetable${params ? `?${params}` : ""}`),
    save: (item) => request("/timetable", json("POST", item)),
    remove: (id) => request(`/timetable/${id}`, { method: "DELETE" }),
    substitutions: {
      list: (params = "") =>
        request(`/timetable/substitutions${params ? `?${params}` : ""}`),
      create: (payload) =>
        request("/timetable/substitutions", json("POST", payload)),
      setStatus: (id, status) =>
        request(`/timetable/substitutions/${id}/status`, json("PATCH", { status })),
      remove: (id) => request(`/timetable/substitutions/${id}`, { method: "DELETE" }),
    },
  },
  homework: {
    list: (params = "") => request(`/homework${params ? `?${params}` : ""}`),
    // Own assigned work (teacher / staff self-service). The server scopes this
    // to the caller by assignment, so it deliberately carries no permission —
    // non-teaching staff don't hold homework:read.
    mine: (params = "") => request(`/homework/mine${params ? `?${params}` : ""}`),
    // Self-service: assignee may move their own work's status, nothing else.
    updateMyStatus: (id, status) => request(`/homework/${id}/status`, json("PATCH", { status })),
    create: (item) => request("/homework", json("POST", item)),
    update: (id, item) => request(`/homework/${id}`, json("PUT", item)),
    remove: (id) => request(`/homework/${id}`, { method: "DELETE" }),
    submissions: {
      myList: (params = "") =>
        request(`/homework/submissions${params ? `?${params}` : ""}`),
      submit: (homeworkId, { content = "", file = null, attachments = [] } = {}) =>
      {
        const hasContent = typeof content === "string" && content.trim().length > 0;
        const hasFile = typeof File !== "undefined" && file instanceof File;
        if (hasFile)
        {
          const formData = new FormData();
          formData.append("file", file);
          if (hasContent) formData.append("content", content);
          if (attachments.length > 0)
          {
            formData.append("attachments", JSON.stringify(attachments));
          }
          return request(`/homework/submissions/${homeworkId}`, {
            method: "POST",
            body: formData,
          });
        }
        return request(
          `/homework/submissions/${homeworkId}`,
          json("POST", { content, attachments }),
        );
      },
      review: (id, item) =>
        request(`/homework/submissions/review/${id}`, json("PATCH", item)),
      classList: (params = "") =>
        request(`/homework/submissions/class/list${params ? `?${params}` : ""}`),
    },
  },
  exams: {
    list: (params = "") => request(`/exams${params ? `?${params}` : ""}`),
    create: (item) => request("/exams", json("POST", item)),
    update: (id, item) => request(`/exams/${id}`, json("PUT", item)),
    updateStatus: (id, status) =>
      request(`/exams/${id}/status`, json("PATCH", { status })),
    termRollup: (params = "") => request(`/exams/term-rollup${params ? `?${params}` : ""}`),
    remove: (id) => request(`/exams/${id}`, { method: "DELETE" }),
  },
  gradingScales: {
    list: () => request("/grading-scales"),
    active: () => request("/grading-scales/active"),
    create: (item) => request("/grading-scales", json("POST", item)),
    update: (id, item) => request(`/grading-scales/${id}`, json("PATCH", item)),
    activate: (id) => request(`/grading-scales/${id}/activate`, json("POST", {})),
    remove: (id) => request(`/grading-scales/${id}`, { method: "DELETE" }),
  },
  cce: {
    getCoScholastic: (params = "") => request(`/cce/co-scholastic${params ? `?${params}` : ""}`),
    saveCoScholastic: (body) => request("/cce/co-scholastic", json("PUT", body)),
  },
  examMasters: {
    list: (kind) => request(`/exam-masters/${kind}`),
    create: (kind, item) => request(`/exam-masters/${kind}`, json("POST", item)),
    update: (kind, id, item) =>
      request(`/exam-masters/${kind}/${id}`, json("PATCH", item)),
    deactivate: (kind, id) =>
      request(`/exam-masters/${kind}/${id}/deactivate`, { method: "PATCH", body: JSON.stringify({ active: false }) }),
    restore: (kind, id) =>
      request(`/exam-masters/${kind}/${id}/restore`, { method: "PATCH", body: JSON.stringify({}) }),
    validate: (item) =>
      request("/exam-masters/validate-refs", json("POST", item)),
  },
  marks: {
    enter: (item) => request("/marks", json("POST", item)),
    list: (params = "") => request(`/marks${params ? `?${params}` : ""}`),
    reportCard: (params = "") =>
      request(`/marks/report-card${params ? `?${params}` : ""}`),
    downloadReportCardPdf: async (params = "") => {
      const { auth } = store.getState();
      const token = auth.accessToken || localStorage.getItem("erp_access_token");
      const response = await fetch(
        `${API_BASE_URL}/marks/report-card/pdf${params ? `?${params}` : ""}`,
        { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const err = new Error(body.message || "Download failed");
        err.status = response.status;
        throw err;
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match ? match[1] : "report-card.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    classSummary: (params = "") =>
      request(`/marks/class-summary${params ? `?${params}` : ""}`),
  },
  promotions: {
    preview: (params = "") =>
      request(`/promotions/preview${params ? `?${params}` : ""}`),
    history: (params = "") =>
      request(`/promotions/history${params ? `?${params}` : ""}`),
    commit: (item) => request("/promotions", json("POST", item)),
  },
  transfers: {
    create: (item) => request("/transfers", json("POST", item)),
    history: (params = "") =>
      request(`/transfers/history${params ? `?${params}` : ""}`),
    // Transfer Certificates (Phase 2) — served under /students so they share
    // the student-service prefix.
    tcs: {
      list: (params = "") =>
        request(`/students/transfer-certificates${params ? `?${params}` : ""}`),
      issue: (item) => request("/students/transfer-certificates", json("POST", item)),
      downloadPdf: async (id) =>
      {
        const { auth } = store.getState();
        const token = auth.accessToken || localStorage.getItem("erp_access_token");
        const response = await fetch(`${API_BASE_URL}/students/transfer-certificates/${id}/pdf`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (!response.ok)
        {
          const body = await response.json().catch(() => ({}));
          const err = new Error(body.message || "Download failed");
          err.status = response.status;
          throw err;
        }
        const blob = await response.blob();
        const disposition = response.headers.get("Content-Disposition") || "";
        const match = disposition.match(/filename="?([^";]+)"?/i);
        const filename = match ? match[1] : `transfer-certificate-${id}.pdf`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      },
    },
  },
  rollover: {
    prepare: (item) => request("/rollover/prepare", json("POST", item)),
  },
  fees: {
    structures: {
      list: (params = "") => request(`/fees/structure${params ? `?${params}` : ""}`),
      create: (item) => request("/fees/structure", json("POST", item)),
      update: (id, item) => request(`/fees/structure/${id}`, json("PUT", item)),
      toggleActive: (id, active) =>
        request(`/fees/structure/${id}`, json("PATCH", { active })),
      remove: (id) => request(`/fees/structure/${id}`, { method: "DELETE" }),
    },
    // Admission-time fee package: yearly plan per student + the one-place
    // summary (package vs invoiced vs collected vs balance) everyone renders.
    plans: {
      list: (params = "") => request(`/fees/plans${params ? `?${params}` : ""}`),
      get: (id) => request(`/fees/plans/${id}`),
      create: (item) => request("/fees/plans", json("POST", item)),
      update: (id, item) => request(`/fees/plans/${id}`, json("PUT", item)),
      // Idempotent "build from the class fee structure" (onboarding + admin).
      ensure: (item) => request("/fees/plans/ensure", json("POST", item)),
      summary: (studentId, session = "") =>
        request(
          `/fees/plans/summary/${encodeURIComponent(studentId)}${session ? `?session=${encodeURIComponent(session)}` : ""}`,
        ),
    },
    invoices: {
      list: (params = "") => request(`/fees${params ? `?${params}` : ""}`),
      create: (item) => request("/fees", json("POST", item)),
      generatePreview: (item) =>
        request("/fees/generate/preview", json("POST", item)),
      generateConfirm: (item) =>
        request("/fees/generate/confirm", json("POST", item)),
      pdfUrl: (id) => `${API_BASE_URL}/fees/${id}/pdf`,
      downloadPdf: async (id) =>
      {
        const { auth } = store.getState();
        const token = auth.accessToken || localStorage.getItem("erp_access_token");
        const response = await fetch(`${API_BASE_URL}/fees/${id}/pdf`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (!response.ok)
        {
          const body = await response.json().catch(() => ({}));
          const err = new Error(body.message || "Download failed");
          err.status = response.status;
          throw err;
        }
        const blob = await response.blob();
        const disposition = response.headers.get("Content-Disposition") || "";
        const match = disposition.match(/filename="?([^";]+)"?/i);
        const filename = match ? match[1] : `fee-invoice-${id}.pdf`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      },
    },
    payments: {
      list: (params = "") => request(`/payments${params ? `?${params}` : ""}`),
      create: (item) => request("/payments", json("POST", item)),
      receipt: (receiptNo) =>
        request(`/payments/receipt/${encodeURIComponent(receiptNo)}`),
      downloadReceiptPdf: async (receiptNo) =>
      {
        const { auth } = store.getState();
        const token = auth.accessToken || localStorage.getItem("erp_access_token");
        const response = await fetch(
          `${API_BASE_URL}/payments/receipt/${encodeURIComponent(receiptNo)}/pdf`,
          { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } },
        );
        if (!response.ok)
        {
          const body = await response.json().catch(() => ({}));
          const err = new Error(body.message || "Download failed");
          err.status = response.status;
          throw err;
        }
        const blob = await response.blob();
        const disposition = response.headers.get("Content-Disposition") || "";
        const match = disposition.match(/filename="?([^";]+)"?/i);
        const filename = match ? match[1] : `receipt-${receiptNo}.pdf`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      },
      setClearance: (id, payload) =>
        request(`/payments/${id}/clearance`, json("POST", payload)),
    },
    reports: {
      get: (params = "") =>
        request(`/payments/reports${params ? `?${params}` : ""}`),
      reconciliation: (params = "") =>
        request(`/payments/reconciliation${params ? `?${params}` : ""}`),
    },
    concessions: {
      list: (params = "") =>
        request(`/fees/concessions${params ? `?${params}` : ""}`),
      create: (item) => request("/fees/concessions", json("POST", item)),
      approve: (id) => request(`/fees/concessions/${id}/approve`, { method: "PATCH" }),
      reject: (id, reason) =>
        request(`/fees/concessions/${id}/reject`, json("PATCH", { reason })),
      remove: (id) => request(`/fees/concessions/${id}`, { method: "DELETE" }),
    },
    orders: {
      list: (params = "") => request(`/payments/orders${params ? `?${params}` : ""}`),
      create: (item) => request("/payments/orders", json("POST", item)),
      initiate: (id) => request(`/payments/orders/${id}/initiate`, { method: "POST" }),
      confirm: (id, payload) => request(`/payments/orders/${id}/confirm`, json("POST", payload)),
      manualConfirm: (id, payload) => request(`/payments/orders/${id}/manual-confirm`, json("POST", payload)),
      cancel: (id) => request(`/payments/orders/${id}/cancel`, { method: "PATCH" }),
    },
  },
  notices: {
    list: () => request("/notices"),
    create: (item) => request("/notices", json("POST", item)),
    update: (id, item) => request(`/notices/${id}`, json("PUT", item)),
    remove: (id) => request(`/notices/${id}`, { method: "DELETE" }),
  },
  diary: {
    list: (params = "") => request(`/diary${params ? `?${params}` : ""}`),
    create: (item) => request("/diary", json("POST", item)),
    update: (id, item) => request(`/diary/${id}`, json("PUT", item)),
    remove: (id) => request(`/diary/${id}`, { method: "DELETE" }),
  },
  messages: {
    list: (params = "") => request(`/messages${params ? `?${params}` : ""}`),
    create: (item) => request("/messages", json("POST", item)),
    get: (id) => request(`/messages/${id}`),
    reply: (id, body) => request(`/messages/${id}/reply`, json("POST", { body })),
  },
  broadcast: {
    sms: (item) => request("/broadcast/sms", json("POST", item)),
    email: (item) => request("/broadcast/email", json("POST", item)),
    logs: (params = "") =>
      request(`/broadcast/logs${params ? `?${params}` : ""}`),
  },
  notifications: {
    list: (params = "") =>
      request(`/notifications${params ? `?${params}` : ""}`),
    unreadCount: () => request("/notifications/unread-count"),
    markRead: (id) => request(`/notifications/${id}/read`, json("PATCH", {})),
    markAllRead: () => request("/notifications/read-all", json("PATCH", {})),
    // Realtime delivery moved to Socket.IO (lib/socket.js). The SSE endpoint is
    // still mounted on the service for older clients, so this is a socket
    // subscription rather than an EventSource.
    subscribe: (handlers) => onSocket("notification:new", (payload) => handlers.onData?.(payload)),
  },
  attendanceStream: {
    // Socket.IO transport. The server namespaces the broadcast event
    // "attendance.updated" as "attendance:updated" on the wire.
    subscribe: (handlers) => onSocket("attendance:updated", (payload) => handlers.onData?.(payload)),
  },
  conversations: {
    list: (params = "") => request(`/conversations${params ? `?${params}` : ""}`),
    people: (q, params = "") =>
      request(`/conversations/people?q=${encodeURIComponent(q)}${params ? `&${params}` : ""}`),
    open: (item) => request("/conversations", json("POST", item)),
    get: (id) => request(`/conversations/${id}`),
    reply: (id, body) => request(`/conversations/${id}/reply`, json("POST", { body })),
  },
  events: {
    list: () => request("/events"),
    create: (item) => request("/events", json("POST", item)),
    update: (id, item) => request(`/events/${id}`, json("PUT", item)),
    remove: (id) => request(`/events/${id}`, { method: "DELETE" }),
    uploadImage: (file) =>
    {
      const formData = new FormData();
      formData.append("image", file);
      return request("/events/upload-image", {
        method: "POST",
        body: formData,
      });
    },
  },
  staff: {
    list: (params = "") => request(`/staff${params ? `?${params}` : ""}`),
    get: (id) => request(`/staff/${id}`),
    create: (item) => request("/staff", json("POST", item)),
    update: (id, item) => request(`/staff/${id}`, json("PUT", item)),
    remove: (id) => request(`/staff/${id}`, { method: "DELETE" }),
    // Own person record for a Staff/Teacher/Class Teacher account (refId scoped).
    me: () => request("/staff/me"),
    uploadPhoto: (file) =>
    {
      const formData = new FormData();
      formData.append("photo", file);
      return request("/staff/upload-photo", { method: "POST", body: formData });
    },
    // Staff records (userId null) awaiting a Platform User account. Admin-only
    // surface (users:manage). ?role= filters Teachers (default) / Staff later.
    pendingRegistrations: (params = "") =>
      request(`/staff/pending-registrations${params ? `?${params}` : ""}`),
    // Shared Complete Profile / Person flow (self-service fields only).
    completeProfile: (id, patch) =>
      request(`/staff/${id}/complete-profile`, json("PUT", patch)),
    issueIdCard: (id) =>
      request(`/staff/${id}/issue-id-card`, { method: "POST" }),
    attendance: {
      list: (params = "") =>
        request(`/staff/attendance${params ? `?${params}` : ""}`),
      mark: (item) => request("/staff/attendance", json("POST", item)),
      meToday: () => request("/staff/attendance/me/today"),
      today: (params = "") =>
        request(`/staff/attendance/today${params ? `?${params}` : ""}`),
      monthly: (params = "") =>
        request(`/staff/attendance/monthly${params ? `?${params}` : ""}`),
      correct: (id, data) =>
        request(`/staff/attendance/${id}/correct`, json("PATCH", data)),
    },
  },
  assignments: {
    me: () => request("/assignments/me"),
    list: (params = "") =>
      request(`/assignments${params ? `?${params}` : ""}`),
    create: (item) => request("/assignments", json("POST", item)),
    update: (id, item) => request(`/assignments/${id}`, json("PATCH", item)),
    end: (id) => request(`/assignments/${id}/end`, json("POST", {})),
    remove: (id) => request(`/assignments/${id}`, { method: "DELETE" }),
  },
  leaves: {
    list: () => request("/leaves"),
    create: (item) => request("/leaves", json("POST", item)),
    balance: () => request("/leaves/balance"),
    updateStatus: (id, status) =>
      request(`/leaves/${id}/status`, json("PATCH", { status })),
  },
  payroll: {
    list: () => request("/payroll"),
    create: (item) => request("/payroll", json("POST", item)),
    update: (id, data) => request(`/payroll/${id}`, json("PATCH", data)),
    generateAll: (month, year, opts) =>
      request("/payroll/generate-all", json("POST", { month, year, adjustForAttendance: !!opts?.adjustForAttendance })),
    markPaid: (id) => request(`/payroll/${id}/pay`, json("PATCH", {})),
  },
  books: {
    list: () => request("/library/books"),
    create: (item) => request("/library/books", json("POST", item)),
    update: (id, item) => request(`/library/books/${id}`, json("PUT", item)),
    remove: (id) => request(`/library/books/${id}`, { method: "DELETE" }),
  },
  issues: {
    list: () => request("/library/issues"),
    issue: (item) => request("/library/issues/issue", json("POST", item)),
    return: (id) => request(`/library/issues/${id}/return`, json("PATCH", {})),
    sendOverdueNotifications: () =>
      request("/library/issues/send-overdue-notifications", { method: "POST" }),
  },
  hostel: {
    list: () => request("/hostel"),
    create: (item) => request("/hostel", json("POST", item)),
    allot: (id, item) => request(`/hostel/${id}/allot`, json("PATCH", item)),
    vacate: (id, studentId) =>
      request(`/hostel/${id}/vacate`, json("PATCH", { studentId })),
    remove: (id) => request(`/hostel/${id}`, { method: "DELETE" }),
  },
  transport: {
    list: (params = "") =>
      request(`/transport${params ? `?${params}` : ""}`),
    create: (item) => request("/transport", json("POST", item)),
    update: (id, item) => request(`/transport/${id}`, json("PATCH", item)),
    updateLocation: (id, item) =>
      request(`/transport/${id}/location`, json("PATCH", item)),
    assign: (id, item) =>
      request(`/transport/${id}/assign`, json("PATCH", item)),
    unassign: (id, item) =>
      request(`/transport/${id}/unassign`, json("PATCH", item)),
    // The signed-in student's own route (a parent's linked children). Scoped
    // server-side from the token, so this never returns the whole fleet.
    mine: () => request("/transport/me"),
    // Place search for the route planner. Proxied through the backend so the
    // geocoder credentials and rate policy stay server-side.
    searchPlaces: (q) =>
      request(`/transport/places/search?q=${encodeURIComponent(q)}`),
    reversePlace: (lat, lng) =>
      request(`/transport/places/reverse?lat=${lat}&lng=${lng}`),
    trackingStatus: () => request("/transport/tracking/status"),
    // Devices the provider account knows about, for the binding picker. Staff
    // only — the provider credential stays on the server.
    devices: () => request("/transport/devices"),
    // Pass no id to preview a route that has not been created yet; with an id
    // the plan is also checked against that route's stored stops.
    previewPlan: (id, stops) =>
      request(
        id ? `/transport/${id}/plan/preview` : "/transport/plan/preview",
        json("POST", { stops }),
      ),
    bindDevice: (id, item) =>
      request(`/transport/${id}/bind-device`, json("POST", item)),
    unbindDevice: (id) =>
      request(`/transport/${id}/bind-device`, { method: "DELETE" }),
    sync: (id) => request(`/transport/${id}/sync`, json("POST", {})),
    history: (id, params = "") =>
      request(`/transport/${id}/history${params ? `?${params}` : ""}`),
  },
  inventory: {
    list: () => request("/inventory"),
    create: (item) => request("/inventory", json("POST", item)),
    update: (id, item) => request(`/inventory/${id}`, json("PUT", item)),
    remove: (id) => request(`/inventory/${id}`, { method: "DELETE" }),
  },
  accounting: {
    accounts: {
      list: (params = "") => request(`/accounting/accounts${params ? `?${params}` : ""}`),
      create: (item) => request("/accounting/accounts", json("POST", item)),
      update: (id, item) => request(`/accounting/accounts/${id}`, json("PATCH", item)),
      remove: (id) => request(`/accounting/accounts/${id}`, { method: "DELETE" }),
    },
    journal: {
      list: (params = "") => request(`/accounting/journal${params ? `?${params}` : ""}`),
      create: (entry) => request("/accounting/journal", json("POST", entry)),
      remove: (id) => request(`/accounting/journal/${id}`, { method: "DELETE" }),
    },
    reports: {
      trialBalance: (params = "") =>
        request(`/accounting/reports/trial-balance${params ? `?${params}` : ""}`),
      incomeExpense: (params = "") =>
        request(`/accounting/reports/income-expense${params ? `?${params}` : ""}`),
      balanceSheet: (params = "") =>
        request(`/accounting/reports/balance-sheet${params ? `?${params}` : ""}`),
    },
  },
};
