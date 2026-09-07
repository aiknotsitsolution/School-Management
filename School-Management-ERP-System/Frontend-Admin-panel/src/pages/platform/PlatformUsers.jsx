import { PageIntro, Card } from "../../components/UI";

// Users & Access module (Phase E). Platform-level user management: paginated
// list, create, edit, status lifecycle, soft delete/restore, User 360.
export default function PlatformUsers() {
  return (
    <div className="max-w-6xl">
      <PageIntro
        eyebrow="Platform Owner · Access & Security"
        title="Users & Access"
        description="Manage platform users and access. This is platform-level, distinct from per-school user management."
      />
      <Card>
        <p className="text-[13px] text-slate-text/70">
          Platform user list and User 360 populate here (Phase E). No fabricated
          data.
        </p>
      </Card>
    </div>
  );
}