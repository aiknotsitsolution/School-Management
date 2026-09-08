import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Phone,
  Search,
  X,
  Save,
  Pencil,
  UserPlus,
  PhoneCall,
  CalendarCheck2,
  XCircle,
  Calendar,
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
} from "../components/UI";
import { api } from "../lib/api";

const initialEnquiries = [];

const STATUS_OPTIONS = [
  "All",
  "New",
  "Contacted",
  "Campus Visit Scheduled",
  "Admission Confirmed",
  "Declined",
];

const CLASS_OPTIONS = [
  "Nursery",
  "LKG",
  "UKG",
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11 (Science)",
  "Class 11 (Commerce)",
  "Class 12 (Science)",
  "Class 12 (Commerce)",
];

const SOURCE_OPTIONS = [
  "Website",
  "Walk-in",
  "Referral",
  "Social Media",
  "Newspaper Ad",
  "Other",
];

const backendStatus = {
  New: "New",
  Contacted: "Contacted",
  "Campus Visit Scheduled": "Contacted",
  "Admission Confirmed": "Admitted",
  Declined: "Rejected",
};

const backendSource = {
  Website: "Website",
  "Walk-in": "Walk-in",
  Referral: "Referral",
  "Social Media": "Other",
  "Newspaper Ad": "Other",
  Other: "Other",
};

