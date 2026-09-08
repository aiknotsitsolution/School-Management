import { store } from "../store";
import { setTokens, logout } from "../store/authSlice";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const json = (method, body) => ({ method, body: JSON.stringify(body) });

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
    throw new Error(body.message || "Request failed");
  }
  return body;
}

export const api = {
  login: (credentials) => request("/auth/login", json("POST", credentials)),
  me: () => request("/auth/me"),
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
  },
  schools: {
    list: () => request("/auth/schools"),
    create: (school) => request("/auth/schools", json("POST", school)),
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
      submit: (homeworkId, item) =>
        request(`/homework/submissions/${homeworkId}`, json("POST", item)),
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
    remove: (id) => request(`/exams/${id}`, { method: "DELETE" }),
  },
  marks: {
    enter: (item) => request("/marks", json("POST", item)),
    reportCard: (params = "") =>
      request(`/marks/report-card${params ? `?${params}` : ""}`),
    classSummary: (params = "") =>
      request(`/marks/class-summary${params ? `?${params}` : ""}`),
  },
  fees: {
    structures: {
      list: () => request("/fees/structure"),
      create: (item) => request("/fees/structure", json("POST", item)),
      remove: (id) => request(`/fees/structure/${id}`, { method: "DELETE" }),
    },
    invoices: {
      list: (params = "") => request(`/fees${params ? `?${params}` : ""}`),
      create: (item) => request("/fees", json("POST", item)),
    },
    payments: {
      list: (params = "") => request(`/payments${params ? `?${params}` : ""}`),
      create: (item) => request("/payments", json("POST", item)),
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
  },
  events: {
    list: () => request("/events"),
    create: (item) => request("/events", json("POST", item)),
    update: (id, item) => request(`/events/${id}`, json("PUT", item)),
    remove: (id) => request(`/events/${id}`, { method: "DELETE" }),
  },
  staff: {
    list: () => request("/staff"),
    create: (item) => request("/staff", json("POST", item)),
    update: (id, item) => request(`/staff/${id}`, json("PUT", item)),
    remove: (id) => request(`/staff/${id}`, { method: "DELETE" }),
    attendance: {
      list: (params = "") =>
        request(`/staff/attendance${params ? `?${params}` : ""}`),
      mark: (item) => request("/staff/attendance", json("POST", item)),
    },
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
