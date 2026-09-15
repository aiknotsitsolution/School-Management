import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus, Search, ChevronLeft, ChevronRight, FileText, Trash2, RotateCcw, AlertTriangle, X } from "lucide-react";
import { api } from "../../lib/api";
import { Button, Card, Input, PageIntro, Pill, Select, toast } from "../../components/UI";

const statusTone = (status) =>
  status === "active" ? "success" : status === "suspended" ? "alert" : "neutral";

const onboardingTone = (status) => {
  const map = { live: "success", subscribed: "success", configured: "amber", created: "info" };
  return map[status] || "neutral";
};

const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-bold text-ink">{title}</h3>
          <button onClick={onClose} className="text-slate-text/60 hover:text-ink"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function SchoolsManagement() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [onboarding, setOnboarding] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState("active");

  // Modal states
  const [suspendModal, setSuspendModal] = useState({ open: false, school: null });
  const [suspendReason, setSuspendReason] = useState("");
  const [deleteModal, setDeleteModal] = useState({ open: false, school: null });
  const [deleteReason, setDeleteReason] = useState("");
  const [hardDeleteModal, setHardDeleteModal] = useState({ open: false, school: null });
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    if (plan) params.set("plan", plan);
    if (onboarding) params.set("onboarding", onboarding);
    if (activeTab === "deleted") params.set("deleted", "true");
    params.set("page", String(page));
    params.set("limit", "15");

    api.platform.schools
      .list(params.toString())
      .then((result) => {
        setRows(result.data || []);
        setTotal(result.total || 0);
        setPages(result.pages || 0);
        setLoading(false);
      })
      .catch((err) => {
        toast(err.message, "error");
        setLoading(false);
      });
  }, [q, status, plan, onboarding, page, refreshKey, activeTab]);

  // Reset page when switching tabs
  useEffect(() => { setPage(1); }, [activeTab]);

  const toggleStatus = async () => {
    const school = suspendModal.school;
    if (!school) return;
    const next = school.status === "active" ? "suspended" : "active";
    setBusyId(school._id);
    try {
      await api.platform.schools.setStatus(school._id, next, suspendReason);
      toast(next === "active" ? "School activated" : "School suspended");
      setSuspendModal({ open: false, school: null });
      setSuspendReason("");
      setRefreshKey((key) => key + 1);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusyId("");
    }
  };

  const handleSoftDelete = async () => {
    const school = deleteModal.school;
    if (!school) return;
    setBusyId(school._id);
    try {
      await api.platform.schools.softDelete(school._id, deleteReason);
      toast("School moved to trash");
      setDeleteModal({ open: false, school: null });
      setDeleteReason("");
      setRefreshKey((key) => key + 1);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusyId("");
    }
  };

  const handleRestore = async (school) => {
    setBusyId(school._id);
    try {
      await api.platform.schools.restore(school._id);
      toast("School restored");
      setRefreshKey((key) => key + 1);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusyId("");
    }
  };

  const handleHardDelete = async () => {
    const school = hardDeleteModal.school;
    if (!school) return;
    setBusyId(school._id);
    try {
      await api.platform.schools.hardDelete(school._id);
      toast("School permanently deleted");
      setHardDeleteModal({ open: false, school: null });
      setHardDeleteConfirm("");
      setRefreshKey((key) => key + 1);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="w-full">
      <PageIntro
        eyebrow="Platform Owner · School Operations"
        title="Schools Management"
        description={`${total} tenant school${total === 1 ? "" : "s"} across the platform. Search, filter, inspect a 360°, or suspend/reactivate a tenant.`}
        right={
          activeTab === "active" && (
            <Link to="/platform/onboarding">
              <Button variant="amber">
                <Plus size={15} /> New school
              </Button>
            </Link>
          )
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-black/[0.06]">
        {[
          { key: "active", label: "Active Schools" },
          { key: "deleted", label: "Deleted Schools" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-amber text-amber-dark"
                : "border-transparent text-slate-text/60 hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card bodyClassName="p-5">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/50" />
            <Input
              placeholder="Search name, code, city…"
              className="pl-9"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
            />
          </div>
          {activeTab === "active" && (
            <>
              <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </Select>
              <Select value={plan} onChange={(event) => { setPlan(event.target.value); setPage(1); }}>
                <option value="">All plans</option>
                <option value="trial">Trial</option>
                <option value="basic">Basic</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
              </Select>
              <Select value={onboarding} onChange={(event) => { setOnboarding(event.target.value); setPage(1); }}>
                <option value="">All onboarding</option>
                <option value="created">Created</option>
                <option value="configured">Configured</option>
                <option value="subscribed">Subscribed</option>
                <option value="live">Live</option>
              </Select>
            </>
          )}
          {activeTab === "deleted" && <div />}
        </div>

        {loading ? (
          <p className="text-[13px] text-slate-text/70 py-8 text-center">Loading schools…</p>
        ) : rows.length === 0 ? (
          <p className="text-[13px] text-slate-text/70 py-8 text-center">
            {activeTab === "deleted"
              ? "No deleted schools."
              : "No schools match. Adjust filters or onboard your first tenant."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[11.5px] uppercase tracking-wide text-slate-text/60 border-b border-black/[0.06]">
                  <th className="py-2.5 pr-4 font-semibold">School</th>
                  <th className="py-2.5 pr-4 font-semibold">Code</th>
                  <th className="py-2.5 pr-4 font-semibold">Status</th>
                  <th className="py-2.5 pr-4 font-semibold">Plan</th>
                  {activeTab === "active" && <th className="py-2.5 pr-4 font-semibold">Onboarding</th>}
                  <th className="py-2.5 pr-4 font-semibold">Created</th>
                  {activeTab === "deleted" && <th className="py-2.5 pr-4 font-semibold">Deleted</th>}
                  <th className="py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05]">
                {rows.map((school) => (
                  <tr key={school._id} className="hover:bg-paper/60">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-amber/15 text-amber-dark flex items-center justify-center shrink-0">
                          <Building2 size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-ink truncate">{school.name}</p>
                          <p className="text-[11.5px] text-slate-text/60 truncate">{school.shortName || school.city || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-mono text-[12px] text-slate-text/70">{school.code}</td>
                    <td className="py-3 pr-4">
                      <Pill tone={statusTone(school.status)}>{school.status}</Pill>
                    </td>
                    <td className="py-3 pr-4">
                      <Pill tone="info">{school.plan}</Pill>
                    </td>
                    {activeTab === "active" && (
                      <td className="py-3 pr-4">
                        <Pill tone={onboardingTone(school.onboarding?.status)}>{school.onboarding?.status || "created"}</Pill>
                      </td>
                    )}
                    <td className="py-3 pr-4 text-slate-text/70 whitespace-nowrap">{fmtDate(school.createdAt)}</td>
                    {activeTab === "deleted" && (
                      <td className="py-3 pr-4 text-slate-text/70 whitespace-nowrap">
                        <div>
                          <p>{fmtDate(school.deletedAt)}</p>
                          {school.deletedBy && <p className="text-[11px] text-slate-text/50">by {school.deletedBy}</p>}
                        </div>
                      </td>
                    )}
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {activeTab === "active" ? (
                          <>
                            <Link
                              to={`/platform/schools/${school._id}`}
                              className="inline-flex items-center gap-1 text-[12px] font-semibold text-info bg-info/10 px-2.5 py-1.5 rounded-lg hover:bg-info/20"
                            >
                              <FileText size={13} /> 360°
                            </Link>
                            <button
                              onClick={() => setSuspendModal({ open: true, school })}
                              disabled={busyId === school._id}
                              className="inline-flex items-center text-[12px] font-semibold text-ink bg-paper px-2.5 py-1.5 rounded-lg hover:bg-black/5 disabled:opacity-50"
                            >
                              {school.status === "active" ? "Suspend" : "Activate"}
                            </button>
                            <button
                              onClick={() => setDeleteModal({ open: true, school })}
                              disabled={busyId === school._id}
                              className="inline-flex items-center gap-1 text-[12px] font-semibold text-alert bg-alert/10 px-2.5 py-1.5 rounded-lg hover:bg-alert/20 disabled:opacity-50"
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleRestore(school)}
                              disabled={busyId === school._id}
                              className="inline-flex items-center gap-1 text-[12px] font-semibold text-success bg-success/10 px-2.5 py-1.5 rounded-lg hover:bg-success/20 disabled:opacity-50"
                            >
                              <RotateCcw size={12} /> Restore
                            </button>
                            <button
                              onClick={() => { setHardDeleteConfirm(""); setHardDeleteModal({ open: true, school }); }}
                              disabled={busyId === school._id}
                              className="inline-flex items-center gap-1 text-[12px] font-semibold text-white bg-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                              <AlertTriangle size={12} /> Hard Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-black/[0.06] mt-4">
            <p className="text-[12px] text-slate-text/60">
              Page {page} of {pages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                <ChevronLeft size={15} /> Prev
              </Button>
              <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={page >= pages}>
                Next <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Suspend / Activate Modal */}
      <Modal
        open={suspendModal.open}
        onClose={() => { setSuspendModal({ open: false, school: null }); setSuspendReason(""); }}
        title={suspendModal.school?.status === "active" ? "Suspend School" : "Activate School"}
      >
        <p className="text-[13px] text-slate-text/70 mb-3">
          {suspendModal.school?.status === "active"
            ? `Suspend "${suspendModal.school?.name}"? School admins will not be able to log in.`
            : `Activate "${suspendModal.school?.name}"? School admins will regain access.`}
        </p>
        {suspendModal.school?.status === "active" && (
          <div className="mb-4">
            <label className="block text-[12px] font-semibold text-ink mb-1">Reason</label>
            <Input
              placeholder="Reason for suspending…"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
            />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setSuspendModal({ open: false, school: null }); setSuspendReason(""); }}>
            Cancel
          </Button>
          <Button
            variant={suspendModal.school?.status === "active" ? "primary" : "amber"}
            onClick={toggleStatus}
            disabled={busyId === suspendModal.school?._id}
          >
            {suspendModal.school?.status === "active" ? "Suspend" : "Activate"}
          </Button>
        </div>
      </Modal>

      {/* Soft Delete Modal */}
      <Modal
        open={deleteModal.open}
        onClose={() => { setDeleteModal({ open: false, school: null }); setDeleteReason(""); }}
        title="Delete School"
      >
        <p className="text-[13px] text-slate-text/70 mb-3">
          Move "<strong>{deleteModal.school?.name}</strong>" to trash? You can restore it later from the Deleted Schools tab.
        </p>
        <div className="mb-4">
          <label className="block text-[12px] font-semibold text-ink mb-1">Reason (optional)</label>
          <Input
            placeholder="Reason for deleting…"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setDeleteModal({ open: false, school: null }); setDeleteReason(""); }}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={handleSoftDelete}
            disabled={busyId === deleteModal.school?._id}
          >
            <Trash2 size={13} /> Move to Trash
          </Button>
        </div>
      </Modal>

      {/* Hard Delete Confirmation Modal */}
      <Modal
        open={hardDeleteModal.open}
        onClose={() => { setHardDeleteModal({ open: false, school: null }); setHardDeleteConfirm(""); }}
        title="Permanent Delete"
      >
        <div className="mb-4">
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
            <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
            <p className="text-[13px] text-red-800">
              This action <strong>cannot be undone</strong>. All data for "<strong>{hardDeleteModal.school?.name}</strong>" will be permanently removed.
            </p>
          </div>
          <p className="text-[13px] text-slate-text/70 mb-3">
            If you want to delete all school data, type <strong>DELETE</strong> below to confirm:
          </p>
          <Input
            placeholder='Type "DELETE" to confirm'
            value={hardDeleteConfirm}
            onChange={(e) => setHardDeleteConfirm(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setHardDeleteModal({ open: false, school: null }); setHardDeleteConfirm(""); }}>
            No, Cancel
          </Button>
          <Button
            variant="primary"
            className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            onClick={handleHardDelete}
            disabled={hardDeleteConfirm !== "DELETE" || busyId === hardDeleteModal.school?._id}
          >
            Yes, Delete Permanently
          </Button>
        </div>
      </Modal>
    </div>
  );
}
