import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  Plus,
  Search,
  Pencil,
  Link2,
  GraduationCap,
  Users,
  ClipboardList,
  UserCog,
  X,
  Check,
  Save,
  Eye,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Printer,
  UserCheck,
  AlertCircle,
} from "lucide-react";
import { selectSchool } from "../store/selectors";
import { sessionLabel } from "../lib/session";
import {
  PageIntro,
  Card,
  Button,
  Input,
  Select,
  Pill,
  Avatar,
  StatCard,
  toast,
} from "../components/UI";
import SearchableSelect from "../components/SearchableSelect";
import { SegmentedTabs, Pagination } from "../components/Pagination";
import { api } from "../lib/api";
import { PermissionGate } from "../lib/permissions";
import { isPositiveNumber, isValidEmail, isValidPhone } from "../lib/validation.js";
import { useMasterOptions } from "../hooks/useMasterOptions";
import TeacherIdCard, { printTeacherIdCard } from "../components/idcard/TeacherIdCard";

const CLASS_OPTIONS_FALLBACK = [
  "Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11-Sci", "11-Com", "12-Sci", "12-Com",
];
const SECTION_OPTIONS_FALLBACK = ["A", "B", "C"];

const ROLE_TABS = [
  { key: "all", label: "All Staff", icon: Users },
  { key: "teacher", label: "Teachers", icon: GraduationCap },
  { key: "admin-staff", label: "Admin Staff", icon: UserCog },
  { key: "support", label: "Support Staff", icon: Briefcase },
];

const ROLE_LABELS = {
  teacher: "Teacher",
  "admin-staff": "Admin Staff",
  support: "Support Staff",
};

const STATUS_OPTIONS = ["All", "Active", "Inactive", "Resigned"];

const DESIGNATION_SUGGESTIONS = [
  "Principal", "Vice Principal", "PGT Physics", "PGT Chemistry", "PGT Mathematics",
  "TGT English", "TGT Maths", "TGT Science", "PRT", "Librarian",
  "Office Assistant", "Accountant", "Receptionist", "Lab Assistant",
];

const SUBJECT_SUGGESTIONS_FALLBACK = [
  "Mathematics", "English", "Science", "Hindi", "Social Science", "Computer Science",
  "Physics", "Chemistry", "Biology", "Accountancy", "Business Studies", "Economics", "Physical Education",
];

function statusTone(status) {
  if (status === "Active") return "success";
  if (status === "Resigned") return "alert";
  return "amber";
}

function emptyStaffForm() {
  return {
    employeeId: "", name: "", designation: "", department: "", role: "teacher",
    subjects: "", qualification: "", joiningDate: "", contact: "", email: "",
    address: "", salary: "", status: "Active",
  };
}

function normalizeStaff(staff) {
  return {
    ...staff,
    id: staff._id || staff.id,
    subjectsList: Array.isArray(staff.subjects) ? staff.subjects : [],
    avatar: staff.photoUrl || "",
  };
}

function toApiStaff(form) {
  return {
    employeeId: form.employeeId.trim(),
    name: form.name.trim(),
    designation: form.designation.trim(),
    department: form.department.trim() || undefined,
    role: form.role,
    subjects: form.subjects.split(",").map((s) => s.trim()).filter(Boolean),
    qualification: form.qualification.trim() || undefined,
    joiningDate: form.joiningDate || undefined,
    contact: form.contact.trim() || undefined,
    email: form.email.trim() || undefined,
    address: form.address.trim() || undefined,
    salary: form.salary === "" ? undefined : Number(form.salary),
    status: form.status,
  };
}

function fmtDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function subLabel(sub) {
  if (["Nursery", "LKG", "UKG"].includes(sub)) return sub;
  return `Class ${sub}`;
}

