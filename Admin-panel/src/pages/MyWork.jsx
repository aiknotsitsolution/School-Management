import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import {
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowUpCircle,
  Briefcase,
  Inbox,
} from "lucide-react";
import { PageIntro, Card, Select, Input, Pill, StatCard, toast } from "../components/UI";

// Same four states the schema stores; mapped locally so the shared statusTone
// helper stays untouched for every other page.
const WORK_TONES = {
  Pending: "warning",
  "In Progress": "info",
  Completed: "success",
  Overdue: "alert",
};
const workTone = (status) => WORK_TONES[status] || "neutral";

const STATUS_OPTIONS = ["All", "Pending", "In Progress", "Completed", "Overdue"];
const TYPE_LABELS = { teaching: "Teaching", external: "External" };

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function normalizeItem(item) {
  const dueDate = item.dueDate;
  const isOverdue = dueDate && new Date(dueDate) < new Date() && item.status !== "Completed";
  const base = item.status || "Pending";
  return {
    ...item,
    id: item._id || item.id,
    priority: item.priority || "Medium",
    // Rows written before teaching/external was split carry no category.
    category: item.category || "external",
    // `status` is what gets DISPLAYED (a Pending row past its deadline reads
    // Overdue); `storedStatus` is what the select edits, so an on-time task
    // never renders an Overdue option it didn't have.
    storedStatus: base,
    status: isOverdue && base === "Pending" ? "Overdue" : base,
  };
}

export default function MyWork() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  useEffect(() => {
    let active = true;
    api.homework
      .mine()
      .then(({ data }) => {
        if (active) setItems((data || []).map(normalizeItem));
      })
      .catch((err) => {
        if (active) toast(err.message || "Couldn't load your work", "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const changeStatus = async (id, newStatus) => {
    const backup = items;
    setItems((prev) =>
      prev.map((h) => (h.id === id ? { ...h, storedStatus: newStatus, status: newStatus } : h))
    );
    try {
      await api.homework.updateMyStatus(id, newStatus);
    } catch (err) {
      setItems(backup);
      toast(err.message || "Couldn't update status", "error");
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((h) => {
        if (typeFilter !== "All" && h.category !== typeFilter) return false;
        if (statusFilter !== "All" && h.status !== statusFilter) return false;
        if (q) {
          const hay = [h.title, h.description, h.assignedBy, TYPE_LABELS[h.category]]
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
  }, [items, query, statusFilter, typeFilter]);

  const counts = useMemo(() => {
    const c = { total: items.length, Pending: 0, "In Progress": 0, Completed: 0, Overdue: 0 };
    items.forEach((h) => {
      if (c[h.status] !== undefined) c[h.status]++;
    });
    return c;
  }, [items]);

  const filtersActive = query.trim() !== "" || statusFilter !== "All" || typeFilter !== "All";

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="My Account"
        title="My Work"
        description="Everything assigned to you, with deadlines and progress in one place."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Briefcase}
          label="Total"
          value={String(counts.total)}
          sub="Assigned to me"
          accent="info"
        />
        <StatCard icon={Clock} label="Pending" value={String(counts.Pending)} sub="Not yet started" accent="primary" />
        <StatCard
          icon={ArrowUpCircle}
          label="In Progress"
          value={String(counts["In Progress"])}
          sub="Currently active"
          accent="info"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={String(counts.Completed)}
          sub={`${counts.Overdue} overdue`}
          accent="success"
        />
      </div>

      <Card title="Assigned Work">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
            />
            <Input
              placeholder="Search work..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="min-w-[130px]"
          >
            <option value="All">All types</option>
            <option value="teaching">Teaching</option>
            <option value="external">External</option>
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-w-[125px]"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All Status" : s}
              </option>
            ))}
          </Select>
          {filtersActive && (
            <button
              onClick={() => {
                setQuery("");
                setTypeFilter("All");
                setStatusFilter("All");
              }}
              className="text-[12.5px] font-semibold text-info hover:underline px-1"
            >
              Clear
            </button>
          )}
          <span className="text-[12.5px] text-slate-text/60 ml-auto">
            {filtered.length} {filtered.length === 1 ? "item" : "items"}
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[92px] rounded-xl bg-paper animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center">
            <Inbox size={36} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[14px] font-medium text-ink">
              {filtersActive ? "Nothing matches these filters" : "No work assigned yet"}
            </p>
            <p className="text-[13px] text-slate-text/60 mt-1">
              {filtersActive
                ? "Try widening the search or clearing the filters."
                : "Work assigned to you will show up here."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((h) => (
              <div
                key={h.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-paper/40 transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-info/15 text-info flex items-center justify-center shrink-0">
                  <Briefcase size={20} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-semibold text-ink">{h.title}</p>
                    <Pill tone={h.category === "teaching" ? "info" : "warning"}>
                      {TYPE_LABELS[h.category]}
                    </Pill>
                    <Pill tone={workTone(h.status)}>{h.status}</Pill>
                    <Pill
                      tone={
                        h.priority === "High" ? "alert" : h.priority === "Low" ? "success" : "info"
                      }
                    >
                      {h.priority}
                    </Pill>
                  </div>
                  {h.description && (
                    <p className="text-[13px] text-ink/70 mt-1 leading-snug line-clamp-2">
                      {h.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12px] text-slate-text/65">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={12} />{" "}
                      {h.dueDate ? `Due ${formatDate(h.dueDate)}` : "No deadline"}
                    </span>
                    {h.assignedBy && (
                      <span className="inline-flex items-center gap-1">From {h.assignedBy}</span>
                    )}
                  </div>
                </div>

                <Select
                  value={h.storedStatus}
                  onChange={(e) => changeStatus(h.id, e.target.value)}
                  className="text-[12px] py-1.5 min-w-[120px] shrink-0 sm:w-auto w-full"
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  {h.storedStatus === "Overdue" && <option value="Overdue">Overdue</option>}
                </Select>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
