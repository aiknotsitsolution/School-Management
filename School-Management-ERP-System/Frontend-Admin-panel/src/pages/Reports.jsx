import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  Users,
  Wallet,
  CalendarCheck,
  GraduationCap,
  BarChart3,
  FileDown,
  IndianRupee,
  AlertCircle,
  PhoneCall,
  Download,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { api } from "../lib/api";
import { hasPermission } from "../lib/permissions";
import { selectUser } from "../store/selectors";
import { useMasterOptions } from "../hooks/useMasterOptions";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { PageIntro, Card, StatCard, Button, Input, Select } from "../components/UI";

const PIE_COLORS = ["#16213E", "#E8A33D", "#3F8F5F", "#3B6FA0", "#D65A4A"];
const TABS = [
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "generate", label: "Generate Reports", icon: FileDown },
];
const CLASS_FALLBACK = [
  "Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6",
  "7", "8", "9", "10", "11-Sci", "11-Com", "12-Sci", "12-Com",
];
const SECTION_FALLBACK = ["A", "B", "C"];
const STUDENT_STATUS = ["Active", "Inactive", "Alumni", "Transferred"];

function monthKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function formatMonth(value) {
  return new Date(value).toLocaleDateString("en-IN", {
    month: "short",
  });
}

function formatDate(value) {
  return value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      })
    : "—";
}

function formatFullDate(value) {
  return value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
}

function formatDateTime(value) {
  return value
    ? new Date(value).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}

