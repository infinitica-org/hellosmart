'use client';

import React from 'react';
import { Provider } from 'react-redux';
import { store } from './index';

export function CandidateStoreProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <Provider store={store}>{children}</Provider>;
}

