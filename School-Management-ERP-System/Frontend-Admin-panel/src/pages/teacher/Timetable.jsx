import { CalendarDays } from "lucide-react";
import { PageIntro, Card } from "../../components/UI";
import TimetableManager from "../../components/timetable/TimetableManager";
import { useTeacherContext } from "./useTeacherContext";
import { usePermission } from "../../lib/permissions";

export default function Timetable() {
  const { cls, section, assignment } = useTeacherContext();
  const canWrite = usePermission("timetable:write");

  if (!cls) {
    return (
      <Card>
        <div className="py-16 text-center">
          <CalendarDays size={40} className="mx-auto text-slate-text/30 mb-3" />
          <p className="text-[15px] font-semibold text-ink">
            No class assigned yet
          </p>
          <p className="text-[13px] text-slate-text/70 mt-1">
            Contact your school admin to link your class and section.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="My Teaching"
        title="Timetable"
        description={
          canWrite
            ? `Manage the weekly timetable for ${assignment}. Add, edit, or remove lesson slots for your class.`
            : `Weekly schedule for ${assignment}.`
        }
      />

      <TimetableManager cls={cls} section={section} canWrite={canWrite} />
    </div>
  );
}