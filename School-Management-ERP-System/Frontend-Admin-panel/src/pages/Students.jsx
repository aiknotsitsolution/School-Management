import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  X,
  Phone,
  Mail,
  MapPin,
  Droplet,
  Calendar,
  Save,
  Pencil,
  Users,
  UserCheck,
  Wallet,
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
} from "../components/UI";
const initialStudents = [];
import { api } from "../lib/api";
import { PermissionGate } from "../lib/permissions";

const CLASS_OPTIONS = [
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

const SECTION_OPTIONS = ["A", "B", "C"];
const HOUSE_OPTIONS = ["Aravali", "Nilgiri", "Shivalik", "Vindhya"];
const GENDER_OPTIONS = ["Male", "Female"];
const BLOOD_OPTIONS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const FEE_STATUS_OPTIONS = ["Paid", "Partially Paid", "Pending"];

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
    fatherName: "",
    motherName: "",
    contact: "",
    email: "",
    address: "",
    house: "Aravali",
    feeStatus: "Pending",
    attendance: 95,
  };
}

function makeAvatar(name) {
  const encoded = encodeURIComponent(name || "Student");
  return `https://ui-avatars.com/api/?name=${encoded}&background=16213E&color=fff&bold=true`;
}

function normalizeStudent(student) {
  return {
    ...student,
    id: student.id || student._id || student.admissionNo,
    roll: Number(student.roll ?? student.rollNo ?? 0),
    contact: student.contact || student.parentContact || "",
    email: student.email || student.parentEmail || "",
    fatherName: student.fatherName || student.parentName || "",
    motherName: student.motherName || "",
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
    rollNo: String(form.roll),
    dob: form.dob || undefined,
    bloodGroup: form.bloodGroup,
    address: form.address,
    parentName: form.fatherName,
    parentContact: form.contact,
    parentEmail: form.email,
    status: "Active",
  };
}

