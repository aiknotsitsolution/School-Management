import { useEffect, useMemo, useRef, useState } from "react";
import { Pin, Plus, X, Save, Pencil, Bell, Search, PinOff, ChevronDown } from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Input,
  Pill,
  StatCard,
  toast,
} from "../components/UI";
import { api } from "../lib/api";
import { invalidateMasterCache } from "../lib/masterCache";

const initialNotices = [];

const CATEGORIES = [
  "Academic",
  "Holiday",
  "Sports",
  "Fees",
  "Event",
  "Transport",
  "General",
];

const AUDIENCE_OPTIONS = [
  "All",
  "All Parents",
  "All Staff",
  "Classes 1–5 Parents",
  "Classes 6–8 Parents",
  "Classes 9–12 Parents",
  "Classes 3–10",
  "Transport Users",
];

const categoryTone = {
  Academic: "info",
  Holiday: "success",
  Sports: "amber",
  Fees: "alert",
  Event: "info",
  Transport: "neutral",
  General: "neutral",
};

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function emptyForm() {
  return {
    title: "",
    category: "Academic",
    date: new Date().toISOString().slice(0, 10),
    audience: "All",
    body: "",
    pinned: false,
  };
}

function normalizeNotice(notice) {
  return {
    ...notice,
    id: notice._id || notice.id,
    category: notice.category || "General",
    date: notice.expiryDate || notice.createdAt,
    audience: Array.isArray(notice.audience)
      ? notice.audience.join(", ")
      : notice.audience || "All",
    body: notice.description || notice.body || "",
    pinned: Boolean(notice.pinned),
  };
}

const audienceValues = {
  All: ["all"],
  "All Parents": ["parent"],
  "All Staff": ["admin", "teacher"],
  "Classes 1–5 Parents": ["parent"],
  "Classes 6–8 Parents": ["parent"],
  "Classes 9–12 Parents": ["parent"],
  "Classes 3–10": ["all"],
  "Transport Users": ["all"],
};

// Preset audiences map to backend role tags; custom ones are stored verbatim so
// each card keeps showing the label the admin chose.
const resolveAudience = (label) => audienceValues[label] || [String(label).trim()];

