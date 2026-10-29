'use client';

import React, {
  TableHTMLAttributes,
  HTMLAttributes,
  ThHTMLAttributes,
  TdHTMLAttributes,
  forwardRef,
  ReactNode,
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
} from 'react';
import { Badge } from './badge';
import { Avatar } from './avatar';
import { Button } from './button';

export type TableDensity = 'compact' | 'normal' | 'relaxed';
export type TableVariant = 'default' | 'card' | 'bordered' | 'striped' | 'minimal' | 'bento' | 'candidate';
export type AssessmentTableVariant = 'default' | 'bento' | 'minimal' | 'candidate';

interface TableContextValue {
  density: TableDensity;
  striped: boolean;
  hoverable: boolean;
  bordered: boolean;
}

const TableContext = createContext<TableContextValue>({
  density: 'normal',
  striped: false,
  hoverable: true,
  bordered: false,
});

export interface TableProps extends Omit<TableHTMLAttributes<HTMLTableElement>, 'title'> {
  variant?: TableVariant | undefined;
  density?: TableDensity | undefined;
  striped?: boolean | undefined;
  bordered?: boolean | undefined;
  hoverable?: boolean | undefined;
  title?: ReactNode | undefined;
  subtitle?: ReactNode | undefined;
  badge?: ReactNode | undefined;
  headerActions?: ReactNode | undefined;
  toolbar?: ReactNode | undefined;
  footer?: ReactNode | undefined;
  pagination?: ReactNode | undefined;
  empty?: boolean | ReactNode | undefined;
  emptyTitle?: string | undefined;
  emptyDescription?: string | undefined;
  emptyAction?: ReactNode | undefined;
  isLoading?: boolean | undefined;
  loadingRows?: number | undefined;
  containerClassName?: string | undefined;
}

export const Table = forwardRef<HTMLTableElement, TableProps>(
  (
    {
      variant = 'default',
      density = 'normal',
      striped = false,
      bordered = false,
      hoverable = true,
      title,
      subtitle,
      badge,
      headerActions,
      toolbar,
      footer,
      pagination,
      empty = false,
      emptyTitle = 'No records found',
      emptyDescription = 'There are no items to display matching your criteria.',
      emptyAction,
      isLoading = false,
      loadingRows = 4,
      containerClassName = '',
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isCard =
      variant === 'card' ||
      variant === 'bento' ||
      variant === 'candidate' ||
      Boolean(title || subtitle || headerActions || toolbar);
    const isBordered = bordered || variant === 'bordered';
    const isStriped = striped || variant === 'striped';

    const containerStyle =
      variant === 'bento'
        ? 'rounded-3xl border border-neutral-200/80 bg-neutral-50/70 p-3 shadow-xs space-y-2'
        : variant === 'candidate'
        ? 'rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/[0.02] to-white shadow-xs overflow-hidden'
        : isCard
        ? 'rounded-2xl border border-neutral-200/90 bg-white shadow-sm overflow-hidden'
        : variant === 'minimal'
        ? 'overflow-auto'
        : 'relative w-full overflow-auto rounded-xl border border-neutral-200 bg-white shadow-xs';

    const hasHeader = Boolean(title || subtitle || badge || headerActions);

    return (
      <TableContext.Provider
        value={{
          density,
          striped: isStriped,
          hoverable,
          bordered: isBordered,
        }}
      >
        <div className={`${containerStyle} ${containerClassName}`.trim()}>
          {hasHeader && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200/80 bg-white px-5 py-4">
              <div className="flex items-center gap-2.5">
                {title && (
                  typeof title === 'string' ? (
                    <h3 className="text-base font-semibold text-neutral-900 tracking-tight">{title}</h3>
                  ) : (
                    title
                  )
                )}
                {badge && (
                  typeof badge === 'string' || typeof badge === 'number' ? (
                    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                      {badge}
                    </span>
                  ) : (
                    badge
                  )
                )}
              </div>
              {subtitle && typeof subtitle === 'string' ? (
                <p className="w-full text-xs text-neutral-500 mt-0.5">{subtitle}</p>
              ) : (
                subtitle
              )}
              {headerActions && <div className="flex items-center gap-2 ml-auto">{headerActions}</div>}
            </div>
          )}

          {toolbar && (
            <div className="border-b border-neutral-200/70 bg-neutral-50/50 px-4 py-2.5">
              {toolbar}
            </div>
          )}

          <div className="overflow-x-auto">
            <table
              ref={ref}
              className={`w-full caption-bottom text-left text-sm text-neutral-900 border-collapse ${className}`}
              {...props}
            >
              {children}
            </table>
          </div>

          {empty && (
            <div className="border-t border-neutral-100">
              {typeof empty === 'boolean' ? (
                <TableEmptyState
                  title={emptyTitle}
                  description={emptyDescription}
                  action={emptyAction}
                />
              ) : (
                empty
              )}
            </div>
          )}

          {(footer || pagination) && (
            <div className="border-t border-neutral-200/80 bg-neutral-50/60 px-5 py-3">
              {pagination || footer}
            </div>
          )}
        </div>
      </TableContext.Provider>
    );
  }
);
Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', ...props }, ref) => (
    <thead
      ref={ref}
      className={`border-b border-neutral-200/90 bg-neutral-50/90 text-xs font-semibold text-neutral-600 uppercase tracking-wider select-none ${className}`}
      {...props}
    />
  )
);
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', ...props }, ref) => (
    <tbody ref={ref} className={`divide-y divide-neutral-100 bg-white ${className}`} {...props} />
  )
);
TableBody.displayName = 'TableBody';

