'use client';

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  forwardRef,
  ReactNode,
  HTMLAttributes,
  ButtonHTMLAttributes,
} from 'react';

interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLButtonElement | null>;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdown() {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error('DropdownMenu components must be used within DropdownMenu');
  }
  return context;
}

export interface DropdownMenuProps {
  children: ReactNode;
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}

export function DropdownMenu({ children, open: controlledOpen, onOpenChange }: DropdownMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null) as React.MutableRefObject<HTMLButtonElement | null>;

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = (val: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(val);
    }
    onOpenChange?.(val);
  };

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className="relative inline-block text-left">{children}</div>
    </DropdownContext.Provider>
  );
}

export interface DropdownMenuTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  asChild?: boolean | undefined;
}

export const DropdownMenuTrigger = forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  ({ children, className = '', asChild = false, onClick, ...props }, ref) => {
    const { open, setOpen, triggerRef } = useDropdown();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      setOpen(!open);
    };

    const shouldClone = asChild || (React.isValidElement(children) && typeof children.type !== 'string');

    if (shouldClone && React.isValidElement(children)) {
      const child = children as React.ReactElement<any>;
      return React.cloneElement(child, {
        ref: (node: HTMLButtonElement) => {
          triggerRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
          const childRef = (child as any).ref;
          if (typeof childRef === 'function') childRef(node);
          else if (childRef) childRef.current = node;
        },
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
          child.props.onClick?.(e);
          handleClick(e);
        },
      });
    }

    return (
      <button
        ref={(node) => {
          triggerRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
        }}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleClick}
        className={className}
        {...props}
      >
        {children}
      </button>
    );
  }
);
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

export interface DropdownMenuContentProps extends HTMLAttributes<HTMLDivElement> {
  align?: ('left' | 'right') | undefined;
  children: ReactNode;
}

export const DropdownMenuContent = forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ align = 'left', className = '', children, ...props }, ref) => {
    const { open, setOpen, triggerRef } = useDropdown();
    const menuRef = useRef<HTMLDivElement | null>(null) as React.MutableRefObject<HTMLDivElement | null>;

    useEffect(() => {
      if (!open) return;

      const handleClickOutside = (e: MouseEvent) => {
        if (
          menuRef.current &&
          !menuRef.current.contains(e.target as Node) &&
          triggerRef.current &&
          !triggerRef.current.contains(e.target as Node)
        ) {
          setOpen(false);
        }
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setOpen(false);
          triggerRef.current?.focus();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const items = Array.from(
            menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') || []
          );
          if (items.length === 0) return;
          const currentIndex = items.findIndex((item) => item === document.activeElement);
          if (e.key === 'ArrowDown') {
            const next = (currentIndex + 1) % items.length;
            items[next]?.focus();
          } else {
            const prev = (currentIndex - 1 + items.length) % items.length;
            items[prev]?.focus();
          }
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);

      // Auto-focus first item on open
      const firstItem = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])');
      firstItem?.focus();

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }, [open, setOpen, triggerRef]);

    if (!open) return null;

    const alignClasses = align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left';

    return (
      <div
        ref={(node) => {
          menuRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        role="menu"
        aria-orientation="vertical"
        className={`absolute z-50 mt-2 min-w-[12rem] rounded-md border border-[#d8dee6] bg-white p-1 shadow-lg focus:outline-none ${alignClasses} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
DropdownMenuContent.displayName = 'DropdownMenuContent';

export interface DropdownMenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  icon?: ReactNode | undefined;
  variant?: ('default' | 'danger') | undefined;
}

export const DropdownMenuItem = forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
  ({ children, icon, variant = 'default', className = '', onClick, disabled, ...props }, ref) => {
    const { setOpen } = useDropdown();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      onClick?.(e);
      setOpen(false);
    };

    const variantStyles =
      variant === 'danger'
        ? 'text-danger hover:bg-danger-muted focus:bg-danger-muted'
        : 'text-neutral-700 hover:text-neutral-900 hover:bg-primary/10 focus:bg-primary/10 focus:text-neutral-900';

    return (
      <button
        ref={ref}
        type="button"
        role="menuitem"
        disabled={disabled}
        onClick={handleClick}
        className={`flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-xs font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none focus:outline-none ${variantStyles} ${className}`}
        {...props}
      >
        {icon && <span className="flex-shrink-0 text-neutral-500">{icon}</span>}
        <span className="flex-1 text-left">{children}</span>
      </button>
    );
  }
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

export interface DropdownMenuLabelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const DropdownMenuLabel = forwardRef<HTMLDivElement, DropdownMenuLabelProps>(
  ({ className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={`px-2.5 py-1.5 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

export const DropdownMenuSeparator = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div
      ref={ref}
      role="separator"
      className={`-mx-1.5 my-1.5 h-px bg-neutral-200 ${className}`}
      {...props}
    />
  )
);
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

export interface ContextMenuProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content'> {
  children: ReactNode;
  content: ReactNode;
}

export const ContextMenu = forwardRef<HTMLDivElement, ContextMenuProps>(
  ({ children, content, className = '', ...props }, ref) => {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const menuRef = useRef<HTMLDivElement | null>(null);

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      setPos({ x: e.clientX, y: e.clientY });
      setOpen(true);
    };

    useEffect(() => {
      if (!open) return;
      const close = () => setOpen(false);
      window.addEventListener('click', close);
      window.addEventListener('contextmenu', close);
      return () => {
        window.removeEventListener('click', close);
        window.removeEventListener('contextmenu', close);
      };
    }, [open]);

    return (
      <div ref={ref} onContextMenu={handleContextMenu} className={className} {...props}>
        {children}
        {open && (
          <div
            ref={(node) => {
              menuRef.current = node;
            }}
            style={{ position: 'fixed', left: `${pos.x}px`, top: `${pos.y}px` }}
            className="z-50 min-w-[10rem] rounded-md border border-neutral-200 bg-white p-1.5 shadow-lg"
          >
            {content}
          </div>
        )}
      </div>
    );
  }
);
ContextMenu.displayName = 'ContextMenu';

