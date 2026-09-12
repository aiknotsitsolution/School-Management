import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  CalendarDays,
  X,
  Save,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Input,
  Select,
  Pill,
  statusTone,
  StatCard,
  toast,
} from "../components/UI";
import { api } from "../lib/api";
import { isNonEmpty } from "../lib/validation.js";
const leaveSeed = [];
const balanceSeed = [];

const TYPES = [
  "Casual Leave",
  "Sick Leave",
  "Privilege Leave",
  "Medical Leave",
  "Maternity Leave",
  "Emergency Leave",
];
const STATUS_FILTERS = ["All", "Approved", "Pending", "Rejected"];

const LEAVE_TYPE_MAP = {
  "Casual Leave": "Casual",
  "Sick Leave": "Sick",
  "Privilege Leave": "Earned",
  "Medical Leave": "Other",
  "Maternity Leave": "Maternity",
  "Emergency Leave": "Other",
};
const LEAVE_TYPE_LABELS = {
  Casual: "Casual Leave",
  Sick: "Sick Leave",
  Earned: "Privilege Leave",
  Maternity: "Maternity Leave",
  Other: "Medical / Other",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysBetween(from, to) {
  const a = new Date(from),
    b = new Date(to);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

function emptyForm() {
  return {
    applicant: "",
    role: "Staff",
    type: "Casual Leave",
    from: todayISO(),
    to: inDays(1),
    reason: "",
  };
}
function inDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function Leave() {
  const [requests, setRequests] = useState(leaveSeed);
  const [balance] = useState(balanceSeed);
  const reload = () => {
    Promise.all([api.leaves.list(), api.staff.list()])
      .then(([leavesRes, staffRes]) => {
        const map = {};
        (staffRes?.data || []).forEach((s) => {
          map[String(s._id || s.id)] = s;
        });
        setRequests(
          (leavesRes?.data || []).map((l) => ({
            id: l._id,
            applicant:
              map[String(l.staffId)]?.name || "Staff member",
            role: "Staff",
            type: LEAVE_TYPE_LABELS[l.leaveType] || l.leaveType || "—",
            days: daysBetween(l.fromDate, l.toDate),
            from: new Date(l.fromDate).toISOString().slice(0, 10),
            to: new Date(l.toDate).toISOString().slice(0, 10),
            reason: l.reason || "",
            status: l.status || "Pending",
          })),
        );
      })
      .catch(() => {});
  };
  useEffect(() => {
    reload();
  }, []);
  const [tab, setTab] = useState("requests");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [leaveTypes, setLeaveTypes] = useState(TYPES);

  useEffect(() => {
    api.examMasters.list("leave-types").then((res) => {
      const items = res?.data;
      if (Array.isArray(items) && items.length > 0) {
        setLeaveTypes(items.map((i) => i.name));
      }
    }).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return requests.filter((l) => {
      const matchStatus = statusFilter === "All" || l.status === statusFilter;
      const matchQuery =
        !q ||
        l.applicant.toLowerCase().includes(q) ||
        l.type.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [requests, query, statusFilter]);

  const stats = useMemo(() => {
    const pending = requests.filter((l) => l.status === "Pending").length;
    const approved = requests.filter((l) => l.status === "Approved").length;
    const staff = requests.filter((l) => l.role === "Staff").length;
    const student = requests.filter((l) => l.role === "Student").length;
    return { total: requests.length, pending, approved, staff, student };
  }, [requests]);

  const setStatus = async (id, status) => {
    try {
      await api.leaves.updateStatus(id, status);
      toast(
        status === "Approved" ? "Leave approved" : "Leave rejected",
        status === "Approved" ? "success" : "error",
      );
      reload();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const apply = async () => {
    if (!isNonEmpty(form.from) || !isNonEmpty(form.to)) {
      toast("Select from and to dates", "error");
      return;
    }
    if (form.to < form.from) {
      toast("To date must be after from date", "error");
      return;
    }
    try {
      await api.leaves.create({
        leaveType: LEAVE_TYPE_MAP[form.type] || "Other",
        fromDate: form.from,
        toDate: form.to,
        reason: form.reason.trim() || "—",
      });
      toast("Leave request submitted");
      setShowModal(false);
      setForm(emptyForm());
      reload();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const totalLeaveDays = balance.reduce((a, b) => a + b.used, 0);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Human Resources"
        title="Leave Management"
        description="Apply for and manage leaves for staff and students."
        right={
          <Button variant="amber" onClick={() => setShowModal(true)}>
            <Plus size={15} /> Apply Leave
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          label="Total Requests"
          value={String(stats.total)}
          sub="This session"
          accent="info"
        />
        <StatCard
          icon={Clock}
          label="Pending"
          value={String(stats.pending)}
          sub="Awaiting approval"
          accent="amber"
        />
        <StatCard
          icon={CheckCircle2}
          label="Approved"
          value={String(stats.approved)}
          sub="Granted"
          accent="success"
        />
        <StatCard
          icon={UserCheck}
          label="Staff Leave Days"
          value={String(totalLeaveDays)}
          sub="Used across staff"
          accent="alert"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {[
            { key: "requests", label: "Requests" },
            { key: "balance", label: "Leave Balance" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors ${
                tab === t.key
                  ? "bg-ink text-white border-ink"
                  : "bg-white text-slate-text border-black/10 hover:border-ink/30"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "requests" ? (
        <Card
          title="Leave Requests"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
                />
                <Input
                  placeholder="Search applicant..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-8 w-52"
                />
              </div>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="min-w-[130px]"
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s} value={s}>
                    {s === "All" ? "All Status" : s}
                  </option>
                ))}
              </Select>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <div className="py-14 text-center">
              <CalendarDays
                size={36}
                className="mx-auto text-slate-text/30 mb-3"
              />
              <p className="text-[14px] font-medium text-ink">
                No leave requests found
              </p>
              <p className="text-[13px] text-slate-text/60 mt-1">
                Adjust filters or apply for a new leave.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((l) => {
                const isStudent = l.role === "Student";
                return (
                  <div
                    key={l.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-black/[0.06] hover:border-black/10 hover:bg-paper/40 transition-colors"
                  >
                    <div className="w-11 h-11 rounded-xl bg-info/10 text-info flex items-center justify-center shrink-0">
                      <CalendarDays size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-semibold text-ink">
                          {l.applicant}
                        </p>
                        <Pill tone={isStudent ? "info" : "amber"}>
                          {l.role}
                        </Pill>
                        <Pill tone={statusTone(l.status)}>{l.status}</Pill>
                      </div>
                      <p className="text-[13.5px] text-slate-text mt-1">
                        {l.type} · {l.days} day(s) · {l.from} → {l.to}
                      </p>
                      <p className="text-[12px] text-slate-text/60 mt-0.5">
                        {l.reason}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 sm:flex-col sm:items-end">
                      {l.status === "Pending" && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setStatus(l.id, "Approved")}
                            className="inline-flex items-center gap-1 text-[12px] font-semibold text-success hover:underline"
                          >
                            <CheckCircle2 size={14} /> Approve
                          </button>
                          <button
                            onClick={() => setStatus(l.id, "Rejected")}
                            className="inline-flex items-center gap-1 text-[12px] font-semibold text-alert hover:underline"
                          >
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ) : (
        <Card title="Staff Leave Balance">
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/[0.06]">
                  <th className="px-5 py-2.5 font-semibold">Staff Member</th>
                  <th className="px-5 py-2.5 font-semibold">Role</th>
                  <th className="px-5 py-2.5 font-semibold">Entitled</th>
                  <th className="px-5 py-2.5 font-semibold">Used</th>
                  <th className="px-5 py-2.5 font-semibold">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {balance.map((b) => {
                  const remaining = b.entitled - b.used;
                  return (
                    <tr
                      key={b.id}
                      className="border-b border-black/[0.04] hover:bg-paper/60"
                    >
                      <td className="px-5 py-3 font-semibold text-ink">
                        {b.name}
                      </td>
                      <td className="px-5 py-3 text-slate-text">{b.role}</td>
                      <td className="px-5 py-3 text-slate-text">
                        {b.entitled}
                      </td>
                      <td className="px-5 py-3 text-slate-text">{b.used}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink">
                            {remaining}
                          </span>
                          <div className="w-24 h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${remaining <= 2 ? "bg-alert" : "bg-success"}`}
                              style={{
                                width: `${Math.min(100, (remaining / b.entitled) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {balance.length === 0 && (
            <p className="px-5 pb-4 -mt-1 text-[12.5px] text-slate-text/60">
              Leave balance tracking is not enabled. Balances are maintained
              offline by the school office.
            </p>
          )}
        </Card>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <h3 className="font-display font-semibold text-ink text-[17px]">
                Apply Leave
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <p className="rounded-lg bg-paper border border-black/[0.06] px-3.5 py-3 text-[12.5px] text-slate-text">
                The leave is submitted under your account and will be reviewed
                by the school administrator.
              </p>
              <LeaveField label="Leave Type">
                <Select
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, type: e.target.value }))
                  }
                >
                  {leaveTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </LeaveField>
              <div className="grid grid-cols-2 gap-3">
                <LeaveField label="From">
                  <Input
                    type="date"
                    value={form.from}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, from: e.target.value }))
                    }
                  />
                </LeaveField>
                <LeaveField label="To">
                  <Input
                    type="date"
                    value={form.to}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, to: e.target.value }))
                    }
                  />
                </LeaveField>
              </div>
              <LeaveField label="Reason">
                <textarea
                  rows={3}
                  placeholder="Reason for leave..."
                  value={form.reason}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reason: e.target.value }))
                  }
                  className="w-full rounded-lg border border-black/10 p-3 text-[13px] outline-none focus:border-ink/40 resize-none"
                />
              </LeaveField>
            </div>
            <div className="px-5 py-4 border-t border-black/[0.06] flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                variant="amber"
                onClick={apply}
                disabled={!form.from || !form.to}
              >
                <Save size={15} /> Submit Application
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LeaveField({ label, children }) {
  return (
    <div>
      <label className="text-[12px] font-semibold text-ink mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}
