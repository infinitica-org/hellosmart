import React, { forwardRef, HTMLAttributes, ReactNode } from 'react';

export interface EmailCardProps extends HTMLAttributes<HTMLDivElement> {
  subject?: string | undefined;
  senderName?: string | undefined;
  senderEmail?: string | undefined;
  recipientEmail?: string | undefined;
  date?: string | undefined;
  showClientChrome?: boolean | undefined;
  children: ReactNode;
}

export const EmailCard = forwardRef<HTMLDivElement, EmailCardProps>(
  (
    {
      subject,
      senderName = 'HelloSmart.ai',
      senderEmail = 'no-reply@hellosmart.ai',
      recipientEmail,
      date,
      showClientChrome = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`w-full max-w-[620px] mx-auto my-6 ${className}`}
        {...props}
      >
        {/* Optional Email Client Chrome Preview (Subject, From, Date) */}
        {showClientChrome && (
          <div className="bg-neutral-100 border border-neutral-200/90 rounded-t-xl px-5 py-3.5 text-xs text-neutral-600 border-b-0 space-y-1">
            {subject && (
              <div className="font-semibold text-neutral-900 text-sm mb-1.5 flex items-center justify-between">
                <span>{subject}</span>
                {date && <span className="text-xs text-neutral-400 font-normal">{date}</span>}
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-neutral-400 font-medium">From:</span>
              <span className="font-medium text-neutral-800">{senderName}</span>
              <span className="text-neutral-400">&lt;{senderEmail}&gt;</span>
            </div>
            {recipientEmail && (
              <div className="flex items-center gap-2">
                <span className="text-neutral-400 font-medium">To:</span>
                <span className="text-neutral-700">{recipientEmail}</span>
              </div>
            )}
          </div>
        )}

        {/* Main Email White Card Container */}
        <div
          className={`bg-white border border-neutral-200/90 shadow-sm overflow-hidden text-neutral-900 ${
            showClientChrome ? 'rounded-b-xl' : 'rounded-2xl'
          }`}
        >
          {children}
        </div>
      </div>
    );
  }
);

EmailCard.displayName = 'EmailCard';

