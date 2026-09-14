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
  Pencil,
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
import SearchableSelect from "../components/SearchableSelect";
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
    basic: "",
    allowances: "",
    deductions: "",
    deductionReason: "",
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
  const [editing, setEditing] = useState(null);

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
            employeeId: s?.employeeId || "—",
            name: s?.name || "Staff member",
            department: s?.department || "—",
            designation: s?.designation || "—",
            month: p.month,
            year: p.year,
            basic: Number(p.basic || 0),
            allowances: Number(p.allowances || 0),
            deductions: Number(p.deductions || 0),
            deductionReason: p.deductionReason || "",
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
        e.employeeId.toLowerCase().includes(q) ||
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
    if (form.allowances !== "" && !isNonNegativeNumber(form.allowances)) {
      toast("Allowances must be a non-negative number", "error");
      return;
    }
    if (form.deductions !== "" && !isNonNegativeNumber(form.deductions)) {
      toast("Deductions must be a non-negative number", "error");
      return;
    }
    const ded = Number(form.deductions) || 0;
    if (ded > 0 && !isNonEmpty(form.deductionReason)) {
      toast("Please provide a reason for the deduction", "error");
      return;
    }
    try {
      await api.payroll.create({
        staffId: form.staffId,
        month,
        year,
        basic: Number(form.basic),
        allowances: Number(form.allowances) || 0,
        deductions: ded,
        deductionReason: form.deductionReason || "",
      });
      toast("Payroll entry created");
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

  const [generating, setGenerating] = useState(false);

  const openEdit = (e) => {
    setEditing({
      id: e.id,
      name: e.name,
      basic: String(e.basic),
      allowances: String(e.allowances),
      deductions: String(e.deductions),
      deductionReason: "",
    });
  };

  const saveEdit = async () => {
    if (!isPositiveNumber(editing.basic)) {
      toast("Basic salary must be a positive number", "error");
      return;
    }
    if (editing.allowances !== "" && !isNonNegativeNumber(editing.allowances)) {
      toast("Allowances must be a non-negative number", "error");
      return;
    }
    if (editing.deductions !== "" && !isNonNegativeNumber(editing.deductions)) {
      toast("Deductions must be a non-negative number", "error");
      return;
    }
    const ded = Number(editing.deductions) || 0;
    if (ded > 0 && !isNonEmpty(editing.deductionReason)) {
      toast("Please provide a reason for the deduction", "error");
      return;
    }
    try {
      await api.payroll.update(editing.id, {
        basic: Number(editing.basic),
        allowances: Number(editing.allowances) || 0,
        deductions: ded,
        deductionReason: editing.deductionReason || "",
      });
      toast("Payroll entry updated");
      setEditing(null);
      reload();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const generateAll = async () => {
    if (!window.confirm(`Generate payroll for ALL active staff for ${month} ${year}? Staff with existing entries will be skipped.`)) return;
    setGenerating(true);
    try {
      const { data } = await api.payroll.generateAll(month, year);
      toast(`Created ${data.created} new payroll entries (${data.skipped} already existed)`);
      reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setGenerating(false);
    }
  };

  const exportCsv = () => {
    const header = [
      "Employee ID",
      "Name",
      "Department",
      "Basic",
      "Allowances",
      "Deductions",
      "Net",
      "Status",
    ];
    const rows = filtered.map((e) => [
      e.employeeId,
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
              <Button variant="outline" onClick={generateAll} disabled={generating}>
                <TrendingUp size={15} /> {generating ? "Generating…" : "Generate for all staff"}
              </Button>
            </PermissionGate>
            <PermissionGate permission="payroll:admin">
              <Button variant="amber" onClick={openAdd}>
                <Plus size={15} /> Create new payroll entry
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <Card className="!p-0">
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
                          {e.employeeId} · {e.designation}
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
                            <>
                              <button
                                onClick={() => openEdit(e)}
                                className="p-1 rounded hover:bg-paper text-slate-text/60 hover:text-ink"
                                title="Edit entry"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => togglePaid(e.id)}
                                className="text-[12px] font-semibold text-success hover:underline"
                              >
                                Release Salary
                              </button>
                            </>
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
                Create Payroll Entry
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
                <SearchableSelect
                  options={staffList.map((s) => String(s._id || s.id))}
                  value={form.staffId}
                  onChange={(sid) => {
                    const selected = staffList.find(
                      (s) => String(s._id || s.id) === sid,
                    );
                    setForm((f) => ({
                      ...f,
                      staffId: sid,
                      basic: selected?.salary || f.basic,
                    }));
                  }}
                  placeholder="Search by name or staff ID…"
                  renderLabel={(sid) => {
                    const s = staffList.find(
                      (st) => String(st._id || st.id) === sid,
                    );
                    return s
                      ? `${s.name}${s.employeeId ? ` (${s.employeeId})` : ""}`
                      : sid;
                  }}
                />
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
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, basic: e.target.value }))
                    }
                  />
                </PayField>
                <PayField label="Allowances">
                  <Input
                    type="number"
                    min={0}
                    value={form.allowances}
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        allowances: e.target.value,
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
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      deductions: e.target.value,
                    }))
                  }
                />
              </PayField>
              {Number(form.deductions) > 0 && (
                <PayField label="Deduction Reason *">
                  <Input
                    type="text"
                    placeholder="e.g. Late attendance, advance recovery…"
                    value={form.deductionReason}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        deductionReason: e.target.value,
                      }))
                    }
                  />
                </PayField>
              )}
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
                <Save size={15} /> Create Payroll Entry
              </Button>
            </div>
          </div>
        </div>
      )}

      {payslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="payslip-print-root">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setPayslip(null)}
          />
          <div className="relative bg-white shadow-2xl w-full max-w-[780px] overflow-hidden payslip-a4">
            {/* Close button — hidden on print */}
            <button
              onClick={() => setPayslip(null)}
              className="absolute top-3 right-3 z-10 p-2 rounded-lg hover:bg-ink/10 text-ink/40 hover:text-ink payslip-hide-on-print"
            >
              <X size={18} />
            </button>

            {/* School Header */}
            <div className="bg-ink px-8 py-5 flex items-center gap-5">
              {school?.logo ? (
                <img
                  src={school.logo}
                  alt="School Logo"
                  className="w-16 h-16 rounded-lg object-contain bg-white p-1 shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center text-amber font-display font-bold text-[22px] shrink-0">
                  {(school?.shortName || "S").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-white text-[19px] truncate">
                  {school?.name || "School Name"}
                </p>
                <p className="text-amber/80 text-[12px] truncate">
                  {[school?.address, school?.city, school?.state].filter(Boolean).join(", ")}
                </p>
                <p className="text-white/50 text-[11px] mt-0.5">
                  {[school?.phone, school?.email].filter(Boolean).join(" · ")}
                  {school?.website ? ` · ${school.website}` : ""}
                </p>
              </div>
            </div>

            {/* Title bar */}
            <div className="bg-paper/60 border-b border-black/[0.06] px-8 py-3 flex items-center justify-between">
              <div>
                <p className="font-display font-bold text-ink text-[16px]">Salary Slip</p>
                <p className="text-[12px] text-slate-text/60">{month} {year}</p>
              </div>
              <div className="text-right text-[11px] text-slate-text/50">
                {school?.board && <p>Board: <span className="font-medium text-ink">{school.board}</span></p>}
                {school?.recognitionNumber && <p>Affiliation: <span className="font-medium text-ink">{school.recognitionNumber}</span></p>}
              </div>
            </div>

            <div className="px-8 py-5 space-y-5">
              {/* Employee details grid */}
              <div className="grid grid-cols-3 gap-x-6 gap-y-3 text-[13px] border border-black/[0.06] rounded-xl p-4">
                <div>
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-text/50">Employee Name</span>
                  <p className="font-semibold text-ink mt-0.5">{payslip.name}</p>
                </div>
                <div>
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-text/50">Employee ID</span>
                  <p className="font-mono font-medium text-ink mt-0.5">{payslip.employeeId}</p>
                </div>
                <div>
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-text/50">Department</span>
                  <p className="font-medium text-ink mt-0.5">{payslip.department}</p>
                </div>
                <div>
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-text/50">Designation</span>
                  <p className="font-medium text-ink mt-0.5">{payslip.designation}</p>
                </div>
                <div>
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-text/50">Pay Period</span>
                  <p className="font-medium text-ink mt-0.5">{month} {year}</p>
                </div>
                <div>
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-text/50">Payment Date</span>
                  <p className="font-medium text-ink mt-0.5">{payslip.paid ? new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</p>
                </div>
              </div>

              {/* Earnings + Deductions side by side */}
              <div className="grid grid-cols-2 gap-5">
                {/* Earnings */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-text/50 mb-2">Earnings</p>
                  <div className="rounded-xl border border-black/[0.06] divide-y divide-black/[0.04]">
                    <div className="flex justify-between px-4 py-2.5 text-[13px]">
                      <span className="text-slate-text">Basic Salary</span>
                      <span className="font-semibold text-ink">₹{payslip.basic.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5 text-[13px]">
                      <span className="text-slate-text">Allowances</span>
                      <span className="font-semibold text-success">+ ₹{payslip.allowances.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5 text-[13px] bg-success/[0.03]">
                      <span className="font-semibold text-ink">Gross Earnings</span>
                      <span className="font-bold text-ink">₹{(payslip.basic + payslip.allowances).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-text/50 mb-2">Deductions</p>
                  <div className="rounded-xl border border-black/[0.06] divide-y divide-black/[0.04]">
                    <div className="flex justify-between px-4 py-2.5 text-[13px]">
                      <span className="text-slate-text">Deductions</span>
                      <span className="font-semibold text-alert">- ₹{payslip.deductions.toLocaleString("en-IN")}</span>
                    </div>
                    {payslip.deductions > 0 && payslip.deductionReason && (
                      <div className="px-4 py-2 text-[12px] text-slate-text/60">
                        Reason: {payslip.deductionReason}
                      </div>
                    )}
                    <div className="flex justify-between px-4 py-2.5 text-[13px] bg-alert/[0.03]">
                      <span className="font-semibold text-ink">Total Deductions</span>
                      <span className="font-bold text-alert">₹{payslip.deductions.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net salary */}
              <div className="rounded-xl bg-ink px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-white/80 font-semibold">Net Payable</p>
                  <p className="text-[11px] text-white/40">After all deductions</p>
                </div>
                <p className="text-[28px] font-display font-bold text-amber">
                  ₹{(payslip.basic + payslip.allowances - payslip.deductions).toLocaleString("en-IN")}
                </p>
              </div>

              {/* Signature + footer */}
              <div className="flex items-end justify-between pt-2 border-t border-black/[0.06]">
                <div className="text-[12px] text-slate-text/50">
                  {school?.recognitionAuthority && <p>Authority: {school.recognitionAuthority}</p>}
                  <p className="mt-1">This is a computer-generated payslip.</p>
                </div>
                <div className="text-center">
                  <div className="border-t border-ink/30 w-40 pt-1 text-[12px] text-slate-text/60">
                    Authorized Signatory
                  </div>
                </div>
              </div>

              {/* Status + actions */}
              <div className="flex items-center justify-between pt-1 payslip-hide-on-print">
                <Pill tone={payslip.paid ? "success" : "amber"}>
                  {payslip.paid ? "Paid" : "Pending"}
                </Pill>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPayslip(null)}>Close</Button>
                  <Button variant="amber" onClick={() => window.print()}>
                    <Download size={14} /> Print
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setEditing(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <h3 className="font-display font-semibold text-ink text-[17px]">
                Edit Payroll — {editing.name}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <PayField label="Basic Salary">
                  <Input
                    type="number"
                    min={0}
                    value={editing.basic}
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    onChange={(e) =>
                      setEditing((f) => ({ ...f, basic: e.target.value }))
                    }
                  />
                </PayField>
                <PayField label="Allowances">
                  <Input
                    type="number"
                    min={0}
                    value={editing.allowances}
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    onChange={(e) =>
                      setEditing((f) => ({ ...f, allowances: e.target.value }))
                    }
                  />
                </PayField>
              </div>
              <PayField label="Deductions">
                <Input
                  type="number"
                  min={0}
                  value={editing.deductions}
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onChange={(e) =>
                    setEditing((f) => ({ ...f, deductions: e.target.value }))
                  }
                />
              </PayField>
              {Number(editing.deductions) > 0 && (
                <PayField label="Deduction Reason *">
                  <Input
                    type="text"
                    placeholder="e.g. Late attendance, advance recovery…"
                    value={editing.deductionReason}
                    onChange={(e) =>
                      setEditing((f) => ({
                        ...f,
                        deductionReason: e.target.value,
                      }))
                    }
                  />
                </PayField>
              )}
            </div>
            <div className="px-5 py-4 border-t border-black/[0.06] flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button variant="amber" onClick={saveEdit}>
                <Save size={15} /> Save Changes
              </Button>
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
