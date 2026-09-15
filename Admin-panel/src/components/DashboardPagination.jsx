import { useState } from "react";
import { Select } from "./UI";

// Reusable lightweight pagination bar for dashboard widgets.
// Matches the dashboard card aesthetic (border-black/[0.06] dividers,
// 12px muted text, subtle select + ghost buttons).

export function DashboardPagination({
  total = 0,
  page = 1,
  pageSize = 5,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20],
  showSizeSelector = true,
  unit = "items",
  className = "",
  compact = false,
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-black/[0.06] ${className}`}
    >
      <p className="text-[12px] text-slate-text/70">
        Showing {start}–{end} of {total} {unit}
      </p>
      <div className="flex items-center gap-2">
        {showSizeSelector && (
          <Select
            aria-label="Items per page"
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            size={compact ? "sm" : "md"}
            borderless={compact}
            className={compact ? "w-auto" : ""}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </Select>
        )}
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className={`rounded-lg border border-black/10 font-semibold text-ink bg-white hover:bg-paper disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
            compact ? "px-2 py-1 rounded-md text-[11.5px]" : "px-3 py-1.5 text-[12px]"
          }`}
          aria-label="Previous page"
        >
          ‹ Prev
        </button>
        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= pages}
          className={`rounded-lg border border-black/10 font-semibold text-ink bg-white hover:bg-paper disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
            compact ? "px-2 py-1 rounded-md text-[11.5px]" : "px-3 py-1.5 text-[12px]"
          }`}
          aria-label="Next page"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}

// Local state hook: clamps `page` to a valid range whenever `total`/`pageSize`
// change, and resets to page 1 when the page size changes.
export function usePaged(total = 0, defaultPageSize = 5) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageClamped = Math.min(Math.max(1, page), pages);
  const start = total === 0 ? 0 : (pageClamped - 1) * pageSize;
  const end = Math.min(start + pageSize, total);

  const changePageSize = (size) => {
    setPageSize(size);
    setPage(1);
  };

  return {
    page: pageClamped,
    pageSize,
    pages,
    start,
    end,
    setPage,
    changePageSize,
    total,
    onPageChange: setPage,
    onPageSizeChange: changePageSize,
  };
}