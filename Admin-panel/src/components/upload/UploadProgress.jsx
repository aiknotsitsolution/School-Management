import { Loader2 } from "lucide-react";

/**
 * Indeterminate (or optional determinate) progress bar shown while a file is
 * being uploaded. Indeterminate mode is used because the app's fetch-based
 * requests do not expose byte-level progress.
 */
export default function UploadProgress({ progress, label = "Uploading…", className = "" }) {
  const determinate = Number.isFinite(progress);
  return (
    <div className={`w-full ${className}`} role="status" aria-label={label}>
      <div className="flex items-center justify-between mb-1">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink">
          <Loader2 size={13} className="animate-spin text-amber-dark" aria-hidden="true" />
          {label}
        </span>
        {determinate && (
          <span className="text-[11.5px] text-slate-text/60">{Math.round(progress)}%</span>
        )}
      </div>
      <div className="h-1.5 w-full rounded-full bg-black/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full bg-amber transition-[width] duration-300 ${
            determinate ? "" : "w-1/3 animate-upload-indeterminate"
          }`}
          style={determinate ? { width: `${Math.min(100, Math.max(0, progress))}%` } : undefined}
        />
      </div>
    </div>
  );
}