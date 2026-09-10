import { store } from "../store";
import { setTokens, logout } from "../store/authSlice";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const json = (method, body) => ({ method, body: JSON.stringify(body) });

// SSE subscriber built on fetch + ReadableStream so the Authorization header is
// sent (EventSource cannot set headers). Auto-reconnects on error/timeout.
function sseSubscribe(path, { onData, onStatus, delay = 3000 } = {}) {
  const controller = new AbortController();
  let running = true;
  let timer = null;

  const connect = async () => {
    if (controller.signal.aborted) return;
    try {
      const { auth } = store.getState();
      const token = auth.accessToken || localStorage.getItem("erp_access_token");
      const user =
        auth.user || JSON.parse(localStorage.getItem("erp_user") || "null");
      const passiveSchoolId =
        auth.activeSchoolId || localStorage.getItem("erp_active_school");
      const includeSchoolHeader = user?.role === "super_admin" && passiveSchoolId;
      const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(includeSchoolHeader ? { "X-School-Id": passiveSchoolId } : {}),
        },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`SSE ${response.status}`);
      onStatus?.("connected");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const dataLine = block
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (dataLine) {
            try {
              onData?.(JSON.parse(dataLine.slice(6)));
            } catch {
              /* ignore malformed frame */
            }
          }
        }
      }
      onStatus?.("reconnecting");
      if (running) timer = setTimeout(connect, delay);
    } catch (err) {
      if (controller.signal.aborted) return;
      onStatus?.("reconnecting");
      if (running) timer = setTimeout(connect, delay);
    }
  };

  connect();
  return () => {
    running = false;
    if (timer) clearTimeout(timer);
    controller.abort();
  };
}

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const { auth } = store.getState();
  const token = auth.accessToken || localStorage.getItem("erp_access_token");
  const user =
    auth.user || JSON.parse(localStorage.getItem("erp_user") || "null");
  const passiveSchoolId =
    auth.activeSchoolId || localStorage.getItem("erp_active_school");

  // super_admin impersonates a school via X-School-Id; everyone else's tenant
  // comes from their JWT.
  const includeSchoolHeader = user?.role === "super_admin" && passiveSchoolId;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(includeSchoolHeader ? { "X-School-Id": passiveSchoolId } : {}),
      ...options.headers,
    },
  });
  if (response.status === 401 && !options._retry) {
    const refreshToken =
      (auth &&
        (auth.refreshToken || localStorage.getItem("erp_refresh_token"))) ||
      localStorage.getItem("erp_refresh_token");
    if (refreshToken) {
      const refreshResponse = await fetch(
        `${API_BASE_URL}/auth/refresh-token`,
        json("POST", { refreshToken }),
      );
      const refreshBody = await refreshResponse.json().catch(() => ({}));
      if (refreshResponse.ok && refreshBody.data?.accessToken) {
        store.dispatch(
          setTokens({
            accessToken: refreshBody.data.accessToken,
            refreshToken: refreshBody.data.refreshToken,
          }),
        );
        return request(path, { ...options, _retry: true });
      }
    }
    store.dispatch(logout());
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const err = new Error(body.message || "Request failed");
    err.data = body.data || null;
    err.status = response.status;
    throw err;
  }
  return body;
}

