import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
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
  Building2,
  Save,
  Camera,
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
  Select,
  Input,
  toast,
} from "../components/UI";
import { Pagination } from "../components/Pagination";
import CustomMasterModal from "../components/CustomMasterModal";
import { selectSchool, selectUser } from "../store/selectors";
import { setSchool as setSchoolAction } from "../store/authSlice";
import { hasPermission } from "../lib/permissions";
import { sessionLabel } from "../lib/session";

const TABS = [
  { key: "school-profile", label: "School Profile", singular: "School Profile", icon: Building2, kind: "school-profile" },
  { key: "classes", label: "Classes", singular: "Class", icon: School, kind: "classes" },
  { key: "sections", label: "Sections", singular: "Section", icon: Layers, kind: "sections" },
  { key: "subjects", label: "Subjects", singular: "Subject", icon: BookOpen, kind: "subjects" },
  { key: "fee-types", label: "Fee Types", singular: "Fee Type", icon: Wallet, kind: "fee-types" },
  { key: "attendance-statuses", label: "Attendance Statuses", singular: "Attendance Status", icon: CheckCircle2, kind: "attendance-statuses" },
  { key: "leave-types", label: "Leave Types", singular: "Leave Type", icon: CalendarDays, kind: "leave-types" },
  { key: "notice-categories", label: "Notice Categories", singular: "Notice Category", icon: Bell, kind: "notice-categories" },
  { key: "notice-audiences", label: "Notice Audiences", singular: "Notice Audience", icon: Users, kind: "notice-audiences" },
  { key: "event-categories", label: "Event Categories", singular: "Event Category", icon: CalendarDays, kind: "event-categories" },
  { key: "hostel-blocks", label: "Hostel Blocks", singular: "Hostel Block", icon: Blocks, kind: "hostel-blocks" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;
const PINCODE_RE = /^[1-9][0-9]{5}$/;

function SchoolProfileForm({ school, user, onSave }) {
  const dispatch = useDispatch();
  const logoInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const [form, setForm] = useState({
    name: school?.name || "",
    shortName: school?.shortName || "",
    email: school?.email || "",
    phone: school?.phone || "",
    address: school?.address || "",
    city: school?.city || "",
    state: school?.state || "",
    pincode: school?.pincode || "",
    board: school?.board || "",
    recognitionNumber: school?.recognitionNumber || "",
    recognitionAuthority: school?.recognitionAuthority || "",
  });
  const [saving, setSaving] = useState(false);
  const [logoSaving, setLogoSaving] = useState(false);
  const [bannerSaving, setBannerSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: school?.name || "",
      shortName: school?.shortName || "",
      email: school?.email || "",
      phone: school?.phone || "",
      address: school?.address || "",
      city: school?.city || "",
      state: school?.state || "",
      pincode: school?.pincode || "",
      board: school?.board || "",
      recognitionNumber: school?.recognitionNumber || "",
      recognitionAuthority: school?.recognitionAuthority || "",
    });
  }, [school?.name, school?.shortName, school?.email, school?.phone, school?.address, school?.city, school?.state, school?.pincode, school?.board, school?.recognitionNumber, school?.recognitionAuthority]);

  const save = async () => {
    if (form.email && !EMAIL_RE.test(form.email.trim())) {
      toast("Please enter a valid school email", "error");
      return;
    }
    if (form.phone && !PHONE_RE.test(form.phone.trim())) {
      toast("Please enter a valid phone number", "error");
      return;
    }
    if (form.pincode && !PINCODE_RE.test(form.pincode.trim())) {
      toast("Please enter a valid 6-digit pincode", "error");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.school.update({
        name: form.name.trim() || school?.name,
        shortName: form.shortName.trim() || school?.shortName,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        pincode: form.pincode.trim() || undefined,
        board: form.board.trim() || undefined,
        recognitionNumber: form.recognitionNumber.trim() || undefined,
        recognitionAuthority: form.recognitionAuthority.trim() || undefined,
      });
      dispatch(setSchoolAction(data));
      localStorage.setItem("erp_school", JSON.stringify(data));
      setForm({
        name: data.name || "",
        shortName: data.shortName || "",
        email: data.email || "",
        phone: data.phone || "",
        address: data.address || "",
        city: data.city || "",
        state: data.state || "",
        pincode: data.pincode || "",
        board: data.board || "",
        recognitionNumber: data.recognitionNumber || "",
        recognitionAuthority: data.recognitionAuthority || "",
      });
      toast("School profile saved");
      onSave?.(data);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      toast("Please choose an image file", "error");
      return;
    }
    if (file.size > 1024 * 1024) {
      toast("Logo should be smaller than 1MB", "error");
      return;
    }
    setLogoSaving(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const { data } = await api.school.update({ logo: reader.result });
        dispatch(setSchoolAction(data));
        localStorage.setItem("erp_school", JSON.stringify(data));
        toast("School logo updated");
      } catch (err) {
        toast(err.message || "Logo upload failed", "error");
      } finally {
        setLogoSaving(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleBannerPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      toast("Please choose an image file", "error");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast("Banner image should be smaller than 2MB", "error");
      return;
    }
    setBannerSaving(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const { data } = await api.school.update({ bannerImage: reader.result });
        dispatch(setSchoolAction(data));
        localStorage.setItem("erp_school", JSON.stringify(data));
        toast("Dashboard banner updated");
      } catch (err) {
        toast(err.message || "Banner upload failed", "error");
      } finally {
        setBannerSaving(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-5">
        <div className="relative group">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-ink flex items-center justify-center shrink-0">
            {school?.logo ? (
              <img src={school.logo} alt="School logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-amber text-3xl font-display font-bold">
                {(school?.shortName || school?.name || "S").slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <label className="absolute inset-0 rounded-full bg-ink/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer">
            <Camera size={18} className="text-white" />
            <span className="text-[10px] font-semibold text-white">Change</span>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={handleLogoPick}
            />
          </label>
        </div>
        <div>
          <p className="text-[12.5px] text-slate-text/60">
            {logoSaving ? "Uploading logo…" : "Hover over the logo to change it."}
          </p>
        </div>
      </div>

      <div>
        <label className="text-[12px] font-semibold text-ink mb-1.5 block">Dashboard Banner</label>
        <div className="relative rounded-xl overflow-hidden bg-ink group cursor-pointer" style={{ height: 140 }}>
          <img
            src={school?.settings?.bannerImage || "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1600&h=400&q=80"}
            alt="Dashboard banner"
            className="absolute inset-0 w-full h-full object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-ink/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white">
            <Camera size={20} />
            <span className="text-[12px] font-semibold">
              {bannerSaving ? "Uploading…" : "Change Banner Image"}
            </span>
          </div>
          <label className="absolute inset-0 cursor-pointer">
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={handleBannerPick}
            />
          </label>
        </div>
        <p className="text-[11px] text-slate-text/50 mt-1">
          {bannerSaving ? "Uploading banner…" : "This image appears as the background on the Admin Dashboard."}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[12px] font-semibold text-ink mb-1.5 block">School Name</label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="School name" />
        </div>
        <div>
          <label className="text-[12px] font-semibold text-ink mb-1.5 block">Short Name</label>
          <Input value={form.shortName} onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))} placeholder="Short name used in the sidebar" />
        </div>
        <div>
          <label className="text-[12px] font-semibold text-ink mb-1.5 block">School Code</label>
          <Input value={school?.code || ""} disabled className="font-mono opacity-60 cursor-not-allowed" />
          <p className="text-[11px] text-slate-text/60 mt-1">Internal identifier. Cannot be changed.</p>
        </div>
        <div>
          <label className="text-[12px] font-semibold text-ink mb-1.5 block">Session</label>
          <div className="flex items-center h-[38px]">
            <Pill tone="neutral">{sessionLabel(school) || "—"}</Pill>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[12px] font-semibold text-ink mb-1.5 block">School Email</label>
          <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="School email" />
        </div>
        <div>
          <label className="text-[12px] font-semibold text-ink mb-1.5 block">Phone</label>
          <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone number" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[12px] font-semibold text-ink mb-1.5 block">Address</label>
          <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Address" />
        </div>
        <div>
          <label className="text-[12px] font-semibold text-ink mb-1.5 block">City</label>
          <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="City" />
        </div>
        <div>
          <label className="text-[12px] font-semibold text-ink mb-1.5 block">State</label>
          <Input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} placeholder="State" />
        </div>
        <div>
          <label className="text-[12px] font-semibold text-ink mb-1.5 block">Pincode</label>
          <Input value={form.pincode} onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))} placeholder="6-digit pincode" />
        </div>
      </div>

      <div className="border-t border-black/5 pt-4 mt-2">
        <h4 className="text-[13px] font-bold text-ink mb-3">Affiliation & Recognition</h4>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="text-[12px] font-semibold text-ink mb-1.5 block">Board</label>
            <select
              value={form.board}
              onChange={(e) => setForm((f) => ({ ...f, board: e.target.value }))}
              className="w-full h-[38px] rounded-lg border border-black/10 bg-white px-3 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-amber/40"
            >
              <option value="">Select board</option>
              <option value="CBSE">CBSE</option>
              <option value="ICSE">ICSE</option>
              <option value="State Board">State Board</option>
              <option value="IGCSE">IGCSE</option>
              <option value="IB">IB (International Baccalaureate)</option>
              <option value="NIOS">NIOS</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-[12px] font-semibold text-ink mb-1.5 block">Recognition / Affiliation No.</label>
            <Input
              value={form.recognitionNumber}
              onChange={(e) => setForm((f) => ({ ...f, recognitionNumber: e.target.value }))}
              placeholder="e.g. 2730456 / UGC-12345"
            />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-ink mb-1.5 block">Issuing Authority</label>
            <select
              value={form.recognitionAuthority}
              onChange={(e) => setForm((f) => ({ ...f, recognitionAuthority: e.target.value }))}
              className="w-full h-[38px] rounded-lg border border-black/10 bg-white px-3 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-amber/40"
            >
              <option value="">Select authority</option>
              <option value="CBSE">CBSE, New Delhi</option>
              <option value="CISCE">CISCE (ICSE), New Delhi</option>
              <option value="State Education Dept">State Education Department</option>
              <option value="UGC">UGC (University Grants Commission)</option>
              <option value="AICTE">AICTE</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        {school?.recognitionVerified && (
          <div className="mt-2 flex items-center gap-2 text-[12px] text-success font-medium">
            <span className="w-2 h-2 rounded-full bg-success inline-block" />
            Verified on {new Date(school.recognitionVerifiedAt).toLocaleDateString("en-IN")}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end pt-2">
        <Button variant="amber" onClick={save} disabled={saving}>
          <Save size={15} />
          {saving ? "Saving…" : "Save Profile"}
        </Button>
      </div>

      <div className="border-t border-black/5 pt-4">
        <p className="text-[12px] text-slate-text/60">
          <span className="font-medium text-ink">{user?.name}</span> · {user?.email || "—"} ·{" "}
          <Pill tone="info" className="inline-flex">
            {user?.role === "super_admin" ? "Platform Owner" : user?.role === "school_admin" ? "School Admin" : user?.role}
          </Pill>
        </p>
      </div>
    </div>
  );
}

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
  searchQuery,
  filterFn,
  onDeactivate,
  onReactivate,
  onEdit,
  renderItem,
}) {
  const filtered = useMemo(() => {
    const base = filterFn ? filterFn(items) : items;
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter((i) => i.name?.toLowerCase().includes(q));
  }, [items, searchQuery, filterFn]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, pageSize]);

  return (
    <div>
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
          {paged.map((item) =>
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
      {!loading && filtered.length > 0 && (
        <>
          <div className="flex items-center justify-between pt-2">
            <p className="text-[12px] text-slate-text/55">
              Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
            </p>
            <Select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="text-[12px]"
            >
              {[5, 10, 20].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </Select>
          </div>
          <Pagination page={safePage} pages={totalPages} onPage={setPage} info={false} />
        </>
      )}
    </div>
  );
}

export default function ManageSchool() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const school = useSelector(selectSchool);
  const [activeTab, setActiveTab] = useState("school-profile");
  const [items, setItems] = useState({
    classes: [],
    sections: [],
    subjects: [],
    "fee-types": [],
    "attendance-statuses": [],
    "leave-types": [],
    "notice-categories": [],
    "notice-audiences": [],
    "event-categories": [],
    "hostel-blocks": [],
  });
  const [loading, setLoading] = useState(true);
  const [customModal, setCustomModal] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      api.examMasters.list("classes"),
      api.examMasters.list("sections"),
      api.examMasters.list("subjects"),
      api.examMasters.list("fee-types"),
      api.examMasters.list("attendance-statuses"),
      api.examMasters.list("leave-types"),
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
      "leave-types": pick(5),
      "notice-categories": pick(6),
      "notice-audiences": pick(7),
      "event-categories": pick(8),
      "hostel-blocks": pick(9),
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
  const leaveTypeCount = items["leave-types"].filter((i) => isActiveItem(i)).length;
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
            "leave-types": leaveTypeCount,
            "notice-categories": noticeCategoryCount,
            "notice-audiences": noticeAudienceCount,
            "event-categories": eventCategoryCount,
            "hostel-blocks": hostelBlockCount,
          };
          return (
            <button
              key={t.key}
              onClick={() => {
                setActiveTab(t.key);
                setSearchQuery("");
              }}
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

      {activeTab === "school-profile" ? (
        <Card title="School Profile">
          <SchoolProfileForm school={school} user={user} onSave={(data) => dispatch(setSchoolAction(data))} />
        </Card>
      ) : (
        <Card
        title={tab?.label}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${(tab?.label || "").toLowerCase()}...`}
                className="w-52 pl-9 pr-8 py-2 rounded-lg border border-black/10 text-[13px] outline-none focus:border-ink/40 bg-white placeholder:text-slate-text/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-text/40 hover:text-ink"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <Button
              variant="amber"
              onClick={() =>
                setCustomModal({ kind: tab.kind, label: tab.singular })
              }
            >
              <Plus size={15} />
              Add {tab.singular}
            </Button>
          </div>
        }
      >
        <MasterList
          items={items[activeTab] || []}
          loading={loading}
          kind={activeTab}
          label={tab?.label}
          searchQuery={searchQuery}
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
      )}

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
