'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  ReactNode,
  HTMLAttributes,
} from 'react';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export type ToastPosition =
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'bottom-center';

export interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | undefined;
}

export interface ToastData {
  id: string;
  title: ReactNode;
  description?: ReactNode | undefined;
  variant?: ToastVariant | undefined;
  duration?: number | undefined;
  action?: ToastAction | undefined;
  icon?: ReactNode | undefined;
  dismissible?: boolean | undefined;
  onClose?: (() => void) | undefined;
  className?: string | undefined;
}

export type ToastInput = Omit<ToastData, 'id'> & { id?: string | undefined };

export interface ToastContextValue {
  toast: {
    (data: ToastInput): string;
    success: (title: ReactNode, description?: ReactNode, options?: Partial<ToastInput>) => string;
    error: (title: ReactNode, description?: ReactNode, options?: Partial<ToastInput>) => string;
    warning: (title: ReactNode, description?: ReactNode, options?: Partial<ToastInput>) => string;
    info: (title: ReactNode, description?: ReactNode, options?: Partial<ToastInput>) => string;
  };
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

export interface ToastItemProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'id'> {
  /** Toast data object (used when rendered inside ToastProvider) */
  toast?: ToastData | undefined;
  /** Direct title prop (for standalone usage) */
  title?: ReactNode | undefined;
  /** Direct description prop */
  description?: ReactNode | undefined;
  /** Visual variant */
  variant?: ToastVariant | undefined;
  /** Action button */
  action?: ToastAction | undefined;
  /** Custom icon override */
  icon?: ReactNode | undefined;
  /** Whether the dismiss button is visible (default: true) */
  dismissible?: boolean | undefined;
  /** Callback when toast is dismissed */
  onDismiss?: ((id?: string) => void) | undefined;
  /** Callback when auto-dismiss timer is paused (e.g. mouse hover) */
  onPause?: (() => void) | undefined;
  /** Callback when auto-dismiss timer is resumed */
  onResume?: (() => void) | undefined;
  /** Optional custom ID */
  id?: string | undefined;
}

const defaultIcons: Record<ToastVariant, React.JSX.Element> = {
  info: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  success: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const variantConfigs: Record<ToastVariant, { border: string; badge: string }> = {
  info: {
    border: 'border-neutral-200/90 border-l-4 border-l-primary',
    badge: 'bg-primary/10 text-primary border-primary/20',
  },
  success: {
    border: 'border-neutral-200/90 border-l-4 border-l-success',
    badge: 'bg-success-muted text-success border-success-border',
  },
  warning: {
    border: 'border-neutral-200/90 border-l-4 border-l-warning',
    badge: 'bg-warning-muted text-warning border-warning-border',
  },
  error: {
    border: 'border-neutral-200/90 border-l-4 border-l-danger',
    badge: 'bg-danger-muted text-danger border-danger-border',
  },
};

export const ToastItem = forwardRef<HTMLDivElement, ToastItemProps>(
  (
    {
      toast,
      title: propTitle,
      description: propDescription,
      variant: propVariant,
      action: propAction,
      icon: propIcon,
      dismissible: propDismissible,
      onDismiss,
      onPause,
      onResume,
      id: propId,
      className = '',
      onMouseEnter,
      onMouseLeave,
      ...props
    },
    ref
  ) => {
    // Resolve props from either `toast` data object or direct props
    const title = toast?.title ?? propTitle;
    const description = toast?.description ?? propDescription;
    const variant: ToastVariant = toast?.variant ?? propVariant ?? 'info';
    const action = toast?.action ?? propAction;
    const icon = toast?.icon ?? propIcon ?? defaultIcons[variant];
    const dismissible = toast?.dismissible ?? propDismissible ?? true;
    const toastId = toast?.id ?? propId;
    const itemClassName = toast?.className ?? className;

    const config = variantConfigs[variant];

    const handleDismiss = () => {
      toast?.onClose?.();
      onDismiss?.(toastId);
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
      onPause?.();
      onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      onResume?.();
      onMouseLeave?.(e);
    };

    return (
      <div
        ref={ref}
        role="alert"
        aria-live="polite"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-md bg-white border ${config.border} shadow-lg text-neutral-900 transition-all duration-200 animate-fade-in ${itemClassName}`}
        {...props}
      >
        <div className={`p-1.5 rounded-md border shrink-0 ${config.badge}`}>
          {icon}
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          {title && <div className="text-xs font-semibold text-neutral-900 leading-tight tracking-tight">{title}</div>}
          {description && (
            <div className="text-[11px] text-neutral-500 mt-1 leading-relaxed font-normal">
              {description}
            </div>
          )}
          {action && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
              }}
              className="mt-2 text-xs font-semibold text-primary hover:text-primary-hover underline underline-offset-2 block cursor-pointer transition-colors"
            >
              {action.label}
            </button>
          )}
        </div>

        {dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss notification"
            className="text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 p-1 rounded-sm transition-colors shrink-0 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    );
  }
);
ToastItem.displayName = 'ToastItem';

export interface ToastProviderProps {
  children: ReactNode;
  /** Screen position for toast stack (default: 'bottom-right') */
  position?: ToastPosition | undefined;
  /** Maximum number of toasts displayed simultaneously (default: 5) */
  maxToasts?: number | undefined;
  /** Default duration in ms before auto-dismiss (default: 4000). Set to 0 to disable auto-dismiss */
  defaultDuration?: number | undefined;
  /** Pause timer when hovering over a toast (default: true) */
  pauseOnHover?: boolean | undefined;
  /** Custom container class */
  className?: string | undefined;
}

const positionClasses: Record<ToastPosition, string> = {
  'top-right': 'top-4 right-4 items-end',
  'top-left': 'top-4 left-4 items-start',
  'bottom-right': 'bottom-4 right-4 items-end',
  'bottom-left': 'bottom-4 left-4 items-start',
  'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
};

let toastCounter = 0;

export function ToastProvider({
  children,
  position = 'bottom-right',
  maxToasts = 5,
  defaultDuration = 4000,
  pauseOnHover = true,
  className = '',
}: ToastProviderProps): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const timersRef = useRef<Map<string, { timeoutId: ReturnType<typeof setTimeout>; remaining: number; start: number }>>(
    new Map()
  );

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer.timeoutId);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t.timeoutId));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const pauseTimer = useCallback(
    (id: string) => {
      if (!pauseOnHover) return;
      const timer = timersRef.current.get(id);
      if (timer) {
        clearTimeout(timer.timeoutId);
        const elapsed = Date.now() - timer.start;
        timer.remaining = Math.max(0, timer.remaining - elapsed);
      }
    },
    [pauseOnHover]
  );

  const resumeTimer = useCallback(
    (id: string) => {
      if (!pauseOnHover) return;
      const timer = timersRef.current.get(id);
      if (timer && timer.remaining > 0) {
        timer.start = Date.now();
        timer.timeoutId = setTimeout(() => {
          dismiss(id);
        }, timer.remaining);
      }
    },
    [pauseOnHover, dismiss]
  );

  const createToast = useCallback(
    (data: ToastInput): string => {
      toastCounter += 1;
      const id = data.id || `toast-${Date.now()}-${toastCounter}`;
      const duration = data.duration !== undefined ? data.duration : defaultDuration;
      const newToast: ToastData = { ...data, id, duration };

      setToasts((prev) => {
        const next = [...prev, newToast];
        if (maxToasts > 0 && next.length > maxToasts) {
          const removed = next.shift();
          if (removed) {
            const timer = timersRef.current.get(removed.id);
            if (timer) clearTimeout(timer.timeoutId);
            timersRef.current.delete(removed.id);
          }
        }
        return next;
      });

      if (duration > 0) {
        const timerData = {
          remaining: duration,
          start: Date.now(),
          timeoutId: setTimeout(() => {
            dismiss(id);
          }, duration),
        };
        timersRef.current.set(id, timerData);
      }

      return id;
    },
    [defaultDuration, dismiss, maxToasts]
  );

  // Expose convenient helper methods on the toast function
  const toastMethod = useCallback(
    Object.assign((data: ToastInput) => createToast(data), {
      success: (title: ReactNode, description?: ReactNode, options?: Partial<ToastInput>) =>
        createToast({ ...options, title, description, variant: 'success' }),
      error: (title: ReactNode, description?: ReactNode, options?: Partial<ToastInput>) =>
        createToast({ ...options, title, description, variant: 'error' }),
      warning: (title: ReactNode, description?: ReactNode, options?: Partial<ToastInput>) =>
        createToast({ ...options, title, description, variant: 'warning' }),
      info: (title: ReactNode, description?: ReactNode, options?: Partial<ToastInput>) =>
        createToast({ ...options, title, description, variant: 'info' }),
    }),
    [createToast]
  );

  return (
    <ToastContext.Provider value={{ toast: toastMethod, dismiss, dismissAll }}>
      {children}
      <div
        aria-live="polite"
        className={`fixed z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none p-4 ${positionClasses[position]} ${className}`}
      >
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            toast={t}
            onDismiss={() => dismiss(t.id)}
            onPause={() => pauseTimer(t.id)}
            onResume={() => resumeTimer(t.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Aliases for convenience
export const Toast = ToastItem;
export type ToastProps = ToastItemProps;
