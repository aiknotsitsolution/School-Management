import { PageIntro } from "../components/UI";
import StudyMaterialsPanel from "../components/library/StudyMaterialsPanel";

// Standalone route kept for direct links; the sidebar now points at the
// Library's Study Materials tab (the same panel is rendered there).
export default function StudyMaterials() {
  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="Academics"
        title="Study Materials"
        description="Share notes, worksheets, e-books and links with classes."
      />
      <StudyMaterialsPanel />
    </div>
  );
}
