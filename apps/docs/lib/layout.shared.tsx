import React from 'react';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <div
          className="flex items-center gap-1.5 text-2xl tracking-tight text-fd-foreground select-none"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          <span>HelloSmart</span>
          <sup className="text-xs font-sans text-sky-400">®</sup>
          <span className="text-xs font-sans text-slate-400 ml-1 font-normal tracking-normal">Docs</span>
        </div>
      ),
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
