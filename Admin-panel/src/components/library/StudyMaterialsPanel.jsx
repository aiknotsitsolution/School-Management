import { useCallback, useEffect, useState } from "react";
import { BookOpenCheck, FileText, Pencil, Plus, RefreshCw, Search, Trash2, Upload, X } from "lucide-react";
import { Card, Button, Input, Select, Pill, toast } from "../UI";
import { Pagination } from "../Pagination";
import { LoadingBlock, EmptyBlock, ErrorBlock } from "../StateViews";
import { usePermission } from "../../lib/permissions";
import { useMasterOptions } from "../../hooks/useMasterOptions";
import { api } from "../../lib/api";
import { isPdfUrl, readPdfPageCount } from "../../lib/pdfjs";
import PdfReader from "./PdfReader";

const TYPES = ["notes", "worksheet", "ebook", "video", "link", "other"];
const TYPE_TONES = {
  notes: "info",
  worksheet: "primary",
  ebook: "success",
  video: "alert",
  link: "success",
  other: "neutral",
};

const MAX_FILE = 10 * 1024 * 1024;

const EMPTY_FORM = {
  title: "",
  description: "",
  subject: "",
  class: "",
  section: "",
  type: "notes",
  linkUrl: "",
  file: null,
  fileUrl: "",
  fileName: "",
  fileSize: null,
  pageCount: null,
};

