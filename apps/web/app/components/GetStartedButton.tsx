'use client';

import { useEffect, useState } from 'react';

const APP_STORE_URL = 'https://apps.apple.com/app/cavaro';
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.brannonglover.cavaro';

type Device = 'ios' | 'android' | 'desktop' | null;

function getDevice(): Device {
  if (typeof window === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

export function GetStartedButton({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  const [device, setDevice] = useState<Device>(null);

  useEffect(() => {
    setDevice(getDevice());
  }, []);

  const handleScrollToDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' });
  };

  // SSR or not yet detected: render scroll-to-download (safe default)
  if (device === null) {
    return (
      <a href="#download" onClick={handleScrollToDownload} className={className}>
        {children}
      </a>
    );
  }

  if (device === 'ios') {
    return (
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }

  if (device === 'android') {
    return (
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }

  // Desktop: scroll to download section
  return (
    <a href="#download" onClick={handleScrollToDownload} className={className}>
      {children}
    </a>
  );
}
