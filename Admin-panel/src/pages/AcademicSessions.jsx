import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Flag, Play, Plus, Save, Trash2, X } from "lucide-react";
import { PageIntro, Card, Button, Input, Pill, toast } from "../components/UI";
import { api } from "../lib/api";
import { usePermission } from "../lib/permissions";

const EMPTY = { name: "", startDate: "", endDate: "", status: "" };

function fmt(iso) {
  if (!iso) return "—";
  return String(iso).slice(0, 10);
}

const toneFor = (status) =>
  status === "active" ? "success" : status === "ended" ? "neutral" : "amber";

const validate = (form) => {
  if (!form.startDate || !form.endDate) return "Start and end dates are required";
  if (new Date(form.endDate) <= new Date(form.startDate)) {
    return "End date must be after start date";
  }
  return "";
};

export default function AcademicSessions() {
  const canWrite = usePermission("sessions:write");
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    api.sessions
      .list()
      .then(({ data }) => setSessions(data || []))
      .catch(() => toast("Could not load academic sessions", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY);
    setShowModal(true);
  };

  const openEdit = (session) => {
    setEditId(session._id);
    setForm({
      name: session.name || "",
      startDate: fmt(session.startDate),
      endDate: fmt(session.endDate),
      status: session.status || "",
    });
    setShowModal(true);
  };

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    const message = validate(form);
    if (message) return toast(message, "error");
    setBusy(true);
    try {
      const payload = { name: form.name.trim(), startDate: form.startDate, endDate: form.endDate };
      const response = editId
        ? await api.sessions.update(editId, payload)
        : await api.sessions.create(payload);
      setShowModal(false);
      setForm(EMPTY);
      setEditId(null);
      toast(editId ? "Session updated" : "Session created");
      if (response.data?.isCurrent) {
        toast("This session is now the current academic session");
      }
      load();
    } catch (err) {
      toast(err.message || "Save failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn, doneMessage) => {
    setBusy(true);
    try {
      await fn();
      toast(doneMessage);
      load();
    } catch (err) {
      toast(err.message || "Action failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const activate = (session) => {
    if (!canWrite) return;
    if (
      !window.confirm(
        `Make "${session.name}" the current academic session? The previous current session will be marked as ended.`,
      )
    ) {
      return;
    }
    act(() => api.sessions.activate(session._id), "Session activated");
  };

  const end = (session) => {
    if (!canWrite) return;
    if (!window.confirm(`End "${session.name}"? Existing records are preserved for this session.`)) return;
    act(() => api.sessions.end(session._id), "Session ended");
  };

  const remove = (session) => {
    if (!canWrite) return;
    if (!window.confirm(`Delete "${session.name}"? Only future, never-started sessions can be removed.`)) {
      return;
    }
    act(() => api.sessions.remove(session._id), "Session deleted");
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="Academic Sessions"
        description="Define the school year calendar. Exactly one session is current at any time and drives the session value used across fees, assignments, marks and report cards."
        right={
          canWrite ? (
            <Button onClick={openAdd}>
              <Plus size={16} /> New Session
            </Button>
          ) : null
        }
      />

      <Card
        title="Sessions"
        bodyClassName="p-0"
        action={
          <div className="flex items-center gap-2 text-[12px] text-slate-text/70">
            <CalendarDays size={14} /> {sessions.length} scheduled
          </div>
        }
      >
        {loading ? (
          <div className="p-6 text-[13px] text-slate-text/70">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-[13px] text-slate-text mb-3">
              No academic sessions defined yet. Create the first one and it becomes the current session.
            </p>
            {canWrite && (
              <Button onClick={openAdd}>
                <Plus size={16} /> Create First Session
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-black/[0.06]">
            {sessions.map((session) => (
              <div key={session._id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[14px] text-ink">{session.name}</p>
                    {session.isCurrent && session.status === "active" && (
                      <Pill tone="success">
                        <CheckCircle2 size={12} /> Current
                      </Pill>
                    )}
                    <Pill tone={toneFor(session.status)}>{session.status}</Pill>
                  </div>
                  <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                    {fmt(session.startDate)} → {fmt(session.endDate)}
                  </p>
                </div>
                {canWrite && (
                  <div className="flex items-center gap-2">
                    {session.status !== "ended" && (
                      <Button variant="ghost" className="text-[12px] px-2.5 py-1.5" onClick={() => openEdit(session)}>
                        <Save size={13} /> Edit
                      </Button>
                    )}
                    {session.status !== "ended" && !session.isCurrent && (
                      <Button variant="ghost" className="text-[12px] px-2.5 py-1.5" onClick={() => activate(session)}>
                        <Play size={13} /> Activate
                      </Button>
                    )}
                    {session.status === "active" && (
                      <Button variant="ghost" className="text-[12px] px-2.5 py-1.5" onClick={() => end(session)}>
                        <Flag size={13} /> End
                      </Button>
                    )}
                    {session.status === "planned" && (
                      <Button variant="danger" className="text-[12px] px-2.5 py-1.5" onClick={() => remove(session)}>
                        <Trash2 size={13} /> Delete
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <h3 className="font-semibold text-[15px] text-ink">
                {editId ? "Edit Academic Session" : "New Academic Session"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-text/60 hover:text-ink">
                <X size={17} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                  Session name
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  disabled={form.status === "active"}
                  placeholder="Derived from dates, e.g. 2026-27"
                />
                {form.status === "active" ? (
                  <p className="text-[11.5px] text-slate-text/50 mt-1">
                    Locked once live — fees, assignments and marks reference this label. Change the dates instead.
                  </p>
                ) : (
                  <p className="text-[11.5px] text-slate-text/50 mt-1">
                    Leave blank to derive from the dates (e.g. 01 Apr 2026 – 31 Mar 2027 → 2026-27).
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                    Start date *
                  </label>
                  <Input type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} />
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                    End date *
                  </label>
                  <Input type="date" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} />
                </div>
              </div>
              <p className="text-[12px] text-slate-text/60">
                Sessions cannot overlap. The first live session becomes the current session automatically.
              </p>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-black/[0.06]">
              <Button variant="ghost" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={busy}>
                <Save size={15} /> {busy ? "Saving..." : editId ? "Save Changes" : "Create Session"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}