const fmtSize = (bytes) => {
  if (!bytes) return "";
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

// The Library's "Study Materials" surface (admin/teacher): class-wise table
// with PDF/image upload, edit, delete and an in-app reader for PDFs. Rendered
// inside the Library page tabs and by the standalone /study-materials route.
export default function StudyMaterialsPanel() {
  const canWrite = usePermission("homework:write");

  const { options: classOptions } = useMasterOptions("classes", []);
  const { options: subjectOptions } = useMasterOptions("subjects", []);
  // Sections repeat across classes in the master catalog ("A" exists for every
  // class), so dedupe or the <option key> list renders duplicates and React
  // warns about non-unique keys.
  const { options: sectionOptions } = useMasterOptions("sections", []);
  const sectionList = [...new Set(sectionOptions)];

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    class: "",
    subject: "",
    type: "",
    search: "",
  });
  const [searchInput, setSearchInput] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [reading, setReading] = useState(null); // { src, title }

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput.trim() }));
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filters.class) params.set("class", filters.class);
      if (filters.subject) params.set("subject", filters.subject);
      if (filters.type) params.set("type", filters.type);
      if (filters.search) params.set("search", filters.search);
      const res = await api.studyMaterials.list(params.toString());
      setRows(res?.data || []);
      setTotal(res?.total || 0);
      setPages(res?.pages || 0);
    } catch (err) {
      setError(err.message || "Could not load study materials");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (key) => (e) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }));
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      title: row.title || "",
      description: row.description || "",
      subject: row.subject || "",
      class: row.class || "",
      section: row.section || "",
      type: row.type || "notes",
      linkUrl: row.linkUrl || "",
      file: null,
      fileUrl: row.fileUrl || "",
      fileName: row.fileName || "",
      fileSize: row.fileSize ?? null,
      pageCount: row.pageCount ?? null,
    });
    setShowForm(true);
  };

  const pickFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE) return toast("File must be 10 MB or smaller", "error");
    setForm((f) => ({
      ...f,
      file,
      fileName: file.name,
      fileSize: file.size,
      // A freshly picked file replaces whatever was attached before.
      fileUrl: "",
      pageCount: null,
    }));
  };

  const clearFile = () =>
    setForm((f) => ({ ...f, file: null, fileUrl: "", fileName: "", fileSize: null, pageCount: null }));

  const handleSave = async () => {
    if (!form.title.trim()) return toast("Title is required", "error");
    if (!form.subject) return toast("Subject is required", "error");
    if (!form.class) return toast("Class is required", "error");
    if (form.type === "link" && !form.linkUrl.trim())
      return toast("Link URL is required for link materials", "error");
    if (form.type === "ebook" && !form.file && !form.fileUrl)
      return toast("Attach a PDF file for an e-book", "error");

    setSaving(true);
    try {
      let fileUrl = form.fileUrl || undefined;
      let fileName = form.fileName || undefined;
      let fileSize = form.fileSize ?? undefined;
      let pageCount = form.pageCount ?? undefined;

      if (form.file) {
        const up = await api.studyMaterials.upload(form.file);
        fileUrl = up.data.url;
        fileName = up.data.fileName;
        fileSize = up.data.fileSize;
        pageCount = await readPdfPageCount(form.file);
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        subject: form.subject,
        class: form.class,
        section: form.section || null,
        type: form.type,
        linkUrl: form.type === "link" ? form.linkUrl.trim() : null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: fileSize ?? null,
        pageCount: pageCount ?? null,
      };

      if (editing) await api.studyMaterials.update(editing._id, payload);
      else await api.studyMaterials.create(payload);
      toast(editing ? "Study material updated" : "Study material added", "success");
      setShowForm(false);
      load();
    } catch (err) {
      toast(err.message || "Could not save study material", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.title}"? This cannot be undone.`)) return;
    try {
      await api.studyMaterials.remove(row._id);
      toast("Study material deleted", "success");
      load();
    } catch (err) {
      toast(err.message || "Could not delete study material", "error");
    }
  };

  const setFormValue = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={openCreate}>
            <Plus size={15} /> Add Material
          </Button>
        </div>
      )}

      <Card
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
              />
              <Input
                placeholder="Search title or subject…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8 w-48"
              />
            </div>
            <Select value={filters.class} onChange={setFilter("class")} className="w-32">
              <option value="">All classes</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select value={filters.subject} onChange={setFilter("subject")} className="w-36">
              <option value="">All subjects</option>
              {subjectOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Select value={filters.type} onChange={setFilter("type")} className="w-32">
              <option value="">All types</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t[0].toUpperCase() + t.slice(1)}
                </option>
              ))}
            </Select>
            <Button variant="ghost" onClick={load} title="Refresh">
              <RefreshCw size={14} />
            </Button>
          </div>
        }
      >
        {loading ? (
          <LoadingBlock label="Loading study materials…" />
        ) : error ? (
          <ErrorBlock message={error} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyBlock
            title={
              filters.class || filters.subject || filters.type || filters.search
                ? "No study materials match these filters"
                : "No study materials yet"
            }
          />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-slate-text/80 text-[11.5px] uppercase tracking-wide border-b border-slate-200">
                  <th className="px-5 py-2.5 font-semibold">Title</th>
                  <th className="px-5 py-2.5 font-semibold">Subject</th>
                  <th className="px-5 py-2.5 font-semibold">Class</th>
                  <th className="px-5 py-2.5 font-semibold">Type</th>
                  <th className="px-5 py-2.5 font-semibold">Uploaded by</th>
                  <th className="px-5 py-2.5 font-semibold">Added</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const canRead = Boolean(row.fileUrl) && isPdfUrl(row.fileUrl, row.fileName);
                  return (
                    <tr key={row._id} className="border-b border-slate-100 hover:bg-paper/60">
                      <td className="px-5 py-3">
                        <div className="flex items-start gap-2">
                          <FileText size={14} className="text-slate-text/50 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-semibold text-ink truncate">{row.title}</p>
                            {row.description && (
                              <p className="text-[12px] text-slate-text/80 truncate max-w-md">
                                {row.description}
                              </p>
                            )}
                            {row.fileName && (
                              <p className="text-[11.5px] text-slate-text/80 truncate max-w-md">
                                {row.fileName}
                                {row.fileSize ? ` · ${fmtSize(row.fileSize)}` : ""}
                                {row.pageCount ? ` · ${row.pageCount} pages` : ""}
                              </p>
                            )}
                            {row.linkUrl && (
                              <a
                                href={row.linkUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11.5px] text-info hover:underline break-all"
                              >
                                {row.linkUrl}
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-text">{row.subject}</td>
                      <td className="px-5 py-3 text-slate-text">
                        {row.class}
                        {row.section ? ` - ${row.section}` : ""}
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={TYPE_TONES[row.type] || "neutral"}>{row.type}</Pill>
                      </td>
                      <td className="px-5 py-3 text-slate-text">{row.uploadedByName || "—"}</td>
                      <td className="px-5 py-3 text-slate-text">
                        {row.createdAt ? new Date(row.createdAt).toLocaleDateString("en-IN") : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canRead && (
                            <button
                              onClick={() => setReading({ src: row.fileUrl, title: row.title })}
                              className="p-1.5 rounded-lg hover:bg-success/10 text-slate-text/60 hover:text-success transition-colors"
                              title="Read in app"
                            >
                              <BookOpenCheck size={14} />
                            </button>
                          )}
                          {canWrite && (
                            <>
                              <button
                                onClick={() => openEdit(row)}
                                className="p-1.5 rounded-lg hover:bg-info/10 text-slate-text/60 hover:text-info transition-colors"
                                title="Edit material"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(row)}
                                className="p-1.5 rounded-lg hover:bg-alert/10 text-slate-text/60 hover:text-alert transition-colors"
                                title="Delete material"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && total > 0 && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <p className="text-[12.5px] text-slate-text/80">{total} materials</p>
            <Pagination page={page} pages={pages} onPage={setPage} />
          </div>
        )}
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => !saving && setShowForm(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <BookOpenCheck size={18} className="text-primary" />
                <h3 className="font-display font-semibold text-ink text-[17px]">
                  {editing ? "Edit Study Material" : "Add Study Material"}
                </h3>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 rounded-lg hover:bg-paper text-slate-text"
                disabled={saving}
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Title *
                </label>
                <Input
                  value={form.title}
                  onChange={setFormValue("title")}
                  placeholder="e.g. Chapter 4 — Force and Motion"
                />
              </div>

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  Description
                </label>
                <Input
                  value={form.description}
                  onChange={setFormValue("description")}
                  placeholder="Optional summary for students"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Class *
                  </label>
                  <Select value={form.class} onChange={setFormValue("class")}>
                    <option value="">Select class</option>
                    {classOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Section
                  </label>
                  <Select value={form.section} onChange={setFormValue("section")}>
                    <option value="">All sections</option>
                    {sectionList.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Subject *
                  </label>
                  <Select value={form.subject} onChange={setFormValue("subject")}>
                    <option value="">Select subject</option>
                    {subjectOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Type
                  </label>
                  <Select value={form.type} onChange={setFormValue("type")}>
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t[0].toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {form.type === "link" && (
                <div>
                  <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                    Link URL *
                  </label>
                  <Input
                    value={form.linkUrl}
                    onChange={setFormValue("linkUrl")}
                    placeholder="https://…"
                  />
                </div>
              )}

              <div>
                <label className="text-[12px] font-semibold text-ink mb-1.5 block">
                  File {form.type === "ebook" ? "*" : "(PDF or image, max 10 MB)"}
                </label>
                {form.fileName ? (
                  <div className="flex items-center gap-2 rounded-lg border border-ink/10 bg-paper px-3 py-2">
                    <FileText size={15} className="text-slate-text/60 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-semibold text-ink truncate">{form.fileName}</p>
                      <p className="text-[11px] text-slate-text/80">
                        {form.fileSize ? fmtSize(form.fileSize) : ""}
                        {!form.file && form.pageCount ? ` · ${form.pageCount} pages` : ""}
                        {form.file ? " · uploads on save" : ""}
                      </p>
                    </div>
                    {form.fileUrl && !form.file && (
                      <a
                        href={form.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11.5px] font-semibold text-info hover:underline shrink-0"
                      >
                        Open
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={clearFile}
                      disabled={saving}
                      className="p-1 rounded-lg hover:bg-alert/10 text-slate-text/60 hover:text-alert shrink-0"
                      title="Remove file"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 rounded-lg border border-dashed border-ink/20 hover:border-primary/60 bg-paper px-3 py-3 cursor-pointer transition-colors">
                    <Upload size={16} className="text-slate-text/60" />
                    <span className="text-[12.5px] text-slate-text/80">
                      Choose a PDF or image — students read it in the Library
                    </span>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      className="sr-only"
                      onChange={pickFile}
                      disabled={saving}
                    />
                  </label>
                )}
              </div>

              <p className="text-[11.5px] text-slate-text/80">
                PDFs open in the in-app reader (like an e-book); images and links
                open in a new tab.
              </p>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Material"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {reading && (
        <PdfReader src={reading.src} title={reading.title} onClose={() => setReading(null)} />
      )}
    </div>
  );
}
