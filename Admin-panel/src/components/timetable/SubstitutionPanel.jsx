import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Check, Plus, Trash2, X } from "lucide-react";
import { api } from "../../lib/api";
import { Button, Card, Input, Pill, Select, toast } from "../UI";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayFor(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || "")) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return "";
  return DAY_NAMES[date.getDay()] || "";
}

function timeLabel(value) {
  if (!value) return "";
  const [h, m] = String(value).split(":").map((part) => Number(part));
  if (Number.isNaN(h)) return value;
  const period = h >= 12 ? "PM" : "AM";
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

const STATUS_TONE = { scheduled: "warning", completed: "success", cancelled: "alert" };

// Admin substitution management: coverage for one class period on a date,
// derived from the published timetable and validated server-side (409 on
// substitute conflicts).
export default function SubstitutionPanel({ cls, section, canWrite = false }) {
  const [date, setDate] = useState(today);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(null); // { date, periodKey, substituteTeacherId, reason }
  const [conflicts, setConflicts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [timetable, setTimetable] = useState([]);

  const loadList = () => {
    if (!cls || !section) return Promise.resolve();
    const query = `class=${encodeURIComponent(cls)}&section=${encodeURIComponent(section)}${date ? `&date=${date}` : ""}`;
    return api.timetable.substitutions
      .list(query)
      .then(({ data }) => setList(Array.isArray(data) ? data : []))
      .catch((requestError) => setError(requestError.message));
  };

  // Fetch only (no synchronous setState in the effect body — the date input's
  // onChange resets loading/error as a user event instead).
  useEffect(() => {
    if (!cls || !section) return undefined;
    let cancelled = false;
    const query = `class=${encodeURIComponent(cls)}&section=${encodeURIComponent(section)}${date ? `&date=${date}` : ""}`;
    api.timetable.substitutions
      .list(query)
      .then(({ data }) => {
        if (cancelled) return;
        setList(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(requestError.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cls, section, date]);

  useEffect(() => {
    if (!cls || !section) return;
    api.timetable
      .list(`class=${encodeURIComponent(cls)}&section=${encodeURIComponent(section)}`)
      .then(({ data }) => setTimetable(Array.isArray(data) ? data : []))
      .catch(() => setTimetable([]));
  }, [cls, section]);

  useEffect(() => {
    api.staff
      .list()
      .then(({ data }) => setStaff(Array.isArray(data) ? data : []))
      .catch(() => setStaff([]));
  }, []);

  const teacherOptions = useMemo(() => {
    const candidates =
      (staff || []).filter(
        (s) =>
          s.role === "teacher" ||
          String(s.designation || "").toLowerCase().includes("teacher"),
      ) || [];
    const list2 = candidates.length ? candidates : staff || [];
    const seen = new Set();
    const options = [];
    list2.forEach((s) => {
      const id = String(s._id || s.id || `staff-${s.name}`);
      if (seen.has(id)) return;
      seen.add(id);
      options.push({ id, name: s.name, label: `${s.name}${s.employeeId ? ` (${s.employeeId})` : ""}` });
    });
    return options;
  }, [staff]);

  const formDay = dayFor(form ? form.date : date);
  const periodOptions = useMemo(() => {
    const slot = timetable.find((t) => t.day === formDay);
    return (slot?.periods || [])
      .filter((p) => p.teacherId)
      .map((p) => ({
        value: `${p.startTime}|${p.endTime}`,
        label: `${timeLabel(p.startTime)}-${timeLabel(p.endTime)} · ${p.subject} · ${p.teacherName || "Teacher"}`,
      }));
  }, [timetable, formDay]);

  const openCreate = () => {
    setConflicts([]);
    setForm({
      date,
      periodKey: periodOptions.length ? periodOptions[0].value : "",
      substituteTeacherId: "",
      reason: "",
    });
  };

  const handleCreate = async () => {
    if (!form) return;
    if (!form.periodKey) {
      toast("Select the period to cover", "error");
      return;
    }
    if (!form.substituteTeacherId) {
      toast("Select the substitute teacher", "error");
      return;
    }
    const [startTime, endTime] = form.periodKey.split("|");
    const substitute = teacherOptions.find((t) => t.id === form.substituteTeacherId);
    setBusy(true);
    try {
      await api.timetable.substitutions.create({
        date: form.date,
        class: cls,
        section,
        startTime,
        endTime,
        substituteTeacherId: form.substituteTeacherId,
        substituteTeacherName: substitute ? substitute.name : "",
        reason: form.reason,
      });
      toast("Substitution created — substitute teacher notified");
      setForm(null);
      setConflicts([]);
      if (form.date !== date) setDate(form.date);
      else loadList();
    } catch (requestError) {
      if (requestError.status === 409) {
        setConflicts(requestError.conflicts || [requestError.message]);
      }
      toast(requestError.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (id, status) => {
    setBusy(true);
    try {
      await api.timetable.substitutions.setStatus(id, status);
      toast(status === "completed" ? "Marked completed" : "Substitution cancelled");
      loadList();
    } catch (requestError) {
      toast(requestError.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    setBusy(true);
    try {
      await api.timetable.substitutions.remove(id);
      toast("Substitution removed");
      loadList();
    } catch (requestError) {
      toast(requestError.message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (!cls || !section) return null;

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <CalendarClock size={16} />
          Substitutions — Class {cls}-{section}
        </span>
      }
      action={
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setLoading(true);
              setError("");
            }}
            className="w-[150px]"
          />
          {canWrite && (
            <Button variant="primary" onClick={openCreate} disabled={busy}>
              <Plus size={15} /> New substitution
            </Button>
          )}
        </div>
      }
    >
      {error && <p className="text-[13px] text-alert mb-3">{error}</p>}

      {conflicts.length > 0 && !form && (
        <div className="rounded-lg bg-alert/10 border border-alert/30 px-3.5 py-3 mb-3">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-alert">
            <AlertTriangle size={14} /> Substitution conflict — nothing was saved
          </p>
          <ul className="mt-1.5 space-y-1">
            {conflicts.map((line, i) => (
              <li key={i} className="text-[12px] text-alert/90">{line}</li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-[13px] text-slate-text/60">Loading substitutions...</p>
      ) : list.length === 0 ? (
        <div className="py-8 text-center">
          <CalendarClock size={30} className="mx-auto text-slate-text/30 mb-2" />
          <p className="text-[13.5px] font-medium text-ink">No substitutions for this date</p>
          <p className="text-[12.5px] text-slate-text/60 mt-1">
            Create coverage when a teacher will be absent for a scheduled period.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {list.map((sub) => (
            <div key={sub._id} className="py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Pill tone={STATUS_TONE[sub.status] || "neutral"}>{sub.status}</Pill>
              <span className="text-[13px] font-semibold text-ink">{sub.subject || "Period"}</span>
              <span className="text-[12.5px] text-slate-text/70">
                {sub.date} · {timeLabel(sub.startTime)}-{timeLabel(sub.endTime)}
              </span>
              <span className="text-[12.5px] text-slate-text/70">
                {sub.originalTeacherName || "Original"} → {sub.substituteTeacherName || "Substitute"}
              </span>
              {sub.roomName && <span className="text-[12px] text-slate-text/50">{sub.roomName}</span>}
              {sub.reason && (
                <span className="text-[12px] text-slate-text/50 italic truncate max-w-[220px]">
                  {sub.reason}
                </span>
              )}
              {canWrite && sub.status === "scheduled" && (
                <span className="flex items-center gap-1 ml-auto">
                  <button
                    type="button"
                    onClick={() => changeStatus(sub._id, "completed")}
                    disabled={busy}
                    className="p-1.5 rounded-md hover:bg-success/10 text-success"
                    title="Mark completed"
                    aria-label="Mark substitution completed"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => changeStatus(sub._id, "cancelled")}
                    disabled={busy}
                    className="p-1.5 rounded-md hover:bg-warning-light text-amber-600"
                    title="Cancel substitution"
                    aria-label="Cancel substitution"
                  >
                    <X size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(sub._id)}
                    disabled={busy}
                    className="p-1.5 rounded-md hover:bg-alert/10 text-alert"
                    title="Delete substitution"
                    aria-label="Delete substitution"
                  >
                    <Trash2 size={15} />
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {form && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => !busy && setForm(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  New substitution
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  Class {cls} - {section} · {formDay || "pick a valid date"}
                </p>
              </div>
              <button
                onClick={() => !busy && setForm(null)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {conflicts.length > 0 && (
                <div className="rounded-lg bg-alert/10 border border-alert/30 px-3.5 py-3">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-alert">
                    <AlertTriangle size={14} /> Scheduling conflict — nothing was saved
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {conflicts.map((line, i) => (
                      <li key={i} className="text-[12px] text-alert/90">{line}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <label className="block text-[12.5px] font-medium text-ink mb-1.5">Date</label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-ink mb-1.5">
                  Period to cover
                </label>
                <Select
                  value={form.periodKey}
                  onChange={(e) => setForm((f) => ({ ...f, periodKey: e.target.value }))}
                >
                  {!periodOptions.length && <option value="">No periods with a teacher</option>}
                  {periodOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                {!DAYS.includes(formDay) && (
                  <p className="text-[12px] text-alert mt-1">
                    No timetable on {formDay || "this date"} — pick a school day
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-ink mb-1.5">
                  Substitute teacher
                </label>
                <Select
                  value={form.substituteTeacherId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, substituteTeacherId: e.target.value }))
                  }
                >
                  <option value="">Select teacher</option>
                  {teacherOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-ink mb-1.5">
                  Reason <span className="text-slate-text/60 font-normal">(optional)</span>
                </label>
                <Input
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Medical leave"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setForm(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreate} disabled={busy}>
                {busy ? "Creating..." : "Create substitution"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
