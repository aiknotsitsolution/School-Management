import { PageIntro, Card } from "../../components/UI";

// Schools Management module (Phase D). Central school administration: list,
// filters, search, School 360, lifecycle status management, usage.
export default function SchoolsManagement() {
  return (
    <div className="max-w-6xl">
      <PageIntro
        eyebrow="Platform Owner · School Operations"
        title="Schools Management"
        description="Administer every tenant school: lifecycle status, plan, subscription, usage and activity."
      />
      <Card>
        <p className="text-[13px] text-slate-text/70">
          School list and School 360 populate here (Phase D). No fabricated
          data.
        </p>
      </Card>
    </div>
  );
}