function csvCell(value) {
  const str = value == null ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function downloadCsv(filename, headers, rows) {
  const lines = [headers, ...rows.map((row) => row.map(csvCell))]
    .map((line) => line.join(","))
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + lines], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

const REPORT_CONFIGS = [
  {
    id: "students",
    title: "Student Roster",
    description:
      "Admission no, class, section, parent name & contact of every student.",
    icon: GraduationCap,
    accent: "info",
    fields: [
      { key: "class", label: "Class", type: "class" },
      { key: "section", label: "Section", type: "section" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: STUDENT_STATUS,
      },
    ],
    generate: async (cfg) => {
      const query = new URLSearchParams({ limit: "1000" });
      if (cfg.class) query.set("class", cfg.class);
      if (cfg.section) query.set("section", cfg.section);
      if (cfg.status) query.set("status", cfg.status);
      const { data = [] } = await api.students.list(query.toString());
      const suffix = cfg.class ? `-${cfg.class}` : "";
      return {
        filename: `student-roster${suffix}.csv`,
        headers: [
          "Admission No",
          "Student Name",
          "Class",
          "Section",
          "Roll No",
          "Gender",
          "Date of Birth",
          "Parent Name",
          "Parent Contact",
          "Status",
        ],
        rows: data.map((s) => [
          s.admissionNo,
          s.name,
          s.class || "",
          s.section || "",
          s.rollNo || "",
          s.gender || "",
          formatFullDate(s.dob),
          s.parentName || "",
          s.parentContact || "",
          s.status || "Active",
        ]),
      };
    },
  },
  {
    id: "attendance",
    title: "Attendance Summary",
    description:
      "Class-wise attendance totals and percentage for a chosen period.",
    icon: CalendarCheck,
    accent: "success",
    fields: [
      { key: "class", label: "Class (optional)", type: "class" },
      { key: "from", label: "From", type: "date" },
      { key: "to", label: "To", type: "date" },
    ],
    generate: async (cfg) => {
      const query = new URLSearchParams();
      if (cfg.class) query.set("class", cfg.class);
      if (cfg.from) query.set("from", cfg.from);
      if (cfg.to) query.set("to", cfg.to);
      const res = await api.attendance.report(query.toString());
      const classWise = res.classWise || [];
      return {
        filename: "attendance-summary.csv",
        headers: ["Class", "Total Records", "Present", "Attendance %"],
        rows: classWise.map((row) => [
          row.class,
          row.total,
          row.present,
          `${row.percentage ?? 0}%`,
        ]),
      };
    },
  },
  {
    id: "payments",
    title: "Fee Collection Ledger",
    description:
      "Every payment recorded — receipt, mode, amount, collector & date.",
    icon: IndianRupee,
    accent: "amber",
    fields: [],
    generate: async () => {
      const { data = [] } = await api.fees.payments.list();
      return {
        filename: "fee-collection-ledger.csv",
        headers: [
          "Receipt No",
          "Student ID",
          "Payment Mode",
          "Amount (₹)",
          "Paid On",
          "Collected By",
          "Transaction ID",
        ],
        rows: data.map((p) => [
          p.receiptNo,
          p.studentId,
          p.mode || "",
          Number(p.amount || 0).toFixed(2),
          formatDateTime(p.paidOn),
          p.collectedBy || "",
          p.transactionId || "",
        ]),
      };
    },
  },
  {
    id: "outstanding",
    title: "Outstanding Dues",
    description:
      "Invoices with an unpaid balance — student, fee type, amount & due date.",
    icon: AlertCircle,
    accent: "alert",
    fields: [
      { key: "class", label: "Class (optional)", type: "class" },
      {
        key: "session",
        label: "Session",
        type: "text",
        placeholder: "e.g. 2024-25",
      },
    ],
    generate: async (cfg) => {
      const { data = [] } = await api.fees.invoices.list();
      const rows = data
        .filter((inv) => (cfg.class ? inv.class === cfg.class : true))
        .filter((inv) => (cfg.session ? inv.session === cfg.session : true))
        .filter(
          (inv) => Number(inv.amount) - Number(inv.paidAmount || 0) > 0,
        )
        .map((inv) => {
          const amount = Number(inv.amount || 0);
          const paid = Number(inv.paidAmount || 0);
          return [
            inv.studentId,
            inv.class || "",
            inv.feeType,
            inv.session,
            amount.toFixed(2),
            paid.toFixed(2),
            (amount - paid).toFixed(2),
            formatFullDate(inv.dueDate),
            inv.status,
          ];
        });
      return {
        filename: "outstanding-dues.csv",
        headers: [
          "Student ID",
          "Class",
          "Fee Type",
          "Session",
          "Amount (₹)",
          "Paid (₹)",
          "Outstanding (₹)",
          "Due Date",
          "Status",
        ],
        rows,
      };
    },
  },
  {
    id: "enquiries",
    title: "Admission Enquiries",
    description:
      "All admission enquiries with guardian, contact & current status.",
    icon: PhoneCall,
    accent: "success",
    fields: [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          "New",
          "Contacted",
          "Visit Scheduled",
          "Applied",
          "Admitted",
          "Rejected",
          "Closed",
        ],
      },
    ],
    generate: async (cfg) => {
      const query = cfg.status ? `?status=${encodeURIComponent(cfg.status)}` : "";
      const { data = [] } = await api.admissions.list(query);
      return {
        filename: "admission-enquiries.csv",
        headers: [
          "Child Name",
          "Class Applied",
          "Parent Name",
          "Section",
          "Contact",
          "Email",
          "Source",
          "Status",
          "Follow-Up Date",
        ],
        rows: data.map((enq) => [
          enq.childName || "",
          enq.classApplied || "",
          enq.parentName || "",
          enq.section || "",
          enq.contact || "",
          enq.email || "",
          enq.source || "",
          enq.status || "New",
          formatFullDate(enq.followUpDate),
        ]),
      };
    },
  },
  {
    id: "staff",
    title: "Staff List",
    description:
      "All staff & teachers with designation, department and contact details.",
    icon: Users,
    accent: "info",
    fields: [],
    generate: async () => {
      const { data = [] } = await api.staff.list();
      return {
        filename: "staff-list.csv",
        headers: [
          "Employee ID",
          "Name",
          "Designation",
          "Department",
          "Role",
          "Subjects",
          "Classes Assigned",
          "Email",
          "Contact",
          "Joining Date",
          "Status",
        ],
        rows: data.map((s) => [
          s.employeeId,
          s.name,
          s.designation || "",
          s.department || "",
          s.role || "",
          (s.subjects || []).join(" | "),
          (s.classesAssigned || [])
            .map((c) => `${c.class}${c.section ? `-${c.section}` : ""}`)
            .join(" | "),
          s.email || "",
          s.contact || "",
          formatFullDate(s.joiningDate),
          s.status || "Active",
        ]),
      };
    },
  },
];

