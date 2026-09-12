import { AlertCircle, Inbox, Loader2 } from "lucide-react";

export function LoadingBlock({ label = "Loading…", className = "" }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 py-10 text-[13px] text-slate-text ${className}`}
    >
      <Loader2 size={20} className="animate-spin text-slate-text/40" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyBlock({ title, className = "" }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 py-10 text-center ${className}`}
    >
      <Inbox size={22} className="text-slate-text/30" />
      <p className="text-[13px] text-slate-text">{title}</p>
    </div>
  );
}

export function ErrorBlock({ message, onRetry, className = "" }) {
  return (
    <div className={`text-center py-8 ${className}`}>
      <p className="text-[13px] text-alert font-medium">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-info hover:underline"
        >
          <AlertCircle size={13} /> Try again
        </button>
      )}
    </div>
  );
}