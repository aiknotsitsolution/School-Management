import { useState } from "react";
import { X } from "lucide-react";
import { Button, Input } from "./UI";
import { api } from "../lib/api";
import { toast } from "./UI";

/**
 * Modal for creating or editing a reusable master value (e.g. a tenant subject).
 * On success it persists to the tenant master and reports the record up so the
 * caller can auto-select it (create) or refresh its row (edit).
 *
 * Pass `initialItem` to edit an existing record (uses the update endpoint);
 * without it the modal creates a new record.
 */
export default function CustomMasterModal({
  kind,
  label,
  valueName = "name",
  title,
  showDescription = false,
  initialItem = null,
  onClose,
  onCreated,
  onUpdated,
}) {
  const editing = Boolean(initialItem && initialItem._id);
  const [name, setName] = useState(initialItem?.name || "");
  const [description, setDescription] = useState(initialItem?.description || "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const payload = { name: trimmed };
      if (showDescription) payload.description = description.trim();
      if (editing) {
        const response = await api.examMasters.update(kind, initialItem._id, payload);
        toast(`${label} "${response.data.name}" updated`);
        onUpdated?.(response.data);
      } else {
        const response = await api.examMasters.create(kind, payload);
        toast(`${label} "${response.data.name}" created`);
        onCreated?.(response.data);
      }
      onClose();
    } catch (err) {
      const isDup =
        err.status === 409 ||
        (err.message && err.message.toLowerCase().includes("already exists"));
      if (isDup && !editing && err.data && err.data.existingId) {
        toast(`"${trimmed}" already exists — selected for you`, "info");
        onCreated?.({ _id: err.data.existingId, ...err.data });
        onClose();
      } else if (isDup) {
        toast(`"${trimmed}" already exists — you can select it from the list`, "error");
      } else {
        toast(err.message || "Something went wrong", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
          <h3 className="font-display font-semibold text-ink text-[17px]">
            {title || `${editing ? "Edit" : "Add Custom"} ${label}`}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-paper text-slate-text"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[12px] font-semibold text-ink mb-1.5 block">
              {label} {valueName === "name" ? "Name" : valueName}
            </label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`e.g. Computer Applications`}
            />
          </div>

          {showDescription && (
            <div>
              <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-lg border border-black/10 text-[13px] outline-none focus:border-ink/40 bg-white placeholder:text-slate-text/50 resize-none"
                placeholder="Optional description"
              />
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-black/[0.06] flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="amber"
            onClick={submit}
            disabled={saving || !name.trim()}
          >
            {saving ? "Saving..." : `${editing ? "Save Changes" : `Add ${label}`}`}
          </Button>
        </div>
      </div>
    </div>
  );
}