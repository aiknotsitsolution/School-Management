import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Trash2,
  RotateCcw,
  Pencil,
  School,
  BookOpen,
  Layers,
  Wallet,
  X,
  CheckCircle2,
  Bell,
  Users,
  CalendarDays,
  Blocks,
} from "lucide-react";
import { api } from "../lib/api";
import {
  invalidateMasterCache,
} from "../lib/masterCache";
import {
  Button,
  Card,
  PageIntro,
  Pill,
  toast,
} from "../components/UI";
import CustomMasterModal from "../components/CustomMasterModal";

const TABS = [
  { key: "classes", label: "Classes", singular: "Class", icon: School, kind: "classes" },
  { key: "sections", label: "Sections", singular: "Section", icon: Layers, kind: "sections" },
  { key: "subjects", label: "Subjects", singular: "Subject", icon: BookOpen, kind: "subjects" },
  { key: "fee-types", label: "Fee Types", singular: "Fee Type", icon: Wallet, kind: "fee-types" },
  { key: "attendance-statuses", label: "Attendance Statuses", singular: "Attendance Status", icon: CheckCircle2, kind: "attendance-statuses" },
  { key: "notice-categories", label: "Notice Categories", singular: "Notice Category", icon: Bell, kind: "notice-categories" },
  { key: "notice-audiences", label: "Notice Audiences", singular: "Notice Audience", icon: Users, kind: "notice-audiences" },
  { key: "event-categories", label: "Event Categories", singular: "Event Category", icon: CalendarDays, kind: "event-categories" },
  { key: "hostel-blocks", label: "Hostel Blocks", singular: "Hostel Block", icon: Blocks, kind: "hostel-blocks" },
];

// Masters switch lifecycle through either active:Boolean (classes, sections,
// ...) or a status enum (subjects -> status:"active"/"inactive").
const isActiveItem = (item) =>
  item && ("status" in item ? item.status === "active" : item.active !== false);

const setLifecycle = (item, active) =>
  "status" in item
    ? { ...item, status: active ? "active" : "inactive" }
    : { ...item, active };

function SectionRow({ item, onDeactivate, onReactivate }) {
  const isActive = item.active !== false;
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg hover:bg-paper/50 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink truncate">
          Section {item.name}
        </p>
        <p className="text-[11.5px] text-slate-text/60">
          {item.className ? `Class ${item.className}` : "All classes"}
        </p>
      </div>
      <Pill tone={isActive ? "success" : "neutral"}>
        {isActive ? "Active" : "Inactive"}
      </Pill>
      <button
        onClick={() => (isActive ? onDeactivate(item._id) : onReactivate(item._id))}
        className={`p-2 rounded-lg transition-colors ${
          isActive
            ? "text-alert hover:bg-alert/10"
            : "text-success hover:bg-success/10"
        }`}
        title={isActive ? "Deactivate" : "Reactivate"}
      >
        {isActive ? <Trash2 size={15} /> : <RotateCcw size={15} />}
      </button>
    </div>
  );
}

