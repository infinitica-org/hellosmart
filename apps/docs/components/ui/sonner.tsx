'use client';

import React from 'react';
import { Toaster as Sonner, ToasterProps } from 'sonner';

export const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      richColors
      closeButton
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-[#020b14]/95 group-[.toaster]:text-white group-[.toaster]:border-white/15 group-[.toaster]:shadow-2xl group-[.toaster]:backdrop-blur-xl group-[.toaster]:rounded-2xl font-sans text-sm py-3 px-4',
          description: 'group-[.toast]:text-slate-400 text-xs mt-1 leading-normal',
          actionButton:
            'group-[.toast]:bg-white group-[.toast]:text-black font-medium',
          cancelButton:
            'group-[.toast]:bg-white/10 group-[.toast]:text-white',
          error:
            'group-[.toast]:border-red-500/40 group-[.toast]:bg-red-950/90 group-[.toast]:text-red-200 shadow-red-950/50',
          success:
            'group-[.toast]:border-emerald-500/40 group-[.toast]:bg-emerald-950/90 group-[.toast]:text-emerald-200 shadow-emerald-950/50',
        },
      }}
      {...props}
    />
  );
};
