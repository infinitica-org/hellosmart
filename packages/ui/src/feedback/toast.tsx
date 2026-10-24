'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastData {
  id: string;
  title: string;
  description?: string | undefined;
  variant?: ToastVariant | undefined;
  duration?: number | undefined;
}

interface ToastContextValue {
  toast: (data: Omit<ToastData, 'id'>) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, variant = 'info', duration = 4000 }: Omit<ToastData, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastData = { id, title, description, variant, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }

      return id;
    },
    [dismiss]
  );

  const variantStyles: Record<ToastVariant, { icon: string; border: string }> = {
    info: { icon: 'text-indigo-400', border: 'border-indigo-500/30' },
    success: { icon: 'text-emerald-400', border: 'border-emerald-500/30' },
    warning: { icon: 'text-amber-400', border: 'border-amber-500/30' },
    error: { icon: 'text-rose-400', border: 'border-rose-500/30' },
  };

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => {
          const cfg = variantStyles[t.variant || 'info'];
          return (
            <div
              key={t.id}
              role="alert"
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl bg-slate-900/95 border ${cfg.border} shadow-2xl shadow-black/80 backdrop-blur-md text-slate-100 animate-fade-in`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold">{t.title}</div>
                {t.description && (
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    {t.description}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

