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
    <div className="relative w-full overflow-auto rounded-xl border border-slate-800">
      <table
        ref={ref}
        className={`w-full caption-bottom text-left text-sm text-slate-200 border-collapse ${className}`}
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
      className={`border-b border-slate-800 bg-slate-900/80 text-xs font-semibold text-slate-400 uppercase tracking-wider ${className}`}
      {...props}
    />
  )
);
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', ...props }, ref) => (
    <tbody ref={ref} className={`divide-y divide-slate-800/80 bg-slate-950/20 ${className}`} {...props} />
  )
);
TableBody.displayName = 'TableBody';

export const TableFooter = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', ...props }, ref) => (
    <tfoot
      ref={ref}
      className={`border-t border-slate-800 bg-slate-900/60 font-medium text-slate-300 ${className}`}
      {...props}
    />
  )
);
TableFooter.displayName = 'TableFooter';

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className = '', ...props }, ref) => (
    <tr
      ref={ref}
      className={`transition-colors hover:bg-slate-800/40 data-[state=selected]:bg-slate-800 ${className}`}
      {...props}
    />
  )
);
TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', ...props }, ref) => (
    <th
      ref={ref}
      className={`h-11 px-4 text-left align-middle font-medium text-slate-400 [&:has([role=checkbox])]:pr-0 ${className}`}
      {...props}
    />
  )
);
TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', ...props }, ref) => (
    <td
      ref={ref}
      className={`p-4 align-middle text-xs text-slate-300 [&:has([role=checkbox])]:pr-0 ${className}`}
      {...props}
    />
  )
);
TableCell.displayName = 'TableCell';

export const TableCaption = forwardRef<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className = '', ...props }, ref) => (
    <caption ref={ref} className={`mt-4 text-xs text-slate-500 ${className}`} {...props} />
  )
);
TableCaption.displayName = 'TableCaption';

export interface ListProps extends HTMLAttributes<HTMLUListElement> {
  children: ReactNode;
}

export const List = forwardRef<HTMLUListElement, ListProps>(
  ({ className = '', children, ...props }, ref) => (
    <ul ref={ref} className={`divide-y divide-slate-800 rounded-xl border border-slate-800 bg-[#0c1222] ${className}`} {...props}>
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
    <li ref={ref} className={`p-4 flex items-center justify-between text-sm text-slate-300 ${className}`} {...props}>
      {children}
    </li>
  )
);
ListItem.displayName = 'ListItem';

