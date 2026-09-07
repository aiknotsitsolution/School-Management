const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request(path, options = {}) {
  const token = localStorage.getItem("erp_access_token");
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 401 && !options._retry) {
    const refreshToken = localStorage.getItem("erp_refresh_token");
    if (refreshToken) {
      const refreshResponse = await fetch(
        `${API_BASE_URL}/auth/refresh-token`,
        json("POST", { refreshToken }),
      );
      const refreshBody = await refreshResponse.json().catch(() => ({}));
      if (refreshResponse.ok && refreshBody.data?.accessToken) {
        localStorage.setItem("erp_access_token", refreshBody.data.accessToken);
        return request(path, { ...options, _retry: true });
      }
    }
    localStorage.removeItem("erp_access_token");
    localStorage.removeItem("erp_refresh_token");
    localStorage.removeItem("erp_user");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new Error(body.message || "Request failed");
  }
  return body;
}

const json = (method, body) => ({ method, body: JSON.stringify(body) });

export const api = {
  login: (credentials) => request("/auth/login", json("POST", credentials)),
  register: (user) => request("/auth/register", json("POST", user)),
  me: () => request("/auth/me"),
  logout: () => {
    localStorage.removeItem("erp_access_token");
    localStorage.removeItem("erp_refresh_token");
    localStorage.removeItem("erp_user");
  },
  students: {
    list: (params = "") => request(`/students${params ? `?${params}` : ""}`),
    create: (student) => request("/students", json("POST", student)),
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
  attendance: {
    list: (params = "") => request(`/attendance${params ? `?${params}` : ""}`),
    mark: (records) => request("/attendance/mark", json("POST", { records })),
  },
  timetable: {
    list: () => request("/timetable"),
    save: (item) => request("/timetable", json("POST", item)),
    remove: (id) => request(`/timetable/${id}`, { method: "DELETE" }),
  },
  homework: {
    list: () => request("/homework"),
    create: (item) => request("/homework", json("POST", item)),
    update: (id, item) => request(`/homework/${id}`, json("PUT", item)),
    remove: (id) => request(`/homework/${id}`, { method: "DELETE" }),
  },
  exams: {
    list: () => request("/exams"),
    create: (item) => request("/exams", json("POST", item)),
    update: (id, item) => request(`/exams/${id}`, json("PUT", item)),
    remove: (id) => request(`/exams/${id}`, { method: "DELETE" }),
  },
  marks: {
    enter: (item) => request("/marks", json("POST", item)),
    reportCard: (params = "") =>
      request(`/marks/report-card${params ? `?${params}` : ""}`),
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
  },
  notices: {
    list: () => request("/notices"),
    create: (item) => request("/notices", json("POST", item)),
    remove: (id) => request(`/notices/${id}`, { method: "DELETE" }),
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
