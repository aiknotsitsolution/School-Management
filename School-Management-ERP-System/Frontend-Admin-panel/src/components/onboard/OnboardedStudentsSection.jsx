import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Search,
  Eye,
  Printer,
  CreditCard,
  Settings2,
  X,
  UserCheck,
  AlertCircle,
} from "lucide-react";
import { Button, Card, Input, Pill, toast, Avatar } from "../UI";
import { api } from "../../lib/api";
import { selectSchool } from "../../store/selectors";
import { setSchool as setSchoolAction } from "../../store/authSlice";
import { usePermission } from "../../lib/permissions";
import StudentIdCard, {
  printIdCard,
  idCardSettings,
  ID_CARD_DEFAULT,
} from "../idcard/StudentIdCard";

const ACCENT_RE = /^#[0-9a-fA-F]{6}$/;

const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

const formatClassLabel = (c) =>
  ["Nursery", "LKG", "UKG"].includes(String(c)) ? String(c) : `Class ${c}`;

const BOOLEAN_FIELDS = [
  ["showParentContact", "Parent contact"],
  ["showBloodGroup", "Blood group"],
  ["showDob", "Date of birth"],
  ["showRollNo", "Roll number"],
  ["showHouse", "House"],
];

export default function OnboardedStudentsSection({ onOnboardNow, reloadToken = 0 }) {
  const dispatch = useDispatch();
  const school = useSelector(selectSchool);
  const canCustomize = usePermission("school:settings");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState(null);
  const [issuingId, setIssuingId] = useState(null);
  const [customizing, setCustomizing] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);
  const [customDraft, setCustomDraft] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.students
      .list("linked=true&limit=200")
      .then((result) => {
        setRows(result.data || []);
        setTotal(result.total || 0);
      })
      .catch((err) => toast(err.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  useEffect(() => {
    if (!canCustomize) return;
    api.school
      .me()
      .then(({ data }) => dispatch(setSchoolAction(data)))
      .catch(() => {});
  }, [canCustomize, dispatch]);

  const filtered = useMemo(() => {
    if (!term.trim()) return rows;
    const q = term.toLowerCase();
    return rows.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        String(s.admissionNo || "").toLowerCase().includes(q),
    );
  }, [rows, term]);

  const handleIssue = async (student) => {
    setIssuingId(student._id);
    try {
      const { data } = await api.students.issueIdCard(student._id);
      setRows((prev) =>
        prev.map((s) => (s._id === student._id ? { ...s, ...data } : s)),
      );
      setSelected((prev) => (prev?._id === student._id ? { ...prev, ...data } : prev));
      toast(`ID card issued — ${data.idCardNumber}`);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setIssuingId(null);
    }
  };

  const openCustomize = () => {
    setCustomDraft(idCardSettings(school));
    setCustomizing(true);
  };

  const saveCustom = async () => {
    setSavingCustom(true);
    try {
      const { data } = await api.school.update({ idCard: customDraft });
      dispatch(setSchoolAction(data));
      toast("ID card design saved");
      setCustomizing(false);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSavingCustom(false);
    }
  };

  const selectedSettings = selected
    ? idCardSettings(school)
    : ID_CARD_DEFAULT;

  return (
    <Card
      className="mt-6"
      title={`Students Added via User & Access (${total})`}
      action={
        canCustomize && (
          <Button variant="outline" onClick={openCustomize} className="!py-2 !px-3 !text-[12.5px]">
            <Settings2 size={14} /> Customize ID Card
          </Button>
        )
      }
    >
      <p className="text-[12.5px] text-slate-text/70 mb-4">
        Students invited by the school / platform admin through the Users &amp;
        Access module. Onboarding completes once their mandatory profile fields
        are filled; an ID card can then be issued.
      </p>

      <div className="relative max-w-md mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/50" />
        <Input
          placeholder="Search by name or Admission ID…"
          className="pl-9"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-[13px] text-slate-text/60 py-6 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-slate-text/60">
          <UserCheck size={22} />
          <p className="text-[13px]">
            {rows.length === 0
              ? "No students were added via Users & Access yet. Invite one from the Users module."
              : "No students match this search."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-black/[0.05]">
          {filtered.map((student) => {
            const complete = student.profileStatus === "complete";
            return (
              <div
                key={student._id}
                className="py-3 flex flex-wrap items-center gap-3"
              >
                <Avatar src={student.photoUrl} name={student.name} size={42} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold text-ink truncate">
                    {student.name || "—"}
                  </p>
                  <p className="text-[12px] text-slate-text/70 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="font-mono bg-paper px-1.5 py-0.5 rounded">
                      {student.admissionNo || "—"}
                    </span>
                    {student.class
                      ? `${formatClassLabel(student.class)} · Section ${student.section || "—"}`
                      : "Class pending"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Pill tone={complete ? "success" : "amber"}>
                      {complete ? "onboarded" : "pending"}
                    </Pill>
                    {student.idCardNumber && (
                      <Pill tone="info">{student.idCardNumber}</Pill>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!complete && onOnboardNow && (
                    <Button
                      variant="amber"
                      className="!py-2 !px-3 !text-[12px]"
                      onClick={() => onOnboardNow(student)}
                    >
                      <UserCheck size={13} /> Onboard Now
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="!py-2 !px-3 !text-[12px]"
                    onClick={() => setSelected(student)}
                  >
                    <Eye size={13} /> View Onboard Student
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View / onboard / ID card modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => !issuingId && setSelected(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <div>
                <h3 className="font-display font-semibold text-ink text-[16px]">Onboard Student</h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  Onboarding status &amp; ID card for {selected.name || "this student"}.
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 overflow-y-auto space-y-5">
              {/* Status summary */}
              <div className="rounded-xl bg-paper border border-black/[0.06] p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                <Avatar src={selected.photoUrl} name={selected.name} size={46} />
                <div>
                  <p className="text-[14px] font-semibold text-ink">{selected.name || "—"}</p>
                  <p className="text-[12px] text-slate-text/70 mt-0.5">
                    <span className="font-mono">{selected.admissionNo || "—"}</span>
                    {selected.class
                      ? ` · ${formatClassLabel(selected.class)} · ${selected.section || "—"}`
                      : ""}
                  </p>
                </div>
                <div className="ml-auto">
                  <Pill tone={selected.profileStatus === "complete" ? "success" : "amber"}>
                    {selected.profileStatus === "complete" ? "Onboarding complete" : "Onboarding pending"}
                  </Pill>
                </div>
              </div>

              {selected.profileStatus !== "complete" ? (
                <div className="flex items-start gap-2.5 rounded-xl bg-amber/10 border border-amber/25 px-4 py-3 text-[13px] text-amber-dark">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <p>
                    This student has not completed onboarding yet. Once the manager /
                    counsellor fills the mandatory profile fields, an ID card can be issued.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-semibold text-ink flex items-center gap-1.5">
                        <CreditCard size={15} /> Student ID Card
                      </p>
                      <p className="text-[12px] text-slate-text/60 mt-0.5">
                        {selected.idCardNumber
                          ? `Issued ${fmtDate(selected.idCardIssuedAt)} · ${selected.idCardNumber}`
                          : "Not issued yet."}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        className="!py-2 !px-3 !text-[12px]"
                        onClick={() =>
                          printIdCard({ student: selected, school })
                        }
                        disabled={!selected.idCardNumber || issuingId === selected._id}
                      >
                        <Printer size={14} /> Print
                      </Button>
                      <Button
                        variant="amber"
                        className="!py-2 !px-3 !text-[12px]"
                        onClick={() => handleIssue(selected)}
                        disabled={issuingId === selected._id}
                      >
                        {issuingId === selected._id
                          ? "Issuing…"
                          : selected.idCardNumber
                            ? "Re-issue / Refresh"
                            : "Issue ID Card"}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-black/[0.06] p-4 bg-warm">
                    <StudentIdCard student={selected} school={school} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customize modal */}
      {customizing && customDraft && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => !savingCustom && setCustomizing(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <div>
                <h3 className="font-display font-semibold text-ink text-[16px]">Customize Student ID Card</h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  Design used for every printed student ID card in this school.
                </p>
              </div>
              <button
                onClick={() => setCustomizing(false)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12.5px] font-medium text-ink mb-1.5">Accent colour</label>
                  <Input
                    type="text"
                    value={customDraft.accent}
                    onChange={(e) =>
                      setCustomDraft((d) => ({ ...d, accent: e.target.value }))
                    }
                    placeholder="#1E2A44"
                  />
                  <p className="text-[11px] text-slate-text/50 mt-1">
                    {ACCENT_RE.test(customDraft.accent) ? "Looks good." : "Use a hex colour like #1E2A44."}
                  </p>
                </div>
                <div className="flex flex-col">
                  <label className="block text-[12.5px] font-medium text-ink mb-1.5">Preview</label>
                  <div
                    className="w-10 h-10 rounded-lg border border-black/10"
                    style={{ background: ACCENT_RE.test(customDraft.accent) ? customDraft.accent : "#1E2A44" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-ink mb-1.5">Header title</label>
                <Input
                  value={customDraft.headerTitle}
                  onChange={(e) =>
                    setCustomDraft((d) => ({ ...d, headerTitle: e.target.value }))
                  }
                  placeholder={ID_CARD_DEFAULT.headerTitle}
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-ink mb-1.5">Footer note</label>
                <Input
                  value={customDraft.footerNote}
                  onChange={(e) =>
                    setCustomDraft((d) => ({ ...d, footerNote: e.target.value }))
                  }
                  placeholder={ID_CARD_DEFAULT.footerNote}
                />
              </div>

              <div>
                <p className="text-[12.5px] font-medium text-ink mb-2">Show on card</p>
                <div className="grid grid-cols-2 gap-2">
                  {BOOLEAN_FIELDS.map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-[13px] text-ink rounded-lg border border-black/[0.07] px-3 py-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(customDraft[key])}
                        onChange={(e) =>
                          setCustomDraft((d) => ({ ...d, [key]: e.target.checked }))
                        }
                        className="accent-amber"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-black/[0.06]">
              <Button variant="ghost" onClick={() => setCustomizing(false)} disabled={savingCustom}>
                Cancel
              </Button>
              <Button variant="amber" onClick={saveCustom} disabled={savingCustom}>
                {savingCustom ? "Saving…" : "Save design"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}