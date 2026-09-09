import { useRef, useState } from "react";
import { UploadCloud, AlertCircle, Loader2 } from "lucide-react";
import FilePreview from "./FilePreview";
import { formatBytes } from "./uploadUtils";

function extensionOf(name = "") {
  const parts = String(name).split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

/**
 * Shared file picker with drag & drop, click-to-browse, keyboard access,
 * type/size validation and a replace/remove preview. Browsing always works as
 * a fallback; drag & drop is purely an enhancement.
 *
 * Props:
 * - value: File | null (controlled)
 * - onChange(file): called on select / replace / remove
 * - accept: array of accepted extensions e.g. [".jpg",".png",".pdf"]
 * - mimeTypes: array of accepted mime types (validated when the browser
 *   reports a type; unknown/empty types fall back to extension matching)
 * - maxSize: max bytes (requires a value)
 * - label: visible field label
 * - helperText: hint shown under the field
 * - disabled, loading
 * - error: optional external error string
 */
export default function FileDropzone({
  id,
  label,
  value,
  onChange,
  accept = [],
  mimeTypes = [],
  maxSize,
  disabled = false,
  loading = false,
  helperText,
  error,
  emptyIcon: EmptyIcon = UploadCloud,
  className = "",
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const extList = accept.map((e) => e.toLowerCase().replace(/^\./, ""));
  const openPicker = () => {
    if (disabled || loading) return;
    inputRef.current?.click();
  };

  const validate = (file) => {
    if (!file) return { ok: false };
    if (maxSize && file.size > maxSize) {
      return {
        ok: false,
        message: `File is too large. Maximum allowed size is ${formatBytes(maxSize)}.`,
      };
    }
    const ext = extensionOf(file.name);
    const extOk = extList.length === 0 || extList.includes(ext);
    const mimeOk =
      mimeTypes.length === 0 ||
      !file.type ||
      mimeTypes.includes(file.type) ||
      (file.type === "application/octet-stream" && extOk);
    if (!extOk && !mimeOk) {
      const label =
        accept.length > 0 ? accept.join(", ") : "supported files";
      return {
        ok: false,
        message: `Unsupported file type. Allowed: ${label}.`,
      };
    }
    if (!extOk && mimeTypes.length > 0) {
      const label = mimeTypes.map((m) => m.split("/").pop()).join(", ");
      return {
        ok: false,
        message: `Unsupported file type. Allowed: ${label}.`,
      };
    }
    return { ok: true };
  };

  const acceptFile = (file) => {
    if (!file) return;
    const result = validate(file);
    if (!result.ok) {
      setErrorMessage(result.message);
      setStatusMessage(result.message);
      return;
    }
    setErrorMessage("");
    setStatusMessage(`File selected: ${file.name}`);
    onChange?.(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) acceptFile(file);
  };

  const formatsHint =
    accept.length > 0
      ? `${accept.join(" ")}${maxSize ? ` · Max ${formatBytes(maxSize)}` : ""}`
      : maxSize
        ? `Max ${formatBytes(maxSize)}`
        : "";

  const fieldId = id || "file-dropzone-input";

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          className="block text-[12.5px] font-medium text-slate-text/70 mb-1.5"
          htmlFor={fieldId}
        >
          {label}
        </label>
      )}

      {value ? (
        <FilePreview
          file={value}
          onRemove={() => {
            setErrorMessage("");
            setStatusMessage("");
            onChange?.(null);
          }}
          onReplace={loading || disabled ? undefined : openPicker}
        />
      ) : (
        <div
          role="button"
          tabIndex={disabled || loading ? -1 : 0}
          aria-disabled={disabled || loading}
          aria-label={`Upload ${label || "a file"}`}
          onClick={openPicker}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !disabled && !loading) {
              e.preventDefault();
              openPicker();
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onDragOver={(e) => {
            if (disabled || loading) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`relative rounded-xl border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors outline-none ${
            dragging
              ? "border-amber bg-amber/10"
              : "border-black/[0.12] hover:border-ink/30 bg-white"
          } ${
            focused ? "ring-2 ring-amber/40 border-amber" : ""
          } ${disabled || loading ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <input
            ref={inputRef}
            id={fieldId}
            type="file"
            className="sr-only"
            tabIndex={-1}
            disabled={disabled || loading}
            accept={[...accept, ...mimeTypes].join(",")}
            onChange={(e) => {
              acceptFile(e.target.files?.[0] || null);
              e.target.value = "";
            }}
          />
          <EmptyIcon size={26} className="mx-auto text-slate-text/40 mb-2" aria-hidden="true" />
          <p className="text-[13px] font-semibold text-ink">
            Drag &amp; drop your file here
          </p>
          <p className="text-[12.5px] text-slate-text/60 mt-1">
            or{" "}
            <span className="font-semibold text-amber-dark underline underline-offset-2">
              Browse files
            </span>
          </p>
          {formatsHint && (
            <p className="text-[11.5px] text-slate-text/50 mt-2">
              {formatsHint}
            </p>
          )}

          {loading && (
            <div className="absolute inset-0 rounded-xl bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-amber-dark" aria-hidden="true" />
            </div>
          )}
        </div>
      )}

      {helperText && !errorMessage && (
        <p className="text-[11.5px] text-slate-text/60 mt-1.5">{helperText}</p>
      )}

      {(error || errorMessage) && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-alert" role="alert">
          <AlertCircle size={13} aria-hidden="true" />
          {error || errorMessage}
        </p>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </p>
    </div>
  );
}