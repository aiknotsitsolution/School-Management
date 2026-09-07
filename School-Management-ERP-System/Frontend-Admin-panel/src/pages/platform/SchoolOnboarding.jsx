import { PageIntro, Card } from "../../components/UI";

// School Onboarding module (Phase D). Multi-step wizard: school info, address,
// primary administrator, plan & subscription, review, complete. Plus the list
// of registered schools requiring attention.
export default function SchoolOnboarding() {
  return (
    <div className="max-w-6xl">
      <PageIntro
        eyebrow="Platform Owner · School Operations"
        title="School Onboarding"
        description="Onboard a new tenant school end-to-end, and track requests that need attention."
      />
      <Card>
        <p className="text-[13px] text-slate-text/70">
          Onboarding wizard and attention list populate here (Phase D). No
          fabricated data.
        </p>
      </Card>
    </div>
  );
}