import { useEffect, useState } from "react";
import { Plus, X, Calendar, FileText } from "lucide-react";
import { PageIntro, Card, Button, Input, Select, Pill, toast } from "../../components/UI";
import { api } from "../../lib/api";
import useStudentContext from "./useStudentContext";

const STATUSES = { pending: "amber", approved: "success", rejected: "alert" };

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function StudentLeave() {
  const { user } = useStudentContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ fromDate: "", toDate: "", reason: "", type: "sick" });
  const [saving, setSaving] = useState(false);

  const fetchLeaves = () => {
    api.leaves.list("limit=50")
      .then(({ data }) => setItems(Array.isArray(data) ? data : data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLeaves(); }, []);

  const handleApply = async () => {
    if (!form.fromDate || !form.reason.trim()) {
      toast("From date and reason are required", "error");
      return;
    }
    setSaving(true);
    try {
      await api.leaves.create({
        fromDate: form.fromDate,
        toDate: form.toDate || form.fromDate,
        reason: form.reason.trim(),
        type: form.type,
      });
      toast("Leave request submitted");
      setShowModal(false);
      setForm({ fromDate: "", toDate: "", reason: "", type: "sick" });
      fetchLeaves();
    } catch (err) {
      toast(err.message || "Failed to submit", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="School Services"
        title="Leave Request"
        description="Apply for leave and track your requests."
        right={
          <Button onClick={() => setShowModal(true)}>
            <Plus size={15} /> Apply for Leave
          </Button>
        }
      />

      <Card title="My Leave Requests">
        {loading ? (
          <div className="py-14 text-center text-[13px] text-slate-text/60">Loading...</div>
        ) : items.length === 0 ? (
          <div className="py-14 text-center text-[13px] text-slate-text/60">No leave requests yet.</div>
        ) : (
          <div className="space-y-3">
            {items.map((r) => (
              <div key={r._id} className="flex items-start gap-3 p-3 rounded-xl bg-paper/60 hover:bg-paper transition-colors">
                <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center shrink-0">
                  <Calendar size={18} className="text-info" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13.5px] font-semibold text-ink">{fmtDate(r.fromDate)} — {fmtDate(r.toDate || r.fromDate)}</p>
                    <Pill tone={STATUSES[r.status] || "neutral"}>{r.status}</Pill>
                  </div>
                  <p className="text-[12px] text-slate-text/70 mt-1">{r.reason}</p>
                  {r.adminComment && <p className="text-[12px] text-info mt-1"><strong>Admin:</strong> {r.adminComment}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06]">
              <h3 className="font-display font-semibold text-ink text-[16px]">Apply for Leave</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-paper"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-text/60 uppercase">Leave Type</label>
                <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1">
                  <option value="sick">Sick Leave</option>
                  <option value="personal">Personal Leave</option>
                  <option value="family">Family Leave</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-text/60 uppercase">From Date *</label>
                  <Input type="date" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-text/60 uppercase">To Date</label>
                  <Input type="date" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-text/60 uppercase">Reason *</label>
                <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-info/30 focus:border-info" placeholder="Why do you need leave?" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/[0.06]">
              <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleApply} disabled={saving}>{saving ? "Submitting..." : "Submit Request"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
