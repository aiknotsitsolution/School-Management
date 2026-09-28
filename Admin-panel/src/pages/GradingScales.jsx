import { useEffect, useState } from "react";
import { CheckCircle2, Layers, Pencil, Play, Plus, Save, Trash2, X } from "lucide-react";
import { PageIntro, Card, Button, Input, Pill, toast } from "../components/UI";
import { api } from "../lib/api";
import { usePermission } from "../lib/permissions";
import { loadActiveGradingScale } from "../lib/grading";

const SYSTEM_LABELS = {
  default: "Default",
  cbse: "CBSE",
  icse: "ICSE",
  custom: "Custom",
};

const TEMPLATE_BANDS = [
  { grade: "A+", minPct: 90 },
  { grade: "A", minPct: 80 },
  { grade: "B+", minPct: 70 },
  { grade: "B", minPct: 60 },
  { grade: "C", minPct: 50 },
  { grade: "D", minPct: 33 },
  { grade: "F", minPct: 0 },
];

const EMPTY = { name: "", passPct: 33, bands: TEMPLATE_BANDS.map((b) => ({ ...b })) };

// Each band covers [its minPct, next band's minPct): top band goes to 100%.
function bandChipLabel(bands, index) {
  const band = bands[index];
  const prev = bands[index - 1];
  const upper = prev ? prev.minPct : 100;
  if (band.minPct === upper) return `${band.grade} ${band.minPct}%`;
  return `${band.grade} ${band.minPct}\u2013${upper}%`;
}

const validate = (form) => {
  if (!form.name.trim()) return "Scale name is required";
  const passPct = Number(form.passPct);
  if (Number.isNaN(passPct) || passPct < 0 || passPct > 100) {
    return "Pass % must be between 0 and 100";
  }
  if (!form.bands.length) return "At least one grade band is required";
  if (form.bands.length > 12) return "A scale can have at most 12 grade bands";
  for (let i = 0; i < form.bands.length; i += 1) {
    const band = form.bands[i];
    if (!band.grade || !band.grade.trim()) return `Band ${i + 1} needs a grade label`;
    if (band.grade.trim().length > 12) return `Grade label "${band.grade}" is too long (max 12)`;
    const minPct = Number(band.minPct);
    if (Number.isNaN(minPct) || minPct < 0 || minPct > 100) {
      return `Band ${i + 1}: min % must be between 0 and 100`;
    }
    if (i > 0) {
      const prev = Number(form.bands[i - 1].minPct);
      if (!(minPct < prev)) return "Bands must be in descending order (no duplicates)";
    }
  }
  if (Number(form.bands[form.bands.length - 1].minPct) !== 0) {
    return "The lowest band must start at 0%";
  }
  return "";
};

