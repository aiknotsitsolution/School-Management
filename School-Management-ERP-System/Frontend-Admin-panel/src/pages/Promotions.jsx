import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Search, RefreshCw, Download } from "lucide-react";
import { PageIntro, Card, Button, Select, Input, Pill, StatCard, toast } from "../components/UI";
import { api } from "../lib/api";
import { suggestPromotionStatus, PROMOTION_STATUSES } from "../lib/grading";
import { usePermission } from "../lib/permissions";
import { useMasterOptions } from "../hooks/useMasterOptions";
import SearchableSelect from "../components/SearchableSelect";

const CLASS_OPTIONS_FALLBACK = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11-Sci", "11-Com", "12-Sci", "12-Com"];
const SECTION_OPTIONS_FALLBACK = ["A", "B", "C"];

const STATUS_TONE = {
  Promoted: "success",
  "Promoted with Conditions": "info",
  Detained: "alert",
  Transferred: "neutral",
  Graduated: "neutral",
};

function suggestTone(status) {
  return STATUS_TONE[status] || "neutral";
}

function formatClass(c) {
  if (["Nursery", "LKG", "UKG"].includes(c)) return c;
  return `Class ${c}`;
}

export default function Promotions() {
  const { options: masterClasses } = useMasterOptions("classes", CLASS_OPTIONS_FALLBACK);
  const { options: masterSections, rawItems: rawSections } = useMasterOptions("sections", SECTION_OPTIONS_FALLBACK);
  const CLASS_OPTIONS = ["All", ...masterClasses.filter((c) => c !== "All")];
  const SECTION_OPTIONS = ["All", ...masterSections.filter((s) => s !== "All")];

  const canPromote = usePermission("promotion:write");
  const [cls, setCls] = useState("All");
  const [sec, setSec] = useState("All");
  const [fromSession, setFromSession] = useState("");
  const [toSession, setToSession] = useState("");
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]);
  const [toClass, setToClass] = useState("");
  const [toSection, setToSection] = useState("");
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [history, setHistory] = useState([]);
  const filteredSections = useMemo(() => {
    if (cls === "All") return SECTION_OPTIONS;
    return ["All", ...[...new Set(rawSections.filter((s) => s.className === cls).map((s) => s.name))]];
  }, [cls, SECTION_OPTIONS, rawSections]);
  const filteredToSections = useMemo(() => {
    if (!toClass) return SECTION_OPTIONS.filter((s) => s !== "All");
    return [...new Set(rawSections.filter((s) => s.className === toClass).map((s) => s.name))];
  }, [toClass, SECTION_OPTIONS, rawSections]);

  useEffect(() => {
    api.promotions
      .history("limit=25")
      .then(({ data }) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const runPreview = async () => {
    if (!fromSession || !toSession) {
      toast("Both from and to session are required", "amber");
      return;
    }
    setLoading(true);
    try {
      const params = `fromSession=${encodeURIComponent(fromSession)}&toSession=${encodeURIComponent(toSession)}`;
      const raw = `${params}${cls !== "All" ? `&class=${encodeURIComponent(cls)}` : ""}${sec !== "All" ? `&section=${encodeURIComponent(sec)}` : ""}`;
      const { data } = await api.promotions.preview(raw);
      setPreview(data);
      setRows(
        (data.rows || []).map((r) => ({
          studentId: r.studentId,
          name: r.name,
          rollNo: r.rollNo,
          class: r.class,
          section: r.section,
          suggestedStatus: r.suggestedStatus || suggestPromotionStatus(r.summary),
          pct: r.summary?.percentage != null ? Number(r.summary.percentage).toFixed(2) : "—",
          failed: r.summary?.failedSubjects ?? 0,
          include: true,
        })),
      );
    } catch (e) {
      toast(e.message, "error");
      setPreview(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => {
    const c = { Promoted: 0, "Promoted with Conditions": 0, Detained: 0, Transferred: 0, Graduated: 0 };
    rows.filter((r) => r.include).forEach((r) => {
      c[r.suggestedStatus] = (c[r.suggestedStatus] || 0) + 1;
    });
    return c;
  }, [rows]);

  const setStatus = (studentId, status) => {
    setRows((prev) =>
      prev.map((r) =>
        r.studentId === studentId ? { ...r, suggestedStatus: status } : r,
      ),
    );
  };

  const toggleRow = (studentId) => {
    setRows((prev) =>
      prev.map((r) =>
        r.studentId === studentId ? { ...r, include: !r.include } : r,
      ),
    );
  };

  const selected = useMemo(() => rows.filter((r) => r.include), [rows]);

  const handleCommit = async () => {
    if (!preview) return;
    if (!selected.length) {
      toast("Select at least one student to promote", "amber");
      return;
    }
    const decisions = selected.map((r) => {
      const moving = r.suggestedStatus === "Promoted" || r.suggestedStatus === "Promoted with Conditions";
      return {
        studentId: r.studentId,
        status: r.suggestedStatus,
        ...(moving ? { toClass: toClass || String(Number(r.class) + 1 || r.class), toSection: toSection || r.section || "A" } : {}),
      };
    });
    setCommitting(true);
    try {
      const { data } = await api.promotions.commit({
        fromSession: preview.fromSession,
        toSession: preview.toSession,
        decisions,
      });
      toast(`Promotion recorded for ${data.length} student(s)`);
      setPreview(null);
      setRows([]);
      api.promotions
        .history("limit=25")
        .then((res) => setHistory(Array.isArray(res.data) ? res.data : []))
        .catch(() => {});
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="Promotions"
        description="Preview suggested promotion decisions and commit them to the new session."
        right={
          preview && canPromote ? (
            <Button variant="amber" onClick={handleCommit} disabled={committing}>
              <GraduationCap size={15} /> {committing ? "Committing…" : `Commit ${selected.length} Promotion(s)`}
            </Button>
          ) : null
        }
      />

      <Card title="Promotion Preview">
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchableSelect
            options={CLASS_OPTIONS}
            value={cls}
            onChange={(v) => { setCls(v); setSec("All"); }}
            renderLabel={(c) => (c === "All" ? "All Classes" : formatClass(c))}
            placeholder="All Classes"
            className="min-w-[130px]"
          />
          <SearchableSelect
            options={filteredSections}
            value={sec}
            onChange={setSec}
            renderLabel={(s) => (s === "All" ? "All Sections" : `Section ${s}`)}
            placeholder="All Sections"
            className="min-w-[110px]"
          />
          <Input
            placeholder="From session, e.g. 2025-26"
            value={fromSession}
            onChange={(e) => setFromSession(e.target.value)}
            className="flex-1 min-w-[150px]"
          />
          <Input
            placeholder="To session, e.g. 2026-27"
            value={toSession}
            onChange={(e) => setToSession(e.target.value)}
            className="flex-1 min-w-[150px]"
          />
          <Button variant="amber" onClick={runPreview} disabled={loading}>
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> {loading ? "Previewing…" : "Preview"}
          </Button>
        </div>
      </Card>

      {!preview ? (
        <Card>
          <div className="py-12 text-center">
            <Search size={36} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[14px] font-medium text-ink">Enter sessions above to preview promotions</p>
            <p className="text-[13px] text-slate-text/60 mt-1">
              The system computes the suggested status per student from the recorded marks.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={GraduationCap} label="Total Students" value={String(rows.length)} sub={`${preview.fromSession} → ${preview.toSession}`} accent="info" />
            <StatCard icon={GraduationCap} label="Promoted" value={String(counts.Promoted)} sub="Clear promotion" accent="success" />
            <StatCard icon={GraduationCap} label="With Conditions" value={String(counts["Promoted with Conditions"])} sub="Conditional promotion" accent="amber" />
            <StatCard icon={GraduationCap} label="Detained" value={String(counts.Detained)} sub="Repeat the session" accent="alert" />
          </div>

          <Card
            title="Decision Table"
            action={
              canPromote ? (
                <div className="flex items-center gap-2">
                   <SearchableSelect
                     options={masterClasses.filter((c) => c !== "All")}
                     value={toClass}
                     onChange={(v) => { setToClass(v); setToSection(""); }}
                     renderLabel={(c) => formatClass(c)}
                     placeholder="Next class…"
                     className="min-w-[120px]"
                   />
                   <SearchableSelect
                     options={filteredToSections}
                     value={toSection}
                     onChange={setToSection}
                     placeholder="Section…"
                     className="min-w-[100px]"
                   />
                </div>
              ) : null
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide bg-paper/80 border-b border-black/[0.06]">
                    <th className="px-4 py-2.5 font-semibold w-8">Include</th>
                    <th className="px-4 py-2.5 font-semibold">Student</th>
                    <th className="px-4 py-2.5 font-semibold">Class</th>
                    <th className="px-4 py-2.5 font-semibold">%</th>
                    <th className="px-4 py-2.5 font-semibold">Failed</th>
                    <th className="px-4 py-2.5 font-semibold">Suggested Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={r.studentId} className={`border-b border-black/[0.04] last:border-0 ${idx % 2 === 0 ? "" : "bg-paper/40"}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={r.include}
                          onChange={() => toggleRow(r.studentId)}
                          className="accent-amber"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink">{r.name}</p>
                        <p className="text-[11.5px] text-slate-text/60">{r.studentId}{r.rollNo ? ` · Roll ${r.rollNo}` : ""}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-text">{formatClass(r.class)}{r.section ? `-${r.section}` : ""}</td>
                      <td className="px-4 py-3 font-semibold text-ink">{r.pct}%</td>
                      <td className="px-4 py-3">{r.failed > 0 ? <Pill tone="alert">{r.failed}</Pill> : <span className="text-slate-text/40">0</span>}</td>
                      <td className="px-4 py-3">
                        <Select
                          value={r.suggestedStatus}
                          disabled={!canPromote}
                          onChange={(e) => setStatus(r.studentId, e.target.value)}
                          className="min-w-[190px]"
                        >
                          {PROMOTION_STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!canPromote && (
              <p className="text-[12px] text-slate-text/60 mt-3">
                You have read-only access. Only school admins can commit promotions.
              </p>
            )}
          </Card>
        </>
      )}

      <Card title="Promotion History" action={<Pill tone="info">{history.length} records</Pill>}>
        {history.length === 0 ? (
          <p className="text-[13px] text-slate-text/60 py-6 text-center">No promotions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-slate-text/60 text-[11.5px] uppercase tracking-wide border-b border-black/[0.06]">
                  <th className="px-4 py-2.5 font-semibold">Student</th>
                  <th className="px-4 py-2.5 font-semibold">From</th>
                  <th className="px-4 py-2.5 font-semibold">To</th>
                  <th className="px-4 py-2.5 font-semibold">Session</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Acted By</th>
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h._id} className="border-b border-black/[0.04] last:border-0">
                    <td className="px-4 py-3 font-semibold text-ink">{h.studentName}</td>
                    <td className="px-4 py-3 text-slate-text">{formatClass(h.fromClass)}{h.fromSection ? `-${h.fromSection}` : ""}</td>
                    <td className="px-4 py-3 text-slate-text">{h.toClass ? formatClass(h.toClass) : "—"}{h.toSection ? `-${h.toSection}` : ""}</td>
                    <td className="px-4 py-3 text-slate-text">{h.session}</td>
                    <td className="px-4 py-3"><Pill tone={suggestTone(h.status)}>{h.status}</Pill></td>
                    <td className="px-4 py-3 text-slate-text">{h.actedByName || "—"}</td>
                    <td className="px-4 py-3 text-slate-text">{h.createdAt ? new Date(h.createdAt).toLocaleDateString("en-IN") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-black/[0.06] flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `promotion-history-${new Date().toISOString().slice(0, 10)}.json`;
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