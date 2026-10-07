import { useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  Phone,
  Mail,
  MapPin,
  Droplet,
  Save,
  Pencil,
  Eye,
  CreditCard,
  Printer,
  Users,
  UserCheck,
  Wallet,
  Trash2,
  Plus,
  Upload,
  FileText,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Input,
  Select,
  Pill,
  statusTone,
  Avatar,
  StatCard,
  toast,
} from "../components/UI";
import SearchableSelect from "../components/SearchableSelect";
import { Pagination } from "../components/Pagination";
const initialStudents = [];
import { api } from "../lib/api";
import { PermissionGate, usePermission } from "../lib/permissions";
import {
  deriveFeeStatus,
  groupInvoicesByStudent,
  loadAllInvoices,
} from "../lib/feeStatus";
import { useMasterOptions } from "../hooks/useMasterOptions";
import { useSelector } from "react-redux";
import { selectSchool } from "../store/selectors";
import { isNonEmpty, isValidEmail, isValidPhone } from "../lib/validation.js";
import StudentIdCard, { printIdCard } from "../components/idcard/StudentIdCard";
import { printCharacterCertificate } from "../components/certificates/characterCertificate";

const CLASS_OPTIONS_FALLBACK = [
  "All",
  "Nursery",
  "LKG",
  "UKG",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11-Sci",
  "11-Com",
  "12-Sci",
  "12-Com",
];

const SECTION_OPTIONS_FALLBACK = ["A", "B", "C"];
const HOUSE_OPTIONS = ["Aravali", "Nilgiri", "Shivalik", "Vindhya"];
const GENDER_OPTIONS = ["Male", "Female"];
const BLOOD_OPTIONS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const MEDIUM_OPTIONS = ["English", "Hindi"];
// Mirrors the Student.status enum in student-service/src/models/Student.js.
const STATUS_OPTIONS = ["Active", "Inactive", "Alumni", "Transferred"];
const PAGE_SIZE = 20;

function formatClass(c) {
  if (["Nursery", "LKG", "UKG"].includes(c)) return c;
  if (String(c).startsWith("11") || String(c).startsWith("12"))
    return `Class ${c}`;
  return `Class ${c}`;
}

function emptyForm() {
  return {
    name: "",
    gender: "Male",
    class: "8",
    section: "A",
    roll: "",
    dob: "",
    bloodGroup: "A+",
    medium: "English",
    fatherName: "",
    motherName: "",
    contact: "",
    email: "",
    address: "",
    house: "Aravali",
    feeStatus: "Pending",
    attendance: 95,
    admissionNo: "",
    status: "Active",
  };
}

function makeAvatar(name) {
  const encoded = encodeURIComponent(name || "Student");
  return `https://ui-avatars.com/api/?name=${encoded}&background=172033&color=fff&bold=true`;
}

function toRollText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function normalizeStudent(student) {
  return {
    ...student,
    id: student.id || student._id || student.admissionNo,
    admissionNo: student.admissionNo || "",
    roll: toRollText(student.roll ?? student.rollNo),
    contact: student.contact || student.parentContact || "",
    email: student.email || student.parentEmail || "",
    fatherName: student.fatherName || student.parentName || "",
    motherName: student.motherName || "",
    medium: student.medium || "English",
    feeStatus: student.feeStatus || "Pending",
    attendance: student.attendance ?? 0,
    house: student.house || "Aravali",
    avatar: student.avatar || student.photoUrl || makeAvatar(student.name),
  };
}

function toApiStudent(form, admissionNo) {
  return {
    admissionNo,
    name: form.name.trim(),
    gender: form.gender,
    class: form.class,
    section: form.section,
    rollNo: String(form.roll || "").trim(),
    dob: form.dob || undefined,
    bloodGroup: form.bloodGroup,
    medium: form.medium,
    address: form.address,
    parentName: form.fatherName,
    parentContact: form.contact,
    parentEmail: form.email,
    // Lifecycle status is preserved, never reset: hardcoding "Active" here
    // flipped every Inactive / Alumni / Transferred student back to Active on
    // any edit (C10).
    status: form.status || "Active",
  };
}

// One derivation for the Fee Status shown in the list, the stats strip and the
// profile drawer. Invoice-less students keep their own record status (Pending
// from onboarding), never a default invented by this page.
function withFeeStatus(rows, invoices) {
  const byStudent = groupInvoicesByStudent(invoices);
  return rows.map((row) => ({
    ...row,
    feeStatus: deriveFeeStatus(
      byStudent.get(String(row.admissionNo)) || [],
      row.feeStatus,
    ),
  }));
}

// ── Bulk import (C11) ───────────────────────────────────────────────────────
// Client-side CSV parsing so the admin can preview exactly what will be sent;
// the server re-validates every row anyway (same code path as a single add).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else quoted = false;
      } else field += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

