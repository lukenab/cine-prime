import { ChevronLeft, ChevronRight } from "lucide-react";

type AdminPaginationProps = {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  itemLabel: string;
  loading?: boolean;
  onPageChange: (page: number) => void;
};

export function AdminPagination({
  page,
  size,
  totalElements,
  totalPages,
  itemLabel,
  loading = false,
  onPageChange,
}: AdminPaginationProps) {
  if (totalElements === 0) return null;
  const first = page * size + 1;
  const last = Math.min(totalElements, (page + 1) * size);
  const buttonClass = "grid h-9 w-9 place-items-center rounded-lg border transition-colors hover:bg-blue-500/5 disabled:cursor-not-allowed disabled:opacity-35";

  return (
    <nav
      aria-label={`${itemLabel} pagination`}
      className="flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}
    >
      <span className="text-xs">
        Showing {first}–{last} of {totalElements} {itemLabel}
      </span>
      <div className="flex items-center gap-3 text-xs">
        <span className="min-w-[88px] text-center">Page {page + 1} of {Math.max(totalPages, 1)}</span>
        <button
          type="button"
          className={buttonClass}
          style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}
          disabled={loading || page <= 0}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={17} />
        </button>
        <button
          type="button"
          className={buttonClass}
          style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}
          disabled={loading || page + 1 >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </nav>
  );
}
