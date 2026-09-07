import { useEffect, useMemo, useState } from "react";
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
const DEPARTMENTS = [
  "Teaching",
  "Administration",
  "Transport",
  "Academic",
  "Finance",
];

function payMonth() {
  const d = new Date();
  const idx = d.getMonth() >= 3 ? d.getMonth() - 3 : d.getMonth() + 9;
  return { month: MONTHS[idx], year: d.getFullYear() };
}

function nextEmp(list) {
  const max = list.reduce((m, e) => {
    const num = parseInt(String(e.id).replace(/\D/g, ""), 10);
    return Number.isFinite(num) && num > m ? num : m;
  }, 0);
  return `EMP-${max + 1}`;
}

function emptyForm() {
  return {
    name: "",
    department: "Teaching",
    designation: "",
    basic: 0,
    allowances: 0,
    deductions: 0,
    paid: false,
  };
}

export default function Payroll() {
  const [employees, setEmployees] = useState(payrollSeed);
  useEffect(() => {
    api.payroll
      .list()
      .then(({ data }) => setEmployees(data || []))
      .catch(() => {});
  }, []);
  const [{ month, year }, setPeriod] = useState(payMonth());
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [payslip, setPayslip] = useState(null);

  const depts = useMemo(
    () => ["All", ...new Set(employees.map((e) => e.department))],
    [employees],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return employees.filter((e) => {
      const matchDept = deptFilter === "All" || e.department === deptFilter;
      const matchQuery =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q);
      return matchDept && matchQuery;
    });
  }, [employees, query, deptFilter]);

  const stats = useMemo(() => {
    const totalGross = employees.reduce(
      (a, e) => a + e.basic + e.allowances,
      0,
    );
    const totalDeductions = employees.reduce((a, e) => a + e.deductions, 0);
    const totalNet = totalGross - totalDeductions;
    const paid = employees.filter((e) => e.paid).length;
    return {
      totalGross,
      totalDeductions,
      totalNet,
      paid,
      unpaid: employees.length - paid,
    };
  }, [employees]);

  const totalPayable = stats.totalNet;

  const togglePaid = (id) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, paid: !e.paid } : e)),
    );
    const emp = employees.find((e) => e.id === id);
    if (emp)
      toast(
        emp.paid ? "Payment marked unpaid" : "Salary marked as paid",
        "success",
      );
  };

  const saveEmp = () => {
    if (!form.name.trim()) return;
    if (form.id) {
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === form.id ? { ...form, name: form.name.trim() } : e,
        ),
      );
      toast("Employee updated");
    } else {
      setEmployees((prev) => [
        { id: nextEmp(prev), ...form, name: form.name.trim() },
        ...prev,
      ]);
      toast("Employee added to payroll");
    }
    setShowModal(false);
    setForm(emptyForm());
  };

  const openAdd = () => {
    setForm({
      id: "",
      name: "",
      department: "Teaching",
      designation: "",
      basic: 0,
      allowances: 0,
      deductions: 0,
      paid: false,
    });
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
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Download size={15} /> Export CSV
            </Button>
            <PermissionGate permission="payroll:admin">
              <Button variant="amber" onClick={openAdd}>
                <Plus size={15} /> Add Employee
              </Button>
            </PermissionGate>
          </>
        }
      />

      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-black/[0.06]">
          <Select
            value={month}
            className="min-w-[150px] font-semibold"
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
          <Select
            value={year}
            className="min-w-[110px] font-semibold"
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
              />
              <Input
                placeholder="Search employee..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 w-52"
              />
            </div>
            <Select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="min-w-[130px]"
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
                          <button
                            onClick={() => togglePaid(e.id)}
                            className={`text-[12px] font-semibold hover:underline ${e.paid ? "text-alert" : "text-success"}`}
                          >
                            {e.paid ? "Unmark" : "Pay"}
                          </button>
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
                {form.id ? "Edit Employee" : "Add Employee"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <PayField label="Name *">
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </PayField>
                <PayField label="Designation">
                  <Input
                    value={form.designation}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, designation: e.target.value }))
                    }
                  />
                </PayField>
              </div>
              <PayField label="Department">
                <Select
                  value={form.department}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, department: e.target.value }))
                  }
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </PayField>
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
                disabled={!form.name.trim()}
              >
                <Save size={15} /> {form.id ? "Update" : "Add Employee"}
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
                  Brightwood International School
                </p>
                <p className="text-[12px] text-slate-text/60">
                  143, New Market, Bhopal
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
