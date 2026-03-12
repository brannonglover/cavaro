'use client';

import { useState } from 'react';

type SubscribeButtonProps = {
  className?: string;
  children: React.ReactNode;
};

export function SubscribeButton({ className, children }: SubscribeButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to create checkout session');

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSubscribe}
      disabled={loading}
      className={className}
    >
      {loading ? 'Redirecting...' : children}
    </button>
  );
}