function MasterList({
  items,
  loading,
  label,
  searchPlaceholder,
  filterFn,
  onDeactivate,
  onReactivate,
  onEdit,
  renderItem,
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const base = filterFn ? filterFn(items) : items;
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter((i) => i.name?.toLowerCase().includes(q));
  }, [items, query, filterFn]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-text/40"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder || `Search ${label.toLowerCase()}...`}
            className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-black/10 text-[13px] outline-none focus:border-ink/40 bg-white placeholder:text-slate-text/50"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-text/40 hover:text-ink"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <div className="text-[12px] text-slate-text/60 shrink-0">
          {filtered.length} {filtered.length === 1 ? "item" : "items"}
        </div>
      </div>
      {loading ? (
        <div className="py-10 text-center text-[13px] text-slate-text/60">
          Loading {label.toLowerCase()}...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-[13px] text-slate-text/60">
            {query ? `No ${label.toLowerCase()} match "${query}"` : `No ${label.toLowerCase()} configured yet`}
          </p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {filtered.map((item) =>
            renderItem ? (
              renderItem(item)
            ) : (
              <div
                key={item._id}
                className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg hover:bg-paper/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-ink truncate">
                    {item.name}
                  </p>
                  {item.description && (
                    <p className="text-[11.5px] text-slate-text/60 truncate">
                      {item.description}
                    </p>
                  )}
                </div>
                {onEdit && (
                  <button
                    onClick={() => onEdit(item)}
                    className="p-2 rounded-lg text-slate-text hover:bg-paper transition-colors"
                    title={`Edit ${item.name}`}
                  >
                    <Pencil size={15} />
                  </button>
                )}
                <Pill tone={isActiveItem(item) ? "success" : "neutral"}>
                  {isActiveItem(item) ? "Active" : "Inactive"}
                </Pill>
                <button
                  onClick={() =>
                    isActiveItem(item)
                      ? onDeactivate(item._id)
                      : onReactivate(item._id)
                  }
                  className={`p-2 rounded-lg transition-colors ${
                    isActiveItem(item)
                      ? "text-alert hover:bg-alert/10"
                      : "text-success hover:bg-success/10"
                  }`}
                  title={isActiveItem(item) ? "Deactivate" : "Reactivate"}
                >
                  {isActiveItem(item) ? (
                    <Trash2 size={15} />
                  ) : (
                    <RotateCcw size={15} />
                  )}
                </button>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export default function ManageSchool() {
  const [activeTab, setActiveTab] = useState("classes");
  const [items, setItems] = useState({
    classes: [],
    sections: [],
    subjects: [],
    "fee-types": [],
    "attendance-statuses": [],
    "notice-categories": [],
    "notice-audiences": [],
    "event-categories": [],
    "hostel-blocks": [],
  });
  const [loading, setLoading] = useState(true);
  const [customModal, setCustomModal] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      api.examMasters.list("classes"),
      api.examMasters.list("sections"),
      api.examMasters.list("subjects"),
      api.examMasters.list("fee-types"),
      api.examMasters.list("attendance-statuses"),
      api.examMasters.list("notice-categories"),
      api.examMasters.list("notice-audiences"),
      api.examMasters.list("event-categories"),
      api.examMasters.list("hostel-blocks"),
    ]);
    const pick = (i) =>
      results[i].status === "fulfilled" ? results[i].value?.data || [] : [];
    setItems({
      classes: pick(0),
      sections: pick(1),
      subjects: pick(2),
      "fee-types": pick(3),
      "attendance-statuses": pick(4),
      "notice-categories": pick(5),
      "notice-audiences": pick(6),
      "event-categories": pick(7),
      "hostel-blocks": pick(8),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleDeactivate = async (kind, id) => {
    try {
      await api.examMasters.deactivate(kind, id);
      invalidateMasterCache(kind);
      setItems((prev) => ({
        ...prev,
        [kind]: prev[kind].map((i) => (i._id === id ? setLifecycle(i, false) : i)),
      }));
      toast("Item deactivated", "info");
    } catch {
      toast("Failed to deactivate", "error");
    }
  };

  const handleRestore = async (kind, id) => {
    try {
      await api.examMasters.restore(kind, id);
      invalidateMasterCache(kind);
      setItems((prev) => ({
        ...prev,
        [kind]: prev[kind].map((i) => (i._id === id ? setLifecycle(i, true) : i)),
      }));
      toast("Item reactivated");
    } catch {
      toast("Failed to reactivate", "error");
    }
  };

  const handleCreated = (kind, newItem) => {
    invalidateMasterCache(kind);
    setItems((prev) => {
      const exists = prev[kind].some((i) => i._id === newItem._id);
      return {
        ...prev,
        [kind]: exists
          ? prev[kind].map((i) => (i._id === newItem._id ? newItem : i))
          : [...prev[kind], newItem],
      };
    });
  };

  const handleUpdated = (kind, updatedItem) => {
    invalidateMasterCache(kind);
    setItems((prev) => ({
      ...prev,
      [kind]: prev[kind].map((i) => (i._id === updatedItem._id ? updatedItem : i)),
    }));
  };

  const classCount = items.classes.filter((i) => isActiveItem(i)).length;
  const sectionCount = items.sections.filter((i) => isActiveItem(i)).length;
  const subjectCount = items.subjects.filter((i) => isActiveItem(i)).length;
  const feeTypeCount = items["fee-types"].filter((i) => isActiveItem(i)).length;
  const attendanceStatusCount = items["attendance-statuses"].filter((i) => isActiveItem(i)).length;
  const noticeCategoryCount = items["notice-categories"].filter((i) => isActiveItem(i)).length;
  const noticeAudienceCount = items["notice-audiences"].filter((i) => isActiveItem(i)).length;
  const eventCategoryCount = items["event-categories"].filter((i) => isActiveItem(i)).length;
  const hostelBlockCount = items["hostel-blocks"].filter((i) => isActiveItem(i)).length;

  const tab = TABS.find((t) => t.key === activeTab);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Administration"
        title="Manage School"
        description="Configure classes, sections, subjects and other academic master data for your school."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {TABS.map((t) => {
          const counts = {
            classes: classCount,
            sections: sectionCount,
            subjects: subjectCount,
            "fee-types": feeTypeCount,
            "attendance-statuses": attendanceStatusCount,
            "notice-categories": noticeCategoryCount,
            "notice-audiences": noticeAudienceCount,
            "event-categories": eventCategoryCount,
            "hostel-blocks": hostelBlockCount,
          };
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
                activeTab === t.key
                  ? "bg-ink text-white border-ink"
                  : "bg-white text-ink border-black/10 hover:border-black/20"
              }`}
            >
              <t.icon size={18} />
              <div>
                <p className="text-[13px] font-semibold">{t.label}</p>
                <p
                  className={`text-[11.5px] ${
                    activeTab === t.key ? "text-white/60" : "text-slate-text/60"
                  }`}
                >
                  {counts[t.key]} active
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <Card
        title={tab?.label}
        action={
          <Button
            variant="amber"
            onClick={() =>
              setCustomModal({ kind: tab.kind, label: tab.singular })
            }
          >
            <Plus size={15} />
            Add {tab.singular}
          </Button>
        }
      >
        <MasterList
          items={items[activeTab] || []}
          loading={loading}
          kind={activeTab}
          label={tab?.label}
          onDeactivate={(id) => handleDeactivate(activeTab, id)}
          onReactivate={(id) => handleRestore(activeTab, id)}
          onEdit={(item) =>
            setCustomModal({ kind: activeTab, label: tab.singular, initialItem: item })
          }
          renderItem={
            activeTab === "sections"
              ? (item) => (
                  <SectionRow
                    key={item._id}
                    item={item}
                    classOptions={items.classes}
                    onDeactivate={(id) => handleDeactivate("sections", id)}
                    onReactivate={(id) => handleRestore("sections", id)}
                  />
                )
              : undefined
          }
        />
      </Card>

      {customModal && (
        <CustomMasterModal
          kind={customModal.kind}
          label={customModal.label}
          title={
            customModal.initialItem
              ? `Edit ${customModal.label}`
              : `Add Custom ${customModal.label}`
          }
          showDescription={customModal.kind === "subjects"}
          initialItem={customModal.initialItem}
          onClose={() => setCustomModal(null)}
          onCreated={(newItem) => handleCreated(customModal.kind, newItem)}
          onUpdated={(updatedItem) => handleUpdated(customModal.kind, updatedItem)}
        />
      )}
    </div>
  );
}
