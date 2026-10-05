import { PageIntro } from "../../components/UI";
import StudentMaterialsPanel from "../../components/library/StudentMaterialsPanel";

// Standalone route kept for direct links; the sidebar now points at My
// Library's Study Materials tab (the same panel is rendered there).
export default function StudentStudyMaterials() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Learning"
        title="Study Materials" art="syllabus"
        description="Access notes, worksheets and e-books shared by your teachers."
      />
      <StudentMaterialsPanel />
    </div>
  );
}
