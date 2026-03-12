'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function SuccessBanner() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const success = searchParams.get('success');
    const sessionId = searchParams.get('session_id');
    const canceled = searchParams.get('canceled');

    if (canceled === 'true') {
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (success === 'true' && sessionId) {
      setShow(true);
      fetch(`/api/checkout-session?session_id=${encodeURIComponent(sessionId)}`)
        .then((res) => res.json())
        .then((data) => setEmail(data.email ?? null))
        .catch(() => {})
        .finally(() => window.history.replaceState({}, '', window.location.pathname));
    }
  }, [searchParams]);

  if (!show) return null;

  return (
    <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-xl border border-humidor-like/30 bg-humidor-card px-6 py-4 shadow-lg">
      <p className="font-medium text-humidor-cream">
        Thanks for subscribing! Download the app and sign in with{' '}
        {email ? (
          <span className="text-humidor-primary">{email}</span>
        ) : (
          'the email you used'
        )}{' '}
        to activate Premium.
      </p>
    </div>
  );
}