// Searchable dropdown with an "add custom" action. Falls back to a simple
// combination of the preset list plus any custom values already picked.
function SearchableSelect({ options, value, onChange, placeholder, onAddCustom }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const boxRef = useRef(null);

  const all = useMemo(
    () => [...new Set([...options, ...custom])],
    [options, custom],
  );

  const q = query.trim().toLowerCase();
  const matches = q
    ? all.filter((o) => String(o).toLowerCase().includes(q))
    : all;
  const exactMatch = all.some((o) => String(o).toLowerCase() === q);
  const canAdd = q.length > 0 && !exactMatch;

  useEffect(() => {
    setActiveIndex(matches.length > 0 ? 0 : -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (canAdd && activeIndex === matches.length) {
          commit(q, true);
        } else if (activeIndex >= 0 && matches[activeIndex]) {
          commit(String(matches[activeIndex]));
        }
      }
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, matches, canAdd, activeIndex]);

  const commit = async (value, isCustom = false) => {
    if (!value) return;
    if (isCustom) {
      try {
        await onAddCustom?.(value);
      } catch {
        // Keep the typed value even if persistence fails (dup / no permission).
      }
    }
    setCustom((prev) => (prev.includes(value) ? prev : [...prev, value]));
    onChange(value);
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-black/10 bg-white text-[13.5px] text-ink outline-none transition-all hover:border-black/20 focus:border-amber focus:ring-4 focus:ring-amber/15"
      >
        <span className={value ? "" : "text-slate-text/60"}>
          {value || placeholder || "Select an option"}
        </span>
        <ChevronDown
          size={16}
          className={`text-slate-text/50 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full bg-white rounded-xl border border-black/10 shadow-lg shadow-black/5 overflow-hidden">
          <div className="relative p-2 border-b border-black/[0.06]">
            <Search
              size={14}
              className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-text/40"
            />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or type a new value…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-paper border border-black/[0.06] text-[13px] outline-none focus:border-amber/50"
            />
          </div>

          <ul className="max-h-52 overflow-y-auto py-1">
            {matches.map((opt, i) => (
              <li key={String(opt)}>
                <button
                  type="button"
                  onClick={() => commit(opt)}
                  className={`w-full text-left px-3.5 py-2 text-[13px] transition-colors ${
                    i === activeIndex ? "bg-amber/10 text-ink" : "text-ink hover:bg-paper"
                  }`}
                >
                  {String(opt)}
                  {String(opt).toLowerCase() === q && (
                    <span className="ml-1.5 text-[11px] text-amber-dark font-medium">(custom)</span>
                  )}
                </button>
              </li>
            ))}

            {canAdd && (
              <li>
                <button
                  type="button"
                  onClick={() => commit(query.trim(), true)}
                  className={`w-full text-left px-3.5 py-2 text-[13px] text-amber-dark font-medium hover:bg-amber/10 transition-colors ${
                    activeIndex === matches.length ? "bg-amber/10" : ""
                  }`}
                >
                  + Add "{query.trim()}"
                </button>
              </li>
            )}

            {matches.length === 0 && !canAdd && (
              <li className="px-3.5 py-2 text-[12.5px] text-slate-text/60">
                No matches. Type to add a custom value.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function NoticeBoard() {
  const [notices, setNotices] = useState(initialNotices);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [masterCategories, setMasterCategories] = useState([]);
  const [masterAudiences, setMasterAudiences] = useState([]);

  useEffect(() => {
    Promise.allSettled([
      api.examMasters.list("notice-categories"),
      api.examMasters.list("notice-audiences"),
    ])
      .then(([cats, auds]) => {
        if (cats.status === "fulfilled")
          setMasterCategories(cats.value?.data || []);
        if (auds.status === "fulfilled")
          setMasterAudiences(auds.value?.data || []);
      })
      .catch(() => {});
  }, []);

  const categoryOptions = useMemo(
    () => [...new Set([...CATEGORIES, ...masterCategories.map((m) => m.name)])],
    [masterCategories],
  );

  const audienceOptions = useMemo(
    () => [...new Set([...AUDIENCE_OPTIONS, ...masterAudiences.map((m) => m.name)])],
    [masterAudiences],
  );

  const addMasterCategory = async (value) => {
    try {
      const { data } = await api.examMasters.create("notice-categories", {
        name: value,
      });
      invalidateMasterCache("notice-categories");
      setMasterCategories((prev) =>
        prev.some((m) => m.key === data.key || m.name === data.name)
          ? prev
          : [...prev, data],
      );
    } catch {
      // Duplicate / missing permission: keep the typed value locally.
    }
  };

  const addMasterAudience = async (value) => {
    try {
      const { data } = await api.examMasters.create("notice-audiences", {
        name: value,
      });
      invalidateMasterCache("notice-audiences");
      setMasterAudiences((prev) =>
        prev.some((m) => m.key === data.key || m.name === data.name)
          ? prev
          : [...prev, data],
      );
    } catch {
      // Duplicate / missing permission: keep the typed value locally.
    }
  };

  useEffect(() => {
    api.notices
      .list()
      .then(({ data }) => setNotices((data || []).map(normalizeNotice)))
      .catch((e) => setError(e.message));
  }, []);

  const cats = useMemo(
    () => ["All", ...new Set(notices.map((n) => n.category))],
    [notices],
  );

  const filtered = useMemo(() => {
    return notices
      .filter((n) => {
        const matchCat = filter === "All" || n.category === filter;
        const q = query.toLowerCase();
        const matchQuery =
          !q ||
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q) ||
          n.audience.toLowerCase().includes(q);
        return matchCat && matchQuery;
      })
      .sort((a, b) => {
        // Pinned first, then by date desc
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.date) - new Date(a.date);
      });
  }, [notices, filter, query]);

  const stats = useMemo(() => {
    const pinned = notices.filter((n) => n.pinned).length;
    const thisMonth = notices.filter((n) => {
      const d = new Date(n.date);
      const now = new Date();
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    }).length;
    return {
      total: notices.length,
      pinned,
      thisMonth,
      categories: new Set(notices.map((n) => n.category)).size,
    };
  }, [notices]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (n) => {
    setEditId(n.id);
    setForm({
      title: n.title,
      category: n.category,
      date: n.date,
      audience: n.audience,
      body: n.body,
      pinned: n.pinned,
    });
    setShowModal(true);
  };

  const updateForm = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    try {
      if (editId) await api.notices.remove(editId);
      const { data } = await api.notices.create({
        title: form.title.trim(),
        description: form.body.trim(),
        category: form.category,
        pinned: form.pinned,
        audience: resolveAudience(form.audience),
        expiryDate: form.date,
      });
      setNotices((prev) => [
        normalizeNotice(data),
        ...prev.filter((notice) => (notice._id || notice.id) !== editId),
      ]);
      setShowModal(false);
      setForm(emptyForm());
      setEditId(null);
      toast(editId ? "Notice updated" : "Notice posted");
    } catch (e) {
      setError(e.message);
    }
  };

  const togglePin = async (id) => {
    const notice = notices.find((item) => (item._id || item.id) === id);
    if (!notice) return;
    try {
      await api.notices.remove(id);
      const { data } = await api.notices.create({
        title: notice.title,
        description: notice.body,
        category: notice.category,
        pinned: !notice.pinned,
        audience: resolveAudience(notice.audience),
        expiryDate: notice.date,
      });
      setNotices((prev) =>
        prev.map((item) =>
          (item._id || item.id) === id ? normalizeNotice(data) : item,
        ),
      );
      toast(notice.pinned ? "Notice unpinned" : "Notice pinned");
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.notices.remove(id);
      setNotices((prev) => prev.filter((n) => (n._id || n.id) !== id));
      toast("Notice deleted");
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Admissions & Outreach"
        title="Notice Board"
        description="Official circulars and announcements for students, parents and staff."
        right={
          <Button variant="amber" onClick={openAdd}>
            <Plus size={15} /> Post Notice
          </Button>
        }
      />
      {error && (
        <p className="text-alert text-[13px]">Backend unavailable: {error}</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Bell}
          label="Total Notices"
          value={String(stats.total)}
          sub="All categories"
          accent="info"
        />
        <StatCard
          icon={Pin}
          label="Pinned"
          value={String(stats.pinned)}
          sub="Shown at top"
          accent="amber"
        />
        <StatCard
          icon={Bell}
          label="This Month"
          value={String(stats.thisMonth)}
          sub="Current month"
          accent="success"
        />
        <StatCard
          icon={Bell}
          label="Categories"
          value={String(stats.categories)}
          sub="Active types"
          accent="info"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
          />
          <Input
            placeholder="Search notices..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors ${
                filter === c
                  ? "bg-ink text-white border-ink"
                  : "bg-white text-slate-text border-black/10 hover:border-ink/30"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Notice cards */}
      {filtered.length === 0 ? (
        <Card>
          <div className="py-14 text-center">
            <Bell size={36} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[14px] font-medium text-ink">No notices found</p>
            <p className="text-[13px] text-slate-text/60 mt-1">
              Try a different filter or post a new notice.
            </p>
            <Button variant="amber" className="mt-4" onClick={openAdd}>
              <Plus size={15} /> Post Notice
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((n) => (
            <Card key={n.id} className={n.pinned ? "ring-1 ring-amber/30" : ""}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Pill tone={categoryTone[n.category] || "neutral"}>
                    {n.category}
                  </Pill>
                  {n.pinned && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-dark">
                      <Pin size={12} fill="#E8A33D" /> Pinned
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => togglePin(n.id)}
                    title={n.pinned ? "Unpin" : "Pin"}
                    className="p-1.5 rounded-lg hover:bg-paper text-slate-text/60 hover:text-amber-dark transition-colors"
                  >
                    {n.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                  </button>
                  <button
                    onClick={() => openEdit(n)}
                    className="p-1.5 rounded-lg hover:bg-paper text-slate-text/60 hover:text-info transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              </div>

              <h3 className="font-display font-bold text-ink text-[15.5px] leading-snug">
                {n.title}
              </h3>
              <p className="text-[13px] text-slate-text mt-2 leading-relaxed line-clamp-4">
                {n.body}
              </p>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-black/[0.06] text-[11.5px] text-slate-text/60">
                <span>For: {n.audience}</span>
                <span>{formatDate(n.date)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ========== POST / EDIT MODAL ========== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <div>
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  {editId ? "Edit Notice" : "Post Notice"}
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  Create an official circular or announcement.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Title *
                </label>
                <Input
                  placeholder="Notice title"
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Category
                  </label>
                  <SearchableSelect
                    options={categoryOptions}
                    value={form.category}
                    onChange={(v) => updateForm("category", v)}
                    placeholder="Select category"
                    onAddCustom={addMasterCategory}
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Date
                  </label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => updateForm("date", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Audience
                </label>
                <SearchableSelect
                  options={audienceOptions}
                  value={form.audience}
                  onChange={(v) => updateForm("audience", v)}
                  placeholder="Select audience"
                  onAddCustom={addMasterAudience}
                />
              </div>

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Body *
                </label>
                <textarea
                  rows={5}
                  placeholder="Write the full notice..."
                  value={form.body}
                  onChange={(e) => updateForm("body", e.target.value)}
                  className="w-full rounded-lg border border-black/10 p-3 text-[13px] outline-none focus:border-ink/40 resize-none"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={(e) => updateForm("pinned", e.target.checked)}
                  className="accent-amber w-4 h-4"
                />
                <span className="text-[13px] font-medium text-ink">
                  Pin this notice (show at top)
                </span>
              </label>
            </div>

            <div className="px-5 py-4 border-t border-black/[0.06] flex justify-between gap-2">
              <div>
                {editId && (
                  <Button
                    variant="outline"
                    className="text-alert border-alert/30 hover:bg-alert/5"
                    onClick={() => {
                      handleDelete(editId);
                      setShowModal(false);
                    }}
                  >
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="amber"
                  onClick={handleSave}
                  disabled={!form.title.trim() || !form.body.trim()}
                >
                  <Save size={15} /> {editId ? "Update" : "Post"} Notice
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// import { useState } from "react";
// import { Pin, Plus } from "lucide-react";
// import { PageIntro, Card, Button, Pill } from "../components/UI";

// const categoryTone = { Academic: "info", Holiday: "success", Sports: "amber", Fees: "alert", Event: "info", Transport: "neutral" };

// export default function NoticeBoard() {
//   const [filter, setFilter] = useState("All");
//   const cats = ["All", ...new Set(notices.map((n) => n.category))];
//   const filtered = filter === "All" ? notices : notices.filter((n) => n.category === filter);

//   return (
//     <div className="space-y-6">
//       <PageIntro
//         eyebrow="Admissions & Outreach"
//         title="Notice Board"
//         description="Official circulars and announcements for students, parents and staff."
//         right={<Button variant="amber"><Plus size={15} /> Post Notice</Button>}
//       />

//       <div className="flex gap-2 flex-wrap">
//         {cats.map((c) => (
//           <button
//             key={c}
//             onClick={() => setFilter(c)}
//             className={`px-4 py-2 rounded-full text-[12.5px] font-semibold border transition-colors ${
//               filter === c ? "bg-ink text-white border-ink" : "bg-white text-slate-text border-black/10 hover:border-ink/30"
//             }`}
//           >
//             {c}
//           </button>
//         ))}
//       </div>

//       <div className="grid md:grid-cols-2 gap-4">
//         {filtered.map((n) => (
//           <Card key={n.id}>
//             <div className="flex items-start justify-between mb-2">
//               <Pill tone={categoryTone[n.category] || "neutral"}>{n.category}</Pill>
//               {n.pinned && <Pin size={14} className="text-amber-dark" fill="#E8A33D" />}
//             </div>
//             <h3 className="font-display font-bold text-ink text-[15.5px] leading-snug">{n.title}</h3>
//             <p className="text-[13px] text-slate-text mt-2 leading-relaxed">{n.body}</p>
//             <div className="flex items-center justify-between mt-4 pt-3 border-t border-black/[0.06] text-[11.5px] text-slate-text/60">
//               <span>For: {n.audience}</span>
//               <span>{n.date}</span>
//             </div>
//           </Card>
//         ))}
//       </div>
//     </div>
//   );
// }