function formatDate(d) {
  if (!d || d === "—") return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function emptyForm() {
  return {
    childName: "",
    parentName: "",
    classApplied: "Class 1",
    contact: "",
    date: new Date().toISOString().slice(0, 10),
    source: "Website",
    status: "New",
    followUp: "",
    admissionNo: "",
  };
}

export default function AdmissionEnquiry() {
  const [list, setList] = useState(initialEnquiries);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    api.admissions
      .list()
      .then(({ data }) => {
        setList(
          data.map((item) => ({
            ...item,
            id: item._id,
            date: item.createdAt || item.date,
            followUp: item.followUpDate || item.followUp || "—",
            status:
              item.status === "Admitted"
                ? "Admission Confirmed"
                : item.status === "Rejected"
                  ? "Declined"
                  : item.status,
            admissionNo: item.admissionNo || "",
          })),
        );
      })
      .catch((error) => setLoadError(error.message));
  }, []);

  const filtered = useMemo(() => {
    return list.filter((e) => {
      const matchStatus = statusFilter === "All" || e.status === statusFilter;
      const q = query.toLowerCase();
      const matchQuery =
        !q ||
        e.childName.toLowerCase().includes(q) ||
        e.parentName.toLowerCase().includes(q) ||
        e.classApplied.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        (e.admissionNo || "").toLowerCase().includes(q) ||
        (e.contact || "").includes(q);
      return matchStatus && matchQuery;
    });
  }, [list, query, statusFilter]);

  const counts = useMemo(() => {
    return {
      total: list.length,
      confirmed: list.filter((e) => e.status === "Admission Confirmed").length,
      scheduled: list.filter((e) => e.status === "Campus Visit Scheduled")
        .length,
      declined: list.filter((e) => e.status === "Declined").length,
      new: list.filter((e) => e.status === "New").length,
    };
  }, [list]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setForm({
      childName: item.childName,
      parentName: item.parentName,
      classApplied: item.classApplied,
      contact: item.contact,
      date: item.date,
      source: item.source,
      status: item.status,
      followUp: item.followUp === "—" ? "" : item.followUp,
      admissionNo: item.admissionNo || "",
    });
    setShowModal(true);
  };

  const updateForm = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSave = async () => {
    if (
      !form.childName.trim() ||
      !form.parentName.trim() ||
      !form.contact.trim()
    )
      return;

    if (form.status === "Admission Confirmed" && !form.admissionNo.trim()) {
      setLoadError(
        "Admission ID is required before confirming an admission",
      );
      return;
    }

    const payload = {
      childName: form.childName.trim(),
      parentName: form.parentName.trim(),
      classApplied: form.classApplied,
      contact: form.contact.trim(),
      source: backendSource[form.source] || "Other",
      status: backendStatus[form.status] || "New",
      followUpDate: form.followUp || undefined,
      admissionNo: form.admissionNo.trim() || undefined,
    };

    try {
      if (editId) {
        const { data } = await api.admissions.update(editId, payload);
        setList((prev) =>
          prev.map((e) =>
            e.id === editId
              ? {
                  ...e,
                  ...form,
                  ...data,
                  id: data._id || editId,
                  followUp: form.followUp || "—",
                }
              : e,
          ),
        );
      } else {
        const { data } = await api.admissions.create(payload);
        setList((prev) => [
          { ...data, id: data._id, ...form, followUp: form.followUp || "—" },
          ...prev,
        ]);
      }
      setShowModal(false);
      setForm(emptyForm());
      setEditId(null);
    } catch (error) {
      setLoadError(error.message);
    }
  };

  const changeStatus = async (id, newStatus) => {
    try {
      await api.admissions.update(id, {
        status: backendStatus[newStatus] || "New",
      });
      setList((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: newStatus } : e)),
      );
    } catch (error) {
      setLoadError(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Admissions & Outreach"
        title="Admission Enquiry"
        description="Track prospective families from first enquiry to confirmed admission."
        right={
          <Button variant="amber" onClick={openAdd}>
            <Plus size={15} /> New Enquiry
          </Button>
        }
      />
      {loadError && (
        <p className="text-alert text-[13px]">
          Backend unavailable: {loadError}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={UserPlus}
          label="Total Enquiries"
          value={String(counts.total)}
          sub={`${counts.new} new this cycle`}
          accent="amber"
        />
        <StatCard
          icon={CalendarCheck2}
          label="Visits Scheduled"
          value={String(counts.scheduled)}
          sub="Campus visits pending"
          accent="info"
        />
        <StatCard
          icon={PhoneCall}
          label="Confirmed Admissions"
          value={String(counts.confirmed)}
          sub="Successfully enrolled"
          accent="success"
        />
        <StatCard
          icon={XCircle}
          label="Declined"
          value={String(counts.declined)}
          sub="Not proceeding"
          accent="alert"
        />
      </div>

      {/* Table */}
      <Card
        title="All Enquiries"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
              />
              <Input
                placeholder="Search child, parent, ID..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 w-52"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-w-45"
            >
              {STATUS_OPTIONS.map((s) => (
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
            <UserPlus size={36} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[14px] font-medium text-ink">
              No enquiries found
            </p>
            <p className="text-[13px] text-slate-text/60 mt-1">
              Try different filters or add a new enquiry.
            </p>
            <Button variant="amber" className="mt-4" onClick={openAdd}>
              <Plus size={15} /> New Enquiry
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/6">
                  <th className="px-5 py-2.5 font-semibold">Enquiry ID</th>
                  <th className="px-5 py-2.5 font-semibold">Child</th>
                  <th className="px-5 py-2.5 font-semibold">Admission ID</th>
                  <th className="px-5 py-2.5 font-semibold">Parent</th>
                  <th className="px-5 py-2.5 font-semibold">Class Applied</th>
                  <th className="px-5 py-2.5 font-semibold">Contact</th>
                  <th className="px-5 py-2.5 font-semibold">Source</th>
                  <th className="px-5 py-2.5 font-semibold">Date</th>
                  <th className="px-5 py-2.5 font-semibold">Follow-up</th>
                  <th className="px-5 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 font-semibold text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-black/4 last:border-0 hover:bg-paper/50 transition-colors"
                  >
                    <td className="px-5 py-3 font-medium text-ink">{e.id}</td>
                    <td className="px-5 py-3 font-semibold text-ink">
                      {e.childName}
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-mono text-[12.5px] bg-paper px-2 py-1 rounded">
                        {e.admissionNo || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-text">
                      {e.parentName}
                    </td>
                    <td className="px-5 py-3 text-slate-text">
                      {e.classApplied}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-slate-text">
                        <Phone size={12} className="text-slate-text/50" />
                        {e.contact}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-text">{e.source}</td>
                    <td className="px-5 py-3 text-slate-text">
                      {formatDate(e.date)}
                    </td>
                    <td className="px-5 py-3 text-slate-text">
                      {e.followUp && e.followUp !== "—" ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} className="text-slate-text/50" />
                          {formatDate(e.followUp)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Select
                        value={e.status}
                        onChange={(ev) => changeStatus(e.id, ev.target.value)}
                        className="text-[12px] py-1.5 min-w-40"
                      >
                        {STATUS_OPTIONS.filter((s) => s !== "All").map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => openEdit(e)}
                        className="text-[12.5px] font-medium text-info hover:underline inline-flex items-center gap-1"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ========== ADD / EDIT MODAL ========== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/6">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  {editId ? "Edit Enquiry" : "New Admission Enquiry"}
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  Capture enquiry details and follow-up date.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Child Name *
                  </label>
                  <Input
                    placeholder="Child's full name"
                    value={form.childName}
                    onChange={(e) => updateForm("childName", e.target.value)}
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Parent / Guardian Name *
                  </label>
                  <Input
                    placeholder="Parent name"
                    value={form.parentName}
                    onChange={(e) => updateForm("parentName", e.target.value)}
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Admission ID{" "}
                    {form.status === "Admission Confirmed" && (
                      <span className="text-alert">*</span>
                    )}
                  </label>
                  <Input
                    placeholder="e.g. STU-5A-001"
                    autoComplete="off"
                    value={form.admissionNo}
                    onChange={(e) => updateForm("admissionNo", e.target.value)}
                  />
                  <p className="text-[11.5px] text-slate-text/60 mt-1">
                    Required once the admission is confirmed — links the
                    enquiry to the student's login ticket.
                  </p>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Class Applied
                  </label>
                  <Select
                    value={form.classApplied}
                    onChange={(e) => updateForm("classApplied", e.target.value)}
                  >
                    {CLASS_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Contact *
                  </label>
                  <Input
                    placeholder="+91 ..."
                    value={form.contact}
                    onChange={(e) => updateForm("contact", e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Enquiry Date
                  </label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => updateForm("date", e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Follow-up Date
                  </label>
                  <Input
                    type="date"
                    value={form.followUp}
                    onChange={(e) => updateForm("followUp", e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Source
                  </label>
                  <Select
                    value={form.source}
                    onChange={(e) => updateForm("source", e.target.value)}
                  >
                    {SOURCE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Status
                  </label>
                  <Select
                    value={form.status}
                    onChange={(e) => updateForm("status", e.target.value)}
                  >
                    {STATUS_OPTIONS.filter((s) => s !== "All").map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-black/6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                variant="amber"
                onClick={handleSave}
                disabled={
                  !form.childName.trim() ||
                  !form.parentName.trim() ||
                  !form.contact.trim()
                }
              >
                <Save size={15} /> {editId ? "Update" : "Save"} Enquiry
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// import { useState } from "react";
// import { Plus, Phone, Search } from "lucide-react";
// import { PageIntro, Card, Button, Input, Pill, statusTone, StatCard } from "../components/UI";
// import { UserPlus, PhoneCall, CalendarCheck2, XCircle } from "lucide-react";

// export default function AdmissionEnquiry() {
//   const [query, setQuery] = useState("");
//   const filtered = admissionEnquiries.filter((e) =>
//     (e.childName + e.parentName + e.classApplied).toLowerCase().includes(query.toLowerCase())
//   );

//   const counts = {
//     total: admissionEnquiries.length,
//     confirmed: admissionEnquiries.filter((e) => e.status === "Admission Confirmed").length,
//     scheduled: admissionEnquiries.filter((e) => e.status === "Campus Visit Scheduled").length,
//     declined: admissionEnquiries.filter((e) => e.status === "Declined").length,
//   };

//   return (
//     <div className="space-y-6">
//       <PageIntro
//         eyebrow="Admissions & Outreach"
//         title="Admission Enquiry"
//         description="Track prospective families from first enquiry to confirmed admission."
//         right={<Button variant="amber"><Plus size={15} /> New Enquiry</Button>}
//       />

//       <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//         <StatCard icon={UserPlus} label="Total Enquiries" value={counts.total} sub="This admission cycle" accent="amber" />
//         <StatCard icon={CalendarCheck2} label="Visits Scheduled" value={counts.scheduled} accent="info" />
//         <StatCard icon={PhoneCall} label="Confirmed Admissions" value={counts.confirmed} accent="success" />
//         <StatCard icon={XCircle} label="Declined" value={counts.declined} accent="alert" />
//       </div>

//       <Card
//         title="All Enquiries"
//         action={
//           <div className="relative">
//             <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40" />
//             <Input placeholder="Search enquiries..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8 w-52" />
//           </div>
//         }
//       >
//         <div className="overflow-x-auto -mx-5">
//           <table className="w-full text-[13px]">
//             <thead>
//               <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/[0.06]">
//                 <th className="px-5 py-2.5 font-semibold">Child</th>
//                 <th className="px-5 py-2.5 font-semibold">Parent</th>
//                 <th className="px-5 py-2.5 font-semibold">Class Applied</th>
//                 <th className="px-5 py-2.5 font-semibold">Contact</th>
//                 <th className="px-5 py-2.5 font-semibold">Source</th>
//                 <th className="px-5 py-2.5 font-semibold">Enquiry Date</th>
//                 <th className="px-5 py-2.5 font-semibold">Follow-up</th>
//                 <th className="px-5 py-2.5 font-semibold">Status</th>
//               </tr>
//             </thead>
//             <tbody>
//               {filtered.map((e) => (
//                 <tr key={e.id} className="border-b border-black/[0.04] hover:bg-paper/60">
//                   <td className="px-5 py-3 font-semibold text-ink">{e.childName}</td>
//                   <td className="px-5 py-3 text-slate-text">{e.parentName}</td>
//                   <td className="px-5 py-3 text-slate-text">{e.classApplied}</td>
//                   <td className="px-5 py-3 text-slate-text whitespace-nowrap"><span className="inline-flex items-center gap-1"><Phone size={12} />{e.contact}</span></td>
//                   <td className="px-5 py-3 text-slate-text">{e.source}</td>
//                   <td className="px-5 py-3 text-slate-text whitespace-nowrap">{e.date}</td>
//                   <td className="px-5 py-3 text-slate-text whitespace-nowrap">{e.followUp}</td>
//                   <td className="px-5 py-3"><Pill tone={statusTone(e.status)}>{e.status}</Pill></td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       </Card>
//     </div>
//   );
// }
