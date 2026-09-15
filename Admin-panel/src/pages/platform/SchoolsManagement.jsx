import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus, Search, ChevronLeft, ChevronRight, FileText, Pencil, X } from "lucide-react";
import { api } from "../../lib/api";
import { Button, Card, Input, PageIntro, Pill, Select, toast } from "../../components/UI";
import SearchableDropdown from "../../components/SearchableDropdown";

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
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const openEdit = (school) => {
    setForm({
      name: school.name || "",
      shortName: school.shortName || "",
      email: school.email || "",
      phone: school.phone || "",
      website: school.website || "",
      board: school.board || "",
      recognitionNumber: school.recognitionNumber || "",
      recognitionAuthority: school.recognitionAuthority || "",
      address: school.address || "",
      city: school.city || "",
      state: school.state || "",
      pincode: school.pincode || "",
    });
    setEditing(school);
  };

  const saveEdit = async () => {
    if (!form.name.trim()) {
      toast("School name is required", "error");
      return;
    }
    setSaving(true);
    try {
      await api.platform.schools.update(editing._id, form);
      toast("School updated");
      setEditing(null);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    if (plan) params.set("plan", plan);
    if (onboarding) params.set("onboarding", onboarding);
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
  }, [q, status, plan, onboarding, page, refreshKey]);

  const toggleStatus = async (school) => {
    const next = school.status === "active" ? "suspended" : "active";
    const reason = window.prompt(
      `Reason for ${next === "suspended" ? "suspending" : "activating"} ${school.name}:`,
    );
    if (reason === null) return;
    setBusyId(school._id);
    try {
      await api.platform.schools.setStatus(school._id, next, reason);
      toast(next === "active" ? "School activated" : "School suspended");
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
          <Link to="/platform/onboarding">
            <Button variant="amber">
              <Plus size={15} /> New school
            </Button>
          </Link>
        }
      />

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
        </div>

        {loading ? (
          <p className="text-[13px] text-slate-text/70 py-8 text-center">Loading schools…</p>
        ) : rows.length === 0 ? (
          <p className="text-[13px] text-slate-text/70 py-8 text-center">
            No schools match. Adjust filters or onboard your first tenant.
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
                  <th className="py-2.5 pr-4 font-semibold">Onboarding</th>
                  <th className="py-2.5 pr-4 font-semibold">Created</th>
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
                    <td className="py-3 pr-4">
                      <Pill tone={onboardingTone(school.onboarding?.status)}>{school.onboarding?.status || "created"}</Pill>
                    </td>
                    <td className="py-3 pr-4 text-slate-text/70 whitespace-nowrap">{fmtDate(school.createdAt)}</td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          to={`/platform/schools/${school._id}`}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-info bg-info/10 px-2.5 py-1.5 rounded-lg hover:bg-info/20"
                        >
                          <FileText size={13} /> 360°
                        </Link>
                        <button
                          onClick={() => openEdit(school)}
                          disabled={busyId === school._id}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink bg-paper px-2.5 py-1.5 rounded-lg hover:bg-black/5 disabled:opacity-50"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          onClick={() => toggleStatus(school)}
                          disabled={busyId === school._id}
                          className="inline-flex items-center text-[12px] font-semibold text-ink bg-paper px-2.5 py-1.5 rounded-lg hover:bg-black/5 disabled:opacity-50"
                        >
                          {school.status === "active" ? "Suspend" : "Activate"}
                        </button>
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

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-amber/15 text-amber-dark flex items-center justify-center">
                  <Building2 size={16} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-ink">Edit school</h3>
                  <p className="text-[11.5px] text-slate-text/60">{editing.code}</p>
                </div>
              </div>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-black/5 text-slate-text/70">
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-text/60 mb-1">School name</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-text/60 mb-1">Short name</label>
                <Input value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-text/60 mb-1">Email</label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-text/60 mb-1">Phone</label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-text/60 mb-1">Website</label>
                <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-text/60 mb-1">Board</label>
                <SearchableDropdown category="board" label="" value={form.board} onChange={(v) => setForm({ ...form, board: v })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-text/60 mb-1">Address</label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-text/60 mb-1">City</label>
                <SearchableDropdown category="city" label="" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-text/60 mb-1">State</label>
                <SearchableDropdown category="state" label="" value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-text/60 mb-1">Pincode</label>
                <Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-text/60 mb-1">Recognition no.</label>
                <Input value={form.recognitionNumber} onChange={(e) => setForm({ ...form, recognitionNumber: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-text/60 mb-1">Recognition authority</label>
                <SearchableDropdown category="recognition_authority" label="" value={form.recognitionAuthority} onChange={(v) => setForm({ ...form, recognitionAuthority: v })} />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="amber" onClick={saveEdit} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}