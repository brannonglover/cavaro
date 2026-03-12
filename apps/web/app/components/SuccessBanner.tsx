'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function SuccessBanner() {
  const searchParams = useSearchParams();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    if (success === 'true') {
      setShow(true);
      // Clear URL params without full reload
      window.history.replaceState({}, '', window.location.pathname);
    } else if (canceled === 'true') {
      // Optionally show a "checkout canceled" message - for now we'll just clear the URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  if (!show) return null;

  return (
    <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-xl border border-humidor-like/30 bg-humidor-card px-6 py-4 shadow-lg">
      <p className="font-medium text-humidor-cream">
        Thanks for subscribing! You now have access to Cavaro Premium.
      </p>
    </div>
  );
}