export default function GradingScales() {
  const canWrite = usePermission("exams:write");
  const [scales, setScales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    api.gradingScales
      .list()
      .then(({ data }) => setScales(data || []))
      .catch(() => toast("Could not load grading scales", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setEditId(null);
    setForm({ ...EMPTY, bands: EMPTY.bands.map((b) => ({ ...b })) });
    setShowModal(true);
  };

  const openEdit = (scale) => {
    setEditId(scale._id);
    setForm({
      name: scale.name || "",
      passPct: scale.passPct ?? 33,
      bands: (scale.bands || []).map((b) => ({ grade: b.grade, minPct: b.minPct })),
    });
    setShowModal(true);
  };

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const updateBand = (index, field, value) =>
    setForm((f) => ({
      ...f,
      bands: f.bands.map((b, i) => (i === index ? { ...b, [field]: value } : b)),
    }));

  const addBand = () =>
    setForm((f) => ({ ...f, bands: [...f.bands, { grade: "", minPct: 0 }] }));

  const removeBand = (index) =>
    setForm((f) => ({ ...f, bands: f.bands.filter((_, i) => i !== index) }));

  const handleSave = async () => {
    const message = validate(form);
    if (message) return toast(message, "error");
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        passPct: Number(form.passPct),
        bands: form.bands.map((b) => ({ grade: b.grade.trim(), minPct: Number(b.minPct) })),
      };
      if (editId) {
        await api.gradingScales.update(editId, payload);
        toast("Scale updated");
      } else {
        await api.gradingScales.create(payload);
        toast("Scale created");
      }
      setShowModal(false);
      setForm(EMPTY);
      setEditId(null);
      load();
      loadActiveGradingScale();
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
      loadActiveGradingScale();
    } catch (err) {
      toast(err.message || "Action failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const activate = (scale) => {
    if (!canWrite) return;
    if (
      !window.confirm(
        `Make "${scale.name}" the active grading scale? Grades for new and re-entered marks will use its bands and pass %.`,
      )
    ) {
      return;
    }
    act(() => api.gradingScales.activate(scale._id), "Scale activated");
  };

  const remove = (scale) => {
    if (!canWrite) return;
    if (!window.confirm(`Delete "${scale.name}"? Only non-active scales can be removed.`)) return;
    act(() => api.gradingScales.remove(scale._id), "Scale deleted");
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Examination"
        title="Grading Scales"
        description="Define how marks convert to grades and pass/fail. Exactly one scale is active per school; switches apply to new and re-entered marks immediately, while existing marks keep the snapshot stored at entry time."
        right={
          canWrite ? (
            <Button onClick={openAdd}>
              <Plus size={16} /> New Scale
            </Button>
          ) : null
        }
      />

      <Card
        title="Scales"
        bodyClassName="p-0"
        action={
          <div className="flex items-center gap-2 text-[12px] text-slate-text/70">
            <Layers size={14} /> {scales.length} configured
          </div>
        }
      >
        {loading ? (
          <div className="p-6 text-[13px] text-slate-text/70">Loading scales...</div>
        ) : scales.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-[13px] text-slate-text mb-3">
              No grading scales yet. The default, CBSE and ICSE presets are seeded automatically on
              first load.
            </p>
            {canWrite && (
              <Button onClick={openAdd}>
                <Plus size={16} /> Create Scale
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {scales.map((scale) => (
              <div key={scale._id} className="px-5 py-4 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[14px] text-ink">{scale.name}</p>
                      <Pill tone={scale.isDefault ? "success" : "neutral"}>
                        {scale.isDefault ? (
                          <>
                            <CheckCircle2 size={12} /> Active
                          </>
                        ) : (
                          SYSTEM_LABELS[scale.system] || scale.system
                        )}
                      </Pill>
                      {scale.isDefault && (
                        <Pill tone="primary">{SYSTEM_LABELS[scale.system] || scale.system}</Pill>
                      )}
                      {!scale.active && <Pill tone="neutral">Inactive</Pill>}
                    </div>
                    <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                      Pass mark: {scale.passPct}% · {scale.bands?.length || 0} grade bands
                    </p>
                  </div>
                  {canWrite && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        className="text-[12px] px-2.5 py-1.5"
                        onClick={() => openEdit(scale)}
                      >
                        <Pencil size={13} /> Edit
                      </Button>
                      {!scale.isDefault && (
                        <Button
                          variant="ghost"
                          className="text-[12px] px-2.5 py-1.5"
                          onClick={() => activate(scale)}
                        >
                          <Play size={13} /> Activate
                        </Button>
                      )}
                      {!scale.isDefault && (
                        <Button
                          variant="danger"
                          className="text-[12px] px-2.5 py-1.5"
                          onClick={() => remove(scale)}
                        >
                          <Trash2 size={13} /> Delete
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(scale.bands || []).map((band, index) => (
                    <span
                      key={`${band.grade}-${index}`}
                      className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11.5px] font-medium text-slate-text"
                    >
                      {bandChipLabel(scale.bands, index)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-[15px] text-ink">
                {editId ? "Edit Grading Scale" : "New Grading Scale"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-text/60 hover:text-ink">
                <X size={17} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                  Scale name *
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. House Scale 2026, CBSE 9-10"
                />
                <p className="text-[11.5px] text-slate-text/50 mt-1">
                  New scales are always created as Custom presets; activate one to make it the school
                  default.
                </p>
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                  Pass mark (%) *
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={form.passPct}
                  onChange={(e) => update("passPct", e.target.value)}
                />
                <p className="text-[11.5px] text-slate-text/50 mt-1">
                  A student's aggregate must reach this percentage to pass. An exam's own explicit
                  pass % overrides this value.
                </p>
              </div>
              <div>
                <label className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5">
                  Grade bands * (descending, lowest must be 0%)
                </label>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {form.bands.map((band, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        className="w-24"
                        value={band.grade}
                        onChange={(e) => updateBand(index, "grade", e.target.value)}
                        placeholder="Grade"
                      />
                      <span className="text-[12px] text-slate-text/70">min %</span>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        className="w-24"
                        value={band.minPct}
                        onChange={(e) => updateBand(index, "minPct", e.target.value)}
                      />
                      <div className="flex-1" />
                      <button
                        onClick={() => removeBand(index)}
                        className="text-slate-text/50 hover:text-rose-600"
                        title="Remove band"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  className="text-[12.5px] mt-2"
                  onClick={addBand}
                  disabled={form.bands.length >= 12}
                >
                  <Plus size={14} /> Add Band
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-200">
              <Button variant="ghost" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={busy}>
                <Save size={15} /> {busy ? "Saving..." : editId ? "Save Changes" : "Create Scale"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
