import { useState, useEffect } from "react";
import { BookOpen, FileText, Download, ExternalLink, Search, Filter } from "lucide-react";
import { PageIntro, Card, Pill, Button } from "../../components/UI";
import { api } from "../../lib/api";

const TYPE_CONFIG = {
  notes: { label: "Notes", bg: "bg-blue-50", text: "text-blue-600", icon: FileText },
  worksheet: { label: "Worksheet", bg: "bg-purple-50", text: "text-purple-600", icon: FileText },
  video: { label: "Video", bg: "bg-red-50", text: "text-red-600", icon: ExternalLink },
  link: { label: "Link", bg: "bg-amber-50", text: "text-amber-600", icon: ExternalLink },
  other: { label: "Other", bg: "bg-slate-50", text: "text-slate-600", icon: FileText },
};

export default function StudyMaterials() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterType, setFilterType] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.studyMaterials.list();
      setMaterials(res.data?.data || []);
    } catch (err) {
      setError(err.message || "Failed to load study materials");
    } finally {
      setLoading(false);
    }
  };

  const subjects = [...new Set(materials.map((m) => m.subject))].sort();

  const filtered = materials.filter((m) => {
    if (search && !m.title.toLowerCase().includes(search.toLowerCase()) && !m.subject.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSubject && m.subject !== filterSubject) return false;
    if (filterType && m.type !== filterType) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Learning"
        title="Study Materials"
        description="Access notes, worksheets and study resources shared by your teachers."
      />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/25" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search materials..."
              className="w-full pl-9 pr-3 py-2 text-[13px] rounded-xl border border-ink/10 bg-white focus:outline-none focus:border-amber-400"
            />
          </div>
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="px-3 py-2 text-[13px] rounded-xl border border-ink/10 bg-white focus:outline-none focus:border-amber-400"
          >
            <option value="">All Subjects</option>
            {subjects.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 text-[13px] rounded-xl border border-ink/10 bg-white focus:outline-none focus:border-amber-400"
          >
            <option value="">All Types</option>
            {Object.entries(TYPE_CONFIG).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>
      </Card>

      {error && (
        <Card>
          <div className="py-10 text-center">
            <p className="text-[13px] text-red-500">{error}</p>
            <Button onClick={fetchMaterials} className="mt-3" size="sm">Retry</Button>
          </div>
        </Card>
      )}

      {!error && loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <div className="animate-pulse space-y-3 p-1">
                <div className="h-4 bg-ink/5 rounded w-1/3" />
                <div className="h-5 bg-ink/5 rounded w-3/4" />
                <div className="h-3 bg-ink/5 rounded w-full" />
                <div className="h-3 bg-ink/5 rounded w-2/3" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {!error && !loading && filtered.length === 0 && (
        <Card>
          <div className="py-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-ink/[0.04] flex items-center justify-center mx-auto mb-3">
              <BookOpen size={24} className="text-slate-text/30" />
            </div>
            <p className="text-[14px] font-semibold text-ink">
              {materials.length === 0 ? "No materials yet" : "No matches found"}
            </p>
            <p className="text-[12.5px] text-slate-text/60 mt-1 max-w-xs mx-auto">
              {materials.length === 0
                ? "Your teacher will upload notes and worksheets here."
                : "Try adjusting your search or filters."}
            </p>
          </div>
        </Card>
      )}

      {!error && !loading && filtered.length > 0 && (
        <>
          <p className="text-[12px] text-ink/40 font-medium">
            {filtered.length} material{filtered.length !== 1 ? "s" : ""} found
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => {
              const cfg = TYPE_CONFIG[m.type] || TYPE_CONFIG.other;
              const Icon = cfg.icon;
              return (
                <Card key={m._id} className="flex flex-col">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                      <Icon size={18} className={cfg.text} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-ink truncate">{m.title}</p>
                      <p className="text-[12px] text-ink/45 mt-0.5">{m.subject} · {m.class}{m.section ? ` ${m.section}` : ""}</p>
                    </div>
                    <Pill className={`text-[10px] ${cfg.bg} ${cfg.text} border-0`}>{cfg.label}</Pill>
                  </div>
                  {m.description && (
                    <p className="text-[12px] text-ink/50 mt-3 line-clamp-2">{m.description}</p>
                  )}
                  <div className="mt-auto pt-3 flex items-center gap-2">
                    {m.fileUrl && (
                      <a
                        href={m.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                      >
                        <Download size={13} />
                        Download
                      </a>
                    )}
                    {m.linkUrl && (
                      <a
                        href={m.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        <ExternalLink size={13} />
                        Open Link
                      </a>
                    )}
                    <span className="ml-auto text-[10.5px] text-ink/30">
                      {new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
