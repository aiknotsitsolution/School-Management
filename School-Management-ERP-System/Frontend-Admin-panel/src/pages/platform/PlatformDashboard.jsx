import { PageIntro, Card } from "../../components/UI";

// Platform Dashboard module (Phase C will populate this shell with real
// analytics sections: KPI cards, growth chart, subscription distribution,
// revenue, plan distribution, onboarding funnel, expiring, activity, alerts).
export default function PlatformDashboard() {
  return (
    <div className="max-w-7xl">
      <PageIntro
        eyebrow="Platform Owner"
        title="Dashboard"
        description="What is happening across your entire ERP SaaS platform right now."
      />
      <Card>
        <p className="text-[13px] text-slate-text/70">
          Dashboard analytics load here. No fabricated data is shown — sections
          are populated from the real platform analytics endpoint (Phase C).
        </p>
      </Card>
    </div>
  );
}