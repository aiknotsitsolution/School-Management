import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Download } from "lucide-react";
import { PageIntro, Card, Button, Select, Input, Pill, toast } from "../components/UI";
import SearchableSelect from "../components/SearchableSelect";
import { api } from "../lib/api";
import { usePermission } from "../lib/permissions";
import { useMasterOptions } from "../hooks/useMasterOptions";

const CLASS_OPTIONS_FALLBACK = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11-Sci", "11-Com", "12-Sci", "12-Com"];

function formatClass(c) {
  if (["Nursery", "LKG", "UKG"].includes(c)) return c;
  return `Class ${c}`;
}

export default function Transfers() {
  const { options: masterClasses } = useMasterOptions("classes", CLASS_OPTIONS_FALLBACK);
  const { options: masterSections, rawItems: rawSections } = useMasterOptions("sections", ["A", "B", "C"]);
  const canTransfer = usePermission("transfer:write");
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState("class_section");
  const [toClass, setToClass] = useState("");
  const [toSection, setToSection] = useState("");
  const [remarks, setRemarks] = useState("");
  const filteredSections = useMemo(() => {
    if (!toClass) return masterSections.filter((s) => s !== "All");
    return [...new Set(rawSections.filter((s) => s.className === toClass).map((s) => s.name))];
  }, [toClass, masterSections, rawSections]);
  const [session, setSession] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [histPage, setHistPage] = useState(1);
  const [histPageSize, setHistPageSize] = useState(10);

  useEffect(() => {
    api.students
      .list("limit=1000")
      .then(({ data }) => setStudents(Array.isArray(data) ? data : []))
      .catch(() => {});
    api.transfers
      .history("limit=25")
      .then(({ data }) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const studentOptions = useMemo(
    () => students.map((s) => `${s.name} · ${s.admissionNo} · ${formatClass(s.class)}-${s.section}`),
    [students]
  );

  const histTotalPages = Math.max(1, Math.ceil(history.length / histPageSize));
  const histSafePage = Math.min(histPage, histTotalPages);
  const paginatedHistory = useMemo(() => {
    const start = (histSafePage - 1) * histPageSize;
    return history.slice(start, start + histPageSize);
  }, [history, histSafePage, histPageSize]);

  const selectedStudent = students.find((s) => s.admissionNo === studentId || s._id === studentId);

  const handleSubmit = async () => {
    if (!studentId) {
      toast("Select a student to transfer", "amber");
      return;
    }
    if (type === "class_section" && !toClass) {
      toast("Target class is required for an in-school transfer", "amber");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        studentId,
        type,
        remarks: remarks || undefined,
        ...(session ? { session } : {}),
        ...(type === "class_section" ? { toClass, toSection: toSection || undefined } : {}),
      };
      const { data } = await api.transfers.create(payload);
      toast(`Transfer recorded for ${data.studentName}`);
      setStudentId("");
      setToClass("");
      setToSection("");
      setRemarks("");
      setSession("");
      api.transfers
        .history("limit=25")
        .then((res) => setHistory(Array.isArray(res.data) ? res.data : []))
        .catch(() => {});
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="Transfers"
        description="Move a student to another class/section, or record a transfer out of the school."
        right={
          <Button variant="amber" onClick={handleSubmit} disabled={saving}>
            <ArrowRightLeft size={15} /> {saving ? "Recording…" : "Record Transfer"}
          </Button>
        }
      />

      <Card title="New Transfer">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2">
            <label className="text-[12px] font-semibold text-ink mb-1.5 block">Student</label>
            <SearchableSelect
              options={studentOptions}
              value={studentId ? studentOptions.find((_, i) => (students[i]?.admissionNo === studentId || students[i]?._id === studentId)) ?? "" : ""}
              onChange={(val) => {
                const idx = studentOptions.indexOf(val);
                if (idx >= 0 && students[idx]) {
                  setStudentId(students[idx].admissionNo || students[idx]._id);
                } else {
                  setStudentId("");
                }
              }}
              placeholder="Search student by name, admission no..."
            />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-ink mb-1.5 block">Transfer Type</label>
            <Select value={type} onChange={(e) => setType(e.target.value)} className="w-full">
              <option value="class_section">Class / Section</option>
              <option value="school">Out of School</option>
            </Select>
          </div>
          <div>
            <label className="text-[12px] font-semibold text-ink mb-1.5 block">Session (optional)</label>
            <Input placeholder="e.g. 2025-26" value={session} onChange={(e) => setSession(e.target.value)} />
          </div>
        </div>

        {type === "class_section" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div>
              <label className="text-[12px] font-semibold text-ink mb-1.5 block">To Class</label>
              <SearchableSelect
                options={masterClasses.filter((c) => c !== "All")}
                value={toClass}
                onChange={(v) => { setToClass(v); setToSection(""); }}
                renderLabel={(c) => formatClass(c)}
                placeholder="Select target class…"
                className="w-full"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-ink mb-1.5 block">To Section</label>
              <SearchableSelect
                options={filteredSections}
                value={toSection}
                onChange={setToSection}
                placeholder="Keep current section"
                className="w-full"
              />
            </div>
          </div>
        )}

        <div className="mt-4">
          <label className="text-[12px] font-semibold text-ink mb-1.5 block">Remarks (optional)</label>
          <textarea
            rows={3}
            placeholder={type === "school" ? "Reason for leaving, destination school…" : "Reason for the change…"}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full rounded-xl border border-black/[0.08] bg-paper px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-slate-text/40 focus:outline-none focus:ring-2 focus:ring-info/30 focus:border-info/50 resize-none"
          />
        </div>

        {selectedStudent && (
          <div className="mt-4 rounded-xl bg-paper border border-black/[0.06] p-3 text-[12.5px] text-slate-text">
            Transferring <b className="text-ink">{selectedStudent.name}</b> (
            {type === "school"
              ? "status will be set to Transferred"
              : `from ${formatClass(selectedStudent.class)}-${selectedStudent.section} to ${formatClass(toClass || "?")}${toSection ? `-${toSection}` : ""}`}
            ). A permanent academic record is created on commit.
          </div>
        )}
        {!canTransfer && (
          <p className="text-[12px] text-slate-text/60 mt-3">
            You have read-only access. Only school admins can record transfers.
          </p>
        )}
      </Card>

      <Card title="Transfer History" action={<Pill tone="info">{history.length} records</Pill>}>
        {history.length === 0 ? (
          <p className="text-[13px] text-slate-text/60 py-6 text-center">No transfers recorded yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/[0.06]">
                    <th className="px-4 py-2.5 font-semibold">Student</th>
                    <th className="px-4 py-2.5 font-semibold">From</th>
                    <th className="px-4 py-2.5 font-semibold">To</th>
                    <th className="px-4 py-2.5 font-semibold">Session</th>
                    <th className="px-4 py-2.5 font-semibold">Remarks</th>
                    <th className="px-4 py-2.5 font-semibold">Acted By</th>
                    <th className="px-4 py-2.5 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistory.map((h) => (
                    <tr key={h._id} className="border-b border-black/[0.04] last:border-0">
                      <td className="px-4 py-3 font-semibold text-ink">{h.studentName}</td>
                      <td className="px-4 py-3 text-slate-text">{formatClass(h.fromClass)}{h.fromSection ? `-${h.fromSection}` : ""}</td>
                      <td className="px-4 py-3 text-slate-text">{h.toClass ? formatClass(h.toClass) : "Left school"}{h.toSection ? `-${h.toSection}` : ""}</td>
                      <td className="px-4 py-3 text-slate-text">{h.session || "—"}</td>
                      <td className="px-4 py-3 text-slate-text max-w-[220px] truncate">{h.remarks || "—"}</td>
                      <td className="px-4 py-3 text-slate-text">{h.actedByName || "—"}</td>
                      <td className="px-4 py-3 text-slate-text">{h.createdAt ? new Date(h.createdAt).toLocaleDateString("en-IN") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-black/[0.06]">
              <p className="text-[12px] text-slate-text/55">
                Showing {history.length === 0 ? 0 : (histSafePage - 1) * histPageSize + 1}–{Math.min(histSafePage * histPageSize, history.length)} of {history.length}
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={histPageSize}
                  onChange={(e) => { setHistPageSize(Number(e.target.value)); setHistPage(1); }}
                  className="text-[12px] border border-black/[0.08] rounded-lg px-2 py-1.5 bg-paper text-ink"
                >
                  {[5, 10, 25, 50].map((n) => (
                    <option key={n} value={n}>{n} / page</option>
                  ))}
                </select>
                <Button variant="outline" className="px-3 py-1.5 text-[12px]" disabled={histSafePage <= 1} onClick={() => setHistPage((p) => Math.max(1, p - 1))}>
                  Prev
                </Button>
                <span className="text-[12px] text-ink font-medium">{histSafePage} / {histTotalPages}</span>
                <Button variant="outline" className="px-3 py-1.5 text-[12px]" disabled={histSafePage >= histTotalPages} onClick={() => setHistPage((p) => Math.min(histTotalPages, p + 1))}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
        <div className="mt-4 pt-4 border-t border-black/[0.06] flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `transfer-history-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download size={15} /> Export JSON
          </Button>
        </div>
      </Card>
    </div>
  );
}