export const api = {
  login: (credentials) => request("/auth/login", json("POST", credentials)),
  me: () => request("/auth/me"),
  school: {
    me: () => request("/auth/school/me"),
    update: (payload) => request("/auth/school/me", json("PATCH", payload)),
  },
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
    uploadPhoto: (file) => {
      const formData = new FormData();
      formData.append("photo", file);
      return request("/auth/upload-photo", { method: "POST", body: formData });
    },
  },
  schools: {
    list: () => request("/auth/schools"),
    create: (school) => request("/auth/schools", json("POST", school)),
  },
  sessions: {
    list: () => request("/auth/sessions"),
    get: (id) => request(`/auth/sessions/${id}`),
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
    summary: () => request("/platform/analytics"),
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
    schools: {
      list: (params = "") => request(`/platform/schools${params ? `?${params}` : ""}`),
      get360: (id) => request(`/platform/schools/${id}`),
      setStatus: (id, status, reason) =>
        request(`/platform/schools/${id}/status`, json("PATCH", { status, reason })),
      updateOnboarding: (id, status, notes) =>
        request(`/platform/schools/${id}/onboarding`, json("PATCH", { status, notes })),
    },
    users: {
      list: (params = "") => request(`/platform/users${params ? `?${params}` : ""}`),
      get360: (id) => request(`/platform/users/${id}`),
      update: (id, user) => request(`/auth/users/${id}`, json("PATCH", user)),
      setStatus: (id, isActive) =>
        request(`/auth/users/${id}/status`, json("PATCH", { isActive })),
      remove: (id) => request(`/auth/users/${id}`, { method: "DELETE" }),
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
    uploadPhoto: (file) => {
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
    upload: (file, item) => {
      const formData = new FormData();
      formData.append("file", file);
      if (item?.title) formData.append("title", item.title);
      if (item?.category) formData.append("category", item.category);
      if (item?.studentId) formData.append("studentId", item.studentId);
      return request("/documents", { method: "POST", body: formData });
    },
    remove: (id) => request(`/documents/${id}`, { method: "DELETE" }),
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
  },
  homework: {
    list: (params = "") => request(`/homework${params ? `?${params}` : ""}`),
    create: (item) => request("/homework", json("POST", item)),
    update: (id, item) => request(`/homework/${id}`, json("PUT", item)),
    remove: (id) => request(`/homework/${id}`, { method: "DELETE" }),
    submissions: {
      myList: (params = "") =>
        request(`/homework/submissions${params ? `?${params}` : ""}`),
      submit: (homeworkId, { content = "", file = null, attachments = [] } = {}) => {
        const hasContent = typeof content === "string" && content.trim().length > 0;
        const hasFile = typeof File !== "undefined" && file instanceof File;
        if (hasFile) {
          const formData = new FormData();
          formData.append("file", file);
          if (hasContent) formData.append("content", content);
          if (attachments.length > 0) {
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
    remove: (id) => request(`/exams/${id}`, { method: "DELETE" }),
  },
  examMasters: {
    list: (kind) => request(`/exam-masters/${kind}`),
    create: (kind, item) => request(`/exam-masters/${kind}`, json("POST", item)),
    deactivate: (kind, id) =>
      request(`/exam-masters/${kind}/${id}/deactivate`, { method: "PATCH", body: JSON.stringify({ active: false }) }),
    validate: (item) =>
      request("/exam-masters/validate-refs", json("POST", item)),
  },
  marks: {
    enter: (item) => request("/marks", json("POST", item)),
    list: (params = "") => request(`/marks${params ? `?${params}` : ""}`),
    reportCard: (params = "") =>
      request(`/marks/report-card${params ? `?${params}` : ""}`),
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
    invoices: {
      list: (params = "") => request(`/fees${params ? `?${params}` : ""}`),
      create: (item) => request("/fees", json("POST", item)),
      generatePreview: (item) =>
        request("/fees/generate/preview", json("POST", item)),
      generateConfirm: (item) =>
        request("/fees/generate/confirm", json("POST", item)),
    },
    payments: {
      list: (params = "") => request(`/payments${params ? `?${params}` : ""}`),
      create: (item) => request("/payments", json("POST", item)),
      receipt: (receiptNo) =>
        request(`/payments/receipt/${encodeURIComponent(receiptNo)}`),
    },
    reports: {
      get: (params = "") =>
        request(`/payments/reports${params ? `?${params}` : ""}`),
    },
    orders: {
      list: (params = "") => request(`/payments/orders${params ? `?${params}` : ""}`),
      create: (item) => request("/payments/orders", json("POST", item)),
      initiate: (id) => request(`/payments/orders/${id}/initiate`, { method: "POST" }),
      cancel: (id) => request(`/payments/orders/${id}/cancel`, { method: "PATCH" }),
    },
  },
  notices: {
    list: () => request("/notices"),
    create: (item) => request("/notices", json("POST", item)),
    remove: (id) => request(`/notices/${id}`, { method: "DELETE" }),
  },
  notifications: {
    list: (params = "") =>
      request(`/notifications${params ? `?${params}` : ""}`),
    unreadCount: () => request("/notifications/unread-count"),
    markRead: (id) => request(`/notifications/${id}/read`, json("PATCH", {})),
    markAllRead: () => request("/notifications/read-all", json("PATCH", {})),
    subscribe: (handlers) => sseSubscribe("/notifications/stream", handlers),
  },
events: {
      list: () => request("/events"),
      create: (item) => request("/events", json("POST", item)),
      update: (id, item) => request(`/events/${id}`, json("PUT", item)),
      remove: (id) => request(`/events/${id}`, { method: "DELETE" }),
      uploadImage: (file) => {
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
    create: (item) => request("/staff", json("POST", item)),
    update: (id, item) => request(`/staff/${id}`, json("PUT", item)),
    remove: (id) => request(`/staff/${id}`, { method: "DELETE" }),
    // Own person record for a Staff/Teacher/Class Teacher account (refId scoped).
    me: () => request("/staff/me"),
    uploadPhoto: (file) => {
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
    updateStatus: (id, status) =>
      request(`/leaves/${id}/status`, json("PATCH", { status })),
  },
  payroll: {
    list: () => request("/payroll"),
    create: (item) => request("/payroll", json("POST", item)),
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
    list: () => request("/transport"),
    create: (item) => request("/transport", json("POST", item)),
    updateLocation: (id, item) =>
      request(`/transport/${id}/location`, json("PATCH", item)),
    assign: (id, item) =>
      request(`/transport/${id}/assign`, json("PATCH", item)),
  },
  inventory: {
    list: () => request("/inventory"),
    create: (item) => request("/inventory", json("POST", item)),
    update: (id, item) => request(`/inventory/${id}`, json("PUT", item)),
    remove: (id) => request(`/inventory/${id}`, { method: "DELETE" }),
  },
};
