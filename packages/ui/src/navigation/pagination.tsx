'use client';

import React, { forwardRef, HTMLAttributes } from 'react';

export interface PaginationProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number | undefined;
  showFirstLast?: boolean | undefined;
  disabled?: boolean | undefined;
}

export const Pagination = forwardRef<HTMLElement, PaginationProps>(
  (
    {
      page,
      totalPages,
      onPageChange,
      siblingCount = 1,
      showFirstLast = true,
      disabled = false,
      className = '',
      ...props
    },
    ref
  ) => {
    if (totalPages <= 1) return null;

    // Helper to calculate page numbers to show
    const getPageNumbers = () => {
      const totalPageNumbers = siblingCount * 2 + 5; // siblingCount + first + last + current + 2*dots

      if (totalPages <= totalPageNumbers) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }

      const leftSiblingIndex = Math.max(page - siblingCount, 1);
      const rightSiblingIndex = Math.min(page + siblingCount, totalPages);

      const shouldShowLeftDots = leftSiblingIndex > 2;
      const shouldShowRightDots = rightSiblingIndex < totalPages - 2;

      const firstPageIndex = 1;
      const lastPageIndex = totalPages;

      if (!shouldShowLeftDots && shouldShowRightDots) {
        const leftItemCount = 3 + 2 * siblingCount;
        const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
        return [...leftRange, 'dots-right', totalPages];
      }

      if (shouldShowLeftDots && !shouldShowRightDots) {
        const rightItemCount = 3 + 2 * siblingCount;
        const rightRange = Array.from(
          { length: rightItemCount },
          (_, i) => totalPages - rightItemCount + i + 1
        );
        return [firstPageIndex, 'dots-left', ...rightRange];
      }

      if (shouldShowLeftDots && shouldShowRightDots) {
        const middleRange = Array.from(
          { length: rightSiblingIndex - leftSiblingIndex + 1 },
          (_, i) => leftSiblingIndex + i
        );
        return [firstPageIndex, 'dots-left', ...middleRange, 'dots-right', lastPageIndex];
      }

      return [];
    };

    const pages = getPageNumbers();

    const buttonBase =
      'inline-flex items-center justify-center rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-30 disabled:pointer-events-none h-8 min-w-[2rem] px-2.5';

    return (
      <nav
        ref={ref}
        role="navigation"
        aria-label="Pagination"
        className={`flex items-center justify-center gap-1.5 ${className}`}
        {...props}
      >
        {/* First Page */}
        {showFirstLast && (
          <button
            type="button"
            aria-label="Go to first page"
            disabled={page <= 1 || disabled}
            onClick={() => onPageChange(1)}
            className={`${buttonBase} text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100`}
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="11 17 6 12 11 7" />
              <polyline points="18 17 13 12 18 7" />
            </svg>
          </button>
        )}

        {/* Previous Page */}
        <button
          type="button"
          aria-label="Go to previous page"
          disabled={page <= 1 || disabled}
          onClick={() => onPageChange(page - 1)}
          className={`${buttonBase} text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100`}
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Page numbers */}
        {pages.map((p, idx) => {
          if (p === 'dots-left' || p === 'dots-right') {
            return (
              <span
                key={`dots-${idx}`}
                aria-hidden="true"
                className="px-1 text-xs text-neutral-400 select-none"
              >
                …
              </span>
            );
          }

          const pageNum = p as number;
          const isCurrent = pageNum === page;

          return (
            <button
              key={pageNum}
              type="button"
              aria-label={`Page ${pageNum}`}
              aria-current={isCurrent ? 'page' : undefined}
              disabled={disabled}
              onClick={() => onPageChange(pageNum)}
              className={`${buttonBase} ${
                isCurrent
                  ? 'bg-primary text-white font-semibold shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        {/* Next Page */}
        <button
          type="button"
          aria-label="Go to next page"
          disabled={page >= totalPages || disabled}
          onClick={() => onPageChange(page + 1)}
          className={`${buttonBase} text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100`}
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Last Page */}
        {showFirstLast && (
          <button
            type="button"
            aria-label="Go to last page"
            disabled={page >= totalPages || disabled}
            onClick={() => onPageChange(totalPages)}
            className={`${buttonBase} text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100`}
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="13 17 18 12 13 7" />
              <polyline points="6 17 11 12 6 7" />
            </svg>
          </button>
        )}
      </nav>
    );
  }
);
Pagination.displayName = 'Pagination';
