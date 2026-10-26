'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar as UiSidebar,
  type SidebarProps as UiSidebarProps,
  type SidebarItem,
  DEFAULT_ADMIN_NAV_ITEMS,
  DEFAULT_COMPANY_NAV_ITEMS,
  DEFAULT_CANDIDATE_NAV_ITEMS,
} from '@hs/ui';

export type SidebarNavItem = SidebarItem;

export interface SidebarProps extends Omit<UiSidebarProps, 'renderLink' | 'currentPath'> {
  items?: SidebarItem[] | undefined;
}

export function Sidebar(props: SidebarProps): React.JSX.Element {
  const pathname = usePathname();

  return (
    <UiSidebar
      currentPath={pathname}
      renderLink={({ href, children, className, onClick }) => (
        <Link href={href} className={className} {...(onClick ? { onClick } : {})}>
          {children}
        </Link>
      )}
      {...props}
    />
  );
}

export {
  DEFAULT_ADMIN_NAV_ITEMS,
  DEFAULT_COMPANY_NAV_ITEMS,
  DEFAULT_CANDIDATE_NAV_ITEMS,
  type SidebarItem,
};
