import { PageIntro, Card } from "../../components/UI";

// Platform Settings module (Phase H). Platform-level configuration only. Never
// exposes environment secrets; never hosts per-school settings here.
export default function PlatformSettings() {
  return (
    <div className="max-w-6xl">
      <PageIntro
        eyebrow="Platform Owner · System"
        title="Platform Settings"
        description="Platform-level configuration: general, security, notifications, billing defaults, feature flags."
      />
      <Card>
        <p className="text-[13px] text-slate-text/70">
          Platform configuration populates here (Phase H). Secrets are never
          exposed through the UI.
        </p>
      </Card>
    </div>
  );
}