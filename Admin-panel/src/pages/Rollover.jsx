import { useState } from "react";
import { RefreshCcw, GraduationCap, Users, ArrowRight, Info } from "lucide-react";
import { PageIntro, Card, Button, Input, Pill, StatCard, toast } from "../components/UI";
import { api } from "../lib/api";
import { usePermission } from "../lib/permissions";

function formatClass(c) {
  if (["Nursery", "LKG", "UKG"].includes(c)) return c;
  return `Class ${c}`;
}

export default function Rollover() {
  const canPrepare = usePermission("rollover:read");
  const [fromSession, setFromSession] = useState("");
  const [toSession, setToSession] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePrepare = async () => {
    if (!fromSession) {
      toast("From session is required", "amber");
      return;
    }
    setLoading(true);
    try {
      const { data: res } = await api.rollover.prepare({
        fromSession,
        toSession: toSession || undefined,
      });
      setData(res);
      toast(`Rollover prepared for ${res.totalStudents} student(s)`);
    } catch (e) {
      setData(null);
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const promoted = data
    ? data.classes.reduce((sum, c) => sum + (c.counts.Promoted || 0) + (c.counts["Promoted with Conditions"] || 0), 0)
    : 0;
  const detained = data ? data.classes.reduce((sum, c) => sum + (c.counts.Detained || 0), 0) : 0;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="Academic Rollover"
        description="Prepare the next session: review the promotion posture of every enrolled class before committing."
        right={
          <Button variant="amber" onClick={handlePrepare} disabled={loading || !canPrepare}>
            <RefreshCcw size={15} className={loading ? "animate-spin" : ""} /> {loading ? "Preparing…" : "Prepare Rollover"}
          </Button>
        }
      />

      <Card title="Session Rollover">
        <p className="text-[12.5px] text-slate-text/70 mb-4 flex items-start gap-2">
          <Info size={14} className="shrink-0 mt-0.5 text-info" />
          This step is read-only and makes no changes. It derives the next session
          label and reports suggested promotion decisions per class. Commit the
          promotions from the Promotions page, then activate the new session from
          Academic Sessions.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="From session, e.g. 2025-26"
            value={fromSession}
            onChange={(e) => setFromSession(e.target.value)}
            className="flex-1 min-w-[160px]"
          />
          <Input
            placeholder="To session (auto-derived if blank)"
            value={toSession}
            onChange={(e) => setToSession(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <Button variant="outline" onClick={handlePrepare} disabled={loading}>
            Auto-derive next session
          </Button>
        </div>
      </Card>

      {!data ? (
        <Card>
          <div className="py-12 text-center">
            <Users size={36} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[14px] font-medium text-ink">Enter the closing session to prepare a rollover</p>
            <p className="text-[13px] text-slate-text/60 mt-1">
              The per-class roster and suggested decisions will be shown here.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={RefreshCcw} label="Rollover" value={`${data.fromSession} → ${data.toSession}`} sub="New session target" accent="info" />
            <StatCard icon={Users} label="Total Students" value={String(data.totalStudents)} sub="Across all enrolled classes" accent="amber" />
            <StatCard icon={GraduationCap} label="Promotable" value={String(promoted)} sub="Clear or conditional" accent="success" />
            <StatCard icon={Users} label="Detained" value={String(detained)} sub="Repeat the session" accent="alert" />
          </div>

          <Card title="Per-Class Posture">
            {data.classes.length === 0 ? (
              <p className="text-[13px] text-slate-text/60 py-6 text-center">No enrolled classes found for {data.fromSession}.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.classes.map((c) => (
                  <div key={c.class} className="rounded-xl border border-black/[0.06] bg-paper/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-display font-semibold text-ink text-[14px]">{formatClass(c.class)}</p>
                      <Pill tone="info">{c.students} students</Pill>
                    </div>
                    <div className="space-y-1.5 text-[12.5px]">
                      {["Promoted", "Promoted with Conditions", "Detained", "Transferred", "Graduated"].map((status) => (
                        <div key={status} className="flex items-center justify-between">
                          <span className="text-slate-text/70">{status}</span>
                          <span className="flex items-center gap-2">
                            <ArrowRight size={11} className="text-slate-text/40" />
                            <b className="text-ink">{c.counts[status] || 0}</b>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-black/[0.06] flex items-center justify-between">
                      <span className="text-slate-text/70">Predicted pass rate</span>
                      <b className="text-success">{c.students ? Math.round(((c.counts.Promoted || 0) / c.students) * 100) : 0}%</b>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Recommended Next Steps">
            <ol className="list-decimal list-inside space-y-1.5 text-[13px] text-slate-text">
              <li>
                Open <b className="text-ink">Promotions</b> and commit the suggested decisions for each class.
              </li>
              <li>
                Open <b className="text-ink">Academic Sessions</b> and activate <b className="text-ink">{data.toSession}</b> as the current session.
              </li>
              <li>
                Verify report cards and marks now point to the new session.
              </li>
            </ol>
          </Card>
        </>
      )}
    </div>
  );
}