import { useEffect, useMemo, useState } from "react";
import { useMasterOptions } from "../hooks/useMasterOptions";
import { usePermission } from "../lib/permissions";
import { PageIntro } from "../components/UI";
import SearchableSelect from "../components/SearchableSelect";
import TimetableManager from "../components/timetable/TimetableManager";
import SubstitutionPanel from "../components/timetable/SubstitutionPanel";

const CLASS_OPTIONS_FALLBACK = [
  "Nursery",
  "LKG",
  "UKG",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11-Sci",
  "11-Com",
  "12-Sci",
  "12-Com",
];
const SECTION_OPTIONS_FALLBACK = ["A", "B", "C"];

export default function Timetable() {
  const { options: masterClasses } = useMasterOptions(
    "classes",
    CLASS_OPTIONS_FALLBACK,
  );
  const { options: masterSections, rawItems: rawSections } = useMasterOptions(
    "sections",
    SECTION_OPTIONS_FALLBACK,
  );
  const [cls, setCls] = useState("");
  const [section, setSection] = useState("");
  const canWrite = usePermission("timetable:write");

  const sectionOptions = useMemo(() => {
    const forClass = cls
      ? [...new Set(rawSections.filter((s) => s.className === cls).map((s) => s.name))]
      : masterSections;
    return [...new Set(forClass.filter(Boolean))].sort();
  }, [cls, rawSections, masterSections]);

  const handleClassChange = (value) => {
    const nextCls = value === "" ? "" : value;
    setCls(nextCls);
    setSection("");
    if (nextCls) {
      const sections = [
        ...new Set(
          rawSections
            .filter((s) => s.className === nextCls)
            .map((s) => s.name)
            .filter(Boolean),
        ),
      ].sort();
      if (sections.length) setSection(sections[0]);
    }
  };

  useEffect(() => {
    if (cls || !masterClasses.length) return;
    const defaultClass = masterClasses.includes("1")
      ? "1"
      : masterClasses[0];
    setCls(defaultClass);
  }, [cls, masterClasses]);

  useEffect(() => {
    if (cls && !section) {
      const sections = [
        ...new Set(
          rawSections
            .filter((s) => s.className === cls)
            .map((s) => s.name)
            .filter(Boolean),
        ),
      ].sort();
      if (sections.length) setSection(sections[0]);
    }
  }, [cls, section, rawSections]);

  // The subject master is school-wide (one document per section), so the picker
  // needs the section's own id to narrow its list down to this class-section.
  const sectionId = useMemo(
    () =>
      rawSections.find((s) => s.className === cls && s.name === section)?._id ||
      "",
    [rawSections, cls, section],
  );

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="Timetable"
        description={
          canWrite
            ? "Build and manage weekly timetables for every class and section. Add, edit, or remove lesson slots from the grid."
            : "Weekly class timetable stored in Zipschool OS — select a class and section to view its schedule."
        }
        right={
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchableSelect
              options={masterClasses}
              value={cls}
              onChange={handleClassChange}
              renderLabel={(option) => `Class ${option}`}
              placeholder="Select class"
              className="min-w-[180px]"
            />
            <SearchableSelect
              options={sectionOptions}
              value={section}
              onChange={setSection}
              renderLabel={(s) => `Section ${s}`}
              placeholder="Select section"
              disabled={!cls}
              className="min-w-[130px]"
            />
          </div>
        }
      />

      <TimetableManager
        cls={cls}
        section={section}
        sectionId={sectionId}
        canWrite={canWrite}
      />

      <SubstitutionPanel cls={cls} section={section} canWrite={canWrite} />
    </div>
  );
}