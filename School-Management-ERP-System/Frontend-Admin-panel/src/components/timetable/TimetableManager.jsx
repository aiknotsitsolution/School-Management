import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { api } from "../../lib/api";
import { Button, Card, Input, Pill, Select, toast } from "../UI";
import MasterSelect from "../MasterSelect";
import CustomMasterModal from "../CustomMasterModal";
import { invalidateMasterCache } from "../../lib/masterCache";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function sortPeriods(periods) {
  return [...(periods || [])].sort((a, b) =>
    String(a.startTime || "").localeCompare(String(b.startTime || "")),
  );
}

function timeLabel(value) {
  if (!value) return "";
  const [h, m] = String(value).split(":").map((part) => Number(part));
  if (Number.isNaN(h)) return value;
  const period = h >= 12 ? "PM" : "AM";
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

export default function TimetableManager({ cls, section, canWrite = false }) {
  const [timetable, setTimetable] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(null); // { mode, day, index, ...period }
  const [confirmDelete, setConfirmDelete] = useState(null); // { day, index }
  const [customModal, setCustomModal] = useState(null); // { kind, label, showDescription? } | null

  useEffect(() => {
    api.staff
      .list()
      .then(({ data }) => setStaff(Array.isArray(data) ? data : []))
      .catch(() => setStaff([]));
  }, []);

  useEffect(() => {
    if (!cls || !section) return;
    setLoading(true);
    setError("");
    const query = `class=${encodeURIComponent(cls)}&section=${encodeURIComponent(section)}`;
    api.timetable
      .list(query)
      .then(({ data }) => setTimetable(Array.isArray(data) ? data : []))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [cls, section]);

  const byDay = useMemo(() => {
    const map = new Map(DAYS.map((day) => [day, []]));
    timetable.forEach((slot) => {
      if (map.has(slot.day)) map.set(slot.day, sortPeriods(slot.periods));
    });
    return map;
  }, [timetable]);

  const teacherOptions = useMemo(() => {
    const candidates =
      (staff || []).filter(
        (s) =>
          s.role === "teacher" ||
          String(s.designation || "").toLowerCase().includes("teacher"),
      ) || [];
    const list = candidates.length ? candidates : staff || [];
    const seen = new Set();
    const options = [];
    list.forEach((s) => {
      const id = String(s._id || s.id || `staff-${s.name}`);
      const label = `${s.name}${s.employeeId ? ` (${s.employeeId})` : ""}`;
      if (seen.has(label)) return;
      seen.add(label);
      options.push({ id, name: s.name, label });
    });
    return options;
  }, [staff]);

  const totalSlots = useMemo(
    () => [...byDay.values()].reduce((sum, periods) => sum + periods.length, 0),
    [byDay],
  );

  const openAdd = (day) => {
    setDraft({
      mode: "add",
      day,
      subject: "",
      subjectId: "",
      teacherId: "",
      teacherName: "",
      startTime: "",
      endTime: "",
    });
  };

  const openEdit = (day, index) => {
    const period = (byDay.get(day) || [])[index];
    if (!period) return;
    setDraft({
      mode: "edit",
      day,
      index,
      subject: period.subject || "",
      subjectId: period.subjectId || "",
      teacherId: period.teacherId || "",
      teacherName: period.teacherName || "",
      startTime: period.startTime || "",
      endTime: period.endTime || "",
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.subject.trim()) {
      toast("Subject is required", "error");
      return;
    }
    if (!draft.day) {
      toast("Select a day", "error");
      return;
    }
    if (!draft.startTime || !draft.endTime) {
      toast("Start and end times are required", "error");
      return;
    }
    if (draft.endTime <= draft.startTime) {
      toast("End time must be after start time", "error");
      return;
    }

    const slot = timetable.find((t) => t.day === draft.day);
    const base = sortPeriods(slot?.periods || []);
    const newPeriod = {
      subject: draft.subject.trim(),
      teacherId: draft.teacherId,
      teacherName: draft.teacherName,
      startTime: draft.startTime,
      endTime: draft.endTime,
    };
    const next =
      draft.mode === "edit"
        ? base.map((p, i) => (i === draft.index ? newPeriod : p))
        : [...base, newPeriod];

    setSaving(true);
    try {
      const { data } = await api.timetable.save({
        class: cls,
        section,
        day: draft.day,
        periods: sortPeriods(next),
      });
      setTimetable((prev) => [
        ...prev.filter((t) => t.day !== draft.day),
        data,
      ]);
      toast(draft.mode === "edit" ? "Period updated" : "Period added");
      setDraft(null);
    } catch (requestError) {
      toast(requestError.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const { day, index } = confirmDelete;
    const slot = timetable.find((t) => t.day === day);
    if (!slot) {
      setConfirmDelete(null);
      return;
    }
    const remaining = sortPeriods(slot.periods || []).filter(
      (_, i) => i !== index,
    );
    setSaving(true);
    try {
      if (remaining.length === 0) {
        await api.timetable.remove(slot._id);
        setTimetable((prev) => prev.filter((t) => t._id !== slot._id));
        toast("Day cleared");
      } else {
        const { data } = await api.timetable.save({
          class: cls,
          section,
          day,
          periods: remaining,
        });
        setTimetable((prev) => [
          ...prev.filter((t) => t.day !== day),
          data,
        ]);
        toast("Period removed");
      }
      setConfirmDelete(null);
    } catch (requestError) {
      toast(requestError.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (!cls || !section) {
    return (
      <Card>
        <CalendarDays size={30} className="text-slate-text/30 mx-auto mb-3" />
        <p className="text-center text-[14px] font-medium text-ink">
          Select a class and section to manage its timetable
        </p>
        <p className="text-center text-[13px] text-slate-text/60 mt-1">
          Choose from the options above to view or edit this week&apos;s schedule.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Card>
          <p className="text-sm text-alert">{error}</p>
        </Card>
      )}

      <Card
        title={
          <span className="capitalize">
            Class {cls} - {section}
          </span>
        }
        action={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[12px] text-slate-text/60">
              <Clock size={14} />
              <span>
                {totalSlots} slot{totalSlots === 1 ? "" : "s"}
              </span>
            </div>
            {canWrite && (
              <Button variant="amber" onClick={() => openAdd("Monday")} disabled={saving}>
                <Plus size={15} /> Add Period
              </Button>
            )}
          </div>
        }
      >
        {loading ? (
          <p className="py-14 text-center text-[13px] text-slate-text/60">
            Loading timetable...
          </p>
        ) : totalSlots === 0 ? (
          <div className="py-14 text-center">
            <CalendarDays size={34} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[14px] font-medium text-ink">
              No timetable published for this class yet
            </p>
            <p className="text-[13px] text-slate-text/60 mt-1">
              {canWrite
                ? "Add the first period for this class to get started."
                : "Published schedules appear here as lesson slots are saved."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-5 pb-5">
              {DAYS.map((day) => {
                const periods = byDay.get(day) || [];
                return (
                  <div
                    key={day}
                    className="rounded-xl border border-black/[0.06] overflow-hidden"
                  >
                    <div className="flex items-center justify-between bg-ink text-white px-4 py-2.5">
                      <span className="font-semibold text-[12.5px]">{day}</span>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => openAdd(day)}
                          className="p-1 rounded-md hover:bg-white/15 text-white/80"
                          title={`Add period on ${day}`}
                          aria-label={`Add period on ${day}`}
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                    {periods.length === 0 ? (
                      <p className="px-4 py-6 text-center text-[12px] text-slate-text/50">
                        No periods
                      </p>
                    ) : (
                      <div className="divide-y divide-black/[0.04]">
                        {periods.map((period, index) => (
                          <div key={`${day}-${index}`} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[13px] font-semibold text-ink">
                                {period.subject || "—"}
                              </p>
                              <div className="flex items-center gap-1">
                                <Pill tone="amber">{timeLabel(period.startTime)}</Pill>
                                {canWrite && (
                                  <div className="flex items-center">
                                    <button
                                      type="button"
                                      onClick={() => openEdit(day, index)}
                                      className="p-1 rounded-md hover:bg-paper text-slate-text"
                                      title="Edit period"
                                      aria-label={`Edit ${period.subject} on ${day}`}
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDelete({ day, index })}
                                      className="p-1 rounded-md hover:bg-alert/10 text-alert"
                                      title="Remove period"
                                      aria-label={`Remove ${period.subject} on ${day}`}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <p className="text-[11.5px] text-slate-text/60 mt-1 truncate">
                              {period.teacherName || "Not assigned"}
                              {period.startTime &&
                                ` · ${timeLabel(period.startTime)}-${timeLabel(
                                  period.endTime,
                                )}`}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Add / Edit modal */}
      {draft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => !saving && setDraft(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  {draft.mode === "edit" ? "Edit Period" : "Add Period"}
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  Class {cls} - {section}
                </p>
              </div>
              <button
                onClick={() => !saving && setDraft(null)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-[12.5px] font-medium text-ink mb-1.5">
                  Day
                </label>
                <Select
                  value={draft.day}
                  onChange={(e) => setDraft((d) => ({ ...d, day: e.target.value }))}
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-ink mb-1.5">
                  Subject
                </label>
                <MasterSelect
                  kind="subjects"
                  label="Subject"
                  placeholder="Select subject"
                  searchLabel="Search subjects..."
                  value={draft.subjectId}
                  fallbackLabel={draft.subject}
                  onChange={(id, item) =>
                    setDraft((d) => ({
                      ...d,
                      subjectId: id,
                      subject: item ? item.name : "",
                    }))
                  }
                  canAdd
                  onAdd={() =>
                    setCustomModal({
                      kind: "subjects",
                      label: "Subject",
                      showDescription: true,
                    })
                  }
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-ink mb-1.5">
                  Teacher
                </label>
                <Select
                  value={draft.teacherId}
                  onChange={(e) => {
                    const option = teacherOptions.find(
                      (t) => t.id === e.target.value,
                    );
                    setDraft((d) => ({
                      ...d,
                      teacherId: e.target.value,
                      teacherName: option ? option.name : d.teacherName,
                    }));
                  }}
                >
                  <option value="">Not assigned</option>
                  {teacherOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12.5px] font-medium text-ink mb-1.5">
                    Start time
                  </label>
                  <Input
                    type="time"
                    value={draft.startTime}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, startTime: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-ink mb-1.5">
                    End time
                  </label>
                  <Input
                    type="time"
                    value={draft.endTime}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, endTime: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-black/[0.06] flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="amber" onClick={handleSave} disabled={saving}>
                <Save size={15} />
                {saving ? "Saving..." : draft.mode === "edit" ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => !saving && setConfirmDelete(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-alert/10 text-alert flex items-center justify-center">
                <AlertTriangle size={19} />
              </div>
              <div>
                <h3 className="font-display font-semibold text-ink text-[16px]">
                  Remove this period?
                </h3>
                <p className="text-[13px] text-slate-text/80 mt-1">
                  The {(byDay.get(confirmDelete.day) || [])[confirmDelete.index]?.subject || "period"}{" "}
                  on {confirmDelete.day} will be removed from the timetable.
                </p>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-black/[0.06] flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                className="bg-alert text-white hover:bg-alert/90 border-alert"
                onClick={handleConfirmDelete}
                disabled={saving}
              >
                <Trash2 size={15} />
                {saving ? "Removing..." : "Remove"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom master modal */}
      {customModal && (
        <CustomMasterModal
          kind={customModal.kind}
          label={customModal.label}
          showDescription={customModal.showDescription}
          onClose={() => setCustomModal(null)}
          onCreated={(created) => {
            invalidateMasterCache(customModal.kind);
            if (customModal.kind === "subjects") {
              setDraft((d) => ({
                ...d,
                subjectId: created._id,
                subject: created.name,
              }));
            }
          }}
        />
      )}
    </div>
  );
}