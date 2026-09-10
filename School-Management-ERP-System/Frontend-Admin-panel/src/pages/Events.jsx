import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  MapPin,
  Clock,
  X,
  Save,
  Pencil,
  CalendarDays,
  Search,
  PartyPopper,
  ChevronDown,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Input,
  Pill,
  StatCard,
} from "../components/UI";
import ImageDropzone from "../components/upload/ImageDropzone";
import { api } from "../lib/api";
const initialEvents = [];

const CATEGORIES = [
  "Sports",
  "National",
  "Academic",
  "Cultural",
  "Holiday",
  "Meeting",
  "Other",
];

const categoryTone = {
  Sports: "success",
  National: "alert",
  Academic: "info",
  Cultural: "amber",
  Holiday: "neutral",
  Meeting: "info",
  Other: "neutral",
};

// Default images by category (Unsplash)
const CATEGORY_IMAGES = {
  Sports:
    "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&h=500&fit=crop",
  National:
    "https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=800&h=500&fit=crop",
  Academic:
    "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&h=500&fit=crop",
  Cultural:
    "https://images.unsplash.com/photo-1503095396549-807759245b35?w=800&h=500&fit=crop",
  Holiday:
    "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=800&h=500&fit=crop",
  Meeting:
    "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=800&h=500&fit=crop",
  Other:
    "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=500&fit=crop",
};

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    weekday: "short",
  });
}

function normalizeEvent(event) {
  return {
    ...event,
    id: event._id || event.id,
    category: event.category || "Other",
    time: event.time || "—",
    venue: event.venue || "Venue to be announced",
    image:
      event.image || CATEGORY_IMAGES[event.category] || CATEGORY_IMAGES.Other,
  };
}

