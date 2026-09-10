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
  CalendarDays,
  Hash,
  BadgeCheck,
  ArrowUpRight,
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
} from "../components/UI";
import { api } from "../lib/api";
import { useMasterOptions } from "../hooks/useMasterOptions";
import SearchableSelect from "../components/SearchableSelect";

const initialEnquiries = [];

const STATUS_OPTIONS = [
  "All",
  "New",
  "Contacted",
  "Campus Visit Scheduled",
  "Admission Confirmed",
  "Declined",
];

const PROGRESS_STAGES = [
  "New",
  "Contacted",
  "Campus Visit Scheduled",
  "Admission Confirmed",
];

const STAGES = [
  { key: "New", label: "New Leads", color: "bg-sky-500", dot: "bg-sky-500" },
  { key: "Contacted", label: "Contacted", color: "bg-amber-500", dot: "bg-amber-500" },
  { key: "Campus Visit Scheduled", label: "Campus Visit", color: "bg-violet-500", dot: "bg-violet-500" },
  { key: "Admission Confirmed", label: "Confirmed", color: "bg-emerald-500", dot: "bg-emerald-500" },
  { key: "Declined", label: "Rejected", color: "bg-rose-500", dot: "bg-rose-500" },
];

const CLASS_OPTIONS_FALLBACK = [
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

function formatDateFull(d) {
  if (!d || d === "—") return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function enquiryNo(id) {
  if (!id) return "—";
  const hex = String(id).replace(/[^a-f0-9]/gi, "").toUpperCase();
  return hex ? `ENQ-${hex.slice(-6)}` : "—";
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
  const { options: CLASS_OPTIONS } = useMasterOptions("classes", CLASS_OPTIONS_FALLBACK);
  const [list, setList] = useState(initialEnquiries);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    api.admissions
      .list()
      .then(({ data }) => {
        setList(
          data.map((item) => ({
            ...item,
            id: item._id,
            enquiryNo: enquiryNo(item._id),
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
        (e.enquiryNo || "").toLowerCase().includes(q) ||
        (e.admissionNo || "").toLowerCase().includes(q) ||
        (e.contact || "").includes(q);
      return matchStatus && matchQuery;
    });
  }, [list, query, statusFilter]);

  const counts = useMemo(() => {
    const map = {
      "New": 0,
      "Contacted": 0,
      "Campus Visit Scheduled": 0,
      "Admission Confirmed": 0,
      Declined: 0,
    };
    list.forEach((e) => {
      if (map[e.status] !== undefined) map[e.status] += 1;
    });
    return {
      ...map,
      total: list.length,
      new: map.New,
      confirmed: map["Admission Confirmed"],
      scheduled: map["Campus Visit Scheduled"],
      declined: map.Declined,
    };
  }, [list]);

  const selected = useMemo(
    () => list.find((e) => e.id === selectedId) || null,
    [list, selectedId],
  );

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm());
    setSelectedId(null);
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
    setSelectedId(null);
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
        if (selectedId === editId) setSelectedId(editId);
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
    if (id !== selectedId) return;
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

  const toggleStage = (key) => {
    setStatusFilter((current) => (current === key ? "All" : key));
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Admissions & Outreach"
        title="Admission Enquiry"
        description="Track prospective families from first enquiry to confirmed admission — all in one workspace."
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

      {/* ========== PIPELINE STAGES ========== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {STAGES.map((stage) => {
          const n = counts[stage.key] || 0;
          const active = statusFilter === stage.key;
          const pct = counts.total ? Math.round((n / counts.total) * 100) : 0;
          return (
            <button
              key={stage.key}
              onClick={() => toggleStage(stage.key)}
              className={`rounded-2xl border bg-white p-4 text-left transition-all ${
                active
                  ? "border-amber ring-2 ring-amber/20 shadow-sm"
                  : "border-black/[0.06] shadow-sm hover:border-black/15 hover:-translate-y-0.5"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-text/70">
                  {stage.label}
                </span>
                <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
              </div>
              <p className="font-display text-2xl font-bold text-ink mt-1">
                {n}
              </p>
              <div className="mt-2.5 h-1 rounded-full bg-black/[0.06] overflow-hidden">
                <div
                  className={`h-full rounded-full ${stage.color} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-text/50 mt-1.5">{pct}%</p>
            </button>
          );
        })}
      </div>

      {/* ========== ENQUIRY TABLE ========== */}
      <Card
        title={
          <span className="inline-flex items-center gap-2">
            All Enquiries
            <span className="text-[11px] font-bold bg-paper text-slate-text px-2 py-0.5 rounded-full">
              {filtered.length}
            </span>
          </span>
        }
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
                className="pl-8 w-60"
              />
            </div>
          </div>
        }
      >
        {/* Status chips */}
        <div className="flex flex-wrap items-center gap-1.5 px-5 pt-2 pb-3 border-b border-black/[0.05]">
          <button
            onClick={() => setStatusFilter("All")}
            className={`px-3 py-1.5 rounded-full text-[11.5px] font-semibold transition-colors ${
              statusFilter === "All"
                ? "bg-ink text-white"
                : "bg-paper text-slate-text hover:bg-slate-200"
            }`}
          >
            All · {counts.total}
          </button>
          {STAGES.map((stage) => (
            <button
              key={stage.key}
              onClick={() => toggleStage(stage.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-semibold transition-colors ${
                statusFilter === stage.key
                  ? "bg-ink text-white"
                  : "bg-paper text-slate-text hover:bg-slate-200"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
              {stage.label} · {counts[stage.key] || 0}
            </button>
          ))}
        </div>

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
                <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/[0.06]">
                  <th className="px-5 py-2.5 font-semibold">Enquiry ID</th>
                  <th className="px-5 py-2.5 font-semibold">Child</th>
                  <th className="px-5 py-2.5 font-semibold">Admission ID</th>
                  <th className="px-5 py-2.5 font-semibold">Class Applied</th>
                  <th className="px-5 py-2.5 font-semibold">Contact</th>
                  <th className="px-5 py-2.5 font-semibold">Source</th>
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
                    onClick={() => setSelectedId(e.id)}
                    className="group cursor-pointer border-b border-black/[0.04] last:border-0 hover:bg-paper/60 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <span className="font-mono text-[11.5px] font-semibold text-slate-text/80 bg-paper px-2 py-1 rounded-lg">
                        {e.enquiryNo}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={e.avatar} name={e.childName} size={36} />
                        <div>
                          <p className="font-semibold text-ink flex items-center gap-1.5">
                            {e.childName}
                            <ArrowUpRight
                              size={13}
                              className="text-slate-text/40 opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                          </p>
                          <p className="text-[11.5px] text-slate-text/55">
                            {e.parentName}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {e.admissionNo ? (
                        <span className="font-mono text-[11.5px] font-semibold bg-amber/15 text-amber-dark px-2 py-1 rounded-lg">
                          {e.admissionNo}
                        </span>
                      ) : (
                        <span className="text-[12px] text-slate-text/40">
                          Not assigned
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-ink">
                          {e.classApplied}
                        </span>
                        <span className="text-[11.5px] text-slate-text/55">
                          {e.section ? `Section ${e.section}` : "Section —"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-slate-text text-[12.5px] whitespace-nowrap">
                        <Phone size={12} className="text-slate-text/50" />
                        {e.contact}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[11.5px] font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                        {e.source}
                      </span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {e.followUp && e.followUp !== "—" ? (
                        <span className="inline-flex items-center gap-1 text-[12.5px] text-slate-text">
                          <Calendar size={12} className="text-slate-text/40" />
                          {formatDate(e.followUp)}
                        </span>
                      ) : (
                        <span className="text-[12px] text-slate-text/40">
                          None
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={statusTone(e.status)}>{e.status}</Pill>
                    </td>
                    <td
                      className="px-5 py-3 text-right"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <Button
                        variant="outline"
                        className="!px-3 !py-1.5"
                        onClick={() => openEdit(e)}
                        title="Edit enquiry"
                      >
                        <Pencil size={13} /> Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ========== DETAILS DRAWER ========== */}
      {selected && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setSelectedId(null)}
          />
          <aside className="absolute right-0 inset-y-0 w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="relative overflow-hidden bg-ink px-6 pt-6 pb-6 text-white shrink-0">
              <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-amber/25 blur-2xl" />
              <div className="absolute -bottom-14 -left-10 w-36 h-36 rounded-full bg-info/20 blur-2xl" />
              <div className="relative flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <Avatar
                    src={selected.avatar}
                    name={selected.childName}
                    size={52}
                    className="ring-2 ring-white/20"
                  />
                  <div>
                    <p className="font-display text-[17px] font-bold leading-tight">
                      {selected.childName}
                    </p>
                    <p className="text-[12px] text-white/60 mt-0.5">
                      {selected.parentName} · {selected.contact}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/70"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="relative flex items-center gap-2 mt-4">
                <span className="font-mono text-[11px] font-semibold bg-white/10 text-white/80 px-2 py-1 rounded-lg">
                  {selected.enquiryNo}
                </span>
                <Pill tone={statusTone(selected.status)}>
                  {selected.status}
                </Pill>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
              {/* Status stepper */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-text/60 mb-3">
                  Update pipeline
                </p>
                <div className="space-y-1">
                  {PROGRESS_STAGES.map((stage, i) => {
                    const current = selected.status === stage;
                    const done = PROGRESS_STAGES.indexOf(selected.status) > i;
                    const stageMeta = STAGES.find((s) => s.key === stage);
                    return (
                      <button
                        key={stage}
                        onClick={() => changeStatus(selected.id, stage)}
                        className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                          current
                            ? "bg-paper"
                            : "hover:bg-paper/60"
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            done || current
                              ? stageMeta.color
                              : "bg-slate-200 text-slate-400"
                          } text-white`}
                        >
                          {done ? (
                            <BadgeCheck size={14} />
                          ) : (
                            <span className="text-[11px] font-bold">
                              {i + 1}
                            </span>
                          )}
                        </span>
                        <span
                          className={`text-[13px] font-medium ${
                            current
                              ? "text-ink font-semibold"
                              : "text-slate-text"
                          }`}
                        >
                          {stage}
                        </span>
                        {current && (
                          <span className="ml-auto text-[10.5px] font-bold uppercase tracking-wide text-amber-dark bg-amber/15 px-2 py-0.5 rounded-full">
                            Current
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {selected.status !== "Declined" && (
                  <button
                    onClick={() => changeStatus(selected.id, "Declined")}
                    className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-alert/20 text-alert text-[12.5px] font-semibold px-3 py-2 hover:bg-alert/5 transition-colors"
                  >
                    <XCircle size={14} /> Mark as declined
                  </button>
                )}
              </div>

              {/* Details */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-text/60 mb-3">
                  Enquiry details
                </p>
                <div className="rounded-2xl border border-black/[0.06] divide-y divide-black/[0.04]">
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[12.5px] text-slate-text/70 inline-flex items-center gap-2">
                      <Phone size={13} className="text-slate-text/40" /> Contact
                    </span>
                    <span className="text-[13px] font-medium text-ink">
                      {selected.contact}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[12.5px] text-slate-text/70">Class Applied</span>
                    <span className="text-[13px] font-medium text-ink">
                      {selected.classApplied}
                      {selected.section ? ` · Sec ${selected.section}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[12.5px] text-slate-text/70">Source</span>
                    <span className="text-[13px] font-medium text-ink">
                      {selected.source}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[12.5px] text-slate-text/70 inline-flex items-center gap-2">
                      <CalendarDays size={13} className="text-slate-text/40" /> Enquiry date
                    </span>
                    <span className="text-[13px] font-medium text-ink">
                      {formatDateFull(selected.date)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[12.5px] text-slate-text/70 inline-flex items-center gap-2">
                      <Calendar size={13} className="text-slate-text/40" /> Follow-up
                    </span>
                    <span className="text-[13px] font-medium text-ink">
                      {formatDate(selected.followUp)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[12.5px] text-slate-text/70 inline-flex items-center gap-2">
                      <PhoneCall size={13} className="text-slate-text/40" /> Next action
                    </span>
                    <span className="text-[13px] font-medium text-ink">
                      {selected.followUp && selected.followUp !== "—" ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-dark">
                          <CalendarCheck2 size={13} /> Follow-up
                        </span>
                      ) : (
                        "No follow-up set"
                      )}
                    </span>
                  </div>
                  {selected.admissionNo && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-[12.5px] text-slate-text/70 inline-flex items-center gap-2">
                        <Hash size={13} className="text-slate-text/40" /> Admission ID
                      </span>
                      <span className="font-mono text-[12.5px] font-semibold bg-amber/15 text-amber-dark px-2 py-0.5 rounded-lg">
                        {selected.admissionNo}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-black/[0.06] flex justify-end gap-2 shrink-0">
              <Button variant="outline" onClick={() => setSelectedId(null)}>
                Done
              </Button>
              <Button variant="amber" onClick={() => openEdit(selected)}>
                <Pencil size={14} /> Edit Enquiry
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* ========== ADD / EDIT MODAL ========== */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="relative overflow-hidden bg-ink px-6 pt-5 pb-5 text-white shrink-0">
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber/25 blur-2xl" />
              <div className="relative flex items-center justify-between">
                <div>
                  <h3 className="font-display font-semibold text-[18px]">
                    {editId ? "Edit Enquiry" : "New Admission Enquiry"}
                  </h3>
                  <p className="text-[12.5px] text-white/60 mt-0.5">
                    Capture the family's details and follow-up plan.
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/70"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Child Name <span className="text-alert">*</span>
                  </label>
                  <Input
                    placeholder="Child's full name"
                    value={form.childName}
                    onChange={(e) => updateForm("childName", e.target.value)}
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Parent / Guardian Name <span className="text-alert">*</span>
                  </label>
                  <Input
                    placeholder="Parent name"
                    value={form.parentName}
                    onChange={(e) => updateForm("parentName", e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Class Applied
                  </label>
                  <SearchableSelect
                    options={CLASS_OPTIONS}
                    value={form.classApplied}
                    onChange={(val) => updateForm("classApplied", val)}
                    placeholder="Select class"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Contact <span className="text-alert">*</span>
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
              </div>
            </div>

            <div className="px-6 py-4 border-t border-black/[0.06] flex justify-end gap-2 shrink-0">
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