import { PageIntro, Card } from "../components/UI";

export default function Teachers() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="Teachers"
        description="Manage teaching staff records."
      />
      <Card title="Teachers">
        <p className="text-[13px] text-slate-text/70">
          Teacher management module is under development.
        </p>
      </Card>
    </div>
  );
}