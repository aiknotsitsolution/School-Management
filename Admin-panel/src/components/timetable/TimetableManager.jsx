import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Copy,
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

// Non-academic slots the backend deliberately exempts from the subject catalog
// (NON_ACADEMIC_PERIODS in academic-service/utils/masterRefs.js). Offered right
// in the picker so adding a Break never creates a subject master.
const NON_ACADEMIC_ITEMS = [
  "Break",
  "Lunch",
  "Library",
  "Assembly",
  "Sports",
  "Games",
  "Free",
  "Recess",
].map((name) => ({ _id: `non-academic:${name.toLowerCase()}`, name }));

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

export default function TimetableManager({
  cls,
  section,
  sectionId = "",
  canWrite = false,
}) {
  const [timetable, setTimetable] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(null); // { mode, days[], index, ...period }
  const [saveErrors, setSaveErrors] = useState([]); // per-day failures in add/edit
  const [confirmDelete, setConfirmDelete] = useState(null); // { day, index }
  const [customModal, setCustomModal] = useState(null); // { kind, label, showDescription? } | null
  const [conflicts, setConflicts] = useState([]); // 409 conflict lines from the last save
  // Copy-a-day: clone one day's periods onto other days (the usual Monday ->
  // rest-of-week flow, without re-entering every period by hand).
  const [copySource, setCopySource] = useState(null); // day being copied
  const [copyTargets, setCopyTargets] = useState([]); // days to write into
  const [copyOverwrite, setCopyOverwrite] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyErrors, setCopyErrors] = useState([]); // per-day failures

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

  // The subject master holds one document per section, so an unfiltered picker
  // shows every subject in the school — once for each section — which is why
  // Nursery-A offered Accountancy seven times. Narrow it to this section.
  const filterSubjectItems = (items) => {
    if (!sectionId) return items;
    const linked = items.filter(
      (item) => String(item.sectionId || "") === sectionId,
    );
    // A section with nothing linked yet (masters not adopted) keeps the old list.
    if (!linked.length) return items;
    const seen = new Set();
    const scoped = [];
    linked.forEach((item) => {
      const key = String(item.name || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      scoped.push(item);
    });
    // Never hide the value the form is already holding (a period being edited,
    // or a custom subject that was just created for this section).
    const chosen = items.find(
      (item) => String(item._id) === String(draft.subjectId),
    );
    if (chosen && !scoped.some((item) => String(item._id) === String(chosen._id))) {
      scoped.push(chosen);
    }
    return scoped;
  };

  // `days` accepts a single day (the + on a day header) or an array (the page
  // level Add Period button opens with the whole week ticked).
  const openAdd = (days) => {
    setConflicts([]);
    setSaveErrors([]);
    setDraft({
      mode: "add",
      days: Array.isArray(days) ? [...days] : [days],
      subject: "",
      subjectId: "",
      teacherId: "",
      teacherName: "",
      roomId: "",
      roomName: "",
      startTime: "",
      endTime: "",
    });
  };

  const openEdit = (day, index) => {
    const period = (byDay.get(day) || [])[index];
    if (!period) return;
    setConflicts([]);
    setSaveErrors([]);
    setDraft({
      mode: "edit",
      days: [day],
      index,
      subject: period.subject || "",
      subjectId: period.subjectId || "",
      teacherId: period.teacherId || "",
      teacherName: period.teacherName || "",
      roomId: period.roomId || "",
      roomName: period.roomName || "",
      startTime: period.startTime || "",
      endTime: period.endTime || "",
    });
  };

  const toggleDraftDay = (day) =>
    setDraft((d) =>
      !d || d.mode !== "add"
        ? d
        : {
            ...d,
            days: d.days.includes(day)
              ? d.days.filter((x) => x !== day)
              : [...d.days, day],
          },
    );

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.subject.trim()) {
      toast("Subject is required", "error");
      return;
    }
    const targetDays = draft.days || [];
    if (!targetDays.length) {
      toast("Select at least one day", "error");
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

    const newPeriod = {
      subject: draft.subject.trim(),
      teacherId: draft.teacherId,
      teacherName: draft.teacherName,
      roomId: draft.roomId || "",
      roomName: draft.roomName || "",
      startTime: draft.startTime,
      endTime: draft.endTime,
    };

    setSaving(true);
    setSaveErrors([]);
    setConflicts([]);
    const savedDays = [];
    const failed = [];
    // One upsert per ticked day — a single save stamps the same lesson across
    // the whole week. A 409 (teacher/room clash) on one day must not roll back
    // the days that already went through.
    for (const day of targetDays) {
      const slot = timetable.find((t) => t.day === day);
      const base = sortPeriods(slot?.periods || []);
      const next =
        draft.mode === "edit"
          ? base.map((p, i) => (i === draft.index ? newPeriod : p))
          : [...base, newPeriod];
      try {
        const { data } = await api.timetable.save({
          class: cls,
          section,
          day,
          periods: sortPeriods(next),
        });
        setTimetable((prev) => [...prev.filter((t) => t.day !== day), data]);
        savedDays.push(day);
      } catch (requestError) {
        failed.push(`${day} — ${requestError.message}`);
        if (requestError.status === 409 && requestError.conflicts?.length) {
          setConflicts(requestError.conflicts);
        }
      }
    }
    setSaving(false);

    if (failed.length) {
      // Stay open, but leave only the failed days ticked: retrying must not
      // append the same period a second time onto the days that took it.
      setSaveErrors(failed);
      setDraft((d) =>
        d ? { ...d, days: d.days.filter((day) => !savedDays.includes(day)) } : d,
      );
      if (savedDays.length) {
        toast(
          `Saved to ${savedDays.join(", ")} — ${failed.length} day${
            failed.length === 1 ? "" : "s"
          } still need attention`,
          "error",
        );
      } else {
        toast(failed[0], "error");
      }
      return;
    }

    toast(
      draft.mode === "edit"
        ? "Period updated"
        : savedDays.length > 1
          ? `Period added to ${savedDays.join(", ")}`
          : "Period added",
    );
    setDraft(null);
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
      setConflicts([]);
    } catch (requestError) {
      if (requestError.status === 409) {
        setConflicts(requestError.conflicts || [requestError.message]);
      }
      toast(requestError.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // Open the copy dialog for a day that already has periods. Days that are
  // still empty are pre-selected; days with a timetable stay locked behind the
  // overwrite switch so a copy can never silently wipe someone else's work.
  const openCopy = (day) => {
    const source = byDay.get(day) || [];
    if (!source.length) {
      toast(`${day} has no periods to copy`, "error");
      return;
    }
    setConflicts([]);
    setCopyErrors([]);
    setCopyOverwrite(false);
    setCopySource(day);
    setCopyTargets(DAYS.filter((d) => d !== day && (byDay.get(d) || []).length === 0));
  };

  const toggleCopyTarget = (day) =>
    setCopyTargets((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );

  const runCopy = async () => {
    if (!copySource) return;
    if (!copyTargets.length) {
      toast("Select at least one day to copy into", "error");
      return;
    }
    const periods = sortPeriods(byDay.get(copySource) || []);
    if (!periods.length) {
      toast(`${copySource} has no periods to copy`, "error");
      return;
    }

    setCopyBusy(true);
    setCopyErrors([]);
    setConflicts([]);
    const copied = [];
    const failed = [];
    // One request per day, in order — the server upserts per day and answers
    // 409 when a teacher/room clash is found, which must not abort the rest.
    for (const day of copyTargets) {
      try {
        const { data } = await api.timetable.save({
          class: cls,
          section,
          day,
          periods,
        });
        setTimetable((prev) => [...prev.filter((t) => t.day !== day), data]);
        copied.push(day);
      } catch (requestError) {
        failed.push(`${day} — ${requestError.message}`);
        if (requestError.status === 409 && requestError.conflicts?.length) {
          setConflicts(requestError.conflicts);
        }
      }
    }
    setCopyBusy(false);

    if (copied.length) toast(`Copied ${copySource} to ${copied.join(", ")}`);
    if (failed.length) {
      setCopyErrors(failed); // stay open so the reasons are readable
    } else {
      setCopySource(null);
      setCopyTargets([]);
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

      {conflicts.length > 0 && !draft && (
        <Card>
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-alert mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-alert">
                Scheduling conflict — the affected day was not saved
              </p>
              <ul className="mt-1.5 space-y-1">
                {conflicts.map((line, i) => (
                  <li key={i} className="text-[12.5px] text-alert/90">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
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
              <div className="flex items-center gap-2">
                <Button variant="primary" onClick={() => openAdd(DAYS)} disabled={saving}>
                  <Plus size={15} /> Add Period
                </Button>
              </div>
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
                    className="rounded-xl border border-slate-200 overflow-hidden"
                  >
                    <div className="flex items-center justify-between bg-ink text-white px-4 py-2.5 dark:bg-slate-200 dark:text-ink">
                      <span className="font-semibold text-[12.5px]">{day}</span>
                      {canWrite && (
                        <div className="flex items-center gap-1">
                          {periods.length > 0 && (
                            <button
                              type="button"
                              onClick={() => openCopy(day)}
                              className="p-1 rounded-md hover:bg-white/15 text-white/80 dark:text-ink/70 dark:hover:bg-ink/10"
                              title={`Copy ${day}'s timetable to other days`}
                              aria-label={`Copy ${day}'s timetable to other days`}
                            >
                              <Copy size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openAdd(day)}
                            className="p-1 rounded-md hover:bg-white/15 text-white/80 dark:text-ink/70 dark:hover:bg-ink/10"
                            title={`Add period on ${day}`}
                            aria-label={`Add period on ${day}`}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    {periods.length === 0 ? (
                      <p className="px-4 py-6 text-center text-[12px] text-slate-text/50">
                        No periods
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {periods.map((period, index) => (
                          <div key={`${day}-${index}`} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[13px] font-semibold text-ink">
                                {period.subject || "—"}
                              </p>
                              <div className="flex items-center gap-1">
                                <Pill tone="primary">{timeLabel(period.startTime)}</Pill>
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
                              {period.roomName ? ` · ${period.roomName}` : ""}
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
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  {draft.mode === "edit" ? "Edit Period" : "Add Period"}
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  Class {cls} - {section}
                  {draft.mode === "add" &&
                    ` · ${draft.days.length} day${draft.days.length === 1 ? "" : "s"} selected`}
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
              {conflicts.length > 0 && (
                <div className="rounded-lg bg-alert/10 border border-alert/30 px-3.5 py-3">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-alert">
                    <AlertTriangle size={14} /> Scheduling conflict — the
                    affected day was not saved
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {conflicts.map((line, i) => (
                      <li key={i} className="text-[12px] text-alert/90">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {saveErrors.length > 0 && (
                <div className="rounded-lg bg-alert/10 border border-alert/30 px-3.5 py-3">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-alert">
                    <AlertTriangle size={14} /> Could not save every selected day
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {saveErrors.map((line) => (
                      <li key={line} className="text-[12px] text-alert/90">
                        {line}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11.5px] text-alert/80 mt-1.5">
                    Only the failed days are still ticked — press{" "}
                    {draft.mode === "edit" ? "Update" : "Add"} to retry them.
                  </p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12.5px] font-medium text-ink">
                    {draft.mode === "edit" ? "Day" : "Days"}
                  </label>
                  {draft.mode === "add" && (
                    <div className="flex items-center gap-3 text-[11.5px]">
                      <button
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, days: [...DAYS] }))}
                        className="text-primary-dark hover:underline"
                      >
                        All days
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, days: [] }))}
                        className="text-slate-text hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => {
                    const checked = draft.days.includes(day);
                    return (
                      <label
                        key={day}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[12.5px] transition-colors ${
                          draft.mode === "edit"
                            ? "border-primary bg-primary/10 text-primary-dark font-semibold"
                            : checked
                              ? "border-primary bg-primary/10 text-primary-dark font-semibold cursor-pointer"
                              : "border-slate-200 text-slate-text hover:border-slate-300 cursor-pointer"
                        }`}
                        title={
                          draft.mode === "edit"
                            ? "An existing period belongs to one day"
                            : `Add this period on ${day}`
                        }
                      >
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={checked}
                          disabled={draft.mode === "edit"}
                          onChange={() => toggleDraftDay(day)}
                        />
                        {day.slice(0, 3)}
                      </label>
                    );
                  })}
                </div>
                {draft.mode === "add" ? (
                  <p className="text-[11.5px] text-slate-text/60 mt-1.5 leading-snug">
                    Tick every day this lesson repeats on — one save creates it on
                    all of them.
                    {draft.days.length > 1 && (
                      <span className="font-medium text-ink">
                        {" "}
                        ({draft.days.length} days selected)
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-[11.5px] text-slate-text/60 mt-1.5 leading-snug">
                    Editing a period on {draft.days[0]} — open Add Period to put
                    the same lesson on other days.
                  </p>
                )}
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
                  filterItems={filterSubjectItems}
                  extraItems={NON_ACADEMIC_ITEMS}
                  extraItemsLabel="Non-academic"
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

              <div>
                <label className="block text-[12.5px] font-medium text-ink mb-1.5">
                  Room <span className="text-slate-text/60 font-normal">(optional)</span>
                </label>
                <MasterSelect
                  kind="rooms"
                  label="Room"
                  placeholder="Select room"
                  searchLabel="Search rooms..."
                  value={draft.roomId}
                  fallbackLabel={draft.roomName}
                  onChange={(id, item) =>
                    setDraft((d) => ({
                      ...d,
                      roomId: id,
                      roomName: item ? item.name : "",
                    }))
                  }
                />
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

            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
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
            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
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

      {/* Copy day modal */}
      {copySource && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => !copyBusy && setCopySource(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  Copy {copySource} timetable
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  Class {cls} - {section} ·{" "}
                  {(byDay.get(copySource) || []).length} period
                  {(byDay.get(copySource) || []).length === 1 ? "" : "s"} cloned
                  with the same subjects, teachers, rooms and times
                </p>
              </div>
              <button
                onClick={() => !copyBusy && setCopySource(null)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12.5px] font-medium text-ink">
                    Copy into
                  </label>
                  <div className="flex items-center gap-3 text-[11.5px]">
                    <button
                      type="button"
                      onClick={() =>
                        setCopyTargets(
                          DAYS.filter(
                            (d) =>
                              d !== copySource &&
                              (copyOverwrite || (byDay.get(d) || []).length === 0),
                          ),
                        )
                      }
                      className="text-primary-dark hover:underline"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setCopyTargets([])}
                      className="text-slate-text hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {DAYS.filter((d) => d !== copySource).map((day) => {
                    const existing = (byDay.get(day) || []).length;
                    const locked = existing > 0 && !copyOverwrite;
                    return (
                      <label
                        key={day}
                        className={`rounded-lg border px-2.5 py-2 text-[12.5px] ${
                          locked
                            ? "border-slate-200 text-slate-text/45 cursor-not-allowed"
                            : "border-slate-200 text-ink cursor-pointer hover:border-slate-300"
                        }`}
                        title={
                          locked
                            ? `${day} already has a timetable — turn on "Replace" below to overwrite it`
                            : undefined
                        }
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            disabled={locked}
                            checked={copyTargets.includes(day)}
                            onChange={() => toggleCopyTarget(day)}
                          />
                          {day.slice(0, 3)}
                        </span>
                        <span className="block text-[11px] text-slate-text/60 mt-0.5">
                          {existing
                            ? `${existing} period${existing === 1 ? "" : "s"}`
                            : "empty"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 text-[12.5px] text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={copyOverwrite}
                  onChange={(e) => setCopyOverwrite(e.target.checked)}
                />
                Replace days that already have a timetable
                <span className="text-slate-text/60">
                  (otherwise they stay locked)
                </span>
              </label>

              {copyErrors.length > 0 && (
                <div className="rounded-lg bg-alert/10 border border-alert/30 px-3.5 py-3">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-alert">
                    <AlertTriangle size={14} /> Could not copy into every day
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {copyErrors.map((line) => (
                      <li key={line} className="text-[12px] text-alert/90">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setCopySource(null)}
                disabled={copyBusy}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={runCopy}
                disabled={copyBusy || copyTargets.length === 0}
              >
                <Copy size={15} />
                {copyBusy
                  ? "Copying..."
                  : `Copy to ${copyTargets.length} day${copyTargets.length === 1 ? "" : "s"}`}
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
          extraPayload={
            customModal.kind === "subjects" && sectionId
              ? { sectionId, className: cls }
              : {}
          }
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