export const TableFooter = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', ...props }, ref) => (
    <tfoot
      ref={ref}
      className={`border-t border-neutral-200 bg-neutral-50 font-medium text-neutral-700 ${className}`}
      {...props}
    />
  )
);
TableFooter.displayName = 'TableFooter';

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className = '', ...props }, ref) => {
    const { striped, hoverable } = useContext(TableContext);
    const stripeClass = striped ? 'even:bg-neutral-50/60' : '';
    const hoverClass = hoverable ? 'hover:bg-neutral-50/80 transition-colors' : '';

    return (
      <tr
        ref={ref}
        className={`${stripeClass} ${hoverClass} data-[state=selected]:bg-primary/10 ${className}`}
        {...props}
      />
    );
  }
);
TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', ...props }, ref) => {
    const { density, bordered } = useContext(TableContext);
    const densityClass =
      density === 'compact'
        ? 'h-9 px-3 text-[11px]'
        : density === 'relaxed'
        ? 'h-13 px-5 text-xs'
        : 'h-11 px-4 text-xs';
    const borderClass = bordered ? 'border-r border-neutral-200/80 last:border-r-0' : '';

    return (
      <th
        ref={ref}
        className={`${densityClass} ${borderClass} text-left align-middle font-semibold text-neutral-600 [&:has([role=checkbox])]:pr-0 ${className}`}
        {...props}
      />
    );
  }
);
TableHead.displayName = 'TableHead';

export type TableSortDirection = 'asc' | 'desc' | null;

export interface TableSortRule {
  key: string;
  direction: 'asc' | 'desc';
  priority?: number | undefined;
}

export interface TableSortableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
  columnKey: string;
  sortDirection?: TableSortDirection | undefined;
  sortPriority?: number | undefined;
  onSort?: ((key: string, multi: boolean) => void) | undefined;
  children: ReactNode;
  align?: ('left' | 'center' | 'right') | undefined;
}

