import { useEffect, useState } from "react";
import { BookOpenCheck, Download, ExternalLink, FileText, Search } from "lucide-react";
import { Card, Pill, Button } from "../UI";
import PageArtwork from "../PageArtwork";
import { api } from "../../lib/api";
import { isPdfUrl } from "../../lib/pdfjs";
import PdfReader from "./PdfReader";

const TYPE_CONFIG = {
  notes: { label: "Notes", bg: "bg-blue-50", text: "text-blue-600", icon: FileText },
  worksheet: { label: "Worksheet", bg: "bg-purple-50", text: "text-purple-600", icon: FileText },
  ebook: { label: "E-Book", bg: "bg-emerald-50", text: "text-emerald-600", icon: BookOpenCheck },
  video: { label: "Video", bg: "bg-red-50", text: "text-red-600", icon: ExternalLink },
  link: { label: "Link", bg: "bg-amber-50", text: "text-amber-600", icon: ExternalLink },
  other: { label: "Other", bg: "bg-slate-50", text: "text-slate-600", icon: FileText },
};

// Student-facing Library shelf: browse class materials, read PDFs in the
// in-app reader, download files or open external links. Rendered inside
// My Library's "Study Materials" tab and by /student/study-materials.
export default function StudentMaterialsPanel() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterType, setFilterType] = useState("");
  const [error, setError] = useState(null);
  const [reading, setReading] = useState(null); // { src, title }

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.studyMaterials.list("limit=100");
      setMaterials(res.data || []);
    } catch (err) {
      setError(err.message || "Failed to load study materials");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const subjects = [...new Set(materials.map((m) => m.subject))].sort();

  const filtered = materials.filter((m) => {
    if (search && !m.title.toLowerCase().includes(search.toLowerCase()) && !m.subject.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSubject && m.subject !== filterSubject) return false;
    if (filterType && m.type !== filterType) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/25" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search materials..."
              className="w-full pl-9 pr-3 py-2 text-[13px] rounded-xl border border-ink/10 bg-white focus:outline-none focus:border-primary"
            />
          </div>
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="px-3 py-2 text-[13px] rounded-xl border border-ink/10 bg-white focus:outline-none focus:border-primary"
          >
            <option value="">All Subjects</option>
            {subjects.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 text-[13px] rounded-xl border border-ink/10 bg-white focus:outline-none focus:border-primary"
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
            <PageArtwork name="library" size={64} className="mx-auto mb-4" />
            <p className="text-[14px] font-semibold text-ink">
              {materials.length === 0 ? "No materials yet" : "No matches found"}
            </p>
            <p className="text-[12.5px] text-slate-text/80 mt-1 max-w-xs mx-auto">
              {materials.length === 0
                ? "Your teacher will upload notes, worksheets and e-books here."
                : "Try adjusting your search or filters."}
            </p>
          </div>
        </Card>
      )}

      {!error && !loading && filtered.length > 0 && (
        <>
          <p className="text-[12px] text-ink/65 font-medium">
            {filtered.length} material{filtered.length !== 1 ? "s" : ""} found
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => {
              const cfg = TYPE_CONFIG[m.type] || TYPE_CONFIG.other;
              const Icon = cfg.icon;
              const readable = Boolean(m.fileUrl) && isPdfUrl(m.fileUrl, m.fileName);
              return (
                <Card key={m._id} className="flex flex-col">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                      <Icon size={18} className={cfg.text} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-ink truncate">{m.title}</p>
                      <p className="text-[12px] text-ink/65 mt-0.5">{m.subject} · {m.class}{m.section ? ` ${m.section}` : ""}</p>
                    </div>
                    <Pill className={`text-[10px] ${cfg.bg} ${cfg.text} border-0`}>{cfg.label}</Pill>
                  </div>
                  {m.description && (
                    <p className="text-[12px] text-ink/70 mt-3 line-clamp-2">{m.description}</p>
                  )}
                  {(m.pageCount || m.fileSize) && (
                    <p className="text-[11px] text-ink/65 mt-1.5">
                      {m.fileName || ""}
                      {m.pageCount ? ` · ${m.pageCount} pages` : ""}
                    </p>
                  )}
                  <div className="mt-auto pt-3 flex items-center gap-2">
                    {readable && (
                      <button
                        onClick={() => setReading({ src: m.fileUrl, title: m.title })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        <BookOpenCheck size={13} />
                        Read
                      </button>
                    )}
                    {m.fileUrl && !readable && (
                      <a
                        href={m.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                      >
                        <Download size={13} />
                        Open
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
                    <span className="ml-auto text-[10.5px] text-ink/65">
                      {new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {reading && (
        <PdfReader src={reading.src} title={reading.title} onClose={() => setReading(null)} />
      )}
    </div>
  );
}
