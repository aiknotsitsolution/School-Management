import { useEffect, useRef, useState } from "react";
import { FileText, UploadCloud, Download, Trash2 } from "lucide-react";
import { PageIntro, Card, Pill, Button, Input, Select, toast } from "../../components/UI";
import { api } from "../../lib/api";
import { fmtDate } from "./useStudentContext";

const CATEGORY_TONES = {
  academic: "info",
  identity: "success",
  health: "amber",
  transfer: "neutral",
  other: "neutral",
};

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const load = () => {
    setLoading(true);
    api.documents
      .list()
      .then(({ data }) => setDocs(data || []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const upload = async () => {
    setError("");
    if (!file) {
      toast("Choose a file to upload", "error");
      return;
    }
    if (!title.trim()) {
      toast("Give the document a title", "error");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.documents.upload(file, { title, category });
      setDocs((prev) => [data, ...prev]);
      setTitle("");
      setCategory("other");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      toast("Document uploaded", "success");
    } catch (err) {
      setError(err.message);
      toast("Upload failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (doc) => {
    try {
      await api.documents.remove(doc._id);
      setDocs((prev) => prev.filter((d) => d._id !== doc._id));
      toast("Document deleted", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="School Records"
        title="My Documents"
        description="Certificates, reports and records issued to you by the school office."
      />

      <Card title="Your documents">
        {loading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 bg-white rounded-2xl border border-black/[0.06] animate-pulse" />)}</div>
        ) : docs.length === 0 ? (
          <div className="py-10 text-center">
            <FileText size={40} className="mx-auto text-slate-text/30 mb-3" />
            <p className="text-[15px] font-semibold text-ink">No documents yet</p>
            <p className="text-[13px] text-slate-text/70 mt-1">Documents issued to you by the school will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {docs.map((d) => (
              <div key={d._id} className="rounded-xl border border-black/[0.06] p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber/10 text-amber flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14px] font-semibold text-ink truncate">{d.title}</p>
                    <Pill tone={CATEGORY_TONES[d.category] || "neutral"}>{d.category}</Pill>
                  </div>
                  <p className="text-[11.5px] text-slate-text/60 mt-0.5">
                    {d.fileName} · {fmtDate(d.createdAt)}
                    {d.uploadedBy ? ` · by ${d.uploadedBy}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1.5 text-[12px] font-semibold text-ink hover:border-black/20"
                  >
                    <Download size={14} /> Open
                  </a>
                  <Button variant="ghost" onClick={() => remove(d)} aria-label="Delete document">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Upload your own document">
        <p className="text-[12.5px] text-slate-text/80 mb-3">
          You can attach a scanned copy of a certificate or record to your student file. Staff in the school
          office can also add documents that will appear above.
        </p>
        {error && (
          <div className="mb-3 rounded-lg bg-alert/10 border border-alert/30 px-3 py-2 text-[12.5px] text-alert">
            Upload failed: {error}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            placeholder="Document title (e.g. Transfer Certificate)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="academic">Academic</option>
            <option value="identity">Identity</option>
            <option value="health">Health</option>
            <option value="transfer">Transfer</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-[12.5px] text-slate-text file:mr-3 file:rounded-lg file:border-0 file:bg-amber/15 file:text-ink file:font-semibold file:px-3 file:py-2"
          />
          <Button onClick={upload} disabled={saving} className="sm:ml-auto">
            <UploadCloud size={15} /> {saving ? "Uploading…" : "Upload document"}
          </Button>
        </div>
      </Card>
    </div>
  );
}