import { PageIntro, Card } from "../../components/UI";

// Audit Logs module (Phase H). Append-oriented, controlled history of sensitive
// platform actions. Never stores passwords, JWTs, tokens or secrets.
export default function AuditLogs() {
  return (
    <div className="max-w-6xl">
      <PageIntro
        eyebrow="Platform Owner · Access & Security"
        title="Audit Logs"
        description="Immutable history of sensitive platform actions: who changed what, when, and on which entity."
      />
      <Card>
        <p className="text-[13px] text-slate-text/70">
          Audit log viewer populates here (Phase H). Entries come from the real
          audit store.
        </p>
      </Card>
    </div>
  );
}