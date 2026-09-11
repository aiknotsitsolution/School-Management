import { useEffect, useState } from "react";
import { Info, Lock, RotateCcw, Save } from "lucide-react";
import { api } from "../../lib/api";
import { Button, Card, Input, PageIntro, Select, toast } from "../../components/UI";

const SECTION_ORDER = [
  { id: "general", title: "General", blurb: "Public-facing identity of the platform." },
  { id: "security", title: "Security", blurb: "Login and account hardening." },
  { id: "billing", title: "Billing", blurb: "Currency and invoice behaviour." },
  { id: "notifications", title: "Notifications", blurb: "Automated reminders and alerts." },
];

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors ${checked ? "bg-amber" : "bg-black/15"}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`}
      />
    </button>
  );
}

function SettingRow({ setting, value, onChange, onReset }) {
  return (
    <div className="py-3 border-b border-black/[0.04] last:border-0">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-ink flex items-center gap-1.5">
            {setting.label}
            {setting.value !== setting.default && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-amber/15 text-amber-dark px-1.5 py-0.5 rounded">
                changed
              </span>
            )}
          </p>
          {setting.help && <p className="text-[11.5px] text-slate-text/60 mt-0.5">{setting.help}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {setting.type === "boolean" ? (
            <div className="flex items-center gap-2">
              <Toggle checked={Boolean(value)} onChange={(next) => onChange(next)} />
            </div>
          ) : setting.options ? (
            <Select className="w-32" value={String(value)} onChange={(e) => onChange(e.target.value)}>
              {setting.options.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          ) : (
            <Input
              type={setting.type === "number" ? "number" : "text"}
              className="w-36"
              value={String(value)}
              min={setting.min}
              max={setting.max}
              onChange={(e) => onChange(setting.type === "number" ? Number(e.target.value) : e.target.value)}
            />
          )}
          <button onClick={onReset} title="Reset to default" className="text-slate-text/50 hover:text-ink">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlatformSettings() {
  const [settings, setSettings] = useState([]);
  const [dirty, setDirty] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.platform.settings
      .get()
      .then(({ data }) => setSettings(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const byKey = (key) => settings.find((s) => s.key === key);

  const change = (key, value) => {
    setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, value } : s)));
    setDirty((prev) => new Set(prev).add(key));
  };

  const reset = (key) => {
    const setting = byKey(key);
    setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, value: s.default } : s)));
    setDirty((prev) => {
      const next = new Set(prev);
      if (setting && setting.value === setting.default) next.delete(key);
      return next;
    });
  };

  const save = async () => {
    if (dirty.size === 0) return;
    setSaving(true);
    const payload = {};
    for (const key of dirty) {
      const setting = byKey(key);
      if (!setting) continue;
      if (setting.type === "number") {
        const n = Number(setting.value);
        if (Number.isFinite(n)) payload[key] = n;
      } else {
        payload[key] = setting.value;
      }
    }
    try {
      const { data } = await api.platform.settings.update(payload);
      if (data) setSettings(data);
      setDirty(new Set());
      toast(`Saved ${dirty.size} setting${dirty.size > 1 ? "s" : ""}`);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full">
      <PageIntro
        eyebrow="Platform Owner · System"
        title="Platform Settings"
        description="Secrets-free configuration for the whole platform. Environment credentials (database URI, JWT secret, provider keys) are intentionally never exposed here."
        right={
          <Button variant="amber" onClick={save} disabled={saving || dirty.size === 0}>
            <Save size={15} /> {saving ? "Saving…" : dirty.size ? `Save ${dirty.size} change${dirty.size > 1 ? "s" : ""}` : "No changes"} 
          </Button>
        }
      />

      {loading ? (
        <Card><p className="text-[13px] text-slate-text/70">Loading settings…</p></Card>
      ) : (
        <div className="grid gap-5">
          {SECTION_ORDER.map((section) => {
            const items = settings.filter((s) => s.section === section.id);
            if (items.length === 0) return null;
            return (
              <Card key={section.id} bodyClassName="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-[14px] font-bold text-ink">{section.title}</h3>
                </div>
                <p className="text-[12px] text-slate-text/60 mb-2">{section.blurb}</p>
                {items.map((setting) => (
                  <SettingRow
                    key={setting.key}
                    setting={setting}
                    value={byKey(setting.key)?.value}
                    onChange={(value) => change(setting.key, value)}
                    onReset={() => reset(setting.key)}
                  />
                ))}
              </Card>
            );
          })}

          <Card className="bg-paper/50" bodyClassName="p-4 flex items-start gap-3">
            <Lock size={15} className="text-slate-text/50 mt-0.5 shrink-0" />
            <div>
              <p className="text-[12.5px] font-semibold text-slate-text">Why can't I change keys, URIs or secrets here?</p>
              <p className="text-[12px] text-slate-text/60 mt-1 leading-relaxed">
                JWT signing keys, MongoDB connection strings and third-party provider credentials are environment
                configuration, not runtime settings. They live in gitignored environment files and fail closed when
                absent, so they can never leak through the admin UI, API responses, or exported reports.
              </p>
            </div>
          </Card>

          <Card className="bg-paper/50" bodyClassName="p-4 flex items-start gap-3">
            <Info size={15} className="text-slate-text/50 mt-0.5 shrink-0" />
            <p className="text-[12px] text-slate-text/60 leading-relaxed">
              Every saved change is written to the immutable audit trail (<code>settings.changed</code>) with the
              acting admin's identity, so the audit log answers exactly who changed what platform-wide.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}