export default function Students() {
  const [list, setList] = useState(initialStudents);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [query, setQuery] = useState("");
  const [cls, setCls] = useState("All");
  const [section, setSection] = useState("All");
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    let active = true;
    api.students
      .list()
      .then(({ data }) => {
        if (active && Array.isArray(data)) setList(data.map(normalizeStudent));
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
  }, []);

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
          String(s.roll).includes(q) ||
          (s.contact || "").includes(q);
        return matchClass && matchSection && matchQuery;
      })
      .sort((a, b) => a.roll - b.roll);
  }, [list, query, cls, section]);

  const stats = useMemo(() => {
    const total = list.length;
    const paid = list.filter((s) => s.feeStatus === "Paid").length;
    const avgAtt =
      total > 0
        ? Math.round(list.reduce((a, s) => a + (s.attendance || 0), 0) / total)
        : 0;
    return { total, paid, avgAtt, pending: total - paid };
  }, [list]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (student) => {
    setEditId(student.id);
    setForm({
      name: student.name,
      gender: student.gender,
      class: student.class,
      section: student.section,
      roll: String(student.roll),
      dob: student.dob,
      bloodGroup: student.bloodGroup,
      fatherName: student.fatherName || "",
      motherName: student.motherName || "",
      contact: student.contact || "",
      email: student.email || "",
      address: student.address || "",
      house: student.house || "Aravali",
      feeStatus: student.feeStatus || "Pending",
      attendance: student.attendance || 95,
    });
    setShowModal(true);
    setSelected(null);
  };

  const updateForm = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.roll) return;

    try {
      const payload = toApiStudent(form, editId || `STU-${Date.now()}`);
      const response = editId
        ? await api.students.update(editId, payload)
        : await api.students.create(payload);
      const saved = normalizeStudent(response.data);
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
          <PermissionGate permission="students:write">
            <Button variant="amber" onClick={openAdd}>
              <Plus size={15} /> Add Student
            </Button>
          </PermissionGate>
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
          accent="amber"
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
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 w-56"
              />
            </div>
            <Select
              value={cls}
              onChange={(e) => setCls(e.target.value)}
              className="min-w-[120px]"
            >
              {CLASS_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c === "All" ? "All Classes" : formatClass(c)}
                </option>
              ))}
            </Select>
            <Select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="min-w-[100px]"
            >
              <option value="All">All Sections</option>
              {SECTION_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </Select>
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
              Try different filters or add a new student.
            </p>
            <PermissionGate permission="students:write">
              <Button variant="amber" className="mt-4" onClick={openAdd}>
                <Plus size={15} /> Add Student
              </Button>
            </PermissionGate>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/[0.06]">
                  <th className="px-5 py-2.5 font-semibold">Student</th>
                  <th className="px-5 py-2.5 font-semibold">Class</th>
                  <th className="px-5 py-2.5 font-semibold">Roll No.</th>
                  <th className="px-5 py-2.5 font-semibold">Attendance</th>
                  <th className="px-5 py-2.5 font-semibold">Fee Status</th>
                  <th className="px-5 py-2.5 font-semibold">Contact</th>
                  <th className="px-5 py-2.5 font-semibold text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-black/[0.04] last:border-0 hover:bg-paper/50 transition-colors cursor-pointer"
                    onClick={() => setSelected(s)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={s.avatar} name={s.name} size={36} />
                        <div>
                          <p className="font-semibold text-ink">{s.name}</p>
                          <p className="text-[11.5px] text-slate-text/55">
                            {s.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-text">
                      {formatClass(s.class)}-{s.section}
                    </td>
                    <td className="px-5 py-3 font-medium text-ink">{s.roll}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`font-semibold ${
                          s.attendance >= 90
                            ? "text-success"
                            : s.attendance >= 75
                              ? "text-amber-dark"
                              : "text-alert"
                        }`}
                      >
                        {s.attendance}%
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={statusTone(s.feeStatus)}>{s.feeStatus}</Pill>
                    </td>
                    <td className="px-5 py-3 text-slate-text text-[12.5px]">
                      {s.contact}
                    </td>
                    <td
                      className="px-5 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PermissionGate permission="students:write">
                        <button
                          onClick={() => openEdit(s)}
                          className="text-[12.5px] font-medium text-info hover:underline inline-flex items-center gap-1"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ========== DETAIL DRAWER ========== */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right">
            <div className="sticky top-0 bg-white border-b border-black/[0.06] px-5 py-4 flex items-center justify-between z-10">
              <h3 className="font-display font-semibold text-ink text-[16px]">
                Student Profile
              </h3>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg hover:bg-paper"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              <div className="text-center mb-5">
                <img
                  src={selected.avatar}
                  alt={selected.name}
                  className="w-20 h-20 rounded-2xl object-cover mx-auto border border-black/10"
                />
                <h3 className="font-display font-bold text-ink text-lg mt-3">
                  {selected.name}
                </h3>
                <p className="text-[12.5px] text-slate-text/70">
                  {selected.id} · {formatClass(selected.class)}-
                  {selected.section} · Roll {selected.roll}
                </p>
                <div className="flex justify-center gap-2 mt-3">
                  <Pill tone={statusTone(selected.feeStatus)}>
                    {selected.feeStatus}
                  </Pill>
                  <Pill tone="info">{selected.house} House</Pill>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-paper rounded-xl p-3 text-center">
                  <p className="font-display text-xl font-bold text-ink">
                    {selected.attendance}%
                  </p>
                  <p className="text-[11px] text-slate-text/60">Attendance</p>
                </div>
                <div className="bg-paper rounded-xl p-3 text-center">
                  <p className="font-display text-xl font-bold text-ink">
                    {selected.bloodGroup}
                  </p>
                  <p className="text-[11px] text-slate-text/60">Blood Group</p>
                </div>
              </div>

              <div className="space-y-2.5 text-[13px] mb-5">
                <p className="flex items-center gap-2 text-slate-text">
                  <Calendar size={14} className="text-slate-text/50" /> DOB:{" "}
                  {selected.dob}
                </p>
                <p className="flex items-center gap-2 text-slate-text">
                  <Phone size={14} className="text-slate-text/50" />{" "}
                  {selected.contact}
                </p>
                <p className="flex items-center gap-2 text-slate-text">
                  <Mail size={14} className="text-slate-text/50" />{" "}
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

              <div className="border-t border-black/[0.06] pt-4 mb-5">
                <p className="text-[12px] font-semibold text-slate-text/60 uppercase mb-2">
                  Parent / Guardian
                </p>
                <p className="text-[13px] text-ink font-medium">
                  Father: {selected.fatherName}
                </p>
                <p className="text-[13px] text-ink font-medium mt-1">
                  Mother: {selected.motherName}
                </p>
              </div>

              <div className="flex gap-2">
                <PermissionGate permission="students:write">
                  <Button
                    variant="outline"
                    className="flex-1 justify-center"
                    onClick={() => openEdit(selected)}
                  >
                    <Pencil size={14} /> Edit
                  </Button>
                </PermissionGate>
                <Button
                  variant="amber"
                  className="flex-1 justify-center"
                  onClick={() => setSelected(null)}
                >
                  Close
                </Button>
              </div>
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
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
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
                  <Select
                    value={form.class}
                    onChange={(e) => updateForm("class", e.target.value)}
                  >
                    {CLASS_OPTIONS.filter((c) => c !== "All").map((c) => (
                      <option key={c} value={c}>
                        {formatClass(c)}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Section
                  </label>
                  <Select
                    value={form.section}
                    onChange={(e) => updateForm("section", e.target.value)}
                  >
                    {SECTION_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Roll No. *
                  </label>
                  <Input
                    type="number"
                    placeholder="e.g. 101"
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
                    House
                  </label>
                  <Select
                    value={form.house}
                    onChange={(e) => updateForm("house", e.target.value)}
                  >
                    {HOUSE_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Fee Status
                  </label>
                  <Select
                    value={form.feeStatus}
                    onChange={(e) => updateForm("feeStatus", e.target.value)}
                  >
                    {FEE_STATUS_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </Select>
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

            <div className="px-5 py-4 border-t border-black/[0.06] flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                variant="amber"
                onClick={handleSave}
                disabled={!form.name.trim() || !form.roll}
              >
                <Save size={15} /> {editId ? "Update" : "Add"} Student
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
//         right={<Button variant="amber"><Plus size={15} /> Add Student</Button>}
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
//               <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/[0.06]">
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
//                 <tr key={s.id} onClick={() => setSelected(s)} className="border-b border-black/[0.04] hover:bg-paper/60 cursor-pointer">
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
//               <div className="border-t border-black/[0.06] pt-4">
//                 <p className="text-[12px] font-semibold text-slate-text/60 uppercase mb-2">Parent / Guardian</p>
//                 <p className="text-[13px] text-ink font-medium">Father: {selected.fatherName}</p>
//                 <p className="text-[13px] text-ink font-medium mt-1">Mother: {selected.motherName}</p>
//               </div>
//               <Button variant="amber" className="w-full justify-center mt-2">View Full Profile</Button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