export const TableSortableHead = forwardRef<HTMLTableCellElement, TableSortableHeadProps>(
  (
    {
      columnKey,
      sortDirection = null,
      sortPriority,
      onSort,
      children,
      align = 'left',
      className = '',
      ...props
    },
    ref
  ) => {
    const { density, bordered } = useContext(TableContext);
    const densityClass =
      density === 'compact'
        ? 'h-9 px-3 text-[11px]'
        : density === 'relaxed'
        ? 'h-13 px-5 text-xs'
        : 'h-11 px-4 text-xs';
    const borderClass = bordered ? 'border-r border-neutral-200/80 last:border-r-0' : '';

    const handleClick = (e: React.MouseEvent) => {
      const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
      onSort?.(columnKey, isMulti);
    };

    const alignClass =
      align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

    return (
      <th
        ref={ref}
        className={`${densityClass} ${borderClass} text-left align-middle font-semibold text-neutral-600 select-none ${className}`}
        {...props}
      >
        <button
          type="button"
          onClick={handleClick}
          className={`group inline-flex items-center gap-1.5 uppercase tracking-wider transition-colors hover:text-neutral-900 focus:outline-none cursor-pointer ${alignClass}`}
          title="Click to sort (Asc ▲ / Desc ▼ / Reset). Hold Shift to sort by multiple columns."
        >
          <span>{children}</span>
          <span className="inline-flex items-center">
            {sortDirection === 'asc' ? (
              <svg className="w-3.5 h-3.5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
              </svg>
            ) : sortDirection === 'desc' ? (
              <svg className="w-3.5 h-3.5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <svg
                className="w-3.5 h-3.5 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            )}
            {sortPriority !== undefined && sortDirection && (
              <span className="ml-0.5 text-[9px] font-bold text-primary bg-primary/10 rounded-full w-3.5 h-3.5 flex items-center justify-center">
                {sortPriority}
              </span>
            )}
          </span>
        </button>
      </th>
    );
  }
);
TableSortableHead.displayName = 'TableSortableHead';

export interface TableActionItem {
  label: string;
  onClick?: (() => void) | undefined;
  icon?: ReactNode | undefined;
  variant?: ('default' | 'danger') | undefined;
  disabled?: boolean | undefined;
  divider?: boolean | undefined;
}

export interface TableRowActionsProps {
  items: TableActionItem[];
  trigger?: ReactNode | undefined;
  align?: ('left' | 'right') | undefined;
  className?: string | undefined;
}

export function TableRowActions({
  items,
  trigger,
  align = 'right',
  className = '',
}: TableRowActionsProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      <div onClick={(e) => e.stopPropagation()}>
        {trigger ? (
          <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-label="Row actions"
            className="w-8 h-8 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-2xs"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
        )}
      </div>

      {isOpen && (
        <div
          role="menu"
          className={`absolute top-full mt-1.5 w-48 bg-white border border-neutral-200 rounded-xl shadow-xl z-50 py-1 text-xs divide-y divide-neutral-100 animate-fade-in ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="py-1">
            {items.map((item, idx) => {
              if (item.divider) {
                return <div key={`div-${idx}`} className="my-1 border-t border-neutral-100" />;
              }
              return (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    item.onClick?.();
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left font-medium transition-colors ${
                    item.disabled
                      ? 'opacity-40 cursor-not-allowed text-neutral-400'
                      : item.variant === 'danger'
                        ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
                        : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                >
                  {item.icon && <span className="w-4 h-4 shrink-0">{item.icon}</span>}
                  <span className="flex-1 truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', ...props }, ref) => {
    const { density, bordered } = useContext(TableContext);
    const densityClass =
      density === 'compact'
        ? 'py-2 px-3 text-xs'
        : density === 'relaxed'
        ? 'py-4.5 px-5 text-sm'
        : 'py-3.5 px-4 text-xs';
    const borderClass = bordered ? 'border-r border-neutral-100 last:border-r-0' : '';

    return (
      <td
        ref={ref}
        className={`${densityClass} ${borderClass} align-middle text-neutral-800 [&:has([role=checkbox])]:pr-0 ${className}`}
        {...props}
      />
    );
  }
);
TableCell.displayName = 'TableCell';

export const TableCaption = forwardRef<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className = '', ...props }, ref) => (
    <caption ref={ref} className={`mt-4 text-xs text-neutral-500 ${className}`} {...props} />
  )
);
TableCaption.displayName = 'TableCaption';

export interface TableEmptyStateProps {
  title?: string | undefined;
  description?: string | undefined;
  icon?: ReactNode | undefined;
  action?: ReactNode | undefined;
  className?: string | undefined;
}

export function TableEmptyState({
  title = 'No records found',
  description = 'There are no items to display matching your criteria.',
  icon,
  action,
  className = '',
}: TableEmptyStateProps): React.JSX.Element {
  return (
    <div className={`flex flex-col items-center justify-center p-12 text-center ${className}`}>
      <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center mb-3">
        {icon || (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        )}
      </div>
      <h3 className="text-sm font-semibold text-neutral-900 mb-1">{title}</h3>
      <p className="text-xs text-neutral-500 max-w-sm mb-4">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}

export interface ListProps extends HTMLAttributes<HTMLUListElement> {
  children: ReactNode;
}

export const List = forwardRef<HTMLUListElement, ListProps>(
  ({ className = '', children, ...props }, ref) => (
    <ul ref={ref} className={`divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white shadow-xs ${className}`} {...props}>
      {children}
    </ul>
  )
);
List.displayName = 'List';

export interface ListItemProps extends HTMLAttributes<HTMLLIElement> {
  children: ReactNode;
}

export const ListItem = forwardRef<HTMLLIElement, ListItemProps>(
  ({ className = '', children, ...props }, ref) => (
    <li ref={ref} className={`p-4 flex items-center justify-between text-sm text-neutral-800 hover:bg-neutral-50 transition-colors ${className}`} {...props}>
      {children}
    </li>
  )
);
ListItem.displayName = 'ListItem';

// ============================================================================
// SimpleTable / DataTable Component
// All-in-one simple, neat table with sorting, selection, search, and navbar
// ============================================================================

export interface SimpleTableColumn<T> {
  key: string;
  header: ReactNode;
  sortable?: boolean | undefined;
  sortFn?: ((a: T, b: T, direction: 'asc' | 'desc') => number) | undefined;
  align?: ('left' | 'center' | 'right') | undefined;
  width?: string | undefined;
  className?: string | undefined;
  render?: ((row: T, index: number) => ReactNode) | undefined;
}

export interface SimpleTableAction<T> {
  label: string;
  onClick: (row: T) => void;
  icon?: ReactNode | undefined;
  variant?: ('default' | 'danger') | undefined;
  disabled?: boolean | undefined;
  divider?: boolean | undefined;
}

export interface SimpleTableProps<T extends Record<string, any>> {
  data: T[];
  columns: SimpleTableColumn<T>[];
  keyField?: keyof T | undefined;
  title?: ReactNode | undefined;
  subtitle?: ReactNode | undefined;
  badge?: ReactNode | undefined;
  searchable?: boolean | undefined;
  searchPlaceholder?: string | undefined;
  searchKeys?: (keyof T)[] | undefined;
  selectable?: boolean | undefined;
  selectedIds?: (string | number)[] | undefined;
  onSelectionChange?: ((selectedIds: (string | number)[]) => void) | undefined;
  bulkActions?: ((selectedIds: (string | number)[], clearSelection: () => void) => ReactNode) | undefined;
  actions?: SimpleTableAction<T>[] | undefined;
  sortMode?: ('single' | 'multi') | undefined;
  defaultSort?: TableSortRule[] | { key: string; direction: 'asc' | 'desc' } | undefined;
  showSortControl?: boolean | undefined;
  onSortChange?: ((rules: TableSortRule[]) => void) | undefined;
  showPagination?: boolean | undefined;
  pageSize?: number | undefined;
  pageSizeOptions?: number[] | undefined;
  density?: TableDensity | undefined;
  striped?: boolean | undefined;
  bordered?: boolean | undefined;
  emptyTitle?: string | undefined;
  emptyDescription?: string | undefined;
  emptyAction?: ReactNode | undefined;
  headerActions?: ReactNode | undefined;
  className?: string | undefined;
}

export function SimpleTable<T extends Record<string, any>>({
  data,
  columns,
  keyField = 'id',
  title,
  subtitle,
  badge,
  searchable = true,
  searchPlaceholder = 'Search records...',
  searchKeys,
  selectable = false,
  selectedIds: controlledSelectedIds,
  onSelectionChange,
  bulkActions,
  actions,
  sortMode = 'single',
  defaultSort,
  showSortControl = true,
  onSortChange,
  showPagination = true,
  pageSize = 5,
  pageSizeOptions = [5, 10, 20],
  density = 'normal',
  striped = false,
  bordered = false,
  emptyTitle = 'No data available',
  emptyDescription = 'Try adjusting your search query or reset filters.',
  emptyAction,
  headerActions,
  className = '',
}: SimpleTableProps<T>): React.JSX.Element {
  const [uncontrolledSelected, setUncontrolledSelected] = useState<(string | number)[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortRules, setSortRules] = useState<TableSortRule[]>(() => {
    if (!defaultSort) return [];
    if (Array.isArray(defaultSort)) return defaultSort;
    return [{ key: defaultSort.key, direction: defaultSort.direction, priority: 1 }];
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);

  const selected = controlledSelectedIds ?? uncontrolledSelected;

  const updateSelection = (next: (string | number)[]) => {
    if (controlledSelectedIds === undefined) {
      setUncontrolledSelected(next);
    }
    onSelectionChange?.(next);
  };

  const clearSelection = () => updateSelection([]);

  // 1. Search Filtering
  const filteredData = React.useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase().trim();

    return data.filter((item) => {
      if (searchKeys && searchKeys.length > 0) {
        return searchKeys.some((k) => String(item[k] ?? '').toLowerCase().includes(q));
      }
      return Object.values(item).some((v) =>
        typeof v === 'string' || typeof v === 'number'
          ? String(v).toLowerCase().includes(q)
          : false
      );
    });
  }, [data, searchQuery, searchKeys]);

  // 2. Sorting (Single & Multi-column method support)
  const sortedData = React.useMemo(() => {
    if (sortRules.length === 0) return filteredData;

    return [...filteredData].sort((a, b) => {
      for (const rule of sortRules) {
        const colDef = columns.find((c) => c.key === rule.key);
        if (colDef?.sortFn) {
          const res = colDef.sortFn(a, b, rule.direction);
          if (res !== 0) return res;
          continue;
        }

        const aVal = a[rule.key];
        const bVal = b[rule.key];
        if (aVal === bVal) continue;
        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return rule.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const strA = String(aVal).toLowerCase();
        const strB = String(bVal).toLowerCase();
        if (strA !== strB) {
          return rule.direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
        }
      }
      return 0;
    });
  }, [filteredData, sortRules, columns]);

  // 3. Pagination calculation
  const totalRows = sortedData.length;
  const isPagingEnabled = showPagination !== false;
  const totalPages = isPagingEnabled ? Math.max(1, Math.ceil(totalRows / rowsPerPage)) : 1;
  const validCurrentPage = isPagingEnabled ? Math.min(currentPage, totalPages) : 1;
  const startIndex = isPagingEnabled ? (validCurrentPage - 1) * rowsPerPage : 0;
  const endIndex = isPagingEnabled ? startIndex + rowsPerPage : totalRows;
  const paginatedData = isPagingEnabled ? sortedData.slice(startIndex, endIndex) : sortedData;

  // Sorting method handler
  const handleSort = (colKey: string, isMultiKey: boolean = false) => {
    const isMulti = sortMode === 'multi' || isMultiKey;

    setSortRules((prev) => {
      let next: TableSortRule[];
      const existingIdx = prev.findIndex((r) => r.key === colKey);

      if (existingIdx >= 0) {
        const current = prev[existingIdx];
        if (current && current.direction === 'asc') {
          next = [...prev];
          next[existingIdx] = { key: current.key, direction: 'desc', priority: current.priority };
        } else {
          next = prev.filter((r) => r.key !== colKey).map((r, i) => ({ ...r, priority: i + 1 }));
        }
      } else {
        const newRule: TableSortRule = { key: colKey, direction: 'asc', priority: isMulti ? prev.length + 1 : 1 };
        next = isMulti ? [...prev, newRule] : [newRule];
      }

      onSortChange?.(next);
      return next;
    });
  };

  const clearSorting = () => {
    setSortRules([]);
    onSortChange?.([]);
  };

  const getSortInfo = (colKey: string) => {
    const found = sortRules.find((r) => r.key === colKey);
    return {
      direction: found?.direction || null,
      priority: sortRules.length > 1 ? found?.priority : undefined,
    };
  };

  // Row selection handlers
  const getItemId = (item: T, idx: number): string | number => {
    return (item[keyField] as string | number) ?? idx;
  };

  const handleToggleRow = (id: string | number) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    updateSelection(next);
  };

  const pageIds = paginatedData.map((item, idx) => getItemId(item, idx));
  const isAllPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const isSomePageSelected = pageIds.some((id) => selected.includes(id)) && !isAllPageSelected;

  const handleSelectAllPage = (checked: boolean) => {
    if (checked) {
      const merged = Array.from(new Set([...selected, ...pageIds]));
      updateSelection(merged);
    } else {
      const filtered = selected.filter((id) => !pageIds.includes(id));
      updateSelection(filtered);
    }
  };

  const sortableColumns = columns.filter((c) => c.sortable);

  return (
    <div className={`rounded-2xl border border-neutral-200/90 bg-white shadow-xs overflow-hidden ${className}`}>
      {/* Header bar */}
      {(title || subtitle || badge || headerActions) && (
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-neutral-200/80 bg-white">
          <div className="flex items-center gap-2.5">
            {title && (
              typeof title === 'string' ? (
                <h3 className="text-base font-semibold text-neutral-900 tracking-tight">{title}</h3>
              ) : (
                title
              )
            )}
            {badge && (
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-700">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="w-full text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
          {headerActions && <div className="flex items-center gap-2 ml-auto">{headerActions}</div>}
        </div>
      )}

      {/* Search & Sorting Toolbar */}
      {(searchable || (showSortControl && sortRules.length > 0)) && (
        <div
          className={`flex flex-wrap items-center gap-3 px-4 py-2.5 bg-neutral-50/60 border-b border-neutral-200/70 ${
            searchable ? 'justify-between' : 'justify-end'
          }`}
        >
          {searchable && (
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-neutral-300 bg-white pl-8 pr-3 py-1.5 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
              <svg
                className="w-4 h-4 text-neutral-400 absolute left-2.5 top-2 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          )}

          {/* Active Sorting Pills & Clear Button */}
          {showSortControl && sortRules.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-neutral-400 text-[11px] font-medium">Sorted:</span>
              {sortRules.map((rule, idx) => {
                const col = columns.find((c) => c.key === rule.key);
                const colLabel = typeof col?.header === 'string' ? col.header : rule.key;

                return (
                  <span
                    key={rule.key}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20"
                  >
                    {sortRules.length > 1 && <span className="opacity-70 font-mono">#{idx + 1}</span>}
                    <span>{colLabel}</span>
                    <span className="font-mono text-[10px]">{rule.direction === 'asc' ? '▲' : '▼'}</span>
                    <button
                      type="button"
                      onClick={() => handleSort(rule.key)}
                      className="hover:opacity-70 ml-1 text-primary cursor-pointer"
                      aria-label={`Remove sort by ${colLabel}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              <button
                type="button"
                onClick={clearSorting}
                className="text-[11px] text-neutral-500 hover:text-neutral-900 underline ml-1 cursor-pointer"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      )}

      {/* Selected Items Banner */}
      {selectable && selected.length > 0 && (
        <div className="flex items-center justify-between bg-primary/10 border-b border-primary/25 px-5 py-2 text-xs text-primary font-medium animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span>{selected.length} record(s) selected</span>
          </div>
          <div className="flex items-center gap-2">
            {bulkActions ? (
              bulkActions(selected, clearSelection)
            ) : (
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs text-primary hover:underline font-semibold cursor-pointer"
              >
                Deselect All
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table Content */}
      <Table density={density} striped={striped} bordered={bordered} className="border-none shadow-none rounded-none">
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all on page"
                  checked={isAllPageSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isSomePageSelected;
                  }}
                  onChange={(e) => handleSelectAllPage(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary/25 cursor-pointer accent-primary"
                />
              </TableHead>
            )}

            {columns.map((col) => {
              if (col.sortable) {
                const info = getSortInfo(col.key);
                return (
                  <TableSortableHead
                    key={col.key}
                    columnKey={col.key}
                    sortDirection={info.direction}
                    sortPriority={info.priority}
                    onSort={(k, multi) => handleSort(k, multi)}
                    align={col.align}
                    className={col.className}
                  >
                    {col.header}
                  </TableSortableHead>
                );
              }
              return (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              );
            })}

            {actions && actions.length > 0 && (
              <TableHead className="text-right w-16">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>

        <TableBody>
          {paginatedData.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={(columns.length || 1) + (selectable ? 1 : 0) + (actions ? 1 : 0)}
                className="p-0 border-0"
              >
                <TableEmptyState
                  title={searchQuery ? 'No matching records' : emptyTitle}
                  description={
                    searchQuery
                      ? `No records found matching "${searchQuery}".`
                      : emptyDescription
                  }
                  action={
                    searchQuery ? (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-xs text-primary font-semibold hover:underline cursor-pointer"
                      >
                        Reset search
                      </button>
                    ) : (
                      emptyAction
                    )
                  }
                />
              </TableCell>
            </TableRow>
          ) : (
            paginatedData.map((row, idx) => {
              const id = getItemId(row, startIndex + idx);
              const isSelected = selected.includes(id);

              return (
                <TableRow
                  key={String(id)}
                  data-state={isSelected ? 'selected' : undefined}
                  className={isSelected ? 'bg-primary/5' : undefined}
                >
                  {selectable && (
                    <TableCell className="w-10">
                      <input
                        type="checkbox"
                        aria-label={`Select row ${String(id)}`}
                        checked={isSelected}
                        onChange={() => handleToggleRow(id)}
                        className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary/25 cursor-pointer accent-primary"
                      />
                    </TableCell>
                  )}

                  {columns.map((col) => {
                    const cellContent = col.render ? col.render(row, startIndex + idx) : row[col.key];
                    const alignClass =
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left';

                    return (
                      <TableCell key={col.key} className={`${alignClass} ${col.className || ''}`}>
                        {cellContent}
                      </TableCell>
                    );
                  })}

                  {actions && actions.length > 0 && (
                    <TableCell className="text-right">
                      <TableRowActions
                        items={actions.map((act) => ({
                          label: act.label,
                          onClick: () => act.onClick(row),
                          icon: act.icon,
                          variant: act.variant,
                          disabled: act.disabled,
                          divider: act.divider,
                        }))}
                      />
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Bottom Pagination Navbar */}
      {isPagingEnabled && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-neutral-200/80 bg-neutral-50/70 text-xs text-neutral-600">
          <div className="flex items-center gap-2">
            <span>
              Showing <span className="font-semibold text-neutral-900">{totalRows === 0 ? 0 : startIndex + 1}-{Math.min(endIndex, totalRows)}</span> of{' '}
              <span className="font-semibold text-neutral-900">{totalRows}</span> records
            </span>
            {pageSizeOptions && pageSizeOptions.length > 0 && (
              <div className="flex items-center gap-1.5 ml-3 border-l border-neutral-200 pl-3">
                <span className="text-neutral-500">Rows:</span>
                <select
                  aria-label="Rows per page"
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-neutral-300 rounded-md px-1.5 py-0.5 text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {pageSizeOptions.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={validCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium shadow-2xs transition-colors cursor-pointer"
            >
              Previous
            </button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                    validCurrentPage === page
                      ? 'bg-primary text-white shadow-2xs shadow-primary/20'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={validCurrentPage >= totalPages || totalPages === 0}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium shadow-2xs transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


export const DataTable = SimpleTable;
export type DataTableProps<T extends Record<string, any>> = SimpleTableProps<T>;


// ============================================================================
// AssessmentTable Component (Production-grade Neat Assessment/Candidate Table)
// ============================================================================

export interface AssessmentRecord {
  id: string;
  candidateName: string;
  candidateEmail: string;
  avatarSrc?: string | undefined;
  assessmentName: string;
  mode: 'cloud' | 'chat';
  aiPolicy: {
    enabled: boolean;
    spend?: string | undefined;
  };
  status: 'invited' | 'in_progress' | 'submitted' | 'scored' | 'review_needed';
  score?: number | undefined;
  duration?: string | undefined;
  deadline?: string | undefined;
  description?: string | undefined;
}

export interface AssessmentTableProps {
  variant?: AssessmentTableVariant | undefined;
  assessments: AssessmentRecord[];
  selectedIds?: string[] | undefined;
  onToggleSelect?: ((id: string) => void) | undefined;
  onSelectAll?: ((selected: boolean) => void) | undefined;
  onAction?: ((actionKey: string, record: AssessmentRecord) => void) | undefined;
  title?: ReactNode | undefined;
  subtitle?: ReactNode | undefined;
  badge?: ReactNode | undefined;
  headerActions?: ReactNode | undefined;
  toolbar?: ReactNode | undefined;
  pagination?: ReactNode | undefined;
  density?: TableDensity | undefined;
  striped?: boolean | undefined;
  className?: string | undefined;
}

export function AssessmentTable({
  variant = 'default',
  assessments,
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
  onAction,
  title,
  subtitle,
  badge,
  headerActions,
  toolbar,
  pagination,
  density = 'normal',
  striped = false,
  className = '',
}: AssessmentTableProps): React.JSX.Element {
  const allSelected = assessments.length > 0 && selectedIds.length === assessments.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  // --------------------------------------------------------------------------
  // Variant 2: Bento Grid Style (Tile Cards & Pill Rows)
  // --------------------------------------------------------------------------
  if (variant === 'bento') {
    const scoredCount = assessments.filter((a) => a.status === 'scored').length;
    const activeVms = assessments.filter((a) => a.mode === 'cloud' && a.status === 'in_progress').length;

    return (
      <div className={`rounded-3xl border border-neutral-200/80 bg-neutral-50/80 p-4 shadow-xs space-y-3 ${className}`}>
        {/* Bento Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-neutral-200/70 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-neutral-900 tracking-tight">
                {title || 'Assessment Operations (Bento)'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary">
                {badge || `${assessments.length} Runs`}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              {subtitle || 'High-density candidate evaluation cards with reviewer agent signals.'}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-neutral-100 border border-neutral-200 text-neutral-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {scoredCount} Scored
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-neutral-100 border border-neutral-200 text-neutral-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-primary" />
              {activeVms} Cloud VMs
            </span>
            {headerActions}
          </div>
        </div>

        {toolbar && (
          <div className="bg-white px-4 py-2.5 rounded-xl border border-neutral-200/70">
            {toolbar}
          </div>
        )}

        {/* Bento Floating Rows */}
        <div className="space-y-2">
          {assessments.map((item) => {
            const isSelected = selectedIds.includes(item.id);

            return (
              <div
                key={item.id}
                className={`flex flex-wrap items-center justify-between gap-4 p-3.5 bg-white rounded-2xl border transition-all ${
                  isSelected
                    ? 'border-primary/50 shadow-xs ring-1 ring-primary/20'
                    : 'border-neutral-200/70 hover:border-neutral-300 hover:shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${item.candidateName}`}
                    checked={isSelected}
                    onChange={() => onToggleSelect?.(item.id)}
                    className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary/25 cursor-pointer accent-primary"
                  />
                  <Avatar
                    size="md"
                    name={item.candidateName}
                    src={item.avatarSrc}
                    variant="orange"
                    status={
                      item.status === 'in_progress'
                        ? 'online'
                        : item.status === 'submitted'
                        ? 'busy'
                        : 'offline'
                    }
                  />
                  <div>
                    <div className="font-bold text-sm text-neutral-900 leading-tight">
                      {item.candidateName}
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono">{item.candidateEmail}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="text-left">
                    <div className="text-xs font-semibold text-neutral-900 truncate max-w-[200px]">
                      {item.assessmentName}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700">
                        {item.mode === 'cloud' ? 'Cloud VM' : 'Chat Workspace'}
                      </span>
                      {item.aiPolicy.enabled ? (
                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          AI Active
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
                          AI Off
                        </span>
                      )}
                    </div>
                  </div>

                  {item.score !== undefined && (
                    <div className="px-2.5 py-1 rounded-xl bg-neutral-50 border border-neutral-200/80 text-center">
                      <div className="text-[10px] uppercase font-bold text-neutral-400">Score</div>
                      <div className="text-xs font-bold font-mono text-neutral-900">{item.score}/100</div>
                    </div>
                  )}

                  <Badge
                    variant={
                      item.status === 'scored'
                        ? 'success'
                        : item.status === 'in_progress'
                        ? 'primary'
                        : item.status === 'review_needed'
                        ? 'warning'
                        : 'default'
                    }
                    dot
                    size="sm"
                    className="capitalize font-medium"
                  >
                    {item.status.replace('_', ' ')}
                  </Badge>

                  <TableRowActions
                    items={[
                      { label: 'View Candidate Run', onClick: () => onAction?.('view', item) },
                      { label: 'Review Transcripts & Diffs', onClick: () => onAction?.('transcripts', item) },
                      { label: 'Override Agent Rubric (BR-20)', onClick: () => onAction?.('override', item) },
                      { label: 'Release Results', onClick: () => onAction?.('release', item), divider: true },
                      { label: 'Destroy Workspace', variant: 'danger', onClick: () => onAction?.('destroy', item) },
                    ]}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {pagination && <div className="pt-2">{pagination}</div>}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Variant 3: Minimal Flat Style (Frameless & Simple)
  // --------------------------------------------------------------------------
  if (variant === 'minimal') {
    return (
      <div className={`space-y-3 ${className}`}>
        {(title || headerActions) && (
          <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
            <div>
              <h4 className="text-sm font-semibold text-neutral-900">{title || 'Assessments'}</h4>
              {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
            </div>
            {headerActions}
          </div>
        )}

        {toolbar && <div className="py-1">{toolbar}</div>}

        <Table variant="minimal" density={density}>
          <TableHeader className="bg-transparent border-b border-neutral-200 text-neutral-500">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={(e) => onSelectAll?.(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-neutral-300 text-primary cursor-pointer accent-primary"
                />
              </TableHead>
              <TableHead>Candidate</TableHead>
              <TableHead>Task & Mode</TableHead>
              <TableHead>AI Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-neutral-100 bg-transparent">
            {assessments.map((item) => {
              const isSelected = selectedIds.includes(item.id);

              return (
                <TableRow key={item.id} className="hover:bg-neutral-50/60">
                  <TableCell className="w-8">
                    <input
                      type="checkbox"
                      aria-label={`Select ${item.candidateName}`}
                      checked={isSelected}
                      onChange={() => onToggleSelect?.(item.id)}
                      className="h-3.5 w-3.5 rounded border-neutral-300 text-primary cursor-pointer accent-primary"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-neutral-900">{item.candidateName}</div>
                    <div className="text-[11px] text-neutral-400 font-mono">{item.candidateEmail}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-neutral-800">{item.assessmentName}</div>
                    <div className="text-[10px] text-neutral-400 font-mono">{item.mode.toUpperCase()}</div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-neutral-600">
                      {item.aiPolicy.enabled ? 'AI Active' : 'Off'}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-neutral-900">
                    {item.score !== undefined ? `${item.score}/100` : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        item.status === 'scored'
                          ? 'success'
                          : item.status === 'in_progress'
                          ? 'primary'
                          : 'default'
                      }
                      size="sm"
                    >
                      {item.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <TableRowActions
                      items={[
                        { label: 'View Run', onClick: () => onAction?.('view', item) },
                        { label: 'Transcripts', onClick: () => onAction?.('transcripts', item) },
                        { label: 'Override', onClick: () => onAction?.('override', item) },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {pagination && <div className="pt-2">{pagination}</div>}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Variant 4: Candidate Portal Style (Action CTA & Run Status)
  // --------------------------------------------------------------------------
  if (variant === 'candidate') {
    return (
      <Table
        variant="candidate"
        density={density}
        title={title || 'My Assigned Assessments'}
        subtitle={
          subtitle ||
          'Your active work simulation workspaces. Click "Connect Workspace" when you are ready to begin.'
        }
        badge={badge || `${assessments.length} Available`}
        headerActions={headerActions}
        toolbar={toolbar}
        pagination={pagination}
        className={className}
      >
        <TableHeader>
          <TableRow>
            <TableHead>Assessment Task</TableHead>
            <TableHead>Workspace Mode</TableHead>
            <TableHead>Session Window</TableHead>
            <TableHead>AI Policy (BR-13)</TableHead>
            <TableHead>Status & Results</TableHead>
            <TableHead className="text-right">Workspace Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assessments.map((item) => {
            const isFinished = item.status === 'submitted' || item.status === 'scored';
            const isInProgress = item.status === 'in_progress';

            return (
              <TableRow key={item.id} className="hover:bg-primary/[0.02]">
                <TableCell>
                  <div className="font-semibold text-neutral-900 text-sm">{item.assessmentName}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {item.description || 'Full work simulation with governed AI assistance.'}
                  </div>
                </TableCell>

                <TableCell>
                  <Badge
                    variant={item.mode === 'cloud' ? 'primary' : 'default'}
                    size="sm"
                    className="font-mono text-[10px]"
                  >
                    {item.mode === 'cloud' ? 'Cloud VM (Terminal + IDE)' : 'Chat Simulation'}
                  </Badge>
                </TableCell>

                <TableCell>
                  <div className="text-xs font-mono font-medium text-neutral-800">
                    {item.duration || '60 mins allocated'}
                  </div>
                  {item.deadline && (
                    <div className="text-[11px] text-neutral-500">Due {item.deadline}</div>
                  )}
                </TableCell>

                <TableCell>
                  {item.aiPolicy.enabled ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Governed AI Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
                      <span className="w-2 h-2 rounded-full bg-neutral-300" />
                      AI Prohibited
                    </span>
                  )}
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        item.status === 'scored'
                          ? 'success'
                          : isInProgress
                          ? 'primary'
                          : isFinished
                          ? 'default'
                          : 'warning'
                      }
                      dot
                      className="capitalize"
                    >
                      {item.status.replace('_', ' ')}
                    </Badge>
                    {item.score !== undefined && (
                      <span className="font-mono font-bold text-xs text-neutral-900">
                        {item.score}/100
                      </span>
                    )}
                  </div>
                </TableCell>

                <TableCell className="text-right">
                  {isInProgress ? (
                    <Button
                      size="sm"
                      variant="orange"
                      onClick={() => onAction?.('resume', item)}
                    >
                      Resume Session →
                    </Button>
                  ) : isFinished ? (
                    <Button
                      size="sm"
                      variant="outline"
                      color="black"
                      onClick={() => onAction?.('view', item)}
                    >
                      View Submission
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="orange"
                      onClick={() => onAction?.('launch', item)}
                    >
                      Connect Workspace →
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  // --------------------------------------------------------------------------
  // Variant 1: Default SaaS Card Style (Full Control Suite)
  // --------------------------------------------------------------------------
  return (
    <Table
      variant="card"
      density={density}
      striped={striped}
      title={title || 'Candidate Assessments'}
      subtitle={subtitle || 'Real-time assessment runs, reviewer agent scores, and candidate work sessions.'}
      badge={badge ?? `${assessments.length} Active`}
      headerActions={
        headerActions || (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" color="black">
              Export CSV
            </Button>
            <Button size="sm" variant="orange">
              + Invite Candidate
            </Button>
          </div>
        )
      }
      toolbar={toolbar}
      pagination={pagination}
      className={className}
    >
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <input
              type="checkbox"
              aria-label="Select all"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              onChange={(e) => onSelectAll?.(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary/25 cursor-pointer accent-primary"
            />
          </TableHead>
          <TableHead>Candidate</TableHead>
          <TableHead>Assessment & Mode</TableHead>
          <TableHead>AI Policy (BR-13)</TableHead>
          <TableHead>Timing</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assessments.map((item) => {
          const isSelected = selectedIds.includes(item.id);

          return (
            <TableRow
              key={item.id}
              data-state={isSelected ? 'selected' : undefined}
              className={isSelected ? 'bg-primary/5' : undefined}
            >
              <TableCell className="w-10">
                <input
                  type="checkbox"
                  aria-label={`Select ${item.candidateName}`}
                  checked={isSelected}
                  onChange={() => onToggleSelect?.(item.id)}
                  className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary/25 cursor-pointer accent-primary"
                />
              </TableCell>

              {/* Candidate Info */}
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar
                    size="md"
                    name={item.candidateName}
                    src={item.avatarSrc}
                    variant="orange"
                    status={
                      item.status === 'in_progress'
                        ? 'online'
                        : item.status === 'submitted'
                        ? 'busy'
                        : 'offline'
                    }
                  />
                  <div>
                    <div className="font-semibold text-neutral-900">{item.candidateName}</div>
                    <div className="text-[11px] text-neutral-500 font-mono">{item.candidateEmail}</div>
                  </div>
                </div>
              </TableCell>

              {/* Assessment & Mode */}
              <TableCell>
                <div className="flex flex-col gap-1 items-start">
                  <span className="font-medium text-neutral-900">{item.assessmentName}</span>
                  <Badge
                    variant={item.mode === 'cloud' ? 'primary' : 'default'}
                    size="sm"
                    className="capitalize font-mono text-[10px]"
                  >
                    {item.mode === 'cloud' ? 'Cloud VM' : 'Chat Workspace'}
                  </Badge>
                </div>
              </TableCell>

              {/* AI Policy */}
              <TableCell>
                {item.aiPolicy.enabled ? (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-xs font-medium text-neutral-800">AI Active</span>
                    {item.aiPolicy.spend && (
                      <span className="text-[11px] text-neutral-500 font-mono">
                        ({item.aiPolicy.spend})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-neutral-500">
                    <span className="w-2 h-2 rounded-full bg-neutral-400 shrink-0" />
                    <span className="text-xs">AI Off</span>
                  </div>
                )}
              </TableCell>

              {/* Timing */}
              <TableCell>
                <div className="text-xs font-mono text-neutral-700">
                  {item.duration || '60m duration'}
                </div>
                {item.deadline && (
                  <div className="text-[10px] text-neutral-500">Due {item.deadline}</div>
                )}
              </TableCell>

              {/* Score */}
              <TableCell>
                {item.score !== undefined ? (
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold font-mono ${
                        item.score >= 85
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : item.score >= 70
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {item.score}/100
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-neutral-400 italic">Pending review</span>
                )}
              </TableCell>

              {/* Status */}
              <TableCell>
                <Badge
                  variant={
                    item.status === 'scored'
                      ? 'success'
                      : item.status === 'in_progress'
                      ? 'primary'
                      : item.status === 'review_needed'
                      ? 'warning'
                      : 'default'
                  }
                  dot
                  className="capitalize font-medium"
                >
                  {item.status.replace('_', ' ')}
                </Badge>
              </TableCell>

              {/* Row Actions */}
              <TableCell className="text-right">
                <TableRowActions
                  items={[
                    { label: 'View Candidate Run', onClick: () => onAction?.('view', item) },
                    { label: 'Review Transcripts & Diffs', onClick: () => onAction?.('transcripts', item) },
                    { label: 'Override Agent Rubric (BR-20)', onClick: () => onAction?.('override', item) },
                    { label: 'Release Results to Candidate', onClick: () => onAction?.('release', item), divider: true },
                    { label: 'Destroy Workspace (BR-22)', variant: 'danger', onClick: () => onAction?.('destroy', item) },
                  ]}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