export interface NavigationMenuProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export const NavigationMenu = forwardRef<HTMLElement, NavigationMenuProps>(
  ({ children, className = '', ...props }, ref) => (
    <nav ref={ref} className={`flex items-center gap-1 ${className}`} {...props}>
      {children}
    </nav>
  )
);
NavigationMenu.displayName = 'NavigationMenu';

export interface SidebarNavItemProps extends HTMLAttributes<HTMLAnchorElement> {
  href: string;
  label: string;
  icon?: ReactNode | undefined;
  active?: boolean | undefined;
  badge?: string | undefined;
  'data-testid'?: string | undefined;
}

export const SidebarNavItem = forwardRef<HTMLAnchorElement, SidebarNavItemProps>(
  ({ href, label, icon, active = false, badge, className = '', ...props }, ref) => (
    <a
      ref={ref}
      href={href}
      className={`flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-all ${
 active
 ? 'bg-primary/10 text-primary border border-primary/30 font-semibold'
          : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
      } ${className}`}
      {...props}
    >
      <div className="flex items-center gap-3">
        {icon && <span className={active ? 'text-primary' : 'text-neutral-500'}>{icon}</span>}
        <span>{label}</span>
      </div>
      {badge && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
          {badge}
        </span>
      )}
    </a>
  )
);
SidebarNavItem.displayName = 'SidebarNavItem';

export interface SidebarNavGroupProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export const SidebarNavGroup = forwardRef<HTMLElement, SidebarNavGroupProps>(
  ({ children, className = '', ...props }, ref) => (
    <nav ref={ref} className={`space-y-1 ${className}`} {...props}>
      {children}
    </nav>
  )
);
SidebarNavGroup.displayName = 'SidebarNavGroup';

export const SidebarNavigation = SidebarNavGroup;
export type SidebarNavigationProps = SidebarNavGroupProps;