function TabBar({ active, onChange }) {
  return (
    <div className="inline-flex items-center gap-1 bg-paper border border-black/[0.06] p-1 rounded-xl">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg transition-colors ${
            active === tab.id
              ? "bg-ink text-amber shadow-sm"
              : "text-slate-text hover:text-ink"
          }`}
        >
          <tab.icon size={15} />
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function GenerateReports() {
  const { options: classOptions } = useMasterOptions("classes", CLASS_FALLBACK);
  const { options: sectionOptions } = useMasterOptions(
    "sections",
    SECTION_FALLBACK,
  );
  const [selectedId, setSelectedId] = useState(null);
  const [cfg, setCfg] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const selected = REPORT_CONFIGS.find((report) => report.id === selectedId);

  const setField = (key, value) => {
    setCfg((prev) => ({ ...prev, [key]: value }));
    setError("");
    setResult(null);
  };

  const selectReport = (id) => {
    setSelectedId(id);
    setCfg({});
    setResult(null);
    setError("");
  };

  const generate = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const output = await selected.generate(cfg);
      setResult(output);
      downloadCsv(output.filename, output.headers, output.rows);
    } catch (err) {
      setError(err.message || "Report generation failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const renderField = (field) => {
    const value = cfg[field.key] || "";
    const onChange = (event) => setField(field.key, event.target.value);

    switch (field.type) {
      case "class":
        return (
          <div key={field.key}>
            <label className="block text-[12px] font-semibold text-slate-text/80 mb-1.5">
              {field.label}
            </label>
            <Select value={value} onChange={onChange}>
              <option value="">All classes</option>
              {classOptions.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </Select>
          </div>
        );
      case "section":
        return (
          <div key={field.key}>
            <label className="block text-[12px] font-semibold text-slate-text/80 mb-1.5">
              {field.label}
            </label>
            <Select value={value} onChange={onChange}>
              <option value="">All sections</option>
              {sectionOptions.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </Select>
          </div>
        );
      case "select":
        return (
          <div key={field.key}>
            <label className="block text-[12px] font-semibold text-slate-text/80 mb-1.5">
              {field.label}
            </label>
            <Select value={value} onChange={onChange}>
              <option value="">All</option>
              {field.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </Select>
          </div>
        );
      case "date":
        return (
          <div key={field.key}>
            <label className="block text-[12px] font-semibold text-slate-text/80 mb-1.5">
              {field.label}
            </label>
            <Input type="date" value={value} onChange={onChange} />
          </div>
        );
      case "text":
        return (
          <div key={field.key}>
            <label className="block text-[12px] font-semibold text-slate-text/80 mb-1.5">
              {field.label}
            </label>
            <Input
              type="text"
              value={value}
              onChange={onChange}
              placeholder={field.placeholder || ""}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <p className="text-[13px] text-slate-text/70">
        Pick a report type, apply filters if needed, and download it as a CSV
        file that opens straight in Excel.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORT_CONFIGS.map((report) => {
          const active = report.id === selectedId;
          return (
            <button
              key={report.id}
              onClick={() => selectReport(report.id)}
              className={`text-left flex flex-col gap-2 p-4 rounded-xl border bg-white transition-all ${
                active
                  ? "border-ink shadow-md ring-2 ring-ink/10"
                  : "border-black/[0.06] hover:border-black/15 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    active ? "bg-ink text-amber" : "bg-paper text-ink/70"
                  }`}
                >
                  <report.icon size={17} />
                </span>
                <p className="font-display font-bold text-ink text-[14px]">
                  {report.title}
                </p>
              </div>
              <p className="text-[12px] text-slate-text/70 leading-relaxed">
                {report.description}
              </p>
            </button>
          );
        })}
      </div>

      {selected && (
        <Card title={`${selected.title} — Generate`} className="mt-5">
          {selected.fields.length === 0 ? (
            <p className="text-[13px] text-slate-text/70">
              No filters required. This report downloads the full dataset.
            </p>
          ) : (
            <div className="grid sm:grid-cols-3 gap-3.5">
              {selected.fields.map(renderField)}
            </div>
          )}

          {error && (
            <p className="mt-4 text-[13px] text-alert flex items-center gap-1.5">
              <AlertCircle size={14} />
              {error}
            </p>
          )}

          {result && (
            <p className="mt-4 text-[13px] text-emerald-600 flex items-center gap-1.5 font-medium">
              <CheckCircle2 size={14} />
              {result.rows.length.toLocaleString("en-IN")} rows downloaded —{" "}
              {result.filename}
            </p>
          )}

          <div className="flex justify-end gap-2 mt-5">
            <Button variant="outline" onClick={() => selectReport(null)}>
              Cancel
            </Button>
            <Button variant="amber" onClick={generate} disabled={busy}>
              {busy ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              {busy ? "Generating..." : "Generate & Download CSV"}
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}

export default function Reports() {
  const [tab, setTab] = useState("analytics");
  const [data, setData] = useState({
    studentStats: { total: 0, active: 0, byClass: [] },
    students: [],
    attendance: [],
    invoices: [],
    payments: [],
    admissions: [],
    feeReports: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const user = useSelector(selectUser);
  const canViewFeeReports = hasPermission(user, "fees:reports");

  useEffect(() => {
    Promise.allSettled([
      api.students.stats(),
      api.students.list("limit=1000"),
      api.attendance.list(),
      api.fees.invoices.list(),
      api.fees.payments.list(),
      api.admissions.list(),
      api.fees.reports.get(),
    ])
      .then((results) => {
        const value = (index) =>
          results[index].status === "fulfilled" ? results[index].value : {};
        const failed = results.filter((result) => result.status === "rejected");
        setData({
          studentStats: value(0).data || { total: 0, active: 0, byClass: [] },
          students: value(1).data || [],
          attendance: value(2).data || [],
          invoices: value(3).data || [],
          payments: value(4).data || [],
          admissions: value(5).data || [],
          feeReports: value(6).data || {},
        });
        if (failed.length === results.length) {
          setError("Analytics data could not be loaded. Please try again.");
        } else if (failed.length > 0) {
          setError("Some analytics data is temporarily unavailable.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const classStrength = useMemo(
    () =>
      (data.studentStats.byClass || []).map((item) => ({
        name: item._id || "Unknown",
        value: item.count,
      })),
    [data.studentStats],
  );

  const attendanceTrend = useMemo(() => {
    const grouped = new Map();
    data.attendance.forEach((record) => {
      const key = monthKey(record.date);
      const current = grouped.get(key) || {
        total: 0,
        present: 0,
        date: record.date,
      };
      current.total += 1;
      if (record.status === "Present") current.present += 1;
      grouped.set(key, current);
    });
    return [...grouped.values()].map((item) => ({
      month: formatMonth(item.date),
      attendance: item.total
        ? Math.round((item.present / item.total) * 100)
        : 0,
    }));
  }, [data.attendance]);

  const feeTrend = useMemo(() => {
    const grouped = new Map();
    data.payments.forEach((payment) => {
      const key = monthKey(payment.paidOn);
      const current = grouped.get(key) || {
        month: formatMonth(payment.paidOn),
        collected: 0,
        pending: 0,
      };
      current.collected += Number(payment.amount || 0);
      grouped.set(key, current);
    });
    const pending = data.invoices.reduce(
      (sum, invoice) =>
        sum +
        Math.max(0, Number(invoice.amount) - Number(invoice.paidAmount || 0)),
      0,
    );
    const trend = [...grouped.values()];
    if (trend.length === 0 && pending > 0) {
      trend.push({ month: "Current", collected: 0, pending });
    } else if (trend.length > 0) {
      trend[trend.length - 1].pending = pending;
    }
    return trend;
  }, [data.payments, data.invoices]);

  const enquiryFunnel = useMemo(() => {
    const byStatus = new Map();
    data.admissions.forEach((item) => {
      const status = item.status || "Unknown";
      byStatus.set(status, (byStatus.get(status) || 0) + 1);
    });
    return [...byStatus.entries()];
  }, [data.admissions]);

  const collectionByDay = useMemo(
    () =>
      (data.feeReports.collectionByDate || []).map((item) => ({
        date: formatDate(item._id),
        total: item.total,
      })),
    [data.feeReports],
  );
  const outstandingReport = data.feeReports.outstanding || [];
  const classWiseCollection = data.feeReports.classWiseCollection || [];
  const feeTypeWiseCollection = data.feeReports.feeTypeWiseCollection || [];

  const feesCollected = data.payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
  const feesInvoiced = data.invoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount || 0),
    0,
  );
  const feesPending = data.invoices.reduce(
    (sum, invoice) =>
      sum +
      Math.max(0, Number(invoice.amount) - Number(invoice.paidAmount || 0)),
    0,
  );
  const pendingInvoiceCount = data.invoices.filter(
    (invoice) =>
      Number(invoice.amount) - Number(invoice.paidAmount || 0) > 0,
  ).length;
  const collectionRate =
    feesInvoiced > 0
      ? Math.min(100, Math.round((feesCollected / feesInvoiced) * 100))
      : 0;
  const totalAttendanceRecords = data.attendance.length;
  const presentRecords = data.attendance.filter(
    (record) => record.status === "Present",
  ).length;
  const avgAttendance = totalAttendanceRecords
    ? Math.round((presentRecords / totalAttendanceRecords) * 100)
    : 0;

  return (
    <div>
      <PageIntro
        eyebrow="Insights"
        title="Reports & Analytics"
        description="Live school performance across academics and finance, plus downloadable CSV reports."
      />

      <div className="mt-5">
        <TabBar active={tab} onChange={setTab} />
      </div>

      <div className="mt-6 space-y-6">
        <div className={tab === "analytics" ? "space-y-6" : "hidden"}>
          {loading ? (
            <Card>
              <p className="py-14 text-center text-[13px] text-slate-text/60">
                Loading live analytics...
              </p>
            </Card>
          ) : (
            <>
              {error && (
                <Card>
                  <p className="text-sm text-alert">{error}</p>
                </Card>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={Users}
                  label="Total Enrollment"
                  value={data.studentStats.total.toLocaleString("en-IN")}
                  sub={`${data.studentStats.active.toLocaleString("en-IN")} active students`}
                  accent="amber"
                />
                <StatCard
                  icon={CalendarCheck}
                  label="Avg. Attendance"
                  value={`${avgAttendance}%`}
                  sub={`${presentRecords.toLocaleString("en-IN")} of ${totalAttendanceRecords.toLocaleString("en-IN")} records marked present`}
                  accent="success"
                />
                <StatCard
                  icon={Wallet}
                  label="Fee Collection Rate"
                  value={`${collectionRate}%`}
                  sub={`₹${(feesCollected / 100000).toFixed(1)}L collected of ₹${(feesInvoiced / 100000).toFixed(1)}L invoiced`}
                  accent="info"
                />
                <StatCard
                  icon={GraduationCap}
                  label="Pending Dues"
                  value={`₹${(feesPending / 100000).toFixed(1)}L`}
                  sub={`${pendingInvoiceCount.toLocaleString("en-IN")} invoices partly or fully unpaid`}
                  accent="alert"
                />
              </div>

              <div className="grid lg:grid-cols-2 gap-5">
                <Card title="Students by Section">
                  {classStrength.length === 0 ? (
                    <p className="py-14 text-center text-[13px] text-slate-text/60">
                      No enrollment data yet
                    </p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={classStrength}
                            dataKey="value"
                            nameKey="name"
                            outerRadius={95}
                            label={(d) => d.value}
                          >
                            {classStrength.map((_, i) => (
                              <Cell
                                key={i}
                                fill={PIE_COLORS[i % PIE_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              borderRadius: 10,
                              border: "1px solid #eee",
                              fontSize: 12.5,
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-2">
                        {classStrength.map((c, i) => (
                          <div
                            key={c.name}
                            className="flex items-center gap-1.5 text-[11px] text-slate-text"
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: PIE_COLORS[i] }}
                            />
                            {c.name}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </Card>

                <Card title="Attendance Trend">
                  {attendanceTrend.length === 0 ? (
                    <p className="py-14 text-center text-[13px] text-slate-text/60">
                      No attendance records yet
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart
                        data={attendanceTrend}
                        margin={{ left: -20, top: 5 }}
                      >
                        <defs>
                          <linearGradient
                            id="analyticsAttGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#E8A33D"
                              stopOpacity={0.35}
                            />
                            <stop
                              offset="100%"
                              stopColor="#E8A33D"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#EEEAE0"
                        />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 12, fill: "#475467" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "#475467" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 10,
                            border: "1px solid #eee",
                            fontSize: 12.5,
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="attendance"
                          stroke="#E8A33D"
                          strokeWidth={2.5}
                          fill="url(#analyticsAttGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </Card>
              </div>

              <div className="grid lg:grid-cols-2 gap-5">
                <Card title="Fee Collection vs Pending">
                  {feeTrend.length === 0 ? (
                    <p className="py-14 text-center text-[13px] text-slate-text/60">
                      No fee payments yet
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={feeTrend}
                        margin={{ left: -10, top: 5 }}
                        barGap={4}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#EEEAE0"
                        />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 12, fill: "#475467" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tickFormatter={(v) => `₹${v / 100000}L`}
                          tick={{ fontSize: 11, fill: "#475467" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(v) => `₹${v.toLocaleString("en-IN")}`}
                          contentStyle={{
                            borderRadius: 10,
                            border: "1px solid #eee",
                            fontSize: 12.5,
                          }}
                        />
                        <Bar
                          dataKey="collected"
                          fill="#3F8F5F"
                          radius={[6, 6, 0, 0]}
                          name="Collected"
                        />
                        <Bar
                          dataKey="pending"
                          fill="#D65A4A"
                          radius={[6, 6, 0, 0]}
                          name="Pending"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card title="Admission Enquiry Funnel">
                  {enquiryFunnel.length === 0 ? (
                    <p className="py-14 text-center text-[13px] text-slate-text/60">
                      No admission enquiries yet
                    </p>
                  ) : (
                    <div className="divide-y divide-black/[0.05]">
                      {enquiryFunnel.map(([status, count]) => (
                        <div
                          key={status}
                          className="flex items-center justify-between py-3"
                        >
                          <span className="text-[13px] font-medium text-ink">
                            {status}
                          </span>
                          <div className="flex items-center gap-3">
                            <div className="w-40 sm:w-56 h-2 rounded-full bg-paper overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${data.admissions.length ? Math.round((count / data.admissions.length) * 100) : 0}%`,
                                  background:
                                    PIE_COLORS[
                                      enquiryFunnel.findIndex(
                                        ([key]) => key === status,
                                      ) % PIE_COLORS.length
                                    ],
                                }}
                              />
                            </div>
                            <span className="text-[13px] font-bold text-ink w-8 text-right">
                              {count}
                            </span>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-3">
                        <span className="text-[12.5px] text-slate-text/60">
                          Last updated {formatDate(new Date())}
                        </span>
                        <span className="text-[12.5px] font-semibold text-ink">
                          Total {data.admissions.length}
                        </span>
                      </div>
                    </div>
                  )}
                </Card>
              </div>

              {canViewFeeReports && (
                <>
                  <div className="mb-4">
                    <h3 className="font-display text-[17px] font-bold text-ink">
                      Fee Reports
                    </h3>
                    <p className="text-[13px] text-slate-text/70 mt-1">
                      Day-wise collection, outstanding dues and collection split
                      by class & fee type.
                    </p>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-5">
                    <Card title="Collection by Day">
                      {collectionByDay.length === 0 ? (
                        <p className="py-14 text-center text-[13px] text-slate-text/60">
                          No fee report data yet
                        </p>
                      ) : (
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart
                            data={collectionByDay}
                            margin={{ left: -10, top: 5 }}
                            barGap={4}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                              stroke="#EEEAE0"
                            />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 12, fill: "#475467" }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tickFormatter={(v) => `₹${v / 100000}L`}
                              tick={{ fontSize: 11, fill: "#475467" }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              formatter={(v) => `₹${v.toLocaleString("en-IN")}`}
                              contentStyle={{
                                borderRadius: 10,
                                border: "1px solid #eee",
                                fontSize: 12.5,
                              }}
                            />
                            <Bar
                              dataKey="total"
                              fill="#3B6FA0"
                              radius={[6, 6, 0, 0]}
                              name="Collected"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </Card>

                    <Card title="Outstanding by Class & Fee Type">
                      {outstandingReport.length === 0 ? (
                        <p className="py-14 text-center text-[13px] text-slate-text/60">
                          No fee report data yet
                        </p>
                      ) : (
                        <div className="overflow-x-auto -mx-5">
                          <table className="w-full text-[13px]">
                            <thead>
                              <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/[0.06]">
                                <th className="px-5 py-2.5 font-semibold">
                                  Class
                                </th>
                                <th className="px-5 py-2.5 font-semibold">
                                  Fee Type
                                </th>
                                <th className="px-5 py-2.5 font-semibold">
                                  Outstanding ₹
                                </th>
                                <th className="px-5 py-2.5 font-semibold">
                                  Invoices
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {outstandingReport.map((row) => (
                                <tr
                                  key={`${row._id?.class}-${row._id?.feeType}`}
                                  className="border-b border-black/[0.04] last:border-0"
                                >
                                  <td className="px-5 py-3 font-medium text-ink">
                                    {row._id?.class || "—"}
                                  </td>
                                  <td className="px-5 py-3 text-slate-text">
                                    {row._id?.feeType || "—"}
                                  </td>
                                  <td className="px-5 py-3 font-semibold text-ink">
                                    ₹
                                    {Number(row.outstanding || 0).toLocaleString(
                                      "en-IN",
                                    )}
                                  </td>
                                  <td className="px-5 py-3 text-slate-text">
                                    {row.count || 0}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Card>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-5">
                    <Card title="Class-wise Collection">
                      {classWiseCollection.length === 0 ? (
                        <p className="py-14 text-center text-[13px] text-slate-text/60">
                          No fee report data yet
                        </p>
                      ) : (
                        <table className="w-full text-[13px]">
                          <thead>
                            <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/[0.06]">
                              <th className="px-5 py-2.5 font-semibold">
                                Class
                              </th>
                              <th className="px-5 py-2.5 font-semibold">
                                Collected ₹
                              </th>
                              <th className="px-5 py-2.5 font-semibold">
                                Payments
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {classWiseCollection.map((row) => (
                              <tr
                                key={row._id}
                                className="border-b border-black/[0.04] last:border-0"
                              >
                                <td className="px-5 py-3 font-medium text-ink">
                                  {row._id || "—"}
                                </td>
                                <td className="px-5 py-3 font-semibold text-ink">
                                  ₹
                                  {Number(row.total || 0).toLocaleString(
                                    "en-IN",
                                  )}
                                </td>
                                <td className="px-5 py-3 text-slate-text">
                                  {row.count || 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </Card>

                    <Card title="Fee Type-wise Collection">
                      {feeTypeWiseCollection.length === 0 ? (
                        <p className="py-14 text-center text-[13px] text-slate-text/60">
                          No fee report data yet
                        </p>
                      ) : (
                        <table className="w-full text-[13px]">
                          <thead>
                            <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/[0.06]">
                              <th className="px-5 py-2.5 font-semibold">
                                Fee Type
                              </th>
                              <th className="px-5 py-2.5 font-semibold">
                                Collected ₹
                              </th>
                              <th className="px-5 py-2.5 font-semibold">
                                Payments
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {feeTypeWiseCollection.map((row) => (
                              <tr
                                key={row._id}
                                className="border-b border-black/[0.04] last:border-0"
                              >
                                <td className="px-5 py-3 font-medium text-ink">
                                  {row._id || "—"}
                                </td>
                                <td className="px-5 py-3 font-semibold text-ink">
                                  ₹
                                  {Number(row.total || 0).toLocaleString(
                                    "en-IN",
                                  )}
                                </td>
                                <td className="px-5 py-3 text-slate-text">
                                  {row.count || 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </Card>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className={tab === "generate" ? "space-y-6" : "hidden"}>
          <GenerateReports />
        </div>
      </div>
    </div>
  );
}