import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { PermissionGate } from "../lib/permissions";
import {
  Plus,
  Wallet,
  X,
  Search,
  Download,
  BadgeCheck,
  Clock,
  TrendingUp,
  FileText,
  Save,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Input,
  Select,
  Pill,
  StatCard,
  toast,
} from "../components/UI";
import { api } from "../lib/api";
import { isNonEmpty, isNonNegativeNumber, isPositiveNumber } from "../lib/validation.js";
import { selectSchool } from "../store/selectors";
const payrollSeed = [];

const MONTHS = [
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "January",
  "February",
  "March",
];

function payMonth() {
  const d = new Date();
  const idx = d.getMonth() >= 3 ? d.getMonth() - 3 : d.getMonth() + 9;
  return { month: MONTHS[idx], year: d.getFullYear() };
}

function emptyForm() {
  return {
    staffId: "",
    basic: 0,
    allowances: 0,
    deductions: 0,
  };
}

export default function Payroll() {
  const school = useSelector(selectSchool);
  const [employees, setEmployees] = useState(payrollSeed);
  const [staffList, setStaffList] = useState([]);
  const [{ month, year }, setPeriod] = useState(payMonth());
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [payslip, setPayslip] = useState(null);

  const reload = useCallback(() => {
    Promise.all([
      api.payroll.list().catch(() => ({ data: [] })),
      api.staff.list().catch(() => ({ data: [] })),
    ]).then(([payrollRes, staffRes]) => {
      const staff = staffRes.data || [];
      const map = {};
      staff.forEach((s) => {
        map[String(s._id || s.id)] = s;
      });
      setStaffList(staff);
      setEmployees(
        (payrollRes.data || []).map((p) => {
          const s = map[String(p.staffId)];
          return {
            id: p._id,
            name: s?.name || "Staff member",
            department: s?.department || "—",
            designation: s?.designation || "—",
            month: p.month,
            year: p.year,
            basic: Number(p.basic || 0),
            allowances: Number(p.allowances || 0),
            deductions: Number(p.deductions || 0),
            paid: p.status === "Paid",
          };
        }),
      );
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const depts = useMemo(
    () =>
      ["All", ...new Set(employees.filter((e) => e.year === year && e.month === month).map((e) => e.department))],
    [employees, month, year],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return employees.filter((e) => {
      const matchPeriod = e.year === year && e.month === month;
      const matchDept = deptFilter === "All" || e.department === deptFilter;
      const matchQuery =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q);
      return matchPeriod && matchDept && matchQuery;
    });
  }, [employees, query, deptFilter, month, year]);

  const stats = useMemo(() => {
    const periodRows = employees.filter(
      (e) => e.year === year && e.month === month,
    );
    const totalGross = periodRows.reduce(
      (a, e) => a + e.basic + e.allowances,
      0,
    );
    const totalDeductions = periodRows.reduce((a, e) => a + e.deductions, 0);
    const totalNet = totalGross - totalDeductions;
    const paid = periodRows.filter((e) => e.paid).length;
    return {
      totalGross,
      totalDeductions,
      totalNet,
      paid,
      unpaid: periodRows.length - paid,
    };
  }, [employees, month, year]);

  const totalPayable = stats.totalNet;

  const togglePaid = async (id) => {
    try {
      await api.payroll.markPaid(id);
      toast("Salary marked as paid", "success");
      reload();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const saveEmp = async () => {
    if (!isNonEmpty(form.staffId)) {
      toast("Select an employee", "error");
      return;
    }
    if (!isPositiveNumber(form.basic)) {
      toast("Basic salary must be a positive number", "error");
      return;
    }
    if (!isNonNegativeNumber(form.allowances)) {
      toast("Allowances must be a non-negative number", "error");
      return;
    }
    if (!isNonNegativeNumber(form.deductions)) {
      toast("Deductions must be a non-negative number", "error");
      return;
    }
    try {
      await api.payroll.create({
        staffId: form.staffId,
        month,
        year,
        basic: Number(form.basic),
        allowances: Number(form.allowances),
        deductions: Number(form.deductions),
      });
      toast("Employee added to payroll");
      setShowModal(false);
      setForm(emptyForm());
      reload();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const openAdd = () => {
    setForm(emptyForm());
    setShowModal(true);
  };

  const exportCsv = () => {
    const header = [
      "ID",
      "Name",
      "Department",
      "Basic",
      "Allowances",
      "Deductions",
      "Net",
      "Status",
    ];
    const rows = filtered.map((e) => [
      e.id,
      e.name,
      e.department,
      e.basic,
      e.allowances,
      e.deductions,
      e.basic + e.allowances - e.deductions,
      e.paid ? "Paid" : "Pending",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${month}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Payroll exported");
  };

  const openPayslip = (e) => setPayslip(e);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Human Resources"
        title="Payroll Management"
        description="Manage staff salaries, payslips and monthly payments."
        right={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportCsv}>
              <Download size={15} /> Export CSV
            </Button>
            <PermissionGate permission="payroll:admin">
              <Button variant="amber" onClick={openAdd}>
                <Plus size={15} /> Add Employee
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-black/[0.06]">
          <div className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-white p-1.5 shadow-sm">
            <Select
              value={month}
              className="!w-auto !min-w-[135px] !border-0 !bg-transparent !px-3 !py-1.5 font-semibold hover:!border-0 focus:!border-0 focus:!ring-0"
              onChange={(e) =>
                setPeriod((p) => ({ ...p, month: e.target.value }))
              }
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
            <span className="text-slate-text/30 text-[13px] select-none">
              /
            </span>
            <Select
              value={year}
              className="!w-auto !min-w-[85px] !border-0 !bg-transparent !px-3 !py-1.5 font-semibold hover:!border-0 focus:!border-0 focus:!ring-0"
              onChange={(e) =>
                setPeriod((p) => ({ ...p, year: Number(e.target.value) }))
              }
            >
              {[2024, 2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-2 text-[13px] text-slate-text">
            <BadgeCheck size={15} className="text-success" /> Net payable{" "}
            <span className="font-semibold text-ink">
              ₹{totalPayable.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Wallet}
          label="Gross Payroll"
          value={`₹${stats.totalGross.toLocaleString("en-IN")}`}
          sub="Basic + allowances"
          accent="amber"
        />
        <StatCard
          icon={TrendingUp}
          label="Net Payable"
          value={`₹${totalPayable.toLocaleString("en-IN")}`}
          sub={`After ₹${stats.totalDeductions.toLocaleString("en-IN")} ded.`}
          accent="info"
        />
        <StatCard
          icon={BadgeCheck}
          label="Paid"
          value={`${stats.paid} / ${employees.length}`}
          sub="This month"
          accent="success"
        />
        <StatCard
          icon={Clock}
          label="Unpaid"
          value={String(stats.unpaid)}
          sub="Awaiting payment"
          accent="alert"
        />
      </div>

      <Card
        title={`Payroll Sheet — ${month} ${year}`}
        action={
          <div className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-white p-1.5 shadow-sm">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
              />
              <Input
                placeholder="Search employee..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="!pl-8 !w-52 !border-0 !bg-transparent !py-1.5 !px-3 hover:!border-0 focus:!border-0 focus:!ring-0"
              />
            </div>
            <span className="text-slate-text/30 text-[13px] select-none">
              /
            </span>
            <Select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="!w-auto !min-w-[130px] !border-0 !bg-transparent !px-3 !py-1.5 font-semibold hover:!border-0 focus:!border-0 focus:!ring-0"
            >
              {depts.map((d) => (
                <option key={d} value={d}>
                  {d === "All" ? "All Departments" : d}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="py-14 text-center">
            <Wallet size={36} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[14px] font-medium text-ink">
              No employees found
            </p>
            <p className="text-[13px] text-slate-text/60 mt-1">
              Adjust filters or add a new payroll entry.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/[0.06]">
                  <th className="px-5 py-2.5 font-semibold">Employee</th>
                  <th className="px-5 py-2.5 font-semibold">Department</th>
                  <th className="px-5 py-2.5 font-semibold">Basic</th>
                  <th className="px-5 py-2.5 font-semibold">Allowances</th>
                  <th className="px-5 py-2.5 font-semibold">Deductions</th>
                  <th className="px-5 py-2.5 font-semibold">Net</th>
                  <th className="px-5 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const net = e.basic + e.allowances - e.deductions;
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-black/[0.04] hover:bg-paper/60"
                    >
                      <td className="px-5 py-3">
                        <p className="font-semibold text-ink">{e.name}</p>
                        <p className="text-[11.5px] text-slate-text/50">
                          {e.id} · {e.designation}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-slate-text">
                        {e.department}
                      </td>
                      <td className="px-5 py-3 text-slate-text">
                        ₹{e.basic.toLocaleString("en-IN")}
                      </td>
                      <td className="px-5 py-3 text-slate-text">
                        ₹{e.allowances.toLocaleString("en-IN")}
                      </td>
                      <td className="px-5 py-3 text-slate-text">
                        -₹{e.deductions.toLocaleString("en-IN")}
                      </td>
                      <td className="px-5 py-3 font-semibold text-ink">
                        ₹{net.toLocaleString("en-IN")}
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={e.paid ? "success" : "amber"}>
                          {e.paid ? "Paid" : "Pending"}
                        </Pill>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openPayslip(e)}
                            className="inline-flex items-center gap-1 text-[12px] font-semibold text-info hover:underline"
                          >
                            <FileText size={14} /> Payslip
                          </button>
                          {!e.paid && (
                            <button
                              onClick={() => togglePaid(e.id)}
                              className="text-[12px] font-semibold text-success hover:underline"
                            >
                              Pay
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <h3 className="font-display font-semibold text-ink text-[17px]">
                Add Employee
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <PayField label="Employee *">
                <Select
                  value={form.staffId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, staffId: e.target.value }))
                  }
                >
                  <option value="">Select staff…</option>
                  {staffList.map((s) => (
                    <option
                      key={String(s._id || s.id)}
                      value={String(s._id || s.id)}
                    >
                      {s.name}
                      {s.employeeId ? ` (${s.employeeId})` : ""}
                    </option>
                  ))}
                </Select>
              </PayField>
              <p className="text-[12px] text-slate-text/60 -mt-2">
                Creates a payroll entry for the selected staff for {month}{" "}
                {year}.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <PayField label="Basic Salary">
                  <Input
                    type="number"
                    min={0}
                    value={form.basic}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, basic: Number(e.target.value) }))
                    }
                  />
                </PayField>
                <PayField label="Allowances">
                  <Input
                    type="number"
                    min={0}
                    value={form.allowances}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        allowances: Number(e.target.value),
                      }))
                    }
                  />
                </PayField>
              </div>
              <PayField label="Deductions">
                <Input
                  type="number"
                  min={0}
                  value={form.deductions}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      deductions: Number(e.target.value),
                    }))
                  }
                />
              </PayField>
            </div>
            <div className="px-5 py-4 border-t border-black/[0.06] flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                variant="amber"
                onClick={saveEmp}
                disabled={!form.staffId || !Number(form.basic)}
              >
                <Save size={15} /> Add Employee
              </Button>
            </div>
          </div>
        </div>
      )}

      {payslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setPayslip(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <h3 className="font-display font-semibold text-ink text-[17px]">
                Payslip — {month} {year}
              </h3>
              <button
                onClick={() => setPayslip(null)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-5 space-y-3">
              <div className="text-center">
                <p className="font-display font-bold text-ink text-[18px]">
                  {school?.name || "Zipschool OS"}
                </p>
                <p className="text-[12px] text-slate-text/60">
                  Salary Statement — {month} {year}
                </p>
              </div>
              <div className="h-px bg-black/[0.06]" />
              <div className="grid grid-cols-2 gap-2 text-[13px]">
                <div>
                  <span className="text-slate-text/60">Employee</span>
                  <p className="font-semibold text-ink">{payslip.name}</p>
                </div>
                <div>
                  <span className="text-slate-text/60">ID</span>
                  <p className="font-mono font-medium text-ink">{payslip.id}</p>
                </div>
                <div>
                  <span className="text-slate-text/60">Department</span>
                  <p className="font-medium text-ink">{payslip.department}</p>
                </div>
                <div>
                  <span className="text-slate-text/60">Designation</span>
                  <p className="font-medium text-ink">{payslip.designation}</p>
                </div>
              </div>
              <div className="h-px bg-black/[0.06]" />
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-slate-text">Basic</span>
                  <span className="font-medium text-ink">
                    ₹{payslip.basic.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-text">Allowances</span>
                  <span className="font-medium text-ink">
                    + ₹{payslip.allowances.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-text">Deductions</span>
                  <span className="font-medium text-ink">
                    - ₹{payslip.deductions.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
              <div className="h-px bg-black/[0.06]" />
              <div className="flex justify-between items-center">
                <span className="text-[14px] font-semibold text-ink">
                  Net Salary
                </span>
                <span className="text-[20px] font-display font-bold text-success">
                  ₹
                  {(
                    payslip.basic +
                    payslip.allowances -
                    payslip.deductions
                  ).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-end">
                <Pill tone={payslip.paid ? "success" : "amber"}>
                  {payslip.paid ? "Paid" : "Pending"}
                </Pill>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PayField({ label, children }) {
  return (
    <div>
      <label className="text-[12px] font-semibold text-ink mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}
