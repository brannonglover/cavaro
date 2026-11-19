'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

function isDesktop(): boolean {
  if (typeof window === 'undefined') return true; // SSR: show QR by default
  return !/iPad|iPhone|iPod|Android/.test(navigator.userAgent);
}

export function DownloadSection() {
  const [showQr, setShowQr] = useState(true);
  const [downloadUrl, setDownloadUrl] = useState('');

  useEffect(() => {
    setShowQr(isDesktop());
    setDownloadUrl(`${window.location.origin}${window.location.pathname}#download`);
  }, []);

  return (
    <div id="download" className="mt-10 flex flex-col items-center gap-8">
      {showQr && downloadUrl && (
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-xl border border-humidor-border bg-white p-4">
            <QRCodeSVG value={downloadUrl} size={160} level="M" />
          </div>
          <p className="text-center text-sm text-humidor-muted">
            Scan with your phone to download
          </p>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-4">
        <a
          href="https://apps.apple.com/app/cavaro"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-humidor-border bg-humidor-card px-6 py-3 text-humidor-cream transition-colors hover:border-humidor-primary hover:bg-humidor-card/80"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c1.33-1.54 1.12-3.75-.2-5.04-1.31-1.29-3.52-1.5-4.86.04-1.33 1.54-1.12 3.75.2 5.04 1.31 1.29 3.52 1.5 4.86-.04z" />
          </svg>
          App Store
        </a>
        <a
          href="https://play.google.com/store/apps/details?id=com.brannonglover.cavaro"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-humidor-border bg-humidor-card px-6 py-3 text-humidor-cream transition-colors hover:border-humidor-primary hover:bg-humidor-card/80"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"
            />
          </svg>
          Google Play
        </a>
      </div>
    </div>
  );
}
