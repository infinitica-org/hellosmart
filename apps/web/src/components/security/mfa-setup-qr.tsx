'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export interface MfaSetupQrProps {
  otpauthUri: string;
}

export function MfaSetupQr({ otpauthUri }: MfaSetupQrProps): React.JSX.Element {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setDataUrl(null);

    QRCode.toDataURL(otpauthUri, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [otpauthUri]);

  if (failed) {
    return (
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
        Could not render QR code. Enter the secret key below manually in your authenticator app.
      </p>
    );
  }

  if (!dataUrl) {
    return (
      <div
        className="w-[220px] h-[220px] rounded-xl border border-neutral-200 bg-neutral-50 animate-pulse"
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="inline-flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt="QR code for authenticator app setup"
        width={220}
        height={220}
        className="rounded-xl border border-neutral-200 bg-white p-2"
      />
      <p className="text-xs text-neutral-500 text-center max-w-[220px]">
        Scan with Google Authenticator, 1Password, Authy, or similar
      </p>
    </div>
  );
}
