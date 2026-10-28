'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar as UiSidebar,
  type SidebarProps as UiSidebarProps,
  type SidebarItem,
} from '@hs/ui';
import type { NavigationItem } from '@/types/navigation';

export type SidebarNavItem = SidebarItem;

export interface SidebarProps extends Omit<UiSidebarProps, 'renderLink' | 'currentPath' | 'items' | 'navLinks'> {
  items?: (SidebarItem | NavigationItem)[] | undefined;
  navLinks?: (SidebarItem | NavigationItem)[] | undefined;
}

export function Sidebar(props: SidebarProps): React.JSX.Element {
  const pathname = usePathname();
  const effectiveItems = (props.navLinks ?? props.items) as SidebarItem[] | undefined;

  return (
    <UiSidebar
      currentPath={pathname}
      renderLink={({ href, children, className, onClick, target, rel, disabled, item, onMouseEnter, onMouseLeave, ...rest }) => (
        <Link
          href={href}
          className={className}
          {...(target ? { target } : {})}
          {...(rel ? { rel } : {})}
          {...(disabled ? { 'aria-disabled': true, tabIndex: -1 } : {})}
          {...(onClick ? { onClick } : {})}
          {...(onMouseEnter ? { onMouseEnter } : {})}
          {...(onMouseLeave ? { onMouseLeave } : {})}
          {...rest}
        >
          {children}
        </Link>
      )}
      {...props}
      items={effectiveItems}
      navLinks={effectiveItems}
    />
  );
}

export {
  type SidebarItem,
};
