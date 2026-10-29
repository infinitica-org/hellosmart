'use client';

import React from 'react';
import Link from 'next/link';
import {
  Topbar as UiTopbar,
  type TopbarProps as UiTopbarProps,
  type TopbarVariant,
} from '@hs/ui';

export interface TopbarProps extends UiTopbarProps {}

export function Topbar(props: TopbarProps): React.JSX.Element {
  return (
    <UiTopbar
      renderLink={({ href, children, className, onClick }) => (
        <Link
          href={href}
          className={className}
          {...(onClick ? { onClick } : {})}
        >
          {children}
        </Link>
      )}
      {...props}
    />
  );
}

export type { TopbarVariant };
