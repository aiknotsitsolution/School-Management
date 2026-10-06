import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Phone, Mail, UserRound, CalendarClock } from "lucide-react";
import {
  PageIntro,
  Card,
  Input,
  Select,
  Button,
  Pill,
  StatCard,
  toast,
} from "../../components/UI";
import { api } from "../../lib/api";
import useStaffContext, { fmtDate } from "./useStaffContext";

const STATUSES = ["New", "Contacted", "Campus Visit Scheduled", "Admitted", "Rejected"];
const SOURCES = ["Website", "Referral", "Walk-in", "Phone", "Other"];

/** Follow-up due date as a plain yyyy-mm-dd string (local time, not UTC). */
const toDateInput = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** A follow-up is "due" when it lands today or earlier (and hasn't been admitted/rejected). */
const isFollowUpDue = (en) => {
  if (!en?.followUpDate || ["Admitted", "Rejected"].includes(en.status)) return false;
  const due = new Date(toDateInput(en.followUpDate));
  const today = new Date(toDateInput(new Date()));
  return due.getTime() <= today.getTime();
};
const emptyDraft = {
  childName: "",
  parentName: "",
  classApplied: "",
  contact: "",
  email: "",
  source: "Walk-in",
  notes: "",
};

export default function Enquiries() {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [expanded, setExpanded] = useState(null);
  const [followUpDate, setFollowUpDate] = useState("");

  const refresh = () => {
    setLoading(true);
    api.admissions
      .list()
      .then(({ data }) => setEnquiries(data?.reverse ? [...data].reverse() : data || []))
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const list = useMemo(() => {
    const q = search.toLowerCase();
    return (enquiries || []).filter(
      (en) =>
        (statusFilter === "due"
          ? isFollowUpDue(en)
          : !statusFilter || en.status === statusFilter) &&
        (!q ||
          (en.childName || "").toLowerCase().includes(q) ||
          (en.parentName || "").toLowerCase().includes(q) ||
          (en.contact || "").toLowerCase().includes(q) ||
          (en.admissionNo || "").toLowerCase().includes(q)),
    );
  }, [enquiries, statusFilter, search]);

  const byStatus = {};
  enquiries.forEach((q) => { byStatus[q.status] = (byStatus[q.status] || 0) + 1; });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.admissions.create(draft);
      toast("Enquiry logged", "success");
      setShowForm(false);
      setDraft(emptyDraft);
      refresh();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.admissions.update(id, { status });
      toast(`Status updated to ${status}`, "success");
      refresh();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  /** Schedule (or clear) the next follow-up call for an enquiry. */
  const saveFollowUp = async (id) => {
    try {
      await api.admissions.update(id, {
        followUpDate: followUpDate ? new Date(followUpDate).toISOString() : null,
      });
      toast(followUpDate ? `Follow-up set for ${followUpDate}` : "Follow-up cleared", "success");
      refresh();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const dueCount = enquiries.filter(isFollowUpDue).length;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Reception Workspace"
        title="Admission Enquiries"
        description="Capture and track enquiries from walk-ins, calls and the website."
        right={
          <Button variant="primary" onClick={() => setShowForm((v) => !v)}>
            <Plus size={15} /> New Enquiry
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={null} label="Total" value={String(enquiries.length)} accent="info" />
        <StatCard icon={null} label="New" value={String(byStatus["New"] || 0)} accent="primary" />
        <StatCard icon={null} label="Follow-ups due" value={String(dueCount)} accent="warn" />
        <StatCard icon={null} label="Admitted" value={String(byStatus["Admitted"] || 0)} accent="success" />
        <StatCard icon={null} label="Rejected" value={String(byStatus["Rejected"] || 0)} accent="alert" />
      </div>

      {showForm && (
        <Card title="Log New Enquiry">
          <form onSubmit={submit} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Input placeholder="Child's name" value={draft.childName} onChange={(e) => setDraft({ ...draft, childName: e.target.value })} required />
            <Input placeholder="Parent's name" value={draft.parentName} onChange={(e) => setDraft({ ...draft, parentName: e.target.value })} required />
            <Input placeholder="Class applying for (e.g. 6)" value={draft.classApplied} onChange={(e) => setDraft({ ...draft, classApplied: e.target.value })} required />
            <Input placeholder="Contact number" value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} required />
            <Input placeholder="Email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            <Select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
            <Input placeholder="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="sm:col-span-2 lg:col-span-2" />
            <div className="flex items-end gap-2">
              <Button type="submit">Save Enquiry</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <Card
        title="Enquiry List"
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40" />
              <Input placeholder="Search name / contact…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-52" />
            </div>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44">
              <option value="">All stages</option>
              <option value="due">Follow-ups due</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
        }
      >
        {loading ? (
          <p className="text-[13px] text-slate-text py-10 text-center">Loading enquiries…</p>
        ) : list.length === 0 ? (
          <p className="text-[13px] text-slate-text py-10 text-center">No enquiries found.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                  <th className="px-5 py-2 font-semibold">Child</th>
                  <th className="px-3 py-2 font-semibold">Class</th>
                  <th className="px-3 py-2 font-semibold">Parent / Contact</th>
                  <th className="px-3 py-2 font-semibold">Source</th>
                  <th className="px-3 py-2 font-semibold">Stage</th>
                  <th className="px-3 py-2 font-semibold text-right">Update</th>
                </tr>
              </thead>
              <tbody>
                {list.map((q) => (
                  <>
                    <tr
                      key={q._id}
                      className="border-t border-slate-200 hover:bg-paper/60 cursor-pointer"
                      onClick={() => {
                        const next = expanded === q._id ? null : q._id;
                        setExpanded(next);
                        setFollowUpDate(next ? toDateInput(q.followUpDate) : "");
                      }}
                    >
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-paper flex items-center justify-center text-slate-text shrink-0">
                            <UserRound size={15} />
                          </div>
                          <div>
                            <p className="font-semibold text-ink">{q.childName}</p>
                            <p className="text-[11.5px] text-slate-text/60">{q.admissionNo || "No admission no."}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">Class {q.classApplied || "—"}</td>
                      <td className="px-3 py-2.5 text-slate-text/80">
                        <p className="flex items-center gap-1.5"><Phone size={11} /> {q.parentName || "—"}</p>
                        <p className="text-[12px] text-slate-text/60">{q.contact || "—"}</p>
                      </td>
                      <td className="px-3 py-2.5"><Pill tone="neutral">{q.source}</Pill></td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Pill tone={q.status === "New" ? "info" : q.status === "Admitted" ? "success" : q.status === "Rejected" ? "alert" : "primary"}>{q.status}</Pill>
                          {isFollowUpDue(q) && (
                            <Pill tone="warning"><CalendarClock size={11} className="mr-1 inline" />Due</Pill>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Select value={q.status} onChange={(e) => updateStatus(q._id, e.target.value)} className="w-44 py-1.5" onClick={(e) => e.stopPropagation()}>
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </Select>
                      </td>
                    </tr>
                    {expanded === q._id && (
                      <tr key={`${q._id}-detail`} className="border-t border-slate-200 bg-paper/40">
                        <td colSpan={6} className="px-5 py-3.5">
                          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[12.5px]">
                            <p className="text-slate-text/70 flex items-center gap-1.5"><Phone size={12} /> {q.contact || "—"}</p>
                            <p className="text-slate-text/70 flex items-center gap-1.5"><Mail size={12} /> {q.email || "—"}</p>
                            <p className="text-slate-text/70">Logged {fmtDate(q.createdAt)}</p>
                            <p className="text-slate-text/70">Notes: {q.notes || "—"}</p>
                          </div>
                          <div
                            className="mt-3 flex flex-wrap items-end gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <label className="block text-[12px] font-semibold text-slate-text/70">
                              Next follow-up
                              <span className="mt-1 block w-44">
                                <Input
                                  type="date"
                                  value={followUpDate}
                                  onChange={(e) => setFollowUpDate(e.target.value)}
                                  className="py-1.5"
                                />
                              </span>
                            </label>
                            <Button
                              type="button"
                              className="px-3 py-2"
                              onClick={() => saveFollowUp(q._id)}
                            >
                              Save follow-up
                            </Button>
                            {q.followUpDate && (
                              <span className="pb-1.5 text-[12px] text-slate-text/60">
                                Currently scheduled {fmtDate(q.followUpDate)}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}