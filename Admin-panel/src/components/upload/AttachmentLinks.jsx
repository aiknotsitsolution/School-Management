import { Paperclip } from "lucide-react";
import { formatBytes } from "./uploadUtils";

/**
 * Renders a submission's file attachments as openable links. Supports the
 * legacy string URL shape and the object shape { fileName, fileUrl, fileSize }.
 */
export default function AttachmentLinks({ attachments, className = "" }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className={`mt-2 flex flex-wrap gap-2 ${className}`}>
      {attachments.map((a, i) => {
        const href = typeof a === "string" ? a : a.fileUrl;
        const name = typeof a === "string" ? "Attachment" : a.fileName || "Attachment";
        const size = typeof a === "string" ? null : a.fileSize;
        if (!href) return null;
        return (
          <a
            key={href || i}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-black/10 px-2.5 py-1.5 text-[12px] font-semibold text-ink hover:border-black/25 transition-colors"
            title={name}
          >
            <Paperclip size={13} className="text-slate-text/50 shrink-0" />
            <span className="max-w-[180px] truncate">{name}</span>
            {size != null && (
              <span className="text-slate-text/50 font-medium">· {formatBytes(size)}</span>
            )}
          </a>
        );
      })}
    </div>
  );
}