// Column aliases a school office is likely to use in its spreadsheet header.
const CSV_ALIASES = {
  admissionno: "admissionNo", "admission id": "admissionNo", admission: "admissionNo", id: "admissionNo",
  name: "name", "student name": "name", "student": "name",
  gender: "gender", sex: "gender",
  class: "class", grade: "class", "class name": "class",
  section: "section", sec: "section",
  roll: "rollNo", rollno: "rollNo", "roll no": "rollNo", "roll number": "rollNo",
  dob: "dob", "date of birth": "dob", birthday: "dob",
  bloodgroup: "bloodGroup", "blood group": "bloodGroup",
  medium: "medium",
  address: "address", "full address": "address",
  father: "fatherName", fathername: "fatherName", "father name": "fatherName",
  parent: "fatherName", "parent name": "fatherName", parentname: "fatherName",
  mother: "motherName", mothername: "motherName", "mother name": "motherName",
  phone: "contact", contact: "contact", mobile: "contact", "parent contact": "contact", "phone number": "contact",
  email: "email", "parent email": "email", "email address": "email",
  status: "status",
};

function csvRowsToStudents(rows) {
  if (!rows.length) return { columns: [], records: [] };
  const header = rows[0].map((h) => String(h).trim());
  const columns = header.map((h) => CSV_ALIASES[h.toLowerCase().replace(/[_-]+/g, " ")] || null);
  const records = rows.slice(1).map((cells, idx) => {
    const record = { __row: idx + 2 };
    columns.forEach((key, i) => {
      if (!key) return;
      const value = String(cells[i] == null ? "" : cells[i]).trim();
      if (value !== "") record[key] = value;
    });
    return record;
  });
  return { columns, records };
}