// Searchable dropdown with an "add custom" action. Falls back to the preset
// list plus any custom values already picked in this session.
function SearchableSelect({ options, value, onChange, placeholder }) {
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
          commit(q);
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

  const commit = (value) => {
    if (!value) return;
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
                  onClick={() => commit(query.trim())}
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

function emptyForm() {
  return {
    title: "",
    date: "",
    time: "9:00 AM",
    venue: "",
    category: "Academic",
    image: "",
    imageFile: null,
  };
}

export default function Events() {
  const [events, setEvents] = useState(initialEvents);
  useEffect(() => {
    api.events
      .list()
      .then(({ data }) => setEvents((data || []).map(normalizeEvent)))
      .catch(() => {});
  }, []);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("upcoming"); // upcoming | past | all
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cats = useMemo(
    () => ["All", ...new Set(events.map((e) => e.category))],
    [events],
  );

  const filtered = useMemo(() => {
    return events
      .filter((e) => {
        const matchCat = filter === "All" || e.category === filter;
        const q = query.toLowerCase();
        const matchQuery =
          !q ||
          e.title.toLowerCase().includes(q) ||
          e.venue.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q);

        const eventDate = new Date(e.date);
        eventDate.setHours(0, 0, 0, 0);
        const isUpcoming = eventDate >= today;
        const matchView =
          view === "all" ||
          (view === "upcoming" && isUpcoming) ||
          (view === "past" && !isUpcoming);

        return matchCat && matchQuery && matchView;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [events, filter, query, view]);

  const stats = useMemo(() => {
    const upcoming = events.filter((e) => new Date(e.date) >= today).length;
    const past = events.length - upcoming;
    const thisMonth = events.filter((e) => {
      const d = new Date(e.date);
      return (
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    }).length;
    return {
      total: events.length,
      upcoming,
      past,
      thisMonth,
    };
  }, [events]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (e) => {
    setEditId(e.id);
    setForm({
      title: e.title,
      date: e.date,
      time: e.time,
      venue: e.venue,
      category: e.category,
      image: e.image || "",
      imageFile: null,
    });
    setShowModal(true);
  };

  const updateForm = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.date) return;

    let image =
      form.image || CATEGORY_IMAGES[form.category] || CATEGORY_IMAGES.Other;

    try {
      if (form.imageFile) {
        const uploadResponse = await api.events.uploadImage(form.imageFile);
        image = uploadResponse.data.url;
      }
      const payload = {
        title: form.title.trim(),
        description: form.category,
        category: form.category,
        time: form.time,
        image,
        date: form.date,
        venue: form.venue,
        audience: ["all"],
      };
      const response = editId
        ? await api.events.update(editId, payload)
        : await api.events.create(payload);
      const savedEvent = normalizeEvent(response.data);
      setEvents((prev) =>
        editId
          ? prev.map((event) => (event.id === editId ? savedEvent : event))
          : [savedEvent, ...prev],
      );
      setShowModal(false);
      setForm(emptyForm());
      setEditId(null);
    } catch (requestError) {
      window.alert(requestError.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.events.remove(id);
      setEvents((prev) => prev.filter((event) => event.id !== id));
    } catch (requestError) {
      window.alert(requestError.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Admissions & Outreach"
        title="Events"
        description="Upcoming school events, celebrations and important dates."
        right={
          <Button variant="amber" onClick={openAdd}>
            <Plus size={15} /> Create Event
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={PartyPopper}
          label="Total Events"
          value={String(stats.total)}
          sub="All time"
          accent="info"
        />
        <StatCard
          icon={CalendarDays}
          label="Upcoming"
          value={String(stats.upcoming)}
          sub="From today"
          accent="success"
        />
        <StatCard
          icon={Clock}
          label="This Month"
          value={String(stats.thisMonth)}
          sub="Current month"
          accent="amber"
        />
        <StatCard
          icon={CalendarDays}
          label="Past Events"
          value={String(stats.past)}
          sub="Completed"
          accent="neutral"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
          />
          <Input
            placeholder="Search events..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex gap-1.5">
          {[
            { key: "upcoming", label: "Upcoming" },
            { key: "past", label: "Past" },
            { key: "all", label: "All" },
          ].map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors ${
                view === v.key
                  ? "bg-ink text-white border-ink"
                  : "bg-white text-slate-text border-black/10 hover:border-ink/30"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                filter === c
                  ? "bg-amber/20 text-amber-dark border-amber/40"
                  : "bg-white text-slate-text border-black/10 hover:border-ink/20"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Event cards */}
      {filtered.length === 0 ? (
        <Card>
          <div className="py-14 text-center">
            <PartyPopper
              size={36}
              className="mx-auto text-slate-text/30 mb-3"
            />
            <p className="text-[14px] font-medium text-ink">No events found</p>
            <p className="text-[13px] text-slate-text/60 mt-1">
              Try different filters or create a new event.
            </p>
            <Button variant="amber" className="mt-4" onClick={openAdd}>
              <Plus size={15} /> Create Event
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((e) => {
            const isPast = new Date(e.date) < today;
            return (
              <Card
                key={e.id}
                className="overflow-hidden group"
                bodyClassName="p-0"
              >
                <div className="relative">
                  <img
                    src={e.image}
                    alt={e.title}
                    className="w-full h-40 object-cover"
                  />
                  {isPast && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-ink/70 text-white text-[11px] font-semibold">
                      Past
                    </span>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(e)}
                      className="p-1.5 rounded-lg bg-white/90 text-ink hover:bg-white shadow-sm"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <Pill tone={categoryTone[e.category] || "neutral"}>
                    {e.category}
                  </Pill>
                  <h3 className="font-display font-bold text-ink text-[15.5px] mt-2 leading-snug">
                    {e.title}
                  </h3>
                  <div className="mt-3 space-y-1.5 text-[12.5px] text-slate-text">
                    <p className="flex items-center gap-1.5">
                      <Clock size={13} className="text-slate-text/50" />
                      {formatDate(e.date)} · {e.time}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin size={13} className="text-slate-text/50" />
                      {e.venue || "—"}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ========== CREATE / EDIT MODAL ========== */}
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
                  {editId ? "Edit Event" : "Create Event"}
                </h3>
                <p className="text-[12.5px] text-slate-text/70 mt-0.5">
                  Add school event details.
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
                  placeholder="Event title"
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Date *
                  </label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => updateForm("date", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Time
                  </label>
                  <Input
                    placeholder="e.g. 9:00 AM"
                    value={form.time}
                    onChange={(e) => updateForm("time", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Venue
                </label>
                <Input
                  placeholder="e.g. Main Auditorium"
                  value={form.venue}
                  onChange={(e) => updateForm("venue", e.target.value)}
                />
              </div>

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Category
                </label>
                <SearchableSelect
                  options={CATEGORIES}
                  value={form.category}
                  onChange={(v) => updateForm("category", v)}
                  placeholder="Select a category"
                />
              </div>

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Image (optional)
                </label>
                {form.imageFile || !form.image ? (
                  <ImageDropzone
                    value={form.imageFile}
                    onChange={(file) => updateForm("imageFile", file)}
                    helperText="JPG, JPEG, PNG, GIF, WEBP · Max 5 MB · Leave empty for a default category image"
                  />
                ) : (
                  <div className="rounded-xl border border-black/10 overflow-hidden">
                    <img
                      src={form.image}
                      alt=""
                      className="w-full h-36 object-cover"
                    />
                    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-paper">
                      <span className="text-[11.5px] text-slate-text/70 truncate">
                        Current image
                      </span>
                      <button
                        type="button"
                        onClick={() => updateForm("image", "")}
                        className="shrink-0 text-[12px] font-semibold text-amber-dark hover:underline"
                      >
                        Upload a new image
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
                  disabled={!form.title.trim() || !form.date}
                >
                  <Save size={15} /> {editId ? "Update" : "Create"} Event
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// import { Plus, MapPin, Clock } from "lucide-react";
// import { PageIntro, Card, Button, Pill } from "../components/UI";

// export default function Events() {
//   return (
//     <div className="space-y-6">
//       <PageIntro
//         eyebrow="Admissions & Outreach"
//         title="Events"
//         description="Upcoming school events, celebrations and important dates."
//         right={<Button variant="amber"><Plus size={15} /> Create Event</Button>}
//       />

//       <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
//         {events.map((e) => (
//           <Card key={e.id} className="overflow-hidden" bodyClassName="p-0">
//             <img src={e.image} alt={e.title} className="w-full h-40 object-cover" />
//             <div className="p-4">
//               <Pill tone="amber">{e.category}</Pill>
//               <h3 className="font-display font-bold text-ink text-[15.5px] mt-2 leading-snug">{e.title}</h3>
//               <div className="mt-3 space-y-1.5 text-[12.5px] text-slate-text">
//                 <p className="flex items-center gap-1.5"><Clock size={13} /> {e.date} · {e.time}</p>
//                 <p className="flex items-center gap-1.5"><MapPin size={13} /> {e.venue}</p>
//               </div>
//             </div>
//           </Card>
//         ))}
//       </div>
//     </div>
//   );
// }
