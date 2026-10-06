import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { api } from "../lib/api";
import { Button, Input, toast } from "./UI";

export default function BulkSubjectModal({
  classes,
  sections,
  onClose,
  onCreated,
  onManageSections,
}) {
  const [classId, setClassId] = useState("");
  const [sectionIds, setSectionIds] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const activeClasses = useMemo(
    () => classes.filter((item) => item.active !== false),
    [classes],
  );
  const activeSections = useMemo(() => {
    const selectedClass = activeClasses.find((item) => item._id === classId);
    if (!selectedClass) return [];
    return sections.filter(
      (section) =>
        section.active !== false &&
        (String(section.classId) === String(classId) ||
          (!section.classId && section.className === selectedClass.name)),
    );
  }, [activeClasses, classId, sections]);

  const selectClass = (value) => {
    setClassId(value);
    const selectedClass = activeClasses.find((item) => item._id === value);
    setSectionIds(
      selectedClass
        ? sections
            .filter(
              (section) =>
                section.active !== false &&
                (String(section.classId) === String(value) ||
                  (!section.classId && section.className === selectedClass.name)),
            )
            .map((section) => section._id)
        : [],
    );
  };

  const toggleSection = (id) =>
    setSectionIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  const submit = async () => {
    if (!classId) return toast("Select a class", "error");
    if (sectionIds.length === 0) return toast("Select at least one section", "error");
    if (!name.trim()) return toast("Enter a subject name", "error");

    setSaving(true);
    try {
      const { data } = await api.examMasters.createSubjectsForSections({
        name: name.trim(),
        description: description.trim(),
        sectionIds,
      });
      onCreated?.(data);
      const added = data.created?.length || 0;
      const existed = data.existing?.length || 0;
      toast(
        `Subject added to ${added} section${added === 1 ? "" : "s"}${existed ? `; already existed in ${existed}` : ""}`,
        existed && added === 0 ? "info" : "success",
      );
      onClose();
    } catch (err) {
      toast(err.message || "Could not add subject to sections", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
        onClick={() => !saving && onClose()}
      />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="font-display text-[17px] font-semibold text-ink">
              Add Subject to Class
            </h3>
            <p className="mt-0.5 text-[12.5px] text-slate-text/70">
              Add one subject to multiple sections at once.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-slate-text hover:bg-paper"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-ink">
              Class *
            </label>
            <select
              value={classId}
              onChange={(event) => selectClass(event.target.value)}
              className="h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-[13.5px] text-ink"
            >
              <option value="">Select class</option>
              {activeClasses.map((schoolClass) => (
                <option key={schoolClass._id} value={schoolClass._id}>
                  {schoolClass.name}
                </option>
              ))}
            </select>
          </div>

          {classId && (
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] font-semibold text-ink">Sections *</p>
                {activeSections.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSectionIds(
                        sectionIds.length === activeSections.length
                          ? []
                          : activeSections.map((section) => section._id),
                      )
                    }
                    className="text-[11.5px] font-semibold text-primary hover:underline"
                  >
                    {sectionIds.length === activeSections.length ? "Clear all" : "Select all"}
                  </button>
                )}
              </div>
              {activeSections.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-[12.5px] text-slate-text/70">
                    No active sections for this class yet.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="px-3 py-1.5 text-[12px]"
                    onClick={() => onManageSections(classId)}
                  >
                    Add Section
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {activeSections.map((section) => (
                    <label
                      key={section._id}
                      className="inline-flex items-center gap-2 text-[12.5px] text-slate-text"
                    >
                      <input
                        type="checkbox"
                        checked={sectionIds.includes(section._id)}
                        onChange={() => toggleSection(section._id)}
                      />
                      Section {section.name}
                    </label>
                  ))}
                </div>
              )}
              {activeSections.length > 0 && (
                <button
                  type="button"
                  onClick={() => onManageSections(classId)}
                  className="mt-3 text-[11.5px] font-medium text-primary hover:underline"
                >
                  Need another section? Add Section
                </button>
              )}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-ink">
              Subject Name *
            </label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Mathematics"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-ink">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={saving || !classId || sectionIds.length === 0 || !name.trim()}
          >
            {saving ? "Adding..." : "Add to Selected Sections"}
          </Button>
        </div>
      </div>
    </div>
  );
}
