import { PageIntro, Card } from "../../components/UI";

// Reports module (Phase G). Report catalog, generation, history, download.
// Populated from real report infrastructure — not a fake export UI.
export default function PlatformReports() {
  return (
    <div className="max-w-6xl">
      <PageIntro
        eyebrow="Platform Owner · Insights"
        title="Reports"
        description="Generate and inspect platform reports across schools, users, subscriptions, billing and security."
      />
      <Card>
        <p className="text-[13px] text-slate-text/70">
          Report catalog and history populate here (Phase G) once the backend
          report infrastructure is in place. No fabricated download buttons.
        </p>
      </Card>
    </div>
  );
}