export default function Students() {
  const school = useSelector(selectSchool);
  // Fee status is derived from invoices, and GET /fees needs fees:read — roles
  // without it (teacher, librarian, transport…) simply keep the record's own
  // status instead of hitting a 403.
  const canReadFees = usePermission("fees:read");
  const { options: masterClasses } = useMasterOptions("classes", CLASS_OPTIONS_FALLBACK);
  const { options: masterSections, rawItems: rawSections } = useMasterOptions("sections", SECTION_OPTIONS_FALLBACK);
  const CLASS_OPTIONS = ["All", ...masterClasses.filter((c) => c !== "All")];
  const SECTION_OPTIONS = ["All", ...masterSections.filter((s) => s !== "All")];
  const [list, setList] = useState(initialStudents);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [query, setQuery] = useState("");
  const [cls, setCls] = useState("All");
  const [section, setSection] = useState("All");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [cardStudent, setCardStudent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  // Phase 2: soft-deleted students are hidden by default; the toggle exposes
  // the trash so an admin can restore within the retention window.
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  // Bulk import (C11): paste/upload a CSV, preview, then send one request.
  const [showImport, setShowImport] = useState(false);
  const [importName, setImportName] = useState("");
  const [importRecords, setImportRecords] = useState([]);
  const [importColumns, setImportColumns] = useState([]);
  const [importError, setImportError] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);
  // Bumped after an import so the list refetches without a full remount.
  const [reloadKey, setReloadKey] = useState(0);
  const filteredSections = useMemo(() => {
    if (cls === "All") return SECTION_OPTIONS;
    return ["All", ...[...new Set(rawSections.filter((s) => s.className === cls).map((s) => s.name))]];
  }, [cls, SECTION_OPTIONS, rawSections]);
  const filteredModalSections = useMemo(() => {
    if (!form.class) return SECTION_OPTIONS.filter((s) => s !== "All");
    return [...new Set(rawSections.filter((s) => s.className === form.class).map((s) => s.name))];
  }, [form.class, SECTION_OPTIONS, rawSections]);

  useEffect(() => {
    let active = true;
    const studentsRequest = api.students.list(
      `limit=1000${includeDeleted ? "&includeDeleted=true" : ""}`,
    );
    // One load, one source of truth: students and their invoices arrive
    // together so the Fee Status column can never lag behind the record.
    const invoicesRequest = canReadFees
      ? loadAllInvoices().catch(() => [])
      : Promise.resolve([]);
    Promise.all([studentsRequest, invoicesRequest])
      .then(([studentResponse, loadedInvoices]) => {
        if (!active) return;
        if (Array.isArray(studentResponse.data)) {
          setList(withFeeStatus(studentResponse.data.map(normalizeStudent), loadedInvoices));
        }
        setInvoices(loadedInvoices);
      })
      .catch((error) => {
        if (active) setApiError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [includeDeleted, reloadKey, canReadFees]);

  const filtered = useMemo(() => {
    return list
      .filter((s) => {
        const matchClass = cls === "All" || s.class === cls;
        const matchSection = section === "All" || s.section === section;
        const q = query.toLowerCase();
        const matchQuery =
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          (s.admissionNo || "").toLowerCase().includes(q) ||
          String(s.roll).includes(q) ||
          (s.contact || "").includes(q);
        return matchClass && matchSection && matchQuery;
      })
      .sort((a, b) =>
        String(a.roll).localeCompare(String(b.roll), undefined, {
          numeric: true,
        }),
      );
  }, [list, query, cls, section]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const stats = useMemo(() => {
    // Deleted students never count toward overview stats, even when the
    // "show deleted" toggle is on.
    const active = list.filter((s) => !s.deletedAt);
    const total = active.length;
    const paid = active.filter((s) => s.feeStatus === "Paid").length;
    const avgAtt =
      total > 0
        ? Math.round(active.reduce((a, s) => a + (s.attendance || 0), 0) / total)
        : 0;
    return { total, paid, avgAtt, pending: total - paid };
  }, [list]);

  const handleDeleteStudent = async () => {
    if (!selected) return;
    if (!window.confirm(`Move "${selected.name}" to trash? The record (and its fee/attendance history) is kept and can be restored within the retention window.`)) return;
    setBusyAction(true);
    try {
      await api.students.remove(selected.id);
      toast("Student moved to trash");
      setSelected(null);
      api.students
        .list(`limit=1000${includeDeleted ? "&includeDeleted=true" : ""}`)
        .then(({ data }) => { if (Array.isArray(data)) setList(withFeeStatus(data.map(normalizeStudent), invoices)); })
        .catch(() => {});
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusyAction(false);
    }
  };

  const handleRestoreStudent = async () => {
    if (!selected) return;
    setBusyAction(true);
    try {
      const { data } = await api.students.restore(selected.id);
      toast("Student restored");
      setSelected(data ? withFeeStatus([normalizeStudent(data)], invoices)[0] : null);
      api.students
        .list(`limit=1000${includeDeleted ? "&includeDeleted=true" : ""}`)
        .then(({ data: rows }) => { if (Array.isArray(rows)) setList(withFeeStatus(rows.map(normalizeStudent), invoices)); })
        .catch(() => {});
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusyAction(false);
    }
  };

  const openEdit = (student) => {
    setEditId(student.id);
    setForm({
      name: student.name,
      gender: student.gender,
      class: student.class,
      section: student.section,
      roll: student.roll != null ? String(student.roll) : "",
      dob: student.dob,
      bloodGroup: student.bloodGroup,
      medium: student.medium || "English",
      fatherName: student.fatherName || "",
      motherName: student.motherName || "",
      contact: student.contact || "",
      email: student.email || "",
      address: student.address || "",
      house: student.house || "Aravali",
      feeStatus: student.feeStatus || "Pending",
      attendance: student.attendance || 95,
      admissionNo: student.admissionNo || "",
      status: student.status || "Active",
    });
    setShowModal(true);
    setSelected(null);
  };

  const updateForm = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSave = async () => {
    if (!isNonEmpty(form.name) || !isNonEmpty(form.roll)) {
      toast("Name and roll number are required", "error");
      return;
    }
    if (!editId && !form.admissionNo.trim()) {
      setApiError("Admission ID is required when adding a student");
      return;
    }
    if (form.email && !isValidEmail(form.email)) {
      toast("Enter a valid email", "error");
      return;
    }
    if (form.contact && !isValidPhone(form.contact)) {
      toast("Enter a valid phone number", "error");
      return;
    }

    try {
      const payload = toApiStudent(form, form.admissionNo.trim());
      const response = editId
        ? await api.students.update(editId, payload)
        : await api.students.create(payload);
      const saved = withFeeStatus([normalizeStudent(response.data)], invoices)[0];
      setList((prev) =>
        editId
          ? prev.map((student) => (student.id === editId ? saved : student))
          : [saved, ...prev],
      );
      setShowModal(false);
      setForm(emptyForm());
      setEditId(null);
      setApiError("");
    } catch (error) {
      setApiError(error.message);
    }
  };

  // ── Bulk import (C11) ─────────────────────────────────────────────────────
  const resetImport = () => {
    setShowImport(false);
    setImportName("");
    setImportRecords([]);
    setImportColumns([]);
    setImportError("");
    setImportResult(null);
  };

  const handleImportFile = async (event) => {
    const file = event.target.files && event.target.files[0];
    // Always clear so re-picking the same file fires a change event again.
    event.target.value = "";
    if (!file) return;
    setImportError("");
    setImportResult(null);
    setImportName(file.name);
    try {
      const text = await file.text();
      const { columns, records } = csvRowsToStudents(parseCsv(text));
      if (!records.length) {
        setImportRecords([]);
        setImportColumns([]);
        setImportError("That file has a header row but no data rows.");
        return;
      }
      if (!columns.includes("admissionNo")) {
        setImportRecords([]);
        setImportColumns([]);
        setImportError('Missing an "Admission ID" column — every row needs a unique Admission ID.');
        return;
      }
      setImportColumns(columns);
      setImportRecords(records);
    } catch (error) {
      setImportRecords([]);
      setImportColumns([]);
      setImportError(error.message || "Could not read that file");
    }
  };

  const handleImportSubmit = async () => {
    if (!importRecords.length) return;
    const payload = importRecords.map(({ __row, ...row }) => row);
    setImportBusy(true);
    setImportError("");
    setImportResult(null);
    try {
      const { data } = await api.students.bulkCreate(payload);
      setImportResult(data);
      setReloadKey((k) => k + 1);
      if (data && data.failed === 0) {
        toast(`Imported ${data.created} student${data.created === 1 ? "" : "s"}`);
        resetImport();
      } else if (data) {
        toast(`${data.created} imported, ${data.failed} failed`, "error");
      }
    } catch (error) {
      // The endpoint reports per-row outcomes in the body's `data` even when
      // it answers 400 (every row failed) — surface them instead of losing
      // which admission was rejected and why.
      const failed = error && error.data;
      if (failed && Array.isArray(failed.results)) {
        setImportResult(failed);
        setReloadKey((k) => k + 1);
        setImportError(error.message || "Some rows failed to import");
      } else {
        setImportError(error.message || "Import failed");
      }
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="Student Database"
        description={
          loading
            ? "Loading students..."
            : `${list.length} students enrolled across Nursery to Class 12.`
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            <PermissionGate permission="students:write">
              <Button
                variant="outline"
                onClick={() => {
                  resetImport();
                  setShowImport(true);
                }}
              >
                <Upload size={15} /> Import CSV
              </Button>
            </PermissionGate>
            <PermissionGate permission="students:write">
              <Button
                variant="primary"
                onClick={() => {
                  setEditId(null);
                  setForm(emptyForm());
                  setApiError("");
                  setShowModal(true);
                }}
              >
                <Plus size={15} /> Add Student
              </Button>
            </PermissionGate>
          </div>
        }
      />
      {apiError && (
        <p className="text-alert text-[13px]" role="alert">
          {apiError}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Students"
          value={String(stats.total)}
          sub="All classes"
          accent="info"
        />
        <StatCard
          icon={UserCheck}
          label="Avg Attendance"
          value={`${stats.avgAtt}%`}
          sub="School-wide"
          accent="success"
        />
        <StatCard
          icon={Wallet}
          label="Fees Paid"
          value={String(stats.paid)}
          sub={`${stats.pending} pending / partial`}
          accent="primary"
        />
        <StatCard
          icon={Users}
          label="Showing"
          value={String(filtered.length)}
          sub="After filters"
          accent="info"
        />
      </div>

      {/* Table */}
      <Card
        title="All Students"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
              />
              <Input
                placeholder="Search name, ID, roll, phone..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-8 w-56"
              />
            </div>
            <SearchableSelect
              options={CLASS_OPTIONS}
              value={cls}
              onChange={(v) => { setCls(v); setSection("All"); setPage(1); }}
              renderLabel={(c) => (c === "All" ? "All Classes" : formatClass(c))}
              placeholder="All Classes"
              className="min-w-[140px]"
            />
            <SearchableSelect
              options={filteredSections}
              value={section}
              onChange={(v) => { setSection(v); setPage(1); }}
              renderLabel={(s) => (s === "All" ? "All Sections" : `Section ${s}`)}
              placeholder="All Sections"
              className="min-w-[120px]"
            />
            <PermissionGate permission="students:write">
              <Button
                variant={includeDeleted ? "primary" : "outline"}
                className="px-3 py-1.5 text-[12px]"
                onClick={() => { setIncludeDeleted((v) => !v); setLoading(true); }}
              >
                {includeDeleted ? "Showing deleted" : "Show deleted"}
              </Button>
            </PermissionGate>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="py-14 text-center">
            <Users size={36} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[14px] font-medium text-ink">
              No students found
            </p>
            <p className="text-[13px] text-slate-text/60 mt-1">
              Try different filters.
            </p>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-slate-text/60 text-[11px] uppercase tracking-wide border-b border-slate-200">
                  <th className="px-4 py-2.5 font-semibold">Student</th>
                  <th className="px-4 py-2.5 font-semibold">Admission ID</th>
                  <th className="px-4 py-2.5 font-semibold">Class</th>
                  <th className="px-4 py-2.5 font-semibold">Medium</th>
                  <th className="px-4 py-2.5 font-semibold">Roll No.</th>
                  <th className="px-4 py-2.5 font-semibold">Attendance</th>
                  <th className="px-4 py-2.5 font-semibold">Fee Status</th>
                  <th className="px-4 py-2.5 font-semibold">Contact</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-paper/50 transition-colors cursor-pointer"
                    onClick={() => setSelected(s)}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar src={s.avatar} name={s.name} size={32} />
                        <div>
                          <p className="font-semibold text-ink text-[12.5px] leading-tight">{s.name}</p>
                          {s.deletedAt && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-alert">
                              deleted
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-[11.5px] font-semibold text-slate-text/70 bg-paper px-1.5 py-0.5 rounded">
                        {s.admissionNo || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-text text-[12px]">
                      {formatClass(s.class)}-{s.section}
                    </td>
                    <td className="px-4 py-2.5 text-slate-text text-[12px]">
                      {s.medium || "—"}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-ink text-[12px]">
                      {s.roll || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`font-semibold text-[12px] ${
                          s.attendance >= 90
                            ? "text-success"
                            : s.attendance >= 75
                              ? "text-primary-dark"
                              : "text-alert"
                        }`}
                      >
                        {s.attendance}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Pill tone={statusTone(s.feeStatus)}>{s.feeStatus}</Pill>
                    </td>
                    <td className="px-4 py-2.5 text-slate-text text-[12px] whitespace-nowrap">
                      {s.contact}
                    </td>
                    <td
                      className="px-4 py-2.5 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        <button
                          className="p-1.5 rounded text-slate-text hover:bg-paper transition-colors"
                          onClick={() => setSelected(s)}
                          title="View student profile"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          className="p-1.5 rounded text-slate-text hover:bg-paper transition-colors"
                          onClick={() => setCardStudent(s)}
                          title="View student ID card"
                        >
                          <CreditCard size={13} />
                        </button>
                        <PermissionGate permission="students:write">
                          <button
                            className="p-1.5 rounded text-primary-dark hover:bg-primary/10 transition-colors"
                            onClick={() => openEdit(s)}
                            title="Edit student"
                          >
                            <Pencil size={13} />
                          </button>
                        </PermissionGate>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={safePage} pages={pageCount} onPage={setPage} />
          </>
        )}
      </Card>

      {/* ========== STUDENT DETAILS MODAL ========== */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="relative overflow-hidden bg-ink px-6 pt-6 pb-6 text-white">
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/25 blur-2xl" />
              <div className="absolute -bottom-16 -left-8 w-44 h-44 rounded-full bg-info/25 blur-2xl" />
              <button
                onClick={() => setSelected(null)}
                className="absolute z-10 top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X size={18} />
              </button>
              <div className="relative flex items-center gap-4">
                <Avatar
                  src={selected.avatar}
                  name={selected.name}
                  size={64}
                  className="rounded-2xl border-2 border-white/20"
                />
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-lg truncate">
                    {selected.name}
                  </h3>
                  <p className="text-[12.5px] text-white/70">
                    {selected.admissionNo || "—"} · {formatClass(selected.class)}-
{selected.section} · Roll {selected.roll || "—"}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide bg-white/10 border border-white/15 rounded-full px-2.5 py-1">
                      {selected.feeStatus}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide bg-white/10 border border-white/15 rounded-full px-2.5 py-1">
                      {selected.house} House
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide bg-white/10 border border-white/15 rounded-full px-2.5 py-1">
                      {selected.attendance}% attendance
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                {[
                  ["Admission ID", selected.admissionNo || "—"],
                  [
                    "Class & Section",
                    `${formatClass(selected.class)} - Section ${selected.section}`,
                  ],
                  ["Roll Number", selected.roll ? String(selected.roll) : "—"],
                  ["Medium", selected.medium || "—"],
                  ["Gender", selected.gender || "—"],
                  ["Date of Birth", fmtDate(selected.dob)],
                  ["Blood Group", selected.bloodGroup || "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/55">
                      {label}
                    </p>
                    <p className="text-[13.5px] font-medium text-ink mt-0.5">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 my-5" />

              <div className="space-y-2.5 text-[13px]">
                <p className="flex items-center gap-2 text-slate-text">
                  <Phone size={14} className="text-slate-text/50 shrink-0" />{" "}
                  {selected.contact}
                </p>
                <p className="flex items-center gap-2 text-slate-text">
                  <Mail size={14} className="text-slate-text/50 shrink-0" />{" "}
                  {selected.email}
                </p>
                <p className="flex items-start gap-2 text-slate-text">
                  <MapPin
                    size={14}
                    className="text-slate-text/50 mt-0.5 shrink-0"
                  />{" "}
                  {selected.address}
                </p>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-paper rounded-xl p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/55">
                    Father's Name
                  </p>
                  <p className="text-[13.5px] font-medium text-ink mt-1">
                    {selected.fatherName}
                  </p>
                </div>
                <div className="bg-paper rounded-xl p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/55">
                    Mother's Name
                  </p>
                  <p className="text-[13.5px] font-medium text-ink mt-1">
                    {selected.motherName}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <PermissionGate permission="students:write">
                  {selected.deletedAt ? (
                    <Button
                      variant="outline"
                      className="flex-1 justify-center"
                      disabled={busyAction}
                      onClick={handleRestoreStudent}
                    >
                      <UserCheck size={14} /> {busyAction ? "Restoring…" : "Restore"}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="flex-1 justify-center text-alert hover:bg-alert/10"
                      disabled={busyAction}
                      onClick={handleDeleteStudent}
                    >
                      <Trash2 size={14} /> {busyAction ? "Deleting…" : "Delete"}
                    </Button>
                  )}
                </PermissionGate>
                <PermissionGate permission="students:write">
                  <Button
                    variant="outline"
                    className="flex-1 justify-center"
                    onClick={() => openEdit(selected)}
                  >
                    <Pencil size={14} /> Edit
                  </Button>
                </PermissionGate>
                {/* C9: printable Character Certificate. Reads only fields this
                    modal already shows (students:read gate on the detail route),
                    so it grants no extra data. */}
                <PermissionGate permission="students:read">
                  <Button
                    variant="outline"
                    className="flex-1 justify-center"
                    onClick={() =>
                      printCharacterCertificate({
                        student: selected,
                        school,
                        conduct: "Good",
                      })
                    }
                  >
                    <FileText size={14} /> Certificate
                  </Button>
                </PermissionGate>
                <Button
                  variant="primary"
                  className="flex-1 justify-center"
                  onClick={() => setSelected(null)}
                >
                  Done
                </Button>
              </div>
              {selected.deletedAt && (
                <p className="mt-3 text-[12px] text-slate-text/60">
                  This student is in the trash (deleted {fmtDate(selected.deletedAt)}). Restore within the retention window to bring it back — after that a purge permanently removes the record.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== ID CARD MODAL ========== */}
      {cardStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setCardStudent(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px] flex items-center gap-2">
                  <CreditCard size={18} className="text-primary-dark" /> Student
                  ID Card
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  {cardStudent.name} · {cardStudent.admissionNo || "—"}
                </p>
              </div>
              <button
                onClick={() => setCardStudent(null)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <StudentIdCard student={cardStudent} school={school} />
            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-slate-200">
              <Button
                variant="outline"
                className="flex-1 justify-center"
                onClick={() => printIdCard({ student: cardStudent, school })}
              >
                <Printer size={14} /> Print ID Card
              </Button>
              <Button
                variant="primary"
                className="flex-1 justify-center"
                onClick={() => setCardStudent(null)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========== ADD / EDIT MODAL ========== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  {editId ? "Edit Student" : "Add New Student"}
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  Fill student details and save.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Full Name *
                  </label>
                  <Input
                    placeholder="Student full name"
                    value={form.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Admission ID {editId ? "" : "*"}
                  </label>
                  <Input
                    placeholder="e.g. STU-5A-001"
                    autoComplete="off"
                    disabled={Boolean(editId)}
                    className={editId ? "bg-paper cursor-not-allowed" : undefined}
                    value={form.admissionNo}
                    onChange={(e) => updateForm("admissionNo", e.target.value)}
                  />
                  <p className="text-[11.5px] text-slate-text/60 mt-1">
                    {editId
                      ? "Tied to the platform account — change it from Users & Access."
                      : "Must match the ticket's Admission ID so the student login links correctly."}
                  </p>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Gender
                  </label>
                  <Select
                    value={form.gender}
                    onChange={(e) => updateForm("gender", e.target.value)}
                  >
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Date of Birth
                  </label>
                  <Input
                    type="date"
                    value={form.dob}
                    onChange={(e) => updateForm("dob", e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Class
                  </label>
                  <SearchableSelect
                    options={CLASS_OPTIONS.filter((c) => c !== "All")}
                    value={form.class}
                    onChange={(v) => { updateForm("class", v); updateForm("section", ""); }}
                    renderLabel={(c) => formatClass(c)}
                    placeholder="Select class"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Section
                  </label>
                  <SearchableSelect
                    options={filteredModalSections}
                    value={form.section}
                    onChange={(v) => updateForm("section", v)}
                    renderLabel={(s) => `Section ${s}`}
                    placeholder="Select section"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Roll No. *
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. 15, 15A, R-12"
                    value={form.roll}
                    onChange={(e) => updateForm("roll", e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Blood Group
                  </label>
                  <Select
                    value={form.bloodGroup}
                    onChange={(e) => updateForm("bloodGroup", e.target.value)}
                  >
                    {BLOOD_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Medium
                  </label>
                  <Select
                    value={form.medium}
                    onChange={(e) => updateForm("medium", e.target.value)}
                  >
                    {MEDIUM_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Status
                  </label>
                  <Select
                    value={form.status || "Active"}
                    onChange={(e) => updateForm("status", e.target.value)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    House
                  </label>
                  <Input
                    list="house-options"
                    placeholder="e.g. Aravali, or a custom house"
                    value={form.house}
                    onChange={(e) => updateForm("house", e.target.value)}
                  />
                  <datalist id="house-options">
                    {HOUSE_OPTIONS.map((h) => (
                      <option key={h} value={h} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Fee Status
                  </label>
                  {/* Derived from the student's invoices, so it is read-only
                      here — an editable value would never persist (the API has
                      no feeStatus field) and would disagree with the list. */}
                  <div className="flex items-center gap-2 h-9 px-3 rounded-xl border border-slate-200 bg-slate-50">
                    <Pill tone={statusTone(form.feeStatus)}>{form.feeStatus}</Pill>
                    <span className="text-[11px] text-slate-text/70 ml-auto">
                      Set from fee invoices
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Father's Name
                  </label>
                  <Input
                    placeholder="Father's name"
                    value={form.fatherName}
                    onChange={(e) => updateForm("fatherName", e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Mother's Name
                  </label>
                  <Input
                    placeholder="Mother's name"
                    value={form.motherName}
                    onChange={(e) => updateForm("motherName", e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Contact
                  </label>
                  <Input
                    placeholder="+91 ..."
                    value={form.contact}
                    onChange={(e) => updateForm("contact", e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={form.email}
                    onChange={(e) => updateForm("email", e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Address
                  </label>
                  <Input
                    placeholder="Full address"
                    value={form.address}
                    onChange={(e) => updateForm("address", e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Attendance %
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={form.attendance}
                    onChange={(e) => updateForm("attendance", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={!form.name.trim() || !form.roll}
              >
                <Save size={15} /> {editId ? "Update" : "Add"} Student
              </Button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => { if (!importBusy) resetImport(); }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  Import Students from CSV
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  One row per student. Required column: Admission ID. Every row is validated
                  server-side exactly like a single add — bad rows are reported, not silently dropped.
                </p>
              </div>
              <button
                onClick={() => { if (!importBusy) resetImport(); }}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="rounded-xl border border-dashed border-slate-300 bg-paper/50 px-4 py-5 text-center">
                <Upload size={22} className="mx-auto text-slate-text/50 mb-2" />
                <p className="text-[13px] font-semibold text-ink">
                  {importName || "Choose a .csv file"}
                </p>
                <p className="text-[12px] text-slate-text/70 mt-1">
                  Columns: admissionNo, name, class, section, roll, gender, dob, father, mother,
                  phone, email, address, medium, status
                </p>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleImportFile}
                  className="mt-3 text-[12.5px] block mx-auto"
                />
              </div>

              {importError && (
                <p className="text-alert text-[13px]" role="alert">
                  {importError}
                </p>
              )}

              {importRecords.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-3.5 py-2.5 bg-paper text-[12px] font-semibold text-ink flex items-center justify-between">
                    <span>
                      {importRecords.length} row{importRecords.length === 1 ? "" : "s"} ready
                      {importName ? ` from ${importName}` : ""}
                    </span>
                    {!importColumns.includes("admissionNo") && (
                      <span className="text-alert">No Admission ID column</span>
                    )}
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-[12.5px]">
                      <thead className="bg-paper/70 text-slate-text/70">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Row</th>
                          <th className="px-3 py-2 text-left font-semibold">Admission ID</th>
                          <th className="px-3 py-2 text-left font-semibold">Name</th>
                          <th className="px-3 py-2 text-left font-semibold">Class</th>
                          <th className="px-3 py-2 text-left font-semibold">Section</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importRecords.slice(0, 100).map((r) => (
                          <tr key={r.__row}>
                            <td className="px-3 py-1.5 text-slate-text/60">{r.__row}</td>
                            <td className="px-3 py-1.5">
                              {r.admissionNo || (
                                <span className="text-alert font-semibold">missing</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">{r.name || "—"}</td>
                            <td className="px-3 py-1.5">{r.class || "—"}</td>
                            <td className="px-3 py-1.5">{r.section || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importRecords.length > 100 && (
                      <p className="px-3 py-2 text-[12px] text-slate-text/60">
                        Showing the first 100 of {importRecords.length} rows — all rows will be
                        imported.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {importResult && (
                <div className="rounded-xl border border-slate-200 p-3.5">
                  <p className="text-[13px] font-semibold text-ink mb-2">
                    {importResult.created} imported · {importResult.failed} failed ·{" "}
                    {importResult.total} total
                  </p>
                  <div className="max-h-48 overflow-auto space-y-1">
                    {(importResult.results || [])
                      .filter((r) => !r.ok)
                      .map((r) => (
                        <p key={r.index} className="text-[12.5px] text-alert">
                          Row {r.index + 1}
                          {r.admissionNo ? ` (${r.admissionNo})` : ""}: {r.message}
                        </p>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="outline" onClick={resetImport} disabled={importBusy}>
                {importResult && importResult.failed === 0 ? "Close" : "Cancel"}
              </Button>
              <Button
                variant="primary"
                onClick={handleImportSubmit}
                disabled={importBusy || importRecords.length === 0}
              >
                <Upload size={15} />
                {importBusy
                  ? "Importing…"
                  : `Import ${importRecords.length || ""} Student${importRecords.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// import { useMemo, useState } from "react";
// import { Search, Plus, X, Phone, Mail, MapPin, Droplet, Calendar } from "lucide-react";
// import { PageIntro, Card, Button, Input, Select, Pill, statusTone, Avatar } from "../components/UI";

// export default function Students() {
//   const [query, setQuery] = useState("");
//   const [cls, setCls] = useState("All");
//   const [selected, setSelected] = useState(null);

//   const classOptions = ["All", ...new Set(students.map((s) => s.class))];
//   const filtered = useMemo(
//     () =>
//       students.filter(
//         (s) =>
//           (cls === "All" || s.class === cls) &&
//           (s.name.toLowerCase().includes(query.toLowerCase()) || s.id.toLowerCase().includes(query.toLowerCase()))
//       ),
//     [query, cls]
//   );

//   return (
//     <div className="space-y-6">
//       <PageIntro
//         eyebrow="Academics"
//         title="Student Database"
//         description={`${students.length} students enrolled across Nursery to Class 12.`}
//         right={<Button variant="primary"><Plus size={15} /> Add Student</Button>}
//       />

//       <Card
//         action={
//           <div className="flex gap-2">
//             <div className="relative">
//               <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40" />
//               <Input placeholder="Search by name or ID..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8 w-56" />
//             </div>
//             <Select value={cls} onChange={(e) => setCls(e.target.value)}>
//               {classOptions.map((c) => <option key={c} value={c}>{c === "All" ? "All Classes" : `Class ${c}`}</option>)}
//             </Select>
//           </div>
//         }
//       >
//         <div className="overflow-x-auto -mx-5">
//           <table className="w-full text-[13px]">
//             <thead>
//               <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-slate-200">
//                 <th className="px-5 py-2.5 font-semibold">Student</th>
//                 <th className="px-5 py-2.5 font-semibold">Class</th>
//                 <th className="px-5 py-2.5 font-semibold">Roll No.</th>
//                 <th className="px-5 py-2.5 font-semibold">Attendance</th>
//                 <th className="px-5 py-2.5 font-semibold">Fee Status</th>
//                 <th className="px-5 py-2.5 font-semibold">Contact</th>
//               </tr>
//             </thead>
//             <tbody>
//               {filtered.slice(0, 25).map((s) => (
//                 <tr key={s.id} onClick={() => setSelected(s)} className="border-b border-slate-100 hover:bg-paper/60 cursor-pointer">
//                   <td className="px-5 py-2.5">
//                     <div className="flex items-center gap-2.5">
//                       <Avatar src={s.avatar} name={s.name} size={32} />
//                       <div>
//                         <p className="font-semibold text-ink">{s.name}</p>
//                         <p className="text-[11px] text-slate-text/60">{s.id}</p>
//                       </div>
//                     </div>
//                   </td>
//                   <td className="px-5 py-2.5 text-slate-text">{s.class}-{s.section}</td>
//                   <td className="px-5 py-2.5 text-slate-text">{s.roll}</td>
//                   <td className="px-5 py-2.5">
//                     <span className={`font-semibold ${s.attendance < 85 ? "text-alert" : "text-success"}`}>{s.attendance}%</span>
//                   </td>
//                   <td className="px-5 py-2.5"><Pill tone={statusTone(s.feeStatus)}>{s.feeStatus}</Pill></td>
//                   <td className="px-5 py-2.5 text-slate-text whitespace-nowrap">{s.contact}</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//         {filtered.length === 0 && <p className="text-center text-sm text-slate-text py-8">No students match your search.</p>}
//       </Card>

//       {selected && (
//         <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setSelected(null)}>
//           <div className="w-full max-w-md bg-white h-full overflow-y-auto scrollbar-thin p-6" onClick={(e) => e.stopPropagation()}>
//             <div className="flex justify-end mb-2">
//               <button onClick={() => setSelected(null)} className="text-slate-text/50 hover:text-ink"><X size={20} /></button>
//             </div>
//             <div className="text-center mb-6">
//               <img src={selected.avatar} alt={selected.name} className="w-20 h-20 rounded-2xl object-cover mx-auto" />
//               <h3 className="font-display font-bold text-ink text-lg mt-3">{selected.name}</h3>
//               <p className="text-[12.5px] text-slate-text/70">{selected.id} · Class {selected.class}-{selected.section} · Roll {selected.roll}</p>
//               <div className="flex justify-center gap-2 mt-3">
//                 <Pill tone={statusTone(selected.feeStatus)}>{selected.feeStatus}</Pill>
//                 <Pill tone="info">{selected.house} House</Pill>
//               </div>
//             </div>
//             <div className="space-y-4">
//               <div className="grid grid-cols-2 gap-3">
//                 <div className="bg-paper rounded-xl p-3 text-center">
//                   <p className="font-display text-xl font-bold text-ink">{selected.attendance}%</p>
//                   <p className="text-[11px] text-slate-text/60">Attendance</p>
//                 </div>
//                 <div className="bg-paper rounded-xl p-3 text-center">
//                   <p className="font-display text-xl font-bold text-ink">{selected.bloodGroup}</p>
//                   <p className="text-[11px] text-slate-text/60">Blood Group</p>
//                 </div>
//               </div>
//               <div className="space-y-2.5 text-[13px]">
//                 <p className="flex items-center gap-2 text-slate-text"><Calendar size={14} className="text-slate-text/50" /> DOB: {selected.dob}</p>
//                 <p className="flex items-center gap-2 text-slate-text"><Phone size={14} className="text-slate-text/50" /> {selected.contact}</p>
//                 <p className="flex items-center gap-2 text-slate-text"><Mail size={14} className="text-slate-text/50" /> {selected.email}</p>
//                 <p className="flex items-center gap-2 text-slate-text"><MapPin size={14} className="text-slate-text/50" /> {selected.address}</p>
//               </div>
//               <div className="border-t border-slate-200 pt-4">
//                 <p className="text-[12px] font-semibold text-slate-text/60 uppercase mb-2">Parent / Guardian</p>
//                 <p className="text-[13px] text-ink font-medium">Father: {selected.fatherName}</p>
//                 <p className="text-[13px] text-ink font-medium mt-1">Mother: {selected.motherName}</p>
//               </div>
//               <Button variant="primary" className="w-full justify-center mt-2">View Full Profile</Button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
