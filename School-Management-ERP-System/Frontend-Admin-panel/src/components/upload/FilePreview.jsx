import { useEffect, useState } from "react";
import { FileText, X } from "lucide-react";
import { Button } from "../UI";
import { formatBytes, fileTypeLabel } from "./uploadUtils";

function isImageLike(name = "", mimeType = "") {
  if (mimeType && mimeType.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(name);
}

/**
 * Displays a selected file (client File object or a remote url) with a clear
 * preview, name, size and remove/replace actions.
 */
export default function FilePreview({
  file,
  url,
  fileName,
  fileSize,
  mimeType,
  onRemove,
  onReplace,
  replaceLabel = "Replace",
  removeLabel = "Remove file",
}) {
  const [objectUrl, setObjectUrl] = useState(null);

  const name = file?.name || fileName || "Attachment";
  const size = file?.size ?? fileSize;
  const type = file?.type || mimeType || "";
  const isImage = isImageLike(name, type);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return undefined;
    }
    const previewUrl = URL.createObjectURL(file);
    setObjectUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [file]);

  if (!file && !url) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-black/[0.08] bg-paper/60 p-3">
      {file || url ? (
        isImage ? (
          <img
            src={file ? objectUrl : url}
            alt=""
            className="w-12 h-12 rounded-lg object-cover border border-black/[0.06] shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-amber/15 text-amber-dark flex items-center justify-center shrink-0">
            <FileText size={20} />
          </div>
        )
      ) : null}

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink truncate" title={name}>
          {name}
        </p>
        <p className="text-[11.5px] text-slate-text/60 mt-0.5">
          {fileTypeLabel(name)}
          {size != null ? ` · ${formatBytes(size)}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {onReplace && (
          <Button type="button" variant="outline" onClick={onReplace} className="!px-2.5 !py-1.5 !text-[12px]">
            {replaceLabel}
          </Button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={removeLabel}
            title={removeLabel}
            className="p-2 rounded-lg text-slate-text/60 hover:text-alert hover:bg-alert/10 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}