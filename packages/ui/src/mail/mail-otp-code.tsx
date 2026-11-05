import React, { forwardRef } from 'react';

export interface EmailOtpCodeProps extends React.HTMLAttributes<HTMLDivElement> {
  code: string | number;
  digits?: number | undefined;
  accentColor?: string | undefined;
  expiresInMinutes?: number | undefined;
  showHelperText?: boolean | undefined;
  helperText?: string | undefined;
}

export const EmailOtpCode = forwardRef<HTMLDivElement, EmailOtpCodeProps>(
  (
    {
      code = '3056',
      digits = 4,
      accentColor = '#fe7330', // HelloSmart signature brand orange
      expiresInMinutes = 10,
      showHelperText = true,
      helperText,
      className = '',
      ...props
    },
    ref
  ) => {
    // Format code as array of single characters
    const codeStr = String(code).replace(/\s+/g, '');
    const chars = codeStr.slice(0, digits).split('');

    // Fill with placeholder if shorter than digits
    while (chars.length < digits) {
      chars.push('•');
    }

    return (
      <div
        ref={ref}
        className={`w-full text-center py-4 select-none ${className}`}
        {...props}
      >
        {/* OTP Digits Row */}
        <div className="flex items-center justify-center gap-2.5 sm:gap-3.5 my-3">
          {chars.map((char, idx) => (
            <div
              key={`otp-char-${idx}`}
              className="w-13 h-16 sm:w-15 sm:h-18 flex items-center justify-center rounded-xl bg-white border-2 border-[#fed7aa] shadow-xs text-3xl sm:text-4xl font-extrabold font-mono transition-transform"
              style={{
                color: accentColor,
              }}
            >
              {char}
            </div>
          ))}
        </div>

        {/* Expiration Note */}
        {showHelperText && (
          <p className="text-xs text-neutral-500 font-medium mt-3">
            {helperText ?? `This single-use code is valid for ${expiresInMinutes} minutes. Never share this code.`}
          </p>
        )}
      </div>
    );
  }
);

EmailOtpCode.displayName = 'EmailOtpCode';
