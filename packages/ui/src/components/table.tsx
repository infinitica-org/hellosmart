import React, {
  TableHTMLAttributes,
  HTMLAttributes,
  ThHTMLAttributes,
  TdHTMLAttributes,
  forwardRef,
  ReactNode,
} from 'react';

export const Table = forwardRef<HTMLTableElement, TableHTMLAttributes<HTMLTableElement>>(
  ({ className = '', ...props }, ref) => (
    <div className="relative w-full overflow-auto rounded-xl border border-neutral-200 bg-white shadow-xs">
      <table
        ref={ref}
        className={`w-full caption-bottom text-left text-sm text-neutral-900 border-collapse ${className}`}
        {...props}
      />
    </div>
  )
);
Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', ...props }, ref) => (
    <thead
      ref={ref}
      className={`border-b border-neutral-200 bg-neutral-50/80 text-xs font-semibold text-neutral-600 uppercase tracking-wider ${className}`}
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
  ({ className = '', ...props }, ref) => (
    <tr
      ref={ref}
      className={`transition-colors hover:bg-neutral-50/80 data-[state=selected]:bg-primary/10 ${className}`}
      {...props}
    />
  )
);
TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', ...props }, ref) => (
    <th
      ref={ref}
      className={`h-11 px-4 text-left align-middle font-medium text-neutral-600 [&:has([role=checkbox])]:pr-0 ${className}`}
      {...props}
    />
  )
);
TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', ...props }, ref) => (
    <td
      ref={ref}
      className={`p-4 align-middle text-xs text-neutral-800 [&:has([role=checkbox])]:pr-0 ${className}`}
      {...props}
    />
  )
);
TableCell.displayName = 'TableCell';

export const TableCaption = forwardRef<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className = '', ...props }, ref) => (
    <caption ref={ref} className={`mt-4 text-xs text-neutral-500 ${className}`} {...props} />
  )
);
TableCaption.displayName = 'TableCaption';

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