export default function Teachers() {
  const school = useSelector(selectSchool);
  const session = sessionLabel(school) || String(new Date().getFullYear());
  const { options: CLASS_OPTIONS } = useMasterOptions("classes", CLASS_OPTIONS_FALLBACK);
  const { options: SECTION_OPTIONS, rawItems: rawSections } = useMasterOptions("sections", SECTION_OPTIONS_FALLBACK);
  const { options: SUBJECT_SUGGESTIONS } = useMasterOptions("subjects", SUBJECT_SUGGESTIONS_FALLBACK);

  const [list, setList] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  const [activeTab, setActiveTab] = useState("all");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyStaffForm());
  const [formSection, setFormSection] = useState("personal");

  const [viewStaff, setViewStaff] = useState(null);
  const [assignStaff, setAssignStaff] = useState(null);
  const [assignForm, setAssignForm] = useState({});
  const [expandedCard, setExpandedCard] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Shared person-flow: admin-driven Complete Profile + manual ID card ops.
  const [completeTarget, setCompleteTarget] = useState(null);
  const [completeForm, setCompleteForm] = useState({ dob: "", gender: "", contact: "", address: "" });
  const [completing, setCompleting] = useState(false);
  const [issuingId, setIssuingId] = useState(null);

  const filteredSections = useMemo(() => {
    if (!assignForm.class) return SECTION_OPTIONS;
    return [...new Set(rawSections.filter((s) => s.className === assignForm.class).map((s) => s.name))];
  }, [assignForm.class, SECTION_OPTIONS, rawSections]);

  const reload = async () => {
    try {
      const [staffRes, assignRes] = await Promise.all([api.staff.list(), api.assignments.list()]);
      setList((staffRes.data || []).map(normalizeStaff));
      setAssignments(assignRes.data || []);
      setApiError("");
    } catch (error) {
      setApiError(error.message);
    }
  };

  useEffect(() => {
    let active = true;
    api.staff.list()
      .then(({ data }) => { if (active) setList((data || []).map(normalizeStaff)); })
      .catch((error) => { if (active) setApiError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    api.assignments.list()
      .then(({ data }) => { if (active) setAssignments(data || []); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return list
      .filter((s) => {
        if (activeTab !== "all" && s.role !== activeTab) return false;
        if (statusFilter !== "All" && s.status !== statusFilter) return false;
        if (!q) return true;
        return (
          (s.name || "").toLowerCase().includes(q) ||
          (s.employeeId || "").toLowerCase().includes(q) ||
          (s.designation || "").toLowerCase().includes(q) ||
          (s.email || "").toLowerCase().includes(q) ||
          (s.contact || "").includes(q)
        );
      })
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [list, query, activeTab, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  useEffect(() => { setPage(1); }, [query, activeTab, statusFilter, pageSize]);

  const stats = useMemo(() => {
    const teachers = list.filter((s) => s.role === "teacher").length;
    const activeClassTeachers = new Set(
      assignments.filter((a) => a.type === "class_teacher" && a.status === "active").map((a) => String(a.staffId))
    );
    const adminSupport = list.filter((s) => s.role === "admin-staff" || s.role === "support").length;
    return { total: list.length, teachers, activeClassTeachers: activeClassTeachers.size, adminSupport };
  }, [list, assignments]);

  // Reports & Analytics-style segmented role tabs (like Users & Access), with
  // a live count badge per role derived from the loaded staff list.
  const roleTabs = useMemo(
    () =>
      ROLE_TABS.map((t) => ({
        id: t.key,
        label: t.label,
        icon: t.icon,
        count: t.key === "all" ? list.length : list.filter((s) => s.role === t.key).length,
      })),
    [list],
  );

  const assignmentsFor = (staffId) =>
    assignments
      .filter((a) => String(a.staffId) === String(staffId))
      .sort((a, b) => (a.status === "active" ? -1 : 1) - (b.status === "active" ? -1 : 1));

  const openAdd = () => {
    setEditId(null);
    setForm(emptyStaffForm());
    setFormSection("personal");
    setApiError("");
    setShowStaffModal(true);
  };

  const openEdit = (staff) => {
    setEditId(staff.id);
    setForm({
      employeeId: staff.employeeId || "", name: staff.name || "", designation: staff.designation || "",
      department: staff.department || "", role: staff.role || "teacher",
      subjects: (staff.subjectsList || []).join(", "), qualification: staff.qualification || "",
      joiningDate: staff.joiningDate ? String(staff.joiningDate).slice(0, 10) : "",
      contact: staff.contact || "", email: staff.email || "", address: staff.address || "",
      salary: staff.salary != null ? String(staff.salary) : "", status: staff.status || "Active",
    });
    setFormSection("personal");
    setApiError("");
    setShowStaffModal(true);
  };

  const updateForm = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const stepOrder = form.role === "teacher"
    ? ["personal", "professional", "teaching"]
    : ["personal", "professional"];
  const stepIndex = Math.max(0, stepOrder.indexOf(formSection));

  const handleRoleChange = (value) => {
    updateForm("role", value);
    if (value !== "teacher" && formSection === "teaching") setFormSection("professional");
  };

  const handleNextStep = () => {
    if (formSection === "personal" && (!form.name.trim() || !form.employeeId.trim())) {
      setApiError("Full Name and Employee ID are required to continue");
      return;
    }
    if (formSection === "professional" && !form.designation.trim()) {
      setApiError("Designation is required to continue");
      return;
    }
    setApiError("");
    setFormSection(stepOrder[Math.min(stepIndex + 1, stepOrder.length - 1)]);
  };

  const handleSaveStaff = async () => {
    if (!form.name.trim() || !form.employeeId.trim() || !form.designation.trim()) {
      setApiError("Name, Employee ID and Designation are required");
      return;
    }
    if (form.salary !== "" && form.salary != null && !isPositiveNumber(form.salary)) {
      toast("Salary must be a positive number", "error");
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
      const payload = toApiStaff(form);
      const response = editId ? await api.staff.update(editId, payload) : await api.staff.create(payload);
      const saved = normalizeStaff(response.data);
      setList((prev) => editId ? prev.map((s) => (s.id === editId ? saved : s)) : [saved, ...prev]);
      setShowStaffModal(false);
      setApiError("");
      toast(editId ? "Staff record updated" : "Staff added successfully");
    } catch (error) {
      setApiError(error.message);
    }
  };

  const handleRemove = async (staff) => {
    if (!window.confirm(`Mark ${staff.name} as Resigned? Employment history is preserved.`)) return;
    try {
      await api.staff.remove(staff.id);
      await reload();
      toast("Staff deactivated; history preserved");
    } catch (error) {
      toast(error.message, "error");
    }
  };

  const applyStaffUpdate = (updated) => {
    const saved = normalizeStaff(updated || {});
    setList((prev) => prev.map((s) => (s.id === saved.id ? { ...s, ...saved } : s)));
    if (viewStaff && viewStaff.id === saved.id) setViewStaff((prev) => (prev ? { ...prev, ...saved } : prev));
  };

  const openComplete = (staff) => {
    setCompleteTarget(staff);
    setCompleteForm({
      dob: staff.dob ? String(staff.dob).slice(0, 10) : "",
      gender: staff.gender || "",
      contact: staff.contact || "",
      address: staff.address || "",
    });
  };

  const handleCompleteProfile = async () => {
    if (!completeTarget) return;
    const missing = ["dob", "gender", "contact", "address"].filter((f) => !String(completeForm[f] || "").trim());
    if (missing.length) {
      toast(`Profile incomplete — missing: ${missing.join(", ")}`, "error");
      return;
    }
    setCompleting(true);
    try {
      const { data } = await api.staff.completeProfile(completeTarget.id, {
        dob: completeForm.dob || undefined,
        gender: completeForm.gender || undefined,
        contact: completeForm.contact.trim(),
        address: completeForm.address.trim(),
      });
      applyStaffUpdate(data);
      setCompleteTarget(null);
      toast(data?.idCardNumber ? `Profile complete · ID card ${data.idCardNumber} issued` : "Profile complete");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setCompleting(false);
    }
  };

  const handleIssueIdCard = async (staff) => {
    setIssuingId(staff.id);
    try {
      const { data } = await api.staff.issueIdCard(staff.id);
      applyStaffUpdate(data);
      toast(`ID card ${data.idCardNumber} issued`);
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setIssuingId(null);
    }
  };

  const openAssign = (staff) => {
    setAssignStaff(staff);
    setAssignForm({ session, type: "teaching", subject: "", class: "", section: "A" });
  };

  const handleCreateAssignment = async () => {
    if (!assignStaff) return;
    const { type, subject, class: cls, section: sec } = assignForm;
    if (!assignForm.session || !cls) {
      setApiError("Session, class and section are required");
      return;
    }
    if (type === "teaching" && !subject.trim()) {
      setApiError("Subject is required for a teaching assignment");
      return;
    }
    try {
      await api.assignments.create({
        staffId: assignStaff.id, session: assignForm.session.trim(), type,
        ...(type === "teaching" ? { subject: subject.trim() } : {}),
        class: cls, section: sec,
      });
      toast("Assignment added");
      setApiError("");
      setAssignForm({ session, type: "teaching", subject: "", class: "", section: "A" });
      await reload();
    } catch (error) {
      setApiError(error.message);
    }
  };

  const endAssignment = async (assignment) => {
    try {
      await api.assignments.end(assignment._id);
      toast("Assignment ended; history preserved");
      await reload();
    } catch (error) {
      toast(error.message, "error");
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <PageIntro
        eyebrow="Human Resources"
        title="Teachers & Staff"
        description={loading ? "Loading staff records..." : `${stats.total} staff members across all departments.`}
        right={
          <PermissionGate permission="staff:write">
            <Button variant="amber" onClick={openAdd}>
              <Plus size={15} /> Add Staff
            </Button>
          </PermissionGate>
        }
      />

      {apiError && !showStaffModal && !assignStaff && (
        <p className="text-alert text-[13px]" role="alert">{apiError}</p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Staff" value={String(stats.total)} sub="All departments" accent="info" />
        <StatCard icon={GraduationCap} label="Teachers" value={String(stats.teachers)} sub="Teaching role" accent="amber" />
        <StatCard icon={ClipboardList} label="Class Teachers" value={String(stats.activeClassTeachers)} sub="Homeroom assignments" accent="success" />
        <StatCard icon={UserCog} label="Admin / Support" value={String(stats.adminSupport)} sub="Non-teaching staff" accent="info" />
      </div>

      {/* Tabs */}
      <SegmentedTabs tabs={roleTabs} active={activeTab} onChange={setActiveTab} />

      {/* Search + Status filter */}
      <div className="grid grid-cols-[70fr_30fr] items-center gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40" />
          <Input
            placeholder="Search name, ID, designation..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === "All" ? "All Statuses" : s}</option>
          ))}
        </Select>
      </div>

      {/* Staff Cards */}
      {filtered.length === 0 ? (
        <div className="py-14 text-center">
          <GraduationCap size={36} className="mx-auto text-slate-text/30 mb-3" />
          <p className="text-[14px] font-medium text-ink">No staff found</p>
          <p className="text-[13px] text-slate-text/60 mt-1">Try different filters or add a new staff member.</p>
          <PermissionGate permission="staff:write">
            <Button variant="amber" className="mt-4" onClick={openAdd}>
              <Plus size={15} /> Add Staff
            </Button>
          </PermissionGate>
        </div>
      ) : (
        <>
          <div className="grid gap-4">
            {paginated.map((s) => {
            const mine = assignmentsFor(s.id);
            const activeOnes = mine.filter((a) => a.status === "active");
            const isExpanded = expandedCard === s.id;
            return (
              <div key={s.id} className="rounded-xl border border-black/[0.06] hover:border-black/10 bg-white transition-colors">
                {/* Card Header */}
                <div className="flex items-start gap-4 p-4">
                  <Avatar src={s.avatar} name={s.name} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-semibold text-ink">{s.name}</h3>
                      <Pill tone={statusTone(s.status)}>{s.status}</Pill>
                      <Pill tone={s.role === "teacher" ? "info" : "neutral"}>{ROLE_LABELS[s.role] || s.role}</Pill>
                      {s.userId ? (
                        <Pill tone="success">Account linked</Pill>
                      ) : (
                        <Pill tone="amber">Awaiting account</Pill>
                      )}
                      {s.profileStatus === "complete" ? (
                        <Pill tone="success">Profile ✓</Pill>
                      ) : (
                        <Pill tone="neutral">Profile incomplete</Pill>
                      )}
                    </div>
                    <p className="text-[13px] text-slate-text/70 mt-0.5">
                      {s.designation || "—"}
                      {s.department ? ` · ${s.department}` : ""}
                      {s.salary ? ` · ₹${s.salary.toLocaleString("en-IN")}/mo` : ""}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12px] text-slate-text/55">
                      {s.employeeId && (
                        <span className="inline-flex items-center gap-1">
                          <Briefcase size={11} /> {s.employeeId}
                        </span>
                      )}
                      {s.contact && (
                        <span className="inline-flex items-center gap-1">
                          <Phone size={11} /> {s.contact}
                        </span>
                      )}
                      {s.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail size={11} /> {s.email}
                        </span>
                      )}
                    </div>
                    {s.subjectsList.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {s.subjectsList.slice(0, 4).map((sub) => (
                          <span key={sub} className="px-2 py-0.5 rounded-full bg-info/8 text-info text-[11px] font-medium">
                            {sub}
                          </span>
                        ))}
                        {s.subjectsList.length > 4 && (
                          <span className="px-2 py-0.5 rounded-full bg-paper text-slate-text text-[11px]">
                            +{s.subjectsList.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                    {activeOnes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {activeOnes.map((a) => (
                          <span
                            key={a._id}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              a.type === "class_teacher" ? "bg-amber/15 text-amber-dark" : "bg-success/10 text-success"
                            }`}
                          >
                            {a.type === "class_teacher" && <Check size={10} />}
                            {a.type === "class_teacher"
                              ? `${subLabel(a.class)}-${a.section}`
                              : `${a.subject} · ${subLabel(a.class)}-${a.section}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setViewStaff(s)}
                      className="p-2 rounded-lg hover:bg-paper text-slate-text/60 hover:text-info transition-colors"
                      title="View details"
                    >
                      <Eye size={16} />
                    </button>
                    <PermissionGate permission="staff:write">
                      <button
                        onClick={() => openEdit(s)}
                        className="p-2 rounded-lg hover:bg-paper text-slate-text/60 hover:text-info transition-colors"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      {s.role === "teacher" && (
                        <button
                          onClick={() => openAssign(s)}
                          className="p-2 rounded-lg hover:bg-paper text-slate-text/60 hover:text-amber-dark transition-colors"
                          title="Assign"
                        >
                          <Link2 size={16} />
                        </button>
                      )}
                      {s.profileStatus === "complete" && s.idCardNumber && (
                        <button
                          onClick={() => printTeacherIdCard({ teacher: s, school })}
                          className="p-2 rounded-lg hover:bg-paper text-slate-text/60 hover:text-info transition-colors"
                          title="Print ID card"
                        >
                          <Printer size={16} />
                        </button>
                      )}
                    </PermissionGate>
                    <button
                      onClick={() => setExpandedCard(isExpanded ? null : s.id)}
                      className="p-2 rounded-lg hover:bg-paper text-slate-text/60 hover:text-ink transition-colors"
                      title="More details"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-black/[0.04]">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 text-[12.5px]">
                      {s.qualification && (
                        <div><span className="text-slate-text/50">Qualification:</span> <span className="text-ink">{s.qualification}</span></div>
                      )}
                      {s.joiningDate && (
                        <div><span className="text-slate-text/50">Joined:</span> <span className="text-ink">{fmtDate(s.joiningDate)}</span></div>
                      )}
                      {s.address && (
                        <div className="col-span-2 sm:col-span-3 flex items-start gap-1">
                          <MapPin size={12} className="text-slate-text/40 mt-0.5 shrink-0" />
                          <span className="text-ink">{s.address}</span>
                        </div>
                      )}
                    </div>
                    {mine.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-[11px] font-semibold text-slate-text/50 uppercase tracking-wide">All Assignments</p>
                        {mine.map((a) => (
                          <div key={a._id} className="flex items-center justify-between text-[12px] rounded-lg bg-paper/60 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Pill tone={a.type === "class_teacher" ? "amber" : "info"}>
                                {a.type === "class_teacher" ? "Class Teacher" : "Teaching"}
                              </Pill>
                              <span className="text-ink">
                                {a.type === "class_teacher"
                                  ? `${subLabel(a.class)}-${a.section}`
                                  : `${a.subject} · ${subLabel(a.class)}-${a.section}`}
                              </span>
                              <span className="text-slate-text/40">· {a.session}</span>
                            </div>
                            {a.status === "active" ? (
                              <Button variant="outline" className="px-2 py-1 text-[11px]" onClick={() => endAssignment(a)}>
                                End
                              </Button>
                            ) : (
                              <span className="text-[11px] text-slate-text/40">Ended {fmtDate(a.endedAt)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {s.role === "teacher" && (
                      <PermissionGate permission="staff:write">
                        <button
                          onClick={() => openAssign(s)}
                          className="mt-3 text-[12px] font-medium text-info hover:underline inline-flex items-center gap-1"
                        >
                          <Plus size={12} /> Add Assignment
                        </button>
                      </PermissionGate>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-[12px] text-slate-text/55">
              Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
            </p>
            <Select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="text-[12px]"
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </Select>
          </div>
          <Pagination page={safePage} pages={totalPages} onPage={setPage} info={false} />
        </>
      )}

      {/* ========== VIEW MODAL ========== */}
      {viewStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setViewStaff(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto scrollbar-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] sticky top-0 bg-white">
              <h3 className="font-display font-semibold text-ink text-[17px]">Staff Profile</h3>
              <button onClick={() => setViewStaff(null)} className="p-2 rounded-lg hover:bg-paper text-slate-text">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-5">
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
                <div className="space-y-5 min-w-0">
              {/* Header */}
              <div className="flex items-center gap-4">
                <Avatar src={viewStaff.avatar} name={viewStaff.name} size={56} />
                <div>
                  <h4 className="text-[18px] font-semibold text-ink">{viewStaff.name}</h4>
                  <p className="text-[13px] text-slate-text/70">{viewStaff.designation || "—"}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <Pill tone={statusTone(viewStaff.status)}>{viewStaff.status}</Pill>
                    <Pill tone={viewStaff.role === "teacher" ? "info" : "neutral"}>{ROLE_LABELS[viewStaff.role] || viewStaff.role}</Pill>
                    {viewStaff.userId ? (
                      <Pill tone="success">Account linked</Pill>
                    ) : (
                      <Pill tone="amber">Awaiting account</Pill>
                    )}
                    {viewStaff.profileStatus === "complete" ? (
                      <Pill tone="success">Profile ✓</Pill>
                    ) : (
                      <Pill tone="neutral">Profile incomplete</Pill>
                    )}
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-[13px]">
                {viewStaff.employeeId && (
                  <div><span className="text-slate-text/50 text-[12px] block">Employee ID</span><span className="text-ink font-mono">{viewStaff.employeeId}</span></div>
                )}
                {viewStaff.dob && (
                  <div><span className="text-slate-text/50 text-[12px] block">Date of Birth</span><span className="text-ink">{fmtDate(viewStaff.dob)}</span></div>
                )}
                {viewStaff.gender && (
                  <div><span className="text-slate-text/50 text-[12px] block">Gender</span><span className="text-ink">{viewStaff.gender}</span></div>
                )}
                {viewStaff.department && (
                  <div><span className="text-slate-text/50 text-[12px] block">Department</span><span className="text-ink">{viewStaff.department}</span></div>
                )}
                {viewStaff.qualification && (
                  <div><span className="text-slate-text/50 text-[12px] block">Qualification</span><span className="text-ink">{viewStaff.qualification}</span></div>
                )}
                {viewStaff.joiningDate && (
                  <div><span className="text-slate-text/50 text-[12px] block">Joining Date</span><span className="text-ink">{fmtDate(viewStaff.joiningDate)}</span></div>
                )}
                {viewStaff.salary != null && (
                  <div><span className="text-slate-text/50 text-[12px] block">Monthly Salary</span><span className="text-ink">₹{viewStaff.salary.toLocaleString("en-IN")}</span></div>
                )}
              </div>

              {/* Contact */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-slate-text/50 uppercase tracking-wide">Contact</p>
                {viewStaff.contact && (
                  <div className="flex items-center gap-2 text-[13px] text-ink"><Phone size={14} className="text-slate-text/40" />{viewStaff.contact}</div>
                )}
                {viewStaff.email && (
                  <div className="flex items-center gap-2 text-[13px] text-ink"><Mail size={14} className="text-slate-text/40" />{viewStaff.email}</div>
                )}
                {viewStaff.address && (
                  <div className="flex items-start gap-2 text-[13px] text-ink"><MapPin size={14} className="text-slate-text/40 mt-0.5 shrink-0" />{viewStaff.address}</div>
                )}
                {!viewStaff.contact && !viewStaff.email && !viewStaff.address && (
                  <p className="text-[12px] text-slate-text/40">No contact information</p>
                )}
              </div>

              {/* Subjects */}
              {viewStaff.subjectsList.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-text/50 uppercase tracking-wide mb-2">Subjects</p>
                  <div className="flex flex-wrap gap-1.5">
                    {viewStaff.subjectsList.map((sub) => (
                      <span key={sub} className="px-2.5 py-1 rounded-full bg-info/8 text-info text-[12px] font-medium">{sub}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Assignments */}
              {assignmentsFor(viewStaff.id).length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-text/50 uppercase tracking-wide mb-2">Assignments</p>
                  <div className="space-y-2">
                    {assignmentsFor(viewStaff.id).map((a) => (
                      <div key={a._id} className="flex items-center justify-between rounded-xl border border-black/[0.06] px-4 py-3 text-[13px]">
                        <div className="flex items-center gap-2">
                          <Pill tone={a.type === "class_teacher" ? "amber" : "info"}>
                            {a.type === "class_teacher" ? "Class Teacher" : "Teaching"}
                          </Pill>
                          <span className="text-ink">
                            {a.type === "class_teacher"
                              ? `${subLabel(a.class)}-${a.section}`
                              : `${a.subject} · ${subLabel(a.class)}-${a.section}`}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-text/40">
                          {a.session} · {a.status === "active" ? "Active" : `Ended ${fmtDate(a.endedAt)}`}
                        </span>
                      </div>
                    ))}
                  </div>
</div>
              )}
            </div>

            {/* Right: ID Card panel */}
            <div className="space-y-3">
              <div className="rounded-xl border border-black/[0.06] p-4 space-y-3 xl:sticky xl:top-20">
                <p className="text-[11px] font-semibold text-slate-text/50 uppercase tracking-wide">Onboarding · ID Card</p>
                <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-slate-text/70">
                  <span className="inline-flex items-center gap-1.5">
                    <UserCheck size={13} className={viewStaff.userId ? "text-success" : "text-amber-dark"} />
                    {viewStaff.userId ? "Account created — profile completion is two-way" : "No account yet — register in Users & Access"}
                  </span>
                </div>
                {viewStaff.idCardNumber ? (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[12.5px] text-ink">
                      ID Card <span className="font-mono font-semibold text-info">{viewStaff.idCardNumber}</span>
                      <span className="text-slate-text/50"> · issued {fmtDate(viewStaff.idCardIssuedAt)}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-[12px] text-slate-text/55">
                    {viewStaff.profileStatus === "complete"
                      ? "Profile complete — issue the ID card when ready."
                      : "ID card issues automatically once the profile is completed."}
                  </p>
                )}
                {viewStaff.profileStatus === "complete" && (
                  <div className="rounded-lg bg-paper/70 p-3">
                    <TeacherIdCard teacher={viewStaff} school={school} />
                  </div>
                )}
                <PermissionGate permission="staff:write">
                  <div className="flex flex-wrap gap-2">
                    {viewStaff.profileStatus !== "complete" ? (
                      <Button variant="amber" onClick={() => openComplete(viewStaff)}>
                        <AlertCircle size={15} /> Complete Profile (Admin)
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        disabled={issuingId === viewStaff.id}
                        onClick={() => handleIssueIdCard(viewStaff)}
                      >
                        <CreditCard size={15} />
                        {viewStaff.idCardNumber ? "Reissue ID Card" : "Issue ID Card"}
                      </Button>
                    )}
                    <Button variant="outline" disabled={!viewStaff.idCardNumber} onClick={() => printTeacherIdCard({ teacher: viewStaff, school })}>
                      <Printer size={15} /> Print
                    </Button>
                  </div>
                </PermissionGate>
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-black/[0.06] flex justify-end gap-2 sticky bottom-0 bg-white">
              <Button variant="outline" onClick={() => setViewStaff(null)}>Close</Button>
              <PermissionGate permission="staff:write">
                <Button variant="amber" onClick={() => { setViewStaff(null); openEdit(viewStaff); }}>
                  <Pencil size={15} /> Edit
                </Button>
              </PermissionGate>
            </div>
          </div>
        </div>
      )}

      {/* ========== ADD/EDIT MODAL ========== */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setShowStaffModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] sticky top-0 bg-white z-10">
              <h3 className="font-display font-semibold text-ink text-[17px]">
                {editId ? "Edit Staff Record" : "Add Staff"}
              </h3>
              <button onClick={() => setShowStaffModal(false)} className="p-2 rounded-lg hover:bg-paper text-slate-text">
                <X size={20} />
              </button>
            </div>

            {/* Form Steps */}
            <div className="px-6 pt-4 pb-3 border-b border-black/[0.06] sticky top-[65px] bg-white z-10">
              <SegmentedTabs
                tabs={[
                  { id: "personal", label: "1 · Basics", icon: Users },
                  { id: "professional", label: "2 · Role & position", icon: Briefcase },
                  ...(form.role === "teacher" ? [{ id: "teaching", label: "3 · Teaching scope", icon: GraduationCap }] : []),
                ]}
                active={formSection}
                onChange={setFormSection}
              />
              <p className="text-[11px] text-slate-text/45 mt-2">
                Step {stepIndex + 1} of {stepOrder.length} — fill in and continue.
              </p>
            </div>

            <div className="px-6 py-5 space-y-6">
              {apiError && (
                <p className="text-alert text-[13px] rounded-lg bg-alert/5 px-3 py-2" role="alert">{apiError}</p>
              )}

              {/* Personal Section */}
              {formSection === "personal" && (
                <section>
                  <div className="mb-4">
                    <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink/60">Basics</h4>
                    <p className="text-[12px] text-slate-text/55 mt-0.5">
                      How this person appears across the school directory.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                        Full Name <span className="text-alert">*</span>
                      </label>
                      <Input value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="e.g. Ananya Sharma" />
                    </div>
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                        Employee ID <span className="text-alert">*</span>
                      </label>
                      <Input value={form.employeeId} onChange={(e) => updateForm("employeeId", e.target.value)} placeholder="e.g. EMP-001" />
                      <p className="text-[11px] text-slate-text/50 mt-1.5">
                        Manual Staff ID — accounts link from Users &amp; Access with this ID.
                      </p>
                    </div>
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">Contact</label>
                      <Input value={form.contact} onChange={(e) => updateForm("contact", e.target.value)} placeholder="Phone number" />
                    </div>
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">Email</label>
                      <Input type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} placeholder="name@school.edu" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">Address</label>
                      <Input value={form.address} onChange={(e) => updateForm("address", e.target.value)} placeholder="Residential address" />
                    </div>
                  </div>
                </section>
              )}

              {/* Professional Section */}
              {formSection === "professional" && (
                <section>
                  <div className="mb-4">
                    <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink/60">Role &amp; position</h4>
                    <p className="text-[12px] text-slate-text/55 mt-0.5">
                      Designation, department and employment details.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                        Designation <span className="text-alert">*</span>
                      </label>
                      <Input list="designation-suggestions" value={form.designation} onChange={(e) => updateForm("designation", e.target.value)} placeholder="e.g. PGT Mathematics" />
                      <datalist id="designation-suggestions">
                        {DESIGNATION_SUGGESTIONS.map((d) => <option key={d} value={d} />)}
                      </datalist>
                    </div>
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">Department</label>
                      <Input value={form.department} onChange={(e) => updateForm("department", e.target.value)} placeholder="e.g. Science" />
                    </div>
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">Role</label>
                      <Select value={form.role} onChange={(e) => handleRoleChange(e.target.value)} className="w-full">
                        {["teacher", "admin-staff", "support"].map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </Select>
                      <p className="text-[11px] text-slate-text/50 mt-1.5">
                        Choosing Teacher adds the Teaching step.
                      </p>
                    </div>
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">Status</label>
                      <Select value={form.status} onChange={(e) => updateForm("status", e.target.value)} className="w-full">
                        {["Active", "Inactive", "Resigned"].map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">Qualification</label>
                      <Input value={form.qualification} onChange={(e) => updateForm("qualification", e.target.value)} placeholder="e.g. M.Sc., B.Ed." />
                    </div>
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">Joining Date</label>
                      <Input type="date" value={form.joiningDate} onChange={(e) => updateForm("joiningDate", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">Monthly Salary (₹)</label>
                      <Input type="number" min="0" value={form.salary} onChange={(e) => updateForm("salary", e.target.value)} placeholder="0" />
                    </div>
                  </div>
                </section>
              )}

              {/* Teaching Section */}
              {formSection === "teaching" && (
                <section>
                  <div className="mb-4">
                    <h4 className="text-[12px] font-bold uppercase tracking-wide text-ink/60">Teaching scope</h4>
                    <p className="text-[12px] text-slate-text/55 mt-0.5">
                      The subjects this teacher can take.
                    </p>
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                      Subjects <span className="text-slate-text/45">(comma separated)</span>
                    </label>
                    <Input list="subject-suggestions" value={form.subjects} onChange={(e) => updateForm("subjects", e.target.value)} placeholder="e.g. Mathematics, Physics" />
                    <datalist id="subject-suggestions">
                      {SUBJECT_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
                    </datalist>
                    <p className="text-[11px] text-slate-text/50 mt-1.5">Enter the subjects this teacher can teach, separated by commas.</p>
                  </div>
                </section>
              )}
            </div>

            <div className="px-6 py-4 border-t border-black/[0.06] flex items-center justify-between gap-2 sticky bottom-0 bg-white">
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setShowStaffModal(false)}>Cancel</Button>
                {stepIndex > 0 && (
                  <Button variant="outline" onClick={() => setFormSection(stepOrder[stepIndex - 1])}>
                    <ChevronLeft size={15} /> Back
                  </Button>
                )}
              </div>
              {stepIndex < stepOrder.length - 1 ? (
                <Button variant="amber" onClick={handleNextStep}>
                  Next <ChevronRight size={15} />
                </Button>
              ) : (
                <Button variant="amber" onClick={handleSaveStaff}>
                  <Save size={15} /> {editId ? "Save Changes" : "Add Staff"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== COMPLETE PROFILE MODAL ========== */}
      {completeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setCompleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] sticky top-0 bg-white">
              <h3 className="font-display font-semibold text-ink text-[17px]">
                Complete Profile · {completeTarget.name}
              </h3>
              <button onClick={() => setCompleteTarget(null)} className="p-2 rounded-lg hover:bg-paper text-slate-text">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-start gap-2.5 rounded-xl bg-info/10 border border-info/20 px-4 py-3 text-[13px] text-info">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p>
                  Use this to finish the shared person record on the teacher's
                  behalf. {completeTarget.idCardNumber ? "Re-issuing keeps the same card number after review." : "The ID card issues automatically on completion."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Date of Birth *</label>
                  <Input
                    type="date"
                    value={completeForm.dob}
                    onChange={(e) => setCompleteForm((f) => ({ ...f, dob: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Gender *</label>
                  <Select value={completeForm.gender} onChange={(e) => setCompleteForm((f) => ({ ...f, gender: e.target.value }))} className="w-full">
                    <option value="">Select gender…</option>
                    {["Male", "Female", "Other"].map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Contact *</label>
                  <Input value={completeForm.contact} onChange={(e) => setCompleteForm((f) => ({ ...f, contact: e.target.value }))} placeholder="Phone number" />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">Address *</label>
                  <Input value={completeForm.address} onChange={(e) => setCompleteForm((f) => ({ ...f, address: e.target.value }))} placeholder="Residential address" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-black/[0.06] flex justify-end gap-2 sticky bottom-0 bg-white">
              <Button variant="outline" onClick={() => setCompleteTarget(null)}>Cancel</Button>
              <Button variant="amber" onClick={handleCompleteProfile} disabled={completing}>
                <Save size={15} /> {completing ? "Completing…" : "Complete & Issue Card"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========== ASSIGNMENT MODAL ========== */}
      {assignStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setAssignStaff(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] sticky top-0 bg-white">
              <h3 className="font-display font-semibold text-ink text-[17px]">Assignments · {assignStaff.name}</h3>
              <button onClick={() => setAssignStaff(null)} className="p-2 rounded-lg hover:bg-paper text-slate-text">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-5">
              {apiError && (
                <p className="text-alert text-[13px] rounded-lg bg-alert/5 px-3 py-2 mb-4" role="alert">{apiError}</p>
              )}

              {assignmentsFor(assignStaff.id).length === 0 ? (
                <p className="text-[13px] text-slate-text/60 mb-4">No assignments yet. Create one below.</p>
              ) : (
                <div className="space-y-2 mb-5">
                  {assignmentsFor(assignStaff.id).map((a) => (
                    <div key={a._id} className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.06] px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Pill tone={a.type === "class_teacher" ? "amber" : "info"}>
                            {a.type === "class_teacher" ? "Class Teacher" : "Teaching"}
                          </Pill>
                          <span className="font-medium text-ink text-[13px]">
                            {a.type === "class_teacher"
                              ? `${subLabel(a.class)}-${a.section}`
                              : `${a.subject} · ${subLabel(a.class)}-${a.section}`}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-slate-text/55 mt-1">
                          Session {a.session} · {a.status === "active" ? "Active" : `Ended ${fmtDate(a.endedAt)}`}
                        </p>
                      </div>
                      {a.status === "active" && (
                        <Button variant="outline" className="px-3 py-1.5 text-[12px]" onClick={() => endAssignment(a)}>
                          End
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-black/[0.06] pt-5">
                <p className="font-display font-semibold text-ink text-[15px] mb-4">Add Assignment</p>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">Session</label>
                      <Input value={assignForm.session} onChange={(e) => setAssignForm((f) => ({ ...f, session: e.target.value }))} placeholder="e.g. 2026-27" />
                    </div>
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">Type</label>
                      <Select value={assignForm.type} onChange={(e) => setAssignForm((f) => ({ ...f, type: e.target.value }))} className="w-full">
                        <option value="teaching">Teaching</option>
                        <option value="class_teacher">Class Teacher</option>
                      </Select>
                    </div>
                    {assignForm.type === "teaching" && (
                      <div className="col-span-2">
                        <label className="text-[12px] font-semibold text-ink mb-1.5 block">Subject *</label>
                        <Input list="subject-suggestions-assign" value={assignForm.subject} onChange={(e) => setAssignForm((f) => ({ ...f, subject: e.target.value }))} placeholder="e.g. Mathematics" />
                        <datalist id="subject-suggestions-assign">
                          {SUBJECT_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
                        </datalist>
                      </div>
                    )}
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">Class *</label>
                      <SearchableSelect options={CLASS_OPTIONS} value={assignForm.class} onChange={(val) => setAssignForm((f) => ({ ...f, class: val, section: "" }))} renderLabel={(c) => subLabel(c)} placeholder="Select class" className="w-full" />
                    </div>
                    <div>
                      <label className="text-[12px] font-semibold text-ink mb-1.5 block">Section *</label>
                      <SearchableSelect options={filteredSections} value={assignForm.section} onChange={(val) => setAssignForm((f) => ({ ...f, section: val }))} renderLabel={(s) => `Section ${s}`} placeholder="Select section" className="w-full" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setAssignStaff(null)}>Close</Button>
                    <Button variant="amber" onClick={handleCreateAssignment}>
                      <Plus size={15} /> Add